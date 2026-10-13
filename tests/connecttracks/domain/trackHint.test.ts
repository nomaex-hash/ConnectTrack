import { expect, it } from 'vitest';
import { findTrackHint } from '../../../assets/scripts/domain/rules/trackHint';
import { PlayerCellState as S } from '../../../assets/scripts/domain/board/playerCellState';
import { Board } from '../../../assets/scripts/domain/board/board';
import { SolutionTruth } from '../../../assets/scripts/domain/level/solutionTruth';

// Isolated local deduction fixtures: answer membership/clues, not production level records.
function fixture(solution: number[], states: Record<number, S> = {}) {
    const board = { size: { width: 3, height: 3 }, mainTrack: { portsAt: () => [] },
        stateAt: (c: number) => states[c] ?? S.Empty, linksAt: () => [] } as unknown as Board;
    const truth = { isSolutionCell: (c: number) => solution.includes(c), correctDirectionsAt: () => null } as unknown as SolutionTruth;
    return { board, truth, find: () => findTrackHint(board, truth, false, null) };
}
it('A2 marks the remaining cells of a full line together', () => {
    const h = fixture([0, 4, 8], { 0: S.TrackPreview }).find()!;
    expect(h.rule).toBe('A2'); expect(h.targets).toEqual([1, 2]); expect(h.lifted).toEqual([0, 1, 2]);
});
it('A4 uses all unmarked candidates, treating locked RedX as a non-track mark', () => {
    const h = fixture([0, 4, 8], { 1: S.X, 2: S.RedX }).find()!;
    expect(h.rule).toBe('A4'); expect(h.targets).toEqual([0]);
});
it('prioritizes A2 marking over A4 preview placement when both deductions exist', () => {
    // Row 0 can mark 1/2; row 1 must place 4. Full-line marking now takes priority.
    const h = fixture([0, 4, 8], { 0: S.TrackPreview, 3: S.X, 5: S.X }).find()!;
    expect(h.rule).toBe('A2'); expect(h.action).toBe('markX'); expect(h.targets).toEqual([1, 2]);
});
it('A3 forces the second available neighbor after an existing adjacent track', () => {
    const h = fixture([0, 1, 3, 8], { 0: S.TrackPreview, 1: S.Track, 2: S.X, 4: S.X, 7: S.X }).find()!;
    expect(h.rule).toBe('A3'); expect(h.targets).toEqual([3]);
});
it('A5 excludes a cell with three blocked directions and lifts marked evidence', () => {
    const h = fixture([2, 3, 7], { 1: S.X }).find()!;
    expect(h.rule).toBe('A5'); expect(h.targets).toEqual([0]); expect(h.lifted).toEqual([0, 1]);
});
it('A6 requires a forced extra same-line track, not mere lack of track neighbors', () => {
    const f = fixture([0, 4, 8]);
    const h = f.find()!;
    expect(h.rule).toBe('A6'); expect(h.targets).toEqual([0]);
    // Centre has four open directions and must not be selected under this rule.
    expect(h.targets).not.toContain(4);
});
it('A8 uses the supplied Place Track target without inventing A7 or text', () => {
    const f = fixture([0, 1, 3, 5, 7, 8]);
    const h = findTrackHint(f.board, f.truth, false, 5)!;
    expect(h.rule).toBe('A8'); expect(h.targets).toEqual([5]); expect(h.text).toBe('');
});
it('B1 has no invented wrong-shape fallback while previews remain without a correct incoming port', () => {
    const f = fixture([0, 4, 8], { 4: S.TrackPreview });
    expect(findTrackHint(f.board, f.truth, true, null)).toBe(null);
});
