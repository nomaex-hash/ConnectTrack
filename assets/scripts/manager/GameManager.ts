import { _decorator, Component } from 'cc';
import { AppState, canTransition } from '../core/AppState';
import { EventManager } from '../core/EventManager';
import { GameConfig } from '../config/GameConfig';
import { PuzzleContext } from '../model/BoardSaveData';
import { today } from '../utility/DateUtil';
import {
    APP_STATE_CHANGED_EVENT,
    AppStateChangedEventPayload,
} from '../event/AppStateChangedEvent';
import {
    HINT_GRANT_REQUESTED_EVENT,
    HintGrantRequestedEventPayload,
    LEVEL_SELECTED_EVENT,
    LEVEL_UNLOCKED_EVENT,
    LevelSelectedEventPayload,
    LevelUnlockedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
    PLACE_DOG_GRANT_REQUESTED_EVENT,
    PlaceDogGrantRequestedEventPayload,
    SETTINGS_CHANGE_REQUESTED_EVENT,
    SETTINGS_CHANGED_EVENT,
    SettingsChangeRequestedEventPayload,
    SettingsChangedEventPayload,
} from '../event/AppEvents';
import {
    HEART_FLY_FINISHED_EVENT,
    HINT_SHOWN_EVENT,
    HintShownEventPayload,
    PLACE_DOG_USED_EVENT,
    PUZZLE_FAILED_EVENT,
    PUZZLE_SOLVED_EVENT,
    PlaceDogUsedEventPayload,
    PuzzleSolvedEventPayload,
    PuzzleFailedEventPayload,
} from '../event/PuzzleEvents';
import { PuzzleSession } from '../gameplay/PuzzleSession';
import { PuzzleSessionHolder } from '../gameplay/PuzzleSessionHolder';
import { RankService } from '../gameplay/ranking/RankService';
import { StreakPresentation } from '../gameplay/streak/StreakPresentation';
import { ProgressionSystem } from '../gameplay/progression/ProgressionSystem';
import { ProgressionHolder } from '../gameplay/progression/ProgressionHolder';
import { DailyPuzzleService } from '../service/DailyPuzzleService';
import { DailyServiceHolder } from '../service/DailyServiceHolder';
import {
    DAILY_CHALLENGE_SOLVED_EVENT,
    DailyChallengeSolvedEventPayload,
} from '../event/DailyEvents';
import { LocalPuzzleProvider } from '../service/LocalPuzzleProvider';
import { resolveCampaignPuzzleDataId } from '../config/LevelListConfig';
import { ShopIAPManager } from '../service/shop/ShopIAPManager';
import { ShopIAPManagerHolder } from '../service/shop/ShopIAPManagerHolder';
import { LeaderboardManager } from '../gameplay/leaderboard/LeaderboardManager';
import { LeaderboardManagerHolder } from '../gameplay/leaderboard/LeaderboardManagerHolder';
import { ProfileManager } from '../gameplay/profile/ProfileManager';
import { ProfileManagerHolder } from '../gameplay/profile/ProfileManagerHolder';
import { FBInstantManagerHolder } from '../service/platform/FBInstantManagerHolder';
import { PGSPlayInstantManagerHolder } from '../service/backend/PGSPlayInstantManagerHolder';
import { PaymentServiceHolder } from '../service/payment/PaymentServiceHolder';
import { PlayerBackendService } from '../service/backend/PlayerBackendService';
import { ScoreBackendService, LeaderboardFetchResult } from '../service/backend/ScoreBackendService';
import { RemoteConfigService } from '../service/backend/RemoteConfigService';
import { NotificationBackendService } from '../service/backend/NotificationBackendService';
import { LeaderboardManager as LegacyLeaderboardManager } from '../leaderboard/LeaderboardManager';
import { localConfig } from '../localConfig';
import { configuration } from '../framework/configuration';
import { LeaderboardPreviewPresentation } from '../gameplay/leaderboardpreview/LeaderboardPreviewPresentation';
import { TournamentPresentation } from '../gameplay/tournament/TournamentPresentation';
import { TournamentActivationPresentation } from '../gameplay/tournament/TournamentActivationPresentation';
import { GameResource } from '../datainfo/GameResource';
import { RESOURCE_TYPE, BOOSTER_TYPE } from '../framework/constants';
import { AnalyticsBackendService } from '../service/backend/AnalyticsBackendService';
import {
    COIN_EXCHANGE_COMPLETED_EVENT,
    CoinExchangeCompletedEventPayload,
    SHOP_PURCHASE_COMPLETED_EVENT,
    ShopPurchaseCompletedEventPayload,
} from '../event/ShopEvents';
import { findCoinExchangeOption } from '../config/CoinExchangeConfig';
import { IPuzzleProvider } from '../service/IPuzzleProvider';
import { SaveManager } from './SaveManager';
import { Localization } from '../localization/Localization';
import { L10N } from '../localization/LocalizationKeys';
import { ScreenPreparer } from '../ui/screenPreparer';

const { ccclass } = _decorator;

/** Đặt chó cuối cùng xong: đợi hoạt ảnh chó xuất hiện chạy hết rồi MỚI chuyển sang màn Streak.
 * Chỉ dùng khi Leaderboard CHƯA mở (group tim không chạy — xem GameplayScreen.onVictoryWaveFinished),
 * còn lại (đã mở Leaderboard) chờ HEART_FLY_FINISHED_EVENT + STREAK_HEART_FLY_DELAY_SECONDS thay vào. */
const STREAK_REDIRECT_DELAY = GameConfig.dogAppearDurationSeconds + 0.25;

/** Dừng bao lâu (giây) SAU KHI hiệu ứng tim bay vào label (GameplayScreen) kết thúc rồi mới chuyển
 * sang màn Streak — chỉ áp dụng khi Leaderboard đã mở (group tim có chạy). */
const STREAK_HEART_FLY_DELAY_SECONDS = 0.5;

/** Dự phòng: nếu HEART_FLY_FINISHED_EVENT không bao giờ tới, vẫn chuyển màn Streak sau chừng này
 * giây kể từ lúc thắng (không được đứng yên mãi). */
const STREAK_HEART_FLY_FALLBACK_SECONDS = 15;


@ccclass('GameManager')
export class GameManager extends Component {
    private static _instance: GameManager | null = null;
    static get instance(): GameManager {
        if (!this._instance) throw new Error('GameManager chưa được khởi tạo.');
        return this._instance;
    }

    private _state: AppState = AppState.Boot;
    get state(): AppState {
        return this._state;
    }

    private readonly puzzleProvider: IPuzzleProvider = new LocalPuzzleProvider();

    private progression: ProgressionSystem | null = null;
    private dailyService: DailyPuzzleService | null = null;
    private shopService: ShopIAPManager | null = null;
    private leaderboard: LeaderboardManager | null = null;
    private profile: ProfileManager | null = null;
    private playerBackend: PlayerBackendService | null = null;
    private scoreBackend: ScoreBackendService | null = null;
    private remoteConfig: RemoteConfigService | null = null;
    private notificationBackend: NotificationBackendService | null = null;
    private analyticsBackend: AnalyticsBackendService | null = null;

    private session: PuzzleSession | null = null;
    private sessionContext: PuzzleContext = 'campaign';
    private sessionPuzzleId = 0;

    onLoad(): void {
        GameManager._instance = this;
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        if (GameManager._instance === this) GameManager._instance = null;
    }

  
    initSystems(): void {
        const playerData = SaveManager.instance.playerData;
        this.progression = new ProgressionSystem(playerData.progression);
        this.dailyService = new DailyPuzzleService(playerData.daily);
        this.shopService = new ShopIAPManager(playerData.shopPurchases);
        this.leaderboard = new LeaderboardManager(playerData.leaderboardState);
        this.profile = new ProfileManager(playerData.profile);

        ProgressionHolder.set(this.progression);
        DailyServiceHolder.set(this.dailyService);
        ShopIAPManagerHolder.set(this.shopService);
        LeaderboardManagerHolder.set(this.leaderboard);
        ProfileManagerHolder.set(this.profile);

        // Đồng bộ NGAY LÚC BOOT, không chờ thắng màn tiếp theo — nếu không, sau khi reset tiến
        // trình (SaveManager) thì Global (đọc localConfig.instance.currLevelUnlock, một hệ lưu
        // tách biệt) vẫn hiện số CŨ trước khi reset cho tới khi thắng thêm 1 màn mới.
        localConfig.instance.currLevelUnlock = this.progression.completedCount;
        configuration.instance.setData_LevelCurrentUnlock(this.progression.completedCount);

        // Tải trước NGAY LÚC VỪA VÀO GAME màn hiện tại của người chơi (mirror
        // handleTutorialSolved()/handleDailySolved() — cùng lý do: bấm vào chơi là vào ngay,
        // không phải đợi load) — trước đây chỉ preload sau khi giải xong 1 màn, nên lần đầu vào
        // game (hoặc mở lại app) vẫn phải đợi load màn hiện tại từ đầu.
        this.puzzleProvider.preload('campaign', resolveCampaignPuzzleDataId(this.progression.getCurrentLevel()));

        // Bootloader đã set FBInstantManagerHolder/PGSPlayInstantManagerHolder trước khi gọi initSystems()
        // (xem Bootloader.runBootSequence) — 2 service này CHỈ phối hợp gọi backend, không tự
        // giữ state riêng nên không cần Holder riêng, GameManager giữ thẳng làm field.
        this.playerBackend = new PlayerBackendService(PGSPlayInstantManagerHolder.current, FBInstantManagerHolder.current);
        this.scoreBackend = new ScoreBackendService(PGSPlayInstantManagerHolder.current, FBInstantManagerHolder.current);
        this.remoteConfig = new RemoteConfigService(PGSPlayInstantManagerHolder.current);
        this.notificationBackend = new NotificationBackendService(
            PGSPlayInstantManagerHolder.current,
            FBInstantManagerHolder.current,
        );
        this.analyticsBackend = new AnalyticsBackendService(
            PGSPlayInstantManagerHolder.current,
            FBInstantManagerHolder.current,
        );

        this.playerBackend.registerPlayer().catch((error: unknown) => {
            console.warn('[GameManager] registerPlayer thất bại:', error);
        });
        // Chưa có tính năng nào đọc remoteConfig (không banner/interstitial/tournament như
        // dự án gốc) — gọi 1 lần lúc boot để backend ghi nhận phiên chơi, kết quả CHƯA dùng
        // tới field nào cụ thể (xem RemoteConfigService).
        this.remoteConfig.fetch().catch((error: unknown) => {
            console.warn('[GameManager] fetch remoteConfig thất bại:', error);
        });

        this.subscribe();
        this.checkPendingTournamentResult();
        // BUG đã sửa (báo lỗi của user, kèm ảnh: "thắng level 10 rồi thoát game trước khi bấm popup
        // kích hoạt — vào lại ở level 11 nhưng popup kích hoạt giải đấu không hiện ở Main"):
        // checkTournamentActivation() trước đây CHỈ được gọi ở 2 nơi — (1) ngay sau khi thắng đúng
        // level mở Leaderboard, (2) lúc quay lại Home qua onNavigate (NAVIGATE_REQUESTED_EVENT) —
        // CẢ 2 đều KHÔNG chạy lúc mới mở app (Bootloader gọi thẳng changeState(MainMenu), không qua
        // onNavigate/sự kiện gì cả) — TournamentActivationPresentation._pending chỉ sống trong bộ
        // nhớ (không lưu save), nên nếu người chơi thoát app TRƯỚC KHI popup kịp hiện, nó mất sạch
        // và không có gì gọi lại checkTournamentActivation() ở lần mở app kế tiếp. Gọi thêm Ở ĐÂY
        // (boot), cùng chỗ với checkPendingTournamentResult() — che hết trường hợp còn thiếu.
        this.checkTournamentActivation();
    }

    private subscribe(): void {
        const bus = EventManager.instance;
        bus.on<NavigateRequestedEventPayload>(NAVIGATE_REQUESTED_EVENT, this.onNavigate, this);
        bus.on<LevelSelectedEventPayload>(LEVEL_SELECTED_EVENT, this.onLevelSelected, this);
        bus.on<PuzzleSolvedEventPayload>(PUZZLE_SOLVED_EVENT, this.onPuzzleSolved, this);
        bus.on(HEART_FLY_FINISHED_EVENT, this.onHeartFlyFinishedForStreak, this);
        bus.on<PuzzleFailedEventPayload>(PUZZLE_FAILED_EVENT, this.onPuzzleFailed, this);
        bus.on<PlaceDogUsedEventPayload>(PLACE_DOG_USED_EVENT, this.onPlaceDogUsed, this);
        bus.on<HintShownEventPayload>(HINT_SHOWN_EVENT, this.onHintShown, this);
        bus.on<PlaceDogGrantRequestedEventPayload>(
            PLACE_DOG_GRANT_REQUESTED_EVENT,
            this.onPlaceDogGrantRequested,
            this,
        );
        bus.on<HintGrantRequestedEventPayload>(HINT_GRANT_REQUESTED_EVENT, this.onHintGrantRequested, this);
        bus.on<SettingsChangeRequestedEventPayload>(
            SETTINGS_CHANGE_REQUESTED_EVENT,
            this.onSettingsChangeRequested,
            this,
        );
    }


    getProgression(): ProgressionSystem {
        if (!this.progression) throw new Error('GameManager.initSystems() chưa chạy.');
        return this.progression;
    }

    /** DÙNG ĐỂ TEST — nhảy tới levelId (nút nhập level ở Settings, xem SettingsPopup.
     * onJumpToLevelEditingEnded()) phải "giả lập" luôn là ĐÃ THẮNG hết các màn TRƯỚC levelId, không
     * chỉ mở màn chơi đó lên — nếu không, mọi cờ mở khoá phụ thuộc progression.isCompleted() (streak
     * ở GameConfig.streakUnlockLevel, Leaderboard ở GameConfig.leaderboardUnlockLevel, kích hoạt
     * giải đấu...) vẫn đứng yên ở trạng thái CŨ, không khớp với level đang test (xác nhận từ user:
     * "ở level nào thì cũng để test luôn luồng ở level đó"). Ghi THẲNG vào save
     * (progression.highestLevel) thay vì gọi markCompleted() — hàm đó CHỈ cho đi TỚI, không lùi lại
     * được (bảo vệ tiến trình chơi thật), nhưng đây là debug nên cần lùi được tự do để test lại cả
     * những cờ mở khoá đã "qua" trước đó (ví dụ test lại level 1, dù trước đó đã test level 11). */
    setTestHighestLevel(levelId: number): void {
        if (!this.progression) return;
        const highest = Math.max(0, Math.floor(levelId) - 1);
        SaveManager.instance.playerData.progression.highestLevel = highest;
        // Đồng bộ NGAY — cùng 2 dòng initSystems() đã làm lúc boot (Global tab đọc localConfig
        // riêng, không tự theo progression).
        localConfig.instance.currLevelUnlock = this.progression.completedCount;
        configuration.instance.setData_LevelCurrentUnlock(this.progression.completedCount);

        // BUG đã sửa (báo lỗi của user, kèm ảnh: "nhảy tới level 10 thắng thì hiện dữ liệu
        // leaderboard CŨ chứ không phải luồng người chơi mới") — progression chỉ quyết định CỜ MỞ
        // KHOÁ (isLeaderboardUnlocked()), KHÔNG hề đụng tới dữ liệu Weekly thật (tournamentStartMs/
        // currWeekScore/bot...) — nếu save đã có sẵn từ lần test TRƯỚC (đã kích hoạt, bot đã leo
        // hạng...), nhảy lùi progression không tự "xoá" phần đó, nên vẫn thấy leaderboard cũ dù vừa
        // "mới mở khoá" theo progression. Nhảy tới level CÒN TRƯỚC/ĐÚNG mốc mở Leaderboard thì ép
        // luôn Weekly về ĐÚNG trạng thái "chưa từng kích hoạt" — mới thật sự test được đúng luồng
        // "người chơi mới" từ đầu.
        if (highest < GameConfig.leaderboardUnlockLevel) {
            LegacyLeaderboardManager.instance?.resetToNeverActivatedForTesting();
        }

        void SaveManager.instance.persist();
    }

    getDailyService(): DailyPuzzleService {
        if (!this.dailyService) throw new Error('GameManager.initSystems() chưa chạy.');
        return this.dailyService;
    }

    /** DÙNG ĐỂ TEST — xem DailyPuzzleService.setTestStreakValue(). */
    setTestStreakValue(value: number): void {
        this.dailyService?.setTestStreakValue(value);
        void SaveManager.instance.persist();
    }

    /** DÙNG ĐỂ TEST — xem DailyPuzzleService.setTestWeekToDaySix(). */
    setTestWeekToDaySix(): void {
        this.dailyService?.setTestWeekToDaySix();
        void SaveManager.instance.persist();
    }

    /** DÙNG ĐỂ TEST — xem DailyPuzzleService.setTestNotPlayedToday(). */
    setTestNotPlayedToday(): void {
        this.dailyService?.setTestNotPlayedToday();
        void SaveManager.instance.persist();
    }


    changeState(to: AppState): boolean {
        const from = this._state;
        if (from === to) return false;

        if (!canTransition(from, to)) {
            console.warn(`[GameManager] Transition không hợp lệ: ${from} -> ${to}. Bỏ qua.`);
            return false;
        }

        this._state = to;
        const payload: AppStateChangedEventPayload = { from, to };
        EventManager.instance.emit(APP_STATE_CHANGED_EVENT, payload);
        return true;
    }

 
    private onNavigate = (payload: NavigateRequestedEventPayload): void => {
        // Áp dụng cho CẢ rời Gameplay bình thường LẪN bỏ dở luồng "thắng lần đầu trong
        // ngày" (ví dụ bấm nút back ở màn Streak thay vì "Tiếp tục") — session lúc đó vẫn
        // đang sống (enterStreakScreen() không huỷ nó) dù state hiện tại đã là DailyStreak,
        // không còn Gameplay nữa. Hễ KHÔNG đi tới Gameplay mà session còn sống thì huỷ.
        const shouldDisposeSession = payload.to !== AppState.Gameplay && this.session !== null;

        // Bấm "Tiếp tục" ở màn Streak: session CŨ vẫn còn sống — quay lại đúng session đó
        // thay vì tạo ván mới.
        const resumingSolvedSession =
            payload.to === AppState.Gameplay && this._state !== AppState.Gameplay && this.session !== null;

        // PHẢI chạy TRƯỚC changeState() — changeState() bắn APP_STATE_CHANGED_EVENT ĐỒNG BỘ,
        // UIManager.onAppStateChanged (lắng nghe event đó) sẽ tiêu thụ TournamentActivationPresentation/
        // TournamentPresentation NGAY TRONG CÙNG lệnh gọi này; gọi các hàm check SAU changeState()
        // sẽ luôn trễ mất 1 nhịp (UIManager đọc thấy "chưa có gì" dù đúng ra phải có).
        if (payload.to === AppState.MainMenu) {
            this.checkTournamentActivation();
            this.checkPendingTournamentResult();
        }

        if (!this.changeState(payload.to)) return;

        if (shouldDisposeSession) {
            this.saveElapsedOnLeave();
            // Rời Gameplay theo hướng KHÁC "Tiếp tục sang màn kế" (vd bấm back về Main Menu) —
            // huỷ preload màn kế nếu có, tránh giữ tham chiếu asset mãi không dùng tới.
            this.puzzleProvider.cancelPreload();
            this.disposeSession();
        }

        if (resumingSolvedSession) {
            this.session?.emitReadyAgain();
        }
    };


    private saveElapsedOnLeave(): void {
        const snapshot = SaveManager.instance.playerData.boardInProgress;
        if (!this.session || !snapshot) return;
        if (snapshot.context !== this.sessionContext || snapshot.puzzleId !== this.sessionPuzzleId) {
            return;
        }

        snapshot.elapsedSeconds = this.session.elapsedSeconds;
        void SaveManager.instance.persist();
    }


    private onLevelSelected = (payload: LevelSelectedEventPayload): void => {
        void this.startPuzzle(payload.context, payload.levelId).catch((error: unknown) => {
            console.error('[GameManager] Không vào được màn chơi:', error);
        });
    };

    /**
     * KHÔNG huỷ session — chỉ dùng cho luồng thắng lần đầu trong ngày, session vẫn cần
     * sống để quay LẠI Gameplay đúng trạng thái vừa chơi xong khi bấm "Tiếp tục" (xem
     * onNavigate's resumingSolvedSession). Session sẽ bị huỷ SAU, khi người chơi thật sự
     * rời Gameplay (qua popup Result/DailyResult).
     */
    enterStreakScreen(): void {
        this.changeState(AppState.DailyStreak);
    }


    /**
     * Đợi puzzle của màn ĐẦU TIÊN người chơi sắp vào tải + parse + cache xong: tutorial nếu chưa xem, ngược lại
     * level campaign hiện tại. Bootloader gọi lúc boot để bấm Chơi/vào tutorial KHÔNG còn phải đợi tải màn.
     * (initSystems() đã preload nhưng không ai đợi nó xong; load() ở đây nhận lại đúng promise đó rồi cache.)
     */
    async warmFirstPuzzle(): Promise<void> {
        const seenTutorial = SaveManager.instance.playerData.hasSeenTutorial;
        if (seenTutorial) {
            await this.puzzleProvider.load('campaign', resolveCampaignPuzzleDataId(this.getProgression().getCurrentLevel()));
        } else {
            await this.puzzleProvider.load('tutorial', 0);
        }
    }

    startTutorial(): void {
        void this.startPuzzle('tutorial', 0).catch((error: unknown) => {
            console.error('[GameManager] Không vào được tutorial:', error);
        });
    }

    private async startPuzzle(context: PuzzleContext, levelId: number | null): Promise<void> {
        const daily = this.getDailyService();

        // requestedId = số level HIỂN THỊ cho người chơi (campaign KHÔNG giới hạn — có thể
        // vượt quá campaignLevelCount khi đang ở vùng lặp vô hạn). dataId = id FILE PUZZLE
        // thật sự tải, luôn nằm trong 1..campaignLevelCount — chỉ 2 giá trị này khác nhau
        // khi context === 'campaign' và đã qua level cuối trong data (xem LevelListConfig).
        const requestedId = context === 'daily' ? daily.getPuzzleIdFor() : levelId ?? 0;

        if (context === 'campaign' && !this.getProgression().isUnlocked(requestedId)) {
            console.warn(`[GameManager] Level ${requestedId} chưa mở khóa.`);
            return;
        }

        const dataId = context === 'campaign' ? resolveCampaignPuzzleDataId(requestedId) : requestedId;

        // Dọn dữ liệu level CŨ NGAY LÚC BẤM (đồng bộ) — TRƯỚC KHI load puzzle mới (bất
        // đồng bộ), thay vì đợi load xong mới huỷ. Trước đây huỷ + dựng board mới dồn vào
        // đúng lúc load xong nên bị giật vài khung hình lúc bấm sang màn tiếp theo.
        this.disposeSession();

        // Song song với tải puzzle: đảm bảo prefab GameplayScreen (bundle lazy) ĐÃ nạp xong TRƯỚC khi đổi state,
        // để màn được dựng đồng bộ ở changeState() và kịp nhận sự kiện bắt đầu màn (xem screenPreparer.ts).
        const [puzzle] = await Promise.all([
            this.puzzleProvider.load(context, dataId),
            ScreenPreparer.prepare(AppState.Gameplay),
        ]);

        const playerData = SaveManager.instance.playerData;
        const puzzleDate = context === 'daily' ? today() : null;

        this.changeState(AppState.Gameplay);

        // Tutorial: luôn +1 lượt Place Dog so với kho thật, tránh vào tutorial đúng lúc
        // hết lượt (nút Place Dog bấm không phản hồi gì vì rơi vào nhánh mở quảng cáo).
        // An toàn vì onPlaceDogUsed() đã KHÔNG ghi lượt dùng trong tutorial trở lại kho
        // thật — +1 này chỉ tồn tại trong phiên tutorial, tự "biến mất" khi ván kết thúc.
        const placeDogCharges =
            context === 'tutorial'
                ? playerData.inventory.placeDogCharges + 1
                : playerData.inventory.placeDogCharges;

        this.session = new PuzzleSession({
            puzzle,
            context,
            puzzleDate,
            placeDogCharges,
            hintCharges: playerData.inventory.hintCharges,
            displayId: context === 'campaign' ? requestedId : undefined,
            snapshot: this.takeResumableSnapshot(context, dataId, puzzleDate),
        });

        this.sessionContext = context;
        this.sessionPuzzleId = dataId;

        PuzzleSessionHolder.set(this.session);
    }

 
    private takeResumableSnapshot(context: PuzzleContext, puzzleId: number, date: string | null) {
        const snapshot = SaveManager.instance.playerData.boardInProgress;
        if (!snapshot) return null;
        if (snapshot.context !== context || snapshot.puzzleId !== puzzleId) return null;
        if (context === 'daily' && snapshot.puzzleDate !== date) return null;
        return snapshot;
    }

    leaveGameplay(to: AppState): void {
        this.disposeSession();
        this.changeState(to);
    }

    private disposeSession(): void {
        if (!this.session) return;

        this.session.dispose();
        // KHÔNG release() puzzle JSON ở đây nữa — file puzzle rất nhỏ (vài KB/màn), giữ lại
        // trong resources cache của Cocos gần như không tốn gì, nhưng release() liên tục mỗi
        // lần rời màn (thắng/thua/bấm Back) khiến LẦN SAU vào lại ĐÚNG màn đó (chơi lại, hoặc
        // Back rồi bấm Play lại) phải tải mới hoàn toàn từ đầu — ở Preview (dev-server qua
        // HTTP) việc này tốn >1s mỗi lần, gây đứng hình rõ rệt lúc bấm Chơi (đo được qua
        // console.time: puzzleProvider.load chiếm 1343ms trong khi đổi màn + dựng bàn cờ chỉ
        // ~45ms). Không release cũng an toàn về bộ nhớ: kể cả chơi hết 617 màn campaign trong
        // 1 phiên, tổng dung lượng JSON tích luỹ vẫn ở mức không đáng kể trên di động.
        this.session = null;
        PuzzleSessionHolder.set(null);
    }


    private onPuzzleSolved = (payload: PuzzleSolvedEventPayload): void => {
        SaveManager.instance.detachBoardSnapshot();

        let firstToday = false;
        if (payload.context !== 'tutorial') {
            const activity = this.getDailyService().recordActivity();
            firstToday = activity.firstToday;
        }

        // Đặt cờ celebrate TRƯỚC KHI emit LEVEL_UNLOCKED/DAILY_CHALLENGE_SOLVED — UIManager
        // nghe các event đó (và chính PUZZLE_SOLVED_EVENT — GameManager luôn được đăng ký
        // TRƯỚC UIManager, xem Bootloader) để quyết định NGAY có hoãn popup Result/DailyResult
        // hay không, tránh phải đoán qua đua timer với STREAK_REDIRECT_DELAY bên dưới.
        // "Thêm lại luồng kích hoạt giải đấu và chuỗi vào ConnectTracks, giữ đúng thứ tự" (xác nhận
        // từ user) — bỏ loại trừ connectTracksInline, Streak áp dụng chung cho mọi context.
        // "Streak mở ở level 5, thắng xong level 5 thì các hoạt động liên quan Streak mới kích
        // hoạt" (xác nhận từ user) — isStreakUnlocked() đọc progression TRƯỚC KHI handleCampaignSolved()
        // (bên dưới) chạy, nên CHÍNH lần thắng level 5 này phải tự tính thêm (payload.puzzleId ===
        // streakUnlockLevel), không chỉ dựa vào progression đã lưu từ TRƯỚC đó.
        const wasStreakUnlocked = this.isStreakUnlocked();
        const justUnlockedStreak = !wasStreakUnlocked
            && payload.context === 'campaign' && payload.puzzleId === GameConfig.streakUnlockLevel;
        const streakUnlocked = wasStreakUnlocked || justUnlockedStreak;
        // BUG đã sửa (báo lỗi của user: "sau khi thắng màn 5 thắp chuỗi không hiện"): recordActivity()
        // ở trên luôn chạy NGAY TỪ ĐẦU, kể cả trước khi mở khoá Streak — nếu người chơi đã thắng màn
        // 1-4 CÙNG ngày với lúc thắng màn 5 (ca rất thường gặp khi test liền 1 mạch), firstToday đã
        // bị "dùng hết" ở màn 1 (lúc Streak CHƯA mở), nên tới màn 5 firstToday luôn = false, NẾU chỉ
        // dựa vào `firstToday && streakUnlocked` thì sẽ KHÔNG BAO GIỜ kích hoạt được, phải đợi sang
        // NGÀY HÔM SAU mới có firstToday mới — sai với ý "thắng xong màn 5 thì kích hoạt". Lần MỞ
        // KHOÁ ĐẦU TIÊN (justUnlockedStreak) phải tự kích hoạt NGAY, bất kể firstToday hôm đó đã
        // dùng hay chưa — dữ liệu chuỗi (data.streak) vẫn đã được recordActivity() tính đúng từ đầu
        // dù UI chưa từng hiện, nên hiện celebrate ở đây vẫn hiện ĐÚNG số ngày đã tích luỹ.
        if (streakUnlocked && (firstToday || justUnlockedStreak)) StreakPresentation.requestCelebrate();

        if (payload.context === 'campaign') {
            // ConnectTracks cung cấp leaderboardScore RIÊNG (số ô đường ray của màn, xem
            // GameplayScreen.notifyConnectTracksWon()) — Dogdoku không gán field này nên vẫn rơi về
            // mistakesRemaining (số tim còn lại) như cũ, hành vi không đổi.
            this.handleCampaignSolved(payload.puzzleId, payload.leaderboardScore ?? payload.mistakesRemaining);
        } else if (payload.context === 'tutorial') {
            this.handleTutorialSolved();
        } else {
            this.handleDailySolved();
        }

        void SaveManager.instance.persist();

        // Thắng lần ĐẦU trong ngày: chuyển sang màn Streak ăn mừng — Result/DailyResult bị hoãn
        // lại, chỉ hiện SAU khi bấm "Tiếp tục" ở màn Streak (lúc đó quay LẠI Gameplay đúng trạng
        // thái vừa chơi xong rồi mới hiện popup — xem UIManager/onNavigate).
        //
        // Đã mở Leaderboard (group tim CÓ chạy — xem GameplayScreen.onVictoryWaveFinished): đợi
        // hiệu ứng tim bay xong (HEART_FLY_FINISHED_EVENT) + STREAK_HEART_FLY_DELAY_SECONDS rồi
        // mới chuyển màn, tránh chuyển màn NGAY lúc tim còn đang bay dở trên Gameplay. CHƯA mở
        // Leaderboard (group tim không chạy, không có gì để đợi): giữ nguyên mốc cũ — đợi hoạt
        // ảnh đặt chó cuối cùng chạy xong (STREAK_REDIRECT_DELAY).
        if (streakUnlocked && (firstToday || justUnlockedStreak)) {
            this.unschedule(this.enterStreakScreenDeferred);
            if (payload.presentation === 'connectTracksInline') {
                // BUG đã sửa (báo lỗi của user — "lỗi màn streak ở level 1 chưa khắc phục, phải đợi
                // board di chuyển ra giữa + dừng 0.3s rồi mới hiện streak"): notifyConnectTracksWon()
                // giờ bắn PUZZLE_SOLVED_EVENT NGAY lúc thắng (TRƯỚC khi ConnectTracksVictoryView
                // chạy animation ăn mừng), không phải SAU khi animation xong như comment cũ ở đây
                // từng mô tả — hẹn giờ 0 ở đây làm màn Streak hiện ĐÈ LÊN animation (board/sao/0.3s)
                // còn đang chạy dở. KHÔNG tự hẹn giờ chuyển màn ở đây nữa — chỉ đặt cờ
                // StreakPresentation (đã làm ở trên); UIManager.notifyConnectTracksReadyForTrain()
                // (gọi bởi GameplayScreen ĐÚNG lúc animation ăn mừng thật sự xong) sẽ tự gọi
                // enterStreakScreen() vào đúng lúc.
            } else if (this.isLeaderboardUnlocked()) {
                this.awaitingHeartFlyForStreak = true;
                this.scheduleOnce(this.enterStreakScreenDeferred, STREAK_HEART_FLY_FALLBACK_SECONDS);
            } else {
                this.scheduleOnce(this.enterStreakScreenDeferred, STREAK_REDIRECT_DELAY);
            }
        }
    };

    private awaitingHeartFlyForStreak = false;

    private onHeartFlyFinishedForStreak = (): void => {
        if (!this.awaitingHeartFlyForStreak) return;

        this.awaitingHeartFlyForStreak = false;
        this.unschedule(this.enterStreakScreenDeferred);
        this.scheduleOnce(this.enterStreakScreenDeferred, STREAK_HEART_FLY_DELAY_SECONDS);
    };

    private enterStreakScreenDeferred = (): void => {
        this.awaitingHeartFlyForStreak = false;
        this.enterStreakScreen();
    };

    private onPuzzleFailed = (payload: PuzzleFailedEventPayload): void => {
        SaveManager.instance.detachBoardSnapshot();
        void SaveManager.instance.persist();

        // Bảng xếp hạng (Weekly/Global) chỉ tính theo tiến trình CAMPAIGN — tutorial/daily thua
        // không liên quan gì tới bot ở đó. Người chơi thật KHÔNG mất/thêm điểm khi thua, nhưng
        // bot vẫn có % tăng điểm riêng theo đúng cột "user lose" trong bảng thiết kế (trước đây
        // bot đứng yên hoàn toàn khi người chơi thua).
        // BUG đã sửa (cùng loại với phần Weekly của addCurrWeekScore() — "bảng Weekly phải đứng
        // yên hoàn toàn trước khi kích hoạt giải đấu"): phần Weekly bên trong addLoseAttempt() giờ
        // tự kiểm tra hasTournamentActivated() (xem đó) — vẫn gọi VÔ ĐIỀU KIỆN ở đây vì hàm đó CÒN
        // cập nhật bot Global (không có khái niệm kích hoạt), vẫn phải chạy dù Weekly chưa kích hoạt.
        if (payload.context === 'campaign') {
            LegacyLeaderboardManager.instance?.addLoseAttempt();
        }
    };

    /** `weeklyScore`: số tim còn lại (Dogdoku) HOẶC số ô đường ray của màn (ConnectTracks) — xem
     * PuzzleSolvedEventPayload.leaderboardScore. */
    private handleCampaignSolved(levelId: number, weeklyScore: number): void {
        const progression = this.getProgression();
        const unlocked = progression.markCompleted(levelId);

        // Tải trước màn KẾ TIẾP ngay lúc vừa giải xong (trong lúc popup Result còn đang hiện
        // đè lên) — để lúc bấm "Tiếp tục" board hiện ngay, khỏi đợi load lại từ đầu.
        const next = levelId + 1;
        if (progression.isUnlocked(next)) this.puzzleProvider.preload('campaign', resolveCampaignPuzzleDataId(next));

        this.pushLeaderboardScore(levelId, weeklyScore);

        if (unlocked === null) return;

        const payload: LevelUnlockedEventPayload = { levelId: unlocked };
        EventManager.instance.emit(LEVEL_UNLOCKED_EVENT, payload);
    }

    /**
     * Đẩy điểm lên CẢ 2 leaderboard sau mỗi lần thắng campaign — tuần dùng bộ đếm riêng
     * (LeaderboardManager.recordWin), thế giới dùng LEVEL CAO NHẤT đã qua (đúng theo dự án
     * gốc: world score = currLevelUnlock, KHÔNG phải cùng giá trị với điểm tuần).
     */
    private pushLeaderboardScore(solvedLevelId: number, weeklyScore: number): void {
        // Màn Leaderboard đang hiển thị THẬT trong game (LeaderboardTabGroup.prefab, copy nguyên
        // từ MagicSort) đọc điểm từ LeaderboardManager (assets/scripts/leaderboard/) — MỘT hệ
        // thống hoàn toàn khác với LeaderboardManager (assets/scripts/gameplay/leaderboard/) ở
        // dưới đây. Không có cầu nối này thì thắng bao nhiêu màn cũng KHÔNG cập nhật màn hình
        // Leaderboard người chơi thực sự nhìn thấy (điểm/hạng đứng yên mãi).
        // BUG đã sửa (báo lỗi của user, kèm ảnh: "vừa mở Leaderboard ra đã lên Top 1 dù chưa bấm
        // kích hoạt giải đấu" — game gốc CHỈ tính điểm Weekly kể từ lúc bấm kích hoạt, không tính
        // các màn chơi TRƯỚC đó): phần Weekly (currWeekScore + bot Weekly) bên trong
        // addCurrWeekScore() giờ tự kiểm tra hasTournamentActivated() (xem đó) — KHÔNG gate cả hàm
        // ở đây nữa, vì addCurrWeekScore() CÒN cập nhật Global (không có khái niệm kích hoạt) + gửi
        // điểm lên PGS, vẫn phải chạy BÌNH THƯỜNG dù giải đấu Weekly chưa kích hoạt.
        // Chụp điểm TRƯỚC/SAU để LeaderboardPreviewPopup (popup leo hạng hiện sau khi thắng màn)
        // biết hạng cũ/mới mà animate — phải chụp Ở ĐÂY vì đây là nơi DUY NHẤT gọi addCurrWeekScore().
        // Điểm tuần = số TIM CÒN LẠI lúc thắng (Dogdoku, 0..GameConfig.maxMistakes) HOẶC số ô đường
        // ray của màn (ConnectTracks, xem PuzzleSolvedEventPayload.leaderboardScore) — KHÔNG còn +1
        // cố định/màn nữa (xem LeaderboardManager.addCurrWeekScore()).
        const oldWeekScore = LegacyLeaderboardManager.instance?.getLeaderboardCurrWeekScore() ?? 0;
        LegacyLeaderboardManager.instance?.addCurrWeekScore(weeklyScore);
        const newWeekScore = LegacyLeaderboardManager.instance?.getLeaderboardCurrWeekScore() ?? oldWeekScore;
        // CHỈ hiện popup leo hạng cho người chơi ĐÃ MỞ ĐƯỢC Leaderboard (isLeaderboardUnlocked() —
        // thắng xong level GameConfig.leaderboardUnlockLevel, cùng điều kiện nút Leaderboard hiện
        // ở Main Menu) VÀ đã KÍCH HOẠT giải đấu (hasTournamentActivated()) — chưa kích hoạt thì
        // oldWeekScore===newWeekScore (addCurrWeekScore() tự không cộng gì cho Weekly), leo hạng
        // không có ý nghĩa gì để hiện popup.
        if (this.isLeaderboardUnlocked() && LegacyLeaderboardManager.instance?.hasTournamentActivated()) {
            LeaderboardPreviewPresentation.request(oldWeekScore, newWeekScore);
        }

        // "Qua màn mới" — 1 trong các mốc phát hiện kết quả giải đấu tuần trước đang chờ xử lý
        // (mốc khác: boot ở initSystems(), quay lại Home ở onNavigate(), đang đứng ở Leaderboard ở
        // LeaderboardTabGroupManager.showInfo()). Nếu ĐÚNG màn này làm giải đấu hết giờ, popup kết
        // thúc/kích hoạt giải đấu (TournamentResetPopup/TournamentResultPopup) sẽ hiện NGAY sau khi
        // Result của màn này đóng — xem UIManager.openResultPopupForWin()/maybeOpenTournamentResult().
        this.checkPendingTournamentResult();

        // Đúng màn vừa làm Leaderboard MỞ RA (thắng xong level leaderboardUnlockLevel, ví dụ level
        // 10 → 11) — bắt buộc phải hiện popup KÍCH HOẠT giải đấu (TournamentActivationPopup) NGAY
        // sau khi Result màn này đóng, KHÔNG đợi quay về Home nữa (xem UIManager.openResultPopupForWin()
        // /maybeOpenTournamentActivation()). Nhờ vậy nếu người chơi chơi tiếp luôn (không thoát ra
        // Home), LeaderboardPreviewPresentation của MÀN KẾ TIẾP sẽ tự request() bình thường (đã
        // hasTournamentActivated()==true ngay lúc đó) — không cần thêm cơ chế gì khác.
        this.checkTournamentActivation();

        const leaderboard = this.leaderboard;
        const scoreBackend = this.scoreBackend;
        if (!leaderboard || !scoreBackend) return;

        const weekScore = leaderboard.recordWin();
        const worldScore = Math.max(solvedLevelId, this.getProgression().completedCount);

        // Global tab (LeaderboardGroupWorld, copy nguyên) đọc điểm trực tiếp từ
        // localConfig.instance.currLevelUnlock — field này thuộc 1 hệ lưu TÁCH BIỆT hoàn toàn
        // với save thật của Dogdoku (SaveManager), nên khi reset tiến trình qua SaveManager,
        // currLevelUnlock KHÔNG tự reset theo — đồng bộ LUÔN LUÔN (không chỉ khi tăng), nếu
        // không sau khi reset về màn thấp, "Global" vẫn kẹt cứng ở giá trị cũ trước khi reset.
        localConfig.instance.currLevelUnlock = worldScore;
        configuration.instance.setData_LevelCurrentUnlock(worldScore);

        void scoreBackend
            .resolveLeaderboardIds([leaderboard.weekContextId, leaderboard.worldContextId])
            .then((ids) => {
                const weekLeaderboardId = ids.get(leaderboard.weekContextId);
                const worldLeaderboardId = ids.get(leaderboard.worldContextId);
                if (weekLeaderboardId) {
                    void scoreBackend.submitScore(weekLeaderboardId, weekScore).catch((error: unknown) => {
                        console.warn('[GameManager] submitScore (week) thất bại:', error);
                    });
                }
                if (worldLeaderboardId) {
                    void scoreBackend.submitScore(worldLeaderboardId, worldScore).catch((error: unknown) => {
                        console.warn('[GameManager] submitScore (world) thất bại:', error);
                    });
                }
            })
            .catch((error: unknown) => {
                console.warn('[GameManager] pushLeaderboardScore thất bại:', error);
            });

        void this.playerBackend?.updatePlayerPoints(worldScore).catch((error: unknown) => {
            console.warn('[GameManager] updatePlayerPoints thất bại:', error);
        });
    }


    private handleTutorialSolved(): void {
        SaveManager.instance.playerData.hasSeenTutorial = true;

        // Sau tutorial, "Tiếp tục" ở ResultPopup luôn nhảy vào campaign tại level hiện tại
        // của người chơi (xem ResultPopup.onTapContinue/UIManager.resolveNextLevel) — tải
        // trước đúng level đó.
        this.puzzleProvider.preload('campaign', resolveCampaignPuzzleDataId(this.getProgression().getCurrentLevel()));
    }

    private handleDailySolved(): void {
        const daily = this.getDailyService();

        const seconds = this.session?.elapsedSeconds ?? 0;
        const score = this.session?.totalScore ?? 0;
        const dogCount = this.session?.size ?? 0;
        const rank = RankService.evaluate(seconds, dogCount);

        // Người chơi CHỈ nhận lượt Place Dog qua xem quảng cáo hoặc quà chuỗi 7 ngày — thắng
        // daily không tự cộng lượt Place Dog nào cả.
        daily.completeDailyChallenge(seconds, score, rank);

        // "Tiếp tục" ở DailyResultPopup luôn nhảy vào campaign tại level hiện tại của người
        // chơi (xem DailyResultPopup.onTapDone) — tải trước đúng level đó ngay trong lúc popup
        // còn đang hiện, để bấm "Tiếp tục" là vào ngay không phải đợi load.
        this.puzzleProvider.preload('campaign', resolveCampaignPuzzleDataId(this.getProgression().getCurrentLevel()));

        const solvedPayload: DailyChallengeSolvedEventPayload = {
            date: today(),
            seconds,
            score,
            dogCount,
            rank,
            streak: daily.streak,
            bestStreak: daily.bestStreak,
        };
        EventManager.instance.emit(DAILY_CHALLENGE_SOLVED_EVENT, solvedPayload);
    }


    /** UI (LeaderboardTabGroupManager) đọc bảng xếp hạng theo contextId ("{gameId}_week_N"/"{gameId}_world"). */
    /**
     * localScoreFallback: điểm CỤC BỘ đã biết của người chơi cho leaderboard này — dùng khi
     * server chưa trả về dòng của mình (hạng thấp, ngoài top N). LeaderboardGroupWeek dùng
     * LeaderboardManagerHolder.current.currWeekScore, LeaderboardGroupWorld dùng
     * ProgressionHolder.current.completedCount — xem 2 file đó.
     */
    async fetchLeaderboard(
        contextId: string,
        localScoreFallback: number,
        limit = 100,
    ): Promise<LeaderboardFetchResult> {
        const scoreBackend = this.scoreBackend;
        if (!scoreBackend) return { entries: [], total: 0 };

        const ids = await scoreBackend.resolveLeaderboardIds([contextId]);
        const leaderboardId = ids.get(contextId);
        if (!leaderboardId) return { entries: [], total: 0 };

        const result = await scoreBackend.fetchLeaderboard(leaderboardId, limit);
        return this.ensureMyEntry(result, localScoreFallback);
    }

    /**
     * Đảm bảo LUÔN có dòng của chính mình trong kết quả — server chỉ trả top N, người chơi
     * hạng thấp có thể không nằm trong đó. Không tìm thấy thì tự thêm 1 dòng cuối danh sách
     * (mirror LeaderboardGroupWeek/World.receiveListRankLeaderboard của dự án gốc).
     */
    private ensureMyEntry(result: LeaderboardFetchResult, localScoreFallback: number): LeaderboardFetchResult {
        const myId = FBInstantManagerHolder.current.getPlayer()?.id ?? null;
        if (myId === null) return result;
        if (result.entries.some((entry) => entry.playerId === myId)) return result;

        const player = FBInstantManagerHolder.current.getPlayer();
        const myEntry = {
            playerId: myId,
            name: player?.name || Localization.get(L10N.common.you),
            avatarUrl: player?.photoUrl ?? '',
            avatarId: ProfileManagerHolder.current?.avatarId,
            frameId: ProfileManagerHolder.current?.frameId,
            score: localScoreFallback,
            rank: result.entries.length + 1,
        };
        return { entries: result.entries.concat([myEntry]), total: result.total };
    }

    /** Gửi 1 analytics event tuỳ ý lên backend — không tự gọi ở đâu, các nơi cần tự gọi khi có event thật. */
    trackEvent(
        clientId: string,
        eventName: string,
        params?: Readonly<Record<string, unknown>>,
        userProperties?: Readonly<Record<string, unknown>>,
    ): void {
        this.analyticsBackend?.trackEvent(clientId, eventName, params, userProperties).catch((error: unknown) => {
            console.warn('[GameManager] trackEvent thất bại:', error);
        });
    }

    /**
     * Luồng mua hàng Shop đầy đủ: trả tiền thật (IPaymentService) → consume → ghi nhận vào
     * ShopIAPManager → cộng thưởng vào kho. Ném lỗi nếu bất kỳ bước nào trước "ghi nhận" thất
     * bại (KHÔNG cộng thưởng nếu chưa chắc chắn đã trả tiền xong).
     */
    async purchasePackage(packageId: string): Promise<void> {
        const shop = this.shopService;
        if (!shop) throw new Error('GameManager.initSystems() chưa chạy.');

        const purchase = await PaymentServiceHolder.current.purchase(packageId);
        await PaymentServiceHolder.current.consumePurchase(purchase.purchaseToken);

        const config = shop.recordPurchase(packageId);
        if (!config) {
            console.warn(`[GameManager] Gói '${packageId}' không có trong ShopPackageDataConfig.`);
            return;
        }

        // Place Dog: đang trong ván thì cộng vào session (giống onPlaceDogGrantRequested) để
        // HUD cập nhật ngay; ngoài ván thì cộng thẳng vào kho. Hint chỉ cộng thẳng vào kho —
        // PuzzleSession chưa có đường cộng hint SỐNG giữa ván (hạn chế đã có từ trước, không
        // phải do luồng Shop này gây ra).
        const inventory = SaveManager.instance.playerData.inventory;
        for (const reward of config.rewards) {
            switch (reward.resource) {
                case 'placeDogCharges':
                    if (this.session) {
                        this.session.grantPlaceDogCharges(reward.amount);
                    } else {
                        inventory.placeDogCharges = Math.max(0, inventory.placeDogCharges + reward.amount);
                    }
                    break;
                case 'hintCharges':
                    inventory.hintCharges = Math.max(0, inventory.hintCharges + reward.amount);
                    break;
                case 'coin':
                    inventory.coin = Math.max(0, inventory.coin + reward.amount);
                    break;
            }
        }

        void SaveManager.instance.persist();

        const payload: ShopPurchaseCompletedEventPayload = {
            packageId,
            placeDogCharges: inventory.placeDogCharges,
            hintCharges: inventory.hintCharges,
            coin: inventory.coin,
        };
        EventManager.instance.emit(SHOP_PURCHASE_COMPLETED_EVENT, payload);
    }

    /**
     * Đổi coin (đã mua qua IAP) lấy hint/placeDog charge theo tỉ lệ CoinExchangeConfig. KHÔNG
     * đụng payment/IAP — thuần trừ/cộng trong PlayerData.inventory, mirror nhánh cộng thưởng
     * của purchasePackage() ở trên (session-aware cho placeDogCharges).
     */
    exchangeCoinForResource(optionId: string): void {
        const option = findCoinExchangeOption(optionId);
        if (!option) {
            console.warn(`[GameManager] CoinExchangeOption '${optionId}' không tồn tại.`);
            return;
        }

        const inventory = SaveManager.instance.playerData.inventory;
        if (inventory.coin < option.coinCost) return;

        inventory.coin -= option.coinCost;
        if (option.resource === 'placeDogCharges') {
            if (this.session) {
                this.session.grantPlaceDogCharges(option.amount);
            } else {
                inventory.placeDogCharges = Math.max(0, inventory.placeDogCharges + option.amount);
            }
        } else {
            inventory.hintCharges = Math.max(0, inventory.hintCharges + option.amount);
        }

        void SaveManager.instance.persist();

        const payload: CoinExchangeCompletedEventPayload = {
            optionId,
            placeDogCharges: inventory.placeDogCharges,
            hintCharges: inventory.hintCharges,
            coin: inventory.coin,
        };
        EventManager.instance.emit(COIN_EXCHANGE_COMPLETED_EVENT, payload);
    }

    /**
     * Phát hiện có kết quả giải đấu tuần trước đang chờ xử lý (LeaderboardManager.
     * hasPendingTournamentResult()) và báo cho UIManager qua TournamentPresentation — gọi ở
     * MỌI mốc có thể phát hiện ra kết quả này càng SỚM càng tốt, để popup hiện ra đúng ngay chỗ
     * người chơi đang đứng thay vì luôn phải đợi về Home:
     *   1. Ngay lúc BOOT (initSystems — "mở app", ứng với TH giải đấu hết giờ lúc người chơi offline).
     *   2. Ngay sau khi thắng 1 màn campaign (pushLeaderboardScore — ứng với TH giải đấu hết giờ
     *      NGAY màn đang chơi; UIManager hiện popup này NGAY SAU Result của màn đó, TRƯỚC
     *      LeaderboardPreview — xem UIManager.openResultPopupForWin()/maybeOpenTournamentResult()).
     *   3. Lúc quay lại Home (onNavigate — bắt các TH còn lại: đang ở màn khác ngoài Gameplay/
     *      Leaderboard lúc giải đấu hết giờ).
     * (Mốc còn lại — đang đứng NGAY TẠI Leaderboard lúc giải đấu hết giờ — gọi riêng từ
     * LeaderboardTabGroupManager.showInfo(), không qua đây, vì đó không phải sự kiện AppState.)
     *
     * .request() cho MỌI hạng (không riêng ngoài Top 3 nữa) — UIManager.maybeOpenTournamentResult()
     * tự chọn mở TournamentResultPopup (Top 3, nhận thưởng) hay TournamentResetPopup (còn lại,
     * kích hoạt giải đấu mới) dựa theo hạng.
     *
     * Public (không private) để nút test (MainMenuScreen.onTapResetLeaderboard) gọi được trực tiếp
     * ngay sau resetWeeklyForTesting(), không cần đợi tới lần chuyển AppState kế tiếp.
     */
    checkPendingTournamentResult(): void {
        if (!this.isLeaderboardUnlocked()) return;

        const legacy = LegacyLeaderboardManager.instance;
        if (!legacy?.hasPendingTournamentResult()) return;
        if (TournamentPresentation.isPending()) return;
        TournamentPresentation.request(legacy.getPendingTournamentRank());
    }

    /** true khi người chơi đã THẮNG XONG level GameConfig.leaderboardUnlockLevel — cùng điều
     * kiện nút Leaderboard hiện ra ở Main Menu (xem MainMenuScreen.refresh()). Người chơi CHƯA
     * mở được Leaderboard thì KHÔNG được thấy BẤT CỨ THỨ GÌ liên quan tới nó — popup kích hoạt
     * giải đấu (TournamentActivationPopup), popup leo hạng (LeaderboardPreviewPopup), popup kết
     * quả/reset giải đấu (TournamentResultPopup/TournamentResetPopup) — tất cả đều gọi qua hàm
     * này để chặn tập trung 1 chỗ, tránh phải nhớ thêm điều kiện riêng ở từng nơi. */
    private isLeaderboardUnlocked(): boolean {
        return this.progression?.isCompleted(GameConfig.leaderboardUnlockLevel) ?? false;
    }

    /** true khi người chơi đã THẮNG XONG level GameConfig.streakUnlockLevel — cùng điều kiện nút
     * Streak hiện ra ở Main Menu (xem MainMenuScreen.refresh()). Chặn tập trung ở đây để mọi nơi
     * kích hoạt luồng Streak (StreakPresentation.requestCelebrate()) đều đồng nhất 1 điều kiện. */
    private isStreakUnlocked(): boolean {
        return this.progression?.isCompleted(GameConfig.streakUnlockLevel) ?? false;
    }

    /**
     * Phát hiện điều kiện KÍCH HOẠT giải đấu Weekly lần đầu (người chơi hoàn toàn mới, đi từ
     * tutorial): đã thắng ít nhất 1 màn campaign (progression.completedCount >= 1) VÀ ĐÃ MỞ ĐƯỢC
     * Leaderboard (isLeaderboardUnlocked()). Gọi ở 2 mốc:
     *   1. Ngay sau khi thắng xong ĐÚNG level làm Leaderboard mở ra (pushLeaderboardScore — ví dụ
     *      level 10 → 11) — bắt buộc phải hiện popup kích hoạt NGAY, không đợi về Home, để nếu
     *      người chơi chơi tiếp luôn thì LeaderboardPreview ở màn kế tiếp còn có tournament đã
     *      kích hoạt để so sánh (xem UIManager.openResultPopupForWin()).
     *   2. Lúc quay lại Home (onNavigate) — bắt các trường hợp còn lại (ví dụ mở được Leaderboard
     *      rồi mới thoát về Home mà chưa kịp thấy popup ở mốc 1, hiếm khi xảy ra nhưng vẫn cần).
     * Trước khi được kích hoạt, bảng Weekly đứng yên hoàn toàn (LeaderboardManager.
     * hasTournamentActivated() == false). Không làm gì nếu đã kích hoạt rồi hoặc chưa đủ điều kiện.
     */
    private checkTournamentActivation(): void {
        if (!this.isLeaderboardUnlocked()) return;

        const legacy = LegacyLeaderboardManager.instance;
        if (!legacy || legacy.hasTournamentActivated()) return;
        if ((this.progression?.completedCount ?? 0) < 1) return;
        if (TournamentActivationPresentation.isPending()) return;
        TournamentActivationPresentation.request();
    }

    /**
     * Bấm Claim ở popup kết quả giải đấu (top 3) — CHỈ cộng thưởng đúng hạng (leaderboardData.json,
     * cùng shape GameResource dùng chung với hệ thống Shop cũ) vào kho THẬT của Dogdoku
     * (PlayerData.inventory, session-aware cho placeDogCharges — mirror purchasePackage() ở trên).
     * KHÔNG còn tự "chốt sổ"/kích hoạt giải đấu mới ở đây nữa — việc đó chuyển sang lúc popup
     * "New Session" (PopupId.TournamentReset) hiện lên SAU KHI popup này đóng (xem
     * TournamentResultPopup.onTouchCollect()), để giờ tính giải đấu mới LUÔN bắt đầu đúng lúc
     * popup đó xuất hiện, giống hệt nguyên tắc đang áp dụng cho người chơi ngoài Top 3. Trả về
     * danh sách reward đã cộng để UI hiện popup nhận thưởng.
     */
    claimTournamentReward(): GameResource[] {
        const legacy = LegacyLeaderboardManager.instance;
        if (!legacy) return [];

        const rank = legacy.getPendingTournamentRank();
        const rewards = legacy.leaderboardRewards?.[rank - 1]?.rewards ?? [];

        const inventory = SaveManager.instance.playerData.inventory;
        for (const reward of rewards) {
            if (reward.Type !== RESOURCE_TYPE.BOOSTER) continue;
            if (reward.SpecificType === BOOSTER_TYPE.HINT) {
                inventory.hintCharges = Math.max(0, inventory.hintCharges + reward.Value.m_Value);
            } else if (reward.SpecificType === BOOSTER_TYPE.PLACE_DOG) {
                if (this.session) {
                    this.session.grantPlaceDogCharges(reward.Value.m_Value);
                } else {
                    inventory.placeDogCharges = Math.max(0, inventory.placeDogCharges + reward.Value.m_Value);
                }
            }
        }
        void SaveManager.instance.persist();

        return rewards;
    }

    /** Bấm Continue ở popup kết quả giải đấu (không lọt top 3) — không có thưởng, chỉ "chốt sổ"
     * tuần cũ để tạo giải đấu mới. */
    resolveTournamentContinue(): void {
        LegacyLeaderboardManager.instance?.resolvePendingTournamentResult();
    }

    /**
     * Cộng lượt Place Dog sau khi xem quảng cáo / mua. Đang trong ván thì cộng vào
     * session (session tự phát PLACE_DOG_USED → save đồng bộ qua onPlaceDogUsed);
     * ngoài ván thì cộng thẳng vào kho.
     */
    private onPlaceDogGrantRequested = (payload: PlaceDogGrantRequestedEventPayload): void => {
        if (payload.amount <= 0) return;

        if (this.session) {
            this.session.grantPlaceDogCharges(payload.amount);
            return;
        }

        const inventory = SaveManager.instance.playerData.inventory;
        inventory.placeDogCharges = Math.max(0, inventory.placeDogCharges + payload.amount);
        void SaveManager.instance.persist();
    };

    /**
     * Cộng lượt Hint sau khi xem quảng cáo / mua — CÙNG mẫu onPlaceDogGrantRequested(). Đang trong
     * ván thì cộng vào session (session tự phát HINT_SHOWN_EVENT với hint=null → save đồng bộ qua
     * onHintShown() đã có sẵn bên dưới, không cần viết lại logic persist ở đây); ngoài ván thì
     * cộng thẳng vào kho.
     */
    private onHintGrantRequested = (payload: HintGrantRequestedEventPayload): void => {
        if (payload.amount <= 0) return;

        if (this.session) {
            this.session.grantHintCharges(payload.amount);
            return;
        }

        const inventory = SaveManager.instance.playerData.inventory;
        inventory.hintCharges = Math.max(0, inventory.hintCharges + payload.amount);
        void SaveManager.instance.persist();
    };

    private onPlaceDogUsed = (payload: PlaceDogUsedEventPayload): void => {
        // Tutorial: lượt Place Dog chỉ tồn tại trong phiên chơi này, KHÔNG được ghi đè lại
        // vào kho đồ thật của người chơi — dùng bao nhiêu trong tutorial cũng không ảnh
        // hưởng tới lượt thật ở campaign/daily.
        if (this.sessionContext === 'tutorial') return;

        SaveManager.instance.playerData.inventory.placeDogCharges = Math.max(
            0,
            payload.chargesRemaining,
        );
        void SaveManager.instance.persist();
    };

 
    private onHintShown = (payload: HintShownEventPayload): void => {
        SaveManager.instance.playerData.inventory.hintCharges = Math.max(
            0,
            payload.chargesRemaining,
        );
        void SaveManager.instance.persist();
    };

    private onSettingsChangeRequested = (payload: SettingsChangeRequestedEventPayload): void => {
        const settings = SaveManager.instance.playerData.settings;

        if (payload.bgmVolume !== undefined) {
            settings.bgmVolume = clamp01(payload.bgmVolume);
        }
        if (payload.sfxVolume !== undefined) {
            settings.sfxVolume = clamp01(payload.sfxVolume);
        }
        if (payload.vibration !== undefined) {
            settings.vibration = payload.vibration;
        }
        if (payload.language !== undefined) {
            settings.language = payload.language;
        }

        const changed: SettingsChangedEventPayload = {
            bgmVolume: settings.bgmVolume,
            sfxVolume: settings.sfxVolume,
            vibration: settings.vibration,
        };
        EventManager.instance.emit(SETTINGS_CHANGED_EVENT, changed);
    };
}

function clamp01(value: number): number {
    if (!isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
}
