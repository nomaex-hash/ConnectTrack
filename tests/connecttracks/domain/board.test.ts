import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { connectionCount } from '../../../assets/scripts/domain/board/connections';
import { TEST_LEVEL, emptyBoard, truthForTestLevel } from './fixtures';

describe('Board: player state', () => {
    it('starts with every cell Empty', () => {
        const board = emptyBoard();
        for (let index = 0; index < 9; index++) {
            expect(board.stateAt(index)).toBe(PlayerCellState.Empty);
        }
    });

    it('exposes the five confirmed player states', () => {
        expect(Object.values(PlayerCellState)).toEqual(['Empty', 'X', 'TrackPreview', 'Track', 'RedX']);
    });

    it('is immutable: a change returns a new board and leaves the original untouched', () => {
        const original = emptyBoard();
        const changed = original.withState(4, PlayerCellState.X);
        expect(original.stateAt(4)).toBe(PlayerCellState.Empty);
        expect(changed.stateAt(4)).toBe(PlayerCellState.X);
    });

    it('rejects out-of-bounds cells', () => {
        expect(() => emptyBoard().stateAt(9)).toThrow(RangeError);
        expect(() => emptyBoard().withState(-1, PlayerCellState.X)).toThrow(RangeError);
    });

    it('TrackPreview is a distinct state, not a Track', () => {
        const board = emptyBoard().withState(1, PlayerCellState.TrackPreview);
        expect(board.stateAt(1)).toBe(PlayerCellState.TrackPreview);
        expect(board.stateAt(1)).not.toBe(PlayerCellState.Track);
        expect(connectionCount(board, 1)).toBe(0);
    });

    it('does not let withState create a Track without directions', () => {
        expect(() => emptyBoard().withState(1, PlayerCellState.Track)).toThrow(RangeError);
    });
});

describe('Board: Tracks and border', () => {
    it('places a Track with two connection directions', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right);
        expect(board.stateAt(1)).toBe(PlayerCellState.Track);
        expect([...board.linksAt(1)]).toEqual([Direction.Left, Direction.Right]);
    });

    it('rejects a connection that points outward past the border', () => {
        // Cell 0 is the top-left corner: Up and Left leave the board.
        expect(() => emptyBoard().withTrack(0, Direction.Up, Direction.Right)).toThrow(RangeError);
        expect(() => emptyBoard().withTrack(0, Direction.Left, Direction.Right)).toThrow(RangeError);
    });

    it('rejects two identical directions', () => {
        expect(() => emptyBoard().withTrack(4, Direction.Up, Direction.Up)).toThrow(RangeError);
    });

    it('rejects a Player Track on a fixed Main Track endpoint cell (0 and 8 on the test level)', () => {
        expect(() => emptyBoard().withTrack(0, Direction.Right, Direction.Down)).toThrow(RangeError);
        expect(() => emptyBoard().withTrack(8, Direction.Up, Direction.Left)).toThrow(RangeError);
    });

    it('a Main Track endpoint keeps its Empty player state; its identity is separate from player state', () => {
        const board = emptyBoard();
        expect(board.stateAt(0)).toBe(PlayerCellState.Empty);
        expect(board.mainTrack.portsAt(0).length).toBeGreaterThan(0);
        expect(board.linksAt(0)).toEqual([]);
    });

    it('allows a cell with one connection (Track ? state) without entering the Track state', () => {
        // Cell 1 has one link, Left toward the Main Track at cell 0. It is not a Track yet.
        const board = emptyBoard().withLink(1, Direction.Left);
        expect(connectionCount(board, 1)).toBe(1);
        expect(board.stateAt(1)).toBe(PlayerCellState.Empty);
    });
});

describe('Board: RedX lock and Restart', () => {
    it('keeps a RedX cell locked: no state change and no Track placement', () => {
        const wrong = emptyBoard().withState(4, PlayerCellState.RedX);
        expect(() => wrong.withState(4, PlayerCellState.Empty)).toThrow();
        expect(() => wrong.withState(4, PlayerCellState.X)).toThrow();
        expect(() => wrong.withTrack(4, Direction.Up, Direction.Down)).toThrow();
        expect(wrong.stateAt(4)).toBe(PlayerCellState.RedX);
    });

    it('restart clears player actions and RedX locks', () => {
        const board = emptyBoard()
            .withTrack(1, Direction.Left, Direction.Right)
            .withState(4, PlayerCellState.RedX);
        const restarted = board.restarted();
        for (let index = 0; index < 9; index++) {
            expect(restarted.stateAt(index)).toBe(PlayerCellState.Empty);
        }
        expect(() => restarted.withState(4, PlayerCellState.X)).not.toThrow();
    });

    it('restart keeps the Main Track', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right);
        const restarted = board.restarted();
        expect(restarted.mainTrack).toBe(board.mainTrack);
        expect([...restarted.mainTrack.portsAt(0)]).toEqual([Direction.Left, Direction.Right]);
    });
});

describe('Board: loops and degree', () => {
    it('allows a loop of Tracks (cells 1, 2, 5, 4 on the test level)', () => {
        const board = emptyBoard()
            .withTrack(1, Direction.Right, Direction.Down)
            .withTrack(2, Direction.Left, Direction.Down)
            .withTrack(5, Direction.Up, Direction.Left)
            .withTrack(4, Direction.Right, Direction.Up);
        for (const cell of [1, 2, 5, 4]) {
            expect(connectionCount(board, cell)).toBe(2);
        }
    });

    it('a directional connection counts immediately, without the neighbour pointing back', () => {
        // Cell 1 points Right at cell 2, which has no link yet. Cell 1 still has the connection.
        const board = emptyBoard().withLink(1, Direction.Right);
        expect(connectionCount(board, 1)).toBe(1);
        expect(connectionCount(board, 2)).toBe(0);
    });

    it('a Player Track counts a link toward the Main Track as a connection', () => {
        // Cell 1 links Left toward Main Track cell 0 and Down toward cell 4.
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Down);
        expect(connectionCount(board, 1)).toBe(2);
    });
});

describe('Board: withoutLink (redirect support)', () => {
    it('removes one link, keeping the other, and leaves state Track when a new one is added back', () => {
        // The "drop 1, add 1" sequence a redirect actually performs: drop Left, keep Right, add Down.
        const redirected = emptyBoard()
            .withTrack(1, Direction.Left, Direction.Right)
            .withoutLink(1, Direction.Left)
            .withLink(1, Direction.Down);
        expect([...redirected.linksAt(1)]).toEqual([Direction.Right, Direction.Down]);
        expect(redirected.stateAt(1)).toBe(PlayerCellState.Track);
    });

    it('demotes the cell off Track to TrackPreview when its degree drops below 2', () => {
        const board = emptyBoard().withTrack(1, Direction.Left, Direction.Right).withoutLink(1, Direction.Right);
        expect([...board.linksAt(1)]).toEqual([Direction.Left]);
        expect(board.stateAt(1)).toBe(PlayerCellState.TrackPreview);
    });

    it('throws for a link the cell does not have', () => {
        expect(() => emptyBoard().withLink(1, Direction.Left).withoutLink(1, Direction.Right)).toThrow(RangeError);
    });

    it('is immutable: the original board keeps its link', () => {
        const original = emptyBoard().withTrack(1, Direction.Left, Direction.Right);
        const changed = original.withoutLink(1, Direction.Left);
        expect([...original.linksAt(1)]).toEqual([Direction.Left, Direction.Right]);
        expect([...changed.linksAt(1)]).toEqual([Direction.Right]);
    });
});

describe('Solution membership', () => {
    it('comes from immutable level data, not from player state', () => {
        const truth = truthForTestLevel();
        expect(truth.isSolutionCell(1)).toBe(true);
        expect(truth.isSolutionCell(3)).toBe(false);

        // Every player state on a solution cell leaves membership unchanged.
        const board = emptyBoard()
            .withState(1, PlayerCellState.X)
            .withState(2, PlayerCellState.TrackPreview)
            .withState(5, PlayerCellState.RedX);
        expect(board.stateAt(1)).toBe(PlayerCellState.X);
        expect(truth.isSolutionCell(1)).toBe(true);
        expect(truth.isSolutionCell(2)).toBe(true);
        expect(truth.isSolutionCell(5)).toBe(true);
        expect(truth.level).toBe(TEST_LEVEL);
    });
});
