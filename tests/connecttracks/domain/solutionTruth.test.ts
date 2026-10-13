import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { createSolutionTruth } from '../../../assets/scripts/domain/level/solutionTruth';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from './fixtures';

/*
 * TEST_LEVEL (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0, 8 (the 2 endpoints only).
 * TEST_LEVEL_WITH_MIDDLE_GIVEN: same path, but 2 is ALSO given (pre-filled).
 */

describe('SolutionTruth.correctDirectionsAt', () => {
    it('matches MainTrack.portsAt for the 2 given endpoints', () => {
        const truth = createSolutionTruth(TEST_LEVEL);
        expect(truth.correctDirectionsAt(0)).toEqual([Direction.Left, Direction.Right]);
        expect(truth.correctDirectionsAt(8)).toEqual([Direction.Down, Direction.Up]);
    });

    it('computes the correct pair for an ORDINARY (non-given, required) middle cell too — unlike MainTrack.portsAt, which is empty for it', () => {
        const truth = createSolutionTruth(TEST_LEVEL);
        expect(truth.correctDirectionsAt(1)).toEqual([Direction.Left, Direction.Right]); // toward 0, toward 2
        expect(truth.correctDirectionsAt(2)).toEqual([Direction.Left, Direction.Down]); // toward 1, toward 5
        expect(truth.correctDirectionsAt(5)).toEqual([Direction.Up, Direction.Down]); // toward 2, toward 8
        expect(truth.mainTrack.portsAt(1)).toEqual([]); // confirms it's NOT a given cell
    });

    it('is null for a cell that is not on the solution path at all', () => {
        const truth = createSolutionTruth(TEST_LEVEL);
        expect(truth.correctDirectionsAt(3)).toBeNull();
        expect(truth.correctDirectionsAt(4)).toBeNull();
        expect(truth.correctDirectionsAt(6)).toBeNull();
        expect(truth.correctDirectionsAt(7)).toBeNull();
    });

    it('also works for an EXTRA given middle cell (reused straight from MainTrack.portsAt)', () => {
        const truth = createSolutionTruth(TEST_LEVEL_WITH_MIDDLE_GIVEN);
        expect(truth.correctDirectionsAt(2)).toEqual([Direction.Left, Direction.Down]);
        expect(truth.mainTrack.portsAt(2)).toEqual([Direction.Left, Direction.Down]);
    });
});
