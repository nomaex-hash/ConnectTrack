import { CellState } from '../../core/CellState';
import { Hint, HintAction, HintKind } from '../../core/Hint';
import { BoardSystem } from '../board/BoardSystem';

type LineAxis = 'row' | 'col';


export class HintSystem {
    constructor(private readonly solution: readonly number[]) {}

    getHint(board: BoardSystem): Hint | null {
        return (
            this.findMisplacedMark(board) ??
            this.findSingleCandidate(board) ??
            this.findColorsLockedInLines(board, 1) ??
            this.findColorsLockedInLines(board, 2) ??
            this.findColorsLockedInLines(board, 3) ??
            this.findFullLineColor(board) ??
            this.findContradiction(board) ??
            this.findRandomReveal(board)
        );
    }

    private findMisplacedMark(board: BoardSystem): Hint | null {
        for (const cell of this.solution) {
            if (board.getState(cell) !== CellState.Mark) continue;

            return {
                kind: HintKind.MisplacedMark,
                action: HintAction.ClearMark,
                targetCells: [cell],
                highlightCells: [cell],
                regionIds: [board.regionOf(cell)],
            };
        }
        return null;
    }


    private findSingleCandidate(board: BoardSystem): Hint | null {
        for (const dog of board.getDogCells()) {
            const zone = this.lineAndNeighborCells(board, dog);
            const targetCells = zone.filter((cell) => board.getState(cell) === CellState.Empty);
            if (targetCells.length === 0) continue;

            return {
                kind: HintKind.SingleCandidate,
                action: HintAction.MarkCells,
                targetCells,
                highlightCells: [dog, ...zone],
                regionIds: [board.regionOf(dog)],
            };
        }

        const candidates = this.computeCandidates(board);
        const cellsByRegion = groupBy(candidates, (cell) => board.regionOf(cell));

        let best: number | null = null;
        for (const [, cells] of cellsByRegion) {
            if (cells.length !== 1) continue;
            const cell = cells[0]!;
 
            if (best === null || this.isEarlierInReadingOrder(board, cell, best)) best = cell;
        }
        if (best === null) return null;

        return {
            kind: HintKind.SingleCandidate,
            action: HintAction.PlaceDog,
            targetCells: [best],
            highlightCells: [best],
            handAnchorCell: best,
            regionIds: [board.regionOf(best)],
        };
    }


    private findColorsLockedInLines(board: BoardSystem, n: number): Hint | null {
        return this.tryColorsLockedInLines(board, n, 'row') ?? this.tryColorsLockedInLines(board, n, 'col');
    }

    private tryColorsLockedInLines(board: BoardSystem, n: number, axis: LineAxis): Hint | null {
        const candidates = this.computeCandidates(board);
        const cellsByRegion = groupBy(candidates, (cell) => board.regionOf(cell));
        const regions = Array.from(cellsByRegion.keys()).sort((a, b) => a - b);
        if (regions.length < n) return null;

        const lineOf = (cell: number): number => (axis === 'row' ? board.rowOf(cell) : board.colOf(cell));

        for (const combo of combinations(regions, n)) {
            const lines = new Set<number>();
            for (const region of combo) {
                for (const cell of cellsByRegion.get(region)!) lines.add(lineOf(cell));
            }
            if (lines.size !== n) continue;

            const comboSet = new Set(combo);
            const targetCells: number[] = [];
            const highlightCells: number[] = [];

            for (let cell = 0; cell < board.cellCount; cell++) {
                if (!lines.has(lineOf(cell))) continue;
                highlightCells.push(cell);

                if (comboSet.has(board.regionOf(cell))) continue;
                if (board.getState(cell) === CellState.Empty) targetCells.push(cell);
            }

            if (targetCells.length > 0) {
                return {
                    kind: HintKind.ColorsLockedInLines,
                    action: HintAction.MarkCells,
                    targetCells,
                    highlightCells,
                    regionIds: combo,
                    lines: Array.from(lines)
                        .sort((a, b) => a - b)
                        .map((index) => ({ axis, index })),
                };
            }
        }
        return null;
    }


    private findFullLineColor(board: BoardSystem): Hint | null {
        return this.tryFullLineColor(board, 'row') ?? this.tryFullLineColor(board, 'col');
    }

    private tryFullLineColor(board: BoardSystem, axis: LineAxis): Hint | null {
        const size = board.size;
        const dogRegions = new Set(board.getDogCells().map((cell) => board.regionOf(cell)));

        for (let line = 0; line < size; line++) {
            const cellsInLine = this.cellsOfLine(board, axis, line);
            const region = board.regionOf(cellsInLine[0]!);
            const uniform = cellsInLine.every((cell) => board.regionOf(cell) === region);
            if (!uniform) continue;
            if (dogRegions.has(region)) continue;

            const lineSet = new Set(cellsInLine);
            const targetCells: number[] = [];
            for (let cell = 0; cell < board.cellCount; cell++) {
                if (board.regionOf(cell) !== region) continue;
                if (lineSet.has(cell)) continue;
                if (board.getState(cell) === CellState.Empty) targetCells.push(cell);
            }
            if (targetCells.length === 0) continue;

            return {
                kind: HintKind.FullLineColor,
                action: HintAction.MarkCells,
                targetCells,
                highlightCells: [...cellsInLine, ...targetCells],
                regionIds: [region],
                lines: [{ axis, index: line }],
            };
        }
        return null;
    }

   
    private findContradiction(board: BoardSystem): Hint | null {
        const candidates = this.computeCandidates(board);

        // Gom theo màu NẠN NHÂN (region bị loại hết ứng viên) — mỗi màu có thể có 1 hoặc NHIỀU ô
        // "thủ phạm" (đặt thử vào đó đều gây mâu thuẫn cho màu này). HintController cần biết CHÍNH
        // XÁC số thủ phạm của 1 màu để chọn sprite mèo (đúng 1) hay sprite X (nhiều hơn 1), nên
        // không thể gộp chung nhiều màu bị loại bởi CÙNG 1 thủ phạm như bản cũ — mỗi hint giờ chỉ
        // nhắm vào ĐÚNG 1 màu nạn nhân.
        const culpritsByVictimRegion = new Map<number, number[]>();
        for (const trial of candidates) {
            for (const victimRegion of this.findEliminatedRegions(board, candidates, trial)) {
                const list = culpritsByVictimRegion.get(victimRegion);
                if (list) list.push(trial);
                else culpritsByVictimRegion.set(victimRegion, [trial]);
            }
        }
        if (culpritsByVictimRegion.size === 0) return null;

        const victimRegions = Array.from(culpritsByVictimRegion.keys());
        const victimRegion = victimRegions[Math.floor(Math.random() * victimRegions.length)]!;
        const culprits = culpritsByVictimRegion.get(victimRegion)!;
        const victimCandidates = candidates.filter((cell) => board.regionOf(cell) === victimRegion);

        return {
            kind: HintKind.Contradiction,
            action: HintAction.MarkCells,
            targetCells: culprits,
            highlightCells: [...culprits, ...victimCandidates],
            // Ô ứng viên CÒN LẠI của màu nạn nhân — chỉ minh hoạ, không nằm trong targetCells (xem
            // core/Hint.ts để biết HintController render khác nhau tuỳ culprits.length).
            eliminatedCandidateCells: victimCandidates,
            regionIds: [victimRegion],
        };
    }

    /** Trả về DANH SÁCH màu (có thể nhiều hơn 1) sẽ mất HẾT ứng viên nếu đặt thử `trial` làm chó —
     * rỗng nếu đặt thử không gây mâu thuẫn gì. */
    private findEliminatedRegions(board: BoardSystem, candidates: readonly number[], trial: number): number[] {
        const trialRow = board.rowOf(trial);
        const trialCol = board.colOf(trial);
        const trialRegion = board.regionOf(trial);

        const eliminatedByTrial = (cell: number): boolean => {
            if (cell === trial) return true;
            const row = board.rowOf(cell);
            const col = board.colOf(cell);
            if (row === trialRow || col === trialCol || board.regionOf(cell) === trialRegion) return true;
            return Math.abs(row - trialRow) <= 1 && Math.abs(col - trialCol) <= 1;
        };

        const survivingRegions = new Set<number>();
        const affectedRegions = new Set<number>();
        for (const cell of candidates) {
            const region = board.regionOf(cell);
            if (region === trialRegion) continue;
            affectedRegions.add(region);
            if (!eliminatedByTrial(cell)) survivingRegions.add(region);
        }

        const eliminatedRegions: number[] = [];
        for (const region of affectedRegions) {
            if (!survivingRegions.has(region)) eliminatedRegions.push(region);
        }
        return eliminatedRegions;
    }

    private findRandomReveal(board: BoardSystem): Hint | null {
        const remaining = this.solution.filter((cell) => board.getState(cell) !== CellState.Dog);
        if (remaining.length === 0) return null;

        const cell = remaining[Math.floor(Math.random() * remaining.length)]!;
        return {
            kind: HintKind.RandomReveal,
            action: HintAction.PlaceDog,
            targetCells: [cell],
            highlightCells: [cell],
            handAnchorCell: cell,
            regionIds: [board.regionOf(cell)],
        };
    }

 
    private computeCandidates(board: BoardSystem): number[] {
        const dogs = board.getDogCells();
        const dogRows = new Set(dogs.map((cell) => board.rowOf(cell)));
        const dogCols = new Set(dogs.map((cell) => board.colOf(cell)));
        const dogRegions = new Set(dogs.map((cell) => board.regionOf(cell)));

        const result: number[] = [];
        for (let cell = 0; cell < board.cellCount; cell++) {
            if (board.getState(cell) !== CellState.Empty) continue;

            const row = board.rowOf(cell);
            const col = board.colOf(cell);
            if (dogRows.has(row) || dogCols.has(col) || dogRegions.has(board.regionOf(cell))) continue;

            let touchesDog = false;
            for (const dog of dogs) {
                if (Math.abs(board.rowOf(dog) - row) <= 1 && Math.abs(board.colOf(dog) - col) <= 1) {
                    touchesDog = true;
                    break;
                }
            }
            if (touchesDog) continue;

            result.push(cell);
        }
        return result;
    }

 
    private isEarlierInReadingOrder(board: BoardSystem, a: number, b: number): boolean {
        const rowA = board.rowOf(a);
        const rowB = board.rowOf(b);
        if (rowA !== rowB) return rowA < rowB;
        return board.colOf(a) < board.colOf(b);
    }

    private lineAndNeighborCells(board: BoardSystem, cell: number): number[] {
        const row = board.rowOf(cell);
        const col = board.colOf(cell);
        const result = new Set<number>();

        for (let other = 0; other < board.cellCount; other++) {
            if (other === cell) continue;
            const otherRow = board.rowOf(other);
            const otherCol = board.colOf(other);
            const sameLine = otherRow === row || otherCol === col;
            const adjacent = Math.abs(otherRow - row) <= 1 && Math.abs(otherCol - col) <= 1;
            if (sameLine || adjacent) result.add(other);
        }
        return Array.from(result);
    }

    private cellsOfLine(board: BoardSystem, axis: LineAxis, line: number): number[] {
        const result: number[] = [];
        for (let cell = 0; cell < board.cellCount; cell++) {
            const index = axis === 'row' ? board.rowOf(cell) : board.colOf(cell);
            if (index === line) result.push(cell);
        }
        return result;
    }
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>();
    for (const item of items) {
        const key = keyOf(item);
        const list = map.get(key);
        if (list) list.push(item);
        else map.set(key, [item]);
    }
    return map;
}

function* combinations<T>(items: readonly T[], k: number): Generator<T[]> {
    if (k === 0) {
        yield [];
        return;
    }
    for (let i = 0; i <= items.length - k; i++) {
        for (const rest of combinations(items.slice(i + 1), k - 1)) {
            yield [items[i]!, ...rest];
        }
    }
}