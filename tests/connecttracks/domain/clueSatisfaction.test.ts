import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { cellsInColumn, cellsInRow, clueSatisfaction } from '../../../assets/scripts/domain/rules/clueSatisfaction';
import { emptyBoard, truthForTestLevel } from './fixtures';

const truth = truthForTestLevel();
describe('solution-based row and column clues', () => {
    it('lists rows and columns in board order', () => {
        expect(cellsInRow(emptyBoard(), 1)).toEqual([3, 4, 5]);
        expect(cellsInColumn(emptyBoard(), 1)).toEqual([1, 4, 7]);
    });
    it('counts given Tracks even though their player state is Empty', () => {
        expect(clueSatisfaction(emptyBoard(), [0, 1, 2], truth)).toEqual({ count: 1, required: 3, satisfied: false });
        expect(clueSatisfaction(emptyBoard(), [6, 7, 8], truth)).toEqual({ count: 1, required: 1, satisfied: true });
    });
    it('counts previews and Tracks without checking connection orientation', () => {
        const board = emptyBoard().withState(1, PlayerCellState.TrackPreview).withTrack(2, Direction.Left, Direction.Down);
        expect(clueSatisfaction(board, [0, 1, 2], truth)).toEqual({ count: 3, required: 3, satisfied: true });
        const wrongOrientation = emptyBoard().withTrack(1, Direction.Left, Direction.Down);
        expect(clueSatisfaction(wrongOrientation, [1, 4, 7], truth).satisfied).toBe(true);
    });
    it('counts a partially connected Track on a solution cell', () => {
        const board = emptyBoard().withLink(1, Direction.Left);
        expect(clueSatisfaction(board, [1, 4, 7], truth).count).toBe(1);
    });
    it('excludes off-solution occupancy, X, RedX and Empty', () => {
        const board = emptyBoard().withState(3, PlayerCellState.TrackPreview).withTrack(4, Direction.Left, Direction.Right);
        expect(clueSatisfaction(board, [3, 4, 5], truth)).toEqual({ count: 0, required: 1, satisfied: false });
        for (const state of [PlayerCellState.Empty, PlayerCellState.X, PlayerCellState.RedX]) {
            expect(clueSatisfaction(emptyBoard().withState(5, state), [3, 4, 5], truth).count).toBe(0);
        }
    });
    it('a zero-target line is satisfied and result is immutable', () => {
        const result = clueSatisfaction(emptyBoard(), [3, 4], truth);
        expect(result).toEqual({ count: 0, required: 0, satisfied: true });
        expect(Object.isFrozen(result)).toBe(true);
    });
    it('becomes unsatisfied again when occupancy is removed', () => {
        const board = emptyBoard().withState(5, PlayerCellState.TrackPreview);
        expect(clueSatisfaction(board, [3, 4, 5], truth).satisfied).toBe(true);
        expect(clueSatisfaction(board.withState(5, PlayerCellState.Empty), [3, 4, 5], truth).satisfied).toBe(false);
    });
});
