import { _decorator, Component, EventTouch, Node, UITransform, Vec3 } from 'cc';
import { GameSession } from '../../application/session/gameSession';
import { ConnectTracksBoardView } from '../board/connectTracksBoardView';
import { cellAtGridPoint, gestureToCommand, PlayerGesture } from './gestureCommandMapper';
import { DEFAULT_GESTURE_INPUT_CONFIG, GestureInputConfig } from './gestureInputConfig';
import { GestureStateMachine } from './gestureStateMachine';

const { ccclass } = _decorator;

/**
 * Captures pointer input on one board node and feeds it through GestureStateMachine into
 * GameSession, using the existing neutral command mapping. Owns no gameplay rule: every outcome
 * (accepted, rejected, mistake, win) is decided by GameSession; this only turns pointer samples
 * into tap/double-tap/drag gestures and reports them.
 *
 * Cocos synthesizes Node.EventType.TOUCH_* from both touch and mouse input, so this listens to
 * each event type exactly once; it never adds a separate mouse listener, so there is no duplicate
 * dispatch for the same physical input.
 */
@ccclass('CocosPointerInput')
export class CocosPointerInput extends Component {
    private session: GameSession | null = null;
    private board: ConnectTracksBoardView | null = null;
    private transform: UITransform | null = null;
    private machine: GestureStateMachine | null = null;
    private onRedraw: (() => void) | null = null;
    private timerScheduled = false;
    private bindingVersion = 0;
    private pendingOptionsClose: (() => void) | null = null;
    private readonly finishOptionsClose = (): void => {
        const close = this.pendingOptionsClose;
        this.pendingOptionsClose = null;
        close?.();
    };

    private cancelOptionsClose(): void {
        this.unschedule(this.finishOptionsClose);
        this.pendingOptionsClose = null;
    }

    private readonly boundTimerFired = (): void => {
        this.timerScheduled = false;
        this.machine?.timerExpired();
    };

    onLoad(): void {
        this.transform = this.getComponent(UITransform);
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.unbind();
    }

    /**
     * Wires this input to a session. `onRedraw` is called after every dispatched command so the
     * caller can re-render; this component never renders directly.
     *
     * `board` supplies the CURRENT cell size (ConnectTracksBoardView.getCellSize()) on every touch
     * instead of a fixed Editor value — cellSize is recomputed per level from the board's own fixed
     * footprint, so a value baked once in the Editor could only ever be right for one board size.
     */
    bind(
        session: GameSession,
        onRedraw: () => void,
        board: ConnectTracksBoardView,
        config: GestureInputConfig = DEFAULT_GESTURE_INPUT_CONFIG,
        options?: {
            /**
             * Tutorial-only hook (confirmed by the user): called with every decided gesture BEFORE
             * it reaches GameSession. Returning false swallows it entirely — nothing is dispatched,
             * nothing re-renders, the gesture state machine's own bookkeeping (e.g. a drag pivot)
             * is untouched. Real gameplay never passes this, so omitting it keeps today's behaviour
             * byte-for-byte unchanged. Used to restrict interaction to specific cells (every
             * PlayerGesture variant already carries the cell(s) it touched) without needing a
             * screen-space touch-swallowing overlay.
             */
            canDispatch?: (gesture: PlayerGesture) => boolean;
            /**
             * Tutorial-only (confirmed by the user: tutorial has no option menu at all, so the
             * board's own blue/green "selected cell" outline — normally raised by a tap/double-tap
             * on a TrackPreview/Track/Track ? cell to open that menu — must never activate either).
             * When true, skips every board.handleCellTapped/handlePreviewPlaced/closeOptionsMenu
             * call below; `onRedraw` still fires so rendering stays in sync. Real gameplay never
             * passes this, so omitting it keeps today's behaviour byte-for-byte unchanged.
             */
            disableOptionsMenu?: boolean;
        },
    ): void {
        this.unbind();
        this.session = session;
        this.board = board;
        this.onRedraw = onRedraw;
        const version = this.bindingVersion;
        this.machine = new GestureStateMachine(config, {
            emitGesture: (gesture) => {
                if (version !== this.bindingVersion) return;
                if (options?.canDispatch && !options.canDispatch(gesture)) return;
                const result = session.dispatch(gestureToCommand(gesture));
                if (version !== this.bindingVersion) return;
                // Track option menu (confirmed by the user): a tap on a TrackPreview/Track/Track ?
                // cell opens it (board owns the blue outline + selection state). Placing a preview
                // by double tap also opens its options. Other gestures
                // that actually DID something (accepted — a mark/unmark, a drag starting...) closes
                // whatever was open; a REJECTED one (e.g. tapping a locked RedX cell, which cannot
                // be interacted with at all) changes nothing, so the menu is left exactly as it was.
                if (options?.disableOptionsMenu) {
                    // Tutorial: không có option menu, nên cũng không có viền chọn ô (xác nhận từ
                    // user) — bỏ qua toàn bộ logic mở/đóng/chọn ô bên dưới.
                } else if (gesture.kind === 'tap') {
                    const snapshot = session.snapshot();
                    const state = snapshot.cellStates[gesture.cell];
                    if (result.accepted && board?.hasOptionsSelection?.()
                        && state !== 'TrackPreview' && state !== 'Track') {
                        this.cancelOptionsClose();
                        this.pendingOptionsClose = () => {
                            if (version !== this.bindingVersion) return;
                            board.handleCellTapped(gesture.cell, session.snapshot(), true);
                            onRedraw();
                        };
                        // Keep the panel stable through a valid second press and its release.
                        // Only UI dismissal waits; the tap's gameplay command already ran above.
                        this.scheduleOnce(this.finishOptionsClose,
                            (config.doubleTapWindowMs + config.maxTapDurationMs) / 1000);
                    } else {
                        if (result.accepted || state === 'TrackPreview' || state === 'Track') this.cancelOptionsClose();
                        board?.handleCellTapped?.(gesture.cell, snapshot, result.accepted);
                    }
                } else if (gesture.kind === 'doubleTap') {
                    this.cancelOptionsClose();
                    board?.handlePreviewPlaced?.(gesture.cell, session.snapshot(), result.accepted);
                } else if (result.accepted) {
                    this.cancelOptionsClose();
                    board?.closeOptionsMenu?.();
                }
                onRedraw();
            },
            scheduleTapConfirm: (ms) => {
                if (version !== this.bindingVersion) return;
                this.cancelTapConfirm();
                this.timerScheduled = true;
                this.scheduleOnce(this.boundTimerFired, ms / 1000);
            },
            cancelTapConfirm: () => { if (version === this.bindingVersion) this.cancelTapConfirm(); },
            // Redraw may synchronously unbind on victory while a boundary step is still on stack.
            // That old machine may finish reading its own session, never a new binding.
            getSnapshot: () => session.snapshot(),
        });
    }

    /** Drops the current session/machine and cancels any pending timer. Safe to call repeatedly. */
    unbind(): void {
        this.cancelOptionsClose();
        const session = this.session;
        this.bindingVersion++;
        this.machine?.pointerCancel();
        if (session && session.snapshot().dragPivot !== null) session.dispatch({ type: 'endTrackDrag' });
        this.cancelTapConfirm();
        this.session = null;
        this.board = null;
        this.onRedraw = null;
        this.machine = null;
    }

    private cancelTapConfirm(): void {
        if (this.timerScheduled) {
            this.unschedule(this.boundTimerFired);
            this.timerScheduled = false;
        }
    }

    private cellAt(event: EventTouch): number | null {
        const transform = this.transform;
        const session = this.session;
        const cellSize = this.board?.getCellSize() ?? 0;
        if (!transform || !session || cellSize <= 0) {
            return null;
        }
        const location = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
        const snapshot = session.snapshot();
        const gridX = local.x + (snapshot.width * cellSize) / 2;
        const gridY = (snapshot.height * cellSize) / 2 - local.y;
        return cellAtGridPoint({ width: snapshot.width, height: snapshot.height }, cellSize, gridX, gridY);
    }

    private pointOf(event: EventTouch): { x: number; y: number } {
        const location = event.getUILocation();
        return { x: location.x, y: location.y };
    }

    private onTouchStart(event: EventTouch): void {
        const cell = this.cellAt(event);
        if (cell === null || !this.machine) {
            return;
        }
        this.machine.pointerDown(this.pointOf(event), cell, Date.now());
    }

    private onTouchMove(event: EventTouch): void {
        if (!this.machine) {
            return;
        }
        const cell = this.cellAt(event);
        if (cell === null) {
            return; // Pointer left the board; the last known cell stays in effect until it returns.
        }
        this.machine.pointerMove(this.pointOf(event), cell, Date.now());
    }

    private onTouchEnd(): void {
        this.machine?.pointerUp(Date.now());
    }

    private onTouchCancel(): void {
        this.machine?.pointerCancel();
    }
}
