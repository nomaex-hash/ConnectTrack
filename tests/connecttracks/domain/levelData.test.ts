import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { createLevelData, LevelDataError, LevelDataInput } from '../../../assets/scripts/domain/level/levelData';

const VALID: LevelDataInput = {
    width: 3,
    height: 3,
    solutionPath: [0, 1, 2, 5, 8],
    given: [0, 2, 8], // Must always contain s[0]=0 and s[-1]=8; cell 2 is an extra pre-filled cell.
    outwardStart: Direction.Left,
    outwardEnd: Direction.Down,
};

describe('createLevelData', () => {
    it('accepts a valid level and keeps the w, h, s, g, a, b values', () => {
        const level = createLevelData(VALID);
        expect(level.size).toEqual({ width: 3, height: 3 });
        expect(level.solutionPath).toEqual([0, 1, 2, 5, 8]);
        expect(level.given).toEqual([0, 2, 8]);
        expect(level.outwardStart).toBe(Direction.Left);
        expect(level.outwardEnd).toBe(Direction.Down);
    });

    it('copies its input so later mutation of the source does not change the level', () => {
        const path = [0, 1, 2, 5, 8];
        const level = createLevelData({ ...VALID, solutionPath: path });
        path.push(7);
        expect(level.solutionPath).toEqual([0, 1, 2, 5, 8]);
    });

    it('rejects a path with non-adjacent consecutive cells', () => {
        expect(() => createLevelData({ ...VALID, solutionPath: [0, 2, 5, 8] })).toThrow(LevelDataError);
    });

    it('rejects a path that repeats a cell or leaves the board', () => {
        expect(() => createLevelData({ ...VALID, solutionPath: [0, 1, 0, 3] })).toThrow(LevelDataError);
        expect(() => createLevelData({ ...VALID, solutionPath: [0, 1, 9] })).toThrow(LevelDataError);
    });

    it('rejects a path shorter than two cells', () => {
        expect(() => createLevelData({ ...VALID, solutionPath: [0] })).toThrow(LevelDataError);
    });

    it('requires a outward from s[0] to leave the board', () => {
        expect(() => createLevelData({ ...VALID, outwardStart: Direction.Right })).toThrow(LevelDataError);
    });

    it('requires b outward from s[-1] to leave the board', () => {
        expect(() => createLevelData({ ...VALID, outwardEnd: Direction.Up })).toThrow(LevelDataError);
    });

    it('rejects outward ports that are not single direction bitmasks', () => {
        expect(() => createLevelData({ ...VALID, outwardStart: 3 })).toThrow(LevelDataError);
    });

    it('rejects given cells outside the board', () => {
        expect(() => createLevelData({ ...VALID, given: [0, 8, 9] })).toThrow(LevelDataError);
    });

    it('rejects a given cell that is not on the solution path (CONFIRMED-BY-USER)', () => {
        expect(() => createLevelData({ ...VALID, given: [0, 3, 8] })).toThrow(LevelDataError);
    });

    it('rejects given when it omits s[0] or s[-1] (CONFIRMED-BY-USER: g always contains both)', () => {
        expect(() => createLevelData({ ...VALID, given: [2, 8] })).toThrow(LevelDataError);
        expect(() => createLevelData({ ...VALID, given: [0, 2] })).toThrow(LevelDataError);
        expect(() => createLevelData({ ...VALID, given: [] })).toThrow(LevelDataError);
    });
});
