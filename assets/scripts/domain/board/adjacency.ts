import { ALL_DIRECTIONS, Direction } from './direction';
import { BoardSize, neighborIndex } from './cellIndex';

/**
 * Direction that steps from `from` to the adjacent cell `to`, or null if the two cells
 * are not 4-adjacent on this board.
 */
export function directionBetween(size: BoardSize, from: number, to: number): Direction | null {
    for (const direction of ALL_DIRECTIONS) {
        if (neighborIndex(size, from, direction) === to) {
            return direction;
        }
    }
    return null;
}
