import { Board } from '../board/board';
import { PlayerCellState as S } from '../board/playerCellState';
import { ALL_DIRECTIONS, Direction, oppositeOf } from '../board/direction';
import { neighborIndex } from '../board/cellIndex';
import { SolutionTruth } from '../level/solutionTruth';

export interface TrackHint {
    readonly rule: 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A8' | 'B1-preview' | 'B1-wrong';
    readonly action: 'removeX' | 'markX' | 'preview' | 'shape';
    readonly targets: readonly number[];
    readonly lifted: readonly number[];
    readonly directions: readonly Direction[];
    readonly text: string;
    readonly error: boolean;
}

/** Ordered deductions; no UI, charge accounting or engine dependencies. */
export function findTrackHint(board: Board, truth: SolutionTruth, phaseB: boolean, fallback: number | null): TrackHint | null {
    const { width, height } = board.size;
    const cells = Array.from({ length: width * height }, (_, i) => i);
    const given = (c: number) => board.mainTrack.portsAt(c).length > 0;
    const track = (c: number) => given(c) || board.stateAt(c) === S.Track || board.stateAt(c) === S.TrackPreview;
    const empty = (c: number) => !given(c) && board.stateAt(c) === S.Empty;
    const marked = (c: number) => board.stateAt(c) === S.X || board.stateAt(c) === S.RedX;
    const near = (c: number, d: Direction) => neighborIndex(board.size, c, d);
    const neighbors = (c: number) => ALL_DIRECTIONS.map(d => near(c, d)).filter((n): n is number => n !== null);
    const blocked = (c: number, d: Direction) => {
        const n = near(c, d);
        return n === null || (marked(n) && !truth.isSolutionCell(n))
            || (given(n) && !board.mainTrack.portsAt(n).includes(oppositeOf(d)));
    };
    const open = (c: number) => ALL_DIRECTIONS.filter(d => !blocked(c, d));
    const marks = (c: number) => neighbors(c).filter(marked);
    const correct = (c: number) => {
        const expected = truth.correctDirectionsAt(c);
        const actual = given(c) ? board.mainTrack.portsAt(c) : board.linksAt(c);
        return expected !== null && actual.length === 2 && expected.every(d => actual.includes(d));
    };
    const hint = (rule: TrackHint['rule'], action: TrackHint['action'], targets: number[], lifted: number[], text: string, directions: readonly Direction[] = []): TrackHint => Object.freeze({
        rule, action, targets: Object.freeze([...targets]), lifted: Object.freeze([...new Set(lifted)]),
        directions: Object.freeze([...directions]), text, error: rule === 'A0' || rule === 'B1-wrong',
    });
    if (phaseB) {
        const previews = cells.filter(c => !given(c) && board.stateAt(c) === S.TrackPreview);
        for (const c of previews) {
            // The original B1 requires an actual incoming correct port, not mere proximity.
            if (!ALL_DIRECTIONS.some(d => {
                const n = near(c, d);
                return n !== null && track(n) && correct(n)
                    && (given(n) ? board.mainTrack.portsAt(n) : board.linksAt(n)).includes(oppositeOf(d));
            })) continue;
            const dirs = truth.correctDirectionsAt(c);
            if (dirs) return hint('B1-preview', 'shape', [c], [c, ...marks(c)],
                'Đường ray phải nối với các ô liền kề, nên hướng của nó đã rõ', dirs);
        }
        // No invented fallback that changes a shaped track while previews still remain.
        if (previews.length) return null;
        for (const c of cells) if (!given(c) && track(c) && !correct(c)) {
            const dirs = truth.correctDirectionsAt(c);
            if (dirs) return hint('B1-wrong', 'shape', [c], [c], 'Đường ray này đang hướng sai.', dirs);
        }
        return null;
    }
    for (const c of cells) if (board.stateAt(c) === S.X && truth.isSolutionCell(c))
        return hint('A0', 'removeX', [c], [c], 'Ô này đã bị đánh dấu sai.');
    for (const c of cells.filter(given)) for (const d of board.mainTrack.portsAt(c)) {
        const n = near(c, d);
        if (n !== null && empty(n)) return hint('A1', 'preview', [n], [c, n], 'Đường ray phải nối vào đây, nên ô này là đường ray');
    }
    const lines = [
        ...Array.from({ length: height }, (_, row) => cells.filter(c => Math.floor(c / width) === row)),
        ...Array.from({ length: width }, (_, col) => cells.filter(c => c % width === col)),
    ];
    const clue = (line: number[]) => line.filter(c => truth.isSolutionCell(c)).length;
    for (const line of lines) {
        const targets = line.filter(empty);
        if (targets.length && line.filter(track).length === clue(line))
            return hint('A2', 'markX', targets, line, 'Hàng đã đạt con số, nên các ô còn lại không thể là đường ray.');
    }
    // Givens have fixed ports, handled by A1; never infer additional ports for them.
    for (const c of cells.filter(c => track(c) && !given(c))) {
        const dirs = open(c);
        if (dirs.length !== 2) continue;
        const ns = dirs.map(d => near(c, d)!);
        if (!ns.some(track)) continue;
        const target = ns.find(empty);
        if (target !== undefined) return hint('A3', 'preview', [target], [c, ...marks(c), target], 'Mọi hướng khác đều bị chặn, nên đường ray phải nối vào đây.');
    }
    for (const line of lines) {
        const targets = line.filter(empty);
        // RedX is also a locked non-track mark; never a remaining candidate.
        if (targets.length && line.filter(c => !marked(c)).length === clue(line))
            return hint('A4', 'preview', targets, line, 'Để đạt con số của hàng, các ô còn lại phải là đường ray.');
    }
    for (const c of cells.filter(empty)) if (open(c).length === 1)
        return hint('A5', 'markX', [c], [c, ...marks(c)], 'Ô này chỉ có một kết nối nên không thể là đường ray.');
    for (const line of lines) {
        if (clue(line) - line.filter(track).length !== 1) continue;
        for (const c of line.filter(empty)) {
            const dirs = open(c);
            if (dirs.length === 2 && dirs.some(d => {
                const n = near(c, d)!;
                return line.includes(n) && empty(n);
            })) return hint('A6', 'markX', [c], line,
                'đường ray ở đây phải nối với 1 đường ray khác trong hàng/ cột. Điều đó sẽ vượt quá con số nên không thể là đường ray');
        }
    }
    // A7 intentionally skipped by user. A8 uses Application's existing Place Track selection.
    return fallback === null ? null : hint('A8', 'preview', [fallback], [fallback], '');
}
