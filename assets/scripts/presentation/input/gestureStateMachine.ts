import { BoardSize } from '../../domain/board/cellIndex';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';
import { cellPathBetween } from './cellBoundaryTraversal';
import { GestureInputConfig } from './gestureInputConfig';
import { PlayerGesture } from './gestureCommandMapper';

export interface Point {
    readonly x: number;
    readonly y: number;
}

/**
 * What GestureStateMachine needs from its host: a way to emit a decided gesture, a way to
 * schedule/cancel the double-tap confirmation timer, and read-only access to the current
 * snapshot. The machine owns no timer itself and makes no gameplay decision; GameSession remains
 * the sole authority over what a gesture actually does.
 */
export interface GestureStateMachineHost {
    emitGesture(gesture: PlayerGesture): void;
    scheduleTapConfirm(ms: number): void;
    cancelTapConfirm(): void;
    getSnapshot(): GameSnapshot;
}

type DragKind = 'empty' | 'x' | 'track';

type InternalState =
    | { readonly kind: 'idle' }
    | {
          readonly kind: 'pressed';
          readonly cell: number;
          readonly origin: Point;
          readonly startTimeMs: number;
          /** True when this press matched a just-fired tap on the same cell within the window —
           * its release upgrades to a double tap instead of firing a second plain tap. */
          readonly isSecondTap: boolean;
      }
    | { readonly kind: 'awaitingSecondTap'; readonly cell: number; readonly origin: Point; readonly firedAtMs: number }
    | { readonly kind: 'draggingBatch'; readonly mode: 'empty' | 'x'; readonly visited: readonly number[]; readonly lastCell: number }
    | { readonly kind: 'draggingTrack'; readonly pivot: number };

function distance(a: Point, b: Point): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/**
 * A cell is a valid Track-drag origin when it is TrackPreview, Track, a Track ? cell (one with a
 * pending connection in snapshot.trackQuestions — Track ? is derived state, not a PlayerCellState,
 * so this checks trackQuestions directly rather than inventing a new state), or a GIVEN cell
 * (Main Track, pre-filled — confirmed by the user: dragging from it works like any other Track
 * cell). A given cell's own PlayerCellState is always Empty (its Track look comes from Main Track
 * ports, not player state), so it must be checked explicitly — snapshot.cellStates alone would
 * misclassify it as a plain Empty cell and route the gesture into an X-marking drag instead.
 */
export function classifyDragOrigin(snapshot: GameSnapshot, cell: number): DragKind | null {
    const state = snapshot.cellStates[cell];
    const isTrackQuestion = snapshot.trackQuestions.some((question) => question.cell === cell);
    const isGivenCell = snapshot.mainTrackCells.indexOf(cell) !== -1;
    if (isGivenCell || isTrackQuestion || state === PlayerCellState.TrackPreview || state === PlayerCellState.Track) {
        return 'track';
    }
    if (state === PlayerCellState.Empty) {
        return 'empty';
    }
    if (state === PlayerCellState.X) {
        return 'x';
    }
    return null; // RedX, or any other state: locked, no drag is possible.
}

/**
 * Turns raw pointer events into neutral gestures (tap, double tap, the two drag batches, and
 * Track-drag steps), and reports them to the host. It decides nothing about gameplay: origin
 * classification only reads the snapshot's existing state, and every emitted gesture still goes
 * through GameSession, which can accept or reject it.
 *
 * A tap fires IMMEDIATELY on release — confirmed by the user: marking must have no delay. Double
 * tap is recognised the OTHER way round from a typical "wait, then fire" pattern: after a tap
 * fires, a short window watches for a quick SECOND press on the same cell; if one lands within it,
 * ITS release fires 'doubleTap' instead of a second 'tap'. The first tap's effect already applied
 * (e.g. Empty -> X) and the double tap command then acts on that resulting state (e.g. X ->
 * TrackPreview) — GameSession already handles that transition, so no take-back is needed.
 *
 * Owns no real timer: `scheduleTapConfirm`/`cancelTapConfirm`/`timerExpired` let the host (a Cocos
 * component) use its own scheduler, so the host can guarantee no pending callback survives a
 * cancel, restart, or destroy.
 */
export class GestureStateMachine {
    private state: InternalState = { kind: 'idle' };

    constructor(
        private readonly config: GestureInputConfig,
        private readonly host: GestureStateMachineHost,
    ) {}

    pointerDown(point: Point, cell: number, timeMs: number): void {
        if (this.state.kind === 'awaitingSecondTap') {
            const awaiting = this.state;
            const withinWindow = timeMs - awaiting.firedAtMs <= this.config.doubleTapWindowMs;
            const withinDistance = distance(point, awaiting.origin) <= this.config.doubleTapDistanceUi;
            this.host.cancelTapConfirm();
            const isSecondTap = cell === awaiting.cell && withinWindow && withinDistance;
            this.state = { kind: 'pressed', cell, origin: point, startTimeMs: timeMs, isSecondTap };
            return;
        }
        if (this.state.kind !== 'idle') {
            return; // A second pointer while one is already active (multi-touch): out of scope.
        }
        this.state = { kind: 'pressed', cell, origin: point, startTimeMs: timeMs, isSecondTap: false };
    }

    pointerMove(point: Point, cell: number, timeMs: number): void {
        if (this.state.kind === 'pressed') {
            if (distance(point, this.state.origin) < this.config.dragDistanceUi) {
                return; // Still inside the tap tolerance.
            }
            this.beginDrag(this.state.cell, cell);
            return;
        }
        if (this.state.kind === 'draggingBatch') {
            this.continueBatchDrag(cell);
            return;
        }
        if (this.state.kind === 'draggingTrack') {
            this.continueTrackDrag(cell);
            return;
        }
        void timeMs; // idle / awaitingSecondTap: a move with no active press is ignored.
    }

    pointerUp(timeMs: number): void {
        switch (this.state.kind) {
            case 'pressed': {
                const { cell, origin, startTimeMs, isSecondTap } = this.state;
                const duration = timeMs - startTimeMs;
                if (duration > this.config.maxTapDurationMs) {
                    this.state = { kind: 'idle' }; // Held too long: no gesture (hold behaviour is UNKNOWN).
                    return;
                }
                if (isSecondTap) {
                    this.host.emitGesture({ kind: 'doubleTap', cell });
                    this.state = { kind: 'idle' };
                    return;
                }
                // Fire the tap NOW — no delay — then watch briefly for a quick second press to
                // upgrade it into a double tap.
                this.host.emitGesture({ kind: 'tap', cell });
                this.state = { kind: 'awaitingSecondTap', cell, origin, firedAtMs: timeMs };
                this.host.scheduleTapConfirm(this.config.doubleTapWindowMs);
                return;
            }
            case 'draggingBatch':
                // Each cell was already marked/unmarked AS the drag crossed it (confirmed by the
                // user: no waiting for release) — nothing left to emit here.
                this.state = { kind: 'idle' };
                return;
            case 'draggingTrack':
                this.host.emitGesture({ kind: 'trackDragEnd' });
                this.state = { kind: 'idle' };
                return;
            default:
                return; // idle / awaitingSecondTap: no active press to release.
        }
    }

    /** Discards the current gesture. Emits nothing, except ending an in-progress Track drag. */
    pointerCancel(): void {
        if (this.state.kind === 'awaitingSecondTap') {
            this.host.cancelTapConfirm();
        }
        if (this.state.kind === 'draggingTrack') {
            this.host.emitGesture({ kind: 'trackDragEnd' });
        }
        this.state = { kind: 'idle' };
    }

    /** Called by the host when its scheduled tap-confirm timer actually fires: the window for a
     * second tap closed with nothing landing. The tap itself already fired on release; there is
     * nothing left to emit here. */
    timerExpired(): void {
        if (this.state.kind !== 'awaitingSecondTap') {
            return; // Already resolved by a matching second press, or cancelled.
        }
        this.state = { kind: 'idle' };
    }

    private beginDrag(originCell: number, currentCell: number): void {
        const kind = classifyDragOrigin(this.host.getSnapshot(), originCell);
        if (kind === null) {
            this.state = { kind: 'idle' }; // RedX or otherwise locked: no drag is possible.
            return;
        }
        if (kind === 'track') {
            this.host.emitGesture({ kind: 'trackDragBegin', cell: originCell });
            this.state = { kind: 'draggingTrack', pivot: originCell };
            this.continueTrackDrag(currentCell);
            return;
        }
        // Mark/unmark the origin cell itself right away too — confirmed by the user: a drag acts
        // on every cell AS it is crossed, not as one batch collected until release.
        this.emitBatchStep(kind, originCell);
        this.state = { kind: 'draggingBatch', mode: kind, visited: [originCell], lastCell: originCell };
        this.continueBatchDrag(currentCell);
    }

    /**
     * Marks/unmarks each newly-crossed cell IMMEDIATELY (confirmed by the user) instead of
     * collecting a batch to apply only on release — mirrors continueTrackDrag's own step-at-a-time
     * emission below, just for the simpler Empty/X drags.
     */
    private continueBatchDrag(currentCell: number): void {
        if (this.state.kind !== 'draggingBatch') {
            return;
        }
        const size = boardSizeOf(this.host.getSnapshot());
        const steps = cellPathBetween(size, this.state.lastCell, currentCell);
        if (steps.length === 0) {
            return;
        }
        const visited = this.state.visited.slice();
        for (const cell of steps) {
            if (!visited.includes(cell)) {
                visited.push(cell);
                this.emitBatchStep(this.state.mode, cell);
            }
        }
        this.state = { kind: 'draggingBatch', mode: this.state.mode, visited, lastCell: currentCell };
    }

    private emitBatchStep(mode: 'empty' | 'x', cell: number): void {
        const kind = mode === 'empty' ? 'emptyDragBatch' : 'xDragBatch';
        this.host.emitGesture({ kind, cells: [cell] });
    }

    /**
     * Steps one boundary crossing at a time toward currentCell, re-reading the session's own drag
     * pivot after each emitted step. GameSession may end the drag on its own (a wrong target does
     * not move the pivot, a Main Track connection ends the drag, a win ends it); this keeps the
     * input layer a passive mirror of that outcome instead of deciding it.
     */
    private continueTrackDrag(currentCell: number): void {
        if (this.state.kind !== 'draggingTrack') {
            return;
        }
        let pivot = this.state.pivot;
        if (pivot === currentCell) {
            return;
        }
        const size = boardSizeOf(this.host.getSnapshot());
        const steps = cellPathBetween(size, pivot, currentCell);
        for (const to of steps) {
            this.host.emitGesture({ kind: 'trackBoundaryStep', from: pivot, to });
            const afterPivot = this.host.getSnapshot().dragPivot;
            if (afterPivot === null) {
                this.state = { kind: 'idle' }; // The session ended the drag itself (Won, or the 3rd mistake).
                return;
            }
            pivot = afterPivot;
        }
        this.state = { kind: 'draggingTrack', pivot };
    }
}

function boardSizeOf(snapshot: GameSnapshot): BoardSize {
    return { width: snapshot.width, height: snapshot.height };
}
