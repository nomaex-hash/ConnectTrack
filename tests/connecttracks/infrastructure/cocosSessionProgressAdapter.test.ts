import { beforeEach, describe, expect, it, vi } from 'vitest';
const storage = vi.hoisted(() => {
    const records = new Map<string, string>();
    return { records, getItem: vi.fn((key: string) => records.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { records.set(key, value); }),
        removeItem: vi.fn((key: string) => { records.delete(key); }) };
});
vi.mock('cc', () => ({ sys: { localStorage: storage }, warn: vi.fn() }));
import { CocosSessionProgressAdapter } from '../../../assets/scripts/infrastructure/persistence/cocosSessionProgressAdapter';
import { GameSession } from '../../../assets/scripts/application/session/gameSession';
import { TEST_LEVEL } from '../domain/fixtures';

beforeEach(() => { storage.records.clear(); vi.clearAllMocks(); });
describe('local board saves', () => {
    it('persists between adapter instances, isolates context/level, and leaves legacy saves alone', () => {
        const adapter = new CocosSessionProgressAdapter();
        const data = new GameSession({ level: TEST_LEVEL, requiredCells: [1, 2, 5] }).exportProgress()!;
        storage.records.set('dogdoku_save_data', 'legacy');
        adapter.write('campaign:18:', data);
        const reopened = new CocosSessionProgressAdapter();
        expect(reopened.read('campaign:18:')).toEqual(data);
        expect(reopened.read('daily:18:2026-10-09')).toBeNull();
        expect(reopened.read('campaign:19:')).toBeNull();
        reopened.remove('campaign:18:');
        expect(reopened.read('campaign:18:')).toBeNull();
        expect(storage.records.get('dogdoku_save_data')).toBe('legacy');
    });
    it('handles corrupt JSON and unavailable storage without crashing gameplay', () => {
        const adapter = new CocosSessionProgressAdapter();
        storage.records.set('connecttracks:session:v1:x', '{bad');
        expect(adapter.read('x')).toBeNull();
        storage.getItem.mockImplementationOnce(() => { throw Error('denied'); });
        expect(adapter.read('x')).toBeNull();
        storage.setItem.mockImplementationOnce(() => { throw Error('quota'); });
        expect(() => adapter.write('x', {} as any)).not.toThrow();
    });
});
