import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('cc', () => ({ sys: { localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined } }, warn: vi.fn() }));

import { ConnectTracksCloudSync, CloudSyncLocalStore } from '../../../assets/scripts/infrastructure/persistence/connectTracksCloudSync';
import { CloudSavePort } from '../../../assets/scripts/application/ports/cloudSavePort';

class FakeStore implements CloudSyncLocalStore {
    savedAt: number;
    snapshot: string;
    listeners: Array<() => void> = [];
    imported: string[] = [];
    constructor(savedAt: number, snapshot = '{"version":1,"sessions":{}}') {
        this.savedAt = savedAt;
        this.snapshot = snapshot;
    }
    onPersisted(listener: () => void) {
        this.listeners.push(listener);
        return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
    }
    getSavedAt() { return this.savedAt; }
    exportSnapshot() { return this.snapshot; }
    importSnapshot(json: string) { this.imported.push(json); this.snapshot = json; return true; }
    persist(snapshot: string) { this.snapshot = snapshot; this.listeners.forEach((l) => l()); }
}

function fakeCloud(initial: string | null) {
    const cloud = {
        stored: initial,
        writes: [] as string[],
        flushed: 0,
        read: vi.fn(async (): Promise<string | null> => cloud.stored),
        write: vi.fn(async (payload: string) => { cloud.writes.push(payload); cloud.stored = payload; }),
        flush: vi.fn(async () => { cloud.flushed++; }),
    };
    return cloud satisfies CloudSavePort & { stored: string | null; writes: string[]; flushed: number };
}

const doc = (savedAt: number, extra = '') => JSON.stringify({ version: 1, savedAt, sessions: {}, extra });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('ConnectTracksCloudSync.pull', () => {
    it('cloud mới hơn -> thay bản local, không đẩy lại', async () => {
        const store = new FakeStore(100);
        const cloud = fakeCloud(doc(200, 'cloud'));
        const sync = new ConnectTracksCloudSync(store, cloud);
        expect(await sync.pull()).toBe('adopted-cloud');
        expect(store.imported).toEqual([doc(200, 'cloud')]);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(cloud.writes).toEqual([]);
    });

    it('local mới hơn -> đẩy bản local lên cloud', async () => {
        const store = new FakeStore(300, doc(300, 'local'));
        const cloud = fakeCloud(doc(200, 'cloud'));
        const sync = new ConnectTracksCloudSync(store, cloud);
        expect(await sync.pull()).toBe('pushed-local');
        await vi.advanceTimersByTimeAsync(10);
        expect(cloud.writes).toEqual([doc(300, 'local')]);
        expect(store.imported).toEqual([]);
    });

    it('cloud trống + local đã có dữ liệu -> đẩy lên; cả hai trống -> không làm gì', async () => {
        const withData = new FakeStore(50, doc(50));
        const c1 = fakeCloud(null);
        expect(await new ConnectTracksCloudSync(withData, c1).pull()).toBe('pushed-local');
        await vi.advanceTimersByTimeAsync(10);
        expect(c1.writes).toHaveLength(1);

        const empty = new FakeStore(0);
        const c2 = fakeCloud(null);
        expect(await new ConnectTracksCloudSync(empty, c2).pull()).toBe('unchanged');
        await vi.advanceTimersByTimeAsync(10_000);
        expect(c2.writes).toEqual([]);
    });

    it('save cũ chưa có savedAt (0) thua bản cloud có mốc', async () => {
        const store = new FakeStore(0);
        const sync = new ConnectTracksCloudSync(store, fakeCloud(doc(10, 'cloud')));
        expect(await sync.pull()).toBe('adopted-cloud');
    });

    it('cloud chứa chuỗi hỏng -> giữ local', async () => {
        const store = new FakeStore(5);
        const sync = new ConnectTracksCloudSync(store, fakeCloud('{not json'));
        expect(await sync.pull()).toBe('pushed-local');
        expect(store.imported).toEqual([]);
    });

    it('đọc cloud lỗi hoặc quá hạn -> failed và TUYỆT ĐỐI không ghi đè cloud', async () => {
        const store = new FakeStore(999);
        const cloud = fakeCloud(doc(1));
        cloud.read = vi.fn(async () => { throw new Error('network'); });
        const sync = new ConnectTracksCloudSync(store, cloud);
        expect(await sync.pull()).toBe('failed');
        store.persist(doc(1000));
        await vi.advanceTimersByTimeAsync(10_000);
        expect(cloud.writes).toEqual([]);
        await sync.flush();
        expect(cloud.writes).toEqual([]);

        const slow = fakeCloud(doc(1));
        slow.read = vi.fn(() => new Promise<string | null>(() => undefined));
        const pending = new ConnectTracksCloudSync(store, slow, { pullTimeoutMs: 500 }).pull();
        await vi.advanceTimersByTimeAsync(600);
        expect(await pending).toBe('failed');
    });
});

describe('ConnectTracksCloudSync đẩy lên cloud', () => {
    it('gộp nhiều lần ghi local liên tiếp thành 1 lần đẩy (debounce) với bản mới nhất', async () => {
        const store = new FakeStore(10, doc(10));
        const cloud = fakeCloud(doc(10));
        const sync = new ConnectTracksCloudSync(store, cloud, { debounceMs: 2000 });
        await sync.pull();
        store.persist(doc(11, 'a'));
        await vi.advanceTimersByTimeAsync(1000);
        store.persist(doc(12, 'b'));
        await vi.advanceTimersByTimeAsync(1999);
        expect(cloud.writes).toEqual([]);
        await vi.advanceTimersByTimeAsync(2);
        expect(cloud.writes).toEqual([doc(12, 'b')]);
    });

    it('flush() đẩy ngay phần đang chờ rồi gọi flush của nền tảng', async () => {
        const store = new FakeStore(10, doc(10));
        const cloud = fakeCloud(doc(10));
        const sync = new ConnectTracksCloudSync(store, cloud, { debounceMs: 60_000 });
        await sync.pull();
        store.persist(doc(20, 'x'));
        await sync.flush();
        expect(cloud.writes).toEqual([doc(20, 'x')]);
        expect(cloud.flushed).toBe(1);
        await vi.advanceTimersByTimeAsync(120_000);
        expect(cloud.writes).toHaveLength(1);
    });

    it('ghi cloud lỗi -> không văng lỗi, lần ghi local kế tiếp thử lại', async () => {
        const store = new FakeStore(10, doc(10));
        const cloud = fakeCloud(doc(10));
        let fail = true;
        cloud.write = vi.fn(async (payload: string) => {
            if (fail) throw new Error('quota');
            cloud.writes.push(payload);
        });
        const sync = new ConnectTracksCloudSync(store, cloud, { debounceMs: 100 });
        await sync.pull();
        store.persist(doc(11));
        await vi.advanceTimersByTimeAsync(200);
        expect(cloud.writes).toEqual([]);
        fail = false;
        store.persist(doc(12));
        await vi.advanceTimersByTimeAsync(200);
        expect(cloud.writes).toEqual([doc(12)]);
    });
});
