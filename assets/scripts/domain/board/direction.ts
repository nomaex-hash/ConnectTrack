/**
 * Direction bitmasks, as confirmed by the ConnectTracks gameplay contract.
 * Pure data: no engine imports.
 */
export const Direction = {
    Up: 1,
    Right: 2,
    Down: 4,
    Left: 8,
} as const;

export type Direction = (typeof Direction)[keyof typeof Direction];

export const ALL_DIRECTIONS: readonly Direction[] = [
    Direction.Up,
    Direction.Right,
    Direction.Down,
    Direction.Left,
];

export interface DirectionOffset {
    readonly dx: number;
    readonly dy: number;
}

/** Up is y - 1 (row-major, y grows downward). */
const OFFSETS: Readonly<Record<Direction, DirectionOffset>> = {
    [Direction.Up]: { dx: 0, dy: -1 },
    [Direction.Right]: { dx: 1, dy: 0 },
    [Direction.Down]: { dx: 0, dy: 1 },
    [Direction.Left]: { dx: -1, dy: 0 },
};

const OPPOSITES: Readonly<Record<Direction, Direction>> = {
    [Direction.Up]: Direction.Down,
    [Direction.Right]: Direction.Left,
    [Direction.Down]: Direction.Up,
    [Direction.Left]: Direction.Right,
};

export function isDirection(value: number): value is Direction {
    return ALL_DIRECTIONS.indexOf(value as Direction) !== -1;
}

export function offsetOf(direction: Direction): DirectionOffset {
    return OFFSETS[direction];
}

export function oppositeOf(direction: Direction): Direction {
    return OPPOSITES[direction];
}

export function areOpposite(a: Direction, b: Direction): boolean {
    return OPPOSITES[a] === b;
}
