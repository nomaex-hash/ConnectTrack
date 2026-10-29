import { IAdService, RewardedAdResult } from './IAdService';

type LegacyAdCallback = (err: unknown, result: string) => void;

/**
 * Phần của `common/FBInstantManager` (script dùng chung giữa các game) mà adapter này gọi tới.
 * Mọi logic quảng cáo thật (nạp trước, giãn cách interstitial, ngưỡng level, gỡ quảng cáo, log
 * analytics) vẫn nằm trong script đó — adapter chỉ chuyển nó sang interface IAdService.
 */
export interface LegacyAdManager {
    readonly isFinishedLoad_RewardedVideo: boolean;
    Show_RewardedVideoAsync(location: string, buttonName: string, cb: LegacyAdCallback): void;
    Show_InterstitialAdAsync(location: string, buttonName: string, cb: LegacyAdCallback): void;
    check_InterstitialAdAsync_Available(): boolean;
}

export interface FBInstantAdServiceOptions {
    /** Trả về FBInstantManager.instance (có thể chưa tồn tại lúc scene đang nạp). */
    readonly getManager: () => LegacyAdManager | null | undefined;
    /** true khi đang chạy trên Facebook Instant Games thật (localConfig.envType === ENV_TYPE.FB). */
    readonly isFacebook: () => boolean;
}

const DEFAULT_LOCATION = 'ConnectTracks';

/**
 * IAdService dựa trên FBInstantManager dùng chung — theo hướng dẫn "dùng lại các script đó" thay vì
 * tự dựng lớp quảng cáo riêng.
 *
 * Ngoài Facebook (Editor/preview, ENV_TYPE.TEST_AD) FBInstantManager tự trả "thành công" ngay không
 * hiện quảng cáo, nên rewarded coi như luôn sẵn sàng; interstitial thì bỏ qua.
 */
export class FBInstantAdService implements IAdService {
    constructor(private readonly options: FBInstantAdServiceOptions) {}

    isRewardedReady(): boolean {
        if (!this.options.isFacebook()) return true;
        return this.options.getManager()?.isFinishedLoad_RewardedVideo === true;
    }

    showRewarded(location: string = DEFAULT_LOCATION, buttonName: string = 'rewarded'): Promise<RewardedAdResult> {
        const manager = this.options.getManager();
        if (!manager) return Promise.resolve({ rewarded: false, reason: 'no-manager' });
        return new Promise<RewardedAdResult>((resolve) => {
            try {
                manager.Show_RewardedVideoAsync(location, buttonName, (err) => {
                    resolve(err ? { rewarded: false, reason: describe(err) } : { rewarded: true });
                });
            } catch (error) {
                resolve({ rewarded: false, reason: describe(error) });
            }
        });
    }

    isInterstitialReady(): boolean {
        if (!this.options.isFacebook()) return false;
        return this.options.getManager()?.check_InterstitialAdAsync_Available() === true;
    }

    showInterstitial(location: string = DEFAULT_LOCATION, buttonName: string = 'interstitial'): Promise<boolean> {
        const manager = this.options.getManager();
        if (!manager || !this.isInterstitialReady()) return Promise.resolve(false);
        return new Promise<boolean>((resolve) => {
            try {
                manager.Show_InterstitialAdAsync(location, buttonName, (err) => resolve(!err));
            } catch {
                resolve(false);
            }
        });
    }
}

function describe(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
    return 'ad-error';
}
