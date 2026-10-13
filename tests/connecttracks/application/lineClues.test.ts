import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

describe('GameSession line clues', () => {
    it('publishes targets for every row and column, including all givens', () => {
        const session = new GameSession({ level: TEST_LEVEL_WITH_MIDDLE_GIVEN, requiredCells: [1, 5] });
        const snapshot = session.snapshot();
        expect(snapshot.rowClues.map(c => c.required)).toEqual([3, 1, 1]);
        expect(snapshot.columnClues.map(c => c.required)).toEqual([1, 1, 3]);
        expect(snapshot.rowClues.map(c => c.count)).toEqual([2, 0, 1]);
        expect(Object.isFrozen(snapshot.rowClues)).toBe(true);
        expect(Object.isFrozen(snapshot.columnClues)).toBe(true);
    });
    it('updates on commands and restart without treating green clues as a win', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        const initial = session.snapshot();
        for (const cell of [1, 2, 5]) session.dispatch({ type: 'doubleTapCell', cell });
        const preview = session.snapshot();
        expect(preview.rowClues.every(c => c.satisfied)).toBe(true);
        expect(preview.columnClues.every(c => c.satisfied)).toBe(true);
        expect(preview.phase).toBe(GamePhase.Active);
        expect(initial.rowClues[0].count).toBe(1);
        session.dispatch({ type: 'tapCell', cell: 1 });
        // Existing tap-on-preview remains a no-op; clue support does not change input rules.
        expect(session.snapshot().rowClues[0].satisfied).toBe(true);
        const restarted = session.dispatch({ type: 'restart' }).snapshot;
        expect(restarted.rowClues).toEqual(initial.rowClues);
        expect(restarted.columnClues).toEqual(initial.columnClues);
    });
});
