import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GameCommand } from '../../../assets/scripts/application/commands/gameCommand';
import { TEST_LEVEL } from '../domain/fixtures';

/*
 * Test level (3x3). Solution path 0 -> 1 -> 2 -> 5 -> 8. Main Track endpoints: 0 and 8.
 * Required cells (not given): 1, 2, 5.
 */
const REQUIRED = [1, 2, 5];

function newSession(): GameSession {
    return new GameSession({ level: TEST_LEVEL, requiredCells: REQUIRED });
}

function run(session: GameSession, ...commands: GameCommand[]): void {
    for (const command of commands) {
        session.dispatch(command);
    }
}

describe('GameSnapshot.needsConnectionHint (confirmed by the user)', () => {
    it('is false at the start of a fresh session (nothing identified yet)', () => {
        expect(newSession().snapshot().needsConnectionHint).toBe(false);
    });

    it('stays false while only SOME required cells are identified as track', () => {
        const session = newSession();
        run(session, { type: 'doubleTapCell', cell: 1 }, { type: 'doubleTapCell', cell: 2 });
        expect(session.snapshot().needsConnectionHint).toBe(false);
    });

    it('turns true once every required cell is identified (TrackPreview) but none are connected', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'doubleTapCell', cell: 2 },
            { type: 'doubleTapCell', cell: 5 },
        );
        expect(session.snapshot().needsConnectionHint).toBe(true);
    });

    it('stays true while some required cells are Track ? (partially connected) but not all are a full Track', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'doubleTapCell', cell: 2 },
            { type: 'doubleTapCell', cell: 5 },
            { type: 'beginTrackDrag', cell: 0 }, // Given cell, connects 0 -> 1.
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'endTrackDrag' },
        );
        // Cell 1 is now Track ? (one link, toward 0) — still identified, still not fully connected.
        expect(session.snapshot().needsConnectionHint).toBe(true);
    });

    it('turns false once the full path is connected (Won)', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'doubleTapCell', cell: 2 },
            { type: 'doubleTapCell', cell: 5 },
            { type: 'beginTrackDrag', cell: 0 },
            { type: 'trackBoundaryCrossed', from: 0, to: 1 },
            { type: 'trackBoundaryCrossed', from: 1, to: 2 },
            { type: 'trackBoundaryCrossed', from: 2, to: 5 },
            { type: 'trackBoundaryCrossed', from: 5, to: 8 },
            { type: 'endTrackDrag' },
        );
        const snapshot = session.snapshot();
        expect(snapshot.needsConnectionHint).toBe(false);
    });

    it('turns false again after Restart, even once it was true', () => {
        const session = newSession();
        run(
            session,
            { type: 'doubleTapCell', cell: 1 },
            { type: 'doubleTapCell', cell: 2 },
            { type: 'doubleTapCell', cell: 5 },
        );
        expect(session.snapshot().needsConnectionHint).toBe(true);
        run(session, { type: 'restart' });
        expect(session.snapshot().needsConnectionHint).toBe(false);
    });
});
