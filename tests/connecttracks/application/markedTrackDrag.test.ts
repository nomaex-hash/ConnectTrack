import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GestureStateMachine } from '../../../assets/scripts/presentation/input/gestureStateMachine';
import { gestureToCommand } from '../../../assets/scripts/presentation/input/gestureCommandMapper';
import { DEFAULT_GESTURE_INPUT_CONFIG } from '../../../assets/scripts/presentation/input/gestureInputConfig';
import { TEST_LEVEL } from '../domain/fixtures';

describe('track drag preserves player marks', () => {
    it.each([2, 4])('preserves marked cell %i without links or mistakes and retains the pivot', cell => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'tapCell', cell });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        const before = session.snapshot();
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: cell });
        expect(session.snapshot()).toEqual(before);
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 0 });
        expect(session.snapshot().dragPivot).toBe(0);
        expect(session.snapshot().cellStates[cell]).toBe('X');
    });

    it('continues the same pointer drag from a completed Track after encountering an X', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'beginTrackDrag', cell: 0 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 0, to: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
        session.dispatch({ type: 'endTrackDrag' });
        session.dispatch({ type: 'tapCell', cell: 4 });
        expect(session.snapshot().cellStates[1]).toBe('Track');
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, {
            getSnapshot: () => session.snapshot(),
            emitGesture: gesture => { session.dispatch(gestureToCommand(gesture)); },
            scheduleTapConfirm: () => {}, cancelTapConfirm: () => {},
        });
        machine.pointerDown({ x: 0, y: 0 }, 1, 0);
        machine.pointerMove({ x: 0, y: 50 }, 4, 20);
        expect(session.snapshot().cellStates[4]).toBe('X');
        expect(session.snapshot().mistakes).toBe(0);
        expect(session.snapshot().dragPivot).toBe(1);
        machine.pointerMove({ x: 0, y: 0 }, 1, 30);
        machine.pointerMove({ x: 50, y: 0 }, 2, 40);
        machine.pointerMove({ x: 50, y: 50 }, 5, 50);
        expect(session.snapshot().dragPivot).toBe(5);
        expect(session.snapshot().cellStates[2]).toBe('Track');
        expect(session.snapshot().cellStates[4]).toBe('X');
        machine.pointerUp(60);
        expect(session.snapshot().dragPivot).toBeNull();
    });
});
