import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { neighborIndex } from '../../../assets/scripts/domain/board/cellIndex';
import { directionBetween } from '../../../assets/scripts/domain/board/adjacency';
import { Board } from '../../../assets/scripts/domain/board/board';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { connectionCount } from '../../../assets/scripts/domain/board/connections';
import { trackShapeOf } from '../../../assets/scripts/domain/board/trackShape';
import { isWon } from '../../../assets/scripts/domain/rules/winRule';
import { TEST_LEVEL, emptyBoard } from './fixtures';

describe('adjacency is cardinal only', () => {
    it('the four neighbours of the centre cell are exactly the cardinal cells', () => {
        const neighbours = [Direction.Up, Direction.Right, Direction.Down, Direction.Left]
            .map((direction) => neighborIndex(TEST_LEVEL.size, 4, direction));
        expect(neighbours).toEqual([1, 5, 7, 3]);
    });

    it('a diagonal step is not adjacent, and directionBetween reports no direction for it', () => {
        expect(directionBetween(TEST_LEVEL.size, 0, 4)).toBeNull();
        expect(directionBetween(TEST_LEVEL.size, 0, 1)).toBe(Direction.Right);
    });
});

describe('Board dimensions', () => {
    it('rejects zero, negative, and non-integer dimensions', () => {
        const truth = emptyBoard().mainTrack;
        expect(() => Board.empty({ width: 0, height: 3 }, truth)).toThrow(RangeError);
        expect(() => Board.empty({ width: 3, height: -1 }, truth)).toThrow(RangeError);
        expect(() => Board.empty({ width: 2.5, height: 3 }, truth)).toThrow(RangeError);
    });
});

describe('player state distinctions', () => {
    it('RedX is distinct from an ordinary X, and a locked RedX rejects X', () => {
        const wrong = emptyBoard().withState(4, PlayerCellState.RedX);
        expect(wrong.stateAt(4)).not.toBe(PlayerCellState.X);
        expect(() => wrong.withState(4, PlayerCellState.X)).toThrow();
    });

    it('TrackPreview is distinct from Track and does not connect', () => {
        const board = emptyBoard()
            .withTrack(1, Direction.Left, Direction.Right)
            .withState(2, PlayerCellState.TrackPreview);
        expect(board.stateAt(2)).not.toBe(PlayerCellState.Track);
        // Cell 1 keeps its two links to Main Track and cell 2; cell 2 offers no link back.
        expect(connectionCount(board, 1)).toBe(2);
        expect(connectionCount(board, 2)).toBe(0);
    });
});

describe('Track shape input validation', () => {
    it('rejects a value that is not a single direction bitmask', () => {
        expect(() => trackShapeOf(3 as Direction, Direction.Down)).toThrow(RangeError);
    });
});

describe('immutability of level and Main Track data', () => {
    it('the level solution path cannot be changed after creation', () => {
        expect(() => (TEST_LEVEL.solutionPath as number[]).push(7)).toThrow(TypeError);
    });

    it('Main Track ports cannot be changed after derivation', () => {
        const ports = emptyBoard().mainTrack.portsAt(0) as Direction[];
        expect(() => ports.push(Direction.Up)).toThrow(TypeError);
    });
});

describe('loops and degree', () => {
    const loopBoard = () =>
        emptyBoard()
            .withTrack(1, Direction.Right, Direction.Down)
            .withTrack(2, Direction.Left, Direction.Down)
            .withTrack(5, Direction.Up, Direction.Left)
            .withTrack(4, Direction.Right, Direction.Up);

    it('a loop of Tracks still counts as a win when the loop cells are the required cells', () => {
        expect(isWon(loopBoard(), [1, 2, 5, 4])).toBe(true);
    });

    it('no cell ever reports more than two connections', () => {
        const board = loopBoard();
        for (let cell = 0; cell < 9; cell++) {
            expect(connectionCount(board, cell)).toBeLessThanOrEqual(2);
        }
    });
});
