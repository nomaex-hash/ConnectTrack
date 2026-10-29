import { describe, expect, it } from 'vitest';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { TEST_LEVEL } from '../domain/fixtures';
import { Direction as D } from '../../../assets/scripts/domain/board/direction';

const session = () => new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] });
describe('ConnectTracks hint transaction', () => {
    it('prioritizes wrong X, previews without mutation, removes only that X on Apply', () => {
        const s = session(); s.dispatch({ type: 'tapCell', cell: 1 });
        const before = s.snapshot();
        const hint = s.requestHint()!;
        expect(hint.rule).toBe('A0'); expect(hint.targets).toEqual([1]);
        expect(s.snapshot()).toEqual(before);
        expect(s.applyHint(hint).accepted).toBe(true);
        expect(s.snapshot().cellStates[1]).toBe('Empty');
        expect(s.applyHint(hint).accepted).toBe(false);
    });
    it('given hint places preview without connecting it or modifying its given', () => {
        const s = session(); const hint = s.requestHint()!;
        expect(hint.rule).toBe('A1'); expect(hint.lifted).toEqual([0, 1]);
        s.applyHint(hint);
        expect(s.snapshot().cellStates[1]).toBe('TrackPreview');
        expect(s.snapshot().cellLinks[1]).toEqual([]);
        expect(s.snapshot().mainTrackCells).toEqual([0, 8]);
    });
    it('rejects stale/cancelled/replaced hints and cannot apply after restart', () => {
        const s = session(); const old = s.requestHint()!;
        s.dispatch({ type: 'tapCell', cell: 3 });
        expect(s.applyHint(old).accepted).toBe(false);
        const cancelled = s.requestHint()!; s.cancelHint();
        expect(s.applyHint(cancelled).accepted).toBe(false);
        const replaced = s.requestHint()!; s.requestHint();
        expect(s.applyHint(replaced).accepted).toBe(false);
        const restarted = s.requestHint()!; s.dispatch({ type: 'restart' });
        expect(s.applyHint(restarted).accepted).toBe(false);
    });
    it('B1 completes previews in correct directions and eventually wins', () => {
        const s = session();
        // Mark the wrong cell X BEFORE identifying every required cell — once all required cells
        // are identified (TrackPreview), marking/unmarking X on a non-solution cell is rejected
        // ('markingLocked', confirmed by the user). Order between unrelated cells doesn't affect
        // the resulting board state, so this still sets up the same scenario for B1 to clean up.
        s.dispatch({ type: 'tapCell', cell: 4 });
        for (const cell of [1, 2, 5]) s.dispatch({ type: 'doubleTapCell', cell });
        const first = s.requestHint()!;
        expect(first.rule).toBe('B1-preview');
        expect(first.targets).toEqual([1]); expect(first.lifted).toEqual([1, 4]);
        expect(first.directions).toEqual([D.Left, D.Right]);
        s.applyHint(first);
        for (let i = 0; i < 2; i++) expect(s.applyHint(s.requestHint()!).accepted).toBe(true);
        expect(s.snapshot().phase).toBe('Won'); expect(s.requestHint()).toBe(null);
    });
    it('B1 repairs a wrong shape only after all previews are shaped', () => {
        const s = session();
        for (const cell of [1, 2, 5]) s.dispatch({ type: 'doubleTapCell', cell });
        s.dispatch({ type: 'applyTrackShape', cell: 1, directions: [D.Left, D.Down] });
        s.dispatch({ type: 'applyTrackShape', cell: 2, directions: [D.Left, D.Down] });
        s.dispatch({ type: 'applyTrackShape', cell: 5, directions: [D.Up, D.Down] });
        const hint = s.requestHint()!;
        expect(hint.rule).toBe('B1-wrong'); expect(hint.error).toBe(true);
        expect(hint.lifted).toEqual([1]);
        s.applyHint(hint); expect(s.snapshot().phase).toBe('Won');
    });
    it('hint descriptors do not expose mutable target arrays', () => {
        const hint = session().requestHint()!;
        expect(Object.isFrozen(hint)).toBe(true); expect(Object.isFrozen(hint.targets)).toBe(true);
    });
});
