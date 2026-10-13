import { Direction, offsetOf } from './direction';

/** Board dimensions in cells. */
export interface BoardSize {
    readonly width: number;
    readonly height: number;
}

export interface CellCoordinate {
    readonly x: number;
    readonly y: number;
}

/** Cell index is row-major: index = y * width + x. */
export function cellCount(size: BoardSize): number {
    return size.width * size.height;
}

export function indexOf(size: BoardSize, coordinate: CellCoordinate): number {
    if (!isCoordinateInBounds(size, coordinate)) {
        throw new RangeError(`Coordinate (${coordinate.x}, ${coordinate.y}) is outside the board.`);
    }
    return coordinate.y * size.width + coordinate.x;
}

export function coordinateOf(size: BoardSize, index: number): CellCoordinate {
    if (!isIndexInBounds(size, index)) {
        throw new RangeError(`Cell index ${index} is outside the board.`);
    }
    return { x: index % size.width, y: Math.floor(index / size.width) };
}

export function isIndexInBounds(size: BoardSize, index: number): boolean {
    return Number.isInteger(index) && index >= 0 && index < cellCount(size);
}

export function isCoordinateInBounds(size: BoardSize, coordinate: CellCoordinate): boolean {
    return (
        Number.isInteger(coordinate.x) &&
        Number.isInteger(coordinate.y) &&
        coordinate.x >= 0 &&
        coordinate.x < size.width &&
        coordinate.y >= 0 &&
        coordinate.y < size.height
    );
}

/**
 * Index of the neighbour in the given direction, or null when that step leaves the board.
 * A step that leaves the board is the "border outward" case, which the contract marks invalid.
 */
export function neighborIndex(size: BoardSize, index: number, direction: Direction): number | null {
    const origin = coordinateOf(size, index);
    const offset = offsetOf(direction);
    const target = { x: origin.x + offset.dx, y: origin.y + offset.dy };
    return isCoordinateInBounds(size, target) ? indexOf(size, target) : null;
}
