import { BoardGroup, BoardGroupKind, WrongReason, AdjacencyConflict } from '../../core/BoardGroup';
import { BoardSystem } from '../board/BoardSystem';


export class PlacementCheck {
    private readonly solutionSet: ReadonlySet<number>;

    constructor(solution: readonly number[]) {
        this.solutionSet = new Set(solution);
    }

    isCorrectCell(cell: number): boolean {
        return this.solutionSet.has(cell);
    }

   
    explainWrong(board: BoardSystem, cell: number): WrongReason {
        const groups: BoardGroup[] = [];
        const adjacent: AdjacencyConflict[] = [];

        const row = board.rowOf(cell);
        const col = board.colOf(cell);
        const region = board.regionOf(cell);

        for (const dogCell of board.getDogCells()) {
            const dogRow = board.rowOf(dogCell);
            const dogCol = board.colOf(dogCell);

            if (dogRow === row) {
                groups.push({ kind: BoardGroupKind.Row, index: row });
            }
            if (dogCol === col) {
                groups.push({ kind: BoardGroupKind.Column, index: col });
            }
            if (board.regionOf(dogCell) === region) {
                groups.push({ kind: BoardGroupKind.Region, index: region });
            }
            if (Math.abs(dogRow - row) <= 1 && Math.abs(dogCol - col) <= 1) {
                adjacent.push({ cell: dogCell });
            }
        }

        return { groups: dedupe(groups), adjacent };
    }
}

function dedupe(groups: readonly BoardGroup[]): BoardGroup[] {
    const seen = new Set<string>();
    const result: BoardGroup[] = [];
    for (const group of groups) {
        const key = `${group.kind}:${group.index}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(group);
    }
    return result;
}
