import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfigurationCloudSaveAdapter } from '../../../assets/scripts/infrastructure/persistence/configurationCloudSaveAdapter';
import { FBInstantAdService, LegacyAdManager } from '../../../assets/scripts/service/ads/FBInstantAdService';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

function fakeConfiguration(initial: Record<string, unknown> = {}) {
    const configuration = {
        jsonData: initial,
        setGlobalData: vi.fn((key: string, value: unknown) => { configuration.jsonData[key] = value; }),
        flushNow: vi.fn(),
    };
    return configuration;
}

describe('ConfigurationCloudSaveAdapter — đi qua configuration dùng chung', () => {
    it('đọc document từ configuration.jsonData; thiếu key hoặc không phải chuỗi -> null', async () => {
        const present = new ConfigurationCloudSaveAdapter({ configuration: fakeConfiguration({ ctsv: '{"a":1}' }), key: 'ctsv', isPlayerDataReady: () => true });
        expect(await present.read()).toBe('{"a":1}');
        const missing = new ConfigurationCloudSaveAdapter({ configuration: fakeConfiguration(), key: 'ctsv', isPlayerDataReady: () => true });
        expect(await missing.read()).toBeNull();
        const wrongType = new ConfigurationCloudSaveAdapter({ configuration: fakeConfiguration({ ctsv: 5 }), key: 'ctsv', isPlayerDataReady: () => true });
        expect(await wrongType.read()).toBeNull();
    });

    it('ghi = configuration.setGlobalData(key, payload) — KHÔNG có đường ghi riêng lên Facebook', async () => {
        const configuration = fakeConfiguration();
        const adapter = new ConfigurationCloudSaveAdapter({ configuration, key: 'ctsv', isPlayerDataReady: () => true });
        await adapter.write('{"x":2}');
        expect(configuration.setGlobalData).toHaveBeenCalledWith('ctsv', '{"x":2}');
    });

    it('đợi dữ liệu người chơi từ Facebook sẵn sàng rồi mới đọc', async () => {
        let ready = false;
        const configuration = fakeConfiguration({ ctsv: 'cloud' });
        const adapter = new ConfigurationCloudSaveAdapter({ configuration, key: 'ctsv', isPlayerDataReady: () => ready, pollIntervalMs: 50 });
        let result: string | null | undefined;
        void adapter.read().then((value) => { result = value; });
        await vi.advanceTimersByTimeAsync(200);
        expect(result).toBeUndefined();
        ready = true;
        await vi.advanceTimersByTimeAsync(60);
        expect(result).toBe('cloud');
    });

    it('quá hạn mà dữ liệu chưa sẵn sàng -> đọc báo lỗi (để lớp đồng bộ giữ local)', async () => {
        const adapter = new ConfigurationCloudSaveAdapter({ configuration: fakeConfiguration(), key: 'k', isPlayerDataReady: () => false, pollIntervalMs: 50, maxWaitMs: 300 });
        const outcome = adapter.read().then(() => 'resolved', () => 'rejected');
        await vi.advanceTimersByTimeAsync(400);
        expect(await outcome).toBe('rejected');
    });

    it('flush chỉ ép ghi khi dữ liệu người chơi đã sẵn sàng (không ghi đè cloud bằng dữ liệu trống)', async () => {
        const configuration = fakeConfiguration();
        let ready = false;
        const adapter = new ConfigurationCloudSaveAdapter({ configuration, key: 'k', isPlayerDataReady: () => ready });
        await adapter.flush();
        expect(configuration.flushNow).not.toHaveBeenCalled();
        ready = true;
        await adapter.flush();
        expect(configuration.flushNow).toHaveBeenCalledTimes(1);
    });
});

function fakeManager(overrides: Partial<LegacyAdManager> = {}): LegacyAdManager & { rewardedCalls: Array<[string, string]> } {
    const manager = {
        isFinishedLoad_RewardedVideo: true,
        rewardedCalls: [] as Array<[string, string]>,
        Show_RewardedVideoAsync: vi.fn((location: string, button: string, cb: (e: unknown, r: string) => void) => {
            manager.rewardedCalls.push([location, button]);
            cb(null, 'success');
        }),
        Show_InterstitialAdAsync: vi.fn((_l: string, _b: string, cb: (e: unknown, r: string) => void) => cb(null, 'success')),
        check_InterstitialAdAsync_Available: vi.fn(() => true),
        ...overrides,
    };
    return manager;
}

describe('FBInstantAdService — bọc FBInstantManager dùng chung', () => {
    it('trên Facebook: sẵn sàng theo cờ đã nạp của FBInstantManager', () => {
        const manager = fakeManager({ isFinishedLoad_RewardedVideo: false });
        const service = new FBInstantAdService({ getManager: () => manager, isFacebook: () => true });
        expect(service.isRewardedReady()).toBe(false);
        const loaded = new FBInstantAdService({ getManager: () => fakeManager(), isFacebook: () => true });
        expect(loaded.isRewardedReady()).toBe(true);
    });

    it('ngoài Facebook (TEST_AD): rewarded luôn sẵn sàng, interstitial bỏ qua', async () => {
        const service = new FBInstantAdService({ getManager: () => fakeManager(), isFacebook: () => false });
        expect(service.isRewardedReady()).toBe(true);
        expect(service.isInterstitialReady()).toBe(false);
        expect(await service.showInterstitial()).toBe(false);
    });

    it('rewarded: callback không lỗi -> rewarded true; truyền nhãn vị trí xuống để log', async () => {
        const manager = fakeManager();
        const service = new FBInstantAdService({ getManager: () => manager, isFacebook: () => true });
        expect(await service.showRewarded('GameplayScreen', 'placeTrack')).toEqual({ rewarded: true });
        expect(manager.rewardedCalls).toEqual([['GameplayScreen', 'placeTrack']]);
        await service.showRewarded();
        expect(manager.rewardedCalls[1]).toEqual(['ConnectTracks', 'rewarded']);
    });

    it('rewarded: callback có lỗi -> rewarded false kèm lý do; manager ném lỗi cũng không văng ra ngoài', async () => {
        const failing = fakeManager({
            Show_RewardedVideoAsync: vi.fn((_l, _b, cb) => cb(new Error('load FAIL'), 'fail')),
        });
        const service = new FBInstantAdService({ getManager: () => failing, isFacebook: () => true });
        expect(await service.showRewarded()).toEqual({ rewarded: false, reason: 'load FAIL' });

        const throwing = fakeManager({ Show_RewardedVideoAsync: vi.fn(() => { throw new Error('sdk'); }) });
        const service2 = new FBInstantAdService({ getManager: () => throwing, isFacebook: () => true });
        expect(await service2.showRewarded()).toEqual({ rewarded: false, reason: 'sdk' });
    });

    it('chưa có FBInstantManager (scene đang nạp) -> không ném lỗi', async () => {
        const service = new FBInstantAdService({ getManager: () => null, isFacebook: () => true });
        expect(service.isRewardedReady()).toBe(false);
        expect(await service.showRewarded()).toEqual({ rewarded: false, reason: 'no-manager' });
        expect(await service.showInterstitial()).toBe(false);
    });

    it('interstitial: chỉ gọi khi FBInstantManager báo khả dụng; thành công/thất bại theo callback', async () => {
        const manager = fakeManager();
        const service = new FBInstantAdService({ getManager: () => manager, isFacebook: () => true });
        expect(service.isInterstitialReady()).toBe(true);
        expect(await service.showInterstitial()).toBe(true);

        manager.check_InterstitialAdAsync_Available = vi.fn(() => false);
        expect(await service.showInterstitial()).toBe(false);

        const failing = fakeManager({ Show_InterstitialAdAsync: vi.fn((_l, _b, cb) => cb(new Error('next TIME!'), 'fail')) });
        expect(await new FBInstantAdService({ getManager: () => failing, isFacebook: () => true }).showInterstitial()).toBe(false);
    });
});
