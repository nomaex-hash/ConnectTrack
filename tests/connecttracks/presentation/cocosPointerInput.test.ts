import { describe, expect, it, vi } from 'vitest';
vi.mock('cc', () => ({
    _decorator: { ccclass: () => (target: unknown) => target },
    Component: class { scheduleOnce = vi.fn(); unschedule = vi.fn(); },
    Node: class {}, UITransform: class {}, Vec3: class {},
}));
vi.mock('../../../assets/scripts/presentation/board/connectTracksBoardView', () => ({ ConnectTracksBoardView: class {} }));
import { CocosPointerInput } from '../../../assets/scripts/presentation/input/cocosPointerInput';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { TEST_LEVEL } from '../domain/fixtures';

describe('input binding lifetime', () => {
    it('keeps existing options open across first tap and double tap on a new preview', () => {
        const input = new CocosPointerInput();
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        const board = { hasOptionsSelection: () => true, handleCellTapped: vi.fn(),
            handlePreviewPlaced: vi.fn(), closeOptionsMenu: vi.fn() };
        input.bind(session, vi.fn(), board as any);
        const machine = (input as any).machine;
        machine.pointerDown({ x: 0, y: 0 }, 2, 0); machine.pointerUp(10);
        expect(session.snapshot().cellStates[2]).toBe('X');
        expect(board.handleCellTapped).not.toHaveBeenCalled();
        machine.pointerDown({ x: 0, y: 0 }, 2, 50); machine.pointerUp(60);
        expect(board.handlePreviewPlaced).toHaveBeenCalledWith(2, session.snapshot(), true);
        (input as any).finishOptionsClose();
        expect(board.handleCellTapped).not.toHaveBeenCalled();
        expect(board.closeOptionsMenu).not.toHaveBeenCalled();
    });

    it('closes options for a lone marking tap after grace, and cancels pending dismissal on unbind', () => {
        const input = new CocosPointerInput();
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        const board = { hasOptionsSelection: () => true, handleCellTapped: vi.fn() };
        input.bind(session, vi.fn(), board as any);
        const machine = (input as any).machine;
        machine.pointerDown({ x: 0, y: 0 }, 3, 0); machine.pointerUp(10);
        (input as any).finishOptionsClose();
        expect(board.handleCellTapped).toHaveBeenCalledTimes(1);
        machine.timerExpired();
        machine.pointerDown({ x: 0, y: 0 }, 4, 600); machine.pointerUp(610);
        input.unbind(); (input as any).finishOptionsClose();
        expect(board.handleCellTapped).toHaveBeenCalledTimes(1);
    });
    it('routes successful double tap placement to preview options with the updated snapshot', () => {
        const input = new CocosPointerInput();
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        const board = { handleCellTapped: vi.fn(), handlePreviewPlaced: vi.fn(), closeOptionsMenu: vi.fn() };
        input.bind(session, vi.fn(), board as any);
        const machine = (input as any).machine;
        machine.pointerDown({ x: 0, y: 0 }, 1, 0);
        machine.pointerUp(10);
        machine.pointerDown({ x: 0, y: 0 }, 1, 50);
        machine.pointerUp(60);
        expect(session.snapshot().cellStates[1]).toBe('TrackPreview');
        expect(board.handlePreviewPlaced).toHaveBeenCalledWith(1, session.snapshot(), true);
        expect(board.closeOptionsMenu).not.toHaveBeenCalled();
    });
    it.each([false, true])('survives synchronous unbind/rebind during a drag step (rebind=%s)', rebind => {
        const input = new CocosPointerInput();
        const initial = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] }).snapshot();
        const snapshot = { ...initial, dragPivot: 1, cellStates: [...initial.cellStates] };
        snapshot.cellStates[1] = 'TrackPreview' as any;
        const session = { snapshot: () => snapshot, dispatch: vi.fn((command: any) => {
            if (command.type === 'endTrackDrag') snapshot.dragPivot = null as any;
            return { accepted: true, changed: false, snapshot };
        }) };
        const nextSession = { snapshot: () => initial, dispatch: vi.fn() };
        const redraw = vi.fn(() => {
            if (session.dispatch.mock.calls.length === 2) {
                input.unbind();
                if (rebind) input.bind(nextSession as any, vi.fn(), {} as any);
            }
        });
        input.bind(session as any, redraw, {} as any);
        const oldMachine = (input as any).machine;
        oldMachine.pointerDown({ x: 0, y: 0 }, 1, 0);
        expect(() => oldMachine.pointerMove({ x: 100, y: 0 }, 2, 100)).not.toThrow();
        oldMachine.pointerUp(110);
        expect(nextSession.dispatch).not.toHaveBeenCalled();
        expect(redraw).toHaveBeenCalledTimes(2);
    });

    it('does not schedule a tap timer after redraw unbinds the input', () => {
        const input = new CocosPointerInput();
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        input.bind(session, () => input.unbind(), {} as any);
        const machine = (input as any).machine;
        machine.pointerDown({ x: 0, y: 0 }, 3, 0);
        machine.pointerUp(10);
        expect(input.scheduleOnce).not.toHaveBeenCalled();
    });

    describe('canDispatch hook (tutorial-only, confirmed by the user)', () => {
        it('swallows a gesture entirely when canDispatch returns false: no dispatch, no redraw', () => {
            const input = new CocosPointerInput();
            const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
            const redraw = vi.fn();
            const canDispatch = vi.fn().mockReturnValue(false);
            input.bind(session, redraw, {} as any, undefined, { canDispatch });
            const machine = (input as any).machine;
            machine.pointerDown({ x: 0, y: 0 }, 3, 0);
            machine.pointerUp(10);
            expect(canDispatch).toHaveBeenCalledWith({ kind: 'tap', cell: 3 });
            expect(session.snapshot().cellStates[3]).toBe('Empty'); // Never dispatched — still untouched.
            expect(redraw).not.toHaveBeenCalled();
        });

        it('dispatches normally when canDispatch returns true, or is omitted (real gameplay, unchanged)', () => {
            const input = new CocosPointerInput();
            const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
            const redraw = vi.fn();
            input.bind(session, redraw, {} as any, undefined, { canDispatch: () => true });
            const machine = (input as any).machine;
            machine.pointerDown({ x: 0, y: 0 }, 3, 0);
            machine.pointerUp(10);
            expect(session.snapshot().cellStates[3]).toBe('X');
            expect(redraw).toHaveBeenCalledTimes(1);
        });
    });
});
