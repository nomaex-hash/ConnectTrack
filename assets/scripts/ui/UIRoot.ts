import { _decorator, Component, Node, Prefab } from 'cc';
import { AppState } from '../core/AppState';
import { PopupId } from './PopupId';

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

    getScreenPrefab(state: AppState): Prefab | null {
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

    getPopupPrefab(id: PopupId): Prefab | null {
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
