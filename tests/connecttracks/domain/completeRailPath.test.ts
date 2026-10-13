import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { hasCompleteRailPath, isWon } from '../../../assets/scripts/domain/rules/winRule';
import { emptyBoard, truthForTestLevel } from './fixtures';

describe('train-ready rail path', () => {
    it('requires all rails to connect reciprocally from entrance to exit', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right)
            .withTrack(2, Direction.Left, Direction.Down).withTrack(5, Direction.Up, Direction.Down);
        expect(hasCompleteRailPath(board, truthForTestLevel())).toBe(true);
    });
    it('does not accept two ports pointing at the wrong neighbours', () => {
        const board = emptyBoard().withTrack(1, Direction.Down, Direction.Right)
            .withTrack(2, Direction.Left, Direction.Down).withTrack(5, Direction.Up, Direction.Down);
        expect(hasCompleteRailPath(board, truthForTestLevel())).toBe(false);
    });
    it('cannot finish via a subset of the required route', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right)
            .withTrack(2, Direction.Left, Direction.Down);
        expect(isWon(board, [1])).toBe(true);
        expect(hasCompleteRailPath(board, truthForTestLevel())).toBe(false);
    });
});
