import { Board } from '../board/board';
import { PlayerCellState } from '../board/playerCellState';
import { connectionCount } from '../board/connections';
import { neighborIndex } from '../board/cellIndex';
import { oppositeOf } from '../board/direction';
import { SolutionTruth } from '../level/solutionTruth';

/**
 * Degree eligibility: every required solution cell is a Track with two connections.
 * GameSession also requires hasCompleteRailPath before entering Won (user's victory-sequence contract).
 * Clues do not decide the win.
 *
 * `requiredCells` is supplied by the caller. Which cells are "required" (for example whether
 * the Main Track end cells are included) is UNKNOWN and must be decided outside this rule.
 */
export function isWon(board: Board, requiredCells: readonly number[]): boolean {
    return requiredCells.every(
        (cell) => board.stateAt(cell) === PlayerCellState.Track && connectionCount(board, cell) === 2,
    );
}

/** The victory train needs one reciprocal path covering every solution cell, including givens. */
export function hasCompleteRailPath(board: Board, truth: SolutionTruth): boolean {
    const path = truth.level.solutionPath;
    const visited = new Set<number>();
    let cell = path[0];
    let enteredFrom = truth.level.outwardStart;
    while (!visited.has(cell)) {
        if (!truth.isSolutionCell(cell)) return false;
        visited.add(cell);
        const main = board.mainTrack.portsAt(cell);
        const ports = main.length ? main : board.linksAt(cell);
        if (ports.length !== 2 || !ports.includes(enteredFrom)) return false;
        const leaving = ports.find(port => port !== enteredFrom)!;
        if (cell === path[path.length - 1]) {
            return leaving === truth.level.outwardEnd && visited.size === path.length;
        }
        const next = neighborIndex(board.size, cell, leaving);
        if (next === null) return false;
        enteredFrom = oppositeOf(leaving);
        cell = next;
    }
    return false;
}
