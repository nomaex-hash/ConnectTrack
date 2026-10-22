import { _decorator, Component, Node, Prefab } from 'cc';
import { AppState } from '../core/AppState';
import { PopupId } from './PopupId';
import { ResourceManager } from '../manager/ResourceManager';
import {
    LAZY_POPUPS, LAZY_PREFETCH_ENABLED, LAZY_PREFETCH_GAP_SECONDS, LAZY_SCREENS, LazyAssetCache, LazyPrefabRef, PREFETCH_ORDER,
} from './lazyPrefabRegistry';

const { ccclass, property } = _decorator;


@ccclass('UIRoot')
export class UIRoot extends Component {
    @property({ type: Node, tooltip: 'Layer 1 — Screen (Main Menu / Level Select / Gameplay)' })
    screenLayer: Node = null!;

    @property({ type: Node, tooltip: 'Layer 2 — Popup (Pause / Result / Settings / Confirm)' })
    popupLayer: Node = null!;

    @property({ type: Node, tooltip: 'Layer 3 — Block Input (trong suốt, chặn lúc chuyển tiếp)' })
    blockInputLayer: Node = null!;

    @property({ type: Prefab, tooltip: 'MainMenuScreen.prefab' })
    mainMenuScreen: Prefab = null!;

    @property({ type: Prefab, tooltip: 'LevelSelectScreen.prefab' })
    levelSelectScreen: Prefab = null!;

    @property({ type: Prefab, tooltip: 'GameplayScreen.prefab' })
    gameplayScreen: Prefab = null!;

    @property({ type: Prefab, tooltip: 'DailyStreakScreen.prefab — màn Chuỗi Hằng Ngày' })
    dailyStreakScreen: Prefab = null!;

    @property({ type: Prefab, tooltip: 'PausePopup.prefab' })
    pausePopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'ResultPopup.prefab' })
    resultPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'DailyResultPopup.prefab — Result cho màn Daily' })
    dailyResultPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'SettingsPopup.prefab' })
    settingsPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'HowToPlayPopup.prefab — màn cách chơi mở từ nút ?' })
    howToPlayPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'RewardPopup.prefab — popup nhận quà chuỗi' })
    rewardPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'StarterPackPopup.prefab — popup giới thiệu Starter Pack' })
    starterPackPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'LeaderboardPreviewPopup.prefab — popup leo hạng Weekly sau khi thắng màn campaign' })
    leaderboardPreviewPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'TournamentResultPopup.prefab — popup Claim/Continue khi giải đấu tuần kết thúc' })
    tournamentResultPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'TournamentResetPopup.prefab — popup thông báo giải đấu đã reset (chỉ cho người KHÔNG top 3)' })
    tournamentResetPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'TournamentActivationPopup.prefab — popup kích hoạt giải đấu Weekly lần đầu cho người chơi hoàn toàn mới' })
    tournamentActivationPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'LeaderboardPopup.prefab — bọc LeaderboardTabGroup thành popup, mở từ nút Leaderboard ở Main Menu (không còn hệ thống tab Shop/Home/Leaderboard nữa).' })
    leaderboardPopup: Prefab = null!;

    @property({ type: Prefab, tooltip: 'ConnectTracksLosePopup.prefab — popup thua RIÊNG của ConnectTracks (thay thế ResultPopup cũ cho ConnectTracks), có cụm 3 tim vỡ + nút xem QC hồi sinh + nút chơi lại.' })
    connectTracksLosePopup: Prefab = null!;

    /** Prefab nạp lazy từ bundle (chỉ dùng khi slot tương ứng bên trên BỎ TRỐNG) — xem lazyPrefabRegistry. */
    private readonly lazyPrefabs = new LazyAssetCache<Prefab>(
        (ref) => ResourceManager.instance.loadPrefabFromBundle(ref.bundle, ref.path),
    );
    private prefetchStarted = false;

    /** Prefab dùng được NGAY (đồng bộ): slot gán trong scene, hoặc bản lazy đã nạp xong. */
    getScreenPrefab(state: AppState): Prefab | null {
        const slot = this.getScreenSlot(state);
        if (slot) return slot;
        const ref = LAZY_SCREENS[state];
        return ref ? this.lazyPrefabs.get(ref) : null;
    }

    getPopupPrefab(id: PopupId): Prefab | null {
        const slot = this.getPopupSlot(id);
        if (slot) return slot;
        const ref = LAZY_POPUPS[id];
        return ref ? this.lazyPrefabs.get(ref) : null;
    }

    /** Slot trống + có cấu hình lazy + CHƯA nạp: UIManager phải đợi ensureScreenPrefab() trước khi dựng. */
    needsLazyScreen(state: AppState): boolean {
        return !this.getScreenPrefab(state) && !!LAZY_SCREENS[state];
    }

    canLazyLoadPopup(id: PopupId): boolean {
        return !this.getPopupSlot(id) && !!LAZY_POPUPS[id];
    }

    async ensureScreenPrefab(state: AppState): Promise<Prefab | null> {
        const existing = this.getScreenPrefab(state);
        if (existing) return existing;
        const ref = LAZY_SCREENS[state];
        return ref ? this.lazyPrefabs.ensure(ref) : null;
    }

    async ensurePopupPrefab(id: PopupId): Promise<Prefab | null> {
        const existing = this.getPopupPrefab(id);
        if (existing) return existing;
        const ref = LAZY_POPUPS[id];
        return ref ? this.lazyPrefabs.ensure(ref) : null;
    }

    /**
     * Tải NGẦM (chỉ download, không dựng node) các prefab lazy theo PREFETCH_ORDER, TUẦN TỰ từng cái để
     * không tranh băng thông với màn đang hiển thị. Gọi 1 lần sau khi màn đầu tiên đã hiện. Mọi lỗi chỉ
     * cảnh báo — lúc người chơi thật sự mở màn/popup đó, ensure*() sẽ tự tải lại.
     */
    prefetchLazy(): void {
        if (this.prefetchStarted || !LAZY_PREFETCH_ENABLED) return;
        this.prefetchStarted = true;
        void (async () => {
            for (const ref of PREFETCH_ORDER) {
                if (!this.isValid) return;
                if (this.lazyPrefabs.get(ref) || this.slotAssignedFor(ref)) continue;
                try {
                    await ResourceManager.instance.preloadPrefabFromBundle(ref.bundle, ref.path);
                } catch (error) {
                    console.warn(`[UIRoot] Prefetch ${ref.bundle}/${ref.path} thất bại (sẽ tải lại khi cần).`, error);
                }
                // Nhường khung hình: không dồn các prefab nặng liên tiếp lên main thread.
                await new Promise<void>((resolve) => this.scheduleOnce(() => resolve(), LAZY_PREFETCH_GAP_SECONDS));
            }
        })();
    }

    /** true nếu prefab của ref này đang được gán cứng trong 1 slot (không cần tải ngầm). */
    private slotAssignedFor(ref: LazyPrefabRef): boolean {
        for (const state of Object.keys(LAZY_SCREENS) as AppState[]) {
            if (LAZY_SCREENS[state] === ref) return !!this.getScreenSlot(state);
        }
        for (const id of Object.keys(LAZY_POPUPS) as PopupId[]) {
            if (LAZY_POPUPS[id] === ref) return !!this.getPopupSlot(id);
        }
        return false;
    }

    private getScreenSlot(state: AppState): Prefab | null {
        switch (state) {
            case AppState.MainMenu:
                return this.mainMenuScreen;
            case AppState.LevelSelect:
                return this.levelSelectScreen;
            case AppState.Gameplay:
                return this.gameplayScreen;
            case AppState.DailyStreak:
                return this.dailyStreakScreen;
            case AppState.Boot:
            case AppState.Loading:
                return null;
        }
    }

    private getPopupSlot(id: PopupId): Prefab | null {
        switch (id) {
            case PopupId.Pause:
                return this.pausePopup;
            case PopupId.Result:
                return this.resultPopup;
            case PopupId.DailyResult:
                return this.dailyResultPopup;
            case PopupId.Settings:
                return this.settingsPopup;
            case PopupId.HowToPlay:
                return this.howToPlayPopup;
            case PopupId.Reward:
                return this.rewardPopup;
            case PopupId.StarterPack:
                return this.starterPackPopup;
            case PopupId.LeaderboardPreview:
                return this.leaderboardPreviewPopup;
            case PopupId.TournamentResult:
                return this.tournamentResultPopup;
            case PopupId.TournamentReset:
                return this.tournamentResetPopup;
            case PopupId.TournamentActivation:
                return this.tournamentActivationPopup;
            case PopupId.Leaderboard:
                return this.leaderboardPopup;
            case PopupId.ConnectTracksLose:
                return this.connectTracksLosePopup;
        }
    }
}
