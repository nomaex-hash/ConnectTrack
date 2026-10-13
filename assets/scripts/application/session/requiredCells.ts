import { LevelData } from '../../domain/level/levelData';

/**
 * Every solution cell except the given (pre-filled, locked) ones — CONFIRMED-BY-USER: a given cell
 * (level data's `g`, which always includes s[0]/s[-1] and may include more) is already shown as a
 * completed Player Track from level start, so it is not something the player still has to achieve.
 */
export function requiredCellsFor(level: LevelData): readonly number[] {
    const given = new Set(level.given);
    return level.solutionPath.filter((cell) => !given.has(cell));
}
