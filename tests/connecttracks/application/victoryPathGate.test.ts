import { expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { GamePhase } from '../../../assets/scripts/application/contracts/gameSnapshot';
import { TEST_LEVEL } from '../domain/fixtures';

it('does not lock the session before the whole train route is connected', () => {
    const session = new GameSession({ level: TEST_LEVEL, requiredCells: [1] });
    session.dispatch({ type: 'doubleTapCell', cell: 1 });
    session.dispatch({ type: 'beginTrackDrag', cell: 1 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 0 });
    session.dispatch({ type: 'endTrackDrag' });
    session.dispatch({ type: 'beginTrackDrag', cell: 1 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
    expect(session.snapshot().phase).toBe(GamePhase.Active);
    expect(session.snapshot().needsConnectionHint).toBe(true);
    session.dispatch({ type: 'trackBoundaryCrossed', from: 2, to: 5 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 5, to: 8 });
    expect(session.snapshot().phase).toBe(GamePhase.Won);
});
