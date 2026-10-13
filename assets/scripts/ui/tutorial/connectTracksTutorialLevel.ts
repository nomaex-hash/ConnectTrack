import { Direction } from '../../domain/board/direction';
import { createLevelData, LevelData } from '../../domain/level/levelData';
import { requiredCellsFor } from '../../application/session/requiredCells';

/**
 * Fixed 4x4 board for the ConnectTracks guided tutorial (confirmed by the user — reverse-engineered
 * from the tutorial script's screenshots and cross-checked cell-by-cell against every row/column
 * clue AND every scripted double-tap target; all match exactly, see the plan this was built from).
 *
 *    0  1  2  3
 *    4  5  6  7
 *    8  9 10 11
 *   12 13 14 15
 *
 * Path: 0 -> 1 -> 5 -> 9 -> 10 -> 14 -> 15. Given: 0 (entrance, outward Left), 5 (mid-path, no
 * arrow), 15 (exit, outward Right). Row clues: 2,1,2,2. Column clues: 1,3,2,1.
 *
 * requiredCellsFor(this) = [1, 9, 10, 14] — exactly the 3 scripted double-tap targets (1, 9, 14)
 * plus the one cell (10) the player finds unaided during the semi-free step.
 */
export const CONNECT_TRACKS_TUTORIAL_LEVEL: LevelData = createLevelData({
    width: 4,
    height: 4,
    solutionPath: [0, 1, 5, 9, 10, 14, 15],
    given: [0, 5, 15],
    outwardStart: Direction.Left,
    outwardEnd: Direction.Right,
});

export const CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS: readonly number[] = requiredCellsFor(
    CONNECT_TRACKS_TUTORIAL_LEVEL,
);
