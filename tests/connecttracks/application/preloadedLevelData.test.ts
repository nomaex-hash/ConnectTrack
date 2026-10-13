import { describe, expect, it, vi } from 'vitest';
import { PreloadedLevelData } from '../../../assets/scripts/application/session/preloadedLevelData';
import { TEST_LEVEL } from '../domain/fixtures';

describe('next level preloading', () => {
    it('loads and maps before entry, then consumes the prepared immutable level once', async () => {
        const source = { loadLevel: vi.fn(async () => TEST_LEVEL) };
        const levels = new PreloadedLevelData(source);
        await levels.preload('19');
        await levels.preload('19');
        expect(await levels.loadLevel('19')).toBe(TEST_LEVEL);
        expect(source.loadLevel).toHaveBeenCalledTimes(1);
        await levels.loadLevel('19');
        expect(source.loadLevel).toHaveBeenCalledTimes(2);
    });

    it('shares an in-flight request if the player taps next before loading finishes', async () => {
        let resolve!: (value: typeof TEST_LEVEL) => void;
        const source = { loadLevel: vi.fn(() => new Promise<typeof TEST_LEVEL>(done => { resolve = done; })) };
        const levels = new PreloadedLevelData(source);
        const warm = levels.preload('19');
        const entry = levels.loadLevel('19');
        resolve(TEST_LEVEL);
        await warm;
        expect(await entry).toBe(TEST_LEVEL);
        expect(source.loadLevel).toHaveBeenCalledTimes(1);
    });

    it('retries a failed preload on entry', async () => {
        const source = { loadLevel: vi.fn().mockRejectedValueOnce(Error('load failed')).mockResolvedValue(TEST_LEVEL) };
        const levels = new PreloadedLevelData(source);
        await expect(levels.preload('19')).rejects.toThrow('load failed');
        expect(await levels.loadLevel('19')).toBe(TEST_LEVEL);
        expect(source.loadLevel).toHaveBeenCalledTimes(2);
    });

    it('never supplies the preloaded data for a different requested id', async () => {
        const source = { loadLevel: vi.fn(async () => TEST_LEVEL) };
        const levels = new PreloadedLevelData(source);
        await levels.preload('19');
        await levels.loadLevel('18');
        expect(source.loadLevel.mock.calls).toEqual([['19'], ['18']]);
    });
});
