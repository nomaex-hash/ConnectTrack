import { PuzzleData } from '../../assets/scripts/model/PuzzleData';

/**
 * Puzzle 4×4 thật, lấy từ Level_1.json của bộ data đã kiểm định.
 *
 *   regions:            solution: ô 2, 4, 11, 13
 *     2 2 2 2             . . D .
 *     0 3 2 3             D . . .
 *     3 3 3 3             . . . D
 *     3 1 1 3             . D . .
 */
export const PUZZLE_4X4: PuzzleData = {
    id: 1,
    size: 4,
    regions: [2, 2, 2, 2, 0, 3, 2, 3, 3, 3, 3, 3, 3, 1, 1, 3],
    solution: [2, 4, 11, 13],
    prePlacedDogs: [],
    prePlacedMarks: [],
};

/** Cùng puzzle, nhưng ô 13 là Dog đặt sẵn (khóa) — như Level_1.json thật. */
export const PUZZLE_4X4_WITH_PREPLACED: PuzzleData = {
    ...PUZZLE_4X4,
    prePlacedDogs: [13],
};

/** Cùng puzzle, thêm một Mark đặt sẵn ở ô 0 (ô 0 không nằm trong solution). */
export const PUZZLE_4X4_WITH_PREPLACED_MARK: PuzzleData = {
    ...PUZZLE_4X4,
    prePlacedMarks: [0],
};

export function makePuzzle(overrides: Partial<PuzzleData> = {}): PuzzleData {
    return { ...PUZZLE_4X4, ...overrides };
}
