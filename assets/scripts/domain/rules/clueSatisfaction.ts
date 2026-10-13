import { SolutionTruth } from '../level/solutionTruth';
import { Board } from '../board/board';
import { PlayerCellState } from '../board/playerCellState';

export interface ClueSatisfaction {
    readonly count: number;
    readonly required: number;
    readonly satisfied: boolean;
}

/** Row-major cell indices for one row of the board. */
export function cellsInRow(board: Board, row: number): readonly number[] {
    const cells: number[] = [];
    for (let x = 0; x < board.size.width; x++) {
        cells.push(row * board.size.width + x);
    }
    return cells;
}

/** Row-major cell indices for one column of the board. */
export function cellsInColumn(board: Board, column: number): readonly number[] {
    const cells: number[] = [];
    for (let y = 0; y < board.size.height; y++) {
        cells.push(y * board.size.width + column);
    }
    return cells;
}

/** Counts occupied solution cells, including given Tracks, previews and partial Tracks.
 * Connections and orientation do not affect clues; clues never determine Win.
 */
export function clueSatisfaction(board: Board, cells: readonly number[], truth: SolutionTruth): ClueSatisfaction {
    const targets = cells.filter((cell) => truth.isSolutionCell(cell));
    const count = targets.filter((cell) => {
        const state = board.stateAt(cell);
        return board.mainTrack.portsAt(cell).length > 0
            || state === PlayerCellState.Track
            || state === PlayerCellState.TrackPreview
            || board.linksAt(cell).length > 0;
    }).length;
    return Object.freeze({ count, required: targets.length, satisfied: count === targets.length });
}
