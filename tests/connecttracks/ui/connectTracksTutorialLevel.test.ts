import { describe, expect, it } from 'vitest';
import {
    CONNECT_TRACKS_TUTORIAL_LEVEL,
    CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS,
} from '../../../assets/scripts/ui/tutorial/connectTracksTutorialLevel';
import { createSolutionTruth } from '../../../assets/scripts/domain/level/solutionTruth';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { Board } from '../../../assets/scripts/domain/board/board';
import { cellsInRow, cellsInColumn, clueSatisfaction } from '../../../assets/scripts/domain/rules/clueSatisfaction';

/**
 * This level's geometry was reverse-engineered by hand from the tutorial screenshots (row/column
 * clue numbers + scripted double-tap target cells). These tests are the regression guard against
 * that hand derivation being wrong — they re-derive the row/column clues from the level data itself
 * (the real production code path, via SolutionTruth + clueSatisfaction) and check them against the
 * exact numbers the screenshots show, rather than trusting the hand trace a second time.
 */
describe('CONNECT_TRACKS_TUTORIAL_LEVEL (confirmed by the user, derived from the tutorial screenshots)', () => {
    it('is a 4x4 board, entrance at 0 (outward Left) and exit at 15 (outward Right)', () => {
        expect(CONNECT_TRACKS_TUTORIAL_LEVEL.size).toEqual({ width: 4, height: 4 });
        expect(CONNECT_TRACKS_TUTORIAL_LEVEL.solutionPath[0]).toBe(0);
        const path = CONNECT_TRACKS_TUTORIAL_LEVEL.solutionPath;
        expect(path[path.length - 1]).toBe(15);
        expect(CONNECT_TRACKS_TUTORIAL_LEVEL.outwardStart).toBe(Direction.Left);
        expect(CONNECT_TRACKS_TUTORIAL_LEVEL.outwardEnd).toBe(Direction.Right);
    });

    it('has exactly 3 given cells: the 2 endpoints plus 1 mid-path cell (index 5)', () => {
        expect([...CONNECT_TRACKS_TUTORIAL_LEVEL.given].sort((a, b) => a - b)).toEqual([0, 5, 15]);
    });

    it('requiredCellsFor is exactly [1, 9, 10, 14] — the 3 scripted double-tap targets plus the one unaided cell', () => {
        expect([...CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS].sort((a, b) => a - b)).toEqual([1, 9, 10, 14]);
    });

    it('row clues (the "required" count — fixed by the level, independent of player progress) are 2, 1, 2, 2 top to bottom, matching the screenshot', () => {
        const truth = createSolutionTruth(CONNECT_TRACKS_TUTORIAL_LEVEL);
        const board = Board.empty(CONNECT_TRACKS_TUTORIAL_LEVEL.size, truth.mainTrack);
        const rowRequired = [0, 1, 2, 3].map(
            (row) => clueSatisfaction(board, cellsInRow(board, row), truth).required,
        );
        expect(rowRequired).toEqual([2, 1, 2, 2]);
    });

    it('column clues (the "required" count) are 1, 3, 2, 1 left to right, matching the screenshot', () => {
        const truth = createSolutionTruth(CONNECT_TRACKS_TUTORIAL_LEVEL);
        const board = Board.empty(CONNECT_TRACKS_TUTORIAL_LEVEL.size, truth.mainTrack);
        const columnRequired = [0, 1, 2, 3].map(
            (column) => clueSatisfaction(board, cellsInColumn(board, column), truth).required,
        );
        expect(columnRequired).toEqual([1, 3, 2, 1]);
    });

    it('once every required cell is correctly placed, every row/column clue is satisfied (sanity: the hand-derived path is actually solvable)', () => {
        const truth = createSolutionTruth(CONNECT_TRACKS_TUTORIAL_LEVEL);
        let board = Board.empty(CONNECT_TRACKS_TUTORIAL_LEVEL.size, truth.mainTrack);
        for (const cell of CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS) {
            const [a, b] = truth.correctDirectionsAt(cell)!;
            board = board.withTrack(cell, a, b);
        }
        const allSatisfied = [0, 1, 2, 3].every(
            (row) => clueSatisfaction(board, cellsInRow(board, row), truth).satisfied,
        ) && [0, 1, 2, 3].every(
            (column) => clueSatisfaction(board, cellsInColumn(board, column), truth).satisfied,
        );
        expect(allSatisfied).toBe(true);
    });
});
