import {
    _decorator,
    Button,
    Color,
    Component,
    Graphics,
    Label,
    Node,
    Prefab,
    RichText,
    Tween,
    UIOpacity,
    UITransform,
    Vec2,
    Vec3,
    instantiate,
    isValid,
    sp,
    tween,
    warn,
} from 'cc';
import { GameSession } from '../../application/session/gameSession';
import { GamePhase, GameSnapshot } from '../../application/contracts/gameSnapshot';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { Direction } from '../../domain/board/direction';
import { directionBetween } from '../../domain/board/adjacency';
import { ConnectTracksBoardView } from '../../presentation/board/connectTracksBoardView';
import { ConnectTracksVictoryView } from '../../presentation/board/connectTracksVictoryView';
import { ConnectTracksTrainView } from '../../presentation/board/connectTracksTrainView';
import { ConnectTracksHintView } from '../../presentation/board/connectTracksHintView';
import { CocosPointerInput } from '../../presentation/input/cocosPointerInput';
import { PlayerGesture } from '../../presentation/input/gestureCommandMapper';
import { buildTrainPolyline, poseAtDistance, polylineLength, Point } from '../../presentation/board/trainPath';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { CONNECT_TRACKS_TUTORIAL_LEVEL, CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS } from './connectTracksTutorialLevel';
import { AudioManager } from '../../manager/AudioManager';

const { ccclass, property } = _decorator;

/** Required cells in scripted (not reading) order, per the user's step script: 1, 9, 14 are each
 * double-tapped in their own dedicated step; 10 is left for the player to find unaided. */
const DOUBLE_TAP_STEP_CELLS = [1, 9, 14];
/** Row 0's 2 non-solution cells (single-tap-only exclusion step). */
const EXCLUDE_ROW_CELLS = [2, 3];
/** Column 0's 3 non-solution cells (single-tap-only exclusion step, hand auto-sweeps). */
const EXCLUDE_COLUMN_CELLS = [4, 8, 12];

enum Step {
    Idle,
    Intro,
    LiftRow,
    LiftColumn,
    ShowSolutionPreview,
    DoubleTap1,
    DoubleTap2,
    DoubleTap3,
    ExcludeRow,
    ExcludeColumn,
    FindRemaining,
}

/**
 * ConnectTracks guided tutorial — a from-scratch component (confirmed by the user: mirrors the
 * legacy Dogdoku TutorialController's FLOW — linear steps, mostly auto-advance on player action
 * plus one manual "Next" button early on, gated interaction per step — not its code, since this
 * drives the ConnectTracks stack (GameSession/ConnectTracksBoardView/CocosPointerInput), not the
 * old BoardView/CellView). Owns its own fixed tutorial GameSession (tutorialMode: true) — never
 * touches the real connectTracksSession/progress/charges.
 */
@ccclass('ConnectTracksTutorialController')
export class ConnectTracksTutorialController extends Component {
    @property({ type: ConnectTracksBoardView, tooltip: 'CÙNG instance ConnectTracksBoardView mà GameplayScreen dùng cho gameplay thật — tutorial tạm thời chiếm dụng nó trong lúc chạy.' })
    private board: ConnectTracksBoardView | null = null;

    @property({ type: CocosPointerInput, tooltip: 'CÙNG instance CocosPointerInput (gắn trên cùng node với board ở trên) mà GameplayScreen dùng cho gameplay thật.' })
    private input: CocosPointerInput | null = null;

    @property({ type: ConnectTracksVictoryView, tooltip: 'CÙNG instance ConnectTracksVictoryView mà GameplayScreen dùng — tái dùng NGUYÊN luồng thắng thật ở bước cuối.' })
    private victory: ConnectTracksVictoryView | null = null;

    /** Scale GỐC của board.node TRƯỚC khi tutorial nhân thêm boardScaleOverride — chụp lại trong
     * begin() để cancel() trả lại đúng, tránh rò rỉ sang level thật tiếp theo. */
    private boardOriginalScale: Vec3 | null = null;

    /** Vị trí GỐC của board.node TRƯỚC khi tutorial cộng thêm boardOffsetOverride — chụp lại trong
     * begin() để cancel() trả lại đúng, tránh rò rỉ sang level thật tiếp theo. */
    private boardOriginalPosition: Vec3 | null = null;

    @property({ type: ConnectTracksTrainView, tooltip: 'CÙNG instance ConnectTracksTrainView (tàu thắng thật) mà board dùng — tutorial tự chỉnh scale/tốc độ RIÊNG cho board 4x4 nhỏ qua 2 property bên dưới, rồi trả lại mặc định khi xong.' })
    private trainView: ConnectTracksTrainView | null = null;

    @property({ min: 0.01, tooltip: 'Hệ số nhân THÊM vào kích thước tàu đã cấu hình trong Editor (trainSizeMultiplier) — RIÊNG cho màn tutorial. 1 = giữ nguyên như gameplay thật.' })
    private trainScaleOverride = 1;

    @property({ min: 0.01, tooltip: 'Hệ số nhân THÊM vào tốc độ tàu đã tính (min/maxSpeedPxPerSecond) — RIÊNG cho màn tutorial. 1 = giữ nguyên như gameplay thật.' })
    private trainSpeedOverride = 1;

    @property({ min: 0.01, tooltip: 'Hệ số nhân THÊM vào scale hiện tại của board (board.node) — RIÊNG cho màn tutorial, trả lại scale cũ khi thoát tutorial. 1 = giữ nguyên như gameplay thật.' })
    private boardScaleOverride = 1;

    @property({
        type: Vec3,
        tooltip:
            'Lệch vị trí (x/y, đơn vị local của board.node.parent) CỘNG THÊM vào vị trí hiện tại ' +
            'của board — RIÊNG cho màn tutorial, trả lại đúng vị trí cũ khi thoát tutorial. (0,0) = ' +
            'giữ nguyên như gameplay thật.',
    })
    private boardOffsetOverride: Vec3 = new Vec3(0, 0, 0);

    @property({ type: RichText, tooltip: 'RichText khung hướng dẫn — dùng RichText (không phải Label) vì text có chèn BBCode <color=#..> để tô đúng từ khoá.' })
    private textLabel: RichText | null = null;

    @property({ type: Node, tooltip: 'Node khung hướng dẫn (cha của textLabel).' })
    private textPanel: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Node THỰC SỰ được scale khi người chơi chạm ra ngoài khu vực được phép (phóng to rồi ' +
            'hơi lún xuống rồi về scale gốc 1 nhịp). Để TRỐNG thì dùng luôn textPanel ở trên. Nếu nút ' +
            '"Tiếp theo" đang là CON của textPanel, PHẢI gán 1 node con KHÁC của textPanel vào đây ' +
            '(gồm nền + chữ, KHÔNG bao gồm nút) — nếu không, scale của textPanel sẽ kéo theo scale ' +
            'của nút (xác nhận từ user: nút không được bị nhấp nháy theo).',
    })
    private textPanelBlinkTarget: Node | null = null;

    @property({ type: Button, tooltip: 'Nút "Tiếp theo"/"Thử ngay" — ẩn hẳn từ bước double-tap đầu tiên trở đi (xác nhận từ user). Tự nhấp nháy scale liên tục (2 property bên dưới) suốt lúc đang hiện.' })
    private nextButton: Button | null = null;

    @property({ type: Label, tooltip: 'Label TRÊN nút ở trên — đổi chữ "Tiếp theo" -> "Thử ngay" ở bước hiện preview lời giải.' })
    private nextButtonLabel: Label | null = null;

    @property({ min: 0.01, tooltip: 'Thời gian (giây) MỖI CHIỀU của 1 nhịp nhấp nháy scale nút Tiếp theo/Thử ngay (to lên rồi về lại = 2 lần giá trị này).' })
    private nextButtonBlinkSpeed = 0.5;

    @property({ min: 1, tooltip: 'Scale TO NHẤT của nút lúc nhấp nháy (1 = không đổi gì).' })
    private nextButtonBlinkScale = 1.08;

    @property({
        min: 0,
        tooltip:
            'Độ RỘNG (px, tuyệt đối) của highlight khi dùng ở bước cần trải NGANG qua nhiều ô (vd ' +
            'bước loại trừ hàng). KHÔNG còn tính theo số ô nữa — nhập thẳng px thực tế cần, vì node ' +
            'highlight nằm trong Cell.prefab, mỗi ô 1 bản, kích thước tự thân mỗi bản có thể khác ' +
            'nhau nên không thể suy từ cellSize.',
    })
    private highlightSpanWidthPx = 300;

    @property({
        min: 0,
        tooltip: 'Độ CAO (px, tuyệt đối) của highlight khi dùng ở bước cần trải DỌC qua nhiều ô (vd bước loại trừ cột). Cùng vai trò với highlightSpanWidthPx ở trên.',
    })
    private highlightSpanHeightPx = 300;

    @property({
        type: Vec2,
        tooltip:
            'Lệch thêm (px, local TRONG Cell.prefab của ô neo) cho highlight khi trải NGANG qua ' +
            'nhiều ô — vì vùng 3 ô không có tâm trùng với tâm ô neo, cần dịch thủ công cho đúng vị ' +
            'trí. Chỉ áp dụng ở bước loại trừ hàng.',
    })
    private highlightSpanWidthOffset: Vec2 = new Vec2(0, 0);

    @property({
        type: Vec2,
        tooltip: 'Lệch thêm cho highlight khi trải DỌC qua nhiều ô — cùng vai trò với highlightSpanWidthOffset ở trên, áp dụng ở bước loại trừ cột.',
    })
    private highlightSpanHeightOffset: Vec2 = new Vec2(0, 0);

    @property({ type: Prefab, tooltip: 'Prefab 1 dấu gạch ngang xanh (dash) — code tự spawn nhiều bản, cho chạy dọc theo đường ray liên tục tạo hiệu ứng nét đứt.' })
    private dashPrefab: Prefab | null = null;

    @property({ min: 0.01, tooltip: 'Khoảng cách (đơn vị board) giữa 2 dash liên tiếp trên đường nét đứt.' })
    private dashSpacing = 40;

    @property({ min: 1, tooltip: 'Tốc độ (đơn vị board/giây) dash di chuyển dọc đường ray ở bước cuối.' })
    private dashSpeed = 220;

    @property({ min: 1, tooltip: 'Tốc độ (đơn vị board/giây) RIÊNG của tay khi trượt dọc đường ray ở bước cuối — tách khỏi dashSpeed vì tay/dash có thể cần tốc độ khác nhau.' })
    private handSpeed = 220;

    @property({ min: 1, tooltip: 'Tốc độ XOAY (độ/giây) của dash khi rẽ góc — nhỏ hơn thì xoay chậm/mượt hơn, không bị giật hướng đột ngột khi rẽ.' })
    private dashRotationSpeed = 540;

    @property({ type: Node, tooltip: 'Cụm gợi ý RIÊNG của tutorial (nút + label) — hiện từ lúc người chơi đã tự xác định hết các ô required còn lại, KHÔNG tốn lượt Place Track/Hint thật.' })
    private tutorialHintCluster: Node | null = null;

    @property({ type: Label, tooltip: 'Label trên nút gợi ý tutorial ở trên.' })
    private tutorialHintLabel: Label | null = null;

    @property({
        type: Node,
        tooltip:
            'Node label PHỤ hiện CÙNG LÚC với tutorialHintCluster ở trên (xác nhận từ user — thêm ' +
            '1 node label mới, hiện/ẩn đồng bộ với cụm nút gợi ý).',
    })
    private tutorialHintPrompt: Node | null = null;

    @property({
        type: ConnectTracksHintView,
        tooltip:
            'CÙNG instance ConnectTracksHintView mà GameplayScreen dùng cho Hint thật ' +
            '(connectTracksBoosterHint) — xác nhận từ user: nút gợi ý tutorial phải mở ĐÚNG UI xem ' +
            'trước/áp dụng này, không tự áp dụng thẳng như trước nữa (trừ rule A8, vẫn áp thẳng y ' +
            'hệt logic thật — xem GameplayScreen.showConnectTracksBoosterHint).',
    })
    private hintView: ConnectTracksHintView | null = null;

    @property({
        type: Node,
        tooltip:
            'Nền đen mờ che bàn cờ, dùng ở bước 2-3 (nhấc hàng/cột) — PHẢI phủ đúng vùng bàn cờ và ' +
            'nằm DƯỚI textPanel/nextButton (2 cái đó phải luôn bấm được, không bị che). Để trống thì ' +
            'bước 2-3 vẫn chạy nhưng không có hiệu ứng tối nền. Bật/tắt luôn fade bằng opacity, KHÔNG ' +
            'bật/tắt cứng (xác nhận từ user).',
    })
    private dimNode: Node | null = null;

    @property({ min: 0, max: 255, tooltip: 'Độ mờ tối đa của nền đen ở trên khi bật (0-255).' })
    private dimOpacity = 200;

    @property({ min: 0, tooltip: 'Độ dày viền xám quanh vùng ô được nhấc (hàng/cột) ở bước 2-3 — giống hệt viền vùng của Hint. 0 để tắt.' })
    private liftBorderWidth = 3;

    @property({ type: Color, tooltip: 'Màu viền xám quanh vùng ô được nhấc — mặc định giống màu viền của Hint.' })
    private liftBorderColor: Color = new Color(124, 126, 150, 255);


    @property({
        min: 0,
        tooltip:
            'Độ dày line NGĂN CÁCH các ô BÊN TRONG vùng được nhấc (vd giữa ô 1 và ô 2 của hàng đang ' +
            'nhấc) — board gốc không vẽ được line này vì vùng nhấc đã tách khỏi gridGraphics của ' +
            'board (xác nhận từ user: cần vẽ lại, cùng vấn đề với ConnectTracksHintView). 0 để tắt.',
    })
    private cellSeparatorWidth = 2;

    @property({ type: Color, tooltip: 'Màu line ngăn cách ở trên — nên khớp màu line grid thật của board.' })
    private cellSeparatorColor: Color = new Color(255, 255, 255, 160);

    @property({ min: 0.05, tooltip: 'Thời gian (giây) fade opacity khi hiện cả bàn lúc vào tutorial — thay cho hiệu ứng pop/stagger từng ô của gameplay thật.' })
    private boardRevealSeconds = 0.6;

    @property({
        type: Node,
        tooltip:
            'Node "TutorialOverlay" (cùng cấp Board trong GameplayScreen, mặc định TẮT active sẵn ' +
            'trong Editor, xác nhận từ user) — script tự BẬT active + fade opacity 0→255 ĐỒNG THỜI ' +
            'với lúc hiện bàn (revealBoard(), cùng boardRevealSeconds) khi vào tutorial, và tự TẮT ' +
            'hẳn active khi rời tutorial (cancel()) để không ảnh hưởng màn chơi thường.',
    })
    private tutorialOverlayNode: Node | null = null;

    private session: GameSession | null = null;
    private step: Step = Step.Idle;
    /** null = không giới hạn ô nào (free play). */
    private allowedCells: Set<number> | null = null;
    private blockDoubleTap = false;
    private onContinue: (() => void) | null = null;
    /** Snapshot trước lần render gần nhất — diff với snapshot mới để biết phát âm nào (giống hệt
     * GameplayScreen.soundSnapshot cho level thật). Tutorial có GameSession RIÊNG nên không tự
     * được AudioManager.playTrackChanges() gọi tới — phải tự làm, nếu không toàn bộ âm thanh đặt/
     * đổi ray, đánh dấu X, sai, thắng... đều câm trong tutorial (xác nhận từ user: chỉ âm spawn
     * cell/board-enter mới cố ý tắt riêng, còn lại phải giữ y hệt gameplay thật). */
    private soundSnapshot: GameSnapshot | null = null;
    /** GameplayScreen cung cấp (xác nhận từ user: "y hệt với nút ở màn thắng của gameplay") — gọi
     * ĐÚNG lúc tàu chạy xong (victory's "completed" callback), y hệt thời điểm/nội dung real
     * gameplay gọi notifyConnectTracksWon()+set label — tutorial controller không tự biết đủ
     * context/puzzleId thật để tự làm việc này. */
    private onCompleted: (() => void) | null = null;
    private pathOverlay: Node | null = null;
    private dashPool: Node[] = [];
    private dashDistances: number[] = [];
    private dashSpawnTimer = 0;
    private travelingHand = false;
    private travelDistance = 0;
    private travelPolyline: readonly Point[] | null = null;
    /** Khoảng cách dọc polyline ứng với TÂM ô entrance/exit — dash/tay chỉ chạy TRONG khoảng
     * [pathStartDistance, pathEndDistance], khớp đúng vị trí 2 chấm tròn xanh (không chạy ra đoạn
     * off-board mà buildTrainPolyline tự nối thêm cho hiệu ứng tàu thật). */
    private pathStartDistance = 0;
    private pathEndDistance = 0;
    /** Chặn enterSweepDemo() gọi lại nhiều lần — mọi thao tác của người chơi ở free play đều gọi
     * checkStepAdvance(), và sau khi đã xác định đủ 4 ô required, điều kiện "đã xác định đủ" vẫn
     * luôn đúng mãi (không tự tắt), nên nếu không chặn sẽ re-trigger beginPathDemo() mỗi lần render. */
    private sweepDemoStarted = false;
    private excludeSettleCell: number | null = null;
    private dimActive = false;
    private liftLayer: Node | null = null;
    private liftBorderGraphics: Graphics | null = null;
    private lifted: { node: Node; parent: Node; index: number; position: Vec3; scale: Vec3 }[] = [];
    /** Tay Spine — SỐNG TRONG Board.prefab (node con tên "TutorialHand", xác nhận từ user), KHÔNG
     * còn là @property riêng — tra 1 LẦN trong begin() rồi dùng lại, tránh getChildByName mỗi khung
     * hình. Là con trực tiếp của board.node nên tọa độ LOCAL của board (trainPath.ts/getCellWorldPosition
     * sau 1 lần convertToNodeSpaceAR) dùng thẳng được, không cần đổi không gian 2 lần như trước. */
    private handSkeleton: sp.Skeleton | null = null;
    /** Highlight đang hiện (node "TutorialHighlight" thuộc đúng ô neo) — khi hiện, nó được REPARENT
     * tạm ra khỏi chính ô của mình sang `highlightLayer` (xem showHighlight) để không cần đụng tới
     * sibling của BẤT KỲ ô nào (ô neo lẫn ô lân cận) — tránh lặp lại 2 lỗi cũ: (1) đẩy cả ô lên sẽ
     * khiến ô đó đè luôn line/viền board, (2) không đẩy gì cả thì bị ô lân cận đè khi tràn sang. */
    private activeHighlightNode: Node | null = null;
    private highlightOriginal: { parent: Node; index: number; position: Vec3; scale: Vec3 } | null = null;
    private highlightLayer: Node | null = null;
    /** 2 chấm tròn entrance/exit được REPARENT TẠM vào pathOverlay (giống hệt kỹ thuật highlight) —
     * BUG đã sửa (báo lỗi "dash bị đè bởi 2 ô entrance"): trước đây đẩy sibling của CẢ Ô
     * entrance/exit lên trên dash để chấm tròn nổi lên, nhưng việc đó vô tình kéo luôn TRACK GIVEN
     * của chính 2 ô đó lên trên dash theo — không phải lỗi ở ô given giữa (user xác nhận: chỉ 2 ô
     * entrance mới bị). Giờ chỉ reparent RIÊNG chấm tròn, không đụng gì tới ô. */
    private circleOriginal: { node: Node; parent: Node; index: number; position: Vec3; scale: Vec3 }[] = [];

    onLoad(): void {
        this.node.active = false;
    }

    onDestroy(): void {
        this.cancel();
    }

    /** Dừng hẳn giữa chừng nếu GameplayScreen đóng màn trong lúc tutorial đang chạy (ví dụ người
     * chơi bấm Home) — hủy mọi schedule/tween của RIÊNG controller này và nhả input, không đụng
     * tới board/input/victory (GameplayScreen tự lo phần cleanup chung của chúng). */
    cancel(): void {
        this.unschedule(this.excludeSettleCheck);
        this.unscheduleAllCallbacks();
        this.input?.unbind();
        this.step = Step.Idle;
        this.travelingHand = false;
        this.travelPolyline = null;
        this.sweepDemoStarted = false;
        this.hideHand();
        this.hideHighlight();
        this.restoreCircles();
        this.clearLift();
        // BUG đã sửa (báo lỗi của user: "khung text tutorial vẫn hiện đè lên campaign" — VẪN còn
        // sau khi thêm cancel() vào onPuzzleReady): this.node.active=false chỉ ẩn được những node
        // THỰC SỰ là con của this.node — nếu textPanel/nextButton được author ở MỘT nhánh khác của
        // scene (chỉ tham chiếu qua @property, không phải con thật), set active trên this.node
        // không hề lan tới chúng. Tắt THẲNG từng node, không phụ thuộc cấu trúc cha-con thế nào.
        if (this.textPanel && isValid(this.textPanel, true)) {
            Tween.stopAllByTarget(this.textPanel);
            this.textPanel.setScale(1, 1, 1);
            this.textPanel.active = false;
        }
        this.stopButtonBlink();
        if (this.nextButton && isValid(this.nextButton.node, true)) this.nextButton.node.active = false;
        if (this.tutorialHintCluster && isValid(this.tutorialHintCluster, true)) this.tutorialHintCluster.active = false;
        if (this.tutorialHintPrompt && isValid(this.tutorialHintPrompt, true)) this.tutorialHintPrompt.active = false;
        if (this.hintView?.showing) this.hintView.close(false);
        if (this.dimNode && isValid(this.dimNode, true)) {
            const opacity = this.dimNode.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            this.dimNode.active = false;
        }
        this.dimActive = false;
        this.activeHighlightNode = null;
        if (this.board && isValid(this.board.node, true)) {
            const opacity = this.board.node.getComponent(UIOpacity);
            if (opacity) { Tween.stopAllByTarget(opacity); opacity.opacity = 255; }
            // Mọi overlay riêng của tutorial (highlight/mũi tên/chấm tròn) sống TRONG Cell.prefab,
            // các cell instance được tái dùng qua NodePool cho level thật tiếp theo — phải tắt hết,
            // không thì rò rỉ sang gameplay thật (xác nhận từ user).
            this.board.clearTutorialOverlays();
        }
        this.handSkeleton = null;
        this.soundSnapshot = null;
        if (this.tutorialOverlayNode && isValid(this.tutorialOverlayNode, true)) {
            const opacity = this.tutorialOverlayNode.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            this.tutorialOverlayNode.active = false;
        }
        // Trả lại mặc định (1 = không đổi gì) — cùng instance train với gameplay thật.
        this.trainView?.setScaleMultiplierOverride(1);
        this.trainView?.setSpeedMultiplierOverride(1);
        // Trả lại scale GỐC của board — cùng instance board với gameplay thật, không được rò rỉ
        // boardScaleOverride sang level thật tiếp theo.
        if (this.board && isValid(this.board.node, true) && this.boardOriginalScale) {
            this.board.node.setScale(this.boardOriginalScale);
        }
        this.boardOriginalScale = null;
        // Trả lại vị trí GỐC của board — cùng lý do với scale ở trên, không được rò rỉ
        // boardOffsetOverride sang level thật tiếp theo.
        if (this.board && isValid(this.board.node, true) && this.boardOriginalPosition) {
            this.board.node.setPosition(this.boardOriginalPosition);
        }
        this.boardOriginalPosition = null;
        if (isValid(this.node)) this.node.active = false;
    }

    /** Bắt đầu tutorial — chiếm dụng board/input/victory thật cho tới khi xong (xác nhận từ user:
     * giữ nguyên luồng, chỉ thay logic). `onCompleted` = ĐÚNG logic GameplayScreen chạy lúc tàu
     * chạy xong (notifyConnectTracksWon + set label nút tiếp theo) — xác nhận từ user: nút tiếp
     * theo của tutorial phải "y hệt" nút ở màn thắng thật. `onContinue` = hành động "sang màn tiếp
     * theo" thật (GameplayScreen tự biết gọi UIManager.continueConnectTracksWin với context/
     * puzzleId của nó). */
    begin(onCompleted: () => void, onContinue: () => void): void {
        this.node.active = true;
        this.onCompleted = onCompleted;
        // BUG đã sửa (báo lỗi của user — "tut mất khung text"): cancel() giờ tắt THẲNG textPanel/
        // nextButton/tutorialHintCluster (không chỉ dựa vào this.node.active nữa — xem ghi chú ở
        // cancel()) — và onPuzzleReady LUÔN gọi cancel() trước, kể cả lúc MỚI VÀO tutorial lần đầu.
        // Phải bật lại TRỰC TIẾP ở đây, không thể trông chờ enterIntroStep() (nó chỉ set text/nút,
        // không hề đụng tới chính node textPanel).
        if (this.textPanel) this.textPanel.active = true;
        // BUG đã sửa (báo lỗi của user — "code đang nhấc cả bàn lên"): dimNode/liftLayer/textPanel
        // đều là con của CHÍNH node tutorial này, KHÔNG phải con của board.node — nếu node tutorial
        // không được đẩy lên trên board trong cây scene chung, dimNode luôn vẽ SAU board (tức bị
        // board đè hết), nên nền đen chỉ hiện được ở phần ngoài rìa board, không hề che được ô nào.
        this.node.setSiblingIndex(-1);
        this.onContinue = onContinue;
        // Scale/tốc độ tàu RIÊNG cho board 4x4 nhỏ của tutorial (xác nhận từ user) — cùng instance
        // train với gameplay thật, nên phải đặt lại 1 (mặc định, không đổi gì) khi cancel(), tránh
        // rò rỉ sang level thật tiếp theo.
        this.trainView?.setScaleMultiplierOverride(this.trainScaleOverride);
        this.trainView?.setSpeedMultiplierOverride(this.trainSpeedOverride);
        // Scale RIÊNG cho board của tutorial (xác nhận từ user) — chụp lại scale gốc 1 lần rồi nhân
        // thêm boardScaleOverride, cùng kiểu "hệ số nhân thêm" như trainScaleOverride ở trên.
        if (this.board && !this.boardOriginalScale) this.boardOriginalScale = this.board.node.scale.clone();
        if (this.board && this.boardOriginalScale) {
            const s = this.boardOriginalScale;
            this.board.node.setScale(s.x * this.boardScaleOverride, s.y * this.boardScaleOverride, s.z);
        }
        // Lệch vị trí RIÊNG cho board của tutorial (xác nhận từ user) — chụp lại vị trí gốc 1 lần
        // rồi cộng thêm boardOffsetOverride, cùng kiểu "chụp gốc rồi áp override" như scale ở trên.
        if (this.board && !this.boardOriginalPosition) this.boardOriginalPosition = this.board.node.position.clone();
        if (this.board && this.boardOriginalPosition) {
            const p = this.boardOriginalPosition;
            const o = this.boardOffsetOverride;
            this.board.node.setPosition(p.x + o.x, p.y + o.y, p.z + o.z);
        }
        this.session = new GameSession({
            level: CONNECT_TRACKS_TUTORIAL_LEVEL,
            requiredCells: CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS,
            tutorialMode: true,
        });
        this.board?.prepareLevelSpawn();
        this.board?.setVictoryControlled(true);
        this.board?.setWonHandler(null);
        this.board?.setSelectedCellChangedHandler(null);
        this.input?.bind(this.session, () => this.onRedraw(), this.board!, undefined,
            { canDispatch: this.canDispatch, disableOptionsMenu: true });
        // Tay Spine giờ sống TRONG Board.prefab (node con "TutorialHand", xác nhận từ user) — tra 1
        // LẦN ở đây, dùng lại suốt phiên tutorial thay vì getChildByName mỗi lần cần.
        this.handSkeleton = this.board?.getTutorialHandNode()?.getComponent(sp.Skeleton) ?? null;
        if (this.handSkeleton) this.handSkeleton.node.active = false;
        if (this.tutorialHintCluster) this.tutorialHintCluster.active = false;
        if (this.tutorialHintPrompt) this.tutorialHintPrompt.active = false;
        if (this.dimNode) this.dimNode.active = false;
        this.dimActive = false;
        this.sweepDemoStarted = false;
        this.activeHighlightNode = null;
        this.lifted = [];
        // Overlay riêng của tutorial (highlight/mũi tên/chấm tròn) giờ sống SẴN trong Cell.prefab
        // của từng ô — dọn sạch trạng thái active còn sót lại từ lần tutorial TRƯỚC (cell instance
        // tái dùng qua NodePool, xác nhận từ user).
        this.board?.clearTutorialOverlays();
        // Tutorial không dùng hiệu ứng pop/stagger từng ô của gameplay thật — toàn bộ ô được tạo
        // SẴN, hiện lên 1 lần bằng opacity (xác nhận từ user).
        this.board?.setInstantSpawn(true);
        // Mốc so sánh ban đầu — không phát âm (chưa có gì để diff, giống hệt soundSnapshot=null lúc
        // GameplayScreen mới vào level thật).
        this.soundSnapshot = this.session.snapshot();
        this.board?.render(this.soundSnapshot);
        this.revealBoard();
        this.showEntranceExitArrows();
        this.enterIntroStep();
    }

    private revealBoard(): void {
        const node = this.board?.node;
        if (!node) return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(this.boardRevealSeconds, { opacity: 255 }).start();
        this.revealTutorialOverlay();
    }

    /** "Tắt mặc định node tut overlay, code mở nó khi làm màn tut và tắt khi là màn thường, hiệu
     * ứng hiện lên là opacity đồng thời với khi tạo board ở tut" (xác nhận từ user) — cùng
     * boardRevealSeconds, cùng lúc gọi với revealBoard(). */
    private revealTutorialOverlay(): void {
        const node = this.tutorialOverlayNode;
        if (!node) return;
        node.active = true;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(this.boardRevealSeconds, { opacity: 255 }).start();
    }

    /** Hiện 2 mũi tên xanh tại ô entrance/exit — giờ là node con SẴN CÓ trong CHÍNH Cell.prefab
     * của đúng 2 ô đó ("TutorialEntranceArrow"/"TutorialExitArrow", xác nhận từ user), nên không
     * cần tự tính toạ độ nữa — chỉ bật active (đã nằm đúng vị trí do được tác giả đặt sẵn trong
     * Editor, theo ô mà nó thuộc về). */
    private showEntranceExitArrows(): void {
        const board = this.board;
        const snapshot = this.session?.snapshot();
        if (!board || !snapshot) return;
        const entranceArrow = board.getTutorialCellOverlay(snapshot.entranceCell, 'TutorialEntranceArrow');
        const exitArrow = board.getTutorialCellOverlay(snapshot.exitCell, 'TutorialExitArrow');
        if (entranceArrow) entranceArrow.active = true;
        if (exitArrow) exitArrow.active = true;
    }

    private hideEntranceExitArrows(): void {
        const board = this.board;
        const snapshot = this.session?.snapshot();
        if (!board || !snapshot) return;
        const entranceArrow = board.getTutorialCellOverlay(snapshot.entranceCell, 'TutorialEntranceArrow');
        const exitArrow = board.getTutorialCellOverlay(snapshot.exitCell, 'TutorialExitArrow');
        if (entranceArrow) entranceArrow.active = false;
        if (exitArrow) exitArrow.active = false;
    }

    // ---- Gesture gating -----------------------------------------------------------------------

    /** 1 lần kéo LIÊN TỤC bắn RIÊNG 1 'trackDragBegin' + NHIỀU 'trackBoundaryStep' (1 cái/ô đi
     * qua) — nếu không chặn, mỗi ô ngoài vùng cho phép trong CÙNG 1 lần kéo sẽ tự kích nhấp nháy
     * lần lượt, trông như "kéo qua ô nào cũng nháy" (báo lỗi của user). Giới hạn CHỈ 1 lần nhấp
     * nháy cho CẢ lần kéo, reset đúng lúc 'trackDragBegin' (bắt đầu lần kéo MỚI). Tap/double tap/
     * batch (emptyDragBatch/xDragBatch) đã là 1 cử chỉ trọn vẹn — không cần giới hạn gì thêm. */
    private dragBlinkedOnce = false;

    private readonly canDispatch = (gesture: PlayerGesture): boolean => {
        if (gesture.kind === 'trackDragBegin') this.dragBlinkedOnce = false;
        const isDragStep = gesture.kind === 'trackDragBegin' || gesture.kind === 'trackBoundaryStep';
        if (this.allowedCells) {
            for (const cell of cellsOfGesture(gesture)) {
                if (!this.allowedCells.has(cell)) {
                    if (isDragStep) {
                        if (!this.dragBlinkedOnce) {
                            this.dragBlinkedOnce = true;
                            this.blinkTextPanel();
                        }
                    } else {
                        this.blinkTextPanel();
                    }
                    return false;
                }
            }
        }
        if (this.blockDoubleTap && gesture.kind === 'doubleTap') {
            // Giống như đánh dấu 2 lần (xác nhận từ user): tap đầu đã fire (Empty->X) ngay lúc
            // nhả tay rồi, chỉ cần chặn phần "nâng cấp thành double tap" là đủ — không đặt track.
            return false;
        }
        return true;
    };

    private onRedraw(): void {
        const snapshot = this.session?.snapshot();
        if (!snapshot) return;
        this.renderAndSyncSound(snapshot);
        this.checkStepAdvance(snapshot);
    }

    /** Render + phát âm diff y hệt GameplayScreen.refreshConnectTracksBoard — dùng cho mọi thao tác
     * THẬT của người chơi (double tap mục tiêu, đánh dấu X, kéo nối ray tự do, áp dụng hint) hoặc
     * mô phỏng tương đương. `silent=true` cho các lần render KHÔNG phải do người chơi tạo ra (demo
     * xem trước lời giải ở bước 4, restart dọn demo đó) — chỉ đồng bộ mốc so sánh, không phát âm. */
    private renderAndSyncSound(snapshot: GameSnapshot, silent = false): void {
        if (!silent && this.soundSnapshot) {
            AudioManager.maybeInstance?.playTrackChanges(this.soundSnapshot, snapshot);
        }
        this.soundSnapshot = snapshot;
        this.board?.render(snapshot);
    }

    private checkStepAdvance(snapshot: GameSnapshot): void {
        switch (this.step) {
            case Step.DoubleTap1:
                // BUG đã sửa: trước đây gọi lại index 1 (vẫn trỏ về cell 1) thay vì 2 (cell 9) —
                // allowedCells không bao giờ mở ra cell 9 nên tutorial bị kẹt mãi ở đây.
                if (this.isIdentified(snapshot, 1)) this.enterDoubleTapStep(2, Step.DoubleTap2);
                break;
            case Step.DoubleTap2:
                if (this.isIdentified(snapshot, 9)) this.enterDoubleTapStep(3, Step.DoubleTap3);
                break;
            case Step.DoubleTap3:
                if (this.isIdentified(snapshot, 14)) this.enterExcludeRowStep();
                break;
            case Step.ExcludeRow:
                if (EXCLUDE_ROW_CELLS.every((c) => snapshot.cellStates[c] === PlayerCellState.X)) {
                    this.enterExcludeColumnStep();
                }
                break;
            case Step.ExcludeColumn:
                if (EXCLUDE_COLUMN_CELLS.every((c) => snapshot.cellStates[c] === PlayerCellState.X)) {
                    this.enterFindRemainingStep();
                }
                break;
            case Step.FindRemaining:
                // Thắng được kiểm tra NGAY TRONG bước này (không còn Step.FreePlay riêng) — dash +
                // tay giờ chạy LIÊN TỤC xuyên suốt free play cho tới khi thắng (xác nhận từ user),
                // nên không còn mốc chuyển step nào khác để gắn việc kiểm tra thắng vào.
                if (snapshot.phase === GamePhase.Won) { this.enterWonStep(snapshot); break; }
                if (!this.sweepDemoStarted
                    && CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS.every((c) => this.isIdentified(snapshot, c))) {
                    this.sweepDemoStarted = true;
                    this.enterSweepDemo();
                }
                break;
        }
    }

    private isIdentified(snapshot: GameSnapshot, cell: number): boolean {
        const state = snapshot.cellStates[cell];
        return state === PlayerCellState.TrackPreview || state === PlayerCellState.Track;
    }

    // ---- Step 1-3: intro, lift row, lift column ------------------------------------------------

    private enterIntroStep(): void {
        this.step = Step.Intro;
        this.allowedCells = new Set();
        this.setDim(false); // Bước đầu KHÔNG hiện nền đen (xác nhận từ user).
        this.setText(L10N.connectTracksTutorial.intro);
        this.setButton(L10N.connectTracksTutorial.nextButton, () => this.enterLiftRowStep());
    }

    private enterLiftRowStep(): void {
        this.step = Step.LiftRow;
        this.allowedCells = new Set();
        this.setDim(true);
        // Chỉ nhấc ô THỰC SỰ thuộc hàng 0 — ô entrance (0) nằm trong hàng này nên tự nhiên được
        // nhấc kèm; KHÔNG ép thêm ô exit (15, không thuộc hàng 0) vào (xác nhận từ user: chỉ nhấc
        // khi thực sự cần dùng, không phải "luôn luôn" nhấc entrance/exit).
        this.setLiftedCells([0, 1, 2, 3]);
        if (this.board && this.liftLayer) this.board.showLineClueHighlight('row', 0, this.liftLayer);
        this.setText(L10N.connectTracksTutorial.rowClue);
        this.setButton(L10N.connectTracksTutorial.nextButton, () => this.enterLiftColumnStep());
    }

    private enterLiftColumnStep(): void {
        this.step = Step.LiftColumn;
        this.allowedCells = new Set();
        this.setDim(true);
        // Cột 1 — không có ô entrance/exit nào thuộc cột này, nên không nhấc thêm gì khác.
        this.setLiftedCells([1, 5, 9, 13]);
        if (this.board && this.liftLayer) this.board.showLineClueHighlight('column', 1, this.liftLayer);
        this.setText(L10N.connectTracksTutorial.colClue);
        this.setButton(L10N.connectTracksTutorial.nextButton, () => this.enterShowSolutionPreviewStep());
    }


    /** Bật/tắt nền đen LUÔN fade bằng opacity, không bật/tắt cứng (xác nhận từ user). */
    private setDim(active: boolean): void {
        const node = this.dimNode;
        if (!node) {
            this.dimActive = active;
            return;
        }
        if (this.dimActive === active) return;
        this.dimActive = active;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        if (active) {
            node.active = true;
            opacity.opacity = 0;
            tween(opacity).to(0.25, { opacity: this.dimOpacity }).start();
        } else {
            tween(opacity).to(0.25, { opacity: 0 }).call(() => {
                if (isValid(node)) node.active = false;
            }).start();
        }
    }

    /** Nhấc 1 nhóm ô lên TRÊN nền đen bằng cách reparent sang 1 layer riêng (CÙNG kỹ thuật
     * ConnectTracksHintView dùng để nhấc ô khi hiện gợi ý — tái dùng chính xác hiệu ứng đó, không
     * phải scale). Luôn gỡ nhóm cũ trước khi nhấc nhóm mới. */
    private setLiftedCells(cells: readonly number[]): void {
        this.clearLift();
        const board = this.board;
        const snapshot = this.session?.snapshot();
        if (!board || !snapshot || cells.length === 0) return;
        if (!this.liftLayer) {
            const layer = new Node('TutorialLiftLayer');
            layer.layer = board.node.layer;
            layer.addComponent(UITransform);
            layer.parent = this.node;
            this.liftLayer = layer;
        }
        const layer = this.liftLayer;
        layer.setWorldPosition(board.node.worldPosition);
        layer.setWorldRotation(board.node.worldRotation);
        layer.setWorldScale(board.node.worldScale);
        // Ngay trên dimNode (nếu có) để không bị TEXT/nút Next (sibling sau) che ngược lại.
        layer.setSiblingIndex(this.dimNode ? this.dimNode.getSiblingIndex() + 1 : -1);
        this.bringUiToFront();
        const cellNodes = cells
            .map((c) => board.getHintCellNode(c))
            .filter((n): n is Node => !!n && isValid(n, true) && !!n.parent);
        // Mũi tên entrance/exit LUÔN nổi trên nền đen suốt bước 2-3, BẤT KỂ đang nhấc hàng hay cột
        // nào (xác nhận từ user: mũi tên hiện xuyên suốt bước 1-4) — giờ mũi tên là node CON của
        // CHÍNH ô entrance/exit (Cell.prefab), nên chỉ reparent RIÊNG mũi tên, không đụng tới phần
        // còn lại của ô đó (không ép "nhấc cả ô" như trước).
        const arrowNodes = [
            board.getTutorialCellOverlay(snapshot.entranceCell, 'TutorialEntranceArrow'),
            board.getTutorialCellOverlay(snapshot.exitCell, 'TutorialExitArrow'),
        ].filter((n): n is Node => !!n && isValid(n, true) && !!n.parent);
        const nodes = cellNodes.concat(arrowNodes);
        this.lifted = nodes.map((n) => ({
            node: n, parent: n.parent!, index: n.getSiblingIndex(),
            position: n.position.clone(), scale: n.scale.clone(),
        }));
        for (const item of this.lifted) item.node.setParent(layer, true);
        this.drawLiftBorder(layer, cells, snapshot.width, snapshot.height, board.getCellSize());
    }

    /** Viền xám quanh vùng ô được nhấc — CÙNG kỹ thuật ConnectTracksHintView dùng để vẽ viền quanh
     * vùng ô của Hint (Graphics.stroke theo cạnh ngoài của cụm ô, bỏ cạnh giáp ô khác trong cụm). */
    private drawLiftBorder(layer: Node, cells: readonly number[], width: number, height: number, cellSize: number): void {
        if (!this.liftBorderGraphics) {
            const node = new Node('TutorialLiftBorder');
            node.addComponent(UITransform);
            this.liftBorderGraphics = node.addComponent(Graphics);
        }
        const graphics = this.liftBorderGraphics;
        // BUG đã sửa: thiếu gán render layer cho node Graphics này — camera không vẽ layer mặc định
        // của 1 Node mới tạo, nên viền tồn tại nhưng vô hình. Phải khớp layer với board (giống hệt
        // TutorialLiftLayer/entranceOverlay của ConnectTracksBoardView).
        graphics.node.layer = layer.layer;
        graphics.node.parent = layer;
        graphics.node.setSiblingIndex(-1);
        graphics.node.setPosition(0, 0, 0);
        graphics.clear();
        const set = new Set(cells);
        const xy = (c: number) => ({
            x: (c % width - width / 2) * cellSize,
            y: (height / 2 - Math.floor(c / width) - 1) * cellSize,
        });
        const edge = (x1: number, y1: number, x2: number, y2: number) => { graphics.moveTo(x1, y1); graphics.lineTo(x2, y2); };
        // Line NGĂN CÁCH các ô bên trong vùng nhấc — vùng này đã tách khỏi gridGraphics gốc của
        // board nên tự nó không còn line chia ô (xác nhận từ user: phải vẽ lại). Chỉ xét cạnh
        // TRÁI/TRÊN của mỗi ô để mỗi đường chung chỉ vẽ đúng 1 lần (cạnh PHẢI/DƯỚI của ô bên cạnh
        // đã phủ cùng đường đó).
        if (this.cellSeparatorWidth > 0) {
            graphics.lineWidth = this.cellSeparatorWidth;
            graphics.strokeColor = this.cellSeparatorColor;
            for (const c of cells) {
                const { x, y } = xy(c);
                const col = c % width, row = Math.floor(c / width);
                if (col > 0 && set.has(c - 1)) edge(x, y, x, y + cellSize);
                if (row > 0 && set.has(c - width)) edge(x, y + cellSize, x + cellSize, y + cellSize);
            }
            graphics.stroke();
        }
        if (this.liftBorderWidth > 0) {
            graphics.lineWidth = this.liftBorderWidth;
            graphics.strokeColor = this.liftBorderColor;
            for (const c of cells) {
                const { x, y } = xy(c);
                const col = c % width, row = Math.floor(c / width);
                if (col === 0 || !set.has(c - 1)) edge(x, y, x, y + cellSize);
                if (col === width - 1 || !set.has(c + 1)) edge(x + cellSize, y, x + cellSize, y + cellSize);
                if (row === 0 || !set.has(c - width)) edge(x, y + cellSize, x + cellSize, y + cellSize);
                if (row === height - 1 || !set.has(c + width)) edge(x, y, x + cellSize, y);
            }
            graphics.stroke();
        }
    }

    private clearLift(): void {
        if (this.board && isValid(this.board.node, true)) this.board.hideLineClueHighlight();
        if (this.liftBorderGraphics && isValid(this.liftBorderGraphics, true)) this.liftBorderGraphics.clear();
        for (const item of this.lifted.slice().sort((a, b) => a.index - b.index)) {
            if (!isValid(item.node, true) || !isValid(item.parent, true)) continue;
            item.node.setParent(item.parent);
            item.node.setPosition(item.position);
            item.node.setScale(item.scale);
            item.node.setSiblingIndex(item.index);
        }
        this.lifted = [];
    }

    private bringUiToFront(): void {
        this.textPanel?.setSiblingIndex(-1);
        if (this.nextButton) this.nextButton.node.setSiblingIndex(-1);
    }

    // ---- Step 4: dim solution preview -----------------------------------------------------------

    private dimmedCells: number[] = [];

    private enterShowSolutionPreviewStep(): void {
        this.step = Step.ShowSolutionPreview;
        this.setDim(false); // Bước cuối của giai đoạn 1 cũng KHÔNG hiện nền đen (xác nhận từ user).
        this.clearLift();
        this.allowedCells = new Set();
        const session = this.session;
        if (session) {
            for (const cell of CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS) {
                // Required cells are always solution-path, non-given cells (requiredCellsFor's own
                // contract), so correctDirectionsFor always applies here — no membership check needed.
                const directions = correctDirectionsFor(cell);
                if (directions) {
                    session.dispatch({ type: 'doubleTapCell', cell });
                    session.dispatch({ type: 'applyTrackShape', cell, directions });
                }
            }
            this.renderAndSyncSound(session.snapshot(), true); // Demo xem trước lời giải — im lặng.
        }
        this.dimmedCells = CONNECT_TRACKS_TUTORIAL_REQUIRED_CELLS.slice();
        for (const cell of this.dimmedCells) {
            const node = this.board?.getHintCellNode(cell);
            if (!node) continue;
            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            opacity.opacity = 140; // Lower than the fully-opaque given cells.
        }
        this.setText(L10N.connectTracksTutorial.tryNow);
        this.setButton(L10N.connectTracksTutorial.tryNowButton, () => this.enterDoubleTapStep(1, Step.DoubleTap1, true));
    }

    private clearSolutionPreview(): void {
        for (const cell of this.dimmedCells) {
            const node = this.board?.getHintCellNode(cell);
            const opacity = node?.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
        }
        this.dimmedCells = [];
        if (this.session) {
            this.session.dispatch({ type: 'restart' });
            this.renderAndSyncSound(this.session.snapshot(), true); // Dọn demo — im lặng.
        }
    }

    // ---- Steps 5-7: scripted double-tap targets -------------------------------------------------

    /** `index` is the 1-based position in DOUBLE_TAP_STEP_CELLS (1, 2 or 3). `first` clears the
     * step-4 dimmed preview once, before gating input to the first target cell. */
    private enterDoubleTapStep(index: number, step: Step, first = false): void {
        if (first) {
            this.clearSolutionPreview();
            // Mũi tên xanh chỉ hiện từ bước đầu tới hết bước "Thử ngay" (xác nhận từ user).
            this.hideEntranceExitArrows();
            // Từ đây nút "Thử ngay" ẩn hẳn (dòng nextButton.active=false bên dưới) nên không còn
            // chừa chỗ cho nút nữa — đưa text về giữa khung (0,0) thay vì lệch lên trên như lúc còn
            // nút, tránh để lại khoảng trống trong nền (xác nhận từ user).
            if (this.textLabel) this.textLabel.node.setPosition(0, 0, this.textLabel.node.position.z);
        }
        this.step = step;
        this.blockDoubleTap = false;
        const cell = DOUBLE_TAP_STEP_CELLS[index - 1];
        this.allowedCells = new Set([cell]);
        this.nextButton && (this.nextButton.node.active = false);
        this.setText(L10N.connectTracksTutorial.doubleTapHint);
        // Thứ tự gọi KHÔNG ảnh hưởng tay vs highlight (xác nhận từ user, test thực tế: đổi thứ tự
        // không đổi gì cả) — Spine (tay) render qua pipeline riêng, không theo sibling index như
        // Sprite thường, nên tay LUÔN nổi trên highlight bất kể gọi trước/sau. Đây là điều CHẤP
        // NHẬN ĐƯỢC (xác nhận từ user: "highlight phải nằm trên tất cả các node TRỪ hand").
        this.showHighlight(cell);
        this.pointHandAt(cell, 'double_click');
    }

    // ---- Steps 8-9: single-tap exclusion ---------------------------------------------------------

    private enterExcludeRowStep(): void {
        this.step = Step.ExcludeRow;
        this.blockDoubleTap = true;
        this.allowedCells = new Set(EXCLUDE_ROW_CELLS);
        this.excludeSettleCell = null;
        this.setText(L10N.connectTracksTutorial.excludeHint);
        this.showHighlight(EXCLUDE_ROW_CELLS, 'row'); // Rộng theo highlightSpanWidthPx (trải NGANG).
        this.pointHandAt(EXCLUDE_ROW_CELLS[0], 'click');
        this.schedule(this.excludeSettleCheck, 0.2);
    }

    private enterExcludeColumnStep(): void {
        this.step = Step.ExcludeColumn;
        this.blockDoubleTap = true;
        this.allowedCells = new Set(EXCLUDE_COLUMN_CELLS);
        this.excludeSettleCell = null;
        this.showHighlight(EXCLUDE_COLUMN_CELLS, 'column'); // Cao theo highlightSpanHeightCells (trải DỌC).
        this.setText(L10N.connectTracksTutorial.excludeHint);
        this.sweepHandAcross(EXCLUDE_COLUMN_CELLS);
    }

    /** Re-checked every 0.2s (not event-driven) — re-validates against the LATEST snapshot each
     * time, same "don't trust a stale schedule" spirit as the legacy tutorial's own deferred
     * transitions. Moves the hand to the next unmarked target after a short settle, and brings it
     * BACK if the player removes a mark (xác nhận từ user). Column step auto-sweeps instead (no
     * per-cell wait), so this only runs for the row step. */
    private readonly excludeSettleCheck = (): void => {
        if (this.step !== Step.ExcludeRow) {
            this.unschedule(this.excludeSettleCheck);
            return;
        }
        const snapshot = this.session?.snapshot();
        if (!snapshot) return;
        const unmarked = EXCLUDE_ROW_CELLS.find((c) => snapshot.cellStates[c] !== PlayerCellState.X);
        if (unmarked === undefined) {
            this.unschedule(this.excludeSettleCheck);
            return;
        }
        if (unmarked !== this.excludeSettleCell) {
            this.excludeSettleCell = unmarked;
            this.pointHandAt(unmarked, 'click'); // Highlight giữ nguyên bounding box tĩnh, chỉ tay di chuyển.
        }
    };

    // ---- Step 10: find the last cell unaided, tutorial hint, then sweep demo -------------------

    private enterFindRemainingStep(): void {
        this.step = Step.FindRemaining;
        this.blockDoubleTap = false;
        this.allowedCells = null; // Full board from here on (confirmed by the user).
        this.hideHighlight();
        this.hideHand();
        // BUG đã sửa (báo lỗi của user, kèm ảnh: text vẫn hiện excludeHint của bước 8-9 trước đó) —
        // bước này trước giờ KHÔNG hề gọi setText(), nên chữ bị đứng yên lại nội dung cũ. Đổi sang
        // nội dung MỚI (xác nhận từ user) giải thích cả 2 thao tác board cho phép từ bước này trở
        // đi (chạm 2 lần đặt đường ray, chạm 1 lần loại trừ).
        this.setText(L10N.connectTracksTutorial.findRemainingHint);
        if (this.tutorialHintCluster) this.tutorialHintCluster.active = true;
        // Label phụ hiện ĐỒNG THỜI với cụm gợi ý (xác nhận từ user).
        if (this.tutorialHintPrompt) this.tutorialHintPrompt.active = true;
    }

    /** Tutorial-only hint button — "mở hint như booster hint" (xác nhận từ user): dùng ĐÚNG luồng
     * UI xem trước/áp dụng thật (ConnectTracksHintView, cùng instance connectTracksBoosterHint của
     * GameplayScreen) thay vì áp dụng thẳng — CHỈ rule A8 (gợi ý cuối cùng là "cứ đặt ô required kế
     * tiếp", không có gì để xem trước) mới áp thẳng, y hệt showConnectTracksBoosterHint thật. Không
     * tốn lượt nào của ví người chơi thật (không gọi inventory.grantHintCharges). */
    onTapTutorialHint(): void {
        const session = this.session;
        const board = this.board;
        if (!session || !board) return;
        if (this.hintView?.showing) return;
        const hint = session.requestHint();
        if (!hint) return;
        if (hint.rule === 'A8') {
            session.applyHint(hint);
            this.renderAndSyncSound(session.snapshot());
            this.checkStepAdvance(session.snapshot());
            return;
        }
        const resume = (): void => {
            if (!this.session || !this.board) return;
            this.session.cancelHint();
            this.input?.bind(this.session, () => this.onRedraw(), this.board, undefined,
                { canDispatch: this.canDispatch, disableOptionsMenu: true });
        };
        const snapshot = session.snapshot();
        const shown = this.hintView?.show(hint, board, snapshot.width, snapshot.height, () => {
            if (!this.session) return;
            this.session.applyHint(hint);
            resume();
            this.renderAndSyncSound(this.session.snapshot());
            this.checkStepAdvance(this.session.snapshot());
        }, resume);
        if (!shown) {
            session.cancelHint();
            warn('[ConnectTracksTutorialController] Gán hintView (cùng instance ConnectTracksBoosterHint) để nút gợi ý tutorial hoạt động.');
            return;
        }
        this.input?.unbind();
    }

    private enterSweepDemo(): void {
        this.setText(L10N.connectTracksTutorial.sweepHint);
        const board = this.board;
        const snapshot = this.session?.snapshot();
        // Mũi tên xanh đã ẩn từ bước "Thử ngay" — giờ thay bằng 2 vòng tròn nhấp nháy, là node con
        // SẴN CÓ trong Cell.prefab của đúng ô entrance/exit (xác nhận từ user) — không cần tự tính
        // toạ độ, chỉ bật active + chạy pulse.
        if (board && snapshot) {
            const entranceCircle = board.getTutorialCellOverlay(snapshot.entranceCell, 'TutorialEntranceCircle');
            const exitCircle = board.getTutorialCellOverlay(snapshot.exitCell, 'TutorialExitCircle');
            if (entranceCircle) { entranceCircle.active = true; this.pulse(entranceCircle); }
            if (exitCircle) { exitCircle.active = true; this.pulse(exitCircle); }
        }
        this.beginPathDemo();
    }

    // ---- Step 11: win handoff ---------------------------------------------------------------------

    private enterWonStep(snapshot: GameSnapshot): void {
        // Dừng hẳn dash + vòng lặp tay — "chạy liên tục đến khi người chơi nối thành đường liền
        // mạch rồi mới tắt" (xác nhận từ user): mọi chỗ khác tự dừng khi thấy travelPolyline null.
        this.travelPolyline = null;
        this.travelingHand = false;
        this.hideHand();
        // BUG đã sửa (báo lỗi của user): set travelPolyline=null chỉ NGỪNG spawn/update dash mới —
        // dash ĐANG HIỆN vẫn đứng yên tại chỗ mãi mãi vì vòng dọn dẹp (trả về pool) nằm TRONG
        // updateDashTrail(), vốn không còn chạy nữa. Phải tắt tay luôn toàn bộ dash + trả 2 chấm
        // tròn về đúng ô gốc (restoreCircles cũng tự tắt active) ngay tại đây.
        if (this.pathOverlay && isValid(this.pathOverlay, true)) {
            for (const node of this.liveDashNodes) { node.active = false; this.dashPool.push(node); }
        }
        this.liveDashNodes = [];
        this.dashDistances = [];
        this.restoreCircles();
        const board = this.board;
        const victory = this.victory;
        if (!board || !victory) return;
        const started = victory.begin(
            board,
            snapshot,
            this.node.parent ?? this.node,
            // "Y HỆT luồng thắng thật" (xác nhận từ user) — GameplayScreen tự cung cấp ĐÚNG logic
            // nó chạy ở đây (notifyConnectTracksWon + set label), không tự làm riêng nữa (trước đó
            // tự set label tay, thiếu hẳn notifyConnectTracksWon — chính là lý do booster/HUD không
            // reset đúng lúc chuyển sang level thật kế tiếp).
            // Tutorial không có Tournament/LeaderboardPreview gì để đợi — resume() ngay lập tức
            // (xác nhận từ user: hoãn tàu chỉ áp dụng cho luồng thắng THẬT, tutorial giữ nguyên
            // chạy liền như cũ).
            (resume) => { this.onCompleted?.(); resume(); },
            () => this.onContinue?.(),
            // "Tut cũng áp dụng nó" (xác nhận từ user — chỉ kích hoạt sao bay sau level 10): tutorial
            // không phải level thật nào cả, luôn coi như dưới mốc đó nên luôn tắt sao bay.
            false,
        );
        if (!started) {
            // ConnectTracksVictoryView.begin() trả false (và tự warn ra console) nếu đường ray
            // chưa khớp hoàn chỉnh HOẶC thiếu property Editor (railGroup/railLabel/flightLayer/
            // boardCenterTarget/nextButton) — không thể suy ra nguyên nhân chính xác chỉ từ code,
            // cần xem console log thật để biết câu warn cụ thể là gì.
            warn('[ConnectTracksTutorialController] Victory sequence did not start — check the ' +
                'ConnectTracksVictoryView warning above for the exact reason.');
        }
        this.input?.unbind();
    }

    // ---- Visual helpers -----------------------------------------------------------------------

    private setText(key: string): void {
        if (this.textLabel) this.textLabel.string = Localization.get(key);
    }

    private setButton(labelKey: string | null, onTap: (() => void) | null): void {
        const button = this.nextButton;
        if (!button) return;
        if (!labelKey || !onTap) {
            this.stopButtonBlink();
            button.node.active = false;
            return;
        }
        button.node.active = true;
        if (this.nextButtonLabel) this.nextButtonLabel.string = Localization.get(labelKey);
        button.node.off(Node.EventType.TOUCH_END, this.handleNextTap, this);
        this.pendingNext = onTap;
        button.node.on(Node.EventType.TOUCH_END, this.handleNextTap, this);
        this.startButtonBlink();
    }

    /** Nhấp nháy scale LIÊN TỤC (không phải 1 nhịp) suốt lúc nút Tiếp theo/Thử ngay đang hiện (xác
     * nhận từ user) — tốc độ/độ to chỉnh qua nextButtonBlinkSpeed/nextButtonBlinkScale. */
    private startButtonBlink(): void {
        const node = this.nextButton?.node;
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        const s = this.nextButtonBlinkScale;
        tween(node)
            .repeatForever(
                tween<Node>()
                    .to(this.nextButtonBlinkSpeed, { scale: new Vec3(s, s, 1) }, { easing: 'sineInOut' })
                    .to(this.nextButtonBlinkSpeed, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' }),
            )
            .start();
    }

    private stopButtonBlink(): void {
        const node = this.nextButton?.node;
        if (!node || !isValid(node, true)) return;
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
    }

    private pendingNext: (() => void) | null = null;
    private readonly handleNextTap = (): void => {
        const next = this.pendingNext;
        this.pendingNext = null;
        next?.();
    };

    /** Phản hồi khi chạm ra ngoài vùng được chỉ định: phóng to, hơi LÚN XUỐNG (nhỏ hơn scale gốc 1
     * nhịp), rồi mới về đúng scale gốc (xác nhận từ user — áp dụng từ giai đoạn 2 trở đi, nơi
     * feedback này thực sự có thể kích hoạt). Scale `textPanelBlinkTarget` nếu có gán, KHÔNG scale
     * thẳng `textPanel` — nếu nút "Tiếp theo" là con của textPanel mà lại scale chính textPanel,
     * scale của nút sẽ bị kéo theo (xác nhận từ user: nút không được nhấp nháy theo). Xem tooltip
     * của textPanelBlinkTarget để biết cách gán cho đúng. */
    private readonly blinkTextPanel = (): void => {
        const node = this.textPanelBlinkTarget ?? this.textPanel;
        if (!node) return;
        Tween.stopAllByTarget(node);
        node.setScale(1, 1, 1);
        tween(node)
            .to(0.08, { scale: new Vec3(1.08, 1.08, 1) }, { easing: 'quadOut' })
            .to(0.08, { scale: new Vec3(0.96, 0.96, 1) }, { easing: 'quadInOut' })
            .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
            .start();
    };

    /** Highlight là node con SẴN CÓ trong Cell.prefab ("TutorialHighlight", xác nhận từ user) — mỗi
     * ô 1 bản riêng. `cells[0]` là Ô NEO: highlight dùng chính là bản thuộc ô neo đó, nhưng REPARENT
     * TẠM nó ra khỏi ô (sang `highlightLayer`, 1 layer con TRỰC TIẾP của board.node — nổi trên mọi
     * ô có sẵn vì mới tạo/luôn được đẩy -1) thay vì đẩy sibling của ô. Cách này không đụng tới BẤT
     * KỲ ô nào (không đè line/viền board — lỗi cũ #1 — và không bị ô lân cận đè khi tràn sang —
     * lỗi cũ #2), vì highlight không còn là con của ô nào trong lúc hiện cả. QUAN TRỌNG: layer này
     * là con của board.node (KHÔNG phải this.node) để tay (cũng con trực tiếp của board.node, tự
     * đẩy -1 mỗi frame trong reassertOverlayOrder) vẫn luôn nổi được TRÊN highlight — xác nhận từ
     * user: "hand phải nằm trên highlight". Nếu layer này nằm trong this.node (vốn đã đẩy lên TRÊN
     * board từ begin()) thì tay (dưới board.node) sẽ không bao giờ thắng nổi, bất kể sibling trong
     * board.node thế nào.
     * 1 ô: dùng ĐÚNG UITransform tự thân của node (KHÔNG setContentSize). Nhiều ô: resize theo
     * property px tuyệt đối (highlightSpanWidthPx khi `axis` là 'row', highlightSpanHeightPx khi
     * 'column') + dịch theo property offset tương ứng. */
    private showHighlight(cells: number | readonly number[], axis?: 'row' | 'column'): void {
        const board = this.board;
        if (!board) return;
        const list = typeof cells === 'number' ? [cells] : cells;
        if (list.length === 0) return;
        const anchorCell = list[0];
        const node = board.getTutorialCellOverlay(anchorCell, 'TutorialHighlight');
        if (!node) return;
        this.hideHighlight();
        if (!this.highlightLayer) {
            const layer = new Node('TutorialHighlightLayer');
            layer.layer = board.node.layer;
            layer.addComponent(UITransform);
            layer.parent = board.node;
            layer.setPosition(0, 0, 0);
            this.highlightLayer = layer;
        }
        const layer = this.highlightLayer;
        layer.setSiblingIndex(-1);
        this.highlightOriginal = {
            parent: node.parent!, index: node.getSiblingIndex(),
            position: node.position.clone(), scale: node.scale.clone(),
        };
        node.setParent(layer, true);
        this.activeHighlightNode = node;
        const cellLocal = this.boardLocalOf(anchorCell) ?? new Vec3(0, 0, node.position.z);
        if (list.length === 1) {
            node.setPosition(cellLocal.x, cellLocal.y, node.position.z);
        } else {
            const transform = node.getComponent(UITransform);
            if (axis === 'row') transform?.setContentSize(this.highlightSpanWidthPx, transform.height);
            else if (axis === 'column') transform?.setContentSize(transform.width, this.highlightSpanHeightPx);
            const offset = axis === 'row' ? this.highlightSpanWidthOffset
                : axis === 'column' ? this.highlightSpanHeightOffset : null;
            node.setPosition(cellLocal.x + (offset?.x ?? 0), cellLocal.y + (offset?.y ?? 0), node.position.z);
        }
        node.active = true;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        tween(opacity).repeatForever(tween<UIOpacity>().to(0.5, { opacity: 120 }).to(0.5, { opacity: 255 })).start();
    }

    private hideHighlight(): void {
        const node = this.activeHighlightNode;
        const original = this.highlightOriginal;
        this.activeHighlightNode = null;
        this.highlightOriginal = null;
        if (!node || !isValid(node, true)) return;
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        node.active = false;
        // Trả highlight về ĐÚNG ô gốc của nó — không thì lần sau getTutorialCellOverlay tìm bằng
        // tên vẫn ra node này (vẫn đúng do getChildByName đệ quy theo tên, nhưng để parent sai thì
        // ô gốc mất hẳn child của nó, không an toàn nếu board bị rebuild/pool tái dùng).
        if (original && isValid(original.parent, true)) {
            node.setParent(original.parent, true);
            node.setPosition(original.position);
            node.setScale(original.scale);
            node.setSiblingIndex(original.index);
        }
    }

    /** Hand giờ là con TRỰC TIẾP của board.node (node "TutorialHand" trong Board.prefab, xác nhận
     * từ user) — chỉ cần đổi board-local -> world -> board-local (1 bước, qua chính UITransform
     * của board) để lấy toạ độ ĐÚNG không gian của hand, không cần biết parent của hand là gì nữa. */
    private boardLocalOf(cell: number): Vec3 | null {
        const board = this.board;
        if (!board) return null;
        const world = board.getCellWorldPosition(cell);
        if (!world) return null;
        const local = new Vec3();
        board.node.getComponent(UITransform)?.convertToNodeSpaceAR(world, local);
        return local;
    }

    private pointHandAt(cell: number, clip: string): void {
        const hand = this.handSkeleton;
        if (!hand) return;
        const local = this.boardLocalOf(cell);
        if (!local) return;
        hand.node.active = true;
        hand.node.setSiblingIndex(-1); // Luôn nổi trên MỌI ô (báo lỗi của user: hand bị ô đè mất).
        Tween.stopAllByTarget(hand.node);
        hand.node.setPosition(local);
        const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
        opacity.opacity = 255;
        hand.setAnimation(0, clip, true);
    }

    /** Tay bấm "press" ở ô TRÊN CÙNG, chuyển "press_on" rồi trượt LIÊN TỤC xuống ô CUỐI, dừng
     * 0.5s, mờ dần (opacity) rồi lặp lại từ đầu (xác nhận từ user) — không còn kiểu nhảy rời rạc
     * từng ô bằng clip "click" như trước. Tự dừng hẳn khi rời khỏi bước ExcludeColumn. */
    private sweepHandAcross(cells: readonly number[]): void {
        const hand = this.handSkeleton;
        if (!hand || cells.length === 0) return;
        const topCell = cells[0];
        const bottomCell = cells[cells.length - 1];
        const runOnce = (): void => {
            if (this.step !== Step.ExcludeColumn || !isValid(hand.node, true)) return;
            const topLocal = this.boardLocalOf(topCell);
            const bottomLocal = this.boardLocalOf(bottomCell);
            if (!topLocal || !bottomLocal) return;
            Tween.stopAllByTarget(hand.node);
            const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            hand.node.active = true;
            hand.node.setSiblingIndex(-1); // Thứ tự cuối cùng được chốt lại mỗi frame trong update()/reassertOverlayOrder().
            hand.node.setPosition(topLocal);
            opacity.opacity = 255;
            hand.setAnimation(0, 'press', false);
            this.scheduleOnce(() => {
                if (this.step !== Step.ExcludeColumn) return;
                hand.setAnimation(0, 'press_on', true);
                tween(hand.node)
                    .to(0.9, { position: bottomLocal }, { easing: 'quadInOut' })
                    .delay(0.5)
                    .call(() => {
                        if (this.step !== Step.ExcludeColumn) return;
                        tween(opacity).to(0.25, { opacity: 0 }).call(() => {
                            if (this.step === Step.ExcludeColumn) this.scheduleOnce(runOnce, 0.3);
                        }).start();
                    })
                    .start();
            }, 0.3);
        };
        runOnce();
    }

    private hideHand(): void {
        const hand = this.handSkeleton;
        if (!hand || !isValid(hand.node, true)) return;
        Tween.stopAllByTarget(hand.node);
        hand.node.active = false;
    }

    private pulse(node: Node): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        tween(opacity).repeatForever(tween<UIOpacity>().to(0.45, { opacity: 90 }).to(0.45, { opacity: 255 })).start();
    }

    // ---- Step 10b: dash trail + traveling hand along the solved polyline -----------------------

    private beginPathDemo(): void {
        const board = this.board;
        const session = this.session;
        if (!board || !session) return;
        const snapshot = session.snapshot();
        // Dùng THẲNG lời giải đã biết trước (CONNECT_TRACKS_TUTORIAL_LEVEL.solutionPath), KHÔNG
        // dò theo link thật của người chơi (traceTrainPath — đòi hỏi mỗi ô đã có ĐỦ 2 kết nối, tức
        // Track thật) — xác nhận từ user: dash phải hiện ra kiểu "prewarm" NGAY khi ô required cuối
        // cùng được xác định (TrackPreview), TRƯỚC khi người chơi thật sự quẹt nối.
        const path = CONNECT_TRACKS_TUTORIAL_LEVEL.solutionPath;
        const entranceEntry = snapshot.mainTrackPorts.find((e) => e.cell === snapshot.entranceCell);
        const exitEntry = snapshot.mainTrackPorts.find((e) => e.cell === snapshot.exitCell);
        if (!entranceEntry?.outward || !exitEntry?.outward) return;
        const cellSize = board.getCellSize();
        // cornerRadius = 0 (xác nhận từ user): dash/tay phải đi tới ĐÚNG tâm ô rồi mới rẽ, không
        // được bo cong sớm như đường đi của tàu thật (mặc định cellSize/2 — bắt đầu bo trước khi
        // tới tâm ô).
        this.travelPolyline = buildTrainPolyline(
            path, snapshot.width, snapshot.height, cellSize, entranceEntry.outward, exitEntry.outward, 0,
        );
        // buildTrainPolyline nối thêm đúng 1 cellSize off-board trước entrance/sau exit (cho hiệu
        // ứng tàu thật) — tutorial không có đoạn off-board đó, dash/tay chỉ chạy giữa TÂM 2 ô (khớp
        // đúng vị trí 2 chấm tròn xanh ở trên), nên cắt bớt đúng 1 cellSize ở mỗi đầu.
        this.pathStartDistance = cellSize;
        this.pathEndDistance = Math.max(cellSize, polylineLength(this.travelPolyline) - cellSize);
        if (!this.pathOverlay) {
            this.pathOverlay = new Node('TutorialPathOverlay');
            this.pathOverlay.layer = board.node.layer;
            this.pathOverlay.addComponent(UITransform);
            this.pathOverlay.parent = board.node;
        }
        this.pathOverlay.setSiblingIndex(-1);
        this.raiseCirclesAboveDash(snapshot);
        this.prewarmDashTrail();
        this.startHandPass();
    }

    /** Reparent RIÊNG 2 chấm tròn entrance/exit (không đụng tới cả ô) vào pathOverlay — cùng kỹ
     * thuật highlightLayer dùng cho highlight. setParent(..., true) tự giữ nguyên vị trí hiển thị
     * (world transform), không cần tự tính lại toạ độ. */
    private raiseCirclesAboveDash(snapshot: GameSnapshot): void {
        const board = this.board;
        if (!board || !this.pathOverlay || this.circleOriginal.length > 0) return;
        const targets: [number, string][] = [
            [snapshot.entranceCell, 'TutorialEntranceCircle'],
            [snapshot.exitCell, 'TutorialExitCircle'],
        ];
        for (const [cell, name] of targets) {
            const node = board.getTutorialCellOverlay(cell, name);
            if (!node || !node.parent) continue;
            this.circleOriginal.push({
                node, parent: node.parent, index: node.getSiblingIndex(),
                position: node.position.clone(), scale: node.scale.clone(),
            });
            node.setParent(this.pathOverlay, true);
            node.setSiblingIndex(-1);
        }
    }

    /** Trả 2 chấm tròn về đúng ô gốc — gọi khi tutorial kết thúc, cùng lý do với hideHighlight. */
    private restoreCircles(): void {
        for (const entry of this.circleOriginal) {
            if (isValid(entry.node, true) && isValid(entry.parent, true)) {
                entry.node.setParent(entry.parent, true);
                entry.node.setPosition(entry.position);
                entry.node.setScale(entry.scale);
                entry.node.setSiblingIndex(entry.index);
            }
            // BUG đã sửa (báo lỗi của user: "2 node chấm tròn vẫn hiện"): trước đây chỉ trả về đúng
            // ô gốc nhưng QUÊN tắt active — cell instance được tái dùng qua NodePool cho level thật
            // tiếp theo, nên chấm tròn (vẫn active=true) hiện lại NGUYÊN VẸN ở vị trí ô mới của
            // chính instance đó trên board hoàn toàn khác.
            if (isValid(entry.node, true)) entry.node.active = false;
        }
        this.circleOriginal = [];
    }

    /** Lấp SẴN dash đều khắp đường ray ngay lúc bắt đầu (giống băng chuyền đã chạy sẵn), thay vì
     * bắt đầu trống rồi spawn rời rạc từng cái — xác nhận từ user: hiệu ứng "prewarm", không phải
     * spawn-over-time. Timer spawn vẫn tiếp tục chạy sau đó để nối tiếp nhịp, không lặp lại việc
     * này. */
    private prewarmDashTrail(): void {
        const polyline = this.travelPolyline;
        if (!polyline || !this.dashPrefab || !this.pathOverlay) return;
        for (const node of this.liveDashNodes) { node.active = false; this.dashPool.push(node); }
        this.liveDashNodes = [];
        this.dashDistances = [];
        for (let distance = this.pathStartDistance; distance <= this.pathEndDistance; distance += this.dashSpacing) {
            const pose = poseAtDistance(polyline, distance);
            if (!pose) break;
            const fresh = this.dashPool.length === 0;
            const node = fresh ? instantiate(this.dashPrefab) : this.dashPool.pop()!;
            if (fresh) this.applyLayerRecursive(node, this.pathOverlay.layer);
            node.active = true;
            node.parent = this.pathOverlay;
            this.applyDashPose(node, pose);
            this.dashDistances.push(distance);
            this.liveDashNodes.push(node);
        }
        this.dashSpawnTimer = this.dashSpacing / this.dashSpeed;
    }

    update(dt: number): void {
        // KHÔNG còn gate theo this.step — dash + tay phải chạy LIÊN TỤC xuyên suốt free play cho
        // tới khi người chơi thắng thật (xác nhận từ user); enterWonStep() gán travelPolyline=null
        // để dừng hẳn đúng lúc đó.
        if (this.travelPolyline) {
            this.updateDashTrail(dt);
            if (this.travelingHand) this.updateHandTravel(dt);
        }
        // reassertOverlayOrder() PHẢI chạy SAU CÙNG (không phải đầu update()) — BUG đã sửa: nó đẩy
        // tay lên, nhưng updateDashTrail() ở trên lại đẩy riêng 2 ô entrance/exit lên SAU đó mỗi
        // frame (để 2 chấm tròn nổi trên dash) — nếu reassert tay chạy TRƯỚC, 2 ô entrance/exit luôn
        // thắng tay bất kể tay đang đứng yên (lúc mới spawn/lúc dừng ở cuối đường, không chạy qua
        // updateHandTravel() nên không tự đẩy lại) hay đang trượt. Đẩy lại tay SAU CÙNG mỗi frame
        // đảm bảo tay luôn thắng, kể cả lúc đứng yên tại chính 2 ô entrance/exit (báo lỗi của user).
        this.reassertOverlayOrder();
    }

    /** highlight phải nổi TRÊN MỌI node khác; tay phải nổi trên CẢ highlight (xác nhận từ user).
     * Gọi lại mỗi frame (xem update()) để không phụ thuộc thứ tự gọi showHighlight/pointHandAt hay
     * bất kỳ render() nào xen giữa. */
    private reassertOverlayOrder(): void {
        // CHỈ còn lo cho tay (xác nhận từ user: highlight chỉ bật/tắt active, không đẩy sibling gì
        // cả — xem showHighlight).
        const hand = this.handSkeleton;
        if (hand && isValid(hand.node, true) && hand.node.active) {
            hand.node.setSiblingIndex(-1);
        }
    }

    private updateDashTrail(dt: number): void {
        const polyline = this.travelPolyline;
        // pathOverlay sống dưới board.node — mỗi board.render() (mọi thao tác của người chơi ở
        // free play) có thể đẩy overlay khác (vd viền chọn ô) lên trên, đè mất dash (báo lỗi của
        // user) — ép lại về sibling cuối cùng MỖI FRAME để luôn nổi trên cùng.
        if (this.pathOverlay && isValid(this.pathOverlay, true)) this.pathOverlay.setSiblingIndex(-1);
        // 2 chấm tròn (đã reparent RIÊNG vào pathOverlay — xem raiseCirclesAboveDash) phải luôn là
        // con cuối cùng BÊN TRONG pathOverlay, nổi trên mọi dash vừa spawn thêm — ép lại mỗi frame
        // vì dash mới liên tục được append vào pathOverlay sau chúng.
        for (const entry of this.circleOriginal) {
            if (isValid(entry.node, true)) entry.node.setSiblingIndex(-1);
        }
        if (!polyline || !this.dashPrefab || !this.pathOverlay) return;
        this.dashSpawnTimer -= dt;
        if (this.dashSpawnTimer <= 0) {
            this.dashSpawnTimer = this.dashSpacing / this.dashSpeed;
            const fresh = this.dashPool.length === 0;
            const node = fresh ? instantiate(this.dashPrefab) : this.dashPool.pop()!;
            if (fresh) this.applyLayerRecursive(node, this.pathOverlay.layer);
            node.active = true;
            node.parent = this.pathOverlay;
            // Dash MỚI SPAWN: canh góc đúng NGAY, không xoay mượt từ góc cũ/mặc định (0) — chỉ dash
            // ĐANG DI CHUYỂN mới cần xoay mượt khi rẽ (xem applyDashPoseSmoothed bên dưới).
            const spawnPose = poseAtDistance(polyline, this.pathStartDistance);
            if (spawnPose) this.applyDashPose(node, spawnPose);
            this.dashDistances.push(this.pathStartDistance);
            this.liveDashNodes.push(node);
        }
        for (let i = this.liveDashNodes.length - 1; i >= 0; i--) {
            this.dashDistances[i] += this.dashSpeed * dt;
            const pose = poseAtDistance(polyline, this.dashDistances[i]);
            const node = this.liveDashNodes[i];
            if (!pose || this.dashDistances[i] > this.pathEndDistance) {
                node.active = false;
                this.dashPool.push(node);
                this.liveDashNodes.splice(i, 1);
                this.dashDistances.splice(i, 1);
                continue;
            }
            this.applyDashPoseSmoothed(node, pose, dt);
        }
    }

    /** BUG đã sửa (báo lỗi "dash vẫn nằm dưới track" lặp đi lặp lại): instantiate(dashPrefab) giữ
     * nguyên `layer` tác giả gán sẵn trong chính prefab đó — KHÔNG tự kế thừa layer của pathOverlay
     * dù đã setParent đúng. Nếu layer đó khác layer của board/cell, camera có thể vẽ dash ở MỘT
     * PASS RENDER KHÁC hẳn, không còn tuân theo sibling index trong board.node nữa — toàn bộ công
     * sức ép sibling index mỗi frame (updateDashTrail) vô nghĩa với lớp vẽ sai. Gán lại layer cho
     * node VÀ toàn bộ con cháu của nó (giống hệt cách ConnectTracksHintView.cloneAtCell làm) —
     * CHỈ cần làm 1 LẦN lúc dash mới thật sự được tạo (không phải lấy lại từ pool, vì layer đã
     * đúng từ lần gán trước đó rồi). */
    private applyLayerRecursive(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyLayerRecursive(child, layer);
    }

    /** pathOverlay là CON TRỰC TIẾP của board.node, không lệch/xoay gì thêm — tọa độ LOCAL của
     * board (trainPath.ts) dùng thẳng được làm tọa độ local của dash. Xoay dash theo hướng ray
     * (xác nhận từ user: "dùng cách di chuyển giống train" — train cũng tự xoay theo pose.angleDeg,
     * xem connectTracksTrainView.applyTransform). Dùng lúc SPAWN (canh góc ngay, không có góc cũ để
     * xoay mượt từ đó) và lúc prewarm (lấp sẵn cả đường, không cần hoạt ảnh). */
    private applyDashPose(node: Node, pose: { point: Point; angleDeg: number }): void {
        node.setPosition(pose.point.x, pose.point.y, 0);
        node.angle = pose.angleDeg;
    }

    /** Dùng mỗi frame cho dash ĐANG DI CHUYỂN — xoay DẦN về góc đích thay vì gán thẳng (xác nhận từ
     * user: tốc độ xoay góc khi rẽ cần chậm hơn, tránh giật hướng đột ngột ngay tại góc rẽ). */
    private applyDashPoseSmoothed(node: Node, pose: { point: Point; angleDeg: number }, dt: number): void {
        node.setPosition(pose.point.x, pose.point.y, 0);
        node.angle = approachAngle(node.angle, pose.angleDeg, this.dashRotationSpeed * dt);
    }

    private liveDashNodes: Node[] = [];

    /** 1 lượt tay: hiện dần (opacity) ở đầu đường -> 'press' -> 'press_on' trượt dọc polyline (xem
     * updateHandTravel) tới cuối đường. Hand là con TRỰC TIẾP của board.node nên pose.point (toạ
     * độ board-local, xem trainPath.ts) dùng thẳng được, không cần đổi không gian. */
    private startHandPass(): void {
        const hand = this.handSkeleton;
        const polyline = this.travelPolyline;
        if (!hand || !polyline) return;
        this.travelDistance = this.pathStartDistance;
        const pose = poseAtDistance(polyline, this.travelDistance);
        if (pose) hand.node.setPosition(pose.point.x, pose.point.y, 0);
        hand.node.active = true;
        hand.node.setSiblingIndex(-1);
        const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(0.25, { opacity: 255 }).start();
        hand.setAnimation(0, 'press', false);
        this.travelingHand = false;
        this.scheduleOnce(() => {
            if (!this.travelPolyline) return;
            this.travelingHand = true;
            hand.setAnimation(0, 'press_on', true);
        }, 0.3);
    }

    /** Sau khi trượt xong 1 lượt: dừng 0.5s -> mờ dần (opacity) -> hiện lại ở đầu đường (opacity,
     * trong startHandPass) -> chạy lại — LẶP LIÊN TỤC cho tới khi travelPolyline bị null (thắng,
     * xem enterWonStep). Xác nhận từ user. */
    private loopHandPass(): void {
        const hand = this.handSkeleton;
        if (!hand) return;
        this.scheduleOnce(() => {
            if (!this.travelPolyline) return;
            const opacity = hand.node.getComponent(UIOpacity) ?? hand.node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            tween(opacity).to(0.25, { opacity: 0 }).call(() => {
                if (this.travelPolyline) this.startHandPass();
            }).start();
        }, 0.5);
    }

    private updateHandTravel(dt: number): void {
        const polyline = this.travelPolyline;
        const hand = this.handSkeleton;
        if (!polyline || !hand) return;
        this.travelDistance += this.handSpeed * dt;
        const pose = poseAtDistance(polyline, this.travelDistance);
        if (!pose || this.travelDistance > this.pathEndDistance) {
            this.travelingHand = false;
            this.loopHandPass();
            return;
        }
        hand.node.setSiblingIndex(-1); // pathOverlay tự ép lên -1 mỗi frame (updateDashTrail) — tay phải thắng lại SAU đó.
        hand.node.setPosition(pose.point.x, pose.point.y, 0);
    }
}

/** Xoay `current` (độ) về `target` tối đa `maxDeltaDeg`, theo đường ngắn nhất (có xét vòng -180..180). */
function approachAngle(current: number, target: number, maxDeltaDeg: number): number {
    const diff = ((target - current + 540) % 360) - 180;
    if (Math.abs(diff) <= maxDeltaDeg) return current + diff;
    return current + Math.sign(diff) * maxDeltaDeg;
}

function cellsOfGesture(gesture: PlayerGesture): readonly number[] {
    switch (gesture.kind) {
        case 'tap':
        case 'doubleTap':
        case 'trackDragBegin':
            return [gesture.cell];
        case 'emptyDragBatch':
        case 'xDragBatch':
            return gesture.cells;
        case 'trackBoundaryStep':
            return [gesture.from, gesture.to];
        default:
            return [];
    }
}

/** Correct directions at a solution-path cell, for step 4's dimmed preview only — reuses the same
 * SolutionTruth concept GameSession already exposes, computed fresh here since the controller has
 * no GameSession instance until `begin()` creates its tutorial-mode one. */
function correctDirectionsFor(cell: number): readonly [Direction, Direction] | null {
    const path = CONNECT_TRACKS_TUTORIAL_LEVEL.solutionPath;
    const index = path.indexOf(cell);
    if (index <= 0 || index >= path.length - 1) return null;
    const toward = (a: number, b: number) => directionBetween(CONNECT_TRACKS_TUTORIAL_LEVEL.size, a, b);
    const prev = toward(cell, path[index - 1]);
    const next = toward(cell, path[index + 1]);
    if (prev === null || next === null) return null;
    return [prev, next];
}
