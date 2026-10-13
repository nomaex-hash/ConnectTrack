import { createLevelData, LevelData } from '../../domain/level/levelData';

/**
 * Maps a raw level record {w, h, s, g, a, b} to validated Domain LevelData.
 *
 * This checks field types only. Geometry (bounds, adjacency, outward ports) is validated by
 * createLevelData. The meaning of `g` is UNKNOWN, so it is passed through as an opaque list.
 * Pure: no filesystem, no engine APIs. The caller supplies the record (e.g. from a JSON asset).
 */
export class LevelRecordError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LevelRecordError';
    }
}

export function levelFromRecord(record: unknown): LevelData {
    if (typeof record !== 'object' || record === null) {
        throw new LevelRecordError('Level record must be an object.');
    }
    const fields = record as Record<string, unknown>;
    return createLevelData({
        width: readNumber(fields, 'w'),
        height: readNumber(fields, 'h'),
        solutionPath: readNumberArray(fields, 's'),
        given: readNumberArray(fields, 'g'),
        outwardStart: readNumber(fields, 'a'),
        outwardEnd: readNumber(fields, 'b'),
    });
}

function isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
}

function readNumber(fields: Record<string, unknown>, key: string): number {
    const value = fields[key];
    if (!isFiniteNumber(value)) {
        throw new LevelRecordError(`Field "${key}" must be a finite number.`);
    }
    return value;
}

function readNumberArray(fields: Record<string, unknown>, key: string): number[] {
    const value = fields[key];
    if (!Array.isArray(value) || !value.every(isFiniteNumber)) {
        throw new LevelRecordError(`Field "${key}" must be an array of finite numbers.`);
    }
    return value as number[];
}
