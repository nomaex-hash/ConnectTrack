import { _decorator, EditBox, Node, sys } from 'cc';
import { UIPopup } from '../UIPopup';
import { EventManager } from '../../core/EventManager';
import { AppState } from '../../core/AppState';
import {
    CONNECT_TRACKS_RESTART_REQUESTED_EVENT,
    HINT_GRANT_REQUESTED_EVENT,
    HintGrantRequestedEventPayload,
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
    SETTINGS_CHANGE_REQUESTED_EVENT,
    SettingsChangeRequestedEventPayload,
} from '../../event/AppEvents';
import {
    CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT,
    ConnectTracksPlaceTrackGrantRequestedEventPayload,
} from '../../event/AppEvents';
import { Localization } from '../../localization/Localization';
import { LANGUAGE_CHANGED_EVENT } from '../../localization/LocalizationEvents';
import { setActiveAnimated } from '../../animation/ToggleFade';
import { PopupId } from '../PopupId';
import { LeaderboardManager as LegacyLeaderboardManager } from '../../leaderboard/LeaderboardManager';
import { GameManager } from '../../manager/GameManager';
import { UIManager } from '../../manager/UIManager';

const { ccclass, property } = _decorator;


export interface SettingsData {
    readonly bgmOn: boolean;
    readonly sfxOn: boolean;
    readonly vibrationOn: boolean;
    /** false khi mở Settings từ Main Menu — chọn hiện dialogGameplay hay dialogMainMenu. */
    readonly showReplay: boolean;
}

/** 1 bộ node điều khiển Sound/Ngôn ngữ của MỘT khung Dialog (Gameplay hoặc Main Menu) — 2 khung
 * hoàn toàn tách biệt (bố cục riêng, tự chứa đủ control bên trong, giống cách dailyLockedNode/
 * dailyUnlockedNode toggle active ở MainMenuScreen), không dùng chung 1 bộ control nào cả. */
@ccclass('SettingsDialogControls')
class SettingsDialogControls {
    @property({ type: Node, tooltip: 'Hình khi Nhạc BẬT.' })
    musicOn: Node | null = null;
    @property({ type: Node, tooltip: 'Hình khi Nhạc TẮT.' })
    musicOff: Node | null = null;

    @property({ type: Node, tooltip: 'Hình khi Âm thanh BẬT.' })
    soundOn: Node | null = null;
    @property({ type: Node, tooltip: 'Hình khi Âm thanh TẮT.' })
    soundOff: Node | null = null;

    @property({ type: Node, tooltip: 'Hình khi Rung BẬT.' })
    vibrationOn: Node | null = null;
    @property({ type: Node, tooltip: 'Hình khi Rung TẮT.' })
    vibrationOff: Node | null = null;

    @property({ type: Node, tooltip: 'Dấu tích ô Tiếng Việt (mã ngôn ngữ "vi").' })
    languageVnCheck: Node | null = null;
    @property({ type: Node, tooltip: 'Dấu tích ô Tiếng Anh (mã ngôn ngữ "en").' })
    languageEnCheck: Node | null = null;
}


@ccclass('SettingsPopup')
export class SettingsPopup extends UIPopup<SettingsData> {
    /** Editor Button click handler: use the existing inventory/save notification path. */
    onTapAdd50Hints(): void {
        const payload: HintGrantRequestedEventPayload = { amount: 50 };
        EventManager.instance.emit(HINT_GRANT_REQUESTED_EVENT, payload);
    }

    @property({
        type: Node,
        tooltip: 'Khung Dialog dùng khi mở Settings từ GAMEPLAY (có Home + Restart) — bố cục riêng, tự chứa đủ control bên trong.',
    })
    dialogGameplay: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Khung Dialog dùng khi mở Settings từ MAIN MENU (chỉ có Cách chơi) — bố cục riêng khác, tự chứa đủ control bên trong.',
    })
    dialogMainMenu: Node | null = null;

    @property({ type: SettingsDialogControls, tooltip: 'Control Sound/Ngôn ngữ BÊN TRONG dialogGameplay.' })
    gameplayControls = new SettingsDialogControls();

    @property({ type: SettingsDialogControls, tooltip: 'Control Sound/Ngôn ngữ BÊN TRONG dialogMainMenu.' })
    mainMenuControls = new SettingsDialogControls();

    @property({
        tooltip: 'URL/mailto mở khi bấm Phản Hồi. Để trống thì nút chỉ log (chưa cấu hình).',
    })
    feedbackUrl = '';

    @property({
        type: EditBox,
        tooltip:
            'DÙNG ĐỂ TEST — nhập số level campaign rồi bấm xong/chạm ra ngoài (EDITING_DID_ENDED) ' +
            'là nhảy THẲNG vào đúng level đó (giống trước đây phải tự sửa level ở key save), KHÔNG ' +
            'qua kiểm tra đã mở khoá hay chưa — campaign không giới hạn levelId (xem GameManager.' +
            'startPuzzle()). Đặt Input Mode = Number trong Editor để chỉ gõ được số. Để trống thì bỏ ' +
            'qua hẳn tính năng này. Chỉ nên bật ở build debug.',
    })
    jumpToLevelInput: EditBox | null = null;

    private bgmOn = true;
    private sfxOn = true;
    private vibrationEnabled = true;

    protected onShow(data: SettingsData): void {
        // Không có bước tải nào — tắt loading NGAY (UIPopup.showLoading() tự bật lúc show()).
        this.hideLoading();
        this.bgmOn = data.bgmOn;
        this.sfxOn = data.sfxOn;
        this.vibrationEnabled = data.vibrationOn;

        // Toggle 2 khung Dialog RIÊNG BIỆT — giống hệt cách dailyLockedNode/dailyUnlockedNode
        // chuyển trạng thái ở MainMenuScreen (chỉ .active, không tính toán/co giãn gì cả).
        if (this.dialogGameplay) this.dialogGameplay.active = data.showReplay;
        if (this.dialogMainMenu) this.dialogMainMenu.active = !data.showReplay;

        this.refresh();
    }

    protected onEnable(): void {
        EventManager.instance.on(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        this.jumpToLevelInput?.node.on(EditBox.EventType.EDITING_DID_ENDED, this.onJumpToLevelEditingEnded, this);
    }

    protected onDisable(): void {
        EventManager.instance.off(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        this.jumpToLevelInput?.node.off(EditBox.EventType.EDITING_DID_ENDED, this.onJumpToLevelEditingEnded, this);
    }

    /** DÙNG ĐỂ TEST — nhập xong số level (EditBox kết thúc chỉnh sửa) là nhảy thẳng vào level đó,
     * y hệt cách trước đây phải tự sửa level ở key save. Số không hợp lệ (rỗng/không phải số
     * nguyên dương) thì bỏ qua, không làm gì cả.
     *
     * "Ở level nào thì cũng để test luôn luồng ở level đó (vd level 1 không có streak/leaderboard,
     * level 5 mới mở streak, sau level 10 mới có leaderboard...)" (xác nhận từ user) —
     * setTestHighestLevel() (gọi TRƯỚC khi bắn LEVEL_SELECTED_EVENT) ghi thẳng progression như đã
     * thắng hết các màn TRƯỚC levelId, để mọi cờ mở khoá phụ thuộc progression (streak, leaderboard,
     * kích hoạt giải đấu...) tự khớp đúng với level đang nhảy tới — không chỉ mở màn chơi lên mà bỏ
     * qua các cờ đó. */
    private onJumpToLevelEditingEnded = (): void => {
        const raw = this.jumpToLevelInput?.string ?? '';
        const levelId = parseInt(raw, 10);
        if (!Number.isInteger(levelId) || levelId <= 0) return;

        GameManager.instance?.setTestHighestLevel(levelId);
        const payload: LevelSelectedEventPayload = { context: 'campaign', levelId };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
        this.requestClose();
    };


    onToggleMusic(): void {
        this.bgmOn = !this.bgmOn;
        this.refresh();
        this.emit({ bgmVolume: this.bgmOn ? 1 : 0 });
    }

    onToggleSound(): void {
        this.sfxOn = !this.sfxOn;
        this.refresh();
        this.emit({ sfxVolume: this.sfxOn ? 1 : 0 });
    }

    onToggleVibration(): void {
        this.vibrationEnabled = !this.vibrationEnabled;
        this.refresh();
        this.emit({ vibration: this.vibrationEnabled });
    }

    onTapFeedback(): void {
        if (this.feedbackUrl.length > 0) {
            sys.openURL(this.feedbackUrl);
        } else {
        }
    }


    onTapReplay(): void {
        // SettingsPopup không giữ reference tới GameplayScreen/PuzzleSessionHolder/
        // connectTracksSession — chỉ emit sự kiện; GameplayScreen.onTapRestart (đang nghe sự kiện
        // này) tự lo restart ĐỦ CẢ 2: luồng Dogdoku cũ (IntentType.Restart) LẪN ConnectTracks song
        // song (xác nhận từ user: nút Restart ở Settings vẫn phải restart được màn chơi) — gọi
        // thẳng dispatch ở đây nữa sẽ bị double-dispatch IntentType.Restart.
        EventManager.instance.emit(CONNECT_TRACKS_RESTART_REQUESTED_EVENT, undefined);
        this.requestClose();
    }

    /** Chỉ có trong dialogGameplay — về Main Menu, giống hệt GameplayScreen.onTapBack(). */
    onTapHome(): void {
        const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
        this.requestClose();
    }

    onTapClose(): void {
        this.requestClose();
    }

    onTapHowToPlay(): void {
        this.popups?.openPopup(PopupId.HowToPlay, undefined);
    }

    /** DÙNG ĐỂ TEST — giả lập "giải đấu tuần vừa kết thúc" dựa trên điểm/hạng THẬT hiện tại (không
     * tự xoá dữ liệu — chỉ thật sự reset SAU KHI bấm nút trong popup, đúng luồng thật). Ngoài Top 3
     * sẽ tự hiện TournamentResetPopup ngay (đúng luồng "về Home mới hiện"); Top 3 KHÔNG tự hiện gì
     * — mở Leaderboard, bấm banner "Nhận thưởng" để test tiếp (xem LeaderboardPopup.onTouchCollect).
     * Cùng logic với nút test gốc trên Main Menu (MainMenuScreen.onTapResetLeaderboard) — gán vào
     * Click Events của 1 nút test trong Settings, chỉ nên bật ở build debug. */
    onTapResetLeaderboard(): void {
        LegacyLeaderboardManager.instance?.resetWeeklyForTesting();
        GameManager.instance?.checkPendingTournamentResult();
        UIManager.instance?.checkTournamentPopupForTesting();
    }

    /** DÙNG ĐỂ TEST riêng nhánh Top 3 — thay vì phải tự chơi đủ điểm để leo hạng 1 rồi mới bấm
     * onTapResetLeaderboard(), ép điểm tuần CAO HƠN mọi bot NGAY LÚC NÀY (chỉ để tính hạng, không
     * đụng gì tới kho/tiến trình campaign) rồi mới "chốt sổ" — chắc chắn ra hạng 1. CHỈ giả lập
     * TRẠNG THÁI (giống hệt đang chơi dở đúng lúc giải đấu hết giờ) rồi đóng Settings lại — KHÔNG
     * tự nhảy sang Leaderboard. Đúng luồng thật: Top 3 không tự hiện gì cả, người chơi phải tự
     * thoát ra Home rồi tự bấm vào Leaderboard, thấy banner "Nhận thưởng" và tự bấm vào đó mới mở
     * RewardTop3 -> RewardReceivePopup (xem LeaderboardPopup.onTouchCollect / TournamentResultPopup).
     * Gán vào Click Events của 1 nút test riêng trong Settings, chỉ nên bật ở build debug. */
    onTapTestTop3Flow(): void {
        const legacy = LegacyLeaderboardManager.instance;
        if (!legacy) return;

        const botScores = legacy.getFakeBotWeeklyScores();
        const topBotScore = botScores.length > 0 ? Math.max.apply(Math, botScores) : 0;
        legacy.setLeaderboardCurrWeekScore(topBotScore + 1);
        legacy.resetWeeklyForTesting();

        this.requestClose();
    }


    @property({
        tooltip:
            'DÙNG ĐỂ TEST — số giờ "tua nhanh" MỖI LẦN bấm nút test tua thời gian Leaderboard ' +
            '(onTapFastForwardOfflineGrowth) — mặc định 1 giờ/lần bấm, bấm nhiều lần để cộng dồn ' +
            'thêm giờ. Chỉnh số này trong Editor nếu muốn tua nhanh/chậm hơn.',
    })
    fastForwardOfflineGrowthHours = 1;

    /** DÙNG ĐỂ TEST — tua nhanh fastForwardOfflineGrowthHours giờ (property bên trên) để bot
     * Weekly/Global tự tăng điểm NGAY (offline growth), khỏi phải chờ thật ngoài đời mới thấy bot
     * nhích điểm — dùng để test luồng "hạng tụt xuống top 7-10 rồi bot ngừng tăng điểm" (xem
     * LeaderboardManager.fastForwardOfflineGrowthForTesting()). Gán vào Click Events của 1 nút
     * test riêng trong Settings, chỉ nên bật ở build debug. */
    onTapFastForwardOfflineGrowth(): void {
        LegacyLeaderboardManager.instance?.fastForwardOfflineGrowthForTesting(this.fastForwardOfflineGrowthHours);
    }


    @property({
        tooltip: 'DÙNG ĐỂ TEST — số lượt Place Track (ConnectTracks) cộng mỗi lần bấm nút test (onTapTestAddPlaceTrack).',
    })
    testAddPlaceTrackAmount = 50;

    /** DÙNG ĐỂ TEST — cộng thẳng testAddPlaceTrackAmount lượt Place Track (ConnectTracks). Khác
     * onTapTestAddPlaceDog (Dogdoku cũ): SettingsPopup không giữ reference tới
     * connectTracksInventory nên chỉ emit CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT, màn
     * Gameplay đang mở tự nghe và cộng thẳng vào kho Place Track của nó. Gán vào Click Events của
     * 1 nút test riêng trong Settings, chỉ nên bật ở build debug. */
    onTapTestAddPlaceTrack(): void {
        const payload: ConnectTracksPlaceTrackGrantRequestedEventPayload = { amount: this.testAddPlaceTrackAmount };
        EventManager.instance.emit(CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT, payload);
    }

    onSelectLanguage(_event: Event, languageCode: string): void {
        if (!languageCode || languageCode === Localization.getCurrentLanguage()) return;
        Localization.setLanguage(languageCode);

        this.refresh();
    }



    /** Cập nhật CẢ HAI bộ control (dù chỉ 1 khung Dialog đang active) — đơn giản hơn phải if/else
     * theo showReplay, không tốn gì đáng kể vì chỉ toggle vài node. */
    private refresh = (): void => {
        this.refreshDialogControls(this.gameplayControls);
        this.refreshDialogControls(this.mainMenuControls);
    };

    private refreshDialogControls(controls: SettingsDialogControls): void {
        this.setPair(controls.musicOn, controls.musicOff, this.bgmOn);
        this.setPair(controls.soundOn, controls.soundOff, this.sfxOn);
        this.setPair(controls.vibrationOn, controls.vibrationOff, this.vibrationEnabled);

        const isVietnamese = Localization.getCurrentLanguage() === 'vi';
        setActiveAnimated(controls.languageVnCheck, isVietnamese);
        setActiveAnimated(controls.languageEnCheck, !isVietnamese);
    }

    private setPair(on: Node | null, off: Node | null, isOn: boolean): void {
        if (on) on.active = isOn;
        if (off) off.active = !isOn;
    }

    private emit(payload: SettingsChangeRequestedEventPayload): void {
        EventManager.instance.emit(SETTINGS_CHANGE_REQUESTED_EVENT, payload);
    }
}
