import { CellState } from '../../core/CellState';
import { PuzzleData } from '../../model/PuzzleData';
import { BoardSaveData, PuzzleContext } from '../../model/BoardSaveData';


export class BoardSystem {
    readonly size: number;
    readonly regions: readonly number[];

    private readonly cells: CellState[];

   
    private readonly lockedCells: ReadonlySet<number>;

    constructor(puzzle: PuzzleData) {
        this.size = puzzle.size;
        this.regions = puzzle.regions;
        this.cells = new Array<CellState>(puzzle.size * puzzle.size).fill(CellState.Empty);

        this.lockedCells = new Set<number>(
            puzzle.prePlacedDogs.concat(puzzle.prePlacedMarks),
        );
        this.applyPrePlaced(puzzle);
    }

    get cellCount(): number {
        return this.cells.length;
    }

    private applyPrePlaced(puzzle: PuzzleData): void {
        for (const cell of puzzle.prePlacedDogs) this.cells[cell] = CellState.Dog;
        for (const cell of puzzle.prePlacedMarks) this.cells[cell] = CellState.Mark;
    }

   

    isInBounds(cell: number): boolean {
        return Number.isInteger(cell) && cell >= 0 && cell < this.cells.length;
    }

    isLocked(cell: number): boolean {
        return this.lockedCells.has(cell);
    }

    getState(cell: number): CellState {
        return this.cells[cell];
    }

    rowOf(cell: number): number {
        return Math.floor(cell / this.size);
    }

    colOf(cell: number): number {
        return cell % this.size;
    }

    regionOf(cell: number): number {
        return this.regions[cell];
    }

  
    countDogs(): number {
        let count = 0;
        for (const state of this.cells) {
            if (state === CellState.Dog) count++;
        }
        return count;
    }

  
    getDogCells(): number[] {
        const result: number[] = [];
        for (let i = 0; i < this.cells.length; i++) {
            if (this.cells[i] === CellState.Dog) result.push(i);
        }
        return result;
    }

    
    getAllStates(): readonly CellState[] {
        return this.cells.slice();
    }

 
    setState(cell: number, state: CellState): boolean {
        if (!this.isInBounds(cell)) return false;
        if (this.isLocked(cell)) return false;
        if (this.cells[cell] === state) return false;

        this.cells[cell] = state;
        return true;
    }

   
    resetToInitial(): boolean {
        let changed = false;
        for (let i = 0; i < this.cells.length; i++) {
            if (this.isLocked(i)) continue;
            if (this.cells[i] !== CellState.Empty) {
                this.cells[i] = CellState.Empty;
                changed = true;
            }
        }
        return changed;
    }

 
    createSnapshot(
        context: PuzzleContext,
        puzzleId: number,
        puzzleDate: string | null,
        mistakesRemaining: number,
        elapsedSeconds: number,
    ): BoardSaveData {
        return {
            context,
            puzzleId,
            puzzleDate,
            cellStates: this.cells.slice(),
            mistakesRemaining,
            elapsedSeconds,
        };
    }

 
    restoreFrom(snapshot: BoardSaveData): boolean {
        if (snapshot.cellStates.length !== this.cells.length) return false;

        for (const value of snapshot.cellStates) {
            if (!(value in CellState)) return false;
        }

        for (let i = 0; i < this.cells.length; i++) {
            this.cells[i] = snapshot.cellStates[i] as CellState;
        }
        return true;
    }
}
