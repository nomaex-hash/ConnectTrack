import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { CommandResult } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';
import { TEST_LEVEL } from '../domain/fixtures';

/*
 * TEST_LEVEL (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Given: 0, 8. Required: 1, 2, 5.
 * Non-solution cells: 3, 4, 6, 7.
 */
const REQUIRED = [1, 2, 5];

function newSession(tutorialMode = false): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED, tutorialMode });
}

// Path through the centre: 0 -> 1 -> 4 -> 7 -> 8. Pivot 4's non-path neighbours (3, 5) are both
// non-solution — needed for a wrong DRAG crossing (TEST_LEVEL's own path cells have no non-solution
// neighbour adjacent to a usable pivot in the same shape).
const CENTER_PATH_LEVEL = createLevelData({
    width: 3,
    height: 3,
    solutionPath: [0, 1, 4, 7, 8],
    given: [0, 8],
    outwardStart: Direction.Up,
    outwardEnd: Direction.Down,
});

function centerPathSession(tutorialMode = false): GameSession {
    return new GameSession({ level: CENTER_PATH_LEVEL, requiredCells: [1, 4, 7], tutorialMode });
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

describe('double-tapping any track reverts it to TrackPreview (confirmed by the user — permanent, both modes)', () => {
    it('a Track ? (1 link) reverts to a bare TrackPreview on double-tap, instead of being rejected', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'beginTrackDrag', cell: 0 },
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'endTrackDrag' },
        );
        expect(session.snapshot().cellLinks[1]).toEqual([Direction.Left]); // Track ? confirmed first.
        const result = run(session, { type: 'doubleTapCell', cell: 1 });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[1]).toEqual([]);
    });

    it('a completed Track (2 links) still reverts to a bare TrackPreview too (unchanged behaviour)', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 }, {
            type: 'applyTrackShape', cell: 1, directions: [Direction.Left, Direction.Right],
        });
        expect(session.snapshot().cellStates[1]).toBe(PlayerCellState.Track);
        const result = run(session, { type: 'doubleTapCell', cell: 1 });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[1]).toBe(PlayerCellState.TrackPreview);
        expect(snapshot.cellLinks[1]).toEqual([]);
    });
});

describe('tutorialMode: a wrong drag crossing does nothing at all (confirmed by the user)', () => {
    it('crossing into a non-solution Empty cell leaves it untouched, no mistake, drag continues', () => {
        const session = centerPathSession(true);
        run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'beginTrackDrag', cell: 1 });
        const before = session.snapshot();
        const result = run(session, { type: 'trackBoundaryCrossed', from: 1, to: 2 }); // 2 is non-solution, adjacent to 1.
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[2]).toBe(PlayerCellState.Empty); // NOT RedX, unlike real gameplay.
        expect(snapshot.mistakes).toBe(before.mistakes);
        expect(snapshot.dragPivot).toBe(1); // Pivot unchanged — the drag was never interrupted.
    });

    it('the SAME crossing in a REAL (non-tutorial) session still paints RedX and counts a mistake (regression)', () => {
        const session = centerPathSession(false);
        run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'beginTrackDrag', cell: 1 });
        const before = session.snapshot();
        const result = run(session, { type: 'trackBoundaryCrossed', from: 1, to: 2 });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[2]).toBe(PlayerCellState.RedX);
        expect(snapshot.mistakes).toBe(before.mistakes + 1);
    });
});

describe('tutorialMode: a wrong double-tap still shows RedX, but records no mistake (confirmed by the user)', () => {
    it('double-tapping a non-solution cell paints RedX without touching the mistake counter', () => {
        const session = centerPathSession(true);
        const before = session.snapshot().mistakes;
        const result = run(session, { type: 'doubleTapCell', cell: 3 }); // 3 is non-solution.
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[3]).toBe(PlayerCellState.RedX);
        expect(snapshot.mistakes).toBe(before);
    });

    it('the SAME double-tap in a REAL (non-tutorial) session still records a mistake (regression)', () => {
        const session = centerPathSession(false);
        const before = session.snapshot().mistakes;
        const result = run(session, { type: 'doubleTapCell', cell: 3 });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.cellStates[3]).toBe(PlayerCellState.RedX);
        expect(snapshot.mistakes).toBe(before + 1);
    });
});
