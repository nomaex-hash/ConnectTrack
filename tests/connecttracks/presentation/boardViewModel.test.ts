import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GameSnapshot } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import {
    buildBoardViewModel,
    classifyCellVisual,
} from '../../../assets/scripts/presentation/board/boardViewModel';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

function newSnapshot(): GameSnapshot {
    return new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] }).snapshot();
}

describe('player state classification', () => {
    it('maps each confirmed player state to its own visual', () => {
        expect(classifyCellVisual(PlayerCellState.Empty)).toBe('empty');
        expect(classifyCellVisual(PlayerCellState.X)).toBe('x');
        expect(classifyCellVisual(PlayerCellState.TrackPreview)).toBe('trackPreview');
        expect(classifyCellVisual(PlayerCellState.Track)).toBe('track');
        expect(classifyCellVisual(PlayerCellState.RedX)).toBe('redX');
    });

    it('RedX is a distinct visual from an ordinary X, and is the only locked state', () => {
        expect(classifyCellVisual(PlayerCellState.RedX)).not.toBe(classifyCellVisual(PlayerCellState.X));
        const view = buildBoardViewModel(newSnapshot());
        expect(view.cells.filter((cell) => cell.isLocked)).toEqual([]);
    });
});

describe('snapshot to view model', () => {
    it('keeps the board dimensions and one entry per cell, in index order', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(view.width).toBe(3);
        expect(view.height).toBe(3);
        expect(view.cells.map((cell) => cell.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    });

    it('flags the fixed Main Track endpoints, and only those', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(view.cells.filter((cell) => cell.isMainTrackEndpoint).map((cell) => cell.index)).toEqual([0, 8]);
    });

    it('marks the drag pivot only while a drag is active', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        const idle = buildBoardViewModel(session.snapshot());
        expect(idle.cells.some((cell) => cell.isDragPivot)).toBe(false);

        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        const dragging = buildBoardViewModel(session.snapshot());
        expect(dragging.cells.filter((cell) => cell.isDragPivot).map((cell) => cell.index)).toEqual([1]);
    });

    it('is frozen: the presentation cannot change it', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(Object.isFrozen(view)).toBe(true);
        expect(Object.isFrozen(view.cells)).toBe(true);
    });
});

describe('Track option menu selection (confirmed by the user)', () => {
    it('defaults to no cell selected when the second argument is omitted', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(view.cells.some((cell) => cell.isOptionMenuSelected)).toBe(false);
    });

    it('marks exactly the one passed-in cell as selected', () => {
        const view = buildBoardViewModel(newSnapshot(), 2);
        expect(view.cells.filter((cell) => cell.isOptionMenuSelected).map((cell) => cell.index)).toEqual([2]);
    });
});

describe('Track ? rendering classification', () => {
    it('a cell with one connection is reported as Track ?, with that direction', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
        const view = buildBoardViewModel(session.snapshot());
        expect(view.cells[1].trackQuestionDirection).toBe(Direction.Right);
        expect(view.cells[2].trackQuestionDirection).toBe(Direction.Left);
    });

    it('Track ? is not a player state: the cell keeps its own visual', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
        const cell = buildBoardViewModel(session.snapshot()).cells[1];
        expect(cell.visual).toBe('trackPreview');
        expect(cell.trackQuestionDirection).toBe(Direction.Right);
    });

    it('a cell with no connection has no Track ? direction', () => {
        expect(buildBoardViewModel(newSnapshot()).cells[4].trackQuestionDirection).toBeNull();
    });
});

describe('RedX presentation', () => {
    it('a wrong target is shown as a locked RedX cell', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 4 });
        const cell = buildBoardViewModel(session.snapshot()).cells[4];
        expect(cell.visual).toBe('redX');
        expect(cell.isLocked).toBe(true);
    });
});

describe('Main Track port directions (for rendering its shape)', () => {
    it('exposes the fixed ports only on the two Main Track endpoint cells', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(view.cells[0].mainPortDirections).toEqual([Direction.Left, Direction.Right]);
        expect(view.cells[8].mainPortDirections).toEqual([Direction.Down, Direction.Up]);
        expect(view.cells[4].mainPortDirections).toEqual([]);
    });
});

describe('Entrance role (which of the 2 dedicated in/out nodes a cell should use)', () => {
    it('is "in" at s[0], "out" at s[-1], and null everywhere else', () => {
        const view = buildBoardViewModel(newSnapshot());
        expect(view.cells[0].entranceRole).toBe('in');
        expect(view.cells[8].entranceRole).toBe('out');
        expect(view.cells[4].entranceRole).toBeNull();
    });
});

describe('Main Track entrance direction (where the train enters/exits the board)', () => {
    it('entranceDirection is always the true outward (off-board) edge, for positioning', () => {
        const view = buildBoardViewModel(newSnapshot());
        // TEST_LEVEL: a = Left at cell 0 (outward), b = Down at cell 8 (outward).
        expect(view.cells[0].entranceDirection).toBe(Direction.Left);
        expect(view.cells[8].entranceDirection).toBe(Direction.Down);
    });

    it('is null on every non-endpoint cell', () => {
        const cell = buildBoardViewModel(newSnapshot()).cells[4];
        expect(cell.entranceDirection).toBeNull();
    });
});

describe('given cells beyond the two endpoints (CONFIRMED-BY-USER: shown as a completed Track, locked)', () => {
    function middleGivenSnapshot(): GameSnapshot {
        return new GameSession({ level: TEST_LEVEL_WITH_MIDDLE_GIVEN, requiredCells: [1, 5] }).snapshot();
    }

    it('renders the middle given cell\'s fixed shape via mainPortDirections, from level start', () => {
        const view = buildBoardViewModel(middleGivenSnapshot());
        expect(view.cells[2].mainPortDirections).toEqual([Direction.Left, Direction.Down]);
    });

    it('is not flagged as a board-edge endpoint and has no entrance/exit arrow', () => {
        const view = buildBoardViewModel(middleGivenSnapshot());
        expect(view.cells[2].isMainTrackEndpoint).toBe(false);
        expect(view.cells[2].entranceDirection).toBeNull();
    });

    it('stays Empty as PlayerCellState (its Track look comes from Main Track ports, not player state)', () => {
        const view = buildBoardViewModel(middleGivenSnapshot());
        expect(view.cells[2].visual).toBe('empty');
    });
});

describe('a cell\'s own track directions', () => {
    it('reflects the links created by a connection, even before the cell is a completed Track', () => {
        const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
        session.dispatch({ type: 'doubleTapCell', cell: 1 });
        session.dispatch({ type: 'beginTrackDrag', cell: 1 });
        session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
        const view = buildBoardViewModel(session.snapshot());
        expect(view.cells[1].trackDirections).toEqual([Direction.Right]);
        expect(view.cells[2].trackDirections).toEqual([Direction.Left]);
        expect(view.cells[4].trackDirections).toEqual([]);
    });
});
