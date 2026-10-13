import { describe, expect, it } from 'vitest';
import {
    GestureStateMachine,
    GestureStateMachineHost,
    classifyDragOrigin,
} from '../../../assets/scripts/presentation/input/gestureStateMachine';
import { DEFAULT_GESTURE_INPUT_CONFIG } from '../../../assets/scripts/presentation/input/gestureInputConfig';
import { PlayerGesture } from '../../../assets/scripts/presentation/input/gestureCommandMapper';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GameSnapshot } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { TEST_LEVEL } from '../domain/fixtures';

function newSnapshot(): GameSnapshot {
    return new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] }).snapshot();
}

function newHost(snapshot: GameSnapshot): { host: GestureStateMachineHost; gestures: PlayerGesture[] } {
    const gestures: PlayerGesture[] = [];
    const host: GestureStateMachineHost = {
        emitGesture: (gesture) => gestures.push(gesture),
        scheduleTapConfirm: () => {},
        cancelTapConfirm: () => {},
        getSnapshot: () => snapshot,
    };
    return { host, gestures };
}

const ORIGIN = { x: 0, y: 0 };
const WINDOW = DEFAULT_GESTURE_INPUT_CONFIG.doubleTapWindowMs;

describe('tap fires immediately (confirmed by the user: marking must have no delay)', () => {
    it('emits tap right on release, before any double-tap window would even be checked', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerUp(1010);
        expect(gestures).toEqual([{ kind: 'tap', cell: 3 }]);
    });

    it('emits nothing more when the post-tap window simply expires with no second press', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerUp(1010);
        machine.timerExpired();
        expect(gestures).toEqual([{ kind: 'tap', cell: 3 }]);
    });
});

describe('a quick second tap upgrades to a double tap', () => {
    it('emits tap then doubleTap for 2 fast presses on the same cell — never two taps', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerUp(1010);
        machine.pointerDown(ORIGIN, 3, 1010 + WINDOW / 2);
        machine.pointerUp(1020 + WINDOW / 2);
        expect(gestures).toEqual([
            { kind: 'tap', cell: 3 },
            { kind: 'doubleTap', cell: 3 },
        ]);
    });

    it('does not upgrade a second tap landing on a DIFFERENT cell: both fire as plain taps', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerUp(1010);
        machine.pointerDown(ORIGIN, 4, 1010 + WINDOW / 2);
        machine.pointerUp(1020 + WINDOW / 2);
        expect(gestures).toEqual([
            { kind: 'tap', cell: 3 },
            { kind: 'tap', cell: 4 },
        ]);
    });

    it('does not upgrade once the window has already elapsed', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerUp(1010);
        machine.pointerDown(ORIGIN, 3, 1010 + WINDOW + 1);
        machine.pointerUp(1020 + WINDOW + 1);
        expect(gestures).toEqual([
            { kind: 'tap', cell: 3 },
            { kind: 'tap', cell: 3 },
        ]);
    });
});

describe('Empty/X drag acts cell-by-cell as it is crossed (confirmed by the user: no waiting for release)', () => {
    const FAR = { x: 50, y: 0 }; // Past dragDistanceUi (12), to leave tap tolerance and start a drag.

    it('emits one emptyDragBatch per cell, immediately as each is crossed — including the origin', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        // TEST_LEVEL (3x3): cell 3 is Empty/non-solution (a valid "empty" drag origin). 4 and 7 are
        // its cardinal neighbours in turn (3->4 horizontal, 4->7 vertical).
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerMove(FAR, 4, 1010);
        expect(gestures).toEqual([
            { kind: 'emptyDragBatch', cells: [3] },
            { kind: 'emptyDragBatch', cells: [4] },
        ]);
        machine.pointerMove(FAR, 7, 1020);
        expect(gestures).toEqual([
            { kind: 'emptyDragBatch', cells: [3] },
            { kind: 'emptyDragBatch', cells: [4] },
            { kind: 'emptyDragBatch', cells: [7] },
        ]);
        // Releasing does not re-emit anything — every cell was already applied as it was crossed.
        machine.pointerUp(1030);
        expect(gestures).toHaveLength(3);
    });

    it('does not re-emit a cell already visited earlier in the same drag', () => {
        const { host, gestures } = newHost(newSnapshot());
        const machine = new GestureStateMachine(DEFAULT_GESTURE_INPUT_CONFIG, host);
        machine.pointerDown(ORIGIN, 3, 1000);
        machine.pointerMove(FAR, 4, 1010);
        machine.pointerMove(FAR, 3, 1020); // Back to the already-visited origin.
        expect(gestures).toEqual([
            { kind: 'emptyDragBatch', cells: [3] },
            { kind: 'emptyDragBatch', cells: [4] },
        ]);
    });
});

describe('classifyDragOrigin: given cells are Track origins (confirmed by the user)', () => {
    it('classifies a given cell as "track", not "empty" — even though its PlayerCellState is Empty', () => {
        const snapshot = newSnapshot();
        // TEST_LEVEL's given cells are its two Main Track endpoints, 0 and 8.
        expect(classifyDragOrigin(snapshot, 0)).toBe('track');
        expect(classifyDragOrigin(snapshot, 8)).toBe('track');
    });

    it('still classifies an ordinary Empty cell (not given) as "empty"', () => {
        expect(classifyDragOrigin(newSnapshot(), 4)).toBe('empty');
    });
});
