import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => {
    const records = new Map<string, string>();
    return {
        records,
        getItem: vi.fn((key: string) => records.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => { records.set(key, value); }),
        removeItem: vi.fn((key: string) => { records.delete(key); }),
    };
});
vi.mock('cc', () => ({ sys: { localStorage: storage }, warn: vi.fn() }));

const MERGED_KEY = 'connecttracks:save:v1';
const PLAYER_KEY = 'dogdoku_save_data';
const CONFIG_KEY = 'MagicSort';

import { ConnectTracksLocalStore } from '../../../assets/scripts/infrastructure/persistence/connectTracksLocalStore';

/** Mỗi test cần 1 instance mới (store cache document trong bộ nhớ, migration chạy ở lần load đầu). */
async function freshStore() {
    return new ConnectTracksLocalStore();
}
const storedDoc = () => JSON.parse(storage.records.get(MERGED_KEY)!);

beforeEach(() => { storage.records.clear(); vi.clearAllMocks(); });

describe('connectTracksLocalStore — gộp về 1 key', () => {
    it('máy mới: chỉ tạo đúng 1 key, kể cả khi ghi save người chơi + config + session', async () => {
        const store = await freshStore();
        expect(store.readPlayerSave()).toBeNull();
        expect(store.readLegacyConfig()).toBeNull();
        store.writePlayerSave('{"version":1}');
        store.writeLegacyConfig('{"iap":1}');
        store.writeSession('campaign:1:', { a: 1 });
        store.writePlaceTrackCharges(3);
        expect([...storage.records.keys()]).toEqual([MERGED_KEY]);
        expect(store.readPlayerSave()).toBe('{"version":1}');
        expect(store.readLegacyConfig()).toBe('{"iap":1}');
        expect(store.readSession('campaign:1:')).toEqual({ a: 1 });
        expect(store.readPlaceTrackCharges()).toBe(3);
    });

    it('migrate 2 key cũ: giữ NGUYÊN VĂN từng byte, giữ session/Place Track có sẵn, rồi xoá key cũ', async () => {
        const player = '{"version":1,"playerData":{"progress":"é ✓ \\"x\\""}}';
        const config = '{"iap":"#1792632989","gars":"1_1"}';
        storage.records.set(PLAYER_KEY, player);
        storage.records.set(CONFIG_KEY, config);
        storage.records.set(MERGED_KEY, JSON.stringify({ version: 1, placeTrackCharges: 7, sessions: { 'campaign:2:': { b: 2 } } }));

        const store = await freshStore();
        expect(store.readPlayerSave()).toBe(player);
        expect(store.readLegacyConfig()).toBe(config);
        expect(store.readPlaceTrackCharges()).toBe(7);
        expect(store.readSession('campaign:2:')).toEqual({ b: 2 });
        expect([...storage.records.keys()]).toEqual([MERGED_KEY]);
        expect(storedDoc().player).toBe(player);
        expect(storedDoc().legacyConfig).toBe(config);
    });

    it('chạy lại lần mở sau: không mất dữ liệu, không tạo lại key cũ, idempotent', async () => {
        storage.records.set(PLAYER_KEY, '{"p":1}');
        const first = await freshStore();
        first.readPlayerSave();
        const second = await freshStore();
        expect(second.readPlayerSave()).toBe('{"p":1}');
        expect([...storage.records.keys()]).toEqual([MERGED_KEY]);
    });

    it('KHÔNG ghi đè: document mới đã có player thì key cũ khác nội dung bị giữ lại, dữ liệu mới thắng', async () => {
        storage.records.set(MERGED_KEY, JSON.stringify({ version: 1, sessions: {}, player: 'NEW' }));
        storage.records.set(PLAYER_KEY, 'OLD');
        const store = await freshStore();
        expect(store.readPlayerSave()).toBe('NEW');
        expect(storage.records.get(PLAYER_KEY)).toBe('OLD');
        expect(storedDoc().player).toBe('NEW');
    });

    it('key cũ giống hệt dữ liệu đã có thì được dọn', async () => {
        storage.records.set(MERGED_KEY, JSON.stringify({ version: 1, sessions: {}, player: 'SAME' }));
        storage.records.set(PLAYER_KEY, 'SAME');
        const store = await freshStore();
        expect(store.readPlayerSave()).toBe('SAME');
        expect(storage.records.has(PLAYER_KEY)).toBe(false);
    });

    it('ghi document mới thất bại (hết quota): KHÔNG xoá key cũ, dữ liệu vẫn đọc được', async () => {
        storage.records.set(PLAYER_KEY, 'OLD');
        storage.setItem.mockImplementation(() => { throw new Error('quota'); });
        const store = await freshStore();
        expect(store.readPlayerSave()).toBe('OLD');
        expect(storage.records.get(PLAYER_KEY)).toBe('OLD');
        expect(storage.records.has(MERGED_KEY)).toBe(false);
    });

    it('ghi xong nhưng đọc lại không khớp: KHÔNG xoá key cũ', async () => {
        storage.records.set(PLAYER_KEY, 'OLD');
        storage.setItem.mockImplementation((key: string, value: string) => {
            storage.records.set(key, key === MERGED_KEY ? JSON.stringify({ version: 1, sessions: {}, player: 'CORRUPT' }) : value);
        });
        const store = await freshStore();
        store.readPlayerSave();
        expect(storage.records.get(PLAYER_KEY)).toBe('OLD');
    });

    it('writePlayerSave ném lỗi khi storage từ chối (để SaveManager log được)', async () => {
        const store = await freshStore();
        storage.setItem.mockImplementationOnce(() => { throw new Error('denied'); });
        expect(() => store.writePlayerSave('x')).toThrow();
    });

    it('document mới bị hỏng JSON: bắt đầu lại sạch nhưng vẫn migrate được key cũ', async () => {
        storage.records.set(MERGED_KEY, '{bad');
        storage.records.set(PLAYER_KEY, 'OLD');
        const store = await freshStore();
        expect(store.readPlayerSave()).toBe('OLD');
    });
});
