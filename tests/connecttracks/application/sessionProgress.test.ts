import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

const create = () => new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
function played() {
    const session = create();
    session.dispatch({ type: 'tapCell', cell: 3 });
    session.dispatch({ type: 'doubleTapCell', cell: 4 }); // persistent wrong mark
    session.dispatch({ type: 'doubleTapCell', cell: 5 });
    session.dispatch({ type: 'beginTrackDrag', cell: 0 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 0, to: 1 });
    session.dispatch({ type: 'trackBoundaryCrossed', from: 1, to: 2 });
    return session;
}

describe('ConnectTracks resume', () => {
    it('round-trips marks, wrong marks, preview, full/partial tracks, link order and mistakes without a live drag', () => {
        const old = played();
        const next = create();
        expect(next.restoreProgress(JSON.parse(JSON.stringify(old.exportProgress())))).toBe(true);
        expect(next.snapshot()).toEqual({ ...old.snapshot(), dragPivot: null });
        expect(next.dispatch({ type: 'beginTrackDrag', cell: 2 }).accepted).toBe(true);
        expect(next.dispatch({ type: 'trackBoundaryCrossed', from: 2, to: 5 }).accepted).toBe(true);
    });

    it('restart removes all old marks and mistakes from the next save', () => {
        const session = played();
        session.dispatch({ type: 'restart' });
        const next = create();
        expect(next.restoreProgress(session.exportProgress())).toBe(true);
        expect(next.snapshot()).toEqual(create().snapshot());
    });

    it('rejects a save for changed level content even at the same board dimensions', () => {
        const next = new GameSession({ level: TEST_LEVEL_WITH_MIDDLE_GIVEN, requiredCells: [1, 5] });
        expect(next.restoreProgress(played().exportProgress())).toBe(false);
    });

    it.each([
        (p: any) => { p.version = 9; },
        (p: any) => { p.states.pop(); },
        (p: any) => { p.links[1] = [2, 2]; },
        (p: any) => { p.states[0] = 'X'; },
        (p: any) => { p.mistakes = 0; },
        (p: any) => { p.links[3] = [2]; },
        (p: any) => { p.states[5] = 'bogus'; },
    ])('rejects corrupt saves atomically', mutate => {
        const next = create(), before = next.snapshot();
        const raw = JSON.parse(JSON.stringify(played().exportProgress()));
        mutate(raw);
        expect(next.restoreProgress(raw)).toBe(false);
        expect(next.snapshot()).toEqual(before);
    });

    it('does not export terminal boards', () => {
        const session = create();
        for (const cell of [3, 4, 6]) session.dispatch({ type: 'doubleTapCell', cell });
        expect(session.exportProgress()).toBeNull();
        session.dispatch({ type: 'restart' });
        session.dispatch({ type: 'beginTrackDrag', cell: 0 });
        for (const [from, to] of [[0, 1], [1, 2], [2, 5], [5, 8]])
            session.dispatch({ type: 'trackBoundaryCrossed', from, to });
        expect(session.exportProgress()).toBeNull();
    });
});
