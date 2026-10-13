import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { CommandResult } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';
import { requiredCellsFor } from '../../../assets/scripts/application/session/requiredCells';
import { TEST_LEVEL } from '../domain/fixtures';

/*
 * TEST_LEVEL (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0, 8. Required: 1, 2, 5.
 */
const REQUIRED = [1, 2, 5];

function newSession(): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED });
}

// Full boustrophedon path covering every cell: 0 -> 1 -> 2 -> 5 -> 4 -> 3 -> 6 -> 7 -> 8. Given:
// just the 2 endpoints (0, 8). Required: 1, 2, 5, 4, 3, 6, 7 (7 cells) — enough spread across rows
// (0: {1,2}, 1: {3,4,5}, 2: {6,7}) and columns (0: {3,6}, 1: {1,4,7}, 2: {2,5}) for a real
// row/column-priority test, distinct from plain reading order.
const FULL_SNAKE_LEVEL = createLevelData({
    width: 3,
    height: 3,
    solutionPath: [0, 1, 2, 5, 4, 3, 6, 7, 8],
    given: [0, 8],
    outwardStart: Direction.Up,
    outwardEnd: Direction.Down,
});

function snakeSession(): GameSession {
    return new GameSession({ level: FULL_SNAKE_LEVEL, requiredCells: requiredCellsFor(FULL_SNAKE_LEVEL) });
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

describe('placeTrack (confirmed by the user, modelled on the existing Place Dog hint)', () => {
    it('marks a required cell as TrackPreview (same as a double-tap) — does NOT connect it (confirmed by the user)', () => {
        const session = newSession();
        const result = run(session, { type: 'placeTrack' });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        // Cell 1 is the sole reading-order winner on a fresh TEST_LEVEL board.
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[1]).toEqual([]);
        // Untouched cells stay Empty.
        expect(snapshot.cellStates[2]).toBe(PlayerCellState.Empty);
        expect(snapshot.cellStates[5]).toBe(PlayerCellState.Empty);
    });

    it('skips a cell already identified in ANY way (TrackPreview, Track ?, or a completed Track — right or wrong)', () => {
        const session = newSession();
        // Cell 1: already TrackPreview (double-tap only, confirmed to be skipped).
        run(session, { type: 'doubleTapCell', cell: 1 });
        // Cell 2: already a completed Track — even a WRONG one still counts as "identified" now
        // (applyTrackShape never checks Solution Truth, so this is accepted as a wrong Track).
        run(session, { type: 'doubleTapCell', cell: 2 });
        run(session, { type: 'applyTrackShape', cell: 2, directions: [Direction.Left, Direction.Down] });
        // Only cell 5 (still plain Empty) remains a candidate.
        const result = run(session, { type: 'placeTrack' });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[5]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[5]).toEqual([]);
        // The already-identified cells are left exactly as they were.
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[1]).toEqual([]);
        expect([...snapshot.cellLinks[2]].sort()).toEqual([Direction.Left, Direction.Down].sort());
    });

    it('rejects with "nothingToPlace" once every required cell is already identified, even if not yet connected (reachable now)', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 });
        run(session, { type: 'doubleTapCell', cell: 2 });
        run(session, { type: 'doubleTapCell', cell: 5 });
        const result = run(session, { type: 'placeTrack' });
        expect(rejectionOf(result)).toBe('nothingToPlace');
    });

    it('prioritizes the row/column CLOSER TO COMPLETE over plain reading order (confirmed by the user)', () => {
        const session = snakeSession();
        // Identify 1 and 2 first (row 0 fully identified; column 2 now only missing cell 5).
        run(session, { type: 'doubleTapCell', cell: 1 });
        run(session, { type: 'doubleTapCell', cell: 2 });
        // Remaining unidentified: 3, 4, 5, 6, 7. Reading order would try 3 first (row 1, col 0), but
        // column 2 (cell 5's column) now has only 1 cell left — the nearest-to-complete line.
        const result = run(session, { type: 'placeTrack' });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[5]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellStates[3]).toBe(PlayerCellState.Empty);
    });

    it('ties on row/column progress fall back to top-left reading order (confirmed by the user)', () => {
        const session = snakeSession();
        // Fresh board: every required cell ties or loses to cell 1 (row 0, col 1) — the lowest
        // row, then lowest column among the tied minimum.
        const result = run(session, { type: 'placeTrack' });
        expect(result.accepted).toBe(true);
        expect(session.snapshot().cellStates[1]).toBe(PlayerCellState.TrackPreview);
    });
});
