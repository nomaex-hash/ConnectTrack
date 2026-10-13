import { describe, expect, it } from 'vitest';
import { levelFromRecord, LevelRecordError } from '../../../assets/scripts/infrastructure/content/levelRecordMapper';
import { LevelDataError } from '../../../assets/scripts/domain/level/levelData';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';

/** Same shape as the test level in the Domain fixtures: 3x3, path 0 -> 1 -> 2 -> 5 -> 8. */
const VALID_RECORD = { w: 3, h: 3, s: [0, 1, 2, 5, 8], g: [0, 8], a: Direction.Left, b: Direction.Down };

describe('levelFromRecord: mapping', () => {
    it('maps w, h, s, g, a, b onto the Domain level', () => {
        const level = levelFromRecord({ ...VALID_RECORD, g: [0, 2, 8] });
        expect(level.size).toEqual({ width: 3, height: 3 });
        expect([...level.solutionPath]).toEqual([0, 1, 2, 5, 8]);
        expect([...level.given]).toEqual([0, 2, 8]);
        expect(level.outwardStart).toBe(Direction.Left);
        expect(level.outwardEnd).toBe(Direction.Down);
    });

    it('passes g through as given, without reordering or deduping it itself', () => {
        // g's own semantics (pre-filled Main Track cells) are enforced by the Domain
        // (createLevelData): every cell must lie on s, and s[0]/s[-1] must both be present.
        expect([...levelFromRecord({ ...VALID_RECORD, g: [0, 8] }).given]).toEqual([0, 8]);
    });

    it('returns a level whose path cannot be changed afterwards', () => {
        const level = levelFromRecord(VALID_RECORD);
        expect(() => (level.solutionPath as number[]).push(7)).toThrow(TypeError);
    });

    it('the mapped level can start a GameSession', () => {
        const session = new GameSession({ level: levelFromRecord(VALID_RECORD), requiredCells: [1, 2, 5] });
        expect(session.snapshot().mainTrackCells).toEqual([0, 8]);
        expect(session.snapshot().width).toBe(3);
    });
});

describe('levelFromRecord: field type errors', () => {
    it('rejects a record that is not an object', () => {
        expect(() => levelFromRecord(null)).toThrow(LevelRecordError);
        expect(() => levelFromRecord('level')).toThrow(LevelRecordError);
    });

    it('rejects a missing or non-numeric dimension', () => {
        const { w: _w, ...withoutWidth } = VALID_RECORD;
        expect(() => levelFromRecord(withoutWidth)).toThrow(LevelRecordError);
        expect(() => levelFromRecord({ ...VALID_RECORD, h: '3' })).toThrow(LevelRecordError);
        expect(() => levelFromRecord({ ...VALID_RECORD, w: Number.NaN })).toThrow(LevelRecordError);
    });

    it('rejects a solution path or given list that is not an array of finite numbers', () => {
        expect(() => levelFromRecord({ ...VALID_RECORD, s: 'path' })).toThrow(LevelRecordError);
        expect(() => levelFromRecord({ ...VALID_RECORD, s: [0, '1'] })).toThrow(LevelRecordError);
        expect(() => levelFromRecord({ ...VALID_RECORD, g: undefined })).toThrow(LevelRecordError);
    });
});

describe('levelFromRecord: geometry is validated by the Domain', () => {
    it('a non-adjacent solution path is rejected by createLevelData', () => {
        expect(() => levelFromRecord({ ...VALID_RECORD, s: [0, 2, 5, 8] })).toThrow(LevelDataError);
    });

    it('an outward port that points back onto the board is rejected', () => {
        expect(() => levelFromRecord({ ...VALID_RECORD, a: Direction.Right })).toThrow(LevelDataError);
    });

    it('an outward port that is not a single bitmask is rejected', () => {
        expect(() => levelFromRecord({ ...VALID_RECORD, b: 3 })).toThrow(LevelDataError);
    });
});
