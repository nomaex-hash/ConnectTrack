import { _decorator, Color, Label, Node, Prefab, RichText, Sprite, SpriteFrame, Tween, UIOpacity, UITransform, Vec3, Widget, instantiate, tween } from 'cc';
import { UIScreen } from '../UIScreen';
import { AppState } from '../../core/AppState';
import { CellState } from '../../core/CellState';
import { EventManager } from '../../core/EventManager';
import { GameConfig } from '../../config/GameConfig';
import { ProgressionHolder } from '../../gameplay/progression/ProgressionHolder';
import { LeaderboardPreviewPresentation } from '../../gameplay/leaderboardpreview/LeaderboardPreviewPresentation';
import { StreakPresentation } from '../../gameplay/streak/StreakPresentation';
import { SaveManager } from '../../manager/SaveManager';
import { PuzzleContext } from '../../model/BoardSaveData';
import { BoardView } from '../board/BoardView';
import { isHardLevel } from '../../config/LevelListConfig';
import { RuleFrameIntro } from '../widget/RuleFrameIntro';
import {
    CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT,
    CONNECT_TRACKS_RESTART_REQUESTED_EVENT,
    ConnectTracksPlaceTrackGrantRequestedEventPayload,
    HINT_GRANT_REQUESTED_EVENT,
    HintGrantRequestedEventPayload,
    LEVEL_SELECTED_EVENT,
    LevelSelectedEventPayload,
    NAVIGATE_REQUESTED_EVENT,
    NavigateRequestedEventPayload,
    PLACE_DOG_GRANT_REQUESTED_EVENT,
    PlaceDogGrantRequestedEventPayload,
} from '../../event/AppEvents';
import { AdServiceHolder } from '../../service/ads/AdServiceHolder';
import { LANGUAGE_CHANGED_EVENT } from '../../localization/LocalizationEvents';
import {
    AUTO_MARK_APPLIED_EVENT,
    AutoMarkAppliedEventPayload,
    BOARD_RESTARTED_EVENT,
    BoardRestartedEventPayload,
    CELL_CHANGED_EVENT,
    HINT_SHOWN_EVENT,
    HintShownEventPayload,
    MISTAKE_CHANGED_EVENT,
    MistakeChangedEventPayload,
    PLACE_DOG_USED_EVENT,
    PlaceDogUsedEventPayload,
    PUZZLE_READY_EVENT,
    PuzzleReadyEventPayload,
    PUZZLE_SOLVED_EVENT,
    PuzzleSolvedEventPayload,
    SCORE_CHANGED_EVENT,
    ScoreChangedEventPayload,
    TUTORIAL_GUIDED_FINISHED_EVENT,
    HEART_FLY_FINISHED_EVENT,
    VICTORY_WAVE_FINISHED_EVENT,
} from '../../event/PuzzleEvents';
import { IntentType } from '../../gameplay/PuzzleIntent';
import { PuzzleSessionHolder } from '../../gameplay/PuzzleSessionHolder';
import { PopupId } from '../PopupId';
import { HeartsView } from '../widget/HeartsView';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { GameSession } from '../../application/session/gameSession';
import { GamePhase, GameSnapshot } from '../../application/contracts/gameSnapshot';
import { requiredCellsFor } from '../../application/session/requiredCells';
import { PreloadedLevelData } from '../../application/session/preloadedLevelData';
import { CocosLevelDataAdapter } from '../../infrastructure/content/cocosLevelDataAdapter';
import { SessionProgressPort } from '../../application/ports/sessionProgressPort';
import { CocosSessionProgressAdapter } from '../../infrastructure/persistence/cocosSessionProgressAdapter';
import { ConnectTracksInventoryPort } from '../../application/ports/connectTracksInventoryPort';
import { AudioManager } from '../../manager/AudioManager';
import { CocosConnectTracksInventoryAdapter } from '../../infrastructure/persistence/cocosConnectTracksInventoryAdapter';
import { ConnectTracksBoardView } from '../../presentation/board/connectTracksBoardView';
import { ConnectTracksVictoryView } from '../../presentation/board/connectTracksVictoryView';
import { ConnectTracksOptionMenuView } from '../../presentation/board/connectTracksOptionMenuView';
import { ConnectTracksLoseData } from '../popup/ConnectTracksLosePopup';
import { ConnectTracksTutorialController } from '../tutorial/connectTracksTutorialController';
import { ConnectTracksHintView } from '../../presentation/board/connectTracksHintView';
import { UIManager } from '../../manager/UIManager';
import { CocosPointerInput } from '../../presentation/input/cocosPointerInput';
import { computeTrackOptionValidity, directionsForOrientation, TrackOptionKind } from '../../presentation/board/trackOptions';

const { ccclass, property } = _decorator;

/** Hiệu ứng hiện/ẩn của connectTracksHintLabel (xác nhận từ user: scale + opacity). */
const CONNECT_TRACKS_HINT_FROM_SCALE = 0.85;
const CONNECT_TRACKS_HINT_POP_SECONDS = 0.18;
const CONNECT_TRACKS_HINT_VISIBLE_SECONDS = 3;

@ccclass('GameplayScreen')
export class GameplayScreen extends UIScreen {
    @property({ type: Label, tooltip: 'Giá trị title: số level (campaign) hoặc ngày (daily).' })
    levelLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Label hiển thị kích thước bàn ConnectTracks, ví dụ 10 x 10.' })
    boardSizeLabel: Label | null = null;

    @property({
        type: Label,
        tooltip: 'Chú thích title (tùy chọn): "Màn" cho campaign, "Ngày" cho daily. Có thể trống.',
    })
    levelCaption: Label | null = null;

    @property({ type: HeartsView, tooltip: 'Dãy tim thể hiện số mistake còn lại' })
    heartsView: HeartsView | null = null;

    @property({
        type: ConnectTracksBoardView,
        tooltip:
            'Instance của Board.prefab (ConnectTracks) kéo vào trong scene Gameplay. Dùng để render ' +
            'bàn cờ ConnectTracks thật ở màn này. KHÔNG dùng chung với board Dogdoku cũ (BoardView) — ' +
            'để trống thì bàn ConnectTracks sẽ không hiện (chỉ log cảnh báo, không crash).',
    })
    connectTracksBoard: ConnectTracksBoardView | null = null;

    @property({ type: ConnectTracksVictoryView, tooltip: 'Chuỗi thắng Rail → ẩn HUD → giữa màn → tàu → nút đi tiếp.' })
    connectTracksVictory: ConnectTracksVictoryView | null = null;

    @property({
        type: CocosPointerInput,
        tooltip:
            'Component CocosPointerInput — gắn trên CÙNG node với connectTracksBoard ở trên (board ' +
            'có UITransform để tính toạ độ chạm). Dùng để nhận chạm/kéo (tap, double-tap, kéo nối ' +
            'track) trên bàn ConnectTracks. Để trống thì board vẫn hiện nhưng KHÔNG bấm/kéo được gì.',
    })
    connectTracksInput: CocosPointerInput | null = null;

    @property({
        type: ConnectTracksTutorialController,
        tooltip:
            'Component ConnectTracksTutorialController — chiếm dụng connectTracksBoard/connectTracksInput/' +
            'connectTracksVictory ở trên trong lúc chạy màn hướng dẫn (context "tutorial"). Để trống thì ' +
            'tutorial ConnectTracks sẽ KHÔNG chạy, màn sẽ tải như 1 level ConnectTracks bình thường.',
    })
    connectTracksTutorial: ConnectTracksTutorialController | null = null;

    @property({
        type: Node,
        tooltip:
            'Label (cụm node) thông báo "cần nối các track lại" — node này nằm ở màn Gameplay (KHÔNG ' +
            'phải trong Board.prefab). Hiện khi mọi ô required đã được xác định là track (TrackPreview/ ' +
            'Track ?/Track hoàn chỉnh) nhưng CHƯA nối hết thành Track hoàn chỉnh ở mọi ô; tắt ngay khi ' +
            'tự ẩn sau 3 giây; ẩn sớm khi thắng hoặc không còn đủ điều kiện (xem GameSnapshot.needsConnectionHint). ' +
            'Hiệu ứng hiện/ẩn: scale + opacity. Để trống thì bỏ qua, không có label này.',
    })
    connectTracksHintLabel: Node | null = null;

    @property({
        type: RuleFrameIntro,
        tooltip:
            '"Nối lại node encourage đầu game" (xác nhận từ user — port từ luồng Dogdoku cũ) — bong ' +
            'bóng chữ khích lệ hiện lên SAU KHI board ConnectTracks hiện xong, bỏ qua tutorial. CHỈ ' +
            'cần gán encourageNodeNormal/encourageLabelNormal (+ encourageNodeHard/' +
            'encourageLabelHard nếu muốn phân biệt level khó) trên component này — KHÔNG cần gán ' +
            'ruleFrameNode/goldBorderNode (ConnectTracks không có RuleFrame, phần đó tự bỏ qua). Để ' +
            'trống thì bỏ qua hẳn tính năng này.',
    })
    connectTracksEncourage: RuleFrameIntro | null = null;

    @property({
        type: ConnectTracksOptionMenuView,
        tooltip:
            'Track option menu (xác nhận từ user) — component riêng (ConnectTracksOptionMenuView), ' +
            'tự lo 7 option (6 hình dạng track + "track preview"), hiện/ẩn, tô enabled/disabled/ ' +
            'currentOutline. Node gốc của nó nằm ở màn Gameplay (KHÔNG phải trong Board.prefab), tự ' +
            'định vị/di chuyển trong Editor nếu cần. Màn này chỉ gọi show()/hide()/hideInstant() và ' +
            'nghe setOptionSelectedHandler — xem connectTracksOptionMenuView.ts để biết cấu trúc node con.',
    })
    connectTracksOptionMenu: ConnectTracksOptionMenuView | null = null;

    @property(ConnectTracksHintView)
    connectTracksBoosterHint: ConnectTracksHintView | null = null;

    @property({
        type: RichText,
        tooltip:
            'Số chó đã đặt / tổng, ví dụ "2/6". Là RichText chứ không phải Label vì chỉ ' +
            'phần TỔNG được tô màu riêng — Label chỉ tô được nguyên chuỗi một màu.',
    })
    dogsLabel: RichText | null = null;

    @property({ tooltip: 'Màu của số chó ĐÃ TÌM THẤY (số trước dấu /).' })
    foundDogsColor: Color = new Color(76, 209, 55);

    @property({ type: Sprite, tooltip: 'Thanh tiến trình (Sprite type = FILLED). Có thể trống.' })
    dogsFill: Sprite | null = null;

    @property({
        type: RichText,
        tooltip:
            'ConnectTracks (song song với dogsLabel, KHÔNG dùng chung): số ô đường ray đã TÌM ĐÚNG / ' +
            'tổng số ô cần tìm trên bàn, ví dụ "1/4" — tăng dần CÙNG lúc với score (TrackPreview/' +
            'Track lần đầu, không tính các ô given/mainTrackCells). Dùng chung màu foundDogsColor ' +
            'cho phần số đã tìm.',
    })
    connectTracksTrackCountLabel: RichText | null = null;

    @property({ type: Label, tooltip: 'Số lượt Place Dog còn lại' })
    placeDogLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Sprite "xem quảng cáo" trên nút Place Dog — chỉ hiện khi HẾT lượt. Bấm nút ' +
            'lúc này sẽ mở quảng cáo có thưởng thay vì dùng lượt.',
    })
    placeDogAdIcon: Node | null = null;

    @property({ tooltip: 'Số lượt Place Dog nhận được sau khi xem xong 1 quảng cáo.' })
    placeDogAdReward = 1;

    // Place Track (ConnectTracks, xác nhận từ user — dựa trên Place Dog ở trên): song song HOÀN
    // TOÀN với Place Dog — KHÔNG dùng chung label/ad icon/lượt với Place Dog, chỉ dùng chung
    // adOverlay + adInProgress bên dưới (1 overlay chờ quảng cáo cho cả màn, 2 booster không xem
    // quảng cáo cùng lúc được — giống cách Hint cũng dùng chung 2 field đó).
    @property({ type: Label, tooltip: 'Số lượt Place Track còn lại (ConnectTracks) — song song với placeDogLabel, KHÔNG dùng chung.' })
    connectTracksPlaceTrackLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Sprite "xem quảng cáo" trên nút Place Track — chỉ hiện khi HẾT lượt. Bấm nút lúc này ' +
            'sẽ mở quảng cáo có thưởng thay vì dùng lượt. Cùng mẫu placeDogAdIcon.',
    })
    connectTracksPlaceTrackAdIcon: Node | null = null;

    @property({ tooltip: 'Số lượt Place Track nhận được sau khi xem xong 1 quảng cáo.' })
    connectTracksPlaceTrackAdReward = 1;

    @property({
        min: 0,
        step: 1,
        tooltip:
            'Số lượt Place Track khởi tạo lần ĐẦU TIÊN chơi ConnectTracks (chưa từng lưu gì) — các ' +
            'lần mở màn sau đọc đúng số đã lưu, không reset lại số này nữa.',
    })
    connectTracksPlaceTrackInitialCharges = 5;

    @property({
        type: Node,
        tooltip:
            'Node phủ toàn màn hình khi đang "xem quảng cáo" (IAdService.showRewarded() đang ' +
            'chờ). Ẩn sẵn; script tự bật/tắt. Khi gắn SDK quảng cáo thật, node này là màn hình ' +
            'chờ trước khi SDK tự vẽ đè quảng cáo lên trên.',
    })
    adOverlay: Node | null = null;

    @property({ type: Label, tooltip: 'Số lượt Hint còn lại' })
    hintLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Sprite "xem quảng cáo" trên nút Hint — CÙNG mẫu placeDogAdIcon, chỉ hiện khi HẾT ' +
            'lượt. Bấm nút lúc này sẽ mở quảng cáo có thưởng thay vì dùng lượt.',
    })
    hintAdIcon: Node | null = null;

    @property({ tooltip: 'Số lượt Hint nhận được sau khi xem xong 1 quảng cáo.' })
    hintAdReward = 1;

    @property({
        type: Label,
        tooltip: 'Điểm của ván hiện tại. Reset về 0 mỗi khi vào màn mới.',
    })
    scoreLabel: Label | null = null;

    @property({
        tooltip: 'Điểm cộng thêm chạy nhanh qua từng số trong bao lâu (giây) thay vì nhảy thẳng.',
    })
    scoreCountUpSeconds = 0.4;

    @property({
        type: SpriteFrame,
        tooltip:
            'Ảnh "đốm sáng" bay từ các ô vừa tự đánh dấu X (lúc thắng màn) tới scoreLabel — ' +
            'xem onAutoMarkApplied()/flyAutoMarkSparks(). Để trống thì BỎ QUA phần hiệu ứng bay ' +
            '(không crash) — điểm vẫn tăng đúng lúc, chỉ là không có đốm sáng cho tới khi gán ảnh.',
    })
    autoMarkSparkSpriteFrame: SpriteFrame | null = null;

    @property({
        type: [Node],
        tooltip:
            'Các cụm HUD BỊ ẨN khi vào tutorial (TopBar, ProgressRow, RulesFrame, ' +
            'BottomToolbar). Tutorial chỉ có bàn cờ, không HUD. Dạy xong (FreePlay) ' +
            'các node này VẪN ẨN — chỉ text tutorial + tutorialPlaceDogNode được hiện.',
    })
    hudNodes: Node[] = [];

    @property({
        type: Node,
        tooltip:
            'Node chức năng Place Dog RIÊNG cho tutorial (KHÔNG phải node trong BottomToolbar) ' +
            '— hiện lên sau khi dạy xong 3 con chó hướng dẫn, để người chơi tự hoàn thành bàn ' +
            'còn lại. Ẩn sẵn; script tự bật. Có thể để trống nếu chưa dựng.',
    })
    tutorialPlaceDogNode: Node | null = null;

    @property({
        type: Label,
        tooltip:
            'Label số lượt Place Dog TRÊN node tutorial ở trên — KHÁC placeDogLabel (node ' +
            'riêng, không tự động theo nhau). Để trống thì nút tutorial không hiện số.',
    })
    tutorialPlaceDogLabel: Label | null = null;

    @property({ tooltip: 'Node Place Dog tutorial: mỗi nhịp phóng to (rồi thu lại) mất bao lâu (giây).' })
    tutorialPlaceDogPulseSeconds = 0.5;

    @property({ range: [1, 1.3, 0.01], slide: true, tooltip: 'Node Place Dog tutorial phóng to tới mức nào mỗi nhịp.' })
    tutorialPlaceDogPulseScale = 1.08;

    @property({
        type: Label,
        tooltip:
            'Label số tim tích luỹ lúc thắng — các tim còn lại ở ô mistake lần lượt bay tới đây rồi số ' +
            'này tăng dần (chạy SAU sóng chéo thắng màn). Để trống thì bỏ qua hiệu ứng tim bay.',
    })
    heartCountLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Nhóm chứa heartCountLabel + bg — đặt ở vị trí TRONG (đích) trong Editor. Lúc chạy script ' +
            'tự đẩy nó ra rìa NGOÀI màn hình (theo heartCountOuterOffset) và trượt vào vị trí gốc khi ' +
            'sóng thắng màn xong. Trống thì label đứng yên tại chỗ.',
    })
    heartCountGroup: Node | null = null;

    @property({
        tooltip:
            'Lệch NGANG (px, chỉ dùng X — Y/Z bị bỏ qua để nhóm luôn trượt 1 đường thẳng ngang) từ vị trí ' +
            'TRONG ra vị trí NGOÀI rìa màn hình — chọn đủ lớn để nhóm nằm hẳn ngoài màn. Ví dụ neo rìa ' +
            'phải: X=400; rìa trái: X=-400.',
    })
    heartCountOuterOffset: Vec3 = new Vec3(400, 0, 0);

    @property({ tooltip: 'Thời gian nhóm label trượt từ rìa ngoài vào vị trí đích (giây).' })
    heartCountSlideSeconds = 0.4;

    @property({
        tooltip:
            'Khoảng cách (px) từ MÉP TRÁI màn hình THẬT tới nhóm — nhóm LUÔN neo ở đây khi đã trượt ' +
            'vào (đích trượt vào giờ tính theo mép trái màn hình thật, KHÔNG còn dùng vị trí "trong" ' +
            'đặt sẵn trong Editor nữa — vẫn giữ nguyên Y của vị trí đó).',
    })
    heartCountLeftMargin = 40;

    @property({ tooltip: 'Thời gian opacity từ 0 lên 255 (giây) — chạy TRƯỚC khi nhóm bắt đầu trượt vào (lúc còn ở rìa ngoài).' })
    heartCountFadeInSeconds = 0.15;

    private heartGroupInnerPos: Vec3 | null = null;

    @property({ tooltip: 'Tim bay: khoảng cách (giây) giữa 2 tim cất cánh liên tiếp.' })
    heartFlyStaggerSeconds = 0.25;

    @property({ tooltip: 'Tim bay: thời gian 1 tim bay từ ô mistake tới label (giây).' })
    heartFlySeconds = 0.5;

    @property({ tooltip: 'Tim bay: kích thước icon (px, vuông).' })
    heartFlyIconSize = 56;

    private mistakesRemaining = 0;
    private heartFlyBusy = false;

    private totalDogs = 0;
    /** Tổng số ô đường ray cần tìm của level ConnectTracks hiện tại — giống requiredCellsFor(level)
     * dùng để tạo connectTracksSession, chụp lại 1 lần lúc tải level để refreshConnectTracksBoard()
     * khỏi phải gọi lại requiredCellsFor() mỗi frame. */
    private connectTracksRequiredCellsTotal = 0;
    private maxMistakes = 0;
    private placeDogCharges = 0;
    private hintCharges = 0;
    private adInProgress = false;
    private readonly connectTracksInventory: ConnectTracksInventoryPort = new CocosConnectTracksInventoryAdapter();
    private connectTracksPlaceTrackCharges = 0;
    private isDailyContext = false;
    private currentContext: PuzzleContext = 'campaign';
    private currentPuzzleId = 0;
    private displayedScore = 0;
    private readonly scoreCounter = { value: 0 };
    /** Cách tính điểm Y HỆT Meowdoku's ScoreSystem.addForDog (xác nhận từ user: "cách tính điểm như
     * Meowdoku") — tier tăng dần theo combo streak (scoreStreakBaseTier + (streak-1) *
     * scoreStreakTierStep) CỘNG speed bonus (đặt càng nhanh liên tiếp càng thưởng thêm, xem
     * speedBonusFor) — streak reset về 0 mỗi khi có mistake mới (RedX), elapsed-seconds tự đếm
     * riêng cho ConnectTracks (GameSession không có timer, không mượn của PuzzleSession được) vì
     * phiên ConnectTracks sống độc lập hoàn toàn với PuzzleSession cũ. KHÔNG phân biệt đặt tay hay
     * Place Track hỗ trợ (đơn giản hoá — Meowdoku gốc có addForAssistedDog riêng cho hỗ trợ, nhưng
     * việc đó cần biết lệnh nào vừa dispatch, ngoài phạm vi chỉ diff snapshot hiện tại). */
    private connectTracksScoreStreak = 0;
    private connectTracksLastGainSeconds: number | null = null;
    private connectTracksElapsedStartMs = 0;


    private foundColorHex = '4cd137';

    // Cầu nối sang luồng ConnectTracks thật (song song với luồng Dogdoku cũ ở trên — không đổi
    // GameManager/PuzzleSession). payload.puzzleId (Dogdoku) được dùng TRỰC TIẾP làm id level
    // ConnectTracks (tblevels_combined_0to200.json, "0".."200") — lựa chọn tạm/kỹ thuật, CHƯA
    // phải quy tắc gameplay; nếu puzzleId vượt ngoài 0-200 việc load sẽ lỗi (chỉ log, không crash).
    private connectTracksLevels = new PreloadedLevelData(new CocosLevelDataAdapter());

    /** Injected before open by the boot composition, preserving the level warmed during Boot. */
    setConnectTracksLevels(levels: PreloadedLevelData): void {
        this.connectTracksLevels = levels;
    }
    private readonly connectTracksProgress: SessionProgressPort = new CocosSessionProgressAdapter();
    private connectTracksProgressKey: string | null = null;
    private connectTracksSession: GameSession | null = null;
    private connectTracksLoadToken = 0;
    private connectTracksLostNotified = false;
    /** Chặn gọi lặp lại nếu tàu chạy xong (setWonHandler) được gọi hơn 1 lần — xem notifyConnectTracksWon. */
    private connectTracksWonNotified = false;
    private connectTracksVictoryStarted = false;
    /** true trong lúc đang chờ connectTracksEncourage.playWinPraise() chạy xong — chặn
     * refreshConnectTracksBoard() gọi lại lần nữa (vào cùng nhánh Won) trong lúc hiệu ứng "khen
     * thắng" còn đang hiện, tránh chạy playWinPraise() chồng nhiều lần trước khi
     * connectTracksVictory.begin() kịp bắt đầu (lúc đó connectTracksVictoryStarted mới được set). */
    private connectTracksWinPraisePending = false;
    /** Tránh phát lại tween hiện/ẩn connectTracksHintLabel mỗi lần refresh nếu trạng thái không đổi. */
    private connectTracksHintVisible = false;
    private connectTracksHintEligible = false;
    private readonly expireConnectTracksHint = (): void => {
        this.animateConnectTracksHint(false);
    };
    /** Ô đang mở Track option menu (xác nhận từ user), hoặc null — gương lại đúng BoardView's
     * selectedCell qua setSelectedCellChangedHandler, chỉ để đổ dữ liệu/hiện cụm option CỐ ĐỊNH. */
    private connectTracksOptionsSelectedCell: number | null = null;

    protected onOpen(): void {
        this.foundColorHex = this.foundDogsColor.toHEX('#rrggbb');

        // Chốt vị trí TRONG (đích) 1 lần từ Editor rồi đẩy nhóm ra rìa ngoài.
        if (this.heartCountGroup?.isValid) {
            this.heartGroupInnerPos = this.heartCountGroup.position.clone();
            this.resetHeartGroup();
        }

        this.warnIfMissing(this.levelLabel, 'levelLabel');
        this.warnIfMissing(this.heartsView, 'heartsView');
        this.warnIfMissing(this.dogsLabel, 'dogsLabel');
        this.warnIfMissing(this.placeDogLabel, 'placeDogLabel');
        this.warnIfMissing(this.connectTracksBoard, 'connectTracksBoard');
        this.warnIfMissing(this.connectTracksInput, 'connectTracksInput');
        this.warnIfMissing(this.connectTracksVictory, 'connectTracksVictory');
        this.warnIfMissing(this.connectTracksTutorial, 'connectTracksTutorial');
        this.warnIfMissing(this.connectTracksHintLabel, 'connectTracksHintLabel');
        this.warnIfMissing(this.connectTracksOptionMenu, 'connectTracksOptionMenu');
        this.warnIfMissing(this.connectTracksPlaceTrackLabel, 'connectTracksPlaceTrackLabel');
        this.warnIfMissing(this.connectTracksTrackCountLabel, 'connectTracksTrackCountLabel');

        // Place Track là 1 ví (inventory) RIÊNG của người chơi, tồn tại XUYÊN SUỐT mọi level
        // ConnectTracks (không reset mỗi lần vào màn/level mới, khác board progress theo từng
        // level) — chỉ cần đọc 1 LẦN lúc mở màn Gameplay, không đọc lại mỗi lần load level.
        const savedCharges = this.connectTracksInventory.readPlaceTrackCharges();
        this.connectTracksPlaceTrackCharges = savedCharges ?? this.connectTracksPlaceTrackInitialCharges;
        if (savedCharges === null) {
            this.connectTracksInventory.writePlaceTrackCharges(this.connectTracksPlaceTrackCharges);
        }
        this.refreshConnectTracksPlaceTrackAdIcon();

        const bus = EventManager.instance;
        bus.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onPuzzleReady, this);
        bus.on(LANGUAGE_CHANGED_EVENT, this.refreshLevelCaption, this);
        bus.on<MistakeChangedEventPayload>(MISTAKE_CHANGED_EVENT, this.onMistakeChanged, this);
        bus.on<PlaceDogUsedEventPayload>(PLACE_DOG_USED_EVENT, this.onPlaceDogUsed, this);
        bus.on<HintShownEventPayload>(HINT_SHOWN_EVENT, this.onHintShown, this);
        bus.on(CELL_CHANGED_EVENT, this.onCellChanged, this);
        bus.on<BoardRestartedEventPayload>(BOARD_RESTARTED_EVENT, this.onBoardRestarted, this);
        bus.on<ScoreChangedEventPayload>(SCORE_CHANGED_EVENT, this.onScoreChanged, this);
        bus.on(TUTORIAL_GUIDED_FINISHED_EVENT, this.onTutorialGuidedFinished, this);
        bus.on(VICTORY_WAVE_FINISHED_EVENT, this.onVictoryWaveFinished, this);
        bus.on<AutoMarkAppliedEventPayload>(AUTO_MARK_APPLIED_EVENT, this.onAutoMarkApplied, this);
        // Nút Restart ở popup Settings (SettingsPopup.onTapReplay) không giữ reference tới màn này
        // hay connectTracksSession — chỉ emit sự kiện, màn Gameplay đang mở tự restart đúng session
        // ConnectTracks của nó (xác nhận từ user: Restart ở Settings vẫn phải restart được màn chơi).
        bus.on(CONNECT_TRACKS_RESTART_REQUESTED_EVENT, this.onTapRestart, this);
        // Nút test "Add Place Track" ở Settings (SettingsPopup.onTapTestAddPlaceTrack) không giữ
        // reference tới connectTracksInventory — chỉ emit sự kiện, màn Gameplay đang mở tự cộng
        // thẳng vào kho Place Track của nó.
        bus.on<ConnectTracksPlaceTrackGrantRequestedEventPayload>(
            CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT,
            this.onConnectTracksPlaceTrackGranted,
            this,
        );
    }

    protected onClose(): void {
        this.saveConnectTracksProgress();
        this.connectTracksProgressKey = null;
        this.connectTracksTutorial?.cancel();
        EventManager.instance.targetOff(this);

        // Chuỗi hiệu ứng tự đánh dấu ô (onAutoMarkApplied/playAutoMarkCelebration/flyAutoMarkSparks)
        // dùng nhiều scheduleOnce() nối tiếp — huỷ hết nếu màn đóng giữa chừng (ví dụ nhảy sang
        // Streak ngay sau khi thắng), tránh gọi vào node/label đã đóng ở 1 callback trễ.
        this.unscheduleAllCallbacks();

        // Huỷ mọi loadConnectTracksLevel() đang await: nếu nó resolve sau khi màn đã đóng (và có
        // thể đã mở lại với 1 level khác), token không khớp nữa nên bị bỏ qua.
        this.connectTracksLoadToken++;

        // BUG đã sửa (báo lỗi của user: "sau streak thì lại bắt người chơi chơi lại màn [vừa
        // thắng]"): màn Gameplay bị ĐÓNG (onClose, qua UIManager.showScreenFor) mỗi khi chuyển
        // sang màn Streak ăn mừng — dù GameManager cố tình GIỮ SỐNG session của NÓ (xem
        // enterStreakScreen/resumingSolvedSession), connectTracksSession là field RIÊNG của CHÍNH
        // component này, không liên quan gì — vẫn bị dọn sạch ở dưới như mọi lần đóng màn bình
        // thường khác (connectTracksVictory?.cancel() HUỶ LUÔN chuỗi ăn mừng đang tạm dừng chờ
        // resume(), connectTracksSession=null xoá sạch ván vừa thắng, connectTracksInput?.unbind()
        // làm board hết phản hồi). Lúc quay lại (onOpen), không có gì tạo lại —
        // onPuzzleReady() cố tình return sớm cho trường hợp "instant" resume (xem ghi chú ở đó),
        // nên coi như "trắng tay", buộc tải lại từ đầu ở nơi khác.
        //
        // StreakPresentation.isPending() đúng là `true` NGAY TẠI THỜI ĐIỂM NÀY (cờ đặt ở
        // GameManager.onPuzzleSolved, TRƯỚC KHI DailyStreakScreen.onOpen() kịp consume nó vài dòng
        // sau) — dùng làm tín hiệu đáng tin cậy "chỉ đang tạm NHƯỜNG màn hình cho Streak, sắp quay
        // lại NGAY đúng session này", bỏ qua toàn bộ phần dọn dẹp ConnectTracks bên dưới trong
        // trường hợp đó. Nếu người chơi sau đó bấm back ở Streak (bỏ dở, về MainMenu) thay vì
        // "Tiếp tục", session bị bỏ quên ở đây vẫn được dọn sạch BÌNH THƯỜNG sau đó — lần
        // loadConnectTracksLevel() kế tiếp (level thật sự mới) tự gán lại connectTracksSession=null
        // đầu tiên trước khi tạo session mới, không rò rỉ gì cả.
        if (!StreakPresentation.isPending()) {
            this.connectTracksVictory?.cancel();
            this.connectTracksVictoryStarted = false;
            this.connectTracksWinPraisePending = false;
            this.connectTracksEncourage?.cancelWinPraise();
            // animateScoreTo() tween trên object thường (scoreCounter), KHÔNG phải Node — Cocos
            // không tự huỷ tween này khi node bị destroy như với Node/Component thật. Trước đây
            // không sao vì màn Gameplay luôn sống đủ lâu (đợi Result popup); giờ có luồng thắng
            // lần đầu trong ngày nhảy thẳng sang Streak NGAY, dễ đóng màn khi tween còn đang
            // chạy dở, để sót thì "value" bị đọc trên state đã chết → crash "reading 'value'".
            Tween.stopAllByTarget(this.scoreCounter);
            this.connectTracksBoosterHint?.close(false);
            this.connectTracksSession?.cancelHint();
            this.connectTracksSession = null;
            this.soundSnapshot = null;
            this.connectTracksLostNotified = false;
            this.connectTracksWonNotified = false;
            this.connectTracksInput?.unbind();
            this.connectTracksBoard?.setWonHandler(null);
            this.connectTracksBoard?.setSelectedCellChangedHandler(null);
            this.connectTracksOptionMenu?.setOptionSelectedHandler(null);
            this.connectTracksOptionsSelectedCell = null;
            this.hideConnectTracksHintInstant();
            this.connectTracksOptionMenu?.hideInstant();
        }
    }


    private onPuzzleReady = (payload: PuzzleReadyEventPayload): void => {
        // BUG đã sửa (báo lỗi của user — "chơi xong màn 1, qua Streak xong lại phải chơi lại màn
        // 1"): GameManager.onNavigate gọi session.emitReadyAgain() (PUZZLE_READY_EVENT với
        // instant=true) khi bấm "Tiếp tục" ở màn Streak quay LẠI đúng session vừa thắng (session
        // không hề bị huỷ — xem enterStreakScreen/resumingSolvedSession). Lúc đó level NÀY đã thắng
        // xong và ConnectTracksVictoryView đang TẠM DỪNG đúng ngay chỗ này chờ popup Tournament/
        // Streak/LeaderboardPreview chạy xong để resume() (xem UIManager.runConnectTracksReadyChain)
        // — nếu xử lý y hệt 1 level MỚI (cancel() + loadConnectTracksLevel() load lại từ đầu bên
        // dưới) sẽ HUỶ MẤT ván vừa thắng, buộc người chơi chơi lại từ đầu. Cùng context+puzzleId,
        // instant=true, không phải tutorial => chỉ là "thông báo lại", không làm gì cả, để luồng ăn
        // mừng đang tạm dừng tự tiếp tục.
        console.log('[DEBUG GameplayScreen] onPuzzleReady:', JSON.stringify({
            instant: payload.instant, payloadContext: payload.context, payloadPuzzleId: payload.puzzleId,
            currentContext: this.currentContext, currentPuzzleId: this.currentPuzzleId,
        }));
        if (payload.instant && payload.context !== 'tutorial'
            && payload.context === this.currentContext && payload.puzzleId === this.currentPuzzleId) {
            console.log('[DEBUG GameplayScreen] onPuzzleReady: GUARD HIT -> return early (no reload)');
            return;
        }
        console.log('[DEBUG GameplayScreen] onPuzzleReady: guard MISSED -> will proceed to cancel()/loadConnectTracksLevel()');
        // BUG đã sửa (báo lỗi của user — "booster/back/settings bị ẩn sau khi sang level thật từ
        // tut"): ConnectTracksVictoryView.collectHud() quét MỌI node con không được bảo vệ của
        // gameplayRoot (gồm TopBar/BtnBack/BottomToolbar — nơi chứa nút back/settings/2 booster) rồi
        // fade opacity về 0 + active=false làm hiệu ứng ăn mừng lúc thắng tutorial (dùng CHUNG 1
        // instance ConnectTracksVictoryView với gameplay thật — xác nhận bằng cách đọc thẳng
        // GameplayScreen.prefab: connectTracksVictory và ConnectTracksTutorialController.victory
        // cùng trỏ 1 node). cancel() trước đó chỉ được gọi BÊN TRONG loadConnectTracksLevel() — tức
        // là SAU vòng lặp hudNodes bên dưới — nên có 1 khung hình opacity vẫn = 0 dù active đã bật
        // lại. Gọi cancel() NGAY TẠI ĐÂY, trước mọi thứ khác, để opacity/active được phục hồi dứt
        // khoát trước khi quyết định trạng thái HUD mới (loadConnectTracksLevel gọi lại cancel() lần
        // nữa vẫn an toàn — savedHud đã rỗng, chỉ là no-op).
        this.connectTracksVictory?.cancel();
        this.connectTracksVictoryStarted = false;
        this.connectTracksWinPraisePending = false;
        this.connectTracksEncourage?.cancelWinPraise();
        // BUG đã sửa (báo lỗi của user): sau khi bấm "sang màn tiếp theo" ở cuối tutorial, màn thật
        // mở ra nhưng khung text/chấm tròn CỦA TUTORIAL vẫn còn hiện đè lên — vì connectTracksTutorial
        // chưa bao giờ bị cancel() khi onPuzzleReady chạy lại cho level THẬT (isTutorial=false).
        // Luôn dọn sạch nó ở đây, bất kể payload mới là tutorial hay level thật.
        //
        // BUG đã sửa (báo lỗi của user — "offset board của tut vẫn đang ảnh hưởng đến màn
        // campaign"): connectTracksTutorial?.cancel() PHẢI chạy SAU connectTracksVictory?.cancel()
        // (trước đây ngược lại) — ConnectTracksVictoryView.cancel() tự trả board.node về
        // this.boardPosition, giá trị nó TỰ CHỤP lúc victory.begin() (đúng lúc tutorial vừa thắng,
        // tutorial.enterWonStep() gọi) — một snapshot ĐỘC LẬP, có thể lệch (log thực tế đo được:
        // Y=-50 thay vì đúng vị trí gốc của board). Nếu tutorial.cancel() (trả board về ĐÚNG vị trí
        // gốc gameplay thật, chụp từ trước khi tutorial từng đụng vào) chạy TRƯỚC, victory.cancel()
        // chạy SAU sẽ ĐÈ LẠI bằng snapshot sai đó — board kẹt lệch dù tutorial.cancel() đã làm đúng.
        // Đảo thứ tự: để tutorial.cancel() là lệnh CUỐI CÙNG quyết định vị trí board.
        this.connectTracksTutorial?.cancel();
        this.totalDogs = payload.totalDogs;
        this.maxMistakes = payload.maxMistakes;

        const isTutorial = payload.context === 'tutorial';
        for (const node of this.hudNodes) {
            if (node) node.active = !isTutorial;
        }
        if (this.tutorialPlaceDogNode) {
            Tween.stopAllByTarget(this.tutorialPlaceDogNode);
            this.tutorialPlaceDogNode.setScale(1, 1, 1);
            this.tutorialPlaceDogNode.active = false;
        }

        this.isDailyContext = payload.context === 'daily';
        this.currentContext = payload.context;
        this.currentPuzzleId = payload.puzzleId;
        this.refreshLevelCaption();
        this.setLabel(this.levelLabel, this.isDailyContext ? this.formatToday() : `${payload.puzzleId}`);
        this.heartsView?.set(payload.mistakesRemaining, payload.maxMistakes);
        this.mistakesRemaining = payload.mistakesRemaining;
        this.heartFlyBusy = false;
        this.setLabel(this.heartCountLabel, 'x0');
        this.resetHeartGroup();
        this.setLabel(this.placeDogLabel, `${payload.placeDogCharges}`);
        this.setLabel(this.tutorialPlaceDogLabel, `${payload.placeDogCharges}`);
        this.refreshPlaceDogAdIcon(payload.placeDogCharges);
        this.refreshHintAdIcon(payload.hintCharges);

        Tween.stopAllByTarget(this.scoreCounter);
        this.displayedScore = payload.score;
        this.scoreCounter.value = payload.score;
        this.setLabel(this.scoreLabel, `${payload.score}`);

        this.updateDogProgress(payload.cellStates);

        if (isTutorial) {
            // "Nút khi thắng ở tut có tác dụng y hệt nút ở main menu, chỉ mở màn chơi hiện tại"
            // (xác nhận từ user — thay cho cách làm trước đó mô phỏng nguyên luồng thắng thật, vốn
            // không sửa được triệu chứng booster/HUD bị ẩn). Copy ĐÚNG MainMenuScreen.onTapPlay():
            // không notifyConnectTracksWon/preload gì cả, chỉ emit LEVEL_SELECTED_EVENT thẳng tới
            // level campaign hiện tại của người chơi (ProgressionHolder.getCurrentLevel()) — label
            // nút hiện số level đó, giống label nút Play ở main menu.
            this.connectTracksTutorial?.begin(
                () => {
                    // BUG đã sửa (báo lỗi của user: "lần nào vào game cũng phải chơi qua tut, tut
                    // chỉ được phép hiện 1 lần trong lần đầu tiên") — tutorial ConnectTracks (khác
                    // tutorial Dogdoku cũ) không bắn PUZZLE_SOLVED_EVENT nên KHÔNG BAO GIỜ chạy qua
                    // GameManager.handleTutorialSolved() (nơi DUY NHẤT đặt hasSeenTutorial=true) —
                    // Bootloader luôn đọc cờ này để quyết định vào thẳng tutorial hay MainMenu lúc
                    // mở app, nên cờ mãi mãi ở false khiến tutorial hiện lại MỌI LẦN mở app. Đặt
                    // thẳng ở đây — NGAY lúc tutorial thật sự xong (trước cả khi người chơi bấm
                    // "Tiếp theo") — và persist() ngay, không đợi tới lần save định kỳ kế tiếp lỡ
                    // người chơi thoát app sớm.
                    SaveManager.instance.playerData.hasSeenTutorial = true;
                    void SaveManager.instance.persist();
                    const currentLevel = ProgressionHolder.current?.getCurrentLevel() ?? 1;
                    const label = this.connectTracksVictory?.nextLabel;
                    if (label) label.string = `${Localization.get(L10N.menu.levelPrefix)}${currentLevel}`;
                    // "Load màn 1 luôn trong lúc popup thắng tut còn hiện, để sang màn 1 không bị
                    // nháy" (xác nhận từ user) — tải trước NGAY LÚC NÀY (sớm nhất có thể, trước khi
                    // người chơi kịp bấm "Tiếp theo"), cùng kiểu non-blocking preload đã dùng ở luồng
                    // thắng thật (xem notifyConnectTracksWon's completed callback bên dưới).
                    void this.connectTracksLevels.preload(String(currentLevel)).catch(error => {
                        console.warn(`[GameplayScreen] Could not preload ConnectTracks level ${currentLevel}; retry on entry.`, error);
                    });
                },
                () => {
                    const currentLevel = ProgressionHolder.current?.getCurrentLevel() ?? 1;
                    const payload: LevelSelectedEventPayload = { context: 'campaign', levelId: currentLevel };
                    EventManager.instance.emit(LEVEL_SELECTED_EVENT, payload);
                },
            );
            return;
        }

        void this.loadConnectTracksLevel(`${payload.puzzleId}`);
    };

    /**
     * Tải level ConnectTracks dùng TRỰC TIẾP payload.puzzleId (Dogdoku) làm id trong
     * tblevels_combined_0to200.json — xem chú thích ở khai báo connectTracksLevels phía trên.
     * token chặn kết quả trễ của 1 lần load CŨ (màn đã đóng hoặc đã mở level khác) ghi đè session.
     */
    private async loadConnectTracksLevel(levelId: string): Promise<void> {
        console.log('[DEBUG GameplayScreen] loadConnectTracksLevel() start, levelId=', levelId,
            'connectTracksBoard.node.position=', this.connectTracksBoard
                ? `${this.connectTracksBoard.node.position.x},${this.connectTracksBoard.node.position.y},${this.connectTracksBoard.node.position.z}`
                : 'no board');
        this.saveConnectTracksProgress();
        this.connectTracksProgressKey = null;
        this.connectTracksInput?.unbind();
        const progressKey = `${this.currentContext}:${levelId}:${this.isDailyContext ? this.formatToday() : ''}`;
        this.connectTracksVictory?.cancel();
        this.connectTracksVictoryStarted = false;
        this.connectTracksWinPraisePending = false;
        this.connectTracksEncourage?.cancelWinPraise();
        this.setLabel(this.boardSizeLabel, '');
        const token = ++this.connectTracksLoadToken;
        this.connectTracksBoosterHint?.close(false);
        this.connectTracksSession?.cancelHint();
        this.connectTracksInput?.unbind();
        this.connectTracksSession = null;
        this.soundSnapshot = null;
        this.connectTracksScoreStreak = 0;
        this.connectTracksLastGainSeconds = null;
        this.connectTracksElapsedStartMs = performance.now();
        try {
            const level = await this.connectTracksLevels.loadLevel(levelId);
            if (!this.isValid || token !== this.connectTracksLoadToken) return;
            const requiredCells = requiredCellsFor(level);
            this.connectTracksRequiredCellsTotal = requiredCells.length;
            this.connectTracksSession = new GameSession({ level, requiredCells });
            this.connectTracksProgressKey = progressKey;
            const progress = this.connectTracksProgress.read(progressKey);
            if (progress !== null && !this.connectTracksSession.restoreProgress(progress)) {
                this.connectTracksProgress.remove(progressKey);
                console.warn('[GameplayScreen] Ignored incompatible ConnectTracks board save.');
            }
            if (this.connectTracksBoard) {
                this.connectTracksBoard.prepareLevelSpawn();
                this.connectTracksInput?.bind(this.connectTracksSession, () => this.refreshConnectTracksBoard(), this.connectTracksBoard);
                // Thắng (xem winRule.ts) KHÔNG mở popup ngay — chỉ sau khi tàu chạy xong (xác nhận
                // từ user: đó là điều kiện thắng DUY NHẤT người chơi thấy). ConnectTracksBoardView
                // tự lo tàu/dò đường, chỉ báo lại đúng lúc qua handler này.
                this.connectTracksBoard.setVictoryControlled(true);
                this.connectTracksBoard.setWonHandler(null);
                this.connectTracksBoard.setSelectedCellChangedHandler((cell) => this.onConnectTracksCellSelected(cell));
            }
            this.connectTracksOptionMenu?.setOptionSelectedHandler((kind) => this.onConnectTracksOptionSelected(kind));
            this.connectTracksOptionsSelectedCell = null;
            this.connectTracksWonNotified = false;
            this.hideConnectTracksHintInstant();
            this.connectTracksOptionMenu?.hideInstant();
            this.refreshConnectTracksBoard();
            // "Nối lại node encourage đầu game" (xác nhận từ user — port từ luồng Dogdoku cũ,
            // RuleFrameIntro.ts) — gọi TRỰC TIẾP qua playEncourageOnly(), KHÔNG bắn
            // PUZZLE_READY_EVENT (event đó chỉ dành cho Dogdoku, nhiều listener khác sẽ phản ứng
            // nhầm). Bỏ qua tutorial (đúng behavior gốc của RuleFrameIntro). Đọc
            // lastSpawnDurationSeconds NGAY SAU refreshConnectTracksBoard() (đã rebuild() xong,
            // giá trị luôn mới nhất) để encourage chờ ĐÚNG lúc board hiện xong mới bật lên.
            if (this.currentContext !== 'tutorial') {
                this.connectTracksEncourage?.playEncourageOnly(
                    isHardLevel(this.currentPuzzleId),
                    this.connectTracksBoard?.lastSpawnDurationSeconds ?? 0,
                );
            }
        } catch (failure) {
            if (this.isValid && token === this.connectTracksLoadToken) {
                console.warn(`[GameplayScreen] ConnectTracks: không tải được level '${levelId}'.`, failure);
            }
        }
    }

    /** Vẽ lại bàn ConnectTracks và cập nhật heartsView từ snapshot của session hiện tại. */
    private soundSnapshot: ReturnType<GameSession['snapshot']> | null = null;

    /** "Nối lại score trong gameplay" (xác nhận từ user) — điểm hiện khi người chơi TÌM ĐƯỢC 1 ô
     * đáp án đúng LẦN ĐẦU (chuyển sang TrackPreview/Track), KHÔNG phải lúc đường ray đó hoàn chỉnh
     * đủ 2 đầu nối (xác nhận từ user: "điểm hiện khi đặt rail hoặc tìm được track đúng chứ không
     * phải khi đặt track hoàn chỉnh"). Cộng dồn vào nhãn score trên top bằng ĐÚNG hiệu ứng đếm số
     * sẵn có (animateScoreTo — giữ hiệu ứng tăng số như cũ). Nhiều ô tìm được CÙNG LÚC (vd Place
     * Track) chỉ gọi animateScoreTo() 1 LẦN với tổng điểm, tránh tween đè lẫn nhau nếu gọi riêng
     * từng ô — nhưng streak/speed bonus vẫn tính TUẦN TỰ từng ô (xem gainForConnectTracksCell). */
    private spawnScorePopupsForTrackChanges(before: GameSnapshot, after: GameSnapshot): void {
        const board = this.connectTracksBoard;
        if (after.mistakes > before.mistakes) this.connectTracksScoreStreak = 0;
        let gained = 0;
        after.cellStates.forEach((state, i) => {
            if (after.mainTrackCells.includes(i)) return;
            if (state !== 'Track' && state !== 'TrackPreview') return;
            const previous = before.cellStates[i];
            if (previous === 'Track' || previous === 'TrackPreview') return;
            const amount = this.gainForConnectTracksCell();
            gained += amount;
            if (board?.isValid) {
                board.spawnScorePopup(i, amount);
                // "Đặt đúng đến track thứ 10 thì hiện mức đầu [praise combo], cứ cách 3 track đúng
                // lại hiện mức tiếp theo" (xác nhận từ user, thay cho luật cũ "từ track thứ 2 liên
                // tiếp") — streak đã được gainForConnectTracksCell() tăng ĐÚNG cho ô này ngay phía
                // trên. Hiện CAO HƠN viền board, KHÔNG neo theo ô i (xác nhận từ user, không đổi).
                const streakFromStart = this.connectTracksScoreStreak - GameConfig.praiseStreakStart;
                if (streakFromStart >= 0 && streakFromStart % GameConfig.praiseStreakStep === 0) {
                    board.spawnPraiseEffect(streakFromStart / GameConfig.praiseStreakStep + 1);
                }
            }
        });
        if (gained > 0) this.animateScoreTo(this.displayedScore + gained);
    }

    /** Y HỆT Meowdoku's ScoreSystem.addForDog: tier tăng dần theo combo streak + speed bonus (đặt
     * càng nhanh liên tiếp càng thưởng thêm). Đơn giản hoá: không phân biệt đặt tay hay Place Track
     * hỗ trợ (xem ghi chú ở spawnScorePopupsForTrackChanges). */
    private gainForConnectTracksCell(): number {
        const elapsed = (performance.now() - this.connectTracksElapsedStartMs) / 1000;
        const secondsSinceLast = this.connectTracksLastGainSeconds === null
            ? Infinity : elapsed - this.connectTracksLastGainSeconds;
        this.connectTracksLastGainSeconds = elapsed;
        this.connectTracksScoreStreak += 1;
        const tier = GameConfig.scoreStreakBaseTier
            + (this.connectTracksScoreStreak - 1) * GameConfig.scoreStreakTierStep;
        return tier + this.connectTracksSpeedBonusFor(secondsSinceLast);
    }

    private connectTracksSpeedBonusFor(secondsSinceLast: number): number {
        if (!Number.isFinite(secondsSinceLast)) return 0;
        const instant = GameConfig.scoreSpeedBonusInstantSeconds;
        if (secondsSinceLast <= instant) return GameConfig.scoreSpeedBonusMax;
        const decayed = GameConfig.scoreSpeedBonusMax
            - (secondsSinceLast - instant) * GameConfig.scoreSpeedBonusDecayPerSecond;
        return Math.max(0, Math.round(decayed));
    }

    /** "Label phải hiện số track còn lại trong bàn" (xác nhận từ user) — ĐÃ TÌM ĐÚNG / TỔNG cần
     * tìm, tăng dần (giống dogsLabel, xác nhận từ user), CÙNG tiêu chí đếm với
     * spawnScorePopupsForTrackChanges() ở trên (TrackPreview/Track, không tính mainTrackCells —
     * các ô given đã hoàn thành sẵn từ đầu level). */
    private refreshConnectTracksTrackCountLabel(snapshot: GameSnapshot): void {
        if (!this.connectTracksTrackCountLabel) return;
        let found = 0;
        snapshot.cellStates.forEach((state, i) => {
            if (snapshot.mainTrackCells.includes(i)) return;
            if (state === 'Track' || state === 'TrackPreview') found++;
        });
        this.connectTracksTrackCountLabel.string =
            `<color=#${this.foundColorHex}>${found}</color>/${this.connectTracksRequiredCellsTotal}`;
    }

    private refreshConnectTracksBoard(): void {
        const session = this.connectTracksSession;
        if (!session) return;
        const snapshot = session.snapshot();
        if (this.soundSnapshot) {
            AudioManager.maybeInstance?.playTrackChanges(this.soundSnapshot, snapshot);
            this.spawnScorePopupsForTrackChanges(this.soundSnapshot, snapshot);
        }
        this.soundSnapshot = snapshot;
        this.saveConnectTracksProgress();
        this.setLabel(this.boardSizeLabel, `${snapshot.width} x ${snapshot.height}`);
        this.refreshConnectTracksTrackCountLabel(snapshot);
        if (this.connectTracksBoard?.isValid) {
            this.connectTracksBoard.render(snapshot);
        }
        // HeartsView.set() nhận số tim CÒN LẠI (đếm NGƯỢC từ max), còn snapshot.mistakes là số lần
        // đã sai (đếm XUÔI từ 0) — phải trừ ngược lại, nếu không tim sẽ hiện sai chiều hoàn toàn.
        this.heartsView?.set(snapshot.maxMistakes - snapshot.mistakes, snapshot.maxMistakes);
        this.applyConnectTracksHint(snapshot.needsConnectionHint);

        // Thua (đủ 3 mistake) → mở ConnectTracksLosePopup RIÊNG (xác nhận từ user: thay thế hoàn
        // toàn ResultPopup cho ConnectTracks). Chỉ mở 1 lần cho mỗi lần thua, không lặp lại ở các
        // lần refresh sau.
        if (snapshot.phase === GamePhase.Lost) {
            this.notifyConnectTracksFailed();
        } else {
            this.connectTracksLostNotified = false;
        }
        // Restart đưa phase về Active trong lúc tàu còn chưa kịp báo — reset cờ để lần thắng SAU
        // vẫn bắn lại được PUZZLE_SOLVED_EVENT bình thường.
        if (snapshot.phase !== GamePhase.Won) {
            this.connectTracksWonNotified = false;
        } else if (!this.connectTracksVictoryStarted && !this.connectTracksWinPraisePending
            && this.connectTracksBoard && this.connectTracksVictory) {
            // "Hiệu ứng sao bay chỉ kích hoạt khi leaderboard preview sẽ mở, phải đi cặp với nhau"
            // (xác nhận từ user) — gọi notifyConnectTracksWon() NGAY TẠI ĐÂY, TRƯỚC KHI victory
            // sequence bắt đầu chạy (trước đây gọi muộn hơn, trong completed() — SAU KHI tàu/sao đã
            // chạy xong, không kịp biết trước liệu LeaderboardPreview có mở hay không). Nhờ gọi sớm,
            // GameManager.pushLeaderboardScore() đã xử lý xong tiến trình/điểm (bao gồm
            // LeaderboardPreviewPresentation.request() nếu đủ điều kiện) TRƯỚC khi ta quyết định
            // starsEnabled — isPending() (KHÔNG consume() — chỗ tiêu thụ thật vẫn là
            // notifyConnectTracksReadyForTrain() ở dưới, đúng lúc mở popup).
            this.notifyConnectTracksWon();
            const starsEnabled = (this.currentContext !== 'campaign' || this.currentPuzzleId > 10)
                && LeaderboardPreviewPresentation.isPending();
            this.connectTracksWinPraisePending = true;
            const beginVictorySequence = (): void => {
                this.connectTracksWinPraisePending = false;
                // Board/victory có thể đã bị huỷ/thay thế (Restart, đóng màn...) trong lúc hiệu ứng
                // khen còn đang hiện — không còn gì để bắt đầu nữa thì bỏ qua, các nơi reset cờ này
                // (xem cancelWinPraise()) đã tự dọn connectTracksWinPraisePending rồi.
                if (!this.connectTracksBoard?.isValid || !this.connectTracksVictory) return;
                const started = this.connectTracksVictory.begin(this.connectTracksBoard, snapshot, this.node,
                    (resume) => {
                        const label = this.connectTracksVictory?.nextLabel;
                        const next = UIManager.instance.getConnectTracksNextLevel(this.currentContext, this.currentPuzzleId);
                        if (next !== null) {
                            // Non-blocking: warm the exact next level while the victory train runs.
                            void this.connectTracksLevels.preload(String(next)).catch(error => {
                                console.warn(`[GameplayScreen] Could not preload ConnectTracks level ${next}; retry on entry.`, error);
                            });
                        }
                        if (label) label.string = next === null ? Localization.get(L10N.common.backToMenu)
                            : `${Localization.get(L10N.menu.levelPrefix)}${next}`;
                        // "Tàu hoãn chạy cho đến khi luồng thắng của các popup khác chạy xong" (xác
                        // nhận từ user, đúng thứ tự ưu tiên ResultPopup thật của Meowdoku — Tournament
                        // rồi LeaderboardPreview) — notifyConnectTracksWon() đã gọi Ở TRÊN (trước cả
                        // victory sequence), GameManager đã xử lý xong tiến trình/điểm/cờ
                        // Tournament-pending từ lâu, resume (= cho tàu chạy) chỉ khi chuỗi đó thật sự
                        // xong.
                        UIManager.instance.notifyConnectTracksReadyForTrain(resume);
                    },
                    // "Thêm lại luồng kích hoạt giải đấu vào ConnectTracks, giữ đúng thứ tự" (xác
                    // nhận từ user) — đúng vị trí "sau khi Result đóng" của luồng thật
                    // (afterResultClosed() → maybeOpenTournamentActivation()), áp ngay trước khi thực
                    // sự chuyển màn kế tiếp.
                    () => UIManager.instance.continueConnectTracksWinAfterActivationCheck(this.currentContext, this.currentPuzzleId),
                    starsEnabled);
                this.connectTracksVictoryStarted = started;
                if (started) this.connectTracksInput?.unbind();
            };
            // "Chèn thêm 1 hiệu ứng [khen thắng] ở thời điểm này, các luồng còn lại chạy SAU nó"
            // (xác nhận từ user) — connectTracksVictory.begin() (board di chuyển vào giữa, tàu chạy,
            // các popup...) chỉ bắt đầu SAU KHI hiệu ứng khen đã biến mất hẳn. Không có
            // connectTracksEncourage (chưa gán trong Editor) thì chạy ngay, không chặn gì cả.
            if (this.connectTracksEncourage) {
                this.connectTracksEncourage.playWinPraise(beginVictorySequence);
            } else {
                beginVictorySequence();
            }
        }
    }

    private saveConnectTracksProgress(): void {
        if (!this.connectTracksSession || !this.connectTracksProgressKey) return;
        const progress = this.connectTracksSession.exportProgress();
        if (progress) this.connectTracksProgress.write(this.connectTracksProgressKey, progress);
        else this.connectTracksProgress.remove(this.connectTracksProgressKey);
    }

    /**
     * Hiện/ẩn connectTracksHintLabel bằng scale + opacity (xác nhận từ user) theo
     * snapshot.needsConnectionHint — "đã tìm hết track đúng nhưng chưa nối thành đường liên mạch".
     * Chỉ phát tween khi trạng thái THỰC SỰ đổi — refresh có thể gọi lại nhiều lần không đổi gì.
     */
    private applyConnectTracksHint(visible: boolean): void {
        if (visible === this.connectTracksHintEligible) return;
        this.connectTracksHintEligible = visible;
        this.unschedule(this.expireConnectTracksHint);
        this.animateConnectTracksHint(visible);
        if (visible) this.scheduleOnce(this.expireConnectTracksHint, CONNECT_TRACKS_HINT_VISIBLE_SECONDS);
    }

    private animateConnectTracksHint(visible: boolean): void {
        const node = this.connectTracksHintLabel;
        if (!node || visible === this.connectTracksHintVisible) {
            return;
        }
        this.connectTracksHintVisible = visible;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        if (visible) {
            node.active = true;
            node.setScale(CONNECT_TRACKS_HINT_FROM_SCALE, CONNECT_TRACKS_HINT_FROM_SCALE, 1);
            opacity.opacity = 0;
            tween(node)
                .to(CONNECT_TRACKS_HINT_POP_SECONDS, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
                .start();
            tween(opacity).to(CONNECT_TRACKS_HINT_POP_SECONDS, { opacity: 255 }).start();
        } else {
            tween(node)
                .to(CONNECT_TRACKS_HINT_POP_SECONDS, {
                    scale: new Vec3(CONNECT_TRACKS_HINT_FROM_SCALE, CONNECT_TRACKS_HINT_FROM_SCALE, 1),
                })
                .start();
            tween(opacity)
                .to(CONNECT_TRACKS_HINT_POP_SECONDS, { opacity: 0 })
                .call(() => {
                    node.active = false;
                })
                .start();
        }
    }

    /** Tắt NGAY (không tween) — dùng khi đóng màn hoặc đổi level, tránh hiệu ứng ẩn chạy lố. */
    private hideConnectTracksHintInstant(): void {
        this.unschedule(this.expireConnectTracksHint);
        this.connectTracksHintEligible = false;
        this.connectTracksHintVisible = false;
        const node = this.connectTracksHintLabel;
        if (!node) {
            return;
        }
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
        }
        node.active = false;
    }

    /**
     * Gọi lại bởi ConnectTracksBoardView (xem setSelectedCellChangedHandler) mỗi khi ô đang chọn
     * cho Track option menu đổi — board tự lo viền xanh trên ô đó, ở đây chỉ lo cụm option CỐ ĐỊNH
     * (xác nhận từ user: Node này nằm trong gameplay, giờ là component riêng
     * ConnectTracksOptionMenuView): hiện + đổ dữ liệu hợp lệ, hoặc ẩn đi.
     */
    private onConnectTracksCellSelected(cell: number | null): void {
        this.connectTracksOptionsSelectedCell = cell;
        const snapshot = cell !== null ? this.connectTracksSession?.snapshot() : undefined;
        if (cell === null || !snapshot) {
            this.connectTracksOptionMenu?.hide();
            return;
        }
        this.connectTracksOptionMenu?.show(computeTrackOptionValidity(snapshot, cell));
    }

    /** Gọi lại bởi ConnectTracksOptionMenuView mỗi khi người chơi bấm 1 option đang hợp lệ (xác
     * nhận từ user: đặt luôn track đó vào ô, thay thế việc kéo tay — "track preview" thì xoá hết
     * connection thay vì đặt). Đóng menu lại ngay sau khi áp dụng. */
    private onConnectTracksOptionSelected(kind: TrackOptionKind): void {
        const cell = this.connectTracksOptionsSelectedCell;
        if (cell === null || !this.connectTracksSession) return;
        if (kind === 'trackPreview') {
            this.connectTracksSession.dispatch({ type: 'resetTrackPreview', cell });
        } else {
            this.connectTracksSession.dispatch({
                type: 'applyTrackShape',
                cell,
                directions: directionsForOrientation(kind),
            });
        }
        this.connectTracksBoard?.closeOptionsMenu();
        this.refreshConnectTracksBoard();
    }

    /**
     * Place Track (confirmed by the user, modelled on Place Dog): charges > 0 dùng luôn 1 lượt,
     * hết lượt thì mở quảng cáo xem thưởng thêm — CÙNG hệt nhánh onTapPlaceDog(), chỉ khác dispatch
     * thẳng vào connectTracksSession (GameSession.placeTrack) thay vì PuzzleSessionHolder.
     */
    onTapConnectTracksPlaceTrack(): void {
        if (this.connectTracksPlaceTrackCharges > 0) {
            this.useConnectTracksPlaceTrack();
            return;
        }
        void this.watchAdForConnectTracksPlaceTrack();
    }

    private useConnectTracksPlaceTrack(): void {
        if (!this.connectTracksSession) return;
        const result = this.connectTracksSession.dispatch({ type: 'placeTrack' });
        // Không tốn lượt nếu bị từ chối: ván đã kết thúc ('gameFinished'), hoặc mọi ô required đã
        // được đánh dấu hết rồi dù chưa nối xong ('nothingToPlace' — hoàn toàn có thể xảy ra, vì
        // Place Track giờ chỉ đặt TrackPreview, không tự nối, nên không kéo theo Thắng ngay).
        if (!result.accepted) return;
        this.connectTracksPlaceTrackCharges = Math.max(0, this.connectTracksPlaceTrackCharges - 1);
        this.connectTracksInventory.writePlaceTrackCharges(this.connectTracksPlaceTrackCharges);
        this.refreshConnectTracksPlaceTrackAdIcon();
        this.refreshConnectTracksBoard();
    }

    /** CÙNG mẫu watchAdForPlaceDog()/watchAdForHint() — dùng chung this.adInProgress/adOverlay (3
     * booster không thể xem quảng cáo cùng lúc, hợp lý vì chỉ có 1 overlay chờ dùng chung cho cả
     * màn). Khác 1 chỗ: cấp thưởng THẲNG vào connectTracksInventory ở đây luôn, không cần bắn sự
     * kiện riêng rồi chờ nơi khác xử lý — ConnectTracks không có GameManager lắng nghe việc này. */
    private async watchAdForConnectTracksPlaceTrack(): Promise<void> {
        if (this.adInProgress) return;

        const ads = AdServiceHolder.current;
        if (!ads.isRewardedReady()) {
            console.log('[GameplayScreen] Chưa có quảng cáo sẵn sàng.');
            return;
        }

        this.adInProgress = true;
        if (this.adOverlay) this.adOverlay.active = true;
        try {
            const result = await ads.showRewarded();
            if (!result.rewarded) {
                console.log('[GameplayScreen] Không nhận thưởng:', result.reason ?? 'đã đóng sớm');
                return;
            }

            this.connectTracksPlaceTrackCharges += this.connectTracksPlaceTrackAdReward;
            this.connectTracksInventory.writePlaceTrackCharges(this.connectTracksPlaceTrackCharges);
            this.refreshConnectTracksPlaceTrackAdIcon();
        } finally {
            this.adInProgress = false;
            if (this.adOverlay) this.adOverlay.active = false;
        }
    }

    /** Giống hệt refreshPlaceDogAdIcon(): ad icon chỉ hiện khi HẾT lượt, label số lượt chỉ hiện khi
     * CÒN lượt — 2 overlay loại trừ nhau trên cùng 1 nút. */
    private refreshConnectTracksPlaceTrackAdIcon(): void {
        const charges = this.connectTracksPlaceTrackCharges;
        if (this.connectTracksPlaceTrackAdIcon) this.connectTracksPlaceTrackAdIcon.active = charges <= 0;
        if (this.connectTracksPlaceTrackLabel) {
            this.connectTracksPlaceTrackLabel.node.active = charges > 0;
            this.connectTracksPlaceTrackLabel.string = `${charges}`;
        }
    }

    /** Nghe CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT (nút test ở Settings, hoặc 1 luồng
     * thưởng khác sau này) — cộng thẳng vào kho Place Track, không qua session nào cả. */
    private onConnectTracksPlaceTrackGranted = (payload: ConnectTracksPlaceTrackGrantRequestedEventPayload): void => {
        this.connectTracksPlaceTrackCharges += payload.amount;
        this.connectTracksInventory.writePlaceTrackCharges(this.connectTracksPlaceTrackCharges);
        this.refreshConnectTracksPlaceTrackAdIcon();
    };

    /** ConnectTracks thua (xác nhận từ user): THAY THẾ HOÀN TOÀN luồng ResultPopup/PUZZLE_FAILED_EVENT
     * cũ (vẫn giữ nguyên cho Dogdoku, không đụng gì) — mở thẳng ConnectTracksLosePopup, cụm 3 tim
     * tự phát anim vỡ, 2 nút: xem QC hồi sinh (+3 mistake, giữ nguyên track đã đặt) hoặc chơi lại
     * từ đầu. */
    private notifyConnectTracksFailed(): void {
        if (this.connectTracksLostNotified) return;
        this.connectTracksLostNotified = true;
        const data: ConnectTracksLoseData = {
            onRevive: this.onReviveConnectTracks,
            onRestart: this.onTapRestart,
        };
        this.popups?.openPopup(PopupId.ConnectTracksLose, data);
    }

    /** Hồi sinh sau khi xem quảng cáo thành công (ConnectTracksLosePopup) — dispatch 'revive' (cho
     * lại mistake budget, KHÔNG đụng board) thay vì 'restart' (xem GameSession.revive/onTapRestart
     * để so sánh). connectTracksLostNotified tự reset ở lần refreshConnectTracksBoard() kế tiếp vì
     * snapshot.phase không còn Lost nữa. */
    private readonly onReviveConnectTracks = (): void => {
        if (!this.connectTracksSession) return;
        this.connectTracksSession.dispatch({ type: 'revive' });
        this.refreshConnectTracksBoard();
    };

    /**
     * Thắng — giống hệt luồng thật của Dogdoku (xác nhận từ user): bắn lại PUZZLE_SOLVED_EVENT mà
     * UIManager/GameManager đã nghe sẵn (mở popup Result outcome 'win', mở khoá campaign kế tiếp,
     * đẩy leaderboard, ghi nhận hoạt động daily...) — chấp nhận các tác dụng phụ này dựa trên
     * payload.puzzleId mượn tạm từ Dogdoku, như đã xác nhận. CHỈ gọi sau khi tàu chạy xong (xem
     * ConnectTracksBoardView.setWonHandler), không phải ngay lúc GameSession chuyển Won.
     */
    private notifyConnectTracksWon(): void {
        if (this.connectTracksWonNotified) return;
        this.connectTracksWonNotified = true;
        const snapshot = this.connectTracksSession?.snapshot();
        const mistakesRemaining = snapshot ? snapshot.maxMistakes - snapshot.mistakes : 0;
        // "Nối lại leaderboard... cách tính điểm thì tính bằng điểm của node trail ở gameplay (tức
        // số đường ray có trong màn chơi)" (xác nhận từ user) — thay heartsRemaining bằng tổng số ô
        // đường ray HOÀN CHỈNH của màn vừa thắng (given + ray người chơi tự nối), CÙNG công thức
        // `trackedCells` đã dùng ở ConnectTracksVictoryView.begin() để xác nhận đường ray đã nối đủ.
        const leaderboardScore = snapshot
            ? snapshot.mainTrackCells.length + snapshot.cellStates.filter(state => state === 'Track').length
            : 0;
        const payload: PuzzleSolvedEventPayload = {
            presentation: 'connectTracksInline',
            context: this.currentContext,
            puzzleId: this.currentPuzzleId,
            mistakesRemaining,
            leaderboardScore,
        };
        EventManager.instance.emit(PUZZLE_SOLVED_EVENT, payload);
    }

    /**
     * Tutorial dạy xong 3 con chó hướng dẫn (vào FreePlay) — KHÔNG hiện lại toàn bộ HUD
     * campaign (TopBar/RulesFrame/BottomToolbar vẫn ẩn), chỉ hiện node Place Dog riêng
     * của tutorial để người chơi tự hoàn thành bàn còn lại.
     */
    private onTutorialGuidedFinished = (): void => {
        const node = this.tutorialPlaceDogNode;
        if (!node) return;

        node.active = true;
        node.setScale(1, 1, 1);
        Tween.stopAllByTarget(node);

        tween(node)
            .repeatForever(
                tween<Node>()
                    .to(this.tutorialPlaceDogPulseSeconds, { scale: new Vec3(this.tutorialPlaceDogPulseScale, this.tutorialPlaceDogPulseScale, 1) }, { easing: 'sineInOut' })
                    .to(this.tutorialPlaceDogPulseSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
            )
            .start();
    };

    // Arrow field: được EventManager gọi trực tiếp làm handler của
    // LANGUAGE_CHANGED_EVENT nên phải tự giữ đúng `this` (xem SettingsPopup.refresh).
    private refreshLevelCaption = (): void => {
        this.setLabel(
            this.levelCaption,
            this.isDailyContext
                ? Localization.get(L10N.gameplay.dateCaption)
                : Localization.get(L10N.gameplay.levelCaption),
        );
    };

    private onHintShown = (payload: HintShownEventPayload): void => {
        this.refreshHintAdIcon(payload.chargesRemaining);
    };

    private onScoreChanged = (payload: ScoreChangedEventPayload): void => {
        this.animateScoreTo(payload.score);
    };

    private animateScoreTo(target: number): void {
        Tween.stopAllByTarget(this.scoreCounter);
        this.scoreCounter.value = this.displayedScore;

        tween(this.scoreCounter)
            .to(
                this.scoreCountUpSeconds,
                { value: target },
                {
                    easing: 'quadOut',
                    onUpdate: () => {
                        this.displayedScore = Math.round(this.scoreCounter.value);
                        this.setLabel(this.scoreLabel, `${this.displayedScore}`);
                    },
                },
            )
            .call(() => {
                this.displayedScore = target;
                this.setLabel(this.scoreLabel, `${target}`);
            })
            .start();
    }

    /**
     * Chuỗi hiệu ứng "tự đánh dấu ô lúc thắng" (dữ liệu/điểm ĐÃ ĐÚNG NGAY từ lúc
     * PuzzleSession.autoMarkRemainingCells() bắn AUTO_MARK_APPLIED_EVENT — 3 bước dưới đây CHỈ
     * quyết định THỜI ĐIỂM/CÁCH hiện cho người chơi thấy):
     * 1) Dừng 1 nhịp (autoMarkPauseSeconds).
     * 2) Hiện dấu X trên mọi ô liên quan (BoardView.revealAutoMarkedCells).
     * 3) Sau khi ổn định (autoMarkRevealSettleSeconds), bắn đốm sáng bay từ từng ô tới scoreLabel
     *    (flyAutoMarkSparks) — điểm chỉ THẬT SỰ tăng sau khi đốm sáng cuối cùng bay tới.
     */
    private onAutoMarkApplied = (payload: AutoMarkAppliedEventPayload): void => {
        this.scheduleOnce(() => this.playAutoMarkReveal(payload), GameConfig.autoMarkPauseSeconds);
    };

    private playAutoMarkReveal(payload: AutoMarkAppliedEventPayload): void {
        const onRevealed = () => {
            if (!this.isValid || !this.node.activeInHierarchy) return;
            this.scheduleOnce(() => this.flyAutoMarkSparks(payload), GameConfig.autoMarkRevealSettleSeconds);
        };
        const board = BoardView.current;
        if (board) board.revealAutoMarkedCells(payload.cells, onRevealed);
        else onRevealed();
    }

    private flyAutoMarkSparks(payload: AutoMarkAppliedEventPayload): void {
        const board = BoardView.current;
        const targetPos = this.scoreLabel?.node.getWorldPosition();
        const cells = payload.cells;

        // Rải các lần bắn đốm sáng ĐỀU trong tổng cộng autoMarkSparkSpreadSeconds (KHÔNG cộng
        // dồn theo số ô) — dù màn có bao nhiêu ô cần tự đánh dấu, tổng thời gian chờ vẫn cố định.
        const stagger = cells.length > 1 ? GameConfig.autoMarkSparkSpreadSeconds / (cells.length - 1) : 0;

        if (board && targetPos) {
            const fromPos = new Vec3();
            for (let i = 0; i < cells.length; i++) {
                if (!board.getCellWorldPosition(cells[i], fromPos)) continue;
                const sparkOrigin = fromPos.clone();
                this.scheduleOnce(() => this.spawnAutoMarkSpark(sparkOrigin, targetPos), i * stagger);
            }
        }

        const totalDelay = (cells.length > 1 ? GameConfig.autoMarkSparkSpreadSeconds : 0) + GameConfig.autoMarkSparkFlightSeconds;
        this.scheduleOnce(() => this.emitAutoMarkScoreBump(payload), totalDelay);
    }

    /** Đốm sáng bay thẳng (world position tween, KHÔNG Bezier) từ 1 ô tới scoreLabel — cùng kỹ
     * thuật với CoinFlyEffectManager (adapt từ Reference/EfxCoinManager.ts): 1 node dùng 1 lần rồi
     * huỷ, không cần particle system (dự án chưa có VFX particle). Bỏ qua im lặng nếu chưa gán
     * autoMarkSparkSpriteFrame — điểm vẫn tăng đúng lúc ở emitAutoMarkScoreBump(), chỉ thiếu hình. */
    private spawnAutoMarkSpark(fromWorldPos: Vec3, toWorldPos: Vec3): void {
        if (!this.autoMarkSparkSpriteFrame) return;

        const sparkNode = new Node('AutoMarkSpark');
        sparkNode.layer = this.node.layer;
        sparkNode.setParent(this.node);
        sparkNode.setWorldPosition(fromWorldPos);

        const transform = sparkNode.addComponent(UITransform);
        transform.setContentSize(32, 32);

        const sprite = sparkNode.addComponent(Sprite);
        sprite.spriteFrame = this.autoMarkSparkSpriteFrame;

        const opacity = sparkNode.addComponent(UIOpacity);
        opacity.opacity = 255;

        const flySeconds = GameConfig.autoMarkSparkFlightSeconds;
        tween(sparkNode)
            .to(flySeconds, { worldPosition: toWorldPos }, { easing: 'quadIn' })
            .call(() => sparkNode.destroy())
            .start();
        tween(opacity).delay(flySeconds * 0.6).to(flySeconds * 0.4, { opacity: 0 }).start();
    }

    private emitAutoMarkScoreBump(payload: AutoMarkAppliedEventPayload): void {
        EventManager.instance.emit<ScoreChangedEventPayload>(SCORE_CHANGED_EVENT, {
            score: payload.totalScore,
            gained: payload.scoreGained,
            cell: -1,
            streak: 0,
        });
    }

    private onMistakeChanged = (payload: MistakeChangedEventPayload): void => {
        this.mistakesRemaining = payload.remaining;
        this.heartsView?.set(payload.remaining, payload.max);
    };

    /**
     * Sóng chéo thắng màn xong → các tim còn lại ở ô mistake LẦN LƯỢT cất cánh (tim index cao nhất
     * trước, mỗi tim chuyển sang ảnh rỗng ngay lúc bay) bay tới heartCountLabel, mỗi tim tới nơi
     * thì số ở label +1 và nảy nhẹ. Chỉ chạy khi đã gán heartCountLabel + heartsView.
     */
    private onVictoryWaveFinished = (): void => {
        const label = this.heartCountLabel;
        const hearts = this.heartsView;
        if (this.heartFlyBusy) return;

        // Group tim CHỈ có ý nghĩa khi Leaderboard đã mở (thắng xong level leaderboardUnlockLevel
        // — cùng điều kiện GameManager.isLeaderboardUnlocked()/nút Leaderboard hiện ở Main Menu) —
        // trước đó bảng Weekly còn "đứng yên hoàn toàn", tim bay vào label không phục vụ gì cả.
        const leaderboardUnlocked = this.isLeaderboardHeartGroupRelevant();

        if (!leaderboardUnlocked || !label?.node.isValid || !hearts || this.mistakesRemaining <= 0) {
            // Không có gì để bay — vẫn báo "xong" ngay để luồng phía sau (LeaderboardPreview/màn
            // Streak — xem GameManager) không bị kẹt.
            EventManager.instance.emit(HEART_FLY_FINISHED_EVENT, undefined);
            return;
        }

        this.heartFlyBusy = true;
        this.setLabel(label, 'x0');

        // Nhóm label+bg: opacity 0→255 TRƯỚC (còn đứng yên ở rìa ngoài) rồi MỚI trượt vào — đích
        // trượt giờ LUÔN là mép TRÁI màn hình thật (resolveHeartGroupLeftX), không còn dùng vị trí
        // "trong" đặt sẵn trong Editor nữa (chỉ còn lấy Y từ đó). Xong cả 2 bước mới cho tim bay —
        // để tim bay tới đúng vị trí CUỐI của label, không phải chỗ đang trượt.
        const group = this.heartCountGroup;
        const inner = this.heartGroupInnerPos;
        if (group?.isValid && inner) {
            Tween.stopAllByTarget(group);
            const opacity = this.ensureHeartGroupOpacity(group);
            Tween.stopAllByTarget(opacity);
            const targetX = this.resolveHeartGroupLeftX() ?? inner.x;

            tween(opacity)
                .to(this.heartCountFadeInSeconds, { opacity: 255 })
                .call(() => {
                    tween(group)
                        .to(this.heartCountSlideSeconds, { position: new Vec3(targetX, inner.y, inner.z) }, { easing: 'quadOut' })
                        .call(() => this.launchHearts(label, hearts))
                        .start();
                })
                .start();
            return;
        }
        this.launchHearts(label, hearts);
    };

    /**
     * Group tim CHỈ có ý nghĩa khi Leaderboard ĐÃ MỞ TỪ TRƯỚC (thắng xong màn leaderboardUnlockLevel,
     * ví dụ 10 → hiện từ màn 11 trở đi) — dùng ProgressionHolder.isCompleted(leaderboardUnlockLevel)
     * là SAI ở đúng lần thắng màn 10: progression được đánh dấu completed NGAY lúc thắng (xem
     * GameManager.handleCampaignSolved(), chạy TRƯỚC khi BoardView/GameplayScreen kịp chạy hiệu ứng),
     * nên check đó true NGAY TRONG LÚC đang ăn mừng màn 10 — group tim hiện sớm 1 màn. Campaign dùng
     * số màn ĐANG CHƠI (currentPuzzleId) so trực tiếp, chỉ true từ màn SAU màn mở khoá. Daily không
     * có mối liên hệ số màn với campaign nên vẫn dùng isCompleted() như cũ (đã mở campaign hay chưa
     * là điều kiện duy nhất có ý nghĩa ở đó).
     */
    private isLeaderboardHeartGroupRelevant(): boolean {
        if (this.currentContext === 'campaign') {
            return this.currentPuzzleId > GameConfig.leaderboardUnlockLevel;
        }
        return ProgressionHolder.current?.isCompleted(GameConfig.leaderboardUnlockLevel) ?? false;
    }

    private ensureHeartGroupOpacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    /** Toạ độ X (hệ toạ độ CHA của heartCountGroup) ứng với mép TRÁI màn hình THẬT + heartCountLeftMargin
     * — MƯỢN chính component Widget (cc.Widget, hệ canh lề chuẩn của Cocos, đã dùng khắp dự án cho
     * đúng việc này — xem UIManager/screenLayer) để TÍNH đích, thay vì tự quy đổi toạ độ world thủ
     * công (đã sai — cho ra vị trí quá xa bên trái, không khớp DPI/ResolutionPolicy thật). Chỉ
     * MƯỢN: cho Widget tự canh 1 lần (updateAlignment) rồi đọc kết quả, KHÔNG để nó snap thật —
     * trả node về đúng vị trí HIỆN TẠI (đang ở rìa ngoài) ngay sau đó, còn việc di chuyển thật sự
     * vẫn do tween ở onVictoryWaveFinished() đảm nhiệm như cũ. */
    private resolveHeartGroupLeftX(): number | null {
        const group = this.heartCountGroup;
        if (!group?.isValid) return null;

        const widget = group.getComponent(Widget) ?? group.addComponent(Widget);
        // PHẢI tắt hẳn — Widget đang enabled sẽ tự canh lại đúng vị trí NÀY mỗi frame, đè lên cả
        // trạng thái off-screen (resetHeartGroup) lẫn tween trượt vào (onVictoryWaveFinished),
        // khiến node đứng yên tại đích suốt (không thấy trượt — bug đã báo, kèm ảnh). Chỉ bật
        // TẠM đúng lúc gọi updateAlignment() để lấy toạ độ, xong tắt lại ngay.
        widget.enabled = true;
        widget.isAlignLeft = true;
        widget.left = this.heartCountLeftMargin;

        const before = group.position.clone();
        widget.updateAlignment();
        const targetX = group.position.x;
        widget.enabled = false;
        group.setPosition(before);
        return targetX;
    }

    /** Đặt nhóm label+bg về vị trí ngoài rìa, opacity 0 (mỗi màn mới/restart) — sẵn sàng hiện +
     * trượt vào lúc thắng (xem onVictoryWaveFinished). */
    private resetHeartGroup(): void {
        const group = this.heartCountGroup;
        const inner = this.heartGroupInnerPos;
        if (!group?.isValid || !inner) return;

        // Nhóm CHỈ có ý nghĩa khi Leaderboard đã mở (thắng xong level leaderboardUnlockLevel) —
        // trước đó (kể cả TUTORIAL) ẩn HẲN node (không chỉ đẩy ra rìa ngoài bằng heartCountOuterOffset
        // — rìa đó vẫn có thể lọt vào khung hình tuỳ bề rộng màn hình thật, đúng bug hiện ở tutorial:
        // group "x0" hiện sẵn ngay góc màn dù chưa hề mở Leaderboard).
        const leaderboardUnlocked = this.isLeaderboardHeartGroupRelevant();
        group.active = leaderboardUnlocked;
        if (!leaderboardUnlocked) return;

        Tween.stopAllByTarget(group);
        const opacity = this.ensureHeartGroupOpacity(group);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        // CHỈ dùng X của offset — nhóm luôn trượt ngang thẳng, giữ nguyên Y/Z của vị trí trong.
        group.setPosition(inner.x + this.heartCountOuterOffset.x, inner.y, inner.z);
    }

    private launchHearts(label: Label, hearts: HeartsView): void {
        const count = this.mistakesRemaining;
        let shown = 0;

        for (let i = 0; i < count; i++) {
            this.scheduleOnce(() => {
                const from = hearts.takeFullHeart();
                if (!from) return;
                this.flyHeart(from, label.node.getWorldPosition(), () => {
                    shown++;
                    this.setLabel(label, `x${shown}`);
                    this.bumpNode(label.node);
                    if (shown >= count) {
                        this.heartFlyBusy = false;
                        EventManager.instance.emit(HEART_FLY_FINISHED_EVENT, undefined);
                    }
                });
            }, i * this.heartFlyStaggerSeconds);
        }
    }

    /** Icon bay = instantiate THẲNG chính prefab tim anim (ở trạng thái TĨNH, không play) — xác
     * nhận từ user: không dùng Sprite/SpriteFrame tĩnh riêng nữa, dùng đúng hình đã thấy trong các
     * ô tim (anim prefab, đứng yên vì ensureOverlay() của HeartsView đã tự stop() mọi Animation). */
    private flyHeart(fromWorld: Vec3, toWorld: Vec3, onArrive: () => void): void {
        const prefab = this.heartsView?.animPrefab;
        if (!prefab) {
            onArrive();
            return;
        }

        const node = instantiate(prefab);
        this.applyLayerRecursive(node, this.node.layer);
        node.setParent(this.node);
        node.setWorldPosition(fromWorld);
        node.active = true;
        // Prefab không vuông — khớp CẠNH DÀI NHẤT của UITransform tự thân vào heartFlyIconSize,
        // scale đều cả node (giữ đúng tỉ lệ, không kéo méo) thay vì setContentSize như Sprite cũ.
        const transform = node.getComponent(UITransform);
        const width = transform?.width ?? 0;
        const height = transform?.height ?? 0;
        if (width > 0 && height > 0) {
            const fit = this.heartFlyIconSize / Math.max(width, height);
            node.setScale(fit, fit, 1);
        }

        tween(node)
            .to(this.heartFlySeconds, { worldPosition: toWorld }, { easing: 'quadIn' })
            .call(() => {
                node.destroy();
                onArrive();
            })
            .start();
    }

    /** Gán lại `layer` cho CẢ node lẫn con cháu — instantiate(prefab) giữ nguyên layer tác giả gán
     * sẵn trong prefab, KHÔNG tự kế thừa layer của parent mới dù đã setParent đúng (đã gặp đúng bug
     * này với dash prefab của tutorial — xem connectTracksTutorialController.applyLayerRecursive). */
    private applyLayerRecursive(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyLayerRecursive(child, layer);
    }

    private bumpNode(node: Node): void {
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node)
            .to(0.08, { scale: new Vec3(1.3, 1.3, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
    }

    private onPlaceDogUsed = (payload: PlaceDogUsedEventPayload): void => {
        this.setLabel(this.placeDogLabel, `${payload.chargesRemaining}`);
        this.setLabel(this.tutorialPlaceDogLabel, `${payload.chargesRemaining}`);
        this.refreshPlaceDogAdIcon(payload.chargesRemaining);
        this.updateDogProgress(this.currentStates());
    };


    private refreshPlaceDogAdIcon(charges: number): void {
        this.placeDogCharges = charges;

        if (this.placeDogAdIcon) this.placeDogAdIcon.active = charges <= 0;
        if (this.placeDogLabel) this.placeDogLabel.node.active = charges > 0;
    }

    private refreshHintAdIcon(charges: number): void {
        this.hintCharges = charges;
        this.setLabel(this.hintLabel, `${charges}`);

        if (this.hintAdIcon) this.hintAdIcon.active = charges <= 0;
        if (this.hintLabel) this.hintLabel.node.active = charges > 0;
    }

    private onCellChanged = (): void => {
        this.updateDogProgress(this.currentStates());
    };

    private onBoardRestarted = (payload: BoardRestartedEventPayload): void => {
        this.heartsView?.set(payload.mistakesRemaining, this.maxMistakes);
        this.mistakesRemaining = payload.mistakesRemaining;
        this.heartFlyBusy = false;
        this.setLabel(this.heartCountLabel, 'x0');
        this.resetHeartGroup();
        this.updateDogProgress(payload.cellStates);
    };

 
    private currentStates(): readonly CellState[] {
        return PuzzleSessionHolder.current?.cellStates ?? [];
    }

   
    private updateDogProgress(states: readonly CellState[]): void {
        let placed = 0;
        for (const state of states) {
            if (state === CellState.Dog) placed++;
        }

        if (this.dogsLabel) {
            this.dogsLabel.string = `<color=#${this.foundColorHex}>${placed}</color>/${this.totalDogs}`;
        }
        if (this.dogsFill) {
            this.dogsFill.fillRange = this.totalDogs > 0 ? placed / this.totalDogs : 0;
        }
    }


    onTapHint(): void {
        if (this.connectTracksBoosterHint?.showing) return;
        if (this.connectTracksSession) {
            if (this.hintCharges <= 0) { void this.watchAdForHint(); return; }
            this.showConnectTracksBoosterHint();
            return;
        }
        if (this.hintCharges > 0) {
            this.sendIntent(IntentType.ShowHint);
            return;
        }

        void this.watchAdForHint();
    }

    private showConnectTracksBoosterHint(): void {
        const session = this.connectTracksSession, board = this.connectTracksBoard;
        const inventory = PuzzleSessionHolder.current;
        if (!session || !board || !inventory || inventory.remainingHints <= 0) return;
        const hint = session.requestHint();
        if (!hint) return;
        if (hint.rule === 'A8') {
            if (session.applyHint(hint).accepted) inventory.grantHintCharges(-1);
            this.refreshConnectTracksBoard();
            return;
        }
        const resume = () => {
            if (this.connectTracksSession !== session) return;
            session.cancelHint();
            this.connectTracksInput?.bind(session, () => this.refreshConnectTracksBoard(), board);
        };
        const snapshot = session.snapshot();
        const shown = this.connectTracksBoosterHint?.show(hint, board, snapshot.width, snapshot.height, () => {
            if (this.connectTracksSession !== session) return;
            session.applyHint(hint);
            resume();
            this.refreshConnectTracksBoard();
        }, resume);
        if (!shown) {
            session.cancelHint();
            console.warn('[GameplayScreen] Configure ConnectTracksBoosterHint and its sprite/node bindings. No charge consumed.');
            return;
        }
        board.closeOptionsMenu();
        this.connectTracksInput?.unbind();
        // Preserve legacy charge/save notifications without invoking the Meowdoku hint engine.
        inventory.grantHintCharges(-1);
    }

    onTapPlaceDog(): void {

        if (this.placeDogCharges > 0) {
            this.sendIntent(IntentType.UsePlaceDog);
            return;
        }

        void this.watchAdForPlaceDog();
    }


    private async watchAdForPlaceDog(): Promise<void> {
        if (this.adInProgress) return;

        const ads = AdServiceHolder.current;
        if (!ads.isRewardedReady()) {
            console.log('[GameplayScreen] Chưa có quảng cáo sẵn sàng.');
            return;
        }

        this.adInProgress = true;
        if (this.adOverlay) this.adOverlay.active = true;
        try {
            const result = await ads.showRewarded();
            if (!result.rewarded) {
                console.log('[GameplayScreen] Không nhận thưởng:', result.reason ?? 'đã đóng sớm');
                return;
            }

            const payload: PlaceDogGrantRequestedEventPayload = { amount: this.placeDogAdReward };
            EventManager.instance.emit(PLACE_DOG_GRANT_REQUESTED_EVENT, payload);
        } finally {
            this.adInProgress = false;
            if (this.adOverlay) this.adOverlay.active = false;
        }
    }

    /** CÙNG mẫu watchAdForPlaceDog() — dùng chung this.adInProgress/adOverlay (2 booster không thể
     * xem quảng cáo cùng lúc, hợp lý vì chỉ có 1 overlay chờ dùng chung cho cả màn). */
    private async watchAdForHint(): Promise<void> {
        if (this.adInProgress) return;

        const ads = AdServiceHolder.current;
        if (!ads.isRewardedReady()) {
            console.log('[GameplayScreen] Chưa có quảng cáo sẵn sàng.');
            return;
        }

        this.adInProgress = true;
        if (this.adOverlay) this.adOverlay.active = true;
        try {
            const result = await ads.showRewarded();
            if (!result.rewarded) {
                console.log('[GameplayScreen] Không nhận thưởng:', result.reason ?? 'đã đóng sớm');
                return;
            }

            const payload: HintGrantRequestedEventPayload = { amount: this.hintAdReward };
            EventManager.instance.emit(HINT_GRANT_REQUESTED_EVENT, payload);
        } finally {
            this.adInProgress = false;
            if (this.adOverlay) this.adOverlay.active = false;
        }
    }

    onTapSettings(): void {
        this.popups?.openPopup(PopupId.Settings, undefined);
    }

    onTapHowToPlay(): void {
        this.popups?.openPopup(PopupId.HowToPlay, undefined);
    }

    onTapRestart = (): void => {
        this.connectTracksBoosterHint?.close(false);
        this.connectTracksSession?.cancelHint();
        this.connectTracksVictory?.cancel();
        this.connectTracksVictoryStarted = false;
        this.connectTracksWinPraisePending = false;
        this.connectTracksEncourage?.cancelWinPraise();
        this.connectTracksBoard?.closeOptionsMenu();
        this.sendIntent(IntentType.Restart);

        if (this.connectTracksSession) {
            this.soundSnapshot = null;
            // Chơi lại từ đầu thì score trên top cũng về 0 — không animate đếm xuống, snap thẳng
            // (giống hearts/mistakes cũng reset cứng khi restart, không có hiệu ứng gì).
            Tween.stopAllByTarget(this.scoreCounter);
            this.displayedScore = 0;
            this.scoreCounter.value = 0;
            this.setLabel(this.scoreLabel, '0');
            this.connectTracksScoreStreak = 0;
            this.connectTracksLastGainSeconds = null;
            this.connectTracksElapsedStartMs = performance.now();
            this.connectTracksSession.dispatch({ type: 'restart' });
            if (this.connectTracksBoard) this.connectTracksInput?.bind(this.connectTracksSession,
                () => this.refreshConnectTracksBoard(), this.connectTracksBoard);
            this.refreshConnectTracksBoard();
        }
    };


    onTapBack(): void {
        const payload: NavigateRequestedEventPayload = { to: AppState.MainMenu };
        EventManager.instance.emit(NAVIGATE_REQUESTED_EVENT, payload);
    }


    private sendIntent(type: IntentType.ShowHint | IntentType.UsePlaceDog | IntentType.Restart): void {
        const session = PuzzleSessionHolder.current;
        if (session) session.dispatch({ type });
    }

    private setLabel(label: Label | null, text: string): void {
        if (label) label.string = text;
    }

    private formatToday(): string {
        const d = new Date();
        const pad = (n: number): string => (n < 10 ? `0${n}` : `${n}`);
        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    }

    private warnIfMissing(value: unknown, fieldName: string): void {
        if (!value) {
            console.warn(
                `[GameplayScreen] Chưa gán '${fieldName}' trong Inspector — phần HUD này sẽ ` +
                    'không hiển thị.',
            );
        }
    }
}
