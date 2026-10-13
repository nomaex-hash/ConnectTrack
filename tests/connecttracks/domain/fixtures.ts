import { Direction } from '../../../assets/scripts/domain/board/direction';
import { Board } from '../../../assets/scripts/domain/board/board';
import { createLevelData, LevelData } from '../../../assets/scripts/domain/level/levelData';
import { SolutionTruth, createSolutionTruth } from '../../../assets/scripts/domain/level/solutionTruth';

/**
 * Hand-made 3x3 level for Domain tests. Not a shipped level.
 *
 *   0  1  2      solution path: 0 -> 1 -> 2 -> 5 -> 8
 *   3  4  5      a = Left  (outward at s[0] = 0)
 *   6  7  8      b = Down  (outward at s[-1] = 8)
 *
 * Main Track ports: cell 0 = [Left, Right], cell 8 = [Down, Up].
 */
export const TEST_LEVEL: LevelData = createLevelData({
    width: 3,
    height: 3,
    solutionPath: [0, 1, 2, 5, 8],
    given: [0, 8], // Just the two endpoints: g always contains s[0]/s[-1], confirmed-by-user.
    outwardStart: Direction.Left,
    outwardEnd: Direction.Down,
});

/**
 * Same board as TEST_LEVEL, but with an extra PRE-FILLED given cell (2, the middle of the path) —
 * for tests covering a given cell that isn't a board-edge endpoint (locked, shown as a completed
 * Player Track from the start, not a required Win cell).
 */
export const TEST_LEVEL_WITH_MIDDLE_GIVEN: LevelData = createLevelData({
    width: 3,
    height: 3,
    solutionPath: [0, 1, 2, 5, 8],
    given: [0, 2, 8],
    outwardStart: Direction.Left,
    outwardEnd: Direction.Down,
});

export function truthForTestLevel(): SolutionTruth {
    return createSolutionTruth(TEST_LEVEL);
}

export function emptyBoard(): Board {
    const truth = truthForTestLevel();
    return Board.empty(TEST_LEVEL.size, truth.mainTrack);
}
