import { Direction, isDirection } from '../board/direction';
import { BoardSize, isIndexInBounds, neighborIndex } from '../board/cellIndex';
import { directionBetween } from '../board/adjacency';

/**
 * Validated, immutable level data.
 *
 * Field mapping from level JSON (w, h, s, g, a, b):
 *   width / height   <- w / h
 *   solutionPath     <- s   (ordered cell indices)
 *   given            <- g   (pre-filled solution cells, CONFIRMED-BY-USER: every cell in g lies on
 *                            s, and g always contains s[0] and s[-1]. A given cell is rendered as a
 *                            completed Player Track from level start and is locked — same as a Main
 *                            Track cell — and is not a required cell for Win.)
 *   outwardStart     <- a   (outward direction at s[0])
 *   outwardEnd       <- b   (outward direction at s[-1])
 */
export interface LevelData {
    readonly size: BoardSize;
    readonly solutionPath: readonly number[];
    readonly given: readonly number[];
    readonly outwardStart: Direction;
    readonly outwardEnd: Direction;
}

export interface LevelDataInput {
    readonly width: number;
    readonly height: number;
    readonly solutionPath: readonly number[];
    readonly given: readonly number[];
    readonly outwardStart: number;
    readonly outwardEnd: number;
}

export class LevelDataError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LevelDataError';
    }
}

/**
 * Validates the structural invariants that the confirmed contract depends on.
 * Uniqueness of the solution is deliberately NOT checked here (not part of the confirmed contract).
 */
export function createLevelData(input: LevelDataInput): LevelData {
    const size: BoardSize = { width: input.width, height: input.height };
    if (!Number.isInteger(size.width) || size.width < 1 || !Number.isInteger(size.height) || size.height < 1) {
        throw new LevelDataError('Board width and height must be positive integers.');
    }

    const path = input.solutionPath;
    if (path.length < 2) {
        throw new LevelDataError('Solution path needs at least two cells.');
    }
    if (new Set(path).size !== path.length) {
        throw new LevelDataError('Solution path must not repeat cells.');
    }
    for (const cell of path) {
        if (!isIndexInBounds(size, cell)) {
            throw new LevelDataError(`Solution cell ${cell} is outside the board.`);
        }
    }
    for (let i = 0; i + 1 < path.length; i++) {
        if (directionBetween(size, path[i], path[i + 1]) === null) {
            throw new LevelDataError(`Solution cells ${path[i]} and ${path[i + 1]} are not adjacent.`);
        }
    }

    const pathCells = new Set(path);
    for (const cell of input.given) {
        if (!isIndexInBounds(size, cell)) {
            throw new LevelDataError(`Given cell ${cell} is outside the board.`);
        }
        if (!pathCells.has(cell)) {
            throw new LevelDataError(`Given cell ${cell} must lie on the solution path.`);
        }
    }

    const start = path[0];
    const end = path[path.length - 1];
    const givenCells = new Set(input.given);
    if (!givenCells.has(start) || !givenCells.has(end)) {
        throw new LevelDataError('Given must contain both solution path endpoints (s[0] and s[-1]).');
    }
    const outwardStart = outwardPort(size, start, input.outwardStart, 'a');
    const outwardEnd = outwardPort(size, end, input.outwardEnd, 'b');

    return Object.freeze({
        size: Object.freeze(size),
        solutionPath: Object.freeze(path.slice()),
        given: Object.freeze(input.given.slice()),
        outwardStart,
        outwardEnd,
    });
}

function outwardPort(size: BoardSize, cell: number, value: number, label: string): Direction {
    if (!isDirection(value)) {
        throw new LevelDataError(`${label} must be a single direction bitmask (1, 2, 4 or 8).`);
    }
    if (neighborIndex(size, cell, value) !== null) {
        throw new LevelDataError(`${label} must point outward from the board border.`);
    }
    return value;
}
