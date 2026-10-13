import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Font,
    Label,
    Node,
    NodePool,
    Prefab,
    Sprite,
    SpriteFrame,
    Tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    instantiate,
    tween,
} from 'cc';
import { CellState } from '../../core/CellState';
import { PuzzleState } from '../../core/PuzzleState';
import { EventManager } from '../../core/EventManager';
import { GameConfig } from '../../config/GameConfig';
import { IntentType, DragMode, PuzzleIntent } from '../../gameplay/PuzzleIntent';
import { PuzzleSessionHolder } from '../../gameplay/PuzzleSessionHolder';
import { LEVEL_SELECTED_EVENT, LevelSelectedEventPayload } from '../../event/AppEvents';
import {
    BOARD_RESTARTED_EVENT,
    BoardRestartedEventPayload,
    CELL_CHANGED_EVENT,
    CellChangedEventPayload,
    DOG_SETTLED_EVENT,
    DogSettledEventPayload,
    PUZZLE_FAILED_EVENT,
    PUZZLE_READY_EVENT,
    PUZZLE_SOLVED_EVENT,
    VICTORY_WAVE_FINISHED_EVENT,
    PuzzleReadyEventPayload,
    SCORE_CHANGED_EVENT,
    ScoreChangedEventPayload,
} from '../../event/PuzzleEvents';
import { CELL_FILL_RATIO, CellView } from './CellView';
import { APPEAR_STAGGER } from './BoardAppearTiming';
import { DogSpineProvider } from './DogSpineProvider';
import { DogView } from './DogView';
import { pickCellRegionColor, pickRegionColor } from './RegionPalette';
import { RegionColorEntry } from '../../data/config/RegionColorEntry';

const { ccclass, property } = _decorator;


const DEBUG_TOUCH = true; // LOG TẠM ĐỂ DEBUG — bug "đánh dấu lần đầu trong tut bị lag, phải ấn lại" (đang chờ log riêng, KHÁC bug sóng đã fix xong). Trả về false sau khi tìm ra nguyên nhân.


@ccclass('BoardView')
export class BoardView extends Component implements DogSpineProvider {
    @property({ type: Prefab, tooltip: 'Cell.prefab (gắn component CellView)' })
    cellPrefab: Prefab = null!;

    @property({ type: Node, tooltip: 'Node chứa các CellView' })
    cellContainer: Node = null!;

    @property({
        type: [RegionColorEntry],
        tooltip:
            'Tên + màu hiển thị cho từng VÙNG (lặp vòng nếu vùng nhiều hơn mục). CHỈ dùng để tô ' +
            'màu tên vùng trong text gợi ý — KHÔNG liên quan tới màu nền ô (xem Cell Region Colors).',
    })
    regionColors: RegionColorEntry[] = [];

    @property({
        type: [Color],
        tooltip:
            'Bảng màu RIÊNG để tô nền các ô (background) — vùng id N dùng phần tử N (lặp vòng nếu ' +
            'vùng nhiều hơn số màu). Tách biệt hoàn toàn với Region Colors ở trên (đổi màu ô không ' +
            'ảnh hưởng màu chữ gợi ý, và ngược lại).',
    })
    cellRegionColors: Color[] = [];

    @property({
        type: [Color],
        tooltip:
            'Bảng màu RIÊNG cho màn TUTORIAL (đúng thứ tự màu của game gốc — vùng id N dùng phần ' +
            'tử N, lặp vòng nếu vùng nhiều hơn số màu). Để TRỐNG thì tutorial dùng lại Cell Region ' +
            'Colors ở trên như bình thường. Chỉ ảnh hưởng ĐÚNG màn tutorial, không đụng tới campaign/daily.',
    })
    tutorialCellRegionColors: Color[] = [];

    @property({
        type: Prefab,
        tooltip:
            'DogSpine.prefab (gắn component DogSpineView). Để trống thì chó lui về sprite ' +
            'tĩnh trong Cell.prefab — bàn vẫn chơi được, chỉ là không có animation.',
    })
    dogSpinePrefab: Prefab | null = null;

    @property({
        type: Node,
        tooltip:
            'Node chứa chó spine, PHẢI là anh em cùng cha với cellContainer và vẽ ĐÈ LÊN nó ' +
            '(sibling index lớn hơn). Để trống thì tắt chó spine.',
    })
    dogLayer: Node | null = null;

    @property({ tooltip: 'Màu chữ điểm "+N" khi đặt đúng chó.' })
    scorePopupColor: Color = new Color(76, 209, 55);

    @property({ range: [10, 120, 1], tooltip: 'Cỡ chữ "+N".' })
    scorePopupFontSize = 64;

    @property({
        type: Font,
        tooltip: 'Font chữ "+N". Để trống thì dùng font hệ thống mặc định.',
    })
    scorePopupFont: Font | null = null;

    @property({ tooltip: 'Màu viền chữ "+N".' })
    scorePopupOutlineColor: Color = new Color(255, 255, 255);

    @property({ range: [0, 6, 0.5], slide: true, tooltip: 'Độ dày viền chữ "+N" (px).' })
    scorePopupOutlineWidth = 2;

    @property({
        tooltip: 'Điểm "+N" hiện cao hơn tâm ô bao nhiêu (tỉ lệ so với cạnh ô) — đứng yên tại đây, không bay nữa.',
    })
    scorePopupAboveRatio = 1;

    @property({ tooltip: 'Điểm "+N": thời gian HIỆN lên — scale nhỏ→lớn kèm opacity mờ→đậm (giây).' })
    scorePopupScaleSeconds = 1;

    @property({ tooltip: 'Điểm "+N": đứng yên bao lâu (giây) trước khi biến mất.' })
    scorePopupHoldSeconds = 0.35;

    @property({ tooltip: 'Điểm "+N": thời gian BIẾN MẤT — scale lớn→nhỏ kèm opacity đậm→mờ (giây).' })
    scorePopupFadeSeconds = 0.25;

    @property({
        type: Prefab,
        tooltip:
            'Prefab hiệu ứng khen — hiện khi đặt ĐÚNG chim cánh cụt, cùng lúc với điểm "+N". ' +
            'Ảnh hiện tuỳ MỨC combo hiện tại (xem praiseSpriteFrames). Để trống thì bỏ qua ' +
            'hiệu ứng này.\n\nCấu trúc: node con tên "Text" (component cc.Sprite) nhận ảnh khen ' +
            'theo combo — thêm 1 node con "Bg" đặt sibling index TRƯỚC "Text" (vẽ trước = nằm ' +
            'SAU) nếu muốn có nền riêng cho mỗi text khen. Không có node "Text" thì dùng thẳng ' +
            'root (cấu trúc cũ, không có bg).',
    })
    praisePrefab: Prefab | null = null;

    @property({
        type: [SpriteFrame],
        tooltip:
            'Ảnh khen theo TỪNG MỨC combo, kéo ĐÚNG THỨ TỰ từ mức 1 (đặt đúng chó ĐẦU TIÊN) ' +
            'tới mức cao nhất — ví dụ Great, Good, Excellent, Amazing, Unbelievable, Perfect. ' +
            'Combo vượt quá số ảnh sẽ giữ nguyên ảnh CUỐI (mức tối đa). Đặt sai sẽ làm combo ' +
            'về 0 — chó đúng kế tiếp lại bắt đầu từ mức 1.',
    })
    praiseSpriteFrames: SpriteFrame[] = [];

    @property({ tooltip: 'Hiệu ứng khen: thời gian bung ra (scale nhỏ → lớn hơn bình thường rồi dội về đúng size).' })
    praisePopInSeconds = 1;

    @property({ tooltip: 'Hiệu ứng khen: thời gian thu vào ' })
    praisePopFadeSeconds = 1;

    @property({ tooltip: 'Hiệu ứng khen: đứng yên bao lâu (giây) trước khi mờ dần biến mất.' })
    praiseHoldSeconds = 0.5;

    @property({ tooltip: 'Hiệu ứng khen: thời gian mờ dần biến mất (giây).' })
    praiseFadeOutSeconds = 0.25;

    @property({
        type: Node,
        tooltip:
            'Layer NGOÀI board (không bị che/giới hạn bởi khung board, và KHÔNG bị kẹt dưới các ' +
            'node khác cùng cấp với Board như RuleFrame — vd hiệu ứng khen/emoji ở hàng TRÊN CÙNG ' +
            'board có thể bay cao hơn cả RuleFrame) — dùng CHUNG cho hiệu ứng khen (praise) VÀ ' +
            'emoji (spawnEmojiEffect), đặt node này làm CON của 1 layer cấp cao hơn cả Board lẫn ' +
            'RuleFrame trong cây scene (ví dụ ngang hàng/trên cùng UI root). Để trống thì tự dùng ' +
            'dogLayer (có thể bị khuất phần bay cao bởi RuleFrame hoặc node khác cùng cấp Board).',
    })
    praiseEffectsLayer: Node | null = null;

    @property({
        tooltip:
            'Hiệu ứng khen: hiện CỐ ĐỊNH ở giữa, cao hơn viền TRÊN của board bao nhiêu (px), ' +
            'KHÔNG còn bay theo vị trí ô vừa đặt nữa.',
    })
    praiseTopMargin = 40;

    @property({
        tooltip: 'Hiệu ứng khen: lệch NGANG so với giữa board bao nhiêu (px). Âm = sang trái, dương = sang phải.',
    })
    praiseOffsetX = 0;

    @property({
        tooltip: 'Hiệu ứng khen: scale lúc ĐỨNG YÊN (sau khi bung ra) — 1 = đúng kích thước gốc trong prefab.',
    })
    praiseFinalScale = 1;

    @property({
        type: [SpriteFrame],
        tooltip:
            'Vài emoji ngẫu nhiên — hiện CÙNG LÚC với hiệu ứng khen (đặt đúng chó), mỗi lần ' +
            'chọn NGẪU NHIÊN 1 ảnh trong danh sách này (không đổi theo combo như ' +
            'praiseSpriteFrames). Để trống thì bỏ qua hiệu ứng này.',
    })
    emojiSpriteFrames: SpriteFrame[] = [];

    @property({ tooltip: 'Emoji: hiện cao hơn text điểm "+N" bao nhiêu px.' })
    emojiAboveScoreOffset = 80;

    @property({ tooltip: 'Emoji: lệch NGANG ngẫu nhiên trong khoảng [-x, +x] px quanh tâm ô.' })
    emojiRandomOffsetX = 60;

    @property({ range: [10, 200, 1], slide: true, tooltip: 'Kích thước emoji (px, vuông).' })
    emojiSize = 72;

    @property({ tooltip: 'Emoji: thời gian HIỆN lên — scale nhỏ→lớn kèm opacity mờ→đậm (giây).' })
    emojiPopInSeconds = 0.3;

    @property({ tooltip: 'Emoji: đứng yên bao lâu (giây) trước khi biến mất.' })
    emojiHoldSeconds = 0.5;

    @property({ tooltip: 'Emoji: thời gian BIẾN MẤT — scale lớn→nhỏ kèm opacity đậm→mờ (giây).' })
    emojiFadeOutSeconds = 0.25;

    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite mèo nhắc nhở — hiện trên 1 ô khi: (1) người chơi vừa đặt ĐÚNG 1 con mèo nhưng ' +
            'còn ô cần đánh dấu (cùng màu/hàng/cột/xung quanh) CHƯA đánh dấu, (2) im lặng ít nhất ' +
            'lateMarkHintDelaySeconds giây KHÔNG đánh dấu ô nào của CHÍNH con mèo đó, rồi mới quay ' +
            'lại đánh dấu — sprite hiện NGAY TRÊN ô vừa đánh dấu đó. Chỉ hiện cho lần đánh dấu ĐẦU ' +
            'TIÊN sau khoảng im lặng; nếu vẫn còn ô sót lại và lại im lặng đủ lâu lần nữa thì hiện ' +
            'tiếp. Để trống thì tắt hẳn tính năng này.',
    })
    lateMarkHintSpriteFrame: SpriteFrame | null = null;

    @property({
        tooltip:
            'Ngưỡng im lặng (giây) — xem lateMarkHintSpriteFrame. Đếm RIÊNG cho từng con mèo, ' +
            'không tính các thao tác khác (đánh dấu ô khác, đặt mèo khác) trong lúc đó.',
    })
    lateMarkHintDelaySeconds = 30;

    @property({ range: [10, 200, 1], slide: true, tooltip: 'Kích thước sprite nhắc nhở (px, vuông).' })
    lateMarkHintSize = 72;

    @property({
        tooltip:
            'Sprite nhắc nhở hiện CAO HƠN tâm ô bao nhiêu (px) — tránh đè trực tiếp lên ô (che mất ' +
            'dấu X vừa đánh dấu).',
    })
    lateMarkHintAboveOffset = 60;

    @property({ tooltip: 'Sprite nhắc nhở: thời gian hiện lên — scale nhỏ→lớn kèm opacity mờ→đậm (giây).' })
    lateMarkHintPopInSeconds = 0.25;

    @property({ tooltip: 'Sprite nhắc nhở: đứng yên bao lâu (giây) trước khi biến mất.' })
    lateMarkHintHoldSeconds = 0.6;

    @property({ tooltip: 'Sprite nhắc nhở: thời gian biến mất (giây).' })
    lateMarkHintFadeOutSeconds = 0.25;

    @property({
        tooltip:
            'Ô/chó vừa được "nhấc" lên trên nền đen (liftCellsTo, dùng cho tutorial) — thời ' +
            'gian mờ dần rồi đậm lên (giây) thay vì hiện thẳng đột ngột. 0 = tắt hiệu ứng.',
    })
    liftFadeInSeconds = 0.2;

    @property({
        tooltip:
            'Ô/chó bị "hạ" khỏi nền đen (không còn trong danh sách hiện — tutorial chuyển ' +
            'bước) — thời gian mờ dần TẮT (giây) trước khi trả về vị trí gốc, thay vì tắt ' +
            'thẳng đột ngột. 0 = tắt hiệu ứng.',
    })
    liftFadeOutSeconds = 0.15;

    @property({
        type: Prefab,
        tooltip:
            'Prefab viền vàng nền (node có cc.Sprite) — CHỈ dùng trong tutorial (isTutorial). ' +
            'BoardView tự tạo/định vị 1 node cho MỖI ô đang "nhấc" lên nền đen, đặt NGAY DƯỚI ' +
            'ô đó (world position trùng khớp), nhấp nháy OPACITY lặp liên tục cho tới khi ô bị ' +
            'hạ khỏi nền đen (chuyển bước) HOẶC nền đen tạm tắt (TutorialController tự gọi ' +
            'hideAllLiftBorders()). Để trống thì bỏ qua hiệu ứng này.',
    })
    liftBorderPrefab: Prefab | null = null;

    @property({
        tooltip: 'Viền vàng nền to hơn ô bao nhiêu lần — cần > 1 để rìa viền lộ ra ngoài mép ô (ô che ở giữa).',
    })
    liftBorderSizeRatio = 1.25;

    @property({ tooltip: 'Viền tutorial: thời gian mỗi nhịp mờ/đậm (giây), lặp liên tục.' })
    liftBorderPulseSeconds = 1;

    @property({ range: [0, 255, 1], slide: true, tooltip: 'Viền tutorial: opacity thấp nhất khi nhấp nháy (0 = ẩn hoàn toàn).' })
    liftBorderMinOpacity = 60;

    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite "Clear" — hiện khi 1 hàng/cột không còn ô Empty nào (đã đặt chó/đánh dấu HẾT). ' +
            'Hiện bên PHẢI board nếu là hàng, bên TRÊN board nếu là cột. Để trống thì bỏ qua hiệu ứng này.',
    })
    lineClearSpriteFrame: SpriteFrame | null = null;

    @property({ range: [10, 200, 1], slide: true, tooltip: 'Kích thước sprite Clear (px, vuông).' })
    lineClearSize = 72;

    @property({ tooltip: 'Sprite Clear CỘT: cách viền ngoài board bao nhiêu px (không đè lên ô cuối cột).' })
    lineClearMargin = 16;

    @property({ tooltip: 'Sprite Clear HÀNG: hiện ở cạnh TRONG board (ngay ô đầu/cuối hàng đó), nhích cao hơn ô bao nhiêu px để không đè lên sprite mèo/X sẵn có.' })
    lineClearRowInnerRaise = 40;

    @property({
        tooltip:
            'Sprite Clear MÀU — trường hợp hoàn thành bằng ĐÁNH DẤU X (ô cuối cùng của màu là ' +
            'Mark): hiện ngay TRÊN ĐẦU ô đó, nhích cao hơn ô bao nhiêu px để không đè lên sprite X ' +
            'sẵn có (cùng ý nghĩa lineClearRowInnerRaise).',
    })
    lineClearRegionAboveOffset = 40;

    @property({
        tooltip:
            'Sprite Clear MÀU — trường hợp hoàn thành bằng ĐẶT MÈO (ô cuối cùng của màu là Dog): ' +
            'hiện ngay DƯỚI ô đó thay vì trên đầu, nhích xuống bao nhiêu px để không đè lên sprite ' +
            'mèo vừa đặt.',
    })
    lineClearRegionBelowOffset = 40;

    @property({ tooltip: 'Sprite Clear: thời gian HIỆN lên (giây).' })
    lineClearPopInSeconds = 0.25;

    @property({ tooltip: 'Sprite Clear: đứng yên bao lâu (giây) trước khi biến mất.' })
    lineClearHoldSeconds = 0.6;

    @property({ tooltip: 'Sprite Clear: thời gian biến mất (giây).' })
    lineClearFadeOutSeconds = 0.25;

    @property({
        type: SpriteFrame,
        tooltip:
            'Sprite "sóng" màu vàng — hiện chớp nhoáng DƯỚI icon mèo/X của từng ô khi sóng lan ' +
            'quét qua (Clear hàng/cột/vùng). Để trống thì vẫn còn hiệu ứng phóng to/thu nhỏ ô, ' +
            'chỉ thiếu ánh sáng vàng (xem CellView.playWaveVisit()).',
    })
    waveSpriteFrame: SpriteFrame | null = null;

    @property({ range: [1, 2, 0.01], slide: true, tooltip: 'Sóng: ô phóng to tới scale bao nhiêu mỗi lần sóng quét qua.' })
    wavePeakScale = 1.25;

    @property({
        range: [0.5, 2.5, 0.01],
        slide: true,
        tooltip:
            'Sóng: kích thước sprite vàng (waveOverlay) so với cạnh ô (1 = đúng bằng ô). Sprite ' +
            'nằm DƯỚI icon mèo/X nên cần LỚN HƠN ô (>1) mới lộ ra thành viền sáng rõ quanh icon ' +
            'thay vì bị icon che gần hết.',
    })
    waveOverlaySizeRatio = 1.4;

    @property({ tooltip: 'Sóng: 1 ô mất bao lâu (giây) để phóng to lên / thu nhỏ lại (2 chặng bằng nhau).' })
    wavePopSeconds = 0.1;

    @property({ tooltip: 'Sóng: sprite vàng đứng yên ở đỉnh bao lâu (giây) trước khi mờ dần biến mất.' })
    waveHoldSeconds = 0.05;

    @property({ tooltip: 'Sóng: sprite vàng mờ dần biến mất mất bao lâu (giây).' })
    waveFadeSeconds = 0.15;

    @property({
        tooltip:
            'Sóng: tốc độ NHANH NHẤT (giây/bước) — áp dụng khi boardSize >= waveStaggerReferenceMaxSize ' +
            '(board CÀNG NHIỀU ô/hàng/cột). Xem computeWaveStaggerSeconds().',
    })
    waveStaggerSecondsMin = 0.02;

    @property({
        tooltip:
            'Sóng: tốc độ CHẬM NHẤT (giây/bước) — áp dụng khi boardSize <= waveStaggerReferenceMinSize ' +
            '(board CÀNG ÍT ô/hàng/cột, tránh sóng chạy vụt qua khó thấy trên board nhỏ).',
    })
    waveStaggerSecondsMax = 0.05;

    @property({ tooltip: 'Sóng: boardSize (số hàng/cột) ứng với tốc độ CHẬM NHẤT waveStaggerSecondsMax.' })
    waveStaggerReferenceMinSize = 4;

    @property({ tooltip: 'Sóng: boardSize (số hàng/cột) ứng với tốc độ NHANH NHẤT waveStaggerSecondsMin.' })
    waveStaggerReferenceMaxSize = 10;

    @property({
        tooltip:
            'Sóng CHÉO thắng màn: dừng thêm bao lâu (giây) SAU KHI mọi hiệu ứng khác kết thúc (sóng ' +
            'Clear cuối cùng + chuỗi tự đánh dấu ô/đốm sáng bay tới điểm) rồi mới bắt đầu quét.',
    })
    victoryWavePauseSeconds = 0.2;

    @property({
        tooltip:
            'Sóng CHÉO thắng màn: tốc độ NHANH NHẤT (giây/đường chéo) — áp dụng khi boardSize >= ' +
            'waveStaggerReferenceMaxSize. Có min/max RIÊNG với sóng Clear (waveStaggerSecondsMin/Max) ' +
            'vì bản chất khác nhau (quét cả bàn 1 lần vs quét từng vùng nhỏ) — dùng CHUNG 2 mốc ' +
            'boardSize tham chiếu (waveStaggerReferenceMinSize/MaxSize). Xem computeVictoryWaveStaggerSeconds().',
    })
    victoryWaveStaggerSecondsMin = 0.05;

    @property({
        tooltip:
            'Sóng CHÉO thắng màn: tốc độ CHẬM NHẤT (giây/đường chéo) — áp dụng khi boardSize <= ' +
            'waveStaggerReferenceMinSize.',
    })
    victoryWaveStaggerSecondsMax = 0.12;

    @property({
        tooltip:
            'Sóng: dừng thêm bao lâu (giây) SAU KHI animation đặt mèo/đánh dấu của ô trigger chạy ' +
            'xong hẳn (đọc thẳng markPopSeconds/dogPop* của CellView) RỒI MỚI bắt đầu sóng — ô ' +
            'trigger giờ cũng là bước ĐẦU TIÊN của sóng ("tâm sóng"), không còn loại trừ như trước.',
    })
    wavePostSettlePauseSeconds = 0.2;

    @property({
        tooltip:
            'Sóng VÙNG MÀU khi mèo vừa đặt là ô CUỐI CÙNG của màu: dừng bao lâu (giây) rồi mới bắt đầu ' +
            'sóng (không đợi mèo đập xuống). Sóng hàng/cột do mèo hoàn thành dùng wavePostSettlePauseSeconds.',
    })
    waveRegionDogPauseSeconds = 0.4;

    private readonly pool = new NodePool();
    private readonly activeCells: CellView[] = [];

    private readonly scorePool = new NodePool();

    private readonly praisePool = new NodePool();
    private activePraiseNode: Node | null = null;

    /** Các node score popup ("+N")/emoji ĐANG hiện (chưa recycle) — praiseEffectsLayer chưa được
     * gán trong Editor (Board.prefab: "praiseEffectsLayer": null) nên các hiệu ứng này đang tạm
     * rơi vào nhánh fallback dogLayer. playDogEmotion('frustrated') (đặt sai mèo) tự nâng SPINE
     * của MỌI con mèo đã đặt lên trên cùng dogLayer (raiseAboveDogLayer, xem CellView) — nếu đúng
     * lúc 1 hiệu ứng ở đây còn đang hiện dở tại 1 ô lân cận, spine con mèo đó bị nâng lên SAU sẽ đè
     * lên hiệu ứng (bug đã báo, kèm ảnh: "+450"/emoji bị ô mèo đúng bên cạnh đè lên khi đặt sai 1
     * ô kề nó). keepEffectsOnTop() gọi lại NGAY sau playDogEmotion('frustrated') để giành lại vị
     * trí trên cùng. Theo dõi bằng Set (không phải NodePool) vì cần biết CHÍNH XÁC node nào đang
     * hiện để re-front, khác PraiseNode (chỉ có tối đa 1 node hiện tại 1 thời điểm, activePraiseNode
     * đã đủ dùng). */
    private readonly activeEffectNodes = new Set<Node>();

    private readonly emojiPool = new NodePool();

    private readonly dogPool = new NodePool();

    private readonly liftBorderPool = new NodePool();
    private readonly activeLiftBorders = new Map<number, Node>();

    private readonly lineClearPool = new NodePool();
    private readonly lateMarkHintPool = new NodePool();
    /** Vùng (regionId) từng ô, ĐÚNG THỨ TỰ index — copy từ PuzzleReadyEventPayload.regions lúc
     * buildBoard(), dùng để tính ô cần đánh dấu cho lateMarkHint (xem computeRequiredCells()). */
    private regions: readonly number[] = [];
    /** Theo dõi từng con mèo ĐÃ đặt đúng nhưng còn ô cần đánh dấu (cùng màu/hàng/cột/xung quanh) —
     * key = ô con mèo. `dueAt` = mốc thời gian (Date.now()) sớm nhất mà 1 lần đánh dấu tiếp theo
     * của CHÍNH con mèo này được phép hiện lateMarkHint; reset về now + delay mỗi lần hiện xong,
     * để lần đánh dấu NGAY SAU đó (trong cùng 1 đợt dọn) không hiện lặp lại — xem
     * startDogCleanupTracking()/checkDogCleanupMark(). Xoá khỏi map khi requiredCells rỗng. */
    private readonly dogCleanupTimers = new Map<number, { dueAt: number; requiredCells: Set<number> }>();
    /** Mirror TRẠNG THÁI từng ô — chỉ để kiểm tra hàng/cột đã hết ô Empty chưa (không dùng cho gì
     * khác). Đồng bộ lại từ đầu mỗi khi buildBoard()/onBoardRestarted() chạy. */
    private cellStates: CellState[] = [];
    /** Hàng/cột đã hiện hiệu ứng Clear rồi — tránh hiện lặp lại mỗi lần có ô đổi trạng thái khác
     * trong CÙNG hàng/cột đã clear từ trước. Tự gỡ khỏi set nếu hàng/cột đó có ô quay lại Empty
     * (ví dụ bấm X nhầm rồi undo) để có thể hiện lại đúng lúc clear thật sự lần sau. */
    private readonly clearedRows = new Set<number>();
    private readonly clearedCols = new Set<number>();
    private readonly clearedRegions = new Set<number>();

    /** Tăng mỗi khi board dựng lại/restart (buildBoard/onBoardRestarted) — các bước sóng lan đã
     * lên lịch (scheduleOnce, xem playWaveSteps()) tự so khớp giá trị này trước khi chạy, huỷ
     * ngầm nếu board đã đổi giữa chừng (tránh pulse nhầm ô đã bị pool tái sử dụng cho puzzle mới). */
    private waveGeneration = 0;

    /** Mốc (Date.now, ms) sóng Clear gần nhất pulse xong — sóng chéo thắng màn đợi tới sau mốc này. */
    private waveEffectsEndMs = 0;
    /** Mốc (Date.now, ms) animation đặt SAI (tim nháy + X đỏ) gần nhất mới thực sự xong hẳn — sóng
     * Clear của 1 hành động ĐÚNG khác (xảy ra gần như cùng lúc, ví dụ đặt sai 1 ô rồi đặt đúng ô
     * khác ngay sau) đợi tới sau mốc này mới bắt đầu, tránh 2 animation chạy đè lên nhau (xem
     * computeWaveInitialDelay()). */
    private wrongMarkBusyUntilMs = 0;
    private readonly clearEvaluationRevisions = new Map<number, number>();
    /** Mark đang nằm trên vị trí cần đặt mèo: không được tính là hoàn thành hợp lệ. */
    private readonly misplacedMarkCells = new Set<number>();

    private pressedCell = -1;

    private isTutorial = false;
    private boardGeneration = 0;

    private boardSize = 0;
    private cellSize = 0;

   
    private allowedCells: ReadonlySet<number> | null = null;

    private readonly liftedCells: CellView[] = [];
    private readonly liftedDogNodes: Node[] = [];

    private dogLayerHome: { parent: Node; sibling: number } | null = null;

    private touchStartCell = -1;
    private touchStartState: CellState = CellState.Empty;
    private readonly touchStartPos = new Vec2();
    private isDragging = false;
    private dragMode: DragMode = 'mark';
    private readonly draggedCells: number[] = [];
    private lastDragCell = -1;

    private tapConsumed = false;

    private lastTapCell = -1;
    private lastTapTime = 0;

    private static readonly TEMP_VEC3 = new Vec3();
    private static readonly TEMP_VEC2 = new Vec2();

    static current: BoardView | null = null;

    onLoad(): void {
        BoardView.current = this;
        this.validateInspectorFields();

        const bus = EventManager.instance;
        bus.on<PuzzleReadyEventPayload>(PUZZLE_READY_EVENT, this.onPuzzleReady, this);
        bus.on<CellChangedEventPayload>(CELL_CHANGED_EVENT, this.onCellChanged, this);
        bus.on<BoardRestartedEventPayload>(BOARD_RESTARTED_EVENT, this.onBoardRestarted, this);
        bus.on(PUZZLE_SOLVED_EVENT, this.onPuzzleSolved, this);
        bus.on(PUZZLE_FAILED_EVENT, this.onPuzzleFailed, this);
        bus.on<ScoreChangedEventPayload>(SCORE_CHANGED_EVENT, this.onScoreChanged, this);
        bus.on<LevelSelectedEventPayload>(LEVEL_SELECTED_EVENT, this.onLevelSelected, this);

        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    onDestroy(): void {
        if (BoardView.current === this) BoardView.current = null;
        EventManager.instance.targetOff(this);
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);


        this.activeCells.length = 0;
        this.pressedCell = -1;


        this.pool.clear();
        this.dogPool.clear();
        this.scorePool.clear();
        this.praisePool.clear();
        this.activePraiseNode = null;
        this.emojiPool.clear();
        this.lineClearPool.clear();
        this.liftBorderPool.clear();
        this.activeLiftBorders.clear();
    }


    private onScoreChanged = (payload: ScoreChangedEventPayload): void => {
        if (this.isTutorial) return;

        if (payload.gained <= 0 || payload.cell < 0) return;

        // Praise spawn TRƯỚC, score spawn SAU — nếu 2 node cùng chung 1 layer cha thì
        // score (sibling thêm sau) tự vẽ ĐÈ LÊN praise. spawnScorePopup() còn tự đẩy
        // sibling lên TRÊN CÙNG (setSiblingIndex) để chắc chắn score luôn nổi trên praise.
        // Booster Place Dog tự đặt chó — không phải hành động của người chơi, không hiện text khen.
        if (!payload.viaPlaceDog) this.spawnPraiseEffect(payload.streak);
        this.spawnScorePopup(payload.cell, payload.gained);
        this.spawnEmojiEffect(payload.cell);
    };


    private spawnPraiseEffect(streak: number): void {
        if (!this.praisePrefab || this.praiseSpriteFrames.length === 0) return;

        // Combo THẤP (ví dụ mức 1 — con đúng ĐẦU TIÊN) có thể CỐ TÌNH để trống (None) trong
        // praiseSpriteFrames nếu muốn CHƯA hiện khen ngợi ngay từ con đầu, chỉ hiện từ mức nào
        // đó trở đi — bỏ qua TOÀN BỘ hiệu ứng (kể cả bg) ở mức không có ảnh, thay vì hiện bg
        // trống không kèm text (bug trước đây khi phần tử mảng bị None).
        const level = Math.min(Math.max(streak, 1), this.praiseSpriteFrames.length);
        const frame = this.praiseSpriteFrames[level - 1];
        if (!frame) return;

        const transform = this.getComponent(UITransform);
        if (!transform) return;

        const layer = this.praiseEffectsLayer ?? this.dogLayer ?? this.cellContainer;

        const boardTop = (this.boardSize * this.cellSize) / 2;
        BoardView.TEMP_VEC3.set(this.praiseOffsetX, boardTop + this.praiseTopMargin, 0);
        const worldPos = transform.convertToWorldSpaceAR(BoardView.TEMP_VEC3);
        BoardView.TEMP_VEC3.set(worldPos.x, worldPos.y, worldPos.z);

        // Đặt đúng quá NHANH, praise trước còn đang hiện/mờ dần thì tắt luôn NGAY (không
        // đợi hết hold/fade) — tránh 2 praise cùng lúc đè lên nhau ở CÙNG 1 vị trí cố định.
        this.cancelActivePraise();

        const node = this.praisePool.size() > 0 ? this.praisePool.get()! : instantiate(this.praisePrefab);
        // Ảnh khen (praiseSpriteFrames, đổi theo combo) nằm trên node con tên "Text" nếu prefab
        // có tách riêng bg — cho phép thêm 1 node con "Bg" (sibling index TRƯỚC "Text", vẽ trước
        // nên nằm PHÍA SAU) làm nền cho mỗi text khen. Fallback về CHÍNH node gốc (this.praisePrefab
        // KHÔNG tách bg, sprite nằm thẳng trên root — cấu trúc cũ) để không phá prefab đã dựng sẵn.
        const textNode = node.getChildByName('Text') ?? node;
        const sprite = textNode.getComponent(Sprite);
        if (!sprite) {
            this.praisePool.put(node);
            return;
        }

        this.activePraiseNode = node;
        sprite.spriteFrame = frame;

        node.parent = layer;
        node.active = true;
        node.setWorldPosition(BoardView.TEMP_VEC3);

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        const finalScale = new Vec3(this.praiseFinalScale, this.praiseFinalScale, 1);
        node.setScale(this.praiseFinalScale * 0.4, this.praiseFinalScale * 0.4, 1);

        tween(node)
            .to(this.praisePopInSeconds, { scale: finalScale }, { easing: 'backOut' })
            .delay(this.praiseHoldSeconds)
            .to(this.praisePopFadeSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'quadIn' })
            .call(() => this.recyclePraiseNode(node))
            .start();

        tween(opacity)
            .to(this.praisePopInSeconds, { opacity: 255 })
            .delay(Math.max(0, this.praiseHoldSeconds - this.praiseFadeOutSeconds))
            .to(this.praiseFadeOutSeconds, { opacity: 0 })
            .start();
    }

    
    private cancelActivePraise(): void {
        const node = this.activePraiseNode;
        this.activePraiseNode = null;
        if (!node?.isValid) return;

        this.recyclePraiseNode(node);
    }

    private recyclePraiseNode(node: Node): void {
        if (this.activePraiseNode === node) this.activePraiseNode = null;

        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);

        this.praisePool.put(node);
    }

    /** Vị trí tính theo Ô rồi PARENT vào praiseEffectsLayer (convert sang world-space) — CÙNG lý
     * do/cách làm với spawnEmojiEffect()/spawnPraiseEffect(): còn làm con dogLayer/cellContainer
     * (con của Board) thì bị RulesFrame đè (Board đứng TRƯỚC RulesFrame trong Hierarchy). */
    private spawnScorePopup(cell: number, gained: number): void {
        const view = this.activeCells[cell];
        if (!view) return;

        const boardTransform = this.getComponent(UITransform);
        if (!boardTransform) return;

        view.node.getPosition(BoardView.TEMP_VEC3);

        const layer = this.praiseEffectsLayer ?? this.dogLayer ?? this.cellContainer;
        const node = this.acquireScoreNode();
        node.parent = layer;
        // Luôn nổi TRÊN CÙNG layer cha (kể cả khi trùng layer với praise) — node lấy lại
        // từ pool có thể vẫn giữ sibling index CŨ thay vì tự động ra cuối danh sách.
        node.setSiblingIndex(-1);
        this.activeEffectNodes.add(node);

        const label = node.getComponent(Label)!;
        label.string = `+${gained}`;
        label.fontSize = this.scorePopupFontSize;
        label.color = this.scorePopupColor;
        label.outlineColor = this.scorePopupOutlineColor;
        label.outlineWidth = this.scorePopupOutlineWidth;

        const opacity = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        const fromScale = new Vec3(0.3, 0.3, 1);
        node.setScale(fromScale);

        // Đứng YÊN ngay phía trên con vừa đặt — KHÔNG còn kẹp theo mép trên bàn cờ nữa, để
        // điểm của hàng trên cùng vẫn bay lên tự nhiên (được phép vượt khỏi viền board) thay
        // vì bị dừng cứng giữa ô như trước.
        const aboveY = BoardView.TEMP_VEC3.y + this.cellSize * this.scorePopupAboveRatio;
        BoardView.TEMP_VEC3.set(BoardView.TEMP_VEC3.x, aboveY, 0);
        node.setWorldPosition(boardTransform.convertToWorldSpaceAR(BoardView.TEMP_VEC3));

        tween(node)
            .to(this.scorePopupScaleSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .delay(this.scorePopupHoldSeconds)
            .to(this.scorePopupFadeSeconds, { scale: fromScale }, { easing: 'quadIn' })
            .call(() => this.recycleScoreNode(node))
            .start();

        tween(opacity)
            .to(this.scorePopupScaleSeconds, { opacity: 255 })
            .delay(this.scorePopupHoldSeconds)
            .to(this.scorePopupFadeSeconds, { opacity: 0 })
            .start();
    }

    private acquireScoreNode(): Node {
        const pooled = this.scorePool.size() > 0 ? this.scorePool.get() : null;
        if (pooled) return pooled;

        const node = new Node('ScorePopup');
        node.layer = this.node.layer;
        node.addComponent(UITransform);
        node.addComponent(UIOpacity);
        const label = node.addComponent(Label);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.isBold = false;
        if (this.scorePopupFont) label.font = this.scorePopupFont;
        label.enableOutline = true;
        return node;
    }

    private recycleScoreNode(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.activeEffectNodes.delete(node);
        this.scorePool.put(node);
    }

    /** Emoji ngẫu nhiên — hiện CÙNG LÚC với hiệu ứng khen/điểm (đặt đúng chó), cao hơn text
     * điểm "+N" (emojiAboveScoreOffset px) và lệch ngang NGẪU NHIÊN quanh tâm ô
     * (emojiRandomOffsetX).
     *
     * Vị trí tính theo Ô (không cố định 1 chỗ như praise) NHƯNG parent lại vào praiseEffectsLayer
     * (nếu có gán) giống hệt praise — chó ở HÀNG TRÊN CÙNG board thì Y tính ra rất cao, nếu vẫn để
     * emoji làm con dogLayer/cellContainer (con của Board) thì z-order phụ thuộc sibling index của
     * CHÍNH NODE BOARD so với các node khác cùng cấp (ví dụ RuleFrame) — dù đổi Board lên trên hay
     * xuống dưới RuleFrame cũng chỉ giải quyết được 1 trong 2 hiệu ứng (emoji cao trào của board
     * HOẶC Encourage bên trong RuleFrame), không thể vẹn cả đôi nếu emoji còn "sống" trong cây con
     * của Board. Do đó tính toạ độ cục bộ NHƯ CŨ rồi CONVERT SANG WORLD (transform.convertToWorldSpaceAR,
     * y hệt spawnPraiseEffect) trước khi setWorldPosition() vào layer ngoài — layer đó đặt ở cấp
     * cao hơn CẢ Board lẫn RuleFrame trong cây scene nên luôn nổi trên cùng, không phụ thuộc thứ tự
     * Board/RuleFrame nữa. */
    private spawnEmojiEffect(cell: number): void {
        if (this.emojiSpriteFrames.length === 0) return;

        const view = this.activeCells[cell];
        if (!view) return;

        const boardTransform = this.getComponent(UITransform);
        if (!boardTransform) return;

        view.node.getPosition(BoardView.TEMP_VEC3);

        const frame = this.emojiSpriteFrames[Math.floor(Math.random() * this.emojiSpriteFrames.length)];
        if (!frame) return;

        const layer = this.praiseEffectsLayer ?? this.dogLayer ?? this.cellContainer;
        const node = this.acquireEmojiNode();
        node.parent = layer;
        node.setSiblingIndex(-1);
        this.activeEffectNodes.add(node);

        const sprite = node.getComponent(Sprite)!;
        sprite.spriteFrame = frame;

        const opacity = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        const fromScale = new Vec3(0.3, 0.3, 1);
        node.setScale(fromScale);

        const aboveScoreY = BoardView.TEMP_VEC3.y + this.cellSize * this.scorePopupAboveRatio;
        const randomX = BoardView.TEMP_VEC3.x + (Math.random() * 2 - 1) * this.emojiRandomOffsetX;
        BoardView.TEMP_VEC3.set(randomX, aboveScoreY + this.emojiAboveScoreOffset, 0);
        const worldPos = boardTransform.convertToWorldSpaceAR(BoardView.TEMP_VEC3);
        node.setWorldPosition(worldPos);

        tween(node)
            .to(this.emojiPopInSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .delay(this.emojiHoldSeconds)
            .to(this.emojiFadeOutSeconds, { scale: fromScale }, { easing: 'quadIn' })
            .call(() => this.recycleEmojiNode(node))
            .start();

        tween(opacity)
            .to(this.emojiPopInSeconds, { opacity: 255 })
            .delay(this.emojiHoldSeconds)
            .to(this.emojiFadeOutSeconds, { opacity: 0 })
            .start();
    }

    private acquireEmojiNode(): Node {
        const pooled = this.emojiPool.size() > 0 ? this.emojiPool.get() : null;
        if (pooled) return pooled;

        const node = new Node('EmojiPopup');
        node.layer = this.node.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(this.emojiSize, this.emojiSize);
        node.addComponent(UIOpacity);
        node.addComponent(Sprite);
        return node;
    }

    private recycleEmojiNode(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.activeEffectNodes.delete(node);
        this.emojiPool.put(node);
    }

    /** Giành lại vị trí TRÊN CÙNG cho mọi hiệu ứng đang hiện dở (score popup/emoji/praise) — gọi
     * ngay sau bất kỳ thao tác nào có thể "chen" node khác vào SAU chúng trong cùng layer cha (hiện
     * tại chỉ có playDogEmotion('frustrated'), xem ghi chú activeEffectNodes). */
    private keepEffectsOnTop(): void {
        for (const node of this.activeEffectNodes) {
            if (node.isValid) node.setSiblingIndex(-1);
        }
        if (this.activePraiseNode?.isValid) this.activePraiseNode.setSiblingIndex(-1);
    }

 
    setAllowedCells(cells: Iterable<number> | null): void {
        this.allowedCells = cells === null ? null : new Set(cells);
    }

    private isAllowed(cell: number): boolean {
        return this.allowedCells === null || this.allowedCells.has(cell);
    }

    get currentCellSize(): number {
        return this.cellSize;
    }


    get currentVisualCellSize(): number {
        return this.cellSize * CELL_FILL_RATIO;
    }

  
    getCellWorldPosition(cell: number, out: Vec3): Vec3 | null {
        const view = this.activeCells[cell];
        if (!view) return null;
        return view.node.getWorldPosition(out);
    }

    getCellView(cell: number): CellView | null {
        return this.activeCells[cell] ?? null;
    }

    /** Bảng màu nền ô dùng cho lần buildBoard() hiện tại — tutorial dùng tutorialCellRegionColors
     * NẾU có gán (đúng thứ tự màu game gốc), còn lại (kể cả tutorial khi bảng riêng để trống) dùng
     * chung cellRegionColors như bình thường. */
    private resolveCellRegionColors(): readonly Color[] {
        if (this.isTutorial && this.tutorialCellRegionColors.length > 0) return this.tutorialCellRegionColors;
        return this.cellRegionColors;
    }

    /** Tên + màu hiển thị của 1 vùng (theo regionId) — dùng để tô màu chữ trong text gợi ý. */
    getRegionColorEntry(regionId: number): RegionColorEntry | null {
        return pickRegionColor(this.regionColors, regionId);
    }

   
    
    liftCellsTo(parent: Node, cells: readonly number[]): void {

        const dogNodesToLift: Node[] = [];

        for (const index of cells) {
            const view = this.activeCells[index];
            if (!view) continue;
            if (this.liftedCells.indexOf(view) < 0) {
                view.node.setParent(parent, true);
                this.liftedCells.push(view);
                this.fadeInLifted(view.node);
            }

            const dogNode = view.getDogNode();
            if (dogNode && this.liftedDogNodes.indexOf(dogNode) < 0) {
                dogNodesToLift.push(dogNode);
            }
        }

        for (const dogNode of dogNodesToLift) {
            dogNode.setParent(parent, true);
            this.liftedDogNodes.push(dogNode);
            this.fadeInLifted(dogNode);
        }

        if (this.isTutorial) this.syncLiftBorders();
    }

    /**
     * Đổi danh sách ô đang "nhấc" lên trên nền đen sang `cells` MỚI — CHỈ mờ dần TẮT rồi
     * hạ xuống đúng những ô KHÔNG còn trong danh sách mới, ô nào tiếp tục có mặt ở cả 2
     * danh sách thì GIỮ NGUYÊN (không tắt/nhấc lại, không nháy). Dùng khi tutorial chuyển
     * bước — khác restoreLiftedCells() (hạ NGAY LẬP TỨC toàn bộ, dùng lúc thoát hẳn).
     */
    syncLiftedCells(parent: Node, cells: readonly number[]): void {
        const keepCells = new Set<number>(cells);
        const dogHome = this.dogLayer ?? this.cellContainer;

        for (let i = this.liftedCells.length - 1; i >= 0; i--) {
            const view = this.liftedCells[i]!;
            if (keepCells.has(view.cellIndex)) continue;

            this.liftedCells.splice(i, 1);
            this.fadeOutThenRestore(view.node, this.cellContainer);

            const dogNode = view.getDogNode();
            if (!dogNode) continue;
            const dogIndex = this.liftedDogNodes.indexOf(dogNode);
            if (dogIndex >= 0) {
                this.liftedDogNodes.splice(dogIndex, 1);
                this.fadeOutThenRestore(dogNode, dogHome);
            }
        }

        this.liftCellsTo(parent, cells);
    }

    /** Mờ dần TẮT rồi mới trả `node` về `homeParent` — 0 giây thì hạ ngay không hiệu ứng. */
    private fadeOutThenRestore(node: Node, homeParent: Node): void {
        if (!node.isValid) return;

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);

        if (this.liftFadeOutSeconds <= 0) {
            node.setParent(homeParent, true);
            opacity.opacity = 255;
            return;
        }

        tween(opacity)
            .to(this.liftFadeOutSeconds, { opacity: 0 })
            .call(() => {
                if (!node.isValid) return;
                node.setParent(homeParent, true);
                opacity.opacity = 255;
            })
            .start();
    }

    restoreLiftedCells(): void {
        for (const view of this.liftedCells) {
            if (view.node.isValid) {
                view.node.setParent(this.cellContainer, true);
                this.resetLiftOpacity(view.node);
            }
        }
        this.liftedCells.length = 0;
        this.clearAllLiftBorders();

        const dogHome = this.dogLayer ?? this.cellContainer;
        for (const dogNode of this.liftedDogNodes) {
            if (dogNode.isValid) {
                dogNode.setParent(dogHome, true);
                this.resetLiftOpacity(dogNode);
            }
        }
        this.liftedDogNodes.length = 0;
    }

    /**
     * Ô/chó vừa được nhấc lên trên nền đen: mờ dần rồi đậm lên thay vì hiện thẳng đột
     * ngột — tránh cảm giác giật khi cả cụm ô cùng hàng/cột bật lên cùng lúc.
     */
    private fadeInLifted(node: Node): void {
        if (this.liftFadeInSeconds <= 0) return;

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(this.liftFadeInSeconds, { opacity: 255 }).start();
    }

    /** Trả node về layer gốc: dừng tween mờ dần dở dang và đảm bảo hiện lại đậm hoàn toàn. */
    private resetLiftOpacity(node: Node): void {
        const opacity = node.getComponent(UIOpacity);
        if (!opacity) return;
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
    }

    /**
     * Đồng bộ viền vàng nền theo ĐÚNG danh sách `this.liftedCells` HIỆN TẠI (sau khi
     * liftCellsTo/syncLiftedCells vừa thêm/bớt xong) — tự tạo/định vị node MỚI cho ô vừa
     * được nhấc (làm con của ô để co giãn theo khi nhấn, size to hơn ô để rìa lộ ra), tự thu hồi node của
     * ô không còn trong danh sách. CHỈ BoardView gọi (đã tự gate isTutorial ở nơi gọi).
     */
    private syncLiftBorders(): void {
        if (!this.liftBorderPrefab) return;

        const keep = new Set<number>();
        for (const view of this.liftedCells) keep.add(view.cellIndex);

        for (const [cellIndex, node] of this.activeLiftBorders) {
            if (keep.has(cellIndex)) continue;
            this.recycleLiftBorder(node);
            this.activeLiftBorders.delete(cellIndex);
        }

        for (const view of this.liftedCells) {
            if (this.activeLiftBorders.has(view.cellIndex)) continue;

            const node = this.acquireLiftBorderNode();
            // Viền tutorial kế thừa transform của ô, kể cả tween lún xuống khi nhấn.
            node.parent = view.node;
            node.setSiblingIndex(-1); // viền tutorial đè lên background và icon của ô.
            node.setPosition(0, 0, 0);
            node.active = true;

            const size = this.cellSize * this.liftBorderSizeRatio;
            const transform = node.getComponent(UITransform) ?? node.addComponent(UITransform);
            transform.setContentSize(size, size);

            this.startLiftBorderPulse(node);
            this.activeLiftBorders.set(view.cellIndex, node);
        }
    }

    private acquireLiftBorderNode(): Node {
        if (this.liftBorderPool.size() > 0) return this.liftBorderPool.get()!;
        return instantiate(this.liftBorderPrefab!);
    }

    /** Viền tutorial mờ/đậm liên tục tới khi ô được hạ hoặc tutorial ẩn spotlight. */
    private startLiftBorderPulse(node: Node): void {
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        const seconds = Math.max(0.01, this.liftBorderPulseSeconds);
        tween(opacity)
            .repeatForever(
                tween<UIOpacity>()
                    .to(seconds, { opacity: this.liftBorderMinOpacity }, { easing: 'sineInOut' })
                    .to(seconds, { opacity: 255 }, { easing: 'sineInOut' }),
            )
            .start();
    }

    private recycleLiftBorder(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }
        node.active = false;
        this.liftBorderPool.put(node);
    }

    private clearAllLiftBorders(): void {
        for (const node of this.activeLiftBorders.values()) this.recycleLiftBorder(node);
        this.activeLiftBorders.clear();
    }

    /**
     * Tắt HẾT viền vàng nền ngay lập tức mà KHÔNG đụng tới `liftedCells` (ô vẫn ở nguyên
     * layer nhấc, chỉ ẩn viền) — dùng khi nền đen tạm tắt giữa 2 bước (ví dụ đặt xong chó
     * đầu tiên, nền đen biến mất để hiện "Got it") mà chưa có bước mới nào gọi
     * syncLiftedCells() để tự dọn theo cách thông thường. Viền sẽ được TỰ TẠO LẠI đúng ô
     * cần thiết ngay khi bước kế tiếp gọi liftCellsTo()/syncLiftedCells().
     */
    hideAllLiftBorders(): void {
        this.clearAllLiftBorders();
    }

   
    liftDogLayerTo(parent: Node): void {
        const layer = this.dogLayer;
        if (!layer || !layer.parent || this.dogLayerHome) return;

        this.dogLayerHome = { parent: layer.parent, sibling: layer.getSiblingIndex() };
        layer.setParent(parent, true);
    }

   
    raiseDogLayerTop(): void {
        const layer = this.dogLayer;
        if (!layer || !this.dogLayerHome) return;

        const parent = layer.parent;
        if (parent) layer.setSiblingIndex(parent.children.length - 1);
    }

    restoreDogLayer(): void {
        const layer = this.dogLayer;
        const home = this.dogLayerHome;
        this.dogLayerHome = null;
        if (!layer || !home || !home.parent.isValid) return;

        layer.setParent(home.parent, true);
        layer.setSiblingIndex(home.sibling);
    }

 
    acquire(localPos: Readonly<Vec3>, size: number): DogView {
        const node =
            this.dogPool.size() > 0 ? this.dogPool.get()! : instantiate(this.dogSpinePrefab!);

        node.parent = this.dogLayer!;
        node.active = true;

        // Gắn sẵn UIOpacity từ đầu — xem lý do ở acquireCell() (tránh lift-fade lần đầu
        // trông như hiện thẳng vì component vừa add cùng lúc với setParent()).
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 255;

        const view = node.getComponent(DogView);
        if (!view) {
            throw new Error(
                '[BoardView] Prefab nhân vật thiếu component kế thừa DogView ' +
                    '(DogSpineView hoặc PenguinAnimView).',
            );
        }

        view.reset();
        view.place(localPos, size);
        return view;
    }

    release(view: DogView): void {
        // BoardView có thể đã bị destroy TRƯỚC cell gọi hàm này (cùng bị huỷ chung 1 cây
        // node — CellView.onDestroy() gọi releaseSpine() → release() ở đây, nhưng
        // BoardView.onDestroy() của chính node cha có thể đã chạy xong trước đó trong
        // cùng đợt huỷ). Lúc này pool không còn ý nghĩa (cả cây sắp bị Cocos huỷ hết) nên
        // chỉ cần thoát sớm, không được đụng vào dogPool nữa.
        if (!this.isValid) return;
        if (!view.node.parent) return;

        view.reset();
        this.dogPool.put(view.node);
    }

    raiseAboveDogs(node: Node, ownerCellNode: Node): void {
        if (!node.isValid) return;

        const cellParent = ownerCellNode.parent;
        if (cellParent && cellParent !== this.cellContainer) {
            // Ô sở hữu hiệu ứng này đang bị "nhấc" khỏi cellContainer bình thường (ví dụ
            // tutorial spotlight, nhấc lên trên nền đen) — nhấc hiệu ứng theo ĐÚNG layer đó
            // thay vì dogLayer cố định (dogLayer lúc này vẫn nằm dưới nền đen, sẽ bị che).
            node.setParent(cellParent, true);
            node.setSiblingIndex(cellParent.children.length - 1);
            return;
        }

        if (!this.dogLayer) return;
        node.setParent(this.dogLayer, true);
    }


    private get dogSpineReady(): boolean {
        return this.dogSpinePrefab !== null && this.dogLayer !== null;
    }


    private validateInspectorFields(): void {
        const missing: string[] = [];

        if (!this.cellPrefab) missing.push('cellPrefab (kéo Cell.prefab vào)');
        if (!this.cellContainer) missing.push('cellContainer (kéo node CellContainer vào)');

        const transform = this.getComponent(UITransform);
        if (!transform || transform.width <= 0 || transform.height <= 0) {
            missing.push('UITransform của node Board phải có size > 0 (ví dụ 640×640)');
        }

        if (missing.length > 0) {
            throw new Error(
                `[BoardView] Board.prefab chưa cấu hình đủ:\n  - ${missing.join('\n  - ')}`,
            );
        }
    }

  

    private onPuzzleReady = (payload: PuzzleReadyEventPayload): void => {
        this.buildBoard(payload);
    };

    private buildBoard(payload: PuzzleReadyEventPayload): void {
        this.releaseAllCells();

        this.boardSize = payload.size;
        this.cellSize = this.computeCellSize(payload.size);
        this.isTutorial = payload.context === 'tutorial';

        this.cellStates = payload.cellStates.slice();
        this.regions = payload.regions;
        this.clearedRows.clear();
        this.clearedCols.clear();
        this.clearedRegions.clear();
        this.misplacedMarkCells.clear();
        this.dogCleanupTimers.clear();
        this.waveGeneration++;

        const lockedSet = new Set<number>(payload.lockedCells);
        const n = this.boardSize;

        // Đánh dấu "đời" bàn cờ này — lịch hẹn hiện chó bên dưới tự kiểm tra lại đúng đời
        // trước khi chạy, phòng khi buildBoard() bị gọi lại (đổi màn khác) trước khi các
        // lịch hẹn cũ kịp chạy, tránh gọi playDogAppear() nhầm lên ô đã bị tái sử dụng.
        this.boardGeneration++;
        const generation = this.boardGeneration;

        // RESUME ván đang chơi dở: ô + dấu X vẫn hiện với hiệu ứng scale/stagger BÌNH
        // THƯỜNG như vào màn mới — CHỈ RIÊNG con chó dùng sprite tĩnh (showStaticDog) thay
        // vì chạy animation "đặt xuống" (phồng to/particle/spine reveal) của DogView thật.
        // `instant`: board quay lại ĐÚNG trạng thái vừa rời đi (về Gameplay sau màn Streak
        // ăn mừng) — chó cũng dùng sprite tĩnh NHƯ resume, nhưng bỏ hẳn luôn cả hiệu ứng
        // scale/stagger của TỪNG Ô (playAppear animate=false), hiện thẳng toàn bộ ngay.
        const isResume = payload.isResume || payload.instant;
        const animateAppear = !payload.instant;

        for (let index = 0; index < payload.cellStates.length; index++) {
            const row = Math.floor(index / n);
            const col = index % n;

            const cell = this.acquireCell();
            cell.bind(
                index,
                row,
                col,
                this.cellSize,
                pickCellRegionColor(this.resolveCellRegionColors(), payload.regions[index]),
                payload.cellStates[index],
                lockedSet.has(index),
                n,
            );
            this.activeCells.push(cell);

            const delay = (row + col) * APPEAR_STAGGER;

            // Chó (nếu có) hiện ĐỒNG THỜI với chính ô của nó — cùng delay, không đợi cả
            // bàn hiện xong hết mới bật lên như trước.
            if (payload.cellStates[index] === CellState.Dog) {
                cell.setDogVisible(false);
                if (isResume) {
                    // Sprite tĩnh là CON của ô (CellView.bind) nên tự ăn theo scale-in của
                    // playAppear() bên dưới — không cần hẹn giờ/animation riêng gì cả.
                    // DogView thật (đã tạo sẵn trong bind() ở trên) vẫn nằm ẩn, chỉ hiện
                    // lại nếu sau này cần chạy animation cảm xúc (thắng/thua) — xem
                    // CellView.ensureRealDogSpine().
                    cell.showStaticDog();
                } else {
                    this.scheduleOnce(() => {
                        if (this.boardGeneration !== generation) return;
                        cell.playDogAppear();
                    }, delay);
                }
            }

            cell.playAppear(delay, animateAppear);
        }

        this.unschedule(this.celebrateDogs);
    }

    private computeCellSize(size: number): number {
        const transform = this.getComponent(UITransform);
        if (!transform) return 0;

        const available = Math.min(transform.width, transform.height);
        return available / size;
    }

    private acquireCell(): CellView {
        const node = this.pool.size() > 0 ? this.pool.get()! : instantiate(this.cellPrefab);
        node.parent = this.cellContainer;
        node.active = true;

        // Gắn sẵn UIOpacity NGAY TỪ ĐẦU (không đợi tới lúc lift/fade mới addComponent) —
        // component vừa add trong CÙNG khung hình với setParent() (đổi cha lúc lift) có
        // thể không kịp render đúng ngay lần đầu, khiến hiệu ứng mờ dần trông như "hiện
        // thẳng luôn" ở lần lift đầu tiên của ô đó.
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        opacity.opacity = 255;

        const view = node.getComponent(CellView);
        if (!view) throw new Error('[BoardView] Cell.prefab thiếu component CellView.');

        view.attachSpineProvider(this.dogSpineReady ? this : null);
        return view;
    }

    private releaseAllCells(): void {
        this.restoreLiftedCells();
        this.restoreDogLayer();

        for (const cell of this.activeCells) {

            cell.recycle();
            this.pool.put(cell.node);
        }
        this.activeCells.length = 0;
        this.pressedCell = -1;
    }


    private lastPlacedDogCell = -1;

    @property({ tooltip: 'Log thời gian 12 frame đầu khi đặt mèo cuối để chẩn đoán khựng. Tắt sau khi kiểm tra.' })
    debugFinalDogTiming = true;

    private traceFinalDogFrames(cellIndex: number): void {
        const generation = this.waveGeneration;
        const started = performance.now();
        let previous = started;
        const frames: number[] = [];
        const sample = () => {
            if (generation !== this.waveGeneration) {
                this.unschedule(sample);
                return;
            }
            const now = performance.now();
            frames.push(Math.round((now - previous) * 10) / 10);
            previous = now;
            if (frames.length === 12) {
                this.unschedule(sample);
                console.log('[FinalDogTiming]', {
                    cellIndex,
                    boardSize: this.boardSize,
                    frameIntervalsMs: frames,
                    worstIntervalMs: Math.max(...frames),
                    totalMs: Math.round(now - started),
                });
            }
        };
        this.schedule(sample, 0);
    }

    private onCellChanged = (payload: CellChangedEventPayload): void => {
        if (this.debugFinalDogTiming && payload.state === CellState.Dog && this.boardSize > 0
            && this.cellStates.reduce((count, state, index) =>
                count + ((index === payload.cell ? payload.state : state) === CellState.Dog ? 1 : 0), 0) === this.boardSize) {
            this.traceFinalDogFrames(payload.cell);
        }
        if (payload.state === CellState.Dog) this.lastPlacedDogCell = payload.cell;
        const cell = this.activeCells[payload.cell];
        if (cell) {
            const onDogSettled =
                payload.state === CellState.Dog
                    ? () => {
                          const settled: DogSettledEventPayload = { cell: payload.cell };
                          EventManager.instance.emit(DOG_SETTLED_EVENT, settled);
                      }
                    : undefined;
            cell.setState(payload.state, true, onDogSettled);
        }

        if (payload.state === CellState.WrongMark) {
            this.playDogEmotion('frustrated');
            this.keepEffectsOnTop();

            const busyMs = (cell?.wrongMarkAnimationSeconds ?? 0) * 1000;
            this.wrongMarkBusyUntilMs = Math.max(this.wrongMarkBusyUntilMs, Date.now() + busyMs);
        }

        this.updateLineClearTracking(payload.cell, payload.state, payload.viaHint, payload.isMisplacedMark);

        if (payload.state === CellState.Dog) this.startDogCleanupTracking(payload.cell, payload.viaHint);
        else if (payload.state === CellState.Mark) this.checkDogCleanupMark(payload.cell);
    };

    /** Đặt mèo ĐÚNG xong — nếu còn ô cần đánh dấu (cùng màu/hàng/cột/xung quanh, đang Empty) thì
     * bắt đầu đếm lateMarkHintDelaySeconds cho riêng con mèo này (xem lateMarkHintSpriteFrame). */
    private startDogCleanupTracking(dogCell: number, viaHint: boolean): void {
        // Tutorial KHÔNG được hiện bất kỳ emoji/hiệu ứng nhắc nhở nào (cùng quy tắc với
        // spawnEmojiEffect() ở onCellChanged()) — TutorialController tự dẫn dắt bằng bàn tay/viền
        // vàng riêng, lateMarkHint ở đây dễ chồng lấn/gây rối luồng dạy.
        if (this.isTutorial) return;
        // Mèo đặt qua HINT (không phải người chơi tự bấm/dùng booster Đặt mèo — viaHint CHỈ true
        // đúng lúc PuzzleSession.handleApplyHint() chạy) — không cần nhắc "quên đánh dấu", vì hint
        // vốn đã CHỦ ĐỘNG dẫn dắt người chơi rồi, không phải lúc người chơi tự loay hoay im lặng.
        if (viaHint) return;
        if (!this.lateMarkHintSpriteFrame || this.boardSize <= 0 || this.regions.length === 0) return;

        const requiredCells = this.computeRequiredCells(dogCell);
        if (requiredCells.size === 0) return;

        this.dogCleanupTimers.set(dogCell, {
            dueAt: Date.now() + this.lateMarkHintDelaySeconds * 1000,
            requiredCells,
        });
    }

    /** Ô vừa đánh dấu X hợp lệ — nếu nó thuộc danh sách "cần dọn" của 1 con mèo đang theo dõi,
     * gỡ khỏi danh sách; nếu đã tới/quá dueAt của con mèo đó (đủ lâu im lặng) thì hiện lateMarkHint
     * NGAY TRÊN ô này rồi đặt lại dueAt cho lần kế tiếp — chỉ hiện 1 lần cho mỗi đợt im lặng, không
     * lặp lại cho các ô đánh dấu NGAY SAU đó trong cùng 1 đợt dọn. */
    private checkDogCleanupMark(markedCell: number): void {
        if (this.dogCleanupTimers.size === 0) return;

        const now = Date.now();
        for (const [dogCell, timer] of this.dogCleanupTimers) {
            if (!timer.requiredCells.has(markedCell)) continue;

            timer.requiredCells.delete(markedCell);

            if (now >= timer.dueAt) {
                this.spawnLateMarkHintEffect(markedCell);
                timer.dueAt = now + this.lateMarkHintDelaySeconds * 1000;
            }

            if (timer.requiredCells.size === 0) this.dogCleanupTimers.delete(dogCell);
        }
    }

    /** Mọi ô đang Empty cùng vùng, cùng hàng, cùng cột, hoặc kề 8 hướng với `dogCell` — đúng tập ô
     * BẮT BUỘC phải đánh dấu X sau khi đặt mèo tại đây (luật Star Battle). */
    private computeRequiredCells(dogCell: number): Set<number> {
        const n = this.boardSize;
        const row = Math.floor(dogCell / n);
        const col = dogCell % n;
        const region = this.regions[dogCell];
        const result = new Set<number>();

        for (let i = 0; i < this.cellStates.length; i++) {
            if (i === dogCell || this.cellStates[i] !== CellState.Empty) continue;

            const r = Math.floor(i / n);
            const c = i % n;
            const sameLine = r === row || c === col;
            const sameRegion = this.regions[i] === region;
            const adjacent = Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1;

            if (sameLine || sameRegion || adjacent) result.add(i);
        }
        return result;
    }

    /** Vị trí tính theo Ô rồi PARENT vào praiseEffectsLayer (convert sang world-space) — CÙNG lý
     * do/cách làm với spawnEmojiEffect()/spawnScorePopup(): còn làm con dogLayer/cellContainer
     * (con của Board) thì bị RulesFrame đè (Board đứng TRƯỚC RulesFrame trong Hierarchy). */
    private spawnLateMarkHintEffect(cell: number): void {
        if (!this.lateMarkHintSpriteFrame) return;
        const view = this.activeCells[cell];
        if (!view) return;

        const boardTransform = this.getComponent(UITransform);
        if (!boardTransform) return;

        const layer = this.praiseEffectsLayer ?? this.dogLayer ?? this.cellContainer;
        const node = this.acquireLateMarkHintNode();
        node.parent = layer;
        node.setSiblingIndex(-1);

        const sprite = node.getComponent(Sprite)!;
        // Mặc định Sprite dùng kích thước ảnh GỐC khi gán spriteFrame, ghi đè contentSize đã set
        // ở acquireLateMarkHintNode() — cùng bug đã gặp ở HintController.showPreviewSprite() (X/
        // mèo preview). Phải CUSTOM mới giữ đúng lateMarkHintSize dù ảnh gốc lớn cỡ nào.
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.spriteFrame = this.lateMarkHintSpriteFrame;

        const transform = node.getComponent(UITransform)!;
        const { width, height } = this.lateMarkHintSpriteFrame.rect;
        const longestSide = Math.max(width, height);
        if (width > 0 && height > 0) {
            const fitScale = this.lateMarkHintSize / longestSide;
            transform.setContentSize(width * fitScale, height * fitScale);
        } else {
            transform.setContentSize(this.lateMarkHintSize, this.lateMarkHintSize);
        }

        const opacity = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        const fromScale = new Vec3(0.4, 0.4, 1);
        node.setScale(fromScale);
        const pos = view.node.position;
        BoardView.TEMP_VEC3.set(pos.x, pos.y + this.lateMarkHintAboveOffset, 0);
        node.setWorldPosition(boardTransform.convertToWorldSpaceAR(BoardView.TEMP_VEC3));

        tween(node)
            .to(this.lateMarkHintPopInSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .delay(this.lateMarkHintHoldSeconds)
            .to(this.lateMarkHintFadeOutSeconds, { scale: fromScale }, { easing: 'quadIn' })
            .call(() => this.recycleLateMarkHintNode(node))
            .start();

        tween(opacity)
            .to(this.lateMarkHintPopInSeconds, { opacity: 255 })
            .delay(this.lateMarkHintHoldSeconds)
            .to(this.lateMarkHintFadeOutSeconds, { opacity: 0 })
            .start();
    }

    private acquireLateMarkHintNode(): Node {
        const pooled = this.lateMarkHintPool.size() > 0 ? this.lateMarkHintPool.get() : null;
        if (pooled) return pooled;

        const node = new Node('LateMarkHint');
        node.layer = this.node.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(this.lateMarkHintSize, this.lateMarkHintSize);
        node.addComponent(UIOpacity);
        node.addComponent(Sprite);
        return node;
    }

    private recycleLateMarkHintNode(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.lateMarkHintPool.put(node);
    }

    /** Cập nhật mirror trạng thái + kiểm tra hàng/cột/vùng của ô vừa đổi đã hết ô Empty chưa — hiện
     * hiệu ứng Clear nếu ĐÚNG LÚC hàng/cột/vùng đó chuyển từ "còn dở" sang "đã hết" (không lặp lại
     * nếu đã hoàn thành rồi, xem clearedRows/clearedCols/clearedRegions). Hint chỉ tắt hiệu ứng của
     * chính thao tác đó, không chặn những lần người chơi tự hoàn thành hàng/cột/vùng sau này. */
    private updateLineClearTracking(
        cellIndex: number,
        state: CellState,
        viaHint: boolean,
        isMisplacedMark: boolean,
        confirmedMark = false,
    ): void {
        if (this.isTutorial || this.boardSize <= 0) return;
        if (cellIndex < 0 || cellIndex >= this.cellStates.length) return;

        const previousState = this.cellStates[cellIndex];
        const revision = (this.clearEvaluationRevisions.get(cellIndex) ?? 0) + 1;
        this.clearEvaluationRevisions.set(cellIndex, revision);
        this.cellStates[cellIndex] = state;
        if (state === CellState.Mark && isMisplacedMark) this.misplacedMarkCells.add(cellIndex);
        else this.misplacedMarkCells.delete(cellIndex);

        // Đặt sai ở ô trống cuối hàng/cột: chỉ quét sóng sau animation sai, không Clear
        // và không ghi nhận hàng/cột đã hoàn thành hợp lệ.
        if (state === CellState.WrongMark) {
            if ((previousState === CellState.Empty || previousState === CellState.Mark) && !viaHint) {
                const row = Math.floor(cellIndex / this.boardSize);
                const col = cellIndex % this.boardSize;
                const rowComplete = !this.clearedRows.has(row) && this.isRowComplete(row);
                const colComplete = !this.clearedCols.has(col) && this.isColComplete(col);
                const region = this.regions[cellIndex];
                const regionComplete = region !== undefined && !this.clearedRegions.has(region)
                    && this.regionCellCount(region) > 1 && this.isRegionComplete(region);
                if (rowComplete || colComplete || regionComplete) {
                    const generation = this.waveGeneration;
                    const delay = Math.max(0, (this.wrongMarkBusyUntilMs - Date.now()) / 1000);
                    this.scheduleOnce(() => {
                        if (generation !== this.waveGeneration || this.cellStates[cellIndex] !== CellState.WrongMark) return;
                        let steps: number[][] = [];
                        if (rowComplete && !this.clearedRows.has(row) && this.isRowComplete(row)) {
                            this.clearedRows.add(row);
                            steps = this.getLineWaveSteps('row', row, row, col);
                        }
                        if (colComplete && !this.clearedCols.has(col) && this.isColComplete(col)) {
                            this.clearedCols.add(col);
                            steps = this.mergeWaveSteps(steps, this.getLineWaveSteps('col', col, row, col));
                        }
                        if (regionComplete && !this.clearedRegions.has(region) && this.isRegionComplete(region)) {
                            this.clearedRegions.add(region);
                            steps = this.mergeWaveSteps(steps, this.getRegionWaveSteps(cellIndex, region));
                        }
                        this.playWaveSteps(steps, 0);
                    }, delay);
                }
            }
            return;
        }

        // Lần chạm đầu của double tap phát Mark trước PlaceDogAttempt. Chưa chốt
        // Clear hoặc lên lịch sóng cho tới khi biết đây thực sự là đánh dấu X.
        if (state === CellState.Mark && !viaHint && !confirmedMark) {
            const generation = this.waveGeneration;
            this.scheduleOnce(() => {
                if (generation !== this.waveGeneration || this.clearEvaluationRevisions.get(cellIndex) !== revision) return;
                if (this.cellStates[cellIndex] !== CellState.Mark) return;
                this.updateLineClearTracking(cellIndex, state, viaHint, isMisplacedMark, true);
            }, Math.max(GameConfig.doubleTapThresholdSeconds, this.activeCells[cellIndex]?.markPopSeconds ?? 0));
            return;
        }

        const n = this.boardSize;
        const row = Math.floor(cellIndex / n);
        const col = cellIndex % n;

        // Luôn cập nhật tracking hoàn thành hàng/cột/vùng (side-effect "chỉ tính 1 lần trong ván",
        // xem checkNewlyComplete/checkRegionNewlyComplete), kể cả khi không hiện hiệu ứng gì.
        const rowNewlyComplete = this.checkNewlyComplete('row', row);
        const colNewlyComplete = this.checkNewlyComplete('col', col);
        const region = this.regions[cellIndex];
        // Vùng CHỈ CÓ 1 Ô (đặt đúng mèo là xong ngay, không có gì để "lan sóng"/ăn mừng hoàn
        // thành cả cụm) — vẫn tính "đã cleared" (không lặp lại kiểm tra), chỉ KHÔNG hiện hiệu ứng.
        const regionNewlyComplete =
            region !== undefined && this.checkRegionNewlyComplete(region) && this.regionCellCount(region) > 1;

        // Đánh dấu X hợp lệ HOẶC đặt mèo hợp lệ đều có thể kích hoạt Clear (áp dụng hint không
        // bao giờ kích hoạt).
        const canCelebrateMark = !viaHint && state === CellState.Mark && !isMisplacedMark;
        const canCelebrateDog = !viaHint && state === CellState.Dog;
        if (!canCelebrateMark && !canCelebrateDog) return;

        const lineAxis = this.resolveLineAxis(row, col, rowNewlyComplete, colNewlyComplete);
        if (!lineAxis && !regionNewlyComplete) return;

        // Ô vừa hoàn thành CẢ màu LẪN hàng/cột cùng lúc, do ĐẶT MÈO — trước đây chạy 2 sóng riêng
        // lần lượt (sóng hàng/cột dùng delay khác sóng vùng màu), khiến sóng hàng/cột chạy/kết
        // thúc XONG rồi sóng vùng màu mới bắt đầu (bug đã báo). Giờ GỘP thành 1 sóng DUY NHẤT,
        // cùng 1 delay, quét TẤT CẢ khu vực vừa hoàn thành ĐỒNG THỜI — kể cả trường hợp ô đó vừa
        // là ô cuối của màu, VỪA là ô cuối của 1 hàng, VỪA là ô cuối của 1 cột luôn (cả 3 gộp
        // chung 1 sóng, không chỉ chọn 1 trong 2 trục như lineAxis vẫn làm cho sprite). Sprite
        // Clear vẫn chỉ hiện 1 lần (ưu tiên vùng màu, đúng quy tắc ưu tiên cũ khi đặt mèo).
        if (canCelebrateDog && regionNewlyComplete && (rowNewlyComplete || colNewlyComplete)) {
            this.spawnRegionClearSprite(cellIndex, state, true);
            let merged = this.getRegionWaveSteps(cellIndex, region!);
            if (rowNewlyComplete) merged = this.mergeWaveSteps(merged, this.getLineWaveSteps('row', row, row, col));
            if (colNewlyComplete) merged = this.mergeWaveSteps(merged, this.getLineWaveSteps('col', col, row, col));
            // PHẢI đi qua computeWaveInitialDelay() (không dùng thẳng waveRegionDogPauseSeconds)
            // để còn tính tới wrongMarkBusyUntilMs — trước đây bỏ qua thẳng, đúng lỗ hổng đã báo
            // ("đặt sai xong đặt đúng hoàn thành cả vùng+hàng/cột cùng lúc thì sóng vẫn chạy ngay").
            this.playWaveSteps(merged, this.computeWaveInitialDelay(cellIndex, state, true));
            return;
        }

        // Không xảy ra va chạm (chỉ 1 trong 2 hoàn thành, hoặc là Đánh dấu X — Mark vốn đã dùng
        // CHUNG 1 công thức delay cho cả sóng hàng/cột lẫn sóng vùng, xem computeWaveInitialDelay,
        // nên 2 sóng của Mark đã tự nhiên chạy đồng thời, không cần gộp) — giữ hành vi cũ: sprite
        // Clear chỉ hiện ở bên ưu tiên, sóng chạy riêng cho từng bên có hoàn thành.
        if (lineAxis) {
            const showSprite = canCelebrateDog ? !regionNewlyComplete : true;
            this.spawnLineClearForAxis(lineAxis.axis, lineAxis.index, row, col, state, showSprite);
        }
        if (regionNewlyComplete) {
            const showSprite = canCelebrateDog ? true : !lineAxis;
            this.spawnRegionClearEffect(cellIndex, state, showSprite);
        }
    }

    /** true nếu hàng/cột VỪA chuyển từ "còn dở" sang "đã hết" NGAY LÚC NÀY — MỘT hàng/cột chỉ
     * được tính "newly complete" ĐÚNG 1 LẦN trong suốt ván chơi (xem clearedRows/clearedCols):
     * đã hiện Clear rồi thì dù người chơi xoá đánh dấu rồi đánh dấu lại cũng KHÔNG hiện lại nữa
     * (khác trước đây — tự "quên" khi quay lại dở dang, cho phép hiện lại). */
    private checkNewlyComplete(axis: 'row' | 'col', index: number): boolean {
        const trackedSet = axis === 'row' ? this.clearedRows : this.clearedCols;
        if (trackedSet.has(index)) return false;

        const complete = axis === 'row'
            ? this.isRowComplete(index) && !this.rowHasWrongMark(index)
            : this.isColComplete(index) && !this.colHasWrongMark(index);
        if (!complete) return false;

        trackedSet.add(index);
        return true;
    }

    /** Ô vừa đổi (row, col) có thể hoàn thành hàng, cột, hoặc CẢ HAI CÙNG LÚC (ô giao điểm) — nếu
     * cả 2 cùng vừa hoàn thành, chọn 1 trục (ưu tiên trục có cạnh board GẦN ô đó hơn, xem
     * pickPreferredAxis) để hiện Clear, tránh 2 hiệu ứng chồng lên nhau cho cùng 1 lần đặt. */
    private resolveLineAxis(
        row: number,
        col: number,
        rowNewlyComplete: boolean,
        colNewlyComplete: boolean,
    ): { axis: 'row' | 'col'; index: number } | null {
        if (!rowNewlyComplete && !colNewlyComplete) return null;
        const axis = rowNewlyComplete && colNewlyComplete ? this.pickPreferredAxis(row, col) : rowNewlyComplete ? 'row' : 'col';
        return { axis, index: axis === 'row' ? row : col };
    }

    private regionCellCount(region: number): number {
        let count = 0;
        for (let i = 0; i < this.regions.length; i++) {
            if (this.regions[i] === region) count++;
        }
        return count;
    }

    /** true nếu vùng/màu VỪA chuyển từ "còn dở" sang "đã hết ô Empty" NGAY LÚC NÀY — cùng quy
     * tắc "chỉ tính 1 lần duy nhất trong ván" với checkNewlyComplete() (xem clearedRegions). */
    private checkRegionNewlyComplete(region: number): boolean {
        if (this.clearedRegions.has(region)) return false;
        // PHẢI loại trừ WrongMark ở ĐÂY (trước khi thêm vào clearedRegions), KHÔNG được chỉ kiểm
        // tra regionHasWrongMark() sau — nếu không, 1 ô đang WrongMark (đặt sai mèo, tạm thời
        // không phải Empty nhưng CHƯA thực sự giải xong) khiến isRegionComplete() trả về true SAI
        // LỆCH, vùng bị đánh dấu "đã cleared" TRƯỚC KHI thực sự hoàn thành — lần hoàn thành THẬT
        // sau đó (khi WrongMark được sửa lại) sẽ bị bỏ qua vĩnh viễn (bug đã gặp). Cùng cơ chế
        // checkNewlyComplete() (hàng/cột) đã gộp sẵn !hasWrongMark vào điều kiện.
        if (!this.isRegionComplete(region) || this.regionHasWrongMark(region)) return false;

        this.clearedRegions.add(region);
        return true;
    }

    private isRegionComplete(region: number): boolean {
        for (let i = 0; i < this.regions.length; i++) {
            if (this.regions[i] === region && this.cellStates[i] === CellState.Empty) return false;
        }
        return true;
    }

    /** Chặn cả WrongMark và Mark nằm trên vị trí cần đặt mèo — cùng lý do rowHasWrongMark/
     * colHasWrongMark (đặt sai mèo bị đánh X trong vùng KHÔNG phải hoàn thành thật). */
    private regionHasWrongMark(region: number): boolean {
        for (let i = 0; i < this.regions.length; i++) {
            if (this.regions[i] !== region) continue;
            if (this.cellStates[i] === CellState.WrongMark) return true;
            if (this.misplacedMarkCells.has(i)) return true;
        }
        return false;
    }

    /** Ô giao điểm hoàn thành cả hàng lẫn cột cùng lúc — chọn trục có cạnh board GẦN ô đó hơn
     * (ô gần cạnh trái/phải board → ưu tiên hàng; ô gần cạnh trên/dưới board → ưu tiên cột). */
    private pickPreferredAxis(row: number, col: number): 'row' | 'col' {
        const n = this.boardSize;
        const distToLeftRightEdge = Math.min(col, n - 1 - col);
        const distToTopBottomEdge = Math.min(row, n - 1 - row);
        return distToLeftRightEdge <= distToTopBottomEdge ? 'row' : 'col';
    }

    /** `triggerRow`/`triggerCol` = toạ độ ô VỪA đặt gây ra Clear — dùng để chọn hướng hiện hiệu
     * ứng theo cạnh board mà ô đó gần hơn (xem resolveLineClearPosition). */
    private spawnLineClearForAxis(
        axis: 'row' | 'col',
        index: number,
        triggerRow: number,
        triggerCol: number,
        state: CellState,
        showSprite: boolean,
    ): void {
        const hasWrongMark = axis === 'row' ? this.rowHasWrongMark(index) : this.colHasWrongMark(index);
        if (hasWrongMark) return;

        if (showSprite) this.spawnLineClearEffect(axis, index, triggerRow, triggerCol);

        const triggerCell = triggerRow * this.boardSize + triggerCol;
        const steps = this.getLineWaveSteps(axis, index, triggerRow, triggerCol);
        // computeWaveInitialDelay() đã đợi animation đặt dấu X của CHÍNH ô trigger chạy XONG HẲN
        // rồi sóng mới bắt đầu — không còn lý do bỏ qua ô đó nữa, sóng phải quét CẢ ô trigger
        // (trước đây dùng steps.slice(1) bỏ qua vì tưởng animation X còn đang chạy dở, SAI vì lúc
        // này nó đã settle xong).
        this.playWaveSteps(steps, this.computeWaveInitialDelay(triggerCell, state, false));
    }

    /** Danh sách bước sóng cho hàng/cột (bước 0 là CHÍNH ô trigger — "tâm sóng" — các bước sau
     * mỗi bước 1 ô, quét dần sang đầu kia). Tách riêng khỏi spawnLineClearForAxis() để dùng
     * chung được cho cả đường phát sóng ĐỘC LẬP lẫn đường GỘP sóng vùng+hàng/cột làm 1
     * (xem mergeWaveSteps() trong updateLineClearTracking()). ĐỢI animation đặt mèo/đánh dấu
     * RIÊNG của CHÍNH ô trigger chạy xong hẳn + dừng thêm 1 nhịp (computeWaveInitialDelay) RỒI
     * MỚI bắt đầu sóng — tránh sóng pulse đè lên lúc animation đó còn đang chạy dở (2 bên đều
     * tween icon.node). Ô trigger giờ cũng được TÍNH VÀO sóng vì đã đợi đủ lâu, không còn nguy
     * cơ cắt ngang animation đặt/đánh dấu nữa. */
    private getLineWaveSteps(axis: 'row' | 'col', index: number, triggerRow: number, triggerCol: number): number[][] {
        const triggerCell = triggerRow * this.boardSize + triggerCol;
        const rest = this.lineWaveOrder(axis, index, triggerRow, triggerCol).filter((cell) => cell !== triggerCell);
        return [[triggerCell], ...rest.map((cell) => [cell])];
    }

    /** Thứ tự các ô hàng/cột cho hiệu ứng sóng — bắt đầu từ ô GẦN sprite Clear nhất (CÙNG cạnh
     * anchor với resolveLineClearPosition(), để sóng luôn xuất phát đúng từ chỗ sprite Clear vừa
     * hiện), quét dần từng ô một sang tới đầu kia. */
    private lineWaveOrder(axis: 'row' | 'col', index: number, triggerRow: number, triggerCol: number): number[] {
        const n = this.boardSize;
        const cells: number[] = [];

        if (axis === 'row') {
            const closerToRight = n - 1 - triggerCol <= triggerCol;
            for (let step = 0; step < n; step++) {
                const c = closerToRight ? n - 1 - step : step;
                cells.push(index * n + c);
            }
            return cells;
        }

        const closerToBottom = n - 1 - triggerRow <= triggerRow;
        for (let step = 0; step < n; step++) {
            const r = closerToBottom ? n - 1 - step : step;
            cells.push(r * n + index);
        }
        return cells;
    }

    /** Chặn cả WrongMark và Mark nằm trên vị trí cần đặt mèo. */
    private rowHasWrongMark(row: number): boolean {
        const n = this.boardSize;
        for (let col = 0; col < n; col++) {
            const cell = row * n + col;
            if (this.cellStates[cell] === CellState.WrongMark) return true;
            if (this.misplacedMarkCells.has(cell)) return true;
        }
        return false;
    }

    private colHasWrongMark(col: number): boolean {
        const n = this.boardSize;
        for (let row = 0; row < n; row++) {
            const cell = row * n + col;
            if (this.cellStates[cell] === CellState.WrongMark) return true;
            if (this.misplacedMarkCells.has(cell)) return true;
        }
        return false;
    }

    private isRowComplete(row: number): boolean {
        const n = this.boardSize;
        for (let col = 0; col < n; col++) {
            if (this.cellStates[row * n + col] === CellState.Empty) return false;
        }
        return true;
    }

    private isColComplete(col: number): boolean {
        const n = this.boardSize;
        for (let row = 0; row < n; row++) {
            if (this.cellStates[row * n + col] === CellState.Empty) return false;
        }
        return true;
    }

    /**
     * Tính toạ độ CỤC BỘ (x, y) cho sprite Clear:
     * - Hàng: hiện Ở CẠNH TRONG board — ngay tại ô đầu/cuối hàng đó (ô gần cạnh board mà ô VỪA
     *   ĐẶT gần hơn), chỉ nhích cao hơn (lineClearRowInnerRaise) để không đè lên sprite mèo/X sẵn
     *   có của ô đó.
     * - Cột: vẫn hiện Ở CẠNH NGOÀI board như cũ (cuối cột, đẩy ra ngoài lineClearMargin).
     */
    private resolveLineClearPosition(
        axis: 'row' | 'col',
        index: number,
        triggerRow: number,
        triggerCol: number,
    ): { x: number; y: number } | null {
        const n = this.boardSize;

        if (axis === 'row') {
            const closerToRight = n - 1 - triggerCol <= triggerCol;
            const anchorCell = closerToRight ? index * n + (n - 1) : index * n;
            const view = this.activeCells[anchorCell];
            if (!view) return null;
            return { x: view.node.position.x, y: view.node.position.y + this.lineClearRowInnerRaise };
        }

        const boardHalf = (this.boardSize * this.cellSize) / 2;
        const edgeOffset = boardHalf + this.lineClearMargin + this.lineClearSize / 2;
        const closerToBottom = n - 1 - triggerRow <= triggerRow;
        const anchorCell = closerToBottom ? (n - 1) * n + index : index;
        const view = this.activeCells[anchorCell];
        if (!view) return null;
        return { x: view.node.position.x, y: closerToBottom ? -edgeOffset : edgeOffset };
    }

    /**
     * Hiện sprite "Clear" — vị trí tính CỤC BỘ theo board (xem resolveLineClearPosition()) nhưng
     * PARENT vào praiseEffectsLayer (convert sang world-space) giống hệt spawnEmojiEffect()/
     * spawnPraiseEffect() — KHÔNG còn làm con dogLayer/cellContainer nữa: layer đó nằm ở cấp CAO
     * HƠN CẢ Board lẫn RuleFrame/HUD trong cây scene, luôn nổi trên cùng, không phụ thuộc sibling
     * index của Board so với các node khác cùng cấp (RuleFrame, panel khác...) hay các hiệu ứng
     * khác được spawn SAU đè lên nó nữa.
     */
    private spawnLineClearEffect(axis: 'row' | 'col', index: number, triggerRow: number, triggerCol: number): void {
        const pos = this.resolveLineClearPosition(axis, index, triggerRow, triggerCol);
        if (!pos) return;

        this.playClearEffectAt(pos.x, pos.y);
    }

    /**
     * Hoàn thành cả VÙNG/MÀU (evaluateRegionClear) — hiện Clear ngay TRÊN hoặc DƯỚI chính ô vừa
     * thao tác (KHÔNG theo cạnh board như hàng/cột), dùng CHUNG sprite/kích thước/tween với Clear
     * hàng/cột (lineClearSpriteFrame/lineClearSize/...) — chỉ khác cách tính vị trí. Đặt mèo (Dog)
     * hiện DƯỚI ô (không đè lên sprite mèo vừa đặt); đánh dấu X (Mark) hiện TRÊN ô như cũ.
     */
    private spawnRegionClearEffect(cell: number, state: CellState, showSprite: boolean): void {
        this.spawnRegionClearSprite(cell, state, showSprite);

        const region = this.regions[cell];
        if (region === undefined) return;

        const steps = this.getRegionWaveSteps(cell, region);
        // Cùng lý do đã bỏ steps.slice(1) ở spawnLineClearForAxis() — computeWaveInitialDelay() đã
        // đợi animation X settle xong hẳn rồi mới chạy, ô trigger phải được sóng quét qua.
        this.playWaveSteps(steps, this.computeWaveInitialDelay(cell, state, true));
    }

    /** Chỉ hiện sprite "Clear" của vùng/màu (tách riêng khỏi phần sóng) — dùng chung cho cả đường
     * phát sóng ĐỘC LẬP (spawnRegionClearEffect) lẫn đường GỘP sóng vùng+hàng/cột làm 1 (xem
     * mergeWaveSteps() trong updateLineClearTracking()), nơi sprite hiện riêng nhưng sóng chạy
     * gộp chung 1 lần thay vì gọi lại toàn bộ spawnRegionClearEffect(). */
    private spawnRegionClearSprite(cell: number, state: CellState, showSprite: boolean): void {
        if (!showSprite) return;
        const view = this.activeCells[cell];
        if (!view) return;

        const pos = view.node.position;
        const offset = state === CellState.Dog ? -this.lineClearRegionBelowOffset : this.lineClearRegionAboveOffset;
        this.playClearEffectAt(pos.x, pos.y + offset);
    }

    /** Danh sách bước sóng cho vùng/màu (bước 0 là CHÍNH ô trigger — "tâm sóng"). Tách riêng khỏi
     * spawnRegionClearEffect() cùng lý do getLineWaveSteps(). */
    private getRegionWaveSteps(cell: number, region: number): number[][] {
        return [[cell], ...this.regionWaveGroups(region, cell)];
    }

    /** Gộp 2 danh sách bước sóng (hàng/cột + vùng/màu, mỗi cái đã có ô trigger ở bước 0) thành
     * MỘT chuỗi bước DUY NHẤT, chạy CÙNG 1 delay — dùng khi 1 lần đặt mèo hoàn thành CẢ màu LẪN
     * hàng/cột cùng lúc (xem updateLineClearTracking()), để sóng quét CẢ HAI khu vực ĐỒNG THỜI
     * thay vì 2 sóng riêng chạy lần lượt (bug đã báo). Mỗi ô chỉ pulse ĐÚNG 1 LẦN — ô xuất hiện ở
     * CẢ 2 danh sách (ví dụ cùng vừa thuộc vùng vừa nằm trên hàng/cột đó) chỉ tính theo bước XUẤT
     * HIỆN SỚM NHẤT, không pulse lặp lại ở bước sau. */
    private mergeWaveSteps(a: readonly (readonly number[])[], b: readonly (readonly number[])[]): number[][] {
        const seen = new Set<number>();
        const maxLen = Math.max(a.length, b.length);
        const merged: number[][] = [];
        for (let i = 0; i < maxLen; i++) {
            const group: number[] = [];
            for (const source of [a[i], b[i]]) {
                for (const cell of source ?? []) {
                    if (seen.has(cell)) continue;
                    seen.add(cell);
                    group.push(cell);
                }
            }
            merged.push(group);
        }
        return merged;
    }

    /** Thời gian chờ TRƯỚC KHI sóng bắt đầu (kể cả ô trigger) — bằng đúng thời lượng animation
     * đặt mèo/đánh dấu của CHÍNH ô trigger (đọc thẳng từ CellView, luôn khớp dù GD chỉnh lại
     * dogPopUpSeconds/dogPopHoldSeconds/dogPopSettleSeconds hay markPopSeconds) CỘNG THÊM
     * wavePostSettlePauseSeconds (dừng 1 nhịp trước khi sóng chạy) — VÀ đợi thêm cho tới khi
     * animation đặt SAI (tim + X, wrongMarkBusyUntilMs) gần nhất — NẾU CÓ, xảy ra ở 1 ô khác gần
     * như cùng lúc — chạy xong hẳn, tránh sóng của hành động ĐÚNG này chạy đè lên animation đặt sai
     * đang hiện dở ở ô kia. */
    private computeWaveInitialDelay(triggerCell: number, state: CellState, isRegionWave: boolean): number {
        let delay: number;
        // Đặt MÈO: sóng chạy NGAY, không đợi mèo pop-in/đập xuống (sóng scale CẢ Ô, animation đặt mèo
        // scale icon — 2 node khác nhau nên không cắt ngang nhau). Riêng sóng VÙNG MÀU (mèo là ô
        // cuối của màu) dừng waveRegionDogPauseSeconds; sóng hàng/cột do mèo hoàn thành dừng
        // wavePostSettlePauseSeconds.
        if (state === CellState.Dog) {
            delay = isRegionWave ? this.waveRegionDogPauseSeconds : this.wavePostSettlePauseSeconds;
        } else {
            // Mark đã đợi animation và cửa sổ double tap song song trước khi xét Clear.
            delay = 0;
        }

        const wrongMarkRemaining = Math.max(0, (this.wrongMarkBusyUntilMs - Date.now()) / 1000);
        return Math.max(delay, wrongMarkRemaining);
    }

    /**
     * Nhóm các ô trong vùng/màu theo "vòng vuông đồng tâm" — khoảng cách Chebyshev (bàn cờ vua,
     * 8 hướng) tính THẲNG từ ô trigger, quét theo đúng hình vuông lồng nhau (ví dụ bàn 7×7 tâm
     * tại trigger: vòng 1 là "khung" 8 ô sát trigger, vòng 2 là khung 16 ô kế tiếp, vòng 3 là
     * khung ngoài cùng...). Quét TOÀN BỘ ô trong mỗi khung bất kể màu gì — ô KHÔNG cùng màu với
     * vùng đang xét bị LOẠI ra khỏi nhóm trả về (không được pulse), nhưng vẫn được TÍNH vào đúng
     * vòng của nó theo khoảng cách thẳng, KHÔNG loại bỏ bằng BFS liền kề thật (vùng có hình dạng
     * bất kỳ, không cần liên thông trong PHẠM VI 1 vòng — thứ tự sóng luôn theo khoảng cách hình
     * học, giống hệt cách sprite Clear/text hiện tại đang định vị theo toạ độ ô, không theo hình
     * dạng vùng). Mỗi vòng chạy ĐỒNG THỜI (cùng 1 bước sóng, xem playWaveSteps()). KHÔNG gồm
     * chính ô trigger — ô đó đã có animation đặt mèo/đánh dấu RIÊNG (playPlaceEffect), sóng pulse
     * thêm sẽ CẮT NGANG animation đó (cả 2 đều tween icon.node).
     */
    private regionWaveGroups(region: number, triggerCell: number): number[][] {
        const n = this.boardSize;
        const triggerRow = Math.floor(triggerCell / n);
        const triggerCol = triggerCell % n;

        let maxDist = 0;
        const groups = new Map<number, number[]>();
        for (let i = 0; i < this.regions.length; i++) {
            if (this.regions[i] !== region || i === triggerCell) continue;
            const r = Math.floor(i / n);
            const c = i % n;
            const dist = Math.max(Math.abs(r - triggerRow), Math.abs(c - triggerCol));
            maxDist = Math.max(maxDist, dist);
            const group = groups.get(dist);
            if (group) group.push(i);
            else groups.set(dist, [i]);
        }

        // Xét ĐỦ từng vòng liên tiếp 1, 2, 3,... tới maxDist — KHÔNG bỏ hẳn vòng rỗng (không có
        // ô cùng màu) ra khỏi mảng, chỉ trả về mảng RỖNG cho vòng đó (playWaveSteps vẫn cộng đủ
        // waveStaggerSeconds cho bước này dù không pulse ô nào). Nếu bỏ hẳn vòng rỗng, mảng kết
        // quả bị NÉN lại, khiến vòng sau chạy SỚM HƠN đúng nhịp (delay tính theo vị trí trong
        // mảng, không phải theo đúng số thứ tự vòng thật) — sai với yêu cầu "xét từng vòng, vòng
        // nào không cùng màu thì bỏ qua (không scale) RỒI MỚI xét tới vòng kế tiếp".
        const steps: number[][] = [];
        for (let dist = 1; dist <= maxDist; dist++) {
            steps.push(groups.get(dist) ?? []);
        }
        return steps;
    }

    /** Nội suy tuyến tính 1 cặp tốc độ (giây/bước) theo boardSize hiện tại, giữa `slow` (board nhỏ,
     * boardSize <= waveStaggerReferenceMinSize) và `fast` (board lớn, boardSize >=
     * waveStaggerReferenceMaxSize), LUÔN kẹp trong khoảng [fast, slow] — dùng CHUNG 2 mốc boardSize
     * tham chiếu cho cả sóng Clear (computeWaveStaggerSeconds) lẫn sóng chéo thắng màn
     * (computeVictoryWaveStaggerSeconds), chỉ khác cặp tốc độ truyền vào. */
    private interpolateStaggerByBoardSize(fast: number, slow: number): number {
        const minSize = this.waveStaggerReferenceMinSize;
        const maxSize = this.waveStaggerReferenceMaxSize;
        if (maxSize <= minSize) return slow;

        const t = (this.boardSize - minSize) / (maxSize - minSize);
        const clampedT = Math.max(0, Math.min(1, t));
        return slow + (fast - slow) * clampedT;
    }

    /** Tốc độ sóng Clear (giây/bước) phụ thuộc boardSize — board càng nhiều ô sóng càng nhanh (đẹp/
     * rõ như đã tune), board càng ít ô sóng càng chậm lại — tránh sóng chạy vụt qua khó thấy trên
     * board nhỏ (bug đã báo). */
    private computeWaveStaggerSeconds(): number {
        return this.interpolateStaggerByBoardSize(this.waveStaggerSecondsMin, this.waveStaggerSecondsMax);
    }

    /** Tốc độ sóng CHÉO thắng màn (giây/đường chéo) phụ thuộc boardSize — cùng lý do
     * computeWaveStaggerSeconds(), nhưng có cặp tốc độ RIÊNG (victoryWaveStaggerSecondsMin/Max) vì
     * bản chất khác nhau (quét cả bàn 1 lần vs quét từng vùng nhỏ). */
    private computeVictoryWaveStaggerSeconds(): number {
        return this.interpolateStaggerByBoardSize(this.victoryWaveStaggerSecondsMin, this.victoryWaveStaggerSecondsMax);
    }

    /** Chạy TỪNG BƯỚC sóng theo thứ tự, bắt đầu sau `initialDelay` giây (đợi animation đặt mèo/
     * đánh dấu của ô trigger chạy xong + dừng thêm 1 nhịp, xem computeWaveInitialDelay()) — mỗi
     * bước là 1 nhóm ô pulse ĐỒNG THỜI (mảng 1 phần tử cho hàng/cột, nhiều phần tử cho vùng/màu —
     * xem lineWaveOrder()/regionWaveGroups()), cách bước kế computeWaveStaggerSeconds() (phụ thuộc
     * boardSize). Tự bỏ qua nếu board dựng lại/restart giữa chừng (so khớp waveGeneration — tránh
     * pulse nhầm ô đã bị pool tái sử dụng cho puzzle mới). */
    private playWaveSteps(
        steps: readonly (readonly number[])[],
        initialDelay: number,
        staggerSeconds: number = this.computeWaveStaggerSeconds(),
    ): void {
        if (steps.length === 0) return;
        const generation = this.waveGeneration;
        let delay = initialDelay;
        for (const group of steps) {
            for (const cell of group) {
                if (delay <= 0) this.pulseCellWave(cell, generation);
                else this.scheduleOnce(() => this.pulseCellWave(cell, generation), delay);
            }
            delay += staggerSeconds;
        }
        // Nhớ thời điểm sóng cuối cùng pulse XONG (bước cuối bắt đầu ở delay - stagger, mỗi pulse
        // kéo dài 2*wavePopSeconds) — sóng chéo thắng màn đợi tới sau mốc này.
        const endMs = Date.now() + (delay - staggerSeconds + this.wavePopSeconds * 2) * 1000;
        this.waveEffectsEndMs = Math.max(this.waveEffectsEndMs, endMs);
    }

    private pulseCellWave(cell: number, generation: number): void {
        if (generation !== this.waveGeneration) return;
        // Bước sóng này được LÊN LỊCH từ TRƯỚC (scheduleOnce trong playWaveSteps) — nếu người chơi
        // vừa đặt SAI vào đúng ô này ngay trong lúc sóng còn đang quét dở (trước khi tới lượt ô
        // này), ô đã đổi sang WrongMark rồi nhưng bước sóng cũ vẫn cứ chạy đúng giờ đã định, tạo
        // cảm giác "đặt sai vẫn kích hoạt sóng" (bug đã báo). Bỏ qua bước sóng nếu ô đã KHÔNG còn ở
        // trạng thái hợp lệ để ăn mừng nữa.
        const remaining = (this.wrongMarkBusyUntilMs - Date.now()) / 1000;
        if (remaining > 0) {
            this.scheduleOnce(() => this.pulseCellWave(cell, generation), remaining);
            return;
        }
        this.activeCells[cell]?.playWaveVisit(
            this.waveSpriteFrame,
            this.wavePeakScale,
            this.wavePopSeconds,
            this.waveHoldSeconds,
            this.waveFadeSeconds,
            this.waveOverlaySizeRatio,
        );
    }

    /**
     * Dựng + chạy hiệu ứng sprite "Clear" tại toạ độ CỤC BỘ (theo board) đã cho — dùng CHUNG cho
     * cả Clear hàng/cột (spawnLineClearEffect) lẫn Clear vùng/màu (spawnRegionClearEffect). PARENT
     * vào praiseEffectsLayer (convert sang world-space) giống hệt spawnEmojiEffect()/
     * spawnPraiseEffect() — KHÔNG còn làm con dogLayer/cellContainer nữa: layer đó nằm ở cấp CAO
     * HƠN CẢ Board lẫn RuleFrame/HUD trong cây scene, luôn nổi trên cùng, không phụ thuộc sibling
     * index của Board so với các node khác cùng cấp (RuleFrame, panel khác...) hay các hiệu ứng
     * khác được spawn SAU đè lên nó nữa.
     */
    private playClearEffectAt(localX: number, localY: number): void {
        if (!this.lineClearSpriteFrame) return;

        const boardTransform = this.getComponent(UITransform);
        if (!boardTransform) return;

        const layer = this.praiseEffectsLayer ?? this.dogLayer ?? this.cellContainer;

        const node = this.acquireLineClearNode();
        node.parent = layer;
        node.setSiblingIndex(-1);

        const sprite = node.getComponent(Sprite)!;
        sprite.spriteFrame = this.lineClearSpriteFrame;

        const opacity = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        opacity.opacity = 0;
        const fromScale = new Vec3(0.3, 0.3, 1);
        node.setScale(fromScale);
        BoardView.TEMP_VEC3.set(localX, localY, 0);
        node.setWorldPosition(boardTransform.convertToWorldSpaceAR(BoardView.TEMP_VEC3));

        tween(node)
            .to(this.lineClearPopInSeconds, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .delay(this.lineClearHoldSeconds)
            .to(this.lineClearFadeOutSeconds, { scale: fromScale }, { easing: 'quadIn' })
            .call(() => this.recycleLineClearNode(node))
            .start();

        tween(opacity)
            .to(this.lineClearPopInSeconds, { opacity: 255 })
            .delay(this.lineClearHoldSeconds)
            .to(this.lineClearFadeOutSeconds, { opacity: 0 })
            .start();
    }

    private acquireLineClearNode(): Node {
        const pooled = this.lineClearPool.size() > 0 ? this.lineClearPool.get() : null;
        if (pooled) return pooled;

        const node = new Node('LineClearEffect');
        node.layer = this.node.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(this.lineClearSize, this.lineClearSize);
        node.addComponent(UIOpacity);
        node.addComponent(Sprite);
        return node;
    }

    private recycleLineClearNode(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.lineClearPool.put(node);
    }

    private onPuzzleSolved = (): void => {
        this.clearPress();

        // Chạy NGAY LẬP TỨC (không còn đợi dogAppearDuration) — mọi con mèo KHÁC phải nổi lên
        // ĐỒNG THỜI với animation đặt mèo TỰ NHIÊN của chính con mèo CUỐI CÙNG vừa đặt (đang chạy
        // dở đúng lúc này, kích hoạt bởi CELL_CHANGED_EVENT trước PUZZLE_SOLVED_EVENT một nhịp rất
        // ngắn trong cùng lệnh gọi đồng bộ — xem PuzzleSession.handlePlaceDogAttempt()), KHÔNG phải
        // đợi mèo cuối "nổi" xong rồi các mèo khác mới nổi lên sau. dogAppearDuration vẫn giữ
        // nguyên vai trò CŨ — chỉ còn quyết định lúc nào Result popup mở ra (UIManager.
        // resolveResultPopupDelay), không còn liên quan gì tới thời điểm celebrateDogs() nữa.
        this.unschedule(this.celebrateDogs);
        this.celebrateDogs();

        if (!this.isTutorial) {
            // Đợi hết chuỗi tự đánh dấu ô (GameplayScreen: pause → hiện X → settle → đốm sáng
            // rải + bay tới điểm) VÀ sóng Clear cuối cùng, rồi dừng thêm victoryWavePauseSeconds.
            const autoMarkChain =
                GameConfig.autoMarkPauseSeconds +
                GameConfig.autoMarkRevealSettleSeconds +
                GameConfig.autoMarkSparkSpreadSeconds +
                GameConfig.autoMarkSparkFlightSeconds;
            const waveRemaining = Math.max(0, (this.waveEffectsEndMs - Date.now()) / 1000);
            const delay = Math.max(autoMarkChain, waveRemaining) + this.victoryWavePauseSeconds;

            const generation = this.waveGeneration;
            this.scheduleOnce(() => {
                if (generation === this.waveGeneration) this.playVictoryWave();
            }, delay);
        }
    };

    /** Sóng CHÉO chúc mừng thắng màn: bắt đầu từ ô góc DƯỚI-TRÁI, quét từng đường chéo (các ô cùng
     * đường chéo pulse đồng thời) tới ô góc TRÊN-PHẢI — toàn bộ ô, không lọc màu. Đường chéo thứ
     * d = col + (n-1-row): dưới-trái d=0, trên-phải d=2(n-1). Dùng lại playWaveSteps() (cùng
     * pulse/khoảng cách waveStaggerSeconds với sóng Clear), initialDelay=0 vì đã đợi ở caller. */
    private playVictoryWave(): void {
        const remaining = (this.waveEffectsEndMs - Date.now()) / 1000;
        if (remaining > 0) {
            const generation = this.waveGeneration;
            this.scheduleOnce(() => {
                if (generation === this.waveGeneration) this.playVictoryWave();
            }, remaining);
            return;
        }
        const n = this.boardSize;
        if (n <= 0) return;

        const steps: number[][] = [];
        for (let d = 0; d <= 2 * (n - 1); d++) steps.push([]);
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                steps[col + (n - 1 - row)]!.push(row * n + col);
            }
        }
        const staggerSeconds = this.computeVictoryWaveStaggerSeconds();
        this.playWaveSteps(steps, 0, staggerSeconds);

        // Báo sóng đã chạy XONG (bước cuối bắt đầu ở (số bước-1)*stagger, pulse kéo dài 2*wavePop)
        // — GameplayScreen dùng làm mốc cho hiệu ứng tim bay (event-driven, không gọi thẳng nhau).
        const generation = this.waveGeneration;
        const finishSeconds = (steps.length - 1) * staggerSeconds + this.wavePopSeconds * 2;
        this.scheduleOnce(() => {
            if (generation === this.waveGeneration) EventManager.instance.emit(VICTORY_WAVE_FINISHED_EVENT, undefined);
        }, finishSeconds);
    }

    /** Hiện dấu X (CellState.Mark) trên các ô được PuzzleSession tự động đánh dấu lúc thắng màn
     * (xem AUTO_MARK_APPLIED_EVENT/PuzzleSession.autoMarkRemainingCells) — gọi từ GameplayScreen,
     * KHÔNG phải phản ứng CELL_CHANGED_EVENT thông thường (event đó CỐ TÌNH không bắn cho các ô
     * này, để GameplayScreen tự chọn thời điểm hiện qua hàm này). Dùng lại animation pop-in có
     * sẵn của CellView (setState(..., true)) — cùng hiệu ứng người chơi tự đánh dấu X. */
    revealAutoMarkedCells(cells: readonly number[], onComplete?: () => void): void {
        const generation = this.waveGeneration;
        let cursor = 0;
        const reveal = () => {
            if (generation !== this.waveGeneration) {
                this.unschedule(reveal);
                return;
            }
            // Một callback mỗi frame, tối đa 6 Skeleton; không chạy bù nhiều timer cùng lúc.
            const end = Math.min(cursor + 6, cells.length);
            for (; cursor < end; cursor++) this.activeCells[cells[cursor]]?.setState(CellState.Mark, true);
            const tail = GameConfig.autoMarkRevealSettleSeconds + GameConfig.autoMarkSparkSpreadSeconds
                + GameConfig.autoMarkSparkFlightSeconds + this.victoryWavePauseSeconds;
            this.waveEffectsEndMs = Math.max(this.waveEffectsEndMs, Date.now() + tail * 1000);
            if (cursor >= cells.length) {
                this.unschedule(reveal);
                onComplete?.();
            }
        };
        this.schedule(reveal, 0);
    }

    private celebrateDogs = (): void => {
        this.playDogEmotion('celebrate');
    };

    private onPuzzleFailed = (): void => {
        this.playDogEmotion('cry');
        this.clearPress();
    };

 
    private playDogEmotion(emotion: 'frustrated' | 'cry' | 'celebrate'): void {
        for (const cell of this.activeCells) {
            switch (emotion) {
                case 'frustrated':
                    cell.playDogFrustrated();
                    break;
                case 'cry':
                    cell.playDogCry();
                    break;
                case 'celebrate':
                    // playDogCelebrate() CHỈ chạy khi có Spine thật (dự án hiện dùng sprite chó
                    // TĨNH, dogSpinePrefab để trống — xem CellView.ensureRealDogSpine()), tức LUÔN
                    // no-op trong cấu hình hiện tại. Dùng lại chính hiệu ứng "vừa đặt mèo" (phồng
                    // to → đập xuống + particle) áp ĐỒNG THỜI lên MỌI ô đang có mèo — cùng lúc, một
                    // lượt duy nhất — thay vì im lặng không hiện gì. Lịch chạy (dogAppearDuration)
                    // và các hiệu ứng khác (auto-mark, sóng Clear, sóng thắng màn...) giữ NGUYÊN,
                    // không đổi gì — chỉ đổi NỘI DUNG của celebrateDogs().
                    // Mèo cuối đang chạy chính animation đặt, giữ cả callback onSettled của nó.
                    if (cell.cellIndex !== this.lastPlacedDogCell) cell.replayPlaceDogEffect();
                    break;
            }
        }
    }


    private onBoardRestarted = (payload: BoardRestartedEventPayload): void => {
        for (let i = 0; i < payload.cellStates.length && i < this.activeCells.length; i++) {
            this.activeCells[i].setState(payload.cellStates[i], false);
        }

        // Restart đi thẳng qua setState() từng ô ở trên, KHÔNG bắn CELL_CHANGED_EVENT (không qua
        // updateLineClearTracking()) — đồng bộ lại mirror + xoá sạch cờ "đã hiện Clear" thủ công ở
        // đây, để hàng/cột nào vừa bị xoá về Empty có thể hiện lại hiệu ứng đúng lúc clear lần sau.
        this.cellStates = payload.cellStates.slice();
        this.clearedRows.clear();
        this.clearedCols.clear();
        this.clearedRegions.clear();
        this.misplacedMarkCells.clear();
        this.dogCleanupTimers.clear();
        this.waveGeneration++;
    };

    /**
     * Người chơi vừa bấm "sang màn tiếp theo" (từ popup Result, đang ĐÈ LÊN chính board
     * này — state vẫn là Gameplay nên GameplayScreen/BoardView KHÔNG bị huỷ/dựng lại) —
     * dọn board CŨ ngay lập tức tại đây, KHÔNG đợi tới khi puzzle mới load xong (bất đồng
     * bộ) mới dọn+dựng dồn vào 1 lúc. Board cũ (đã giải xong) trước đây cứ đứng yên hiển
     * thị suốt thời gian load rồi mới đột ngột đổi hết — giờ biến mất NGAY khi bấm.
     */
    private onLevelSelected = (): void => {
        this.releaseAllCells();
    };

    private onTouchStart(event: EventTouch): void {
        this.resetGesture();
        if (!this.canInteract()) return;

        const cell = this.cellAt(event);
        event.getUILocation(this.touchStartPos);

        if (DEBUG_TOUCH) {
            const session = PuzzleSessionHolder.current;
            console.log(
                `[BoardView] touch → ô ${cell} | ` +
                    `session=${session ? session.state : 'NULL'} | cellSize=${this.cellSize}`,
            );
        }

        if (cell < 0) return;
        if (!this.isAllowed(cell)) return;

        this.touchStartCell = cell;
     
        this.touchStartState = this.stateOf(cell);

        this.setPress(cell);

        const now = Date.now() / 1000;
        const isDoubleTap =
            cell === this.lastTapCell &&
            now - this.lastTapTime <= GameConfig.doubleTapThresholdSeconds;

        if (isDoubleTap) {
            this.lastTapCell = -1; 
            this.tapConsumed = true;
            this.dispatch({ type: IntentType.PlaceDogAttempt, cell });
            return;
        }

        this.lastTapCell = cell;
        this.lastTapTime = now;
    }

    private onTouchMove(event: EventTouch): void {
        if (this.tapConsumed || this.touchStartCell < 0) return;
        if (!this.canInteract()) return;

        if (!this.isDragging) {
            const moved = Vec2.distance(
                event.getUILocation(BoardView.TEMP_VEC2),
                this.touchStartPos,
            );
            if (moved < GameConfig.dragThresholdPixels) return;

            this.beginDrag();
        }

        const cell = this.cellAt(event);
        if (cell < 0 || cell === this.lastDragCell) return;

 
        this.markCellsBetween(this.lastDragCell, cell);
        this.lastDragCell = cell;

   
        this.setPress(cell);
    }

  
    private beginDrag(): void {
        this.isDragging = true;
        this.dragMode = this.touchStartState === CellState.Mark ? 'erase' : 'mark';

        this.draggedCells.length = 0;
        this.lastDragCell = -1;


        this.markCellsBetween(-1, this.touchStartCell);
        this.lastDragCell = this.touchStartCell;
    }

 
    private markCellsBetween(from: number, to: number): void {
        const n = this.boardSize;
        const newCells: number[] = [];

        const addCell = (cell: number): void => {
            if (cell < 0 || this.draggedCells.indexOf(cell) >= 0) return;
        
            if (!this.isAllowed(cell)) return;
            this.draggedCells.push(cell);
            newCells.push(cell);
        };

        if (from < 0) {
            addCell(to);
        } else {
            const r0 = Math.floor(from / n);
            const c0 = from % n;
            const r1 = Math.floor(to / n);
            const c1 = to % n;

            const steps = Math.max(Math.abs(r1 - r0), Math.abs(c1 - c0));
            for (let i = 1; i <= steps; i++) {
                const r = Math.round(r0 + ((r1 - r0) * i) / steps);
                const c = Math.round(c0 + ((c1 - c0) * i) / steps);
                addCell(r * n + c);
            }
        }

        if (newCells.length === 0) return;

        this.dispatch({ type: IntentType.DragMark, cells: newCells, mode: this.dragMode });
    }

    private onTouchEnd(event: EventTouch): void {
        if (this.tapConsumed || this.isDragging) {
           
            this.resetGesture();
            return;
        }

     
        if (this.touchStartCell >= 0 && this.canInteract()) {
            const cell = this.cellAt(event);
            if (cell === this.touchStartCell) {
                this.dispatch({ type: IntentType.ToggleMark, cell });
            }
        }

        this.resetGesture();
    }

    private onTouchCancel(): void {
        this.resetGesture();
    }

    private resetGesture(): void {
        this.isDragging = false;
        this.tapConsumed = false;
        this.touchStartCell = -1;
        this.touchStartState = CellState.Empty;
        this.lastDragCell = -1;
        this.draggedCells.length = 0;
        this.clearPress();
    }


    private setPress(cell: number): void {
        if (this.pressedCell === cell) return;

        this.clearPress();
        this.activeCells[cell]?.setPressed(true);
        this.pressedCell = cell;
    }

    private clearPress(): void {
        if (this.pressedCell < 0) return;

        this.activeCells[this.pressedCell]?.setPressed(false);
        this.pressedCell = -1;
    }

    private stateOf(cell: number): CellState {
        const session = PuzzleSessionHolder.current;
        return session ? session.cellStates[cell] : CellState.Empty;
    }


    private cellAt(event: EventTouch): number {
        const transform = this.getComponent(UITransform);
        if (!transform || this.cellSize <= 0) return -1;

        const ui = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(
            BoardView.TEMP_VEC3.set(ui.x, ui.y, 0),
        );

        const half = (this.boardSize * this.cellSize) / 2;
        const col = Math.floor((local.x + half) / this.cellSize);
        const row = Math.floor((half - local.y) / this.cellSize);

        if (row < 0 || row >= this.boardSize || col < 0 || col >= this.boardSize) return -1;
        return row * this.boardSize + col;
    }

 
    private canInteract(): boolean {
        const session = PuzzleSessionHolder.current;
        if (!session) return false;

        return session.state === PuzzleState.Ready || session.state === PuzzleState.Playing;
    }

    private dispatch(intent: PuzzleIntent): void {
        const session = PuzzleSessionHolder.current;
        if (session) session.dispatch(intent);
    }
}
