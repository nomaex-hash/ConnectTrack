import { Direction } from './direction';
import { neighborIndex } from './cellIndex';
import { Board } from './board';

/**
 * Directions a cell offers: its player links plus its fixed Main Track ports.
 */
export function offeredDirections(board: Board, index: number): readonly Direction[] {
    const offered = new Set<Direction>(board.linksAt(index).concat(board.mainTrack.portsAt(index)));
    return Array.from(offered);
}

/**
 * Directions along which a connection exists. A connection exists as soon as the cell offers a
 * direction that leads to a neighbour on the board. The Main Track's outward port leads off the
 * board, so it is not a connection.
 */
export function connectedDirections(board: Board, index: number): readonly Direction[] {
    return offeredDirections(board, index).filter(
        (direction) => neighborIndex(board.size, index, direction) !== null,
    );
}

export function connectionCount(board: Board, index: number): number {
    return connectedDirections(board, index).length;
}
