import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { CommandResult, GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { PlayerCellState } from '../../../assets/scripts/domain/board/playerCellState';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';

/** Same shape as trackInteraction.test.ts's CENTER_PATH_LEVEL — a pivot (4) with two non-solution
 * neighbours (3, 5), needed to force 3 wrong-target mistakes and reach GamePhase.Lost. */
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
    let result: CommandResult = session.dispatch(commands[0]);
    for (const command of commands.slice(1)) result = session.dispatch(command);
    return result;
}

function loseSession(): GameSession {
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
    expect(session.snapshot().phase).toBe(GamePhase.Lost);
    return session;
}

describe('revive', () => {
    it('is rejected when the session is not Lost', () => {
        const session = centerPathSession();
        const result = session.dispatch({ type: 'revive' });
        expect(result.accepted).toBe(false);
        expect(result.accepted === false && result.reason).toBe('notLost');
        expect(session.snapshot().phase).toBe(GamePhase.Active);
    });

    it('resets mistakes to 0 and brings the phase back to Active, from Lost', () => {
        const session = loseSession();
        const result = session.dispatch({ type: 'revive' });
        expect(result.accepted).toBe(true);
        const snapshot = session.snapshot();
        expect(snapshot.phase).toBe(GamePhase.Active);
        expect(snapshot.mistakes).toBe(0);
    });

    it('keeps every placed track untouched — unlike restart, which wipes the board', () => {
        const session = loseSession();
        const before = session.snapshot().cellStates[4]; // The Track? pivot placed before losing.
        expect(before).not.toBe(PlayerCellState.Empty);
        session.dispatch({ type: 'revive' });
        expect(session.snapshot().cellStates[4]).toBe(before);
    });

    it('lets the player act again after reviving (no longer gameFinished)', () => {
        const session = loseSession();
        session.dispatch({ type: 'revive' });
        const result = session.dispatch({ type: 'tapCell', cell: 6 });
        expect(result.accepted).toBe(true);
    });
});
