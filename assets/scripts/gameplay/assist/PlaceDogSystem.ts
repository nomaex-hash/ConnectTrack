import { CellState } from '../../core/CellState';
import { BoardSystem } from '../board/BoardSystem';

export class PlaceDogSystem {
    private _charges: number;

    constructor(
        private readonly solution: readonly number[],
        initialCharges: number,
    ) {
        this._charges = Math.max(0, initialCharges);
    }

    get charges(): number {
        return this._charges;
    }

    get hasCharge(): boolean {
        return this._charges > 0;
    }


    findNextCell(board: BoardSystem): number | null {
        let best: number | null = null;
        let bestCandidateCount = Infinity;

        for (const cell of this.solution) {
            if (board.getState(cell) === CellState.Dog) continue;

            const candidateCount = this.countUnmarkedCellsInRegion(board, board.regionOf(cell));

            if (
                best === null ||
                candidateCount < bestCandidateCount ||
                (candidateCount === bestCandidateCount && this.isEarlierInReadingOrder(board, cell, best))
            ) {
                best = cell;
                bestCandidateCount = candidateCount;
            }
        }
        return best;
    }

  
    private countUnmarkedCellsInRegion(board: BoardSystem, region: number): number {
        let count = 0;
        for (let cell = 0; cell < board.cellCount; cell++) {
            if (board.regionOf(cell) !== region) continue;
            if (board.getState(cell) === CellState.Mark) continue;
            count++;
        }
        return count;
    }

    private isEarlierInReadingOrder(board: BoardSystem, a: number, b: number): boolean {
        const rowA = board.rowOf(a);
        const rowB = board.rowOf(b);
        if (rowA !== rowB) return rowA < rowB;
        return board.colOf(a) < board.colOf(b);
    }

    consume(): number {
        if (this._charges > 0) this._charges--;
        return this._charges;
    }

    grant(amount: number): number {
        if (amount > 0) this._charges += Math.floor(amount);
        return this._charges;
    }
}