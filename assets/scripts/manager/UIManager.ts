import { _decorator, BlockInputEvents, Component, Director, Node, UITransform, director, instantiate, Prefab, view } from 'cc';
import { AppState } from '../core/AppState';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../config/GameConfig';
import {
    APP_STATE_CHANGED_EVENT,
    AppStateChangedEventPayload,
} from '../event/AppStateChangedEvent';
import {
    PUZZLE_FAILED_EVENT,
    HEART_FLY_FINISHED_EVENT,
    PUZZLE_SOLVED_EVENT,
    PuzzleFailedEventPayload,
    PuzzleSolvedEventPayload,
} from '../event/PuzzleEvents';
import {
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
} from '../event/AppEvents';
import { UIRoot } from '../ui/UIRoot';
import { ScreenPreparer } from '../ui/screenPreparer';
import { UIScreen } from '../ui/UIScreen';
import { UIPopup } from '../ui/UIPopup';
import { PopupId } from '../ui/PopupId';
import { PopupController } from '../ui/PopupController';
import type { ResultData } from '../ui/popup/ResultPopup';
import type { SettingsData } from '../ui/popup/SettingsPopup';
import { SaveManager } from './SaveManager';
import { GameManager } from './GameManager';
import { AudioManager } from './AudioManager';
import { PuzzleContext } from '../model/BoardSaveData';
import { ProgressionHolder } from '../gameplay/progression/ProgressionHolder';
import { StreakPresentation } from '../gameplay/streak/StreakPresentation';
import {
    LeaderboardPreviewPresentation,
    LeaderboardPreviewSnapshot,
} from '../gameplay/leaderboardpreview/LeaderboardPreviewPresentation';
import { TournamentPresentation, TournamentResultSnapshot } from '../gameplay/tournament/TournamentPresentation';
import { LeaderboardManager as LegacyLeaderboardManager } from '../leaderboard/LeaderboardManager';
import { TournamentActivationPresentation } from '../gameplay/tournament/TournamentActivationPresentation';
import { clientEvent } from '../framework/clientEvent';
import { Constants } from '../framework/constants';
import { ProfileManager } from '../profile/ProfileManager';
import { PreloadedLevelData } from '../application/session/preloadedLevelData';
import type { GameplayScreen } from '../ui/screen/GameplayScreen';



/** Dừng bao lâu (giây) kể từ lúc thắng màn rồi mới mở popup Result — đợi animation đặt mèo cuối
 * cùng chạy xong hẳn. Tutorial dùng dogAppearDurationSecondsTutorial (ngắn hơn nhiều — chỉ 3 con
 * mèo, animation nhanh) thay vì dogAppearDurationSeconds (dài, tune cho campaign/daily). */
function resolveResultPopupDelay(context: PuzzleContext): number {
    const dogAppearDuration =
        context === 'tutorial' ? GameConfig.dogAppearDurationSecondsTutorial : GameConfig.dogAppearDurationSeconds;
    return dogAppearDuration + 0.25;
}

/** Dự phòng: nếu HEART_FLY_FINISHED_EVENT không bao giờ tới (GameplayScreen không chạy hiệu ứng tim
 * bay vì lý do nào đó), vẫn mở LeaderboardPreview sau chừng này giây kể từ lúc thắng. */
const HEART_FLY_WAIT_FALLBACK_SECONDS = 15;

/** Dừng bao lâu (giây) SAU KHI hiệu ứng tim bay vào label kết thúc rồi mới mở LeaderboardPreview. */
const HEART_FLY_TO_LEADERBOARD_DELAY_SECONDS = 0.5;


const RESULT_LOSE_DELAY = 0.5;

const { ccclass } = _decorator;


@ccclass('UIManager')
export class UIManager extends Component implements PopupController {
    private static _instance: UIManager | null = null;
    static get instance(): UIManager {
        if (!this._instance) throw new Error('UIManager chưa được khởi tạo.');
        return this._instance;
    }

    private root: UIRoot | null = null;
    private connectTracksLevels: PreloadedLevelData | null = null;

    setConnectTracksLevels(levels: PreloadedLevelData): void {
        this.connectTracksLevels = levels;
    }

    private currentScreen: UIScreen | null = null;
    private currentScreenState: AppState | null = null;

    private readonly popupStack: UIPopup<never>[] = [];

    private readonly popupPool = new Map<PopupId, UIPopup<never>>();
    private readonly pendingPopupOpens = new Map<PopupId, object>();
    private popupLoadingLayer: Node | null = null;
    private popupLoadingSpinner: Node | null = null;
    private screenLoadingTicket: object | null = null;
    private victoryInputBlocker: Node | null = null;

    private pendingWinResultData: ResultData | null = null;
    private pendingLeaderboardPreview: LeaderboardPreviewSnapshot | null = null;
    /** Tàu ConnectTracks đang hoãn chạy, chờ quay lại Gameplay từ màn Streak — xem
     * notifyConnectTracksReadyForTrain()/onAppStateChanged(). */
    private pendingConnectTracksReady: (() => void) | null = null;
    /** BUG đã sửa (báo lỗi của user: "sau streak thì lại bắt người chơi chơi lại màn [X] từ đầu")
     * — màn GameplayScreen ĐANG CHỜ quay lại SAU KHI màn Streak ăn mừng đóng (ẩn — active=false —
     * KHÔNG destroy()) — xem showScreenNow(). null nghĩa là không có gì đang treo, chuyển màn diễn
     * ra bình thường (destroy + instantiate lại như mọi lần khác). */
    private suspendedGameplayScreen: UIScreen | null = null;

    onLoad(): void {
        UIManager._instance = this;
    }

    onDestroy(): void {
        this.pendingPopupOpens.clear();
        this.screenLoadingTicket = null;
        this.popupLoadingLayer?.destroy();
        this.victoryInputBlocker?.destroy();
        EventManager.instance.targetOff(this);
        if (UIManager._instance === this) UIManager._instance = null;
        ScreenPreparer.set(null);
    }


    attachToScene(): void {
        const scene = director.getScene();
        const root = scene ? scene.getComponentInChildren(UIRoot) : null;

        if (!root) {
            throw new Error('[UIManager] Không tìm thấy UIRoot trong scene hiện tại.');
        }

        this.root = root;
        this.setBlockInput(false);
        ScreenPreparer.set((state) => this.prepareScreen(state));

        // Giống hệt cách HomeTabGroupManager.onLoad() đang làm cho Shop/Leaderboard (tính bằng
        // code 1 lần lúc khởi tạo, KHÔNG qua cc.Widget/ScreenFitNode) — screenLayer/popupLayer là
        // node NGAY DƯỚI UIRoot (không phải con trực tiếp của Canvas) nên không tự nhận diện
        // được kích thước màn hình thật qua component. contentGroup/root của popup con dùng
        // cc.Widget bám theo layer này, nên chỉ cần layer này đúng kích thước là cả dây chuyền
        // bên trong đúng theo, không cần sửa từng popup riêng lẻ.
        const designSize = view.getDesignResolutionSize();
        const visibleSize = view.getVisibleSize();
        const contentWidth = Math.max(designSize.width, visibleSize.width);
        const contentHeight = Math.max(designSize.height, visibleSize.height);
        for (const layer of [root.screenLayer, root.popupLayer, root.blockInputLayer]) {
            layer?.getComponent(UITransform)?.setContentSize(contentWidth, contentHeight);
        }

        const bus = EventManager.instance;
        bus.on<AppStateChangedEventPayload>(
            APP_STATE_CHANGED_EVENT,
            this.onAppStateChanged,
            this,
        );
        bus.on<PuzzleSolvedEventPayload>(PUZZLE_SOLVED_EVENT, this.onPuzzleSolved, this);
        bus.on<PuzzleFailedEventPayload>(PUZZLE_FAILED_EVENT, this.onPuzzleFailed, this);
        bus.on(HEART_FLY_FINISHED_EVENT, this.onHeartFlyFinished, this);
    }


    private onAppStateChanged = (payload: AppStateChangedEventPayload): void => {
        this.showScreenFor(payload.to);

        // Thắng lần đầu trong ngày: popup Result bị GIỮ LẠI (không hẹn giờ mở)
        // ngay từ lúc thắng — xem onPuzzleSolved. Bấm "Tiếp tục" ở màn Streak
        // sẽ quay LẠI Gameplay (đúng session cũ, xem GameManager.onNavigate) — mở nốt popup
        // còn treo đó ĐÈ LÊN gameplay lúc này.
        if (payload.to === AppState.Gameplay) {
            console.log('[DEBUG UIManager] onAppStateChanged to Gameplay, pendingConnectTracksReady=', !!this.pendingConnectTracksReady, 'from=', payload.from);
            this.openPendingResultIfAny();
            // ConnectTracks (xác nhận từ user: thêm lại luồng Streak, giữ đúng thứ tự) — tàu đang
            // hoãn chạy đợi quay lại từ màn Streak (xem notifyConnectTracksReadyForTrain()), đúng
            // session cũ vừa thắng xong, chạy nốt chuỗi Tournament/LeaderboardPreview rồi mới resume.
            if (this.pendingConnectTracksReady) {
                const onReady = this.pendingConnectTracksReady;
                this.pendingConnectTracksReady = null;
                this.runConnectTracksReadyChain(onReady);
            }
            return;
        }
        if (payload.from === AppState.DailyStreak) {
            console.log('[DEBUG UIManager] onAppStateChanged FROM DailyStreak to', payload.to, '(NOT Gameplay — pendingConnectTracksReady sẽ bị xoá, xem block bên dưới)');
        }

        // "Mở app" — mốc đầu tiên (còn lại là sau khi thắng màn, xem openResultPopupForWin()) để
        // phát hiện kết quả giải đấu tuần trước đang chờ Claim/Continue. KHÔNG còn kiểm tra NGAY ở
        // đây nữa — MainMenuScreen tự báo lại (onMainMenuIntroFinished()) SAU KHI hiệu ứng vào
        // Home (nút mờ→đậm + logo) chạy xong hẳn + đợi thêm 1 khoảng, tránh popup hiện đè lên lúc
        // hiệu ứng đang chạy (trường hợp hay gặp nhất: giải đấu hết giờ lúc người chơi OFFLINE,
        // phát hiện ngay lúc mở app — MainMenu luôn là màn đầu tiên thấy sau Boot).

        // Bỏ dở luồng ăn mừng (ví dụ bấm back ở màn Streak thay vì "Tiếp tục") thay vì đi
        // tiếp về Gameplay — huỷ data còn treo, KHÔNG được để nó bất ngờ hiện đè lên ván
        // chơi HOÀN TOÀN KHÁC ở lần vào Gameplay kế tiếp.
        if (payload.from === AppState.DailyStreak) {
            this.pendingWinResultData = null;
            this.pendingLeaderboardPreview = null;
            // Bỏ dở luồng thắng ConnectTracks đang hoãn tàu — tránh tàu bất ngờ chạy đè lên 1 ván
            // HOÀN TOÀN KHÁC nếu người chơi vào lại Gameplay theo hướng khác (không phải "Tiếp tục"
            // từ Streak). Đồng bộ với bỏ dở Result/LeaderboardPreview ở trên.
            this.pendingConnectTracksReady = null;
        }
    };


    private onPuzzleSolved = (payload: PuzzleSolvedEventPayload): void => {
        if (payload.presentation === 'connectTracksInline') {
            // ConnectTracks KHÔNG dùng ResultPopup/nhánh hẹn giờ cũ nữa — chỉ dọn phòng còn lịch CŨ
            // treo lại (ví dụ từ 1 ván Dogdoku dở trước đó). CỐ TÌNH KHÔNG tiêu thụ
            // (consume()) LeaderboardPreviewPresentation ở đây — notifyConnectTracksReadyForTrain()
            // bên dưới mới là nơi tiêu thụ đúng lúc, đồng bộ với tàu chạy (xác nhận từ user: tàu
            // phải hoãn chạy cho tới khi luồng Tournament/LeaderboardPreview — đúng thứ tự ưu tiên
            // của ResultPopup thật — chạy xong).
            this.unschedule(this.openResultPopupForWin);
            this.unschedule(this.openLeaderboardPreviewForWin);
            this.pendingWinResultData = null;
            this.pendingLeaderboardPreview = null;
            this.awaitingHeartFlyForLeaderboard = false;
            this.setVictoryInputBlocked(false);
            return;
        }
        this.setVictoryInputBlocked(true);
        // Daily dùng CHUNG popup Result với campaign (thắng lẫn thua) — không còn DailyResultPopup riêng.
        // Daily không có snapshot leaderboard/màn kế (nextLevelId=null) nên rơi thẳng xuống nhánh Result.
        const data: ResultData = {
            outcome: 'win',
            context: payload.context,
            puzzleId: payload.puzzleId,
            nextLevelId: this.resolveNextLevel(payload.context, payload.puzzleId),
        };

        // Huỷ lịch cũ (nếu có) trước khi đặt lịch mới — tránh mở popup Result 2 lần nếu
        // PUZZLE_SOLVED_EVENT lỡ bắn liên tiếp.
        this.unschedule(this.openResultPopupForWin);
        this.unschedule(this.openLeaderboardPreviewForWin);
        this.awaitingHeartFlyForLeaderboard = false;
        this.pendingWinResultData = data;

        // Popup kích hoạt giải đấu (NewSession, lần ĐẦU TIÊN duy nhất — TournamentActivationPresentation)
        // giờ luôn hiện SAU CÙNG, sau khi Result (và Streak nếu có) đã đóng hết — xem
        // afterResultClosed()/maybeOpenTournamentActivation(). KHÔNG can thiệp gì ở đây nữa, cứ để
        // luồng thắng bình thường (Streak nếu firstToday -> Result) chạy y hệt các lần thắng khác.

        // Thắng 1 màn campaign: chèn popup leo hạng Weekly TRƯỚC Result — LeaderboardPreview ->
        // (Streak nếu là lần đầu trong ngày, luồng riêng của GameManager) -> Result. Chỉ campaign
        // mới có snapshot (GameManager chỉ .request() ở pushLeaderboardScore()/campaign).
        const leaderboardSnapshot =
            payload.context === 'campaign' ? LeaderboardPreviewPresentation.consume() : null;

        if (leaderboardSnapshot) {
            this.pendingLeaderboardPreview = leaderboardSnapshot;

            // Trường hợp đặc biệt: ĐÚNG màn này làm giải đấu tuần cũ HẾT GIỜ (GameManager.
            // pushLeaderboardScore() .request() TournamentPresentation CÙNG LÚC, xem
            // checkPendingTournamentResult()) — popup kết thúc giải đấu (kích hoạt giải mới/nhận
            // thưởng Top 3) phải hiện NGAY SAU KHI THẮNG MÀN ĐÓ, TRƯỚC LeaderboardPreview (yêu cầu
            // "thắng xong màn đó thì hiện popup giải đấu... xong mới hiện leaderboard preview").
            // KHÔNG mở LeaderboardPreview ở đây — giữ snapshot lại, rơi xuống luồng Result bình
            // thường bên dưới: Result đóng -> (onClosed) mở popup giải đấu -> (đóng xong) mới tới
            // lượt LeaderboardPreview (xem openResultPopupForWin()/maybeOpenTournamentResult()).
            if (TournamentPresentation.isPending()) {
                if (StreakPresentation.isPending()) return;
                this.scheduleOnce(this.openResultPopupForWin, resolveResultPopupDelay(payload.context));
                return;
            }

            // Thắng lần đầu trong ngày: GameManager tự chuyển sang màn Streak sau đúng
            // STREAK_REDIRECT_DELAY (== RESULT_POPUP_DELAY, CÙNG giá trị, race cùng scheduleOnce()
            // này) — KHÔNG hề đợi LeaderboardPreview đóng trước. Trước đây vẫn cứ scheduleOnce() ở
            // đây, nên 2 timer trùng giờ CHẠY ĐUA: enterStreakScreenDeferred() (GameManager, được
            // .schedule() TRƯỚC vì GameManager luôn nghe PUZZLE_SOLVED_EVENT trước UIManager) hầu
            // như LUÔN thắng, đổi currentScreenState sang DailyStreak TRƯỚC khi callback này kịp
            // chạy — openLeaderboardPreviewForWin() thấy currentScreenState != Gameplay, ÂM THẦM
            // BỎ QUA, mất luôn snapshot — đúng bug "thắng màn đầu tiên trong ngày, thắp chuỗi xong
            // không thấy leaderboardpreview hiện lên". KHÔNG hẹn giờ ở đây nữa — giữ snapshot lại,
            // chỉ mở SAU khi quay lại Gameplay từ màn Streak (openPendingResultIfAny), an toàn
            // tuyệt đối vì lúc đó chắc chắn currentScreenState đã là Gameplay.
            if (StreakPresentation.isPending()) return;

            // Đợi hiệu ứng tim bay (sau sóng chéo thắng màn) kết thúc RỒI MỚI mở LeaderboardPreview
            // — xem onHeartFlyFinished(); timer chỉ là dự phòng nếu event không bao giờ tới.
            this.awaitingHeartFlyForLeaderboard = true;
            this.scheduleOnce(this.openLeaderboardPreviewForWin, HEART_FLY_WAIT_FALLBACK_SECONDS);
            return;
        }

        // Thắng lần đầu trong ngày (cờ này GameManager đã đặt TRƯỚC khi PUZZLE_SOLVED_EVENT
        // tới lượt UIManager xử lý — xem GameManager.onPuzzleSolved): KHÔNG hẹn giờ mở ở
        // đây nữa, chỉ mở SAU khi quay lại Gameplay từ màn Streak (openPendingResultIfAny).
        if (StreakPresentation.isPending()) return;

        this.scheduleOnce(this.openResultPopupForWin, resolveResultPopupDelay(payload.context));
    };

    private awaitingHeartFlyForLeaderboard = false;

    private onHeartFlyFinished = (): void => {
        if (!this.awaitingHeartFlyForLeaderboard) return;

        this.awaitingHeartFlyForLeaderboard = false;
        this.unschedule(this.openLeaderboardPreviewForWin);
        this.scheduleOnce(this.openLeaderboardPreviewForWin, HEART_FLY_TO_LEADERBOARD_DELAY_SECONDS);
    };

    private openLeaderboardPreviewForWin = (): void => {
        this.awaitingHeartFlyForLeaderboard = false;
        const snapshot = this.pendingLeaderboardPreview;
        this.pendingLeaderboardPreview = null;
        if (!snapshot) return;
        if (this.currentScreenState !== AppState.Gameplay) return;

        // "Luồng mở Leaderboard[Preview] đang thiếu luồng mở Profile để đặt tên" (xác nhận từ user,
        // bám đúng luồng game gốc — cùng mục đích/cơ chế với maybeOpenTournamentActivation(), chỉ
        // khác chỗ áp dụng: MỌI lần Leaderboard[Preview] sắp mở, không riêng lần kích hoạt giải đấu
        // đầu tiên). Chưa đặt tên thì cắt hẳn chuỗi ở đây — KHÔNG mở LeaderboardPreview, KHÔNG mở
        // Result tiếp theo nó (giống hệt cách maybeOpenTournamentActivation() cắt afterResultClosed()).
        if (this.gateLeaderboardOnProfileName()) return;

        this.openPopup<LeaderboardPreviewSnapshot>(PopupId.LeaderboardPreview, snapshot, () => {
            // Đóng popup leo hạng xong: nếu KHÔNG phải lần đầu trong ngày thì mở Result luôn;
            // nếu là lần đầu trong ngày, cứ để pendingWinResultData nằm đó — sẽ được mở lại
            // sau khi quay về Gameplay từ màn Streak (openPendingResultIfAny), giống hệt luồng
            // Result thông thường phía trên.
            if (StreakPresentation.isPending()) return;
            this.openResultPopupForWin();
        });
    };

    /** "Bắt buộc có tên TRƯỚC khi Leaderboard mở ra thật sự" (xác nhận từ user — cùng mục đích đã
     * nêu ở maybeOpenTournamentActivation(), áp dụng rộng ra cho MỌI lần Leaderboard[Preview] sắp
     * mở chứ không riêng lần kích hoạt giải đấu đầu tiên). Chưa đặt tên: điều hướng về MainMenu +
     * mở ProfileEditPopup (hệ clientEvent cũ, độc lập AppState), trả về true để caller CẮT HẲN
     * chuỗi gọi tiếp theo (không mở Leaderboard[Preview] lần này) — giống hệt cách
     * maybeOpenTournamentActivation() không gọi onDone() khi chưa có tên. Đã có tên: không làm gì,
     * trả về false để caller tiếp tục bình thường. */
    private gateLeaderboardOnProfileName(): boolean {
        if (ProfileManager.instance?.getProfileChangeNameCompleted()) return false;
        const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
        clientEvent.dispatchEvent(Constants.SHOW_PROFILE_EDIT_POPUP);
        return true;
    }

    /**
     * "Luồng thắng ConnectTracks... tàu sẽ hoãn chạy cho đến khi luồng thắng của các popup khác
     * chạy xong" + "thêm lại luồng kích hoạt giải đấu và chuỗi vào ConnectTracks, giữ đúng thứ tự"
     * (xác nhận từ user) — gọi bởi GameplayScreen NGAY SAU notifyConnectTracksWon() (đã emit
     * PUZZLE_SOLVED_EVENT, GameManager xử lý xong tiến trình/điểm/cờ Tournament-pending/Streak-pending
     * TRƯỚC khi hàm này chạy tới). Chạy ĐÚNG thứ tự ưu tiên của ResultPopup thật (xem onPuzzleSolved):
     * Streak (nếu thắng lần đầu trong ngày) trước tiên — nếu đang pending thì HOÃN HẲN, chờ
     * GameManager tự chuyển màn Streak rồi quay lại Gameplay mới chạy tiếp (xem onAppStateChanged) —
     * rồi mới tới Tournament (giải đấu tuần vừa hết giờ), rồi LeaderboardPreview (nếu đã mở khoá +
     * có snapshot). `onReady` được gọi THAY CHO việc mở ResultPopup, đúng vị trí đó trong chuỗi, để
     * ConnectTracksVictoryView mới cho tàu chạy. Tournament kích hoạt lần đầu KHÔNG nằm trong chuỗi
     * này — xem continueConnectTracksWinAfterActivationCheck() (đúng vị trí "sau khi Result đóng"
     * của luồng thật, tức lúc người chơi bấm nút tiếp tục sau khi tàu chạy xong).
     */
    notifyConnectTracksReadyForTrain(onReady: () => void): void {
        if (StreakPresentation.isPending()) {
            this.pendingConnectTracksReady = onReady;
            // BUG đã sửa (báo lỗi của user — "màn Streak hiện đè lên lúc board còn đang di chuyển
            // ra giữa"): GameManager trước đây TỰ hẹn giờ (gần như ngay lập tức) chuyển sang màn
            // Streak ngay khi thắng, không hề biết animation ăn mừng của ConnectTracks (marks fade/
            // sao bay/board di chuyển ra giữa + dừng 0.3s) đã xong hay chưa — giờ GameManager không
            // tự hẹn giờ cho ConnectTracks nữa, CHỈ gọi ở ĐÚNG đây, nơi animation đã thật sự xong
            // (GameplayScreen gọi notifyConnectTracksReadyForTrain từ completed() của
            // ConnectTracksVictoryView, sau moveBoardToCenter() + dừng 0.3s — xem connectTracksVictoryView.ts).
            GameManager.instance.enterStreakScreen();
            return;
        }
        this.runConnectTracksReadyChain(onReady);
    }

    private runConnectTracksReadyChain(onReady: () => void): void {
        // BUG đã sửa ("vừa thắng xong giải đấu, popup chốt sổ hiện lên, sau đó LeaderboardPreview
        // vẫn hiện điểm CŨ (chưa reset), vẫn đang Top 1 với điểm cũ") — nhớ lại NGAY TỪ ĐẦU hàm
        // (trước khi maybeOpenTournamentResult() có thể chạy xong và reset currWeekScore) rằng
        // giải đấu ĐANG chờ chốt sổ, để biết snapshot LeaderboardPreviewPresentation sắp consume()
        // bên dưới có khả năng mang điểm CŨ (được request() lúc thắng, TRƯỚC khi giải đấu được
        // chốt sổ/reset) hay không.
        const tournamentWasPending = TournamentPresentation.isPending();

        const openPreviewThenReady = (): void => {
            let snapshot = LeaderboardPreviewPresentation.consume();
            if (!snapshot || this.currentScreenState !== AppState.Gameplay) {
                onReady();
                return;
            }
            // Giải đấu VỪA được chốt sổ (điểm về 0, bot mới) qua maybeOpenTournamentResult() ở dưới
            // — snapshot vừa consume() ở trên vẫn mang điểm của giải đấu CŨ (request() lúc thắng
            // màn này, trước khi reset). Dựng lại theo điểm HIỆN TẠI (đã reset) để LeaderboardPreview
            // hiện đúng bảng mới toanh — giống hệt cách maybeOpenTournamentResult() đã tự làm cho
            // luồng Dogdoku cũ (xem openNewSessionThenDone() ở đó).
            if (tournamentWasPending) {
                const currentScore = LegacyLeaderboardManager.instance?.getLeaderboardCurrWeekScore() ?? 0;
                snapshot = { oldScore: currentScore, newScore: currentScore };
            }
            // "Luồng mở Leaderboard[Preview] đang thiếu luồng mở Profile để đặt tên" (xác nhận từ
            // user) — cùng gate đã áp cho luồng Dogdoku cũ (xem openLeaderboardPreviewForWin()).
            // Chưa đặt tên: cắt hẳn chuỗi ở đây, KHÔNG mở LeaderboardPreview, KHÔNG gọi onReady()
            // (tàu KHÔNG chạy lần này — giống hệt cách Tournament/Streak hoãn tàu đang chờ xử lý
            // xong popup khác trước).
            if (this.gateLeaderboardOnProfileName()) return;
            this.openPopup<LeaderboardPreviewSnapshot>(PopupId.LeaderboardPreview, snapshot, onReady);
        };

        if (tournamentWasPending) {
            this.maybeOpenTournamentResult(openPreviewThenReady);
            return;
        }
        openPreviewThenReady();
    }

    /** Vị trí "sau khi Result đóng" của luồng thật (afterResultClosed() → maybeOpenTournamentActivation())
     * — ConnectTracks không có ResultPopup riêng nên áp đúng ngay trước khi thực sự chuyển màn kế
     * tiếp (nút "Tiếp tục" sau khi tàu chạy xong), giữ đúng thứ tự xuất hiện của luồng thật. */
    continueConnectTracksWinAfterActivationCheck(context: PuzzleContext, puzzleId: number): void {
        this.maybeOpenTournamentActivation(() => this.continueConnectTracksWin(context, puzzleId));
    }

    private openResultPopupForWin = (): void => {
        const data = this.pendingWinResultData;
        this.pendingWinResultData = null;
        if (!data) return;
        if (this.currentScreenState !== AppState.Gameplay) return;

        this.openPopup<ResultData>(PopupId.Result, data, () => this.afterResultClosed(data));
    };

    /** Chạy SAU KHI Result đóng HOÀN TOÀN (đã hết animation exit) — ResultPopup.onTapContinue()
     * giờ CHỈ đóng popup, không tự điều hướng nữa (xem doc ở đó). Với context campaign, phải chờ
     * xử lý xong popup giải đấu (kích hoạt lần đầu / kết quả tuần cũ, nếu có đang chờ) rồi MỚI
     * được thực hiện continueAfterResult() — nếu điều hướng NGAY lúc bấm nút (như code cũ), màn
     * kế tiếp (BoardView/RuleFrameIntro...) sẽ bắt đầu chạy hiệu ứng CHỒNG LÊN popup giải đấu còn
     * đang mở, đúng bug "popup kích hoạt giải đấu hiện ở đầu màn 11 trong khi hiệu ứng màn đã chạy
     * rồi". 2 nhánh activation/result LOẠI TRỪ LẪN NHAU trong thực tế (activation chỉ pending khi
     * CHƯA kích hoạt, result chỉ pending khi ĐÃ kích hoạt) nên xâu chuỗi cả 2 vô điều kiện là an
     * toàn — nếu không có gì đang chờ, onDone() của mỗi hàm chạy NGAY (đồng bộ), không trễ thêm gì
     * cho trường hợp bình thường (không liên quan giải đấu). */
    private afterResultClosed(data: ResultData): void {
        if (data.context !== 'campaign') {
            this.continueAfterResult(data);
            return;
        }

        this.maybeOpenTournamentActivation(() => {
            this.maybeOpenTournamentResult(() => this.continueAfterResult(data));
        });
    }

    /** Chuyển từ ResultPopup.onTapContinue() sang đây — hành động "Tiếp tục" thật sự (thua thì
     * thử lại màn đó, thắng mà hết màn kế thì về Home, còn lại thì sang màn kế tiếp). */
    private continueAfterResult(data: ResultData): void {
        if (data.outcome === 'lose') {
            const payload: LevelSelectedEventPayload = {
                context: data.context,
                levelId: data.context === 'campaign' ? data.puzzleId : null,
            };
            EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
            return;
        }

        if (data.nextLevelId === null) {
            const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
            EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
            return;
        }

        const payload: LevelSelectedEventPayload = {
            context: 'campaign',
            levelId: data.nextLevelId,
        };
        EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
    }

    /** Same progression/navigation resolution as Result, with no Result popup instance. */
    continueConnectTracksWin(context: PuzzleContext, puzzleId: number): void {
        this.continueAfterResult({ outcome: 'win', context, puzzleId,
            nextLevelId: this.resolveNextLevel(context, puzzleId) });
    }

    getConnectTracksNextLevel(context: PuzzleContext, puzzleId: number): number | null {
        return this.resolveNextLevel(context, puzzleId);
    }

    /** Dùng cả cho nút TEST (MainMenuScreen/SettingsPopup, gọi ngay sau
     * LeaderboardManager.resetWeeklyForTesting() để khỏi đợi chuyển AppState) LẪN production
     * (LeaderboardTabGroupManager.showInfo() — giải đấu hết giờ NGAY lúc người chơi đang đứng ở
     * Leaderboard, xem maybeOpenTournamentResult()). */
    checkTournamentPopupForTesting(): void {
        this.maybeOpenTournamentResult();
    }

    /** MainMenuScreen tự gọi lại SAU KHI hiệu ứng vào Home (nút mờ→đậm + logo) chạy xong HẲN + đã
     * đợi thêm 1 khoảng (xem MainMenuScreen.postIntroTournamentPopupDelaySeconds) — đây là mốc AN
     * TOÀN duy nhất để kiểm tra popup kích hoạt/kết quả giải đấu mỗi khi vào Home (thay cho việc
     * kiểm tra NGAY LÚC chuyển AppState.MainMenu như trước, dễ hiện đè lên lúc hiệu ứng đang chạy —
     * trường hợp hay gặp nhất: giải đấu vừa hết giờ lúc người chơi đang OFFLINE, phát hiện ngay lúc
     * mở app). */
    onMainMenuIntroFinished(): void {
        this.maybeOpenTournamentActivation();
        this.maybeOpenTournamentResult();
    }

    /** Nếu có kết quả giải đấu tuần trước đang chờ xử lý (TournamentPresentation — GameManager.
     * checkPendingTournamentResult() .request() ở MỌI mốc phát hiện được, xem doc của hàm đó), mở
     * ĐÚNG theo hạng — Top 3 → TournamentResultPopup (nhận thưởng) → đóng xong mới tới
     * TournamentResetPopup ("New Session", chốt sổ/kích hoạt giải đấu mới thật sự); không Top 3 →
     * thẳng TournamentResetPopup luôn. Popup TRƯỚC phải đóng HOÀN TOÀN (hết animation exit) rồi
     * mới mở popup SAU — không bao giờ để 2 popup cùng hiện chồng lên nhau lúc chuyển tiếp.
     *
     * Cho phép mở ở CẢ Gameplay (vừa thắng xong màn làm giải đấu hết giờ — xem
     * openResultPopupForWin()) LẪN MainMenu (boot / quay lại Home / đang đứng ở Leaderboard, popup
     * này layer đè lên popup Leaderboard đang mở, AppState vẫn là MainMenu).
     *
     * `onDone` chạy SAU KHI mọi việc ở đây xong xuôi (kể cả LeaderboardPreview theo sau nếu có) —
     * NGAY (đồng bộ) nếu không có gì đang chờ, hoặc sau khi TOÀN BỘ chuỗi popup đã đóng hết nếu có
     * — dùng để xâu chuỗi tiếp bước kế tiếp (afterResultClosed() → continueAfterResult()). */
    private maybeOpenTournamentResult(onDone: () => void = () => {}): void {
        const snapshot = TournamentPresentation.consume();
        if (!snapshot) {
            onDone();
            return;
        }
        if (this.currentScreenState !== AppState.MainMenu && this.currentScreenState !== AppState.Gameplay) {
            onDone();
            return;
        }

        const openNewSessionThenDone = (): void => {
            this.openPopup<void>(PopupId.TournamentReset, undefined as never, () => {
                // Giải đấu vừa reset (điểm về 0, bot mới) — snapshot preview chụp LÚC THẮNG còn mang
                // điểm của giải cũ. Dựng lại theo điểm hiện tại để preview hiện đúng bảng đã reset.
                if (this.pendingLeaderboardPreview) {
                    const currentScore = LegacyLeaderboardManager.instance?.getLeaderboardCurrWeekScore() ?? 0;
                    this.pendingLeaderboardPreview = { oldScore: currentScore, newScore: currentScore };
                }
                this.openLeaderboardPreviewForWin();
                onDone();
            });
        };

        if (snapshot.rank <= 3) {
            this.openPopup<TournamentResultSnapshot>(PopupId.TournamentResult, snapshot, openNewSessionThenDone);
        } else {
            openNewSessionThenDone();
        }
    }

    /** Người chơi hoàn toàn mới (đi từ tutorial): giải đấu Weekly CHƯA kích hoạt (xem
     * GameManager.checkTournamentActivation() / LeaderboardManager.hasTournamentActivated()) —
     * đã thắng ít nhất 1 màn campaign. Chỉ hiện đúng 1 lần; dùng CHUNG popup "New Session"
     * (PopupId.TournamentReset — xem doc TournamentResetPopup) với luồng chốt sổ tuần cũ, vì hành
     * động lẫn giao diện giống hệt nhau, chỉ khác đúng 1 nhánh code bên trong onShow() của nó.
     * KHÔNG còn dùng PopupId.TournamentActivation/TournamentActivationPopup nữa (giữ file, không
     * xoá, chỉ disconnect — cùng cách đã làm với Shop/RewardPopup trước đây).
     *
     * Luôn hiện SAU CÙNG — sau khi Result (và màn Streak, nếu firstToday) đã đóng hết, đúng lúc
     * afterResultClosed() gọi tới đây, KHÔNG hề can thiệp/chen ngang trước đó nữa.
     *
     * `onDone` chạy SAU KHI popup này (nếu có mở) đóng hoàn toàn, hoặc NGAY nếu không có gì đang
     * chờ — xem maybeOpenTournamentResult() để hiểu vì sao cần callback thay vì gọi thẳng. */
    private maybeOpenTournamentActivation(onDone: () => void = () => {}): void {
        const shouldOpen = TournamentActivationPresentation.consume();
        if (!shouldOpen) {
            onDone();
            return;
        }
        this.openPopup<void>(PopupId.TournamentReset, undefined as never, () => {
            // Đây LUÔN LÀ LẦN KÍCH HOẠT GIẢI ĐẤU ĐẦU TIÊN — TournamentActivationPresentation chỉ
            // .request() đúng 1 lần duy nhất cho người chơi hoàn toàn mới, ngay trước khi
            // hasTournamentActivated() chuyển true (xem GameManager.checkTournamentActivation()).
            // Các lần TournamentResetPopup hiện lại SAU NÀY (chốt sổ tuần) đi qua nhánh
            // TournamentPresentation hoàn toàn khác, KHÔNG chạm code này.
            //
            // gateLeaderboardOnProfileName(): chưa đặt tên thì tự điều hướng về MainMenu + mở
            // ProfileEditPopup rồi trả về true — cắt hẳn chuỗi afterResultClosed() ->
            // maybeOpenTournamentResult() -> continueAfterResult() ở đây (KHÔNG gọi onDone()), đúng
            // người chơi ở lại Main sau khi đóng popup đặt tên, không tiếp tục sang màn kế tiếp. Đã
            // có tên (getProfileChangeNameCompleted() — cùng cờ ProfileEditPopup.commitName() đặt
            // khi lưu tên khác mặc định): trả về false, luồng tiếp tục bình thường (sang màn 11).
            if (this.gateLeaderboardOnProfileName()) return;

            // BUG đã sửa ("vừa kích hoạt giải đấu lần đầu, điểm KHÔNG reset, vẫn đang Top 1 với điểm
            // cũ") — snapshot pendingLeaderboardPreview được chụp LÚC THẮNG màn này, TRƯỚC KHI
            // activateTournament() (chạy trong TournamentResetPopup.onShow()) reset currWeekScore về
            // 0 (vì addCurrWeekScore() cộng điểm VÔ ĐIỀU KIỆN kể cả màn trước khi giải đấu kích
            // hoạt — xem LeaderboardManager.activateTournament()). Dựng lại theo điểm hiện tại (đã
            // reset) để LeaderboardPreview hiện đúng bảng mới toanh, giống hệt cách
            // maybeOpenTournamentResult() đã làm cho luồng chốt sổ tuần cũ.
            if (this.pendingLeaderboardPreview) {
                const currentScore = LegacyLeaderboardManager.instance?.getLeaderboardCurrWeekScore() ?? 0;
                this.pendingLeaderboardPreview = { oldScore: currentScore, newScore: currentScore };
            }
            onDone();
        });
    }


    private onPuzzleFailed = (payload: PuzzleFailedEventPayload): void => {
        const data: ResultData = {
            outcome: 'lose',
            context: payload.context,
            puzzleId: payload.puzzleId,
            nextLevelId: null,
        };

        this.scheduleOnce(() => {
            if (this.currentScreenState !== AppState.Gameplay) return;

            // PHẢI truyền onClosed = afterResultClosed(data) — ResultPopup.onTapContinue() giờ
            // CHỈ đóng popup (xem doc ở đó), việc thật sự bắn LEVEL_SELECTED_EVENT để chơi lại đã
            // chuyển hẳn sang continueAfterResult() ở đây. Thiếu dòng này thì bấm "Chơi lại" sau
            // khi thua chỉ đóng popup rồi ĐỨNG YÊN mãi, không có gì điều hướng đi tiếp cả.
            this.openPopup<ResultData>(PopupId.Result, data, () => this.afterResultClosed(data));
        }, RESULT_LOSE_DELAY);
    };


    /** Quay lại Gameplay sau luồng "thắp chuỗi trước" — mở nốt popup còn bị hoãn (nếu có). Result
     * đi TRƯỚC LeaderboardPreview (khớp đúng thứ tự Result -> popup giải đấu -> LeaderboardPreview
     * của luồng bình thường, xem openResultPopupForWin()/maybeOpenTournamentResult()) — nếu ưu
     * tiên ngược lại (LeaderboardPreview trước), trường hợp giải đấu hết giờ TRÙNG lúc thắng lần
     * đầu trong ngày sẽ hiện sai thứ tự (LeaderboardPreview trước cả popup giải đấu). */
    private openPendingResultIfAny(): void {
        // Không có popup giải đấu nào đang chờ: quay lại từ Streak vẫn đi đúng luồng thắng thường
        // (LeaderboardPreview -> Result) — preview đóng xong tự mở Result (openLeaderboardPreviewForWin).
        // Trước đây Result luôn đi trước, đóng xong điều hướng sang màn kế nên preview bị bỏ mất.
        const tournamentPending = TournamentPresentation.isPending() || TournamentActivationPresentation.isPending();
        if (this.pendingLeaderboardPreview && this.pendingWinResultData && !tournamentPending) {
            this.openLeaderboardPreviewForWin();
            return;
        }

        if (this.pendingWinResultData) {
            const data = this.pendingWinResultData;
            this.pendingWinResultData = null;
            this.openPopup<ResultData>(PopupId.Result, data, () => this.afterResultClosed(data));
            return;
        }

        if (this.pendingLeaderboardPreview) {
            this.openLeaderboardPreviewForWin();
        }
    }

    private resolveNextLevel(context: PuzzleContext, puzzleId: number): number | null {
        const progression = ProgressionHolder.current;

        // "Sau khi chơi daily, nút Menu phải hiện màn campaign hiện tại của người chơi" (xác nhận
        // từ user) — daily không có "màn kế" thật (luôn puzzleId cố định/theo ngày, không có khái
        // niệm +1), nên trước đây luôn trả về null ở đây → nút Continue của ResultPopup luôn hiện
        // "Menu"/về MainMenu sau khi thắng daily. Giờ daily dùng CHUNG nhánh với tutorial — trả về
        // ĐÚNG level campaign hiện tại của người chơi (progression.getCurrentLevel()), để nút hiện
        // "Level N" và bấm vào là vào THẲNG màn campaign đó, giống hệt luồng tutorial đã có sẵn.
        if (context === 'tutorial' || context === 'daily') {
            return progression?.getCurrentLevel() ?? 1;
        }

        if (context !== 'campaign') return null;
        if (!progression) return null;

        const next = puzzleId + 1;
        return progression.isUnlocked(next) ? next : null;
    }


    private showScreenFor(state: AppState): void {
        this.screenLoadingTicket = null;
        // Prefab màn này nằm trong bundle lazy và chưa nạp: hiện overlay loading, nạp xong mới dựng.
        // Nếu đã nạp/prefetch xong (hoặc slot còn gán cứng) thì needsLazyScreen = false -> đi đường đồng bộ cũ.
        const lazyRoot = this.root;
        if (lazyRoot && state !== this.currentScreenState && lazyRoot.needsLazyScreen(state)) {
            this.loadScreenThenShow(state, lazyRoot);
            return;
        }
        if (state === AppState.DailyStreak && this.currentScreenState !== state) {
            const ticket = {};
            this.screenLoadingTicket = ticket;
            this.setPopupLoading(true);
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (!this.isValid || this.screenLoadingTicket !== ticket) return;
                this.scheduleOnce(() => {
                    if (this.screenLoadingTicket !== ticket) return;
                    try {
                        this.showScreenNow(state);
                    } finally {
                        if (this.screenLoadingTicket === ticket) this.screenLoadingTicket = null;
                        this.setPopupLoading(this.pendingPopupOpens.size > 0);
                    }
                }, 0);
            });
            return;
        }
        this.setPopupLoading(this.pendingPopupOpens.size > 0);
        this.showScreenNow(state);
    }

    /**
     * Đảm bảo prefab của màn `state` (nếu nằm trong bundle lazy) ĐÃ nạp xong, hiện overlay loading trong lúc chờ.
     * GameManager gọi TRƯỚC khi đổi state để showScreenFor() đi đường đồng bộ (xem screenPreparer.ts).
     */
    async prepareScreen(state: AppState): Promise<void> {
        const root = this.root;
        if (!root || !root.needsLazyScreen(state)) return;
        this.setPopupLoading(true);
        try {
            await root.ensureScreenPrefab(state);
        } finally {
            if (this.isValid) this.setPopupLoading(this.pendingPopupOpens.size > 0);
        }
    }

    private loadScreenThenShow(state: AppState, root: UIRoot): void {
        const ticket = {};
        this.screenLoadingTicket = ticket;
        this.setPopupLoading(true);
        const startedAt = Date.now();
        console.log(`[UIManager] Nạp màn lazy '${state}' từ bundle...`);
        const finish = (): void => {
            if (!this.isValid) return;
            if (this.screenLoadingTicket === ticket) this.screenLoadingTicket = null;
            this.setPopupLoading(this.pendingPopupOpens.size > 0);
        };
        root.ensureScreenPrefab(state).then(
            () => {
                console.log(`[UIManager] Màn lazy '${state}' đã nạp sau ${Date.now() - startedAt}ms.`);
                // Đã có chuyển màn khác chen vào trong lúc đang tải -> bỏ lượt này.
                if (!this.isValid || this.screenLoadingTicket !== ticket) {
                    console.warn(`[UIManager] Bỏ qua dựng màn '${state}': đã có chuyển màn khác chen vào (currentScreenState=${this.currentScreenState}).`);
                    return;
                }
                try {
                    this.showScreenNow(state);
                } catch (error) {
                    console.error(`[UIManager] Không dựng được màn '${state}':`, error);
                } finally {
                    finish();
                }
            },
            (error: unknown) => {
                console.error(`[UIManager] Không tải được màn '${state}' từ bundle:`, error);
                finish();
            },
        );
    }

    private showScreenNow(state: AppState): void {
        if (this.currentScreenState === state) return;
        // Streak có thể xuất hiện trước popup kết quả: màn mới phải nhận được thao tác.
        this.setVictoryInputBlocked(false);

        console.log('[DEBUG UIManager] showScreenNow:', JSON.stringify({
            targetState: state, currentScreenState: this.currentScreenState,
            hasCurrentScreen: !!this.currentScreen, hasSuspendedGameplayScreen: !!this.suspendedGameplayScreen,
            streakPending: StreakPresentation.isPending(),
        }));

        // Quay LẠI Gameplay đúng lúc có 1 bản GameplayScreen đang treo (bị ẩn, không destroy —
        // xem nhánh "tạm ẩn" bên dưới) — dựng lại NGUYÊN VẸN bản đó thay vì instantiate() bản mới
        // tinh (sẽ mất sạch connectTracksSession/victory sequence đang tạm dừng chờ resume()).
        if (state === AppState.Gameplay && this.suspendedGameplayScreen) {
            console.log('[DEBUG UIManager] showScreenNow: RESUME branch taken');
            this.closeAllPopups();
            this.closeCurrentScreen();
            const screen = this.suspendedGameplayScreen;
            this.suspendedGameplayScreen = null;
            screen.node.active = true;
            // Gỡ cờ "đang tạm ẩn" NGAY SAU KHI active=true — xem setSuspended() ở
            // ConnectTracksVictoryView: từ giờ 1 lần onDisable() thật (đóng hẳn) phải cancel() lại
            // như cũ.
            (screen.node.getComponent('GameplayScreen') as GameplayScreen | null)
                ?.connectTracksVictory?.setSuspended(false);
            this.currentScreen = screen;
            this.currentScreenState = state;
            return;
        }

        // BUG đã sửa (báo lỗi của user: "sau streak thì lại bắt người chơi chơi lại màn [X] từ
        // đầu"): mọi lần chuyển màn BÌNH THƯỜNG destroy() hẳn node màn cũ rồi instantiate() lại 1
        // bản HOÀN TOÀN MỚI khi quay lại (xem nhánh else bên dưới) — GameplayScreen không phải
        // singleton sống xuyên suốt, nên MỌI field runtime (connectTracksSession, currentPuzzleId,
        // victory sequence đang tạm dừng chờ resume...) biến mất sạch theo node cũ dù onClose() có
        // cố "giữ lại" gì cũng vô nghĩa — instance đó bị destroy() ngay sau đó. Trường hợp DUY NHẤT
        // cần giữ NGUYÊN VẸN y hệt lúc rời đi là "thắng lần đầu trong ngày" → tạm sang Streak ăn
        // mừng → sắp quay LẠI ĐÚNG session đó (StreakPresentation.isPending() đúng lúc này — đặt cờ
        // ở GameManager.onPuzzleSolved, TRƯỚC KHI DailyStreakScreen kịp tiêu thụ) — CHỈ ẩn node
        // (active=false), KHÔNG close()/destroy() gì cả, để mọi state + coroutine JS đang chạy dở
        // (Promise không phụ thuộc active của node) tự nhiên sống sót nguyên vẹn; nhánh resume ở
        // trên sẽ hiện lại (active=true) đúng bản này khi quay về Gameplay.
        if (state === AppState.DailyStreak && this.currentScreenState === AppState.Gameplay
            && this.currentScreen && StreakPresentation.isPending()) {
            console.log('[DEBUG UIManager] showScreenNow: SUSPEND branch taken');
            this.closeAllPopups();
            // PHẢI đặt cờ "đang tạm ẩn" TRƯỚC khi set active=false — Cocos gọi onDisable() của MỌI
            // component active trong node đó NGAY TRONG CÙNG lệnh gán active=false (đồng bộ), không
            // phải đợi tới frame sau. Đặt cờ sau active=false là quá trễ, onDisable() đã chạy xong.
            (this.currentScreen.node.getComponent('GameplayScreen') as GameplayScreen | null)
                ?.connectTracksVictory?.setSuspended(true);
            this.suspendedGameplayScreen = this.currentScreen;
            this.currentScreen.node.active = false;
            this.currentScreen = null;
        } else {
            console.log('[DEBUG UIManager] showScreenNow: ELSE/fresh-instantiate branch taken', JSON.stringify({
                reason: state !== AppState.DailyStreak ? 'state!=DailyStreak'
                    : this.currentScreenState !== AppState.Gameplay ? 'currentScreenState!=Gameplay'
                    : !this.currentScreen ? 'no currentScreen'
                    : 'StreakPresentation.isPending()=false',
            }));
            this.closeAllPopups();
            this.closeCurrentScreen();
            // An toàn: nếu có 1 bản GameplayScreen đang treo (suspendedGameplayScreen) mà lần
            // chuyển màn NÀY lại không phải "quay về Gameplay" (vd bấm back ở Streak về MainMenu
            // thay vì "Tiếp tục") — dọn hẳn nó ở đây, tránh rò rỉ node mãi mãi không ai destroy().
            if (this.suspendedGameplayScreen) {
                console.log('[DEBUG UIManager] showScreenNow: leaking suspendedGameplayScreen cleaned up here');
                this.suspendedGameplayScreen.close();
                this.suspendedGameplayScreen.node.destroy();
                this.suspendedGameplayScreen = null;
            }
        }

        const root = this.requireRoot();
        const prefab = root.getScreenPrefab(state);

        if (!prefab) {
            this.currentScreenState = state;
            return;
        }

        const node = instantiate(prefab);
        node.parent = root.screenLayer;

        const screen = node.getComponent(UIScreen);
        if (!screen) {
            throw new Error(`[UIManager] Prefab của ${state} thiếu component kế thừa UIScreen.`);
        }

        this.currentScreen = screen;
        this.currentScreenState = state;
        if (state === AppState.Gameplay && this.connectTracksLevels) {
            const gameplay = node.getComponent('GameplayScreen') as GameplayScreen | null;
            gameplay?.setConnectTracksLevels(this.connectTracksLevels);
        }
        screen.attachPopups(this);
        screen.open();
        this.scheduleLazyPrefetch();
    }

    private lazyPrefetchScheduled = false;

    /** Sau khi màn ĐẦU TIÊN đã hiện: tải ngầm các prefab lazy (xem UIRoot.prefetchLazy). Chỉ 1 lần. */
    private scheduleLazyPrefetch(): void {
        if (this.lazyPrefetchScheduled || !this.root) return;
        this.lazyPrefetchScheduled = true;
        this.scheduleOnce(() => this.root?.prefetchLazy(), 1);
    }

    private closeCurrentScreen(): void {
        if (!this.currentScreen) return;

        this.currentScreen.close();
        this.currentScreen.node.destroy();
        this.currentScreen = null;
    }

 
    openPopup<TData>(id: PopupId, data: TData, onClosed?: () => void): void {
        if (this.pendingPopupOpens.has(id)) return;
        if (this.popupPool.has(id)) {
            this.showPopupNow(id, data, onClosed);
            return;
        }
        const root = this.requireRoot();
        const lazy = !root.getPopupPrefab(id) && root.canLazyLoadPopup(id);
        if (!lazy && !root.getPopupPrefab(id)) {
            console.warn(`[UIManager] Chưa gán prefab cho popup '${id}' trong UIRoot — bỏ qua.`);
            return;
        }
        const ticket = {};
        this.pendingPopupOpens.set(id, ticket);
        this.setPopupLoading(true);
        const lazyStartedAt = Date.now();
        if (lazy) console.log(`[UIManager] Nạp popup lazy '${id}' từ bundle...`);
        const present = (): void => {
            // Vẽ loading trước. Không instantiate trong callback AFTER_DRAW vì browser
            // vẫn cần trả quyền điều khiển để trình bày frame vừa vẽ.
            director.once(Director.EVENT_AFTER_DRAW, () => {
                if (!this.isValid || this.pendingPopupOpens.get(id) !== ticket) return;
                this.scheduleOnce(() => {
                    if (this.pendingPopupOpens.get(id) !== ticket) return;
                    try {
                        if (this.root === root && root.isValid) this.showPopupNow(id, data, onClosed);
                    } catch (error) {
                        console.error(`[UIManager] Không mở được popup '${id}':`, error);
                    } finally {
                        if (this.pendingPopupOpens.get(id) === ticket) this.pendingPopupOpens.delete(id);
                        this.setPopupLoading(this.pendingPopupOpens.size > 0);
                    }
                }, 0);
            });
        };
        if (!lazy) {
            present();
            return;
        }
        // Prefab nằm trong bundle lazy: tải xong mới dựng. Lỗi mạng -> dọn overlay và gọi onClosed để luồng
        // gọi (vd sau popup kết quả) không bị kẹt chờ popup không bao giờ mở.
        root.ensurePopupPrefab(id).then(
            () => {
                console.log(`[UIManager] Popup lazy '${id}' đã nạp sau ${Date.now() - lazyStartedAt}ms.`);
                if (!this.isValid || this.pendingPopupOpens.get(id) !== ticket) return;
                present();
            },
            (error: unknown) => {
                console.error(`[UIManager] Không tải được popup '${id}' từ bundle:`, error);
                if (!this.isValid || this.pendingPopupOpens.get(id) !== ticket) return;
                this.pendingPopupOpens.delete(id);
                this.setPopupLoading(this.pendingPopupOpens.size > 0);
                onClosed?.();
            },
        );
    }

    private setPopupLoading(active: boolean): void {
        active = active || this.screenLoadingTicket !== null;
        if (!this.popupLoadingLayer && active) {
            const root = this.requireRoot();
            const layer = new Node('PopupLoadingOverlay');
            layer.layer = root.popupLayer.layer;
            layer.parent = root.node;
            layer.addComponent(BlockInputEvents);
            const size = view.getVisibleSize();
            layer.addComponent(UITransform).setContentSize(size.width * 2, size.height * 2);
            // Dùng nguyên node icon + Sprite + IconLoading2 đã thiết kế trong prefab.
            const template = root.getPopupPrefab(PopupId.Settings)?.data.getComponent(UIPopup)?.loadingIcon;
            if (!template) {
                layer.destroy();
                console.warn('[UIManager] SettingsPopup chưa gán loadingIcon.');
                return;
            }
            const spinner = instantiate(template);
            spinner.layer = layer.layer;
            spinner.parent = layer;
            spinner.active = true;
            this.popupLoadingLayer = layer;
            this.popupLoadingSpinner = spinner;
        }
        if (!this.popupLoadingLayer || !this.popupLoadingSpinner) return;
        this.popupLoadingLayer.active = active;
        if (active) {
            this.popupLoadingLayer.setSiblingIndex(-1);
            this.popupLoadingSpinner.angle = 0;
        }
    }

    private showPopupNow<TData>(id: PopupId, data: TData, onClosed?: () => void): void {
        const acquired = this.acquirePopup(id);
        if (!acquired) return;

        // Popup này đã đang mở (còn trong popupStack) — không mở/show() lại lần nữa, tránh
        // onShow() (và các hiệu ứng/particle bên trong) chạy trùng lặp nếu event kích hoạt
        // popup lỡ bắn 2 lần.
        if (this.popupStack.indexOf(acquired) >= 0) return;

        const popup = acquired as unknown as UIPopup<TData>;
        const entry = acquired;

       
        const shownData = id === PopupId.Settings ? (this.buildSettingsData() as TData) : data;

        popup.node.setSiblingIndex(this.requireRoot().popupLayer.children.length - 1);
        this.popupStack.push(entry);

        AudioManager.maybeInstance?.playDialogOpen();

        popup.show(shownData, () => {
            const index = this.popupStack.indexOf(entry);
            if (index >= 0) this.popupStack.splice(index, 1);
            if (onClosed) onClosed();
        });
        this.setVictoryInputBlocked(false);
    }

    private setVictoryInputBlocked(blocked: boolean): void {
        if (!this.victoryInputBlocker && blocked) {
            const root = this.requireRoot();
            const node = new Node('VictoryInputBlocker');
            node.layer = root.screenLayer.layer;
            node.parent = root.screenLayer;
            node.addComponent(UITransform);
            node.addComponent(BlockInputEvents);
            this.victoryInputBlocker = node;
        }
        const node = this.victoryInputBlocker;
        if (!node) return;
        node.active = blocked;
        if (blocked) {
            const size = view.getVisibleSize();
            node.getComponent(UITransform)!.setContentSize(size.width * 2, size.height * 2);
            node.setSiblingIndex(-1);
        }
    }

    private buildSettingsData(): SettingsData {
        const s = SaveManager.instance.playerData.settings;
        return {
            bgmOn: s.bgmVolume > 0,
            sfxOn: s.sfxVolume > 0,
            vibrationOn: s.vibration,
            // Chỉ có ván đang chơi (để Home/Restart) khi Settings được mở từ màn Gameplay.
            showReplay: this.currentScreenState === AppState.Gameplay,
        };
    }

    closeTopPopup(): boolean {
        const pending = Array.from(this.pendingPopupOpens.keys()).pop();
        if (pending !== undefined) {
            this.pendingPopupOpens.delete(pending);
            this.setPopupLoading(this.pendingPopupOpens.size > 0);
            return true;
        }
        const top = this.popupStack[this.popupStack.length - 1];
        if (!top) return false;

        top.forceClose();
        return true;
    }

    closeAllPopups(): void {
        this.pendingPopupOpens.clear();
        this.setPopupLoading(false);
        while (this.popupStack.length > 0) {
            this.popupStack[this.popupStack.length - 1].forceClose();
        }
    }

    get hasOpenPopup(): boolean {
        return this.popupStack.length > 0 || this.pendingPopupOpens.size > 0;
    }

 
    private acquirePopup(id: PopupId): UIPopup<never> | null {
        const pooled = this.popupPool.get(id);
        if (pooled) return pooled;

        const root = this.requireRoot();
        const prefab: Prefab | null = root.getPopupPrefab(id);
        if (!prefab) {
            console.warn(`[UIManager] Chưa gán prefab cho popup '${id}' trong UIRoot — bỏ qua.`);
            return null;
        }

        const node: Node = instantiate(prefab);
        node.parent = root.popupLayer;
        node.active = false;

        const popup = node.getComponent(UIPopup) as UIPopup<never> | null;
        if (!popup) {
            throw new Error(`[UIManager] Prefab '${id}' thiếu component kế thừa UIPopup.`);
        }

        popup.attachPopups(this); 
        this.popupPool.set(id, popup);
        return popup;
    }


    setBlockInput(blocked: boolean): void {
        if (this.root && this.root.blockInputLayer) {
            this.root.blockInputLayer.active = blocked;
        }
    }

    private requireRoot(): UIRoot {
        if (!this.root) {
            throw new Error('[UIManager] attachToScene() chưa chạy — UIRoot chưa sẵn sàng.');
        }
        return this.root;
    }
}
