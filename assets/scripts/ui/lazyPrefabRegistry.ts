import { AppState } from '../core/AppState';
import { PopupId } from './PopupId';

/**
 * Prefab UI nạp LAZY từ Asset Bundle thay vì gán cứng vào slot của UIRoot trong Main.scene (slot gán
 * cứng khiến director.preloadScene() phải tải TRƯỚC toàn bộ cây phụ thuộc của mọi màn/popup — ~12,5 MB).
 *
 * Quy ước: nếu slot trong UIRoot VẪN còn gán prefab thì dùng slot như cũ (tương thích ngược, chưa cần
 * đụng Editor); chỉ khi slot BỎ TRỐNG thì UIRoot mới nạp prefab theo bảng dưới. `path` tính từ gốc
 * bundle, KHÔNG kèm đuôi .prefab — vd bundle `gameplay` là thư mục assets/bundles/gameplay chứa
 * GameplayScreen.prefab thì path là 'GameplayScreen'.
 */
export interface LazyPrefabRef {
    readonly bundle: string;
    readonly path: string;
}

export const GAMEPLAY_BUNDLE = 'gameplay';
export const POPUPS_BUNDLE = 'popups';
/** Bundle đã có sẵn trong dự án (chứa LeaderboardTabGroup.prefab). */
export const HOME_TABS_BUNDLE = 'home-tabs';

export const LAZY_SCREENS: Readonly<Partial<Record<AppState, LazyPrefabRef>>> = {
    [AppState.Gameplay]: { bundle: GAMEPLAY_BUNDLE, path: 'GameplayScreen' },
    [AppState.DailyStreak]: { bundle: POPUPS_BUNDLE, path: 'DailyStreakScreen' },
};

export const LAZY_POPUPS: Readonly<Partial<Record<PopupId, LazyPrefabRef>>> = {
    [PopupId.Result]: { bundle: POPUPS_BUNDLE, path: 'ResultPopup' },
    // ConnectTracksLose dùng chung prefab ResultPopup (đúng như đang gán trong UIRoot hiện tại).
    [PopupId.ConnectTracksLose]: { bundle: POPUPS_BUNDLE, path: 'ResultPopup' },
    [PopupId.DailyResult]: { bundle: POPUPS_BUNDLE, path: 'DailyResultPopup' },
    [PopupId.HowToPlay]: { bundle: POPUPS_BUNDLE, path: 'HowToPlayPopup' },
    [PopupId.LeaderboardPreview]: { bundle: POPUPS_BUNDLE, path: 'LeaderboardPreviewPopup' },
    [PopupId.TournamentResult]: { bundle: POPUPS_BUNDLE, path: 'rewardTop3' },
    // TournamentActivation cũng dùng chung prefab TournamentResetPopup (đúng như đang gán).
    [PopupId.TournamentReset]: { bundle: POPUPS_BUNDLE, path: 'TournamentResetPopup' },
    [PopupId.TournamentActivation]: { bundle: POPUPS_BUNDLE, path: 'TournamentResetPopup' },
    [PopupId.Leaderboard]: { bundle: HOME_TABS_BUNDLE, path: 'LeaderboardTabGroup' },
};

/**
 * Công tắc tải ngầm các prefab lazy sau khi vào màn đầu. Đặt false để KIỂM TRA nếu nghi tải ngầm làm game giật
 * (hiệu ứng nhấn nút biến mất, double-tap không ăn) — game vẫn chạy bình thường vì prefab sẽ tải khi cần.
 */
export const LAZY_PREFETCH_ENABLED = true;
/** Nghỉ giữa 2 lần tải ngầm (giây) để nhường khung hình cho game, tránh dồn nhiều prefab liên tiếp. */
export const LAZY_PREFETCH_GAP_SECONDS = 1;

/** Thứ tự tải NGẦM sau khi người chơi đã vào màn đầu tiên: màn chơi trước, rồi popup hay gặp nhất. */
export const PREFETCH_ORDER: readonly LazyPrefabRef[] = [
    LAZY_SCREENS[AppState.Gameplay]!,
    LAZY_POPUPS[PopupId.Result]!,
    LAZY_POPUPS[PopupId.DailyResult]!,
    LAZY_SCREENS[AppState.DailyStreak]!,
    LAZY_POPUPS[PopupId.LeaderboardPreview]!,
    LAZY_POPUPS[PopupId.TournamentReset]!,
    LAZY_POPUPS[PopupId.TournamentResult]!,
    LAZY_POPUPS[PopupId.HowToPlay]!,
    LAZY_POPUPS[PopupId.Leaderboard]!,
];

export function lazyKey(ref: LazyPrefabRef): string {
    return `${ref.bundle}/${ref.path}`;
}

/**
 * Cache + dedupe cho việc nạp bất đồng bộ: gọi ensure() nhiều lần cùng lúc chỉ tải 1 lần; kết quả
 * thành công được giữ lại; thất bại KHÔNG bị cache (lần gọi sau thử lại) và được tự thử lại
 * `attempts` lần để chịu được mạng chập chờn.
 */
export class LazyAssetCache<T> {
    private readonly loaded = new Map<string, T>();
    private readonly inflight = new Map<string, Promise<T>>();

    constructor(
        private readonly loader: (ref: LazyPrefabRef) => Promise<T>,
        private readonly attempts = 2,
    ) {}

    get(ref: LazyPrefabRef): T | null {
        return this.loaded.get(lazyKey(ref)) ?? null;
    }

    ensure(ref: LazyPrefabRef): Promise<T> {
        const key = lazyKey(ref);
        const cached = this.loaded.get(key);
        if (cached !== undefined) return Promise.resolve(cached);
        const pending = this.inflight.get(key);
        if (pending) return pending;

        const promise = this.loadWithRetry(ref).then(
            (asset) => {
                this.inflight.delete(key);
                this.loaded.set(key, asset);
                return asset;
            },
            (error: unknown) => {
                this.inflight.delete(key);
                throw error;
            },
        );
        this.inflight.set(key, promise);
        return promise;
    }

    private async loadWithRetry(ref: LazyPrefabRef): Promise<T> {
        let lastError: unknown;
        for (let attempt = 0; attempt < Math.max(1, this.attempts); attempt++) {
            try {
                return await this.loader(ref);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError;
    }
}
