import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { CommandResult, GamePhase, GameSnapshot } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

/*
 * Test level (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Main Track endpoints: 0 and 8.
 * Non-solution cells: 3, 4, 6, 7.
 */
const REQUIRED = [1, 2, 5];

function newSession(): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED });
}

/**
 * Local level for tests needing a pivot with TWO non-solution neighbours (double-tap now only
 * succeeds on an actual solution cell — confirmed by the user — so a wrong-target drag origin must
 * itself be a real solution cell). Same 3x3 board as TEST_LEVEL, but the path runs through the
 * centre: 0 -> 1 -> 4 -> 7 -> 8. Pivot 4's non-path neighbours are 3 (left) and 5 (right) — both
 * non-solution, for "two different wrong targets from the same pivot" tests.
 */
const CENTER_PATH_LEVEL = createLevelData({
    width: 3,
    height: 3,
    solutionPath: [0, 1, 4, 7, 8],
    given: [0, 8],
    outwardStart: Direction.Up,
    outwardEnd: Direction.Down,
});

function centerPathSession(): GameSession {
    return new GameSession({ level: CENTER_PATH_LEVEL, requiredCells: [1, 4, 7] });
}

function run(session: GameSession, ...commands: GameCommand[]): CommandResult {
    let result: CommandResult | undefined;
    for (const command of commands) {
        result = session.dispatch(command);
    }
    if (!result) {
        throw new Error('run() needs at least one command');
    }
    return result;
}

function rejectionOf(result: CommandResult): string | null {
    return result.accepted ? null : result.reason;
}

function hasTrackQuestion(snapshot: GameSnapshot, cell: number, direction: Direction): boolean {
    return snapshot.trackQuestions.some((q) => q.cell === cell && q.direction === direction);
}

describe('beginning a Track drag', () => {
    it('starts from a TrackPreview and records the pivot', () => {
        const session = newSession();
        const result = run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'beginTrackDrag', cell: 1 });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.dragPivot).toBe(1);
    });

    it('starts from a Track', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            // Crossing into the Main Track no longer ends the drag (confirmed by the user) — release
            // explicitly before starting a fresh drag back at cell 1 for its second connection.
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'endTrackDrag' },
        );
        expect(session.snapshot().cellStates[1]).toBe(PlayerCellState.Track);
        const result = run(session, { type: 'beginTrackDrag', cell: 1 });
        expect(result.accepted && result.snapshot.dragPivot).toBe(1);
    });

    it('is rejected from an Empty or X cell', () => {
        expect(rejectionOf(newSession().dispatch({ type: 'beginTrackDrag', cell: 3 }))).toBe('notAllowedOnState');
        const withX = newSession();
        withX.dispatch({ type: 'tapCell', cell: 3 });
        expect(rejectionOf(withX.dispatch({ type: 'beginTrackDrag', cell: 3 }))).toBe('notAllowedOnState');
    });

    it('is rejected while another drag is active', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'beginTrackDrag', cell: 1 });
        expect(rejectionOf(session.dispatch({ type: 'beginTrackDrag', cell: 2 }))).toBe('dragAlreadyActive');
    });

    it('starts from a given cell too, exactly like any other Track cell (confirmed by the user)', () => {
        // TEST_LEVEL's given cells are its two Main Track endpoints, 0 and 8.
        const session = newSession();
        const result = run(session, { type: 'beginTrackDrag', cell: 0 });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.dragPivot).toBe(0);
    });

    it('dragging THROUGH a middle given cell continues the SAME drag, uninterrupted (confirmed by the user)', () => {
        // TEST_LEVEL_WITH_MIDDLE_GIVEN: path 0 -> 1 -> 2 -> 5 -> 8, given [0, 2, 8] (2 is a middle
        // given cell). One continuous drag: 1 -> 2 (into given) -> 5, with no endTrackDrag/
        // beginTrackDrag in between.
        const session = new GameSession({ level: TEST_LEVEL_WITH_MIDDLE_GIVEN, requiredCells: [1, 5] });
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(result.snapshot.dragPivot).toBe(2); // Did NOT end at the given cell.
        const continued = run(session, { type: 'trackBoundaryCrossed', from: 2, to: 5 });
        expect(continued.accepted).toBe(true);
        expect(continued.snapshot.dragPivot).toBe(5);
        expect(continued.snapshot.cellLinks[5]).toEqual([Direction.Up]);
    });
});

describe('boundary crossings', () => {
    it('is rejected without an active drag, and from a cell that is not the pivot', () => {
        const session = newSession();
        expect(rejectionOf(session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 }))).toBe('noActiveDrag');
        run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'beginTrackDrag', cell: 1 });
        expect(rejectionOf(session.dispatch({ type: 'trackBoundaryCrossed', from: 2, to: 5 }))).toBe('notPivot');
    });

    it('a crossing into a solution cell creates the connection immediately, as a Track ? on both ends', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(result.accepted && result.changed).toBe(true);
        expect(hasTrackQuestion(result.snapshot, 1, Direction.Right)).toBe(true);
        expect(hasTrackQuestion(result.snapshot, 2, Direction.Left)).toBe(true);
        expect(result.snapshot.dragPivot).toBe(2);
    });

    it('a crossing along an existing connection changes nothing', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        const before = session.snapshot();
        const result = run(
            session,
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        // Cell 1 already links Right toward 2: crossing along it again is a no-op.
        expect(result.accepted && result.changed).toBe(false);
        expect(result.snapshot.cellLinks).toEqual(before.cellLinks);
    });
});

describe('Track ? and Track', () => {
    it('Track ? persists after release', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'endTrackDrag' },
        );
        expect(result.snapshot.dragPivot).toBeNull();
        expect(hasTrackQuestion(result.snapshot, 1, Direction.Right)).toBe(true);
    });

    it('a second connection makes the cell a Track and it leaves the Track ? list', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.Track);
        expect(result.snapshot.trackQuestions.some((q) => q.cell === 1)).toBe(false);
    });

    it('a full Track pivot crossing into a non-solution cell still makes RedX (confirmed rule)', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 4 },
        );
        expect(result.snapshot.cellStates[4]).toBe(PlayerCellState.RedX);
        expect(result.snapshot.mistakes).toBe(1);
        expect(result.snapshot.cellLinks[1]).toEqual([Direction.Left, Direction.Right]);
    });
});

describe('wrong targets and RedX', () => {
    it('a crossing into a non-solution cell makes it RedX and counts one mistake, even from a TrackPreview', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 4 },
        );
        expect(result.accepted && result.changed).toBe(true);
        expect(result.snapshot.cellStates[4]).toBe(PlayerCellState.RedX);
        expect(result.snapshot.mistakes).toBe(1);
        expect(result.snapshot.cellLinks[1]).toEqual([]);
        expect(result.snapshot.dragPivot).toBe(1);
    });

    it('RedX cannot be tapped, double-tapped, or crossed into again, and creates no new mistake', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 4 },
            { type: 'endTrackDrag' },
        );
        expect(rejectionOf(session.dispatch({ type: 'tapCell', cell: 4 }))).toBe('redXLocked');
        expect(rejectionOf(session.dispatch({ type: 'doubleTapCell', cell: 4 }))).toBe('redXLocked');
        run(session, { type: 'beginTrackDrag', cell: 1 });
        expect(rejectionOf(session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 4 }))).toBe('targetLocked');
        expect(session.snapshot().mistakes).toBe(1);
    });

    it('a drag can continue from the same pivot after a wrong target', () => {
        const session = centerPathSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 4 },
            { type: 'beginTrackDrag', cell: 4 },
            { type: 'trackBoundaryCrossed', from: 4, to: 3 },
            { type: 'trackBoundaryCrossed', from: 4, to: 5 },
        );
        expect(result.snapshot.mistakes).toBe(2);
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.RedX);
        expect(result.snapshot.cellStates[5]).toBe(PlayerCellState.RedX);
    });
});

describe('mistakes and loss', () => {
    it('the third mistake makes the session Lost, clears the drag, and locks later commands', () => {
        const session = centerPathSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 4 },
            { type: 'beginTrackDrag', cell: 4 },
            { type: 'trackBoundaryCrossed', from: 4, to: 3 },
            { type: 'trackBoundaryCrossed', from: 4, to: 5 },
            { type: 'endTrackDrag' },
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        const snapshot = session.snapshot();
        expect(snapshot.mistakes).toBe(3);
        expect(snapshot.phase).toBe(GamePhase.Lost);
        expect(snapshot.dragPivot).toBeNull();
        expect(rejectionOf(session.dispatch({ type: 'tapCell', cell: 6 }))).toBe('gameFinished');
    });

    it('no fourth mistake can be recorded after loss', () => {
        const session = centerPathSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 4 },
            { type: 'beginTrackDrag', cell: 4 },
            { type: 'trackBoundaryCrossed', from: 4, to: 3 },
            { type: 'trackBoundaryCrossed', from: 4, to: 5 },
            { type: 'endTrackDrag' },
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(rejectionOf(session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 }))).toBe('gameFinished');
        expect(session.snapshot().mistakes).toBe(3);
    });
});

describe('win through play', () => {
    it('a completed set of required Tracks transitions to Won, and later commands are rejected', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'trackBoundaryCrossed', from: 2, to: 5 },
            { type: 'trackBoundaryCrossed', from: 5, to: 8 },
        );
        expect(result.snapshot.phase).toBe(GamePhase.Won);
        expect(rejectionOf(session.dispatch({ type: 'tapCell', cell: 3 }))).toBe('gameFinished');
    });

    it('is not won while a required cell still has fewer than two connections', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(result.snapshot.phase).toBe(GamePhase.Active);
    });
});

describe('solution truth and Main Track', () => {
    it('a solution target marked X is preserved while the drag remains active', () => {
        const session = newSession();
        run(session, { type: 'tapCell', cell: 2 });
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        expect(result.accepted).toBe(false);
        expect(result.snapshot.cellStates[2]).toBe(PlayerCellState.X);
        expect(result.snapshot.dragPivot).toBe(1);
        expect(result.snapshot.mistakes).toBe(0);
        expect(hasTrackQuestion(result.snapshot, 2, Direction.Left)).toBe(false);
    });

    it('connecting to a Main Track endpoint leaves the endpoint cell unchanged', () => {
        const session = newSession();
        const result = run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
        );
        expect(result.snapshot.cellStates[0]).toBe(PlayerCellState.Empty);
        expect(result.snapshot.cellLinks[0]).toEqual([]);
        expect(hasTrackQuestion(result.snapshot, 1, Direction.Left)).toBe(true);
    });

    it('a Main Track endpoint cannot be double-tapped into a Player Track', () => {
        expect(rejectionOf(newSession().dispatch({ type: 'doubleTapCell', cell: 0 }))).toBe('mainTrackCell');
    });
});

describe('tap and double-tap on Track states', () => {
    it('a tap on TrackPreview or Track is a no-op', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        const result = session.dispatch({ type: 'tapCell', cell: 1 });
        expect(result.accepted && result.changed).toBe(false);
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.Track);
    });

    it('a double tap on a Track turns it into a TrackPreview and clears its own links only', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 0 },
            { type: 'endTrackDrag' },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
        );
        const result = session.dispatch({ type: 'doubleTapCell', cell: 1 });
        expect(result.accepted && result.changed).toBe(true);
        expect(result.snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(result.snapshot.cellLinks[1]).toEqual([]);
        // Neighbour edge is untouched: cell 2 still has its link back toward cell 1.
        expect(result.snapshot.cellLinks[2]).toEqual([Direction.Left]);
    });
});

describe('double-tap on a non-solution cell (confirmed by the user)', () => {
    it('becomes RedX immediately instead of TrackPreview, and counts as a mistake', () => {
        // TEST_LEVEL's solution path is [0,1,2,5,8]; cell 3 is not on it.
        const session = newSession();
        const result = session.dispatch({ type: 'doubleTapCell', cell: 3 });
        expect(result.accepted).toBe(true);
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.RedX);
        expect(result.snapshot.mistakes).toBe(1);
    });

    it('can end the game exactly like a wrong drag target, on the third such mistake', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 3 },
            { type: 'doubleTapCell', cell: 4 },
            { type: 'doubleTapCell', cell: 6 },
        );
        const snapshot = session.snapshot();
        expect(snapshot.mistakes).toBe(3);
        expect(snapshot.phase).toBe(GamePhase.Lost);
    });
});

describe('X-removal drag', () => {
    it('removes only X cells and never applies Track or RedX logic', () => {
        const session = newSession();
        run(session, { type: 'tapCell', cell: 3 }, { type: 'tapCell', cell: 7 });
        const result = session.dispatch({ type: 'removeXCells', cells: [3, 7] });
        expect(result.accepted && result.changed).toBe(true);
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.Empty);
        expect(result.snapshot.cellStates[7]).toBe(PlayerCellState.Empty);
        expect(result.snapshot.mistakes).toBe(0);
    });

    it('rejects a batch that includes a non-X cell, with no partial change', () => {
        const session = newSession();
        run(session, { type: 'tapCell', cell: 3 });
        const result = session.dispatch({ type: 'removeXCells', cells: [3, 7] });
        expect(rejectionOf(result)).toBe('batchContainsIneligibleCell');
        expect(result.snapshot.cellStates[3]).toBe(PlayerCellState.X);
    });
});

describe('restart', () => {
    it('clears RedX, Track ?, connections, mistakes and the drag, keeps the Main Track, returns Active', () => {
        const session = centerPathSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 4 },
            { type: 'beginTrackDrag', cell: 4 },
            { type: 'trackBoundaryCrossed', from: 4, to: 3 },
            { type: 'trackBoundaryCrossed', from: 4, to: 5 },
            { type: 'endTrackDrag' },
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'restart' },
        );
        const snapshot = session.snapshot();
        expect(snapshot.cellStates.every((state) => state === PlayerCellState.Empty)).toBe(true);
        expect(snapshot.cellLinks.every((links) => links.length === 0)).toBe(true);
        expect(snapshot.trackQuestions).toEqual([]);
        expect(snapshot.mistakes).toBe(0);
        expect(snapshot.dragPivot).toBeNull();
        expect(snapshot.phase).toBe(GamePhase.Active);
        expect(snapshot.mainTrackCells).toEqual([0, 8]);
    });
});
