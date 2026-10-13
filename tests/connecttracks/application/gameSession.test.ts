import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { TEST_LEVEL } from '../domain/fixtures';

const REQUIRED = [1, 2, 5];

function newSession(): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED });
}

describe('session start', () => {
    it('starts Active with every player cell Empty', () => {
        const snapshot = newSession().snapshot();
        expect(snapshot.phase).toBe(GamePhase.Active);
        expect(snapshot.cellStates.every((state) => state === PlayerCellState.Empty)).toBe(true);
    });

    it('exposes the fixed Main Track endpoint cells, from the level path', () => {
        expect(newSession().snapshot().mainTrackCells).toEqual([0, 8]);
    });

    it('starts with zero mistakes and a maximum of three', () => {
        const snapshot = newSession().snapshot();
        expect(snapshot.mistakes).toBe(0);
        expect(snapshot.maxMistakes).toBe(3);
    });
});

describe('single tap and double tap', () => {
    it('single tap on Empty places X', () => {
        const result = newSession().dispatch({ type: 'tapCell', cell: 1 });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.X);
    });

    it('single tap on X removes it', () => {
        const session = newSession();
        session.dispatch({ type: 'tapCell', cell: 1 });
        const result = session.dispatch({ type: 'tapCell', cell: 1 });
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.Empty);
    });

    it('double tap on Empty places TrackPreview', () => {
        const result = newSession().dispatch({ type: 'doubleTapCell', cell: 1 });
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
    });

    it('double tap on X places TrackPreview', () => {
        const session = newSession();
        session.dispatch({ type: 'tapCell', cell: 1 });
        const result = session.dispatch({ type: 'doubleTapCell', cell: 1 });
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
    });
});

describe('invalid commands do not change state', () => {
    it('a tap on a TrackPreview is a no-op and leaves the board unchanged', () => {
        const session = newSession();
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        const before = session.snapshot();
        const result = session.dispatch({ type: 'tapCell', cell: 1 });
        expect(result.accepted).toBe(true);
        expect(result.accepted && result.changed).toBe(false);
        expect(result.snapshot.cellStates).toEqual(before.cellStates);
    });

    it('a cell outside the board is rejected', () => {
        const result = newSession().dispatch({ type: 'tapCell', cell: 9 });
        expect(result.accepted === false && result.reason).toBe('outOfBounds');
    });

    it('a tap on a Main Track endpoint is rejected', () => {
        const result = newSession().dispatch({ type: 'tapCell', cell: 0 });
        expect(result.accepted === false && result.reason).toBe('mainTrackCell');
        expect(result.snapshot.cellStates[0]).toBe(PlayerCellState.Empty);
    });
});

describe('batch X from a drag on Empty', () => {
    it('marks every listed Empty cell', () => {
        const result = newSession().dispatch({ type: 'markCellsAsX', cells: [3, 4, 6] });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.X);
        expect(result.snapshot.cellStates[4]).toBe(PlayerCellState.X);
        expect(result.snapshot.cellStates[6]).toBe(PlayerCellState.X);
    });

    it('rejects the whole batch if any cell is not Empty, with no partial change', () => {
        const session = newSession();
        session.dispatch({ type: 'tapCell', cell: 4 });
        const result = session.dispatch({ type: 'markCellsAsX', cells: [3, 4] });
        expect(result.accepted === false && result.reason).toBe('batchContainsIneligibleCell');
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.Empty);
    });

    it('rejects a batch that includes a Main Track endpoint', () => {
        const result = newSession().dispatch({ type: 'markCellsAsX', cells: [3, 0] });
        expect(result.accepted === false && result.reason).toBe('batchContainsIneligibleCell');
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.Empty);
    });

    it('rejects an empty batch', () => {
        const result = newSession().dispatch({ type: 'markCellsAsX', cells: [] });
        expect(result.accepted === false && result.reason).toBe('emptyBatch');
    });
});

describe('restart', () => {
    it('clears X and TrackPreview and keeps the Main Track endpoints', () => {
        const session = newSession();
        session.dispatch({ type: 'tapCell', cell: 3 });
        session.dispatch({ type: 'doubleTapCell', cell: 4 });
        const result = session.dispatch({ type: 'restart' });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.cellStates.every((state) => state === PlayerCellState.Empty)).toBe(true);
        expect(result.snapshot.mainTrackCells).toEqual([0, 8]);
        expect(result.snapshot.phase).toBe(GamePhase.Active);
    });
});

describe('required cells are supplied explicitly', () => {
    it('rejects an empty requiredCells set, since it would be trivially won', () => {
        expect(() => new GameSession({ level: TEST_LEVEL, requiredCells: [] })).toThrow(RangeError);
    });

    it('rejects a required cell outside the board', () => {
        expect(() => new GameSession({ level: TEST_LEVEL, requiredCells: [9] })).toThrow(RangeError);
    });

    it('keeps its own copy, so later changes to the caller array have no effect', () => {
        const required = [1];
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: required });
        required.push(2);
        expect(session.snapshot().phase).toBe(GamePhase.Active);
    });
});

describe('snapshot is read-only', () => {
    it('cannot be mutated by the consumer', () => {
        const snapshot = newSession().snapshot();
        expect(() => (snapshot.cellStates as PlayerCellState[]).push(PlayerCellState.X)).toThrow(TypeError);
    });

    it('does not change when a later command is applied', () => {
        const session = newSession();
        const before = session.snapshot();
        session.dispatch({ type: 'tapCell', cell: 3 });
        expect(before.cellStates[3]).toBe(PlayerCellState.Empty);
    });
});

describe('sessions are independent', () => {
    it('a command in one session does not affect another session', () => {
        const first = newSession();
        const second = newSession();
        first.dispatch({ type: 'tapCell', cell: 3 });
        expect(second.snapshot().cellStates[3]).toBe(PlayerCellState.Empty);
    });
});
