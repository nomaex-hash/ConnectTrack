import { beforeEach, describe, expect, it, vi } from 'vitest';

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('cc', () => ({ JsonAsset: class JsonAsset {}, resources: { load } }));
vi.mock('../../../assets/scripts/infrastructure/content/levelRecordMapper', { spy: true });

import { CocosLevelDataAdapter } from '../../../assets/scripts/infrastructure/content/cocosLevelDataAdapter';
import { levelFromRecord } from '../../../assets/scripts/infrastructure/content/levelRecordMapper';
import { JsonAsset } from 'cc';

/** Same shape levelIndex.json/Level/*.json use; a small in-test fixture, not the real project data. */
const INDEX = { '0': { stageLevelId: 12345, file: 'level_test' } };
const RECORD = { w: 3, h: 3, s: [0, 1, 2, 5, 8], g: [0, 8], a: 8, b: 4 };
const BATCH = { '12345': RECORD };

const adapter = new CocosLevelDataAdapter();
type Completion = (error: Error | null, asset: { json: unknown } | null) => void;

/** Responds to resources.load based on the requested path, like the two real resources would. */
function respondByPath(byPath: Record<string, { json: unknown } | Error>): void {
    load.mockImplementation((path: string, _type: unknown, done: Completion) => {
        const outcome = byPath[path];
        queueMicrotask(() => {
            if (outcome instanceof Error) {
                done(outcome, null);
            } else if (outcome) {
                done(null, outcome);
            } else {
                done(new Error(`Unexpected resource path in test: ${path}`), null);
            }
        });
    });
}

beforeEach(() => { vi.clearAllMocks(); load.mockReset(); });

describe('Cocos level data adapter (index + batch file)', () => {
    it('loads the index, then the matching batch file, and passes the record to the mapper', async () => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': { json: BATCH },
        });
        const level = await adapter.loadLevel('0');
        expect(load).toHaveBeenCalledWith('ConnectTrackData/levelIndex', JsonAsset, expect.any(Function));
        expect(load).toHaveBeenCalledWith('ConnectTrackData/Level/level_test', JsonAsset, expect.any(Function));
        expect(levelFromRecord).toHaveBeenCalledTimes(1);
        expect(vi.mocked(levelFromRecord).mock.calls[0][0]).toBe(RECORD);
        expect(level.size).toEqual({ width: 3, height: 3 });
        expect(level.solutionPath).toEqual([0, 1, 2, 5, 8]);
        expect(Object.isFrozen(level)).toBe(true);
    });

    it('rejects an id that is not in the index, without loading a batch file', async () => {
        respondByPath({ 'ConnectTrackData/levelIndex': { json: INDEX } });
        await expect(adapter.loadLevel('999')).rejects.toThrow('Unknown ConnectTracks level id: 999');
        expect(load).toHaveBeenCalledTimes(1);
        expect(levelFromRecord).not.toHaveBeenCalled();
    });

    it('rejects a stage id missing from its batch file', async () => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': { json: {} },
        });
        await expect(adapter.loadLevel('0')).rejects.toThrow('not found in level_test.json');
        expect(levelFromRecord).not.toHaveBeenCalled();
    });

    it.each([null, 'invalid', [1, 2, 3]])('rejects a malformed index payload: %j', async (payload) => {
        respondByPath({ 'ConnectTrackData/levelIndex': { json: payload } });
        await expect(adapter.loadLevel('0')).rejects.toThrow();
    });

    it('rejects a malformed index entry (wrong shape)', async () => {
        respondByPath({ 'ConnectTrackData/levelIndex': { json: { '0': { stageLevelId: '12345' } } } });
        await expect(adapter.loadLevel('0')).rejects.toThrow('Unknown ConnectTracks level id: 0');
    });

    it.each([null, 'invalid', [1, 2, 3]])('rejects a malformed batch payload: %j', async (payload) => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': { json: payload },
        });
        await expect(adapter.loadLevel('0')).rejects.toThrow();
    });

    it('propagates an index load failure without loading a batch file', async () => {
        const failure = new Error('Missing resource');
        respondByPath({ 'ConnectTrackData/levelIndex': failure });
        await expect(adapter.loadLevel('0')).rejects.toBe(failure);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('propagates a batch file load failure', async () => {
        const failure = new Error('Missing resource');
        respondByPath({ 'ConnectTrackData/levelIndex': { json: INDEX }, 'ConnectTrackData/Level/level_test': failure });
        await expect(adapter.loadLevel('0')).rejects.toBe(failure);
    });

    it('rejects a geometrically invalid level record', async () => {
        respondByPath({
            'ConnectTrackData/levelIndex': { json: INDEX },
            'ConnectTrackData/Level/level_test': { json: { '12345': { ...RECORD, s: [0, 8] } } },
        });
        await expect(adapter.loadLevel('0')).rejects.toThrow();
    });
});
