import { IAdService, RewardedAdResult } from './IAdService';

const MOCK_WATCH_SECONDS = 2;

/**
 * Bản mock: giả lập "xem quảng cáo" mất `MOCK_WATCH_SECONDS` giây rồi nhận thưởng —
 * đủ lâu để overlay chờ quảng cáo ở UI (GameplayScreen.adOverlay) hiện rõ khi test.
 * Cho phép chạy/test toàn bộ luồng hết lượt → xem quảng cáo → được cộng lượt khi
 * chưa gắn SDK quảng cáo thật.
 */
export class MockAdService implements IAdService {
    isRewardedReady(): boolean {
        return true;
    }

    async showRewarded(): Promise<RewardedAdResult> {
        console.log('[MockAd] Giả lập đang xem quảng cáo...');
        await new Promise((resolve) => setTimeout(resolve, MOCK_WATCH_SECONDS * 1000));
        console.log('[MockAd] Xem xong, nhận thưởng.');
        return { rewarded: true };
    }
}
