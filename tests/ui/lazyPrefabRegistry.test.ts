import { describe, expect, it, vi } from 'vitest';
import {
    LAZY_POPUPS, LAZY_SCREENS, LazyAssetCache, LazyPrefabRef, PREFETCH_ORDER, lazyKey,
    GAMEPLAY_BUNDLE, POPUPS_BUNDLE, HOME_TABS_BUNDLE,
} from '../../assets/scripts/ui/lazyPrefabRegistry';
import { AppState } from '../../assets/scripts/core/AppState';
import { PopupId } from '../../assets/scripts/ui/PopupId';

const ref: LazyPrefabRef = { bundle: 'b', path: 'P' };

describe('LazyAssetCache', () => {
    it('gọi ensure() đồng thời chỉ tải 1 lần và trả cùng kết quả', async () => {
        const loader = vi.fn(async () => ({ id: 1 }));
        const cache = new LazyAssetCache(loader);
        const [a, b] = await Promise.all([cache.ensure(ref), cache.ensure(ref)]);
        expect(a).toBe(b);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('get() trả null trước khi tải và trả asset sau khi tải; lần ensure() sau không tải lại', async () => {
        const loader = vi.fn(async () => 'asset');
        const cache = new LazyAssetCache(loader);
        expect(cache.get(ref)).toBeNull();
        await cache.ensure(ref);
        expect(cache.get(ref)).toBe('asset');
        await cache.ensure(ref);
        expect(loader).toHaveBeenCalledTimes(1);
    });

    it('tự thử lại khi lỗi mạng thoáng qua', async () => {
        const loader = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce('ok');
        const cache = new LazyAssetCache(loader, 2);
        await expect(cache.ensure(ref)).resolves.toBe('ok');
        expect(loader).toHaveBeenCalledTimes(2);
    });

    it('thất bại hết số lần: ném lỗi, KHÔNG cache lỗi, lần gọi sau thử lại được', async () => {
        const loader = vi.fn().mockRejectedValue(new Error('down'));
        const cache = new LazyAssetCache(loader, 2);
        await expect(cache.ensure(ref)).rejects.toThrow('down');
        expect(cache.get(ref)).toBeNull();
        loader.mockResolvedValueOnce('back');
        await expect(cache.ensure(ref)).resolves.toBe('back');
    });

    it('2 ref cùng bundle/path (vd Result và ConnectTracksLose) dùng chung 1 lần tải', async () => {
        const loader = vi.fn(async () => 'x');
        const cache = new LazyAssetCache(loader);
        await cache.ensure(LAZY_POPUPS[PopupId.Result]!);
        await cache.ensure(LAZY_POPUPS[PopupId.ConnectTracksLose]!);
        expect(loader).toHaveBeenCalledTimes(1);
    });
});

describe('lazy registry', () => {
    const refs: LazyPrefabRef[] = [
        ...(Object.keys(LAZY_SCREENS) as AppState[]).map((k) => LAZY_SCREENS[k]!),
        ...(Object.keys(LAZY_POPUPS) as PopupId[]).map((k) => LAZY_POPUPS[k]!),
    ];

    it('mọi ref có bundle thuộc danh sách bundle đã biết và path không rỗng/không kèm đuôi .prefab', () => {
        for (const r of refs) {
            expect([GAMEPLAY_BUNDLE, POPUPS_BUNDLE, HOME_TABS_BUNDLE]).toContain(r.bundle);
            expect(r.path.length).toBeGreaterThan(0);
            expect(r.path.endsWith('.prefab')).toBe(false);
        }
    });

    it('MainMenu và Settings KHÔNG lazy (phải có ngay để dựng màn đầu + spinner loading)', () => {
        expect(LAZY_SCREENS[AppState.MainMenu]).toBeUndefined();
        expect(LAZY_POPUPS[PopupId.Settings]).toBeUndefined();
        expect(LAZY_POPUPS[PopupId.Reward]).toBeUndefined();
    });

    it('PREFETCH_ORDER chỉ chứa ref có trong bảng lazy, bắt đầu bằng màn Gameplay, không trùng', () => {
        for (const r of PREFETCH_ORDER) expect(refs).toContain(r);
        expect(PREFETCH_ORDER[0]).toBe(LAZY_SCREENS[AppState.Gameplay]);
        const keys = PREFETCH_ORDER.map(lazyKey);
        expect(new Set(keys).size).toBe(keys.length);
    });
});
