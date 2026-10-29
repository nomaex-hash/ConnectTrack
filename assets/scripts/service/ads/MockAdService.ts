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

    /** Mock không có quảng cáo xen kẽ — luôn bỏ qua để không chặn luồng test. */
    isInterstitialReady(): boolean {
        return false;
    }

    async showInterstitial(): Promise<boolean> {
        return false;
    }

    async showRewarded(): Promise<RewardedAdResult> {
        await new Promise((resolve) => setTimeout(resolve, MOCK_WATCH_SECONDS * 1000));
        return { rewarded: true };
    }
}
