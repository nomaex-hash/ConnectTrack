import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { CommandResult, GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';
import { TEST_LEVEL } from '../domain/fixtures';

/*
 * TEST_LEVEL (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0 (ports Left/Right), 8 (ports
 * Down/Up). Required: 1, 2, 5. Non-solution cells: 3, 4, 6, 7.
 */
const REQUIRED = [1, 2, 5];

function newSession(): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED });
}

// Path runs through the centre: 0 -> 1 -> 4 -> 7 -> 8. Pivot 4's non-path neighbours (3, 5) are
// both non-solution — for a "wrong direction in a shape" test.
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

describe('applyTrackShape (Track option menu, confirmed by the user)', () => {
    it('sets both connections at once, from a bare TrackPreview straight to a completed Track', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 });
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 1,
            directions: [Direction.Left, Direction.Right],
        });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.Track);
        expect([...snapshot.cellLinks[1]].sort()).toEqual([Direction.Left, Direction.Right].sort());
    });

    it('a direction toward a non-solution cell is applied as-is, with NO mistake and NO touching the neighbour (confirmed by the user)', () => {
        const session = centerPathSession();
        run(session, { type: 'doubleTapCell', cell: 4 });
        const before = session.snapshot().mistakes;
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 4,
            directions: [Direction.Up, Direction.Left], // Up -> 1 (correct), Left -> 3 (wrong).
        });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.mistakes).toBe(before); // No mistake, even though Left -> 3 is wrong.
        expect(snapshot.cellStates[3]).toBe(PlayerCellState.Empty); // Neighbour 3 untouched — no RedX.
        expect(snapshot.cellLinks[3]).toEqual([]); // No reciprocal link on the neighbour either.
        // Cell 4 itself got exactly the chosen shape, both directions, wrong or not.
        expect([...snapshot.cellLinks[4]].sort()).toEqual([Direction.Up, Direction.Left].sort());
        expect(snapshot.cellStates[4]).toBe(PlayerCellState.Track);
    });

    it('does not set a reciprocal link on an ordinary (non-given) CORRECT neighbour either', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 });
        run(session, {
            type: 'applyTrackShape',
            cell: 1,
            directions: [Direction.Left, Direction.Right], // Right -> 2, a correct solution cell.
        });
        // Cell 2 (the correct neighbour) was never touched: still plain Empty, no link back toward 1.
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[2]).toBe(PlayerCellState.Empty);
        expect(snapshot.cellLinks[2]).toEqual([]);
    });

    it('does not redirect an already-full neighbour either — that neighbour is left completely alone', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 2 },
            { type: 'applyTrackShape', cell: 2, directions: [Direction.Left, Direction.Down] }, // 2 is now full (Track).
            { type: 'doubleTapCell', cell: 1 },
        );
        const before = session.snapshot().cellLinks[2];
        run(session, { type: 'applyTrackShape', cell: 1, directions: [Direction.Left, Direction.Right] }); // Right -> 2, already full.
        const snapshot = session.snapshot();
        // Cell 2 is completely unchanged — no redirect happened on it.
        expect([...snapshot.cellLinks[2]]).toEqual([...before]);
        expect(snapshot.cellStates[2]).toBe(PlayerCellState.Track);
        // Cell 1 still got its own chosen shape regardless.
        expect([...snapshot.cellLinks[1]].sort()).toEqual([Direction.Left, Direction.Right].sort());
    });

    it('completes the win in one shot when the shape finishes the whole path', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'doubleTapCell', cell: 2 },
            { type: 'doubleTapCell', cell: 5 },
            { type: 'applyTrackShape', cell: 1, directions: [Direction.Left, Direction.Right] },
            { type: 'applyTrackShape', cell: 2, directions: [Direction.Left, Direction.Down] },
        );
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 5,
            directions: [Direction.Up, Direction.Down],
        });
        expect(result.accepted).toBe(true);
        expect(session.snapshot().phase).toBe(GamePhase.Won);
    });

    it('rejects on an invalid origin (plain Empty, never marked as track first)', () => {
        const session = newSession();
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 1,
            directions: [Direction.Left, Direction.Right],
        });
        expect(rejectionOf(result)).toBe('notAllowedOnState');
    });

    it('rejects duplicate directions defensively', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 });
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 1,
            directions: [Direction.Left, Direction.Left],
        });
        expect(rejectionOf(result)).toBe('notAllowedOnState');
    });

    it('rejects an out-of-bounds cell', () => {
        const session = newSession();
        const result = run(session, {
            type: 'applyTrackShape',
            cell: 99,
            directions: [Direction.Left, Direction.Right],
        });
        expect(rejectionOf(result)).toBe('outOfBounds');
    });
});

describe('resetTrackPreview (Track option menu\'s "track preview" option, confirmed by the user)', () => {
    it('clears a completed Track back to a bare TrackPreview (0 links)', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'applyTrackShape', cell: 1, directions: [Direction.Left, Direction.Right] },
        );
        expect(session.snapshot().cellStates[1]).toBe(PlayerCellState.Track);
        const result = run(session, { type: 'resetTrackPreview', cell: 1 });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[1]).toEqual([]);
    });

    it('clears a Track ? (1 link) back to a bare TrackPreview too', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 0 },
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'endTrackDrag' },
        );
        expect(session.snapshot().cellLinks[1]).toEqual([Direction.Left]);
        const result = run(session, { type: 'resetTrackPreview', cell: 1 });
        expect(result.accepted).toBe(true);
        expect(session.snapshot().cellLinks[1]).toEqual([]);
    });

    it('is a no-op on an already-bare TrackPreview', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 });
        const result = run(session, { type: 'resetTrackPreview', cell: 1 });
        expect(result).toEqual({ accepted: true, changed: false, snapshot: session.snapshot() });
    });

    it('rejects a RedX cell as locked', () => {
        const session = centerPathSession();
        run(session, { type: 'doubleTapCell', cell: 3 }); // 3 is non-solution: becomes RedX, 1 mistake.
        const result = run(session, { type: 'resetTrackPreview', cell: 3 });
        expect(rejectionOf(result)).toBe('redXLocked');
    });

    it('rejects a plain Empty cell', () => {
        const session = newSession();
        const result = run(session, { type: 'resetTrackPreview', cell: 1 });
        expect(rejectionOf(result)).toBe('notAllowedOnState');
    });
});
