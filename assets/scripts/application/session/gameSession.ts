import { Board } from '../../domain/board/board';
import { findTrackHint, TrackHint } from '../../domain/rules/trackHint';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { Direction } from '../../domain/board/direction';
import { isIndexInBounds, neighborIndex } from '../../domain/board/cellIndex';
import { LevelData } from '../../domain/level/levelData';
import { createSolutionTruth, SolutionTruth } from '../../domain/level/solutionTruth';
import { applyBoundaryCrossing } from '../../domain/rules/boundaryCrossing';
import { MAX_MISTAKES, MistakeCounter } from '../../domain/rules/mistakeCounter';
import { SessionProgress, levelSignature, readSessionProgress } from './sessionProgress';
import { hasCompleteRailPath, isWon } from '../../domain/rules/winRule';
import { cellsInRow, cellsInColumn, clueSatisfaction } from '../../domain/rules/clueSatisfaction';
import { GameCommand } from '../commands/gameCommand';
import {
    CommandResult,
    GamePhase,
    GameSnapshot,
    MainTrackPorts,
    RejectionReason,
    TrackQuestion,
} from '../contracts/gameSnapshot';

export interface GameSessionOptions {
    readonly level: LevelData;
    /** Cells that must be completed by Player Tracks. Supplied by the caller, never inferred. */
    readonly requiredCells: readonly number[];
    /**
     * Tutorial mode (confirmed by the user) — never set for a real gameplay session. Two rule
     * changes, both scoped to what the tutorial script explicitly asked for:
     *   - A wrong double-tap (double-tapping a non-solution cell) still paints RedX (the player
     *     must still see "Wrong mark"), but does NOT record a mistake.
     *   - A wrong drag crossing (dragging across a non-solution Empty cell) does NOTHING AT ALL —
     *     no RedX, no mistake, the drag is not interrupted — unlike real gameplay, where this
     *     paints RedX and counts a mistake (see applyBoundaryCrossing's 'wrongTarget').
     */
    readonly tutorialMode?: boolean;
}

/** Interaction state of a Track drag. Not committed board state; cleared on release. */
interface TrackDrag {
    readonly pivot: number;
}

/**
 * One gameplay session for one level. Owns the player board, mistakes, phase and drag state.
 * Not a singleton: create a new session per level attempt.
 */
export class GameSession {
    private pendingHint: { hint: TrackHint; board: Board } | null = null;

    requestHint(): TrackHint | null {
        this.pendingHint = null;
        if (this.phase !== GamePhase.Active) return null;
        const hint = findTrackHint(this.board, this.truth,
            this.requiredCells.every(c => this.isCellIdentified(c)), this.findNextTrackCell());
        if (hint) this.pendingHint = { hint, board: this.board };
        return hint;
    }

    cancelHint(): void { this.pendingHint = null; }

    applyHint(hint: TrackHint): CommandResult {
        const pending = this.pendingHint;
        this.pendingHint = null;
        if (this.phase !== GamePhase.Active) return this.rejected('gameFinished');
        if (!pending || pending.hint !== hint || pending.board !== this.board) return this.rejected('notAllowedOnState');
        let next = this.board;
        for (const cell of hint.targets) {
            if (hint.action === 'shape') {
                next = next.withState(cell, PlayerCellState.TrackPreview);
                for (const direction of hint.directions) next = next.withLink(cell, direction);
            } else next = next.withState(cell, hint.action === 'markX' ? PlayerCellState.X
                : hint.action === 'removeX' ? PlayerCellState.Empty : PlayerCellState.TrackPreview);
        }
        this.board = next;
        this.drag = null;
        return this.afterConnection();
    }
    private readonly truth: SolutionTruth;
    private readonly requiredCells: readonly number[];
    private readonly tutorialMode: boolean;
    private board: Board;
    private mistakes: MistakeCounter;
    private phase: GamePhase;
    private drag: TrackDrag | null;

    constructor(options: GameSessionOptions) {
        if (options.requiredCells.length === 0) {
            // isWon treats an empty set as satisfied, so an empty set would win immediately.
            throw new RangeError('requiredCells must not be empty.');
        }
        for (const cell of options.requiredCells) {
            if (!isIndexInBounds(options.level.size, cell)) {
                throw new RangeError(`Required cell ${cell} is outside the board.`);
            }
        }
        this.truth = createSolutionTruth(options.level);
        this.requiredCells = Object.freeze([...options.requiredCells]);
        this.tutorialMode = options.tutorialMode ?? false;
        this.board = Board.empty(options.level.size, this.truth.mainTrack);
        this.mistakes = MistakeCounter.initial();
        this.phase = GamePhase.Active;
        this.drag = null;
    }

    exportProgress(): SessionProgress | null {
        if (this.phase !== GamePhase.Active) return null;
        const snapshot = this.snapshot();
        return Object.freeze({ version: 1, levelSignature: levelSignature(this.truth, this.requiredCells),
            states: snapshot.cellStates, links: snapshot.cellLinks, mistakes: this.mistakes.count });
    }

    restoreProgress(raw: unknown): boolean {
        const restored = readSessionProgress(raw, this.truth, this.requiredCells);
        if (!restored || (isWon(restored.board, this.requiredCells) && hasCompleteRailPath(restored.board, this.truth))) return false;
        this.board = restored.board;
        this.mistakes = restored.mistakes;
        this.phase = GamePhase.Active;
        this.drag = null;
        return true;
    }

    snapshot(): GameSnapshot {
        const { width, height } = this.truth.level.size;
        const count = width * height;
        const cellStates: PlayerCellState[] = [];
        const cellLinks: (readonly Direction[])[] = [];
        const trackQuestions: TrackQuestion[] = [];
        for (let cell = 0; cell < count; cell++) {
            cellStates.push(this.board.stateAt(cell));
            const links = this.board.linksAt(cell);
            cellLinks.push(links);
            if (links.length === 1) {
                trackQuestions.push(Object.freeze({ cell, direction: links[0] }));
            }
        }
        const path = this.truth.level.solutionPath;
        const entranceCell = path[0];
        const exitCell = path[path.length - 1];
        // Main Track cells = level.given (CONFIRMED-BY-USER: always includes s[0]/s[-1], may include
        // more pre-filled cells). Only the two true board-edge endpoints have an outward port.
        const mainCells: readonly number[] = this.truth.level.given;
        const mainTrackPorts: MainTrackPorts[] = mainCells.map((cell) =>
            Object.freeze({
                cell,
                directions: this.board.mainTrack.portsAt(cell),
                outward:
                    cell === entranceCell
                        ? this.truth.level.outwardStart
                        : cell === exitCell
                          ? this.truth.level.outwardEnd
                          : null,
            }),
        );
        // Confirmed by the user: once every required cell has been identified as track (TrackPreview,
        // Track ?, or a completed Track — i.e. not left Empty/X), but at least one is not yet a fully
        // connected Track, show a hint telling the player to connect them. A required cell can only
        // ever be Empty, X, TrackPreview or Track (double-tap only ever turns a SOLUTION cell RedX,
        // and every required cell is a solution cell by definition), so this check alone also covers
        // Track ? (which is PlayerCellState.TrackPreview with one link, per Board's own invariant).
        const allRequiredIdentified = this.requiredCells.every((cell) => {
            const state = this.board.stateAt(cell);
            return state === PlayerCellState.TrackPreview || state === PlayerCellState.Track;
        });
        const needsConnectionHint =
            this.phase === GamePhase.Active && allRequiredIdentified
            && !(isWon(this.board, this.requiredCells) && hasCompleteRailPath(this.board, this.truth));
        return Object.freeze({
            rowClues: Object.freeze(Array.from({ length: height }, (_, row) =>
                clueSatisfaction(this.board, cellsInRow(this.board, row), this.truth))),
            columnClues: Object.freeze(Array.from({ length: width }, (_, column) =>
                clueSatisfaction(this.board, cellsInColumn(this.board, column), this.truth))),
            phase: this.phase,
            width,
            height,
            cellStates: Object.freeze(cellStates),
            cellLinks: Object.freeze(cellLinks),
            trackQuestions: Object.freeze(trackQuestions),
            mainTrackCells: Object.freeze([...mainCells]),
            mainTrackPorts: Object.freeze(mainTrackPorts),
            entranceCell,
            exitCell,
            dragPivot: this.drag ? this.drag.pivot : null,
            mistakes: this.mistakes.count,
            maxMistakes: MAX_MISTAKES,
            needsConnectionHint,
        });
    }

    dispatch(command: GameCommand): CommandResult {
        if (command.type === 'restart') {
            this.restart();
            return this.accepted(true);
        }
        // Revive (xác nhận từ user, nút "Xem quảng cáo để hồi sinh" ở popup thua): chỉ hợp lệ khi
        // ĐANG Lost — đặt TRƯỚC guard phase!==Active bên dưới, giống hệt 'restart', vì bản thân nó
        // phải chạy được NGAY TẠI phase Lost.
        if (command.type === 'revive') {
            if (this.phase !== GamePhase.Lost) {
                return this.rejected('notLost');
            }
            this.revive();
            return this.accepted(true);
        }
        if (this.phase !== GamePhase.Active) {
            return this.rejected('gameFinished');
        }
        switch (command.type) {
            case 'tapCell':
                return this.handleTap(command.cell);
            case 'doubleTapCell':
                return this.handleDoubleTap(command.cell);
            case 'markCellsAsX':
                return this.handleMarkCellsAsX(command.cells);
            case 'removeXCells':
                return this.handleRemoveXCells(command.cells);
            case 'beginTrackDrag':
                return this.handleBeginTrackDrag(command.cell);
            case 'trackBoundaryCrossed':
                return this.handleBoundaryCrossed(command.from, command.to);
            case 'endTrackDrag':
                this.drag = null;
                return this.accepted(false);
            case 'applyTrackShape':
                return this.handleApplyTrackShape(command.cell, command.directions);
            case 'resetTrackPreview':
                return this.handleResetTrackPreview(command.cell);
            case 'placeTrack':
                return this.handlePlaceTrack();
        }
    }

    /** Single tap: Empty -> X, X -> Empty. TrackPreview and Track are no-ops. RedX is locked. */
    private handleTap(cell: number): CommandResult {
        const rejection = this.checkTargetCell(cell);
        if (rejection) {
            return this.rejected(rejection);
        }
        const state = this.board.stateAt(cell);
        if (state === PlayerCellState.RedX) {
            return this.rejected('redXLocked');
        }
        if (state === PlayerCellState.TrackPreview || state === PlayerCellState.Track) {
            return this.accepted(false);
        }
        if (this.board.linksAt(cell).length > 0) {
            // Track ? tap behaviour is UNKNOWN.
            return this.rejected('notAllowedOnState');
        }
        const next = state === PlayerCellState.Empty ? PlayerCellState.X : PlayerCellState.Empty;
        this.board = this.board.withState(cell, next);
        return this.accepted(true);
    }

    /**
     * Double tap: Empty, X, and Track -> TrackPreview — but ONLY on a solution cell (confirmed by
     * the user: placing TrackPreview on a non-solution cell is a wrong placement, not a free
     * preview). A non-solution target becomes RedX immediately instead, exactly like a wrong Track
     * drag target (see applyBoundaryCrossing). TrackPreview is a no-op. RedX is locked.
     *
     * Confirmed by the user (permanent change, both tutorial and real gameplay): double-tapping
     * ANY cell that already has a link — a completed Track (2 links) *or* a Track ? (1 link) —
     * always reverts it straight to a bare TrackPreview. A cell with any link is always a solution
     * cell (the only way to acquire a link requires having been a solution-cell TrackPreview
     * first), so this check needs no separate solution-cell branch and subsumes the old
     * Track-only case and the old "Track ? double-tap is UNKNOWN" rejection.
     */
    private handleDoubleTap(cell: number): CommandResult {
        const rejection = this.checkTargetCell(cell);
        if (rejection) {
            return this.rejected(rejection);
        }
        const state = this.board.stateAt(cell);
        if (state === PlayerCellState.RedX) {
            return this.rejected('redXLocked');
        }
        if (this.board.linksAt(cell).length > 0) {
            this.board = this.board.withState(cell, PlayerCellState.TrackPreview);
            return this.accepted(true);
        }
        if (state === PlayerCellState.TrackPreview) {
            return this.accepted(false);
        }
        if (!this.truth.isSolutionCell(cell)) {
            // Same consequence as a wrong Track drag target (confirmed by the user): counts as one
            // of the 3 mistakes, and can end the game exactly like a wrong drag crossing does —
            // EXCEPT in tutorialMode, where the mistake is never recorded (still shown as RedX).
            this.board = this.board.withState(cell, PlayerCellState.RedX);
            if (!this.tutorialMode) {
                this.mistakes = this.mistakes.recordMistake();
                if (this.mistakes.isLost) {
                    this.phase = GamePhase.Lost;
                }
            }
            return this.accepted(true);
        }
        this.board = this.board.withState(cell, PlayerCellState.TrackPreview);
        return this.accepted(true);
    }

    /**
     * Batch from a drag that starts on Empty. Validated as a whole: if any cell is ineligible,
     * nothing changes. Whether the real game commits partial batches is UNKNOWN.
     */
    private handleMarkCellsAsX(cells: readonly number[]): CommandResult {
        const unique = [...new Set(cells)];
        if (unique.length === 0) {
            return this.rejected('emptyBatch');
        }
        for (const cell of unique) {
            if (this.checkTargetCell(cell) !== null) {
                return this.rejected('batchContainsIneligibleCell');
            }
            if (this.board.stateAt(cell) !== PlayerCellState.Empty || this.board.linksAt(cell).length > 0) {
                return this.rejected('batchContainsIneligibleCell');
            }
        }
        for (const cell of unique) {
            this.board = this.board.withState(cell, PlayerCellState.X);
        }
        return this.accepted(true);
    }

    /** X-removal drag: removes the listed X cells. Never applies Track, Track ? or RedX logic. */
    private handleRemoveXCells(cells: readonly number[]): CommandResult {
        const unique = [...new Set(cells)];
        if (unique.length === 0) {
            return this.rejected('emptyBatch');
        }
        for (const cell of unique) {
            if (!isIndexInBounds(this.truth.level.size, cell) || this.board.stateAt(cell) !== PlayerCellState.X) {
                return this.rejected('batchContainsIneligibleCell');
            }
        }
        for (const cell of unique) {
            this.board = this.board.withState(cell, PlayerCellState.Empty);
        }
        return this.accepted(true);
    }

    /**
     * Valid drag origins: TrackPreview, Track, Track ? (per the contract), and — confirmed by the
     * user — any given cell (Main Track, pre-filled from level start). A given cell behaves exactly
     * like any other Track cell as a drag origin, even though it is never a valid tap/double-tap
     * target (that stays gated by checkTargetCell elsewhere).
     */
    private handleBeginTrackDrag(cell: number): CommandResult {
        if (this.drag !== null) {
            return this.rejected('dragAlreadyActive');
        }
        if (!isIndexInBounds(this.truth.level.size, cell)) {
            return this.rejected('outOfBounds');
        }
        const state = this.board.stateAt(cell);
        // A Track ? cell (one connection, per snapshot.trackQuestions) is a valid continuation
        // point even when its PlayerCellState is still Empty or X; Track ? is not its own state.
        const isTrackQuestion = this.board.linksAt(cell).length > 0;
        const isGivenCell = this.board.mainTrack.portsAt(cell).length > 0;
        const isValidOrigin =
            isGivenCell ||
            state === PlayerCellState.TrackPreview ||
            state === PlayerCellState.Track ||
            isTrackQuestion;
        if (!isValidOrigin) {
            return this.rejected('notAllowedOnState');
        }
        this.drag = { pivot: cell };
        return this.accepted(false);
    }

    private handleBoundaryCrossed(from: number, to: number): CommandResult {
        if (this.drag === null) {
            return this.rejected('noActiveDrag');
        }
        if (from !== this.drag.pivot) {
            return this.rejected('notPivot');
        }
        const result = applyBoundaryCrossing(this.board, this.truth, from, to);
        switch (result.kind) {
            case 'connected':
                this.board = result.board;
                this.drag = this.dragAfterCrossing(to);
                return this.afterConnection();
            case 'alreadyConnected':
                // Choice: the drag moves on to the target. Real behaviour is UNKNOWN.
                this.drag = this.dragAfterCrossing(to);
                return this.accepted(false);
            case 'wrongTarget':
                // tutorialMode (confirmed by the user): dragging across a wrong empty cell does
                // NOTHING AT ALL — no RedX, no mistake, and (already true either way) the pivot is
                // left unchanged so the drag is never interrupted.
                if (this.tutorialMode) {
                    return this.accepted(false);
                }
                this.board = result.board;
                this.mistakes = this.mistakes.recordMistake();
                if (this.mistakes.isLost) {
                    this.phase = GamePhase.Lost;
                    this.drag = null;
                }
                return this.accepted(true);
            case 'rejected':
                return this.rejected(result.reason);
        }
    }

    /**
     * The pivot moves onto `to` and the drag continues — confirmed by the user: dragging through a
     * given cell (Main Track) does not interrupt the gesture, exactly like crossing into any other
     * Track cell. The drag still ends separately on Win (afterConnection) or on the 3rd mistake
     * (handleBoundaryCrossed's wrongTarget branch).
     */
    private dragAfterCrossing(to: number): TrackDrag {
        return { pivot: to };
    }

    /**
     * Track option menu (confirmed by the user): sets EXACTLY this cell's own 2 connections, and
     * nothing else — scoped to the selected cell alone, unlike a drag crossing. It never touches
     * any neighbour: no reciprocal link, no redirect of an already-full neighbour, and no
     * wrongTarget/RedX/mistake either, even if a direction turns out not to be on the solution
     * path (confirmed by the user — Presentation already filters directions down to what's
     * geometrically valid via trackOptions.computeTrackOptionValidity, but deliberately never
     * reveals Solution Truth; a "wrong" pick here is simply not flagged by this action at all).
     * Existing links are cleared first so the result is always deterministic, regardless of
     * whatever the cell's links were before (e.g. a Track ? pointing a direction outside the
     * chosen pair) — see Board.withState's own link-clearing behaviour.
     */
    private handleApplyTrackShape(cell: number, directions: readonly [Direction, Direction]): CommandResult {
        if (!isIndexInBounds(this.truth.level.size, cell)) {
            return this.rejected('outOfBounds');
        }
        if (directions[0] === directions[1]) {
            return this.rejected('notAllowedOnState');
        }
        const state = this.board.stateAt(cell);
        const isTrackQuestion = this.board.linksAt(cell).length > 0;
        const isValidOrigin = state === PlayerCellState.TrackPreview || state === PlayerCellState.Track || isTrackQuestion;
        if (!isValidOrigin) {
            return this.rejected('notAllowedOnState');
        }
        const offBoard = directions.some((direction) => neighborIndex(this.truth.level.size, cell, direction) === null);
        if (offBoard) {
            return this.rejected('outOfBounds'); // Defensive: Presentation already filters this out.
        }
        this.board = this.board.withState(cell, PlayerCellState.TrackPreview).withTrack(cell, directions[0], directions[1]);
        return this.afterConnection();
    }

    /** Track option menu's "track preview" option: clears a cell's links, same as the existing
     * Track -> TrackPreview double-tap transition, generalised to also work from Track ? (1 link). */
    private handleResetTrackPreview(cell: number): CommandResult {
        if (!isIndexInBounds(this.truth.level.size, cell)) {
            return this.rejected('outOfBounds');
        }
        const state = this.board.stateAt(cell);
        if (state === PlayerCellState.RedX) {
            return this.rejected('redXLocked');
        }
        const isTrackQuestion = this.board.linksAt(cell).length > 0;
        if (!(state === PlayerCellState.TrackPreview || state === PlayerCellState.Track || isTrackQuestion)) {
            return this.rejected('notAllowedOnState');
        }
        if (state === PlayerCellState.TrackPreview && !isTrackQuestion) {
            return this.accepted(false); // Already a bare TrackPreview: nothing to clear.
        }
        this.board = this.board.withState(cell, PlayerCellState.TrackPreview);
        return this.accepted(true);
    }

    /**
     * Place Track (confirmed by the user, modelled on the existing Place Dog hint): only sets ONE
     * required cell findNextTrackCell picks to TrackPreview — the SAME transition a double-tap
     * makes on a solution cell (confirmed by the user: no longer auto-connects 2 directions: the
     * player still drags/uses the option menu to actually connect it themselves).
     */
    private handlePlaceTrack(): CommandResult {
        const cell = this.findNextTrackCell();
        if (cell === null) {
            return this.rejected('nothingToPlace');
        }
        this.board = this.board.withState(cell, PlayerCellState.TrackPreview);
        return this.accepted(true);
    }

    /**
     * Which required cell Place Track marks next (confirmed by the user, mirrors the existing
     * Place Dog selection — see PlaceDogSystem.findNextCell):
     *   1. PRIMARY: the cell whose row OR column (whichever is closer to done) has the FEWEST
     *      required cells still not yet identified (Empty/X) — i.e. finish the nearest-to-complete
     *      row/column first, same idea as Place Dog resolving its nearest-to-complete region.
     *   2. TIE-BREAK: reading order — smaller row first, then smaller column (top-left).
     */
    private findNextTrackCell(): number | null {
        const { width } = this.truth.level.size;
        const incomplete = this.requiredCells.filter((cell) => !this.isCellIdentified(cell));
        if (incomplete.length === 0) {
            return null;
        }
        const remainingByRow = new Map<number, number>();
        const remainingByColumn = new Map<number, number>();
        for (const cell of incomplete) {
            const row = Math.floor(cell / width);
            const column = cell % width;
            remainingByRow.set(row, (remainingByRow.get(row) ?? 0) + 1);
            remainingByColumn.set(column, (remainingByColumn.get(column) ?? 0) + 1);
        }
        let best: number | null = null;
        let bestRemaining = Infinity;
        for (const cell of incomplete) {
            const row = Math.floor(cell / width);
            const column = cell % width;
            const remaining = Math.min(remainingByRow.get(row)!, remainingByColumn.get(column)!);
            if (
                best === null ||
                remaining < bestRemaining ||
                (remaining === bestRemaining && isEarlierInReadingOrder(width, cell, best))
            ) {
                best = cell;
                bestRemaining = remaining;
            }
        }
        return best;
    }

    /** A required cell is "already identified" once the player has marked it as track in ANY
     * way (TrackPreview, Track ?, or a completed Track — right or wrong) — only a plain Empty or X
     * cell is still a candidate for Place Track to mark. */
    private isCellIdentified(cell: number): boolean {
        const state = this.board.stateAt(cell);
        return state === PlayerCellState.TrackPreview || state === PlayerCellState.Track;
    }

    private checkTargetCell(cell: number): RejectionReason | null {
        if (!isIndexInBounds(this.truth.level.size, cell)) {
            return 'outOfBounds';
        }
        if (this.board.mainTrack.portsAt(cell).length > 0) {
            return 'mainTrackCell';
        }
        return null;
    }

    private afterConnection(): CommandResult {
        if (isWon(this.board, this.requiredCells) && hasCompleteRailPath(this.board, this.truth)) {
            this.phase = GamePhase.Won;
            this.drag = null;
        }
        return this.accepted(true);
    }

    private restart(): void {
        this.cancelHint();
        this.board = this.board.restarted();
        this.mistakes = MistakeCounter.initial();
        this.phase = GamePhase.Active;
        this.drag = null;
    }

    /** Hồi sinh (xác nhận từ user): cho lại trọn mistake budget + đưa phase về Active, nhưng CỐ Ý
     * KHÔNG đụng tới this.board — khác 'restart' ở đúng điểm này, giữ nguyên toàn bộ track đã đặt
     * (đó là lý do tồn tại của revive, khác hẳn restart). */
    private revive(): void {
        this.mistakes = MistakeCounter.initial();
        this.phase = GamePhase.Active;
        this.drag = null;
    }

    private accepted(changed: boolean): CommandResult {
        return { accepted: true, changed, snapshot: this.snapshot() };
    }

    private rejected(reason: RejectionReason): CommandResult {
        return { accepted: false, reason, snapshot: this.snapshot() };
    }
}

/** Reading order: smaller row first, then smaller column within the same row (top-left first). */
function isEarlierInReadingOrder(width: number, a: number, b: number): boolean {
    const rowA = Math.floor(a / width);
    const rowB = Math.floor(b / width);
    if (rowA !== rowB) {
        return rowA < rowB;
    }
    return a % width < b % width;
}
