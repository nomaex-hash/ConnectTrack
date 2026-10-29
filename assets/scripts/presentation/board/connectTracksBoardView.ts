import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Font,
    Graphics,
    Label,
    Node,
    NodePool,
    Prefab,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    error,
    instantiate,
    isValid,
    tween,
} from 'cc';
import { GamePhase, GameSnapshot } from '../../application/contracts/gameSnapshot';
import { PlayerCellState } from '../../domain/board/playerCellState';
import { buildBoardViewModel } from './boardViewModel';
import { APPEAR_DURATION, ConnectTracksCellView } from './connectTracksCellView';
import { cellAtGridPoint } from '../input/gestureCommandMapper';
import { ConnectTracksTrainView } from './connectTracksTrainView';
import { ConnectTracksPraiseEffect } from './connectTracksPraiseEffect';
import { buildTrainPolyline, traceTrainPath } from './trainPath';

const { ccclass, property } = _decorator;

/**
 * Cùng giá trị với BoardAppearTiming.ts của game gốc — mỗi ô kế tiếp theo đường chéo (row+col)
 * trễ hơn ô trước bấy nhiêu giây, giữ nguyên cảm giác bàn cờ "lan" ra lúc spawn.
 */
const APPEAR_STAGGER = 0.03;

/**
 * Board responsibilities only (per the gameplay contract, §2): grid dimensions, spawning and
 * positioning Cell instances, and reporting a raw touch as a cell index. It holds no gameplay
 * rule and no per-cell visual logic; each spawned Cell renders itself via its own
 * ConnectTracksCellView, built from the same CellViewModel this only passes through.
 *
 * This component lives on the root of the Board prefab (assets/prefabs/board/Board.prefab),
 * not on a scene-local node. A scene only drags in an instance of that prefab.
 *
 * The board's own footprint (this node's UITransform content size) is fixed, set once in the
 * Editor to match the board's art frame. Cell size is derived from it, not the other way round:
 * cellSize = boardSize / gridSize, so a 3x3 or an 8x8 level both exactly fill the same frame.
 *
 * Classifying a touch as tap, double tap or drag is UNKNOWN and is left to a separate input layer;
 * this reports only the raw cell a touch landed on.
 */
@ccclass('ConnectTracksBoardView')
export class ConnectTracksBoardView extends Component {
    @property({ type: Prefab, tooltip: 'Prefab Cell (assets/prefabs/board/Cell.prefab). Mỗi ô trên lưới sẽ spawn 1 instance của prefab này.' })
    private cellPrefab: Prefab | null = null;

    @property({ tooltip: "Kích thước thiết kế gốc (width/height, ô vuông) của prefab Cell — dùng để scale instance cho vừa kích thước ô thật (đã tính theo kích thước board)." })
    private cellPrefabNativeSize = 100;

    @property({
        type: Graphics,
        tooltip:
            'Component Graphics (trên 1 node con của Board) dùng để vẽ line chia ô ở giữa board + ' +
            'viền board — code tự vẽ lại và tự fade opacity, không cần vẽ gì sẵn trong Editor. Để ' +
            'trống thì bỏ qua, không vẽ line.',
    })
    private gridGraphics: Graphics | null = null;

    @property({ tooltip: 'Màu line (dùng chung cho line chia ô bên trong và viền board).' })
    private lineColor: Color = new Color(255, 255, 255, 160);

    @property({ tooltip: 'Độ dày (px) của line chia ô ở GIỮA board.' })
    private gridLineWidth = 2;

    @property({ tooltip: 'Độ dày (px) của line VIỀN board — nên để dày hơn gridLineWidth.' })
    private borderLineWidth = 5;

    @property({
        min: 0.01,
        tooltip:
            'Thời gian (giây) fade opacity của line board (giữa + viền) khi hiện lên — xác nhận từ ' +
            'user: chậm hơn 1 chút so với số gợi ý ở rìa board (clue), nên để LỚN HƠN APPEAR_DURATION.',
    })
    private gridFadeSeconds = 0.35;

    @property({ min: 0.1, tooltip: 'Hệ số thời gian fade line và số sau khi spawn xong. 1.25 = chậm hơn 25%.' })
    private revealDurationMultiplier = 1.25;

    @property({ min: 0.01, tooltip: 'Tổng thời gian spawn board nhiều ô (giây). Số nhỏ = nhanh.' })
    private spawnMinSeconds = 0.3;

    @property({ min: 0.01, tooltip: 'Tổng thời gian spawn board ít ô (giây). Số lớn = chậm.' })
    private spawnMaxSeconds = 0.8;

    @property({ min: 1, step: 1, tooltip: 'Board có số ô <= mốc này dùng thời gian Max.' })
    private spawnSlowCellCount = 9;

    @property({ min: 2, step: 1, tooltip: 'Board có số ô >= mốc này dùng thời gian Min.' })
    private spawnFastCellCount = 100;

    @property({ type: Prefab, tooltip: 'Prefab có Label trên node gốc hoặc node con, dùng cho số gợi ý hàng/cột. Để trống để ẩn.' })
    private clueLabelPrefab: Prefab | null = null;

    @property({ tooltip: 'Khoảng cách từ viền board tới tâm label (đơn vị local của Board).' })
    private clueOffset = 30;

    @property({
        min: 1,
        tooltip:
            'cellSize THIẾT KẾ gốc mà clueLabelPrefab được vẽ vừa mắt (đơn vị local của Board) — số ' +
            'clue co giãn theo TỈ LỆ cellSize thật / mốc này: board ÍT ô (cellSize to hơn) → số TO ' +
            'hơn; board NHIỀU ô (cellSize nhỏ hơn) → số NHỎ lại (xác nhận từ user).',
    })
    private clueLabelNativeCellSize = 64;

    @property({
        min: 0.01,
        tooltip:
            'Scale TỐI THIỂU của số clue — board càng nhiều ô thì clueScale (cellSize thật / ' +
            'clueLabelNativeCellSize) càng nhỏ, dưới mức này số bắt đầu khó đọc (xác nhận từ user: ' +
            '"khi quá nhiều cell thì chúng trông cũng quá nhỏ, chỉ cho phép nhỏ đến một mức min ' +
            'thôi") — không cho nhỏ hơn nữa dù board nhiều ô tới đâu.',
    })
    private clueScaleMin = 0.5;

    @property({ type: Color })
    private clueColor = new Color(124, 126, 150, 255);

    @property({ type: Color })
    private completedClueColor = new Color(65, 180, 90, 255);

    @property({
        min: 1,
        tooltip:
            'Phóng to tới mức nào (tỉ lệ so với clueScale hiện tại) khi số clue VỪA chuyển sang màu ' +
            'hoàn thành (xác nhận từ user: "số đó nháy 1 nhịp kiểu scale lên"). 1 = tắt hẳn hiệu ứng.',
    })
    private clueSatisfiedPulseScale = 1.35;

    @property({ min: 0.01, tooltip: 'Tổng thời gian nhịp "nháy" scale lên rồi về lại bình thường (giây) — chia đều phóng to/thu lại.' })
    private clueSatisfiedPulseSeconds = 0.28;

    @property({
        type: Label,
        tooltip:
            'Label số nổi bật (font y hệt số clue ở rìa board, nhưng là node/Label KHÁC — tự thêm ' +
            'trong Editor) — dùng để đè lên đúng số clue của 1 hàng/cột khi nó được "nhấc" (Hint ' +
            'A2/A4/A5 nhấc nguyên 1 hàng/cột, hoặc tutorial bước nhấc hàng/cột). Để trống thì bỏ qua.',
    })
    private lineClueHighlightLabel: Label | null = null;

    @property({ min: 0.01, tooltip: 'Thời gian (giây) lineClueHighlightLabel mờ dần (opacity) khi hiện/ẩn.' })
    private lineClueHighlightFadeSeconds = 0.3;

    @property({ min: 0.01, tooltip: 'lineClueHighlightLabel to hơn số clue thật ở rìa board bao nhiêu lần (1 = bằng nhau).' })
    private lineClueHighlightScale = 1.5;

    @property({
        type: ConnectTracksTrainView,
        tooltip:
            'Component ConnectTracksTrainView (đầu tàu + các toa) — tự chạy từ cổng vào tới lối ra ' +
            'ĐÚNG 1 LẦN ngay khi thắng (phase chuyển sang Won). Để trống thì bỏ qua, không có tàu.',
    })
    private train: ConnectTracksTrainView | null = null;

    @property({
        type: UITransform,
        tooltip:
            'UITransform của 1 node CÓ GẮN component Mask (Rect) — node train (ConnectTracksTrainView) ' +
            'phải là CON của chính node này trong Editor. Code tự co giãn node này khớp đúng khung lưới ' +
            'board mỗi lần đổi level, để đoạn tàu còn ở NGOÀI board (trước cổng vào / sau lối ra) bị ' +
            'che khuất, chỉ thấy phần tàu đang ở TRONG board. Để trống thì tàu không bị che gì cả.',
    })
    private trainClipArea: UITransform | null = null;

    @property({
        type: Font,
        tooltip: 'Font chữ cho số điểm "+1" bay lên mỗi khi nối đúng 1 ô đường ray. Để trống dùng font mặc định.',
    })
    private scorePopupFont: Font | null = null;

    @property({ min: 1, tooltip: 'Cỡ chữ số điểm "+1" bay lên.' })
    private scorePopupFontSize = 32;

    @property({ type: Color, tooltip: 'Màu chữ số điểm bay lên.' })
    private scorePopupColor: Color = new Color(255, 215, 0, 255);

    @property({ type: Color, tooltip: 'Màu viền ngoài chữ số điểm bay lên.' })
    private scorePopupOutlineColor: Color = new Color(100, 60, 0, 255);

    @property({ min: 0, tooltip: 'Độ dày viền ngoài chữ số điểm bay lên.' })
    private scorePopupOutlineWidth = 2;

    @property({ min: 0.01, tooltip: 'Thời gian (giây) số điểm mờ dần HIỆN lên (opacity 0 -> 255).' })
    private scorePopupFadeInSeconds = 0.15;

    @property({ min: 0, tooltip: 'Thời gian (giây) số điểm đứng yên ở opacity đầy đủ, giữa lúc hiện xong và lúc bắt đầu biến mất.' })
    private scorePopupHoldSeconds = 0.3;

    @property({ min: 0.01, tooltip: 'Thời gian (giây) số điểm mờ dần BIẾN MẤT (opacity 255 -> 0).' })
    private scorePopupFadeOutSeconds = 0.35;

    @property({ tooltip: 'Quãng đường (px, đơn vị local của Board) số điểm bay lên, tính suốt từ lúc hiện tới lúc biến mất hẳn.' })
    private scorePopupFlyDistance = 60;

    @property({
        type: Prefab,
        tooltip:
            'Prefab hiệu ứng khen khi đặt ĐÚNG track 2 lần liên tiếp trở lên (combo) — gắn component ' +
            'ConnectTracksPraiseEffect trên node GỐC của prefab này, MỌI cấu hình cấp độ/thời gian ' +
            'nằm trong chính prefab đó (xem tooltip của component). Board chỉ định vị rồi gọi play(), ' +
            'không biết gì về cấu trúc bên trong. Để trống thì không có hiệu ứng khen.',
    })
    private praisePrefab: Prefab | null = null;

    @property({ tooltip: 'Hiệu ứng khen hiện CAO HƠN viền TRÊN của board bao nhiêu (px, đơn vị local của Board) — KHÔNG hiện tại ô vừa đặt đúng nữa (xác nhận từ user).' })
    private praiseTopOffset = 40;

    @property({ min: 0.01, tooltip: 'Tỉ lệ scale của cả node hiệu ứng khen (áp lên node gốc của prefab, không phải riêng Sprite/Effect bên trong).' })
    private praiseScale = 1;

    private readonly praisePool = new NodePool();
    private activePraiseNode: Node | null = null;

    @property({ tooltip: 'Số điểm hiện lên CAO HƠN tâm ô bao nhiêu (px, đơn vị local của Board) — vị trí BẮT ĐẦU, trước khi bay thêm scorePopupFlyDistance.' })
    private scorePopupAboveOffset = 0;

    @property({
        min: 1,
        tooltip:
            'cellSize THIẾT KẾ gốc mà scorePopupFontSize/scorePopupFlyDistance được canh vừa mắt — ' +
            'số điểm co giãn theo TỈ LỆ cellSize thật / mốc này, CÙNG kiểu clueLabelNativeCellSize: ' +
            'board ÍT ô (cellSize to hơn) → số điểm TO hơn; board NHIỀU ô (cellSize nhỏ hơn) → số ' +
            'điểm NHỎ lại (xác nhận từ user).',
    })
    private scorePopupNativeCellSize = 64;

    @property({
        min: 0.01,
        tooltip:
            'Scale TỐI THIỂU của số điểm bay lên — board càng nhiều ô thì popupScale (cellSize thật ' +
            '/ scorePopupNativeCellSize) càng nhỏ, dưới mức này số bắt đầu khó đọc (xác nhận từ ' +
            'user: "khi quá nhiều cell thì chúng trông cũng quá nhỏ, chỉ cho phép nhỏ đến một mức ' +
            'min thôi") — không cho nhỏ hơn nữa dù board nhiều ô tới đâu.',
    })
    private scorePopupScaleMin = 0.5;

    private readonly scorePool = new NodePool();
    private readonly activeScoreNodes = new Set<Node>();

    private clueLabels: { node: Node; label: Label; satisfied: boolean }[] = [];
    /** Parent GỐC của lineClueHighlightLabel (ghi lại 1 lần, lúc chưa reparent lần nào) — mọi lần
     * showLineClueHighlight() reparent label sang liftLayer (TẠM, của caller — Hint/tutorial có
     * thể destroy() layer đó bất kỳ lúc nào, kể cả NGAY SAU KHI gọi hideLineClueHighlight() —
     * xem ConnectTracksHintView.close()), nên hideLineClueHighlight() PHẢI trả label về đây NGAY,
     * không đợi tween fade xong, nếu không label sẽ bị destroy() theo layer tạm đó (bug đã gặp:
     * "Cannot set properties of null (setting 'parent')" ở lần hiện kế tiếp). */
    private lineClueHighlightHomeParent: Node | null = null;
    private victoryClues = new Map<Node, { active: boolean; opacity: number }>();
    private waitingForGridFade = false;
    private readonly gridFadeState = { opacity: 0 };
    /** Tránh phát lại tàu nhiều lần nếu render() gọi lại trong lúc vẫn đang Won; reset khi
     * Restart đưa phase về Active. */
    private trainPlayed = false;
    /** 1 lần duy nhất cho rebuild() KẾ TIẾP (xem setInstantSpawn) — tự tắt lại sau khi dùng, không
     * rò rỉ sang level thật tiếp theo nếu caller (tutorial) quên gọi lại false. */
    private instantSpawnOnce = false;
    private victoryControlled = false;
    private entranceOverlay: Node | null = null;
    /** Gọi khi tàu chạy xong (xem setWonHandler/playTrain) — ConnectTracksBoardView không tự quyết
     * định mở ResultPopup, chỉ báo lại đúng thời điểm cho cấp gọi nó (GameplayScreen). */
    private wonHandler: (() => void) | null = null;

    /** Ô đang mở Track option menu (xác nhận từ user), hoặc null nếu không ô nào — Interaction
     * State do board tự giữ (giống dragPivot), KHÔNG phải Domain/GameSnapshot. */
    private selectedCell: number | null = null;
    /** Báo cho GameplayScreen (chủ của cụm option CỐ ĐỊNH, xem Node này nằm trong gameplay) mỗi
     * khi lựa chọn đổi, để nó tự hiện/ẩn + đổ dữ liệu hợp lệ cho cụm option của nó. */
    private selectedCellChangedHandler: ((cell: number | null) => void) | null = null;

    private transform: UITransform | null = null;
    private cellPressedHandler: ((cell: number) => void) | null = null;
    private width = 0;
    private height = 0;
    /** Computed each rebuild: boardSize / gridSize. Not configurable; the board's own size is. */
    private cellSize = 0;
    /** Thời gian stagger-spawn vừa tính trong rebuild() gần nhất — xem getter
     * lastSpawnDurationSeconds bên dưới. */
    private lastSpawnDuration = 0;

    /** Board vừa hiện xong (hết stagger/pop) sau lần rebuild() GẦN NHẤT mất bao lâu (giây) — 0 nếu
     * rebuild đó là instantSpawnOnce (hiện ngay, không stagger). Dùng để GameplayScreen đồng bộ
     * hiệu ứng khác (vd Encourage) chờ ĐÚNG lúc board hiện xong mới bật lên, không cần tự tính lại
     * công thức nội bộ của rebuild(). Đọc SAU KHI gọi render()/rebuild() xong (đồng bộ, không cần
     * đợi gì thêm — giá trị cập nhật ngay trong rebuild()). */
    get lastSpawnDurationSeconds(): number {
        return this.lastSpawnDuration;
    }
    private cellViews: (ConnectTracksCellView | null)[] = [];
    /** Tái sử dụng node Cell giữa các lần rebuild, giống hệt BoardView gốc (NodePool), thay vì
     * huỷ/tạo lại — giữ đúng luồng spawn của game gốc, kể cả khi đổi level khác kích thước. */
    private readonly pool = new NodePool();

    onLoad(): void {
        this.transform = this.getComponent(UITransform);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    }

    onDisable(): void {
        this.unschedule(this.fadeInGrid);
        Tween.stopAllByTarget(this.gridFadeState);
    }

    onDestroy(): void {
        Tween.stopAllByTarget(this.gridFadeState);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.cellPressedHandler = null;
        this.selectedCellChangedHandler = null;
        this.unschedule(this.fadeInGrid);
        this.releaseAllCells();
        this.pool.clear();
        this.clearClueLabels();
        for (const node of this.activeScoreNodes) {
            Tween.stopAllByTarget(node);
            // Cocos có thể đã huỷ node score (con của score layer) TRƯỚC onDestroy của board trong cùng đợt destroy cascade:
            // getComponent() trên node đã huỷ ném "Cannot read properties of null (reading 'length')" (xem clearClueLabels).
            if (!isValid(node, true)) continue;
            const opacity = node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
        }
        this.activeScoreNodes.clear();
        this.scorePool.clear();
        this.cancelActivePraiseEffect();
        this.praisePool.clear();
    }

    /** Sets where raw touch cells are reported. Unset means touches are ignored. */
    setCellPressedHandler(handler: ((cell: number) => void) | null): void {
        this.cellPressedHandler = handler;
    }

    /** The board's CURRENT cell size (px), recomputed per level in rebuild(). 0 before the first render. */
    getCellSize(): number {
        return this.cellSize;
    }

    /** Vị trí Y (world space) của VIỀN TRÊN của board NGAY LÚC GỌI (phụ thuộc cả vị trí/scale hiện
     * tại của board.node, nên gọi ĐÚNG LÚC — ví dụ trước lúc board di chuyển vào giữa màn hình thì
     * ra vị trí trong lúc chơi, gọi SAU khi di chuyển thì ra vị trí đã căn giữa). Dùng để các overlay
     * BÊN NGOÀI board (rail group, thông báo "cần nối", text thắng...) tự định vị CAO HƠN viền board
     * đúng N px, không lệ thuộc 1 vị trí Editor cố định (sai lệch khi board đổi kích thước theo từng
     * level — xem rebuild()). */
    getTopEdgeWorldY(): number {
        const gridHeight = this.height * this.cellSize;
        const uiTransform = this.getComponent(UITransform);
        if (!uiTransform) return this.node.worldPosition.y;
        const worldTop = new Vec3();
        uiTransform.convertToWorldSpaceAR(new Vec3(0, gridHeight / 2, 0), worldTop);
        return worldTop.y;
    }

    /** Draws the given snapshot. Call again after every command that changes the board. */
    prepareLevelSpawn(): void {
        this.stopVictory();
        this.width = 0;
        this.height = 0;
    }

    /** Khi true, lần rebuild() KẾ TIẾP (render() đầu tiên sau prepareLevelSpawn) bỏ hiệu ứng
     * pop/stagger từng ô + chờ fade line/số gợi ý — mọi thứ hiện NGAY, đầy đủ. Dùng khi caller tự
     * lo hiệu ứng "hiện bàn" riêng (ví dụ tutorial: fade opacity cả bàn 1 lần, xác nhận từ user —
     * không phải pop từng ô kiểu gameplay thật). Cờ tự tắt lại sau đúng 1 lần dùng.
     */
    setInstantSpawn(instant: boolean): void {
        this.instantSpawnOnce = instant;
    }

    render(snapshot: GameSnapshot): void {
        if (!this.cellPrefab) {
            error('[ConnectTracksBoardView] cellPrefab is not assigned on the Board prefab.');
            return;
        }
        if (this.width !== snapshot.width || this.height !== snapshot.height) {
            this.rebuild(snapshot.width, snapshot.height);
        }
        if (snapshot.phase !== GamePhase.Active && this.selectedCell !== null) {
            this.setSelectedCell(null);
        }
        const view = buildBoardViewModel(snapshot, this.selectedCell);
        for (const cell of view.cells) {
            this.cellViews[cell.index]?.render(cell);
        }
        // Grid is above cell backgrounds; selected borders must be above the grid.
        for (const cell of this.cellViews) cell?.raiseSelectionOutline(this.node);
        // Score popups luôn nổi TRÊN CÙNG — đẩy SAU vòng lặp viền chọn ở trên (xem getScoreEffectsLayer).
        if (this.scoreEffectsLayer && isValid(this.scoreEffectsLayer, true)) this.scoreEffectsLayer.setSiblingIndex(-1);
        this.renderClues(snapshot);

        if (snapshot.phase === GamePhase.Won && !this.victoryControlled) {
            if (!this.trainPlayed) {
                this.trainPlayed = true;
                this.playTrain(snapshot);
            }
        } else if (snapshot.phase !== GamePhase.Won && this.trainPlayed) {
            this.trainPlayed = false;
            this.train?.stop();
        }
        if (this.trainPlayed && this.train) {
            if (!this.entranceOverlay) {
                this.entranceOverlay = new Node('EntranceOverlay');
                this.entranceOverlay.layer = this.node.layer;
                this.entranceOverlay.addComponent(UITransform);
                this.entranceOverlay.parent = this.node;
            }
            this.entranceOverlay.setSiblingIndex(-1);
            for (const cell of this.cellViews) cell?.raiseEntrances(this.entranceOverlay);
        }
    }

    /**
     * Gọi `handler` ĐÚNG 1 LẦN, CHỈ SAU KHI tàu chạy xong (xác nhận từ user: đó là điều kiện thắng
     * DUY NHẤT người chơi thấy — không phải lúc GameSession chuyển Won). Nếu chưa gán `train`, hoặc
     * không dò được đường (UNKNOWN edge case: Won không đảm bảo mọi required cell nối thành ĐÚNG 1
     * đường liền mạch, xem winRule.ts), gọi `handler` NGAY LẬP TỨC thay vì để màn hình treo mãi
     * không bao giờ thắng được.
     */
    setWonHandler(handler: (() => void) | null): void {
        this.wonHandler = handler;
    }

    setVictoryControlled(controlled: boolean): void {
        this.victoryControlled = controlled;
    }

    setRailGlow(cell: number, active: boolean, opacity = 255): void {
        this.cellViews[cell]?.setRailGlow(active, opacity);
    }

    /**
     * Gọi lại mỗi khi ô đang chọn cho Track option menu đổi (mở, đổi sang ô khác, hoặc đóng hẳn —
     * null). GameplayScreen dùng callback này để hiện/ẩn + đổ dữ liệu cho cụm option CỐ ĐỊNH của nó
     * (Node này nằm trong gameplay, xác nhận từ user — board chỉ lo viền xanh trên chính ô đó).
     */
    setSelectedCellChangedHandler(handler: ((cell: number | null) => void) | null): void {
        this.selectedCellChangedHandler = handler;
    }

    /**
     * Xử lý 1 single tap (xác nhận từ user): mở Track option menu nếu ô vừa tap đang là
     * TrackPreview/Track/Track ? (Track ? vẫn có PlayerCellState.TrackPreview — xem contract),
     * tap LẠI đúng ô đang chọn thì đóng (toggle). Tap vào ô KHÁC mà thực sự đánh/xoá được dấu
     * (Empty<->X, `accepted` = true) thì đóng menu hiện có. Tap bị TỪ CHỐI hoàn toàn (RedX khoá,
     * ô given...) — `accepted` = false — không đổi gì cả: ô đó "không tương tác được" nên menu
     * đang mở (nếu có) vẫn giữ nguyên, không tự đóng (xác nhận từ user). Gọi SAU khi gesture đã
     * dispatch (CocosPointerInput), dùng snapshot MỚI NHẤT + kết quả accepted của chính lần tap đó.
     */
    handleCellTapped(cell: number, snapshot: GameSnapshot, accepted: boolean): void {
        const state = snapshot.cellStates[cell];
        const isSelectable = state === PlayerCellState.TrackPreview || state === PlayerCellState.Track;
        if (isSelectable) {
            this.setSelectedCell(this.selectedCell === cell ? null : cell);
            return;
        }
        if (!accepted) {
            return; // Rejected (e.g. RedX locked) — nothing actually happened, leave the menu as-is.
        }
        this.setSelectedCell(null);
    }

    hasOptionsSelection(): boolean { return this.selectedCell !== null; }

    /** Select a successfully placed preview without toggling an already selected cell off. */
    handlePreviewPlaced(cell: number, snapshot: GameSnapshot, accepted: boolean): void {
        if (!accepted) return;
        this.setSelectedCell(snapshot.phase === GamePhase.Active
            && snapshot.cellStates[cell] === PlayerCellState.TrackPreview ? cell : null);
    }

    /** Close options when dragging, removing a preview, or leaving the Active phase. */
    closeOptionsMenu(): void {
        this.setSelectedCell(null);
    }

    private setSelectedCell(cell: number | null): void {
        if (this.selectedCell === cell) {
            return;
        }
        this.selectedCell = cell;
        this.selectedCellChangedHandler?.(cell);
    }

    getCellWorldPosition(cell: number): Vec3 | null {
        return this.cellViews[cell]?.node.getWorldPosition() ?? null;
    }

    getHintCellNode(cell: number): Node | null {
        return this.cellViews[cell]?.node ?? null;
    }

    /** "Nối lại score trong gameplay" (xác nhận từ user) — mỗi khi người chơi hoàn thành ĐÚNG 1 ô
     * đường ray, số "+gained" hiện lên ngay tại ô đó bằng opacity (0 -> 255), bay thẳng lên
     * `scorePopupFlyDistance` rồi biến mất cũng bằng opacity (255 -> 0). Node tự quản qua NodePool,
     * không cần prefab gán trong Editor. Caller (GameplayScreen) tự quyết định KHI NÀO gọi (diff
     * snapshot trước/sau, cùng kỹ thuật AudioManager.playTrackChanges() đã dùng để phát âm). */
    spawnScorePopup(cell: number, gained: number): void {
        const view = this.cellViews[cell];
        if (!view) return;
        const node = this.acquireScoreNode();
        node.parent = this.getScoreEffectsLayer();
        node.active = true;
        node.setSiblingIndex(-1);
        this.activeScoreNodes.add(node);
        const label = node.getComponent(Label)!;
        label.string = `+${gained}`;
        // Board ÍT ô (cellSize to hơn) → số điểm TO hơn, NHIỀU ô (cellSize nhỏ hơn) → số điểm NHỎ
        // lại (xác nhận từ user) — cùng kiểu scale clueLabelNativeCellSize đã dùng cho số clue,
        // KHÔNG cho nhỏ hơn scorePopupScaleMin (xác nhận từ user — "quá nhiều cell thì trông quá nhỏ").
        const popupScale = Math.max(this.scorePopupScaleMin, this.cellSize / this.scorePopupNativeCellSize);
        node.setScale(popupScale, popupScale, 1);
        const from = view.node.position.clone();
        from.y += this.scorePopupAboveOffset;
        const to = new Vec3(from.x, from.y + this.scorePopupFlyDistance, from.z);
        node.setPosition(from);
        const opacity = node.getComponent(UIOpacity)!;
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        const total = this.scorePopupFadeInSeconds + this.scorePopupHoldSeconds + this.scorePopupFadeOutSeconds;
        tween(node).to(total, { position: to }, { easing: 'quadOut' }).call(() => this.recycleScoreNode(node)).start();
        tween(opacity)
            .to(this.scorePopupFadeInSeconds, { opacity: 255 })
            .delay(this.scorePopupHoldSeconds)
            .to(this.scorePopupFadeOutSeconds, { opacity: 0 })
            .start();
    }

    /** "Praise khi combo từ 2 lần đặt đúng liên tiếp trở lên" (xác nhận từ user). Hiện CAO HƠN viền
     * TRÊN của board (praiseTopOffset) — KHÔNG hiện tại ô vừa đặt đúng (BUG đã sửa — trước đây neo
     * theo vị trí ô, user yêu cầu đổi sang neo theo viền board). Board CHỈ định vị rồi gọi
     * ConnectTracksPraiseEffect.play() — mọi logic cấp độ/Sprite/Effect/timing nằm trong chính
     * component đó (xem connectTracksPraiseEffect.ts), board không biết gì về cấu trúc bên trong
     * prefab. `streak` là số lần đặt đúng liên tiếp hiện tại (1-based) — caller (GameplayScreen) tự
     * giữ/reset bộ đếm này.
     *
     * BUG đã sửa (xác nhận từ user — "đặt đúng liên tiếp quá nhanh thì effect chỉ nháy rồi tắt"):
     * trước đây MỖI lần gọi đều cancelActivePraiseEffect() (huỷ hẳn + trả node về pool) rồi acquire
     * node MỚI, buộc play() của component luôn chạy LẠI TỪ ĐẦU — 2 lần gọi liên tiếp trong lúc hiệu
     * ứng TRƯỚC còn dang dở sẽ cắt ngang nó. Giờ: nếu node đang active CÒN chính là
     * activePraiseNode (hiệu ứng trước chưa kết thúc tự nhiên), TÁI SỬ DỤNG THẲNG node đó — gọi lại
     * effect.play() trên CHÍNH nó, để ConnectTracksPraiseEffect tự quyết định "đang hiện rồi thì chỉ
     * đổi cấp độ + reset giờ giữ, không replay pop-in". Chỉ acquire node MỚI (qua NodePool) khi
     * KHÔNG có hiệu ứng nào đang active (cold start, hoặc hiệu ứng trước đã tự kết thúc/được recycle). */
    spawnPraiseEffect(streak: number): void {
        if (!this.praisePrefab) return;

        let node = this.activePraiseNode;
        let effect = node && isValid(node, true) ? node.getComponent(ConnectTracksPraiseEffect) : null;

        if (!node || !effect) {
            node = this.praisePool.size() > 0 ? this.praisePool.get()! : instantiate(this.praisePrefab);
            effect = node.getComponent(ConnectTracksPraiseEffect);
            if (!effect) { this.praisePool.put(node); return; }

            node.parent = this.getScoreEffectsLayer();
            node.setScale(this.praiseScale, this.praiseScale, 1);
            // Viền TRÊN của board, đơn vị local của Board (CÙNG hệ toạ độ với
            // getScoreEffectsLayer(), nằm NGAY tại gốc board) — transform.height * (1 - anchorY),
            // ĐÚNG công thức tổng quát cho mọi anchorPoint, không giả định sẵn anchor 0.5.
            const topEdgeY = this.transform ? this.transform.height * (1 - this.transform.anchorY) : 0;
            node.setPosition(0, topEdgeY + this.praiseTopOffset, 0);
            this.activePraiseNode = node;
        }

        node.active = true;
        node.setSiblingIndex(-1);
        const activeNode = node;
        effect.play(streak, () => this.recyclePraiseEffect(activeNode));
    }

    private recyclePraiseEffect(node: Node): void {
        if (this.activePraiseNode === node) this.activePraiseNode = null;
        if (!isValid(node, true)) return;
        node.active = false;
        this.praisePool.put(node);
    }

    /** Huỷ hiệu ứng khen đang chạy dở (nếu có) ngay lập tức — gọi khi 1 hiệu ứng mới chuẩn bị spawn
     * trong lúc hiệu ứng trước còn đang hiện/biến mất, và từ onDestroy() để dọn tween/schedule. */
    private cancelActivePraiseEffect(): void {
        const node = this.activePraiseNode;
        this.activePraiseNode = null;
        if (!node || !isValid(node, true)) return;
        node.getComponent(ConnectTracksPraiseEffect)?.cancel();
        node.active = false;
        this.praisePool.put(node);
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
        label.fontSize = this.scorePopupFontSize;
        label.color = this.scorePopupColor;
        label.enableOutline = true;
        label.outlineColor = this.scorePopupOutlineColor;
        label.outlineWidth = this.scorePopupOutlineWidth;
        if (this.scorePopupFont) label.font = this.scorePopupFont;
        return node;
    }

    private recycleScoreNode(node: Node): void {
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) Tween.stopAllByTarget(opacity);
        this.activeScoreNodes.delete(node);
        if (isValid(node, true)) {
            node.active = false;
            this.scorePool.put(node);
        }
    }

    private scoreEffectsLayer: Node | null = null;

    /** BUG đã sửa (báo lỗi của user: "nhãn score phải nằm trên mọi node có trên cell, hiện đang bị
     * viền xanh khi bật option đè lên") — viền chọn (raiseSelectionOutline) tự đẩy LÊN TRÊN CÙNG
     * `this.node` ở MỌI lần render() (xem vòng lặp raiseSelectionOutline bên dưới), nên nếu score
     * popup cũng là con trực tiếp của `this.node` thì y hệt 1 cuộc đua sibling index — viền chọn
     * luôn thắng vì render() chạy lại liên tục sau khi popup đã spawn. Giải pháp: cho score popup
     * sống trong 1 layer RIÊNG, và render() tự đẩy layer này lên TRÊN CÙNG, SAU vòng lặp viền chọn
     * — đảm bảo score luôn nổi trên mọi thứ khác là con của board, không chỉ viền chọn. */
    private getScoreEffectsLayer(): Node {
        if (!this.scoreEffectsLayer || !isValid(this.scoreEffectsLayer, true)) {
            const layer = new Node('ScoreEffectsLayer');
            layer.layer = this.node.layer;
            layer.addComponent(UITransform);
            layer.parent = this.node;
            this.scoreEffectsLayer = layer;
        }
        return this.scoreEffectsLayer;
    }

    /** Đè lineClueHighlightLabel (gán sẵn trong Editor) lên ĐÚNG vị trí + giá trị số clue thật của
     * 1 hàng/cột, to hơn `lineClueHighlightScale` lần, rồi fade opacity 0→255 lên — dùng khi
     * hàng/cột đó được "nhấc" (Hint A2/A4/A5 nhấc nguyên 1 hàng/cột, hoặc tutorial bước nhấc
     * hàng/cột). `liftLayer` PHẢI là layer đã nhấc lên trên nền đen (cùng world position/scale với
     * board.node — xác nhận từ user: "label này phải được nhấc lên trên nền đen") — reparent vào
     * đó rồi copy thẳng local position/scale của số thật, không cần quy đổi world↔local vì 2 layer
     * dùng chung world transform với board. Gọi lại nhiều lần (ví dụ đổi hàng khác) chỉ cần gọi
     * show lại — tự di chuyển/đổi số, không cần hide() trước. */
    showLineClueHighlight(axis: 'row' | 'column', line: number, liftLayer: Node): void {
        const label = this.lineClueHighlightLabel;
        if (!label || !isValid(label.node, true)) return;
        const index = axis === 'row' ? line : this.height + line;
        const source = this.clueLabels[index];
        if (!source) return;
        if (!this.lineClueHighlightHomeParent) this.lineClueHighlightHomeParent = label.node.parent;
        label.string = source.label.string;
        label.node.parent = liftLayer;
        label.node.setPosition(source.node.position);
        const scale = this.lineClueHighlightScale;
        label.node.setScale(source.node.scale.x * scale, source.node.scale.y * scale, source.node.scale.z);
        label.node.active = true;
        const opacity = label.node.getComponent(UIOpacity) ?? label.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        tween(opacity).to(this.lineClueHighlightFadeSeconds, { opacity: 255 }).start();
    }

    /** Ẩn lineClueHighlightLabel (fade opacity về 0 rồi active=false) — gọi khi hàng/cột không còn
     * được nhấc nữa (đóng Hint, hoặc tutorial rời bước nhấc hàng/cột). No-op nếu đang ẩn sẵn. */
    hideLineClueHighlight(): void {
        const label = this.lineClueHighlightLabel;
        if (!label || !isValid(label.node, true)) return;
        // Trả về parent GỐC (an toàn, sống lâu dài) NGAY LẬP TỨC — không đợi tween fade xong — vì
        // caller (Hint/tutorial) có thể destroy() layer tạm đang chứa label này bất kỳ lúc nào sau
        // khi gọi hàm này, kể cả trong CÙNG 1 lệnh đồng bộ (xem ghi chú ở lineClueHighlightHomeParent).
        if (this.lineClueHighlightHomeParent && isValid(this.lineClueHighlightHomeParent, true)) {
            // keepWorldTransform=true — đổi parent nhưng KHÔNG giật vị trí/scale trên màn hình,
            // fade vẫn tiếp tục mượt ở đúng chỗ cũ dù label đã "chuyển nhà" an toàn.
            label.node.setParent(this.lineClueHighlightHomeParent, true);
        }
        if (!label.node.active) return;
        const opacity = label.node.getComponent(UIOpacity) ?? label.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        tween(opacity).to(this.lineClueHighlightFadeSeconds, { opacity: 0 }).call(() => {
            if (isValid(label.node, true)) label.node.active = false;
        }).start();
    }

    /** Tutorial-only (confirmed by the user): a named overlay child living INSIDE this cell's own
     * Cell.prefab instance (e.g. "TutorialHighlight", "TutorialEntranceArrow", "TutorialExitArrow",
     * "TutorialEntranceCircle", "TutorialExitCircle") — authored once per prefab, so every spawned
     * cell already carries its own correctly-positioned copy; the tutorial only needs to toggle
     * `active` (and resize/offset for the multi-cell highlight case), no runtime position math. */
    getTutorialCellOverlay(cell: number, name: string): Node | null {
        return this.cellViews[cell]?.node.getChildByName(name) ?? null;
    }

    /** Tutorial-only: the single shared Hand (Spine) node living directly in Board.prefab itself
     * (named "TutorialHand", confirmed by the user — NOT duplicated per cell, since it must travel
     * freely across the whole board, including the step-10b continuous slide along the solution
     * path). A direct child of this board node, so board-local coordinates can be assigned to it
     * directly without any world/local conversion. */
    getTutorialHandNode(): Node | null {
        return this.node.getChildByName('TutorialHand');
    }

    /** Tutorial-only cleanup: turns off every cell's tutorial overlay children on EVERY cell, so a
     * pooled Cell instance reused by the next REAL level never shows a leftover active tutorial
     * highlight/arrow/circle (confirmed by the user: these overlays live inside the shared
     * Cell.prefab, and cell instances are recycled through the board's own NodePool). */
    clearTutorialOverlays(): void {
        const names = ['TutorialHighlight', 'TutorialEntranceArrow', 'TutorialExitArrow',
            'TutorialEntranceCircle', 'TutorialExitCircle'];
        for (const view of this.cellViews) {
            if (!view) continue;
            for (const name of names) {
                const node = view.node.getChildByName(name);
                if (node) node.active = false;
            }
        }
    }

    setHintTracksHidden(cells: readonly number[], hidden: boolean): void {
        for (const cell of cells) {
            const view = this.cellViews[cell];
            if (view && isValid(view, true)) view.setHintTrackHidden(hidden);
        }
    }

    setVictoryMarksFade(progress: number): void {
        for (const cell of this.cellViews) if (cell?.isValid) cell.setVictoryMarkFade(progress);
    }

    /** Uniformly fit the grid into its former grid + outside-label footprint. Measure before hiding clues. */
    getVictoryScaleMultiplier(): number {
        const width = this.width * this.cellSize, height = this.height * this.cellSize;
        if (!(width > 0 && height > 0)) return 1;
        let left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2;
        const point = new Vec3(), world = new Vec3();
        for (const { node, label } of this.clueLabels) {
            if (!isValid(node, true) || !node.activeInHierarchy || !isValid(label, true)) continue;
            const transform = label.node.getComponent(UITransform);
            if (!transform) continue;
            for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) {
                point.set((x - transform.anchorX) * transform.width, (y - transform.anchorY) * transform.height, 0);
                transform.convertToWorldSpaceAR(point, world);
                this.node.inverseTransformPoint(point, world);
                left = Math.min(left, point.x); right = Math.max(right, point.x);
                bottom = Math.min(bottom, point.y); top = Math.max(top, point.y);
            }
        }
        // Preserve square cells; for unequal footprints the tighter axis limits the zoom.
        return Math.max(1, Math.min((right - left) / width, (top - bottom) / height));
    }

    /** Fade the outside clues with the HUD, without fading the grid or tracks. */
    setVictoryCluesFade(progress: number): void {
        const t = Math.max(0, Math.min(1, progress));
        for (const { node } of this.clueLabels) {
            if (!isValid(node, true)) continue;
            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            if (!this.victoryClues.has(node)) {
                this.victoryClues.set(node, { active: node.active, opacity: opacity.opacity });
                Tween.stopAllByTarget(opacity);
            }
            const saved = this.victoryClues.get(node)!;
            opacity.opacity = saved.opacity * (1 - t);
            node.active = saved.active && t < 1;
        }
    }

    stopVictory(): void {
        for (const [node, saved] of this.victoryClues) {
            if (!isValid(node, true)) continue;
            node.active = saved.active;
            const opacity = node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = saved.opacity;
        }
        this.victoryClues.clear();
        this.train?.stop();
        this.trainPlayed = false;
        for (const cell of this.cellViews) if (cell?.isValid) {
            cell.setRailGlow(false);
            cell.restoreVictoryMark();
        }
    }

    playVictoryTrain(snapshot: GameSnapshot, finished: () => void): void {
        this.trainPlayed = true;
        this.playTrain(snapshot, finished);
        if (!this.entranceOverlay) {
            this.entranceOverlay = new Node('EntranceOverlay');
            this.entranceOverlay.layer = this.node.layer;
            this.entranceOverlay.addComponent(UITransform);
            this.entranceOverlay.parent = this.node;
        }
        this.entranceOverlay.setSiblingIndex(-1);
        for (const cell of this.cellViews) cell?.raiseEntrances(this.entranceOverlay);
    }

    /** Dò đường từ cổng vào tới lối ra rồi cho tàu chạy dọc theo — xem trainPath.ts. */
    private playTrain(snapshot: GameSnapshot, finished = this.wonHandler): void {
        const train = this.train;
        const path = train ? traceTrainPath(snapshot) : null;
        const entranceEntry = snapshot.mainTrackPorts.find((entry) => entry.cell === snapshot.entranceCell);
        const exitEntry = snapshot.mainTrackPorts.find((entry) => entry.cell === snapshot.exitCell);
        if (!train || !path || !entranceEntry?.outward || !exitEntry?.outward) {
            finished?.();
            return;
        }
        const polyline = buildTrainPolyline(
            path,
            snapshot.width,
            snapshot.height,
            this.cellSize,
            entranceEntry.outward,
            exitEntry.outward,
        );
        // BUG đã sửa (báo lỗi của user: "board nhiều ô tàu chạy rất nhanh, board ít ô tàu đi chậm")
        // — tốc độ KHÔNG còn tính theo px/giây cố định (từng thử bù bằng board.node.scale.x rồi
        // worldScale.x, vẫn lệch) nữa — ConnectTracksTrainView.play() giờ nhận cellSize của CHÍNH
        // màn này và tự quy đổi tốc độ cấu hình theo SỐ Ô/giây sang px/giây local, không cần biết gì
        // về scale hiển thị của board nữa (xem comment ở play()).

        // LOG TẠM ĐỂ DEBUG (theo yêu cầu user — xem tốc độ tàu tuỳ theo từng màn) — xoá cùng lúc với
        // log tương ứng ở ConnectTracksTrainView.play(). Ghép cùng gridWidth/gridHeight để thấy rõ
        // board "nhiều ô" (grid lớn) so với "ít ô" (grid nhỏ) đang có cellSize khác nhau thế nào.

        train.play(polyline, path.length, () => finished?.(), this.node, this.cellSize);
    }

    private clearClueLabels(): void {
        this.victoryClues.clear();
        for (const entry of this.clueLabels) {
            // Cocos may already have destroyed child components before the parent's onDestroy.
            if (!isValid(entry.node, true)) continue;
            const opacity = entry.node.getComponent(UIOpacity);
            if (opacity) Tween.stopAllByTarget(opacity);
            entry.node.destroy();
        }
        this.clueLabels = [];
    }

    private renderClues(snapshot: GameSnapshot): void {
        const prefab = this.clueLabelPrefab;
        if (!prefab) return;
        const clues = snapshot.rowClues.concat(snapshot.columnClues);
        if (this.clueLabels.length !== clues.length) {
            this.clearClueLabels();
            for (let i = 0; i < clues.length; i++) {
                const node = instantiate(prefab);
                const label = node.getComponent(Label) ?? node.getComponentInChildren(Label);
                if (!label) {
                    node.destroy();
                    this.clearClueLabels();
                    error('[ConnectTracksBoardView] clueLabelPrefab needs a Label on its root or a child.');
                    return;
                }
                node.parent = this.node;
                node.active = true;
                // Runtime instances must use the board's UI layer, including nested Label nodes.
                const applyLayer = (child: Node): void => {
                    child.layer = this.node.layer;
                    for (const nested of child.children) applyLayer(nested);
                };
                applyLayer(node);
                const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
                opacity.opacity = this.waitingForGridFade ? 0 : 255;
                this.clueLabels.push({ node, label, satisfied: false });
            }
        }
        const halfWidth = snapshot.width * this.cellSize / 2;
        const halfHeight = snapshot.height * this.cellSize / 2;
        // Board ÍT ô (cellSize to hơn) → số TO hơn, NHIỀU ô (cellSize nhỏ hơn) → số NHỎ lại (xác
        // nhận từ user) — tỉ lệ thẳng theo cellSize thật / cellSize thiết kế gốc của prefab, nhưng
        // KHÔNG cho nhỏ hơn clueScaleMin (xác nhận từ user — "quá nhiều cell thì số trông quá nhỏ").
        const clueScale = Math.max(this.clueScaleMin, this.cellSize / this.clueLabelNativeCellSize);
        clues.forEach((clue, index) => {
            const entry = this.clueLabels[index];
            const { node, label } = entry;
            const isRow = index < snapshot.height;
            const line = isRow ? index : index - snapshot.height;
            node.name = `${isRow ? 'Row' : 'Column'}Clue_${line}`;
            node.setPosition(
                isRow ? -halfWidth - this.clueOffset : -halfWidth + (line + 0.5) * this.cellSize,
                isRow ? halfHeight - (line + 0.5) * this.cellSize : halfHeight + this.clueOffset,
                0,
            );
            node.setScale(clueScale, clueScale, 1);
            label.string = String(clue.required);
            label.color = clue.satisfied ? this.completedClueColor : this.clueColor;
            // "Khi 1 hàng/cột được đặt đủ track và số chuyển sang màu xanh thì số đó nháy 1 nhịp
            // kiểu scale lên" (xác nhận từ user) — CHỈ đúng lúc VỪA chuyển satisfied false -> true
            // (so với lần render() TRƯỚC — clueLabels tự nhớ `satisfied` của chính nó), không phải
            // mỗi lần render lại mà clue đã satisfied từ trước.
            if (clue.satisfied && !entry.satisfied) this.pulseClue(node, clueScale);
            entry.satisfied = clue.satisfied;
        });
    }

    /** Phóng to rồi thu lại ĐÚNG 1 nhịp — gọi khi 1 số clue VỪA chuyển sang hoàn thành (xem
     * renderClues()). `baseScale` là clueScale hiện tại (đổi theo cellSize mỗi level) — nhịp nháy
     * LUÔN quay về đúng mốc này, không phải scale cố định 1. */
    private pulseClue(node: Node, baseScale: number): void {
        Tween.stopAllByTarget(node);
        const peak = baseScale * this.clueSatisfiedPulseScale;
        const half = this.clueSatisfiedPulseSeconds / 2;
        tween(node)
            .to(half, { scale: new Vec3(peak, peak, 1) }, { easing: 'quadOut' })
            .to(half, { scale: new Vec3(baseScale, baseScale, 1) }, { easing: 'quadIn' })
            .start();
    }

    /**
     * (Re)spawns one Cell prefab instance per cell, sized to exactly fill the board's own fixed
     * footprint. Reuses nodes via a NodePool and plays the same "appear" scale-in tween as the
     * original game's CellView.playAppear (APPEAR_DURATION/backOut), staggered by Manhattan
     * distance from the board's centre (confirmed by the user: starts at the middle 5-cell plus,
     * ripples outward). Stagger and per-cell duration scale together to fit the configured
     * total spawn time, decreasing from Max to Min as the number of cells increases.
     */
    private rebuild(width: number, height: number): void {
        const prefab = this.cellPrefab;
        const transform = this.transform;
        if (!prefab || !transform) {
            return;
        }
        this.releaseAllCells();
        this.trainPlayed = false;
        this.train?.stop();
        this.setSelectedCell(null);
        this.width = width;
        this.height = height;
        this.cellViews = new Array(width * height).fill(null);

        // The board's footprint is fixed (set in the Editor); cell size is derived from it, and
        // kept square by taking the smaller of the two axis-based sizes so a non-square grid still
        // fits inside the frame instead of overflowing one axis.
        const boardWidth = transform.width;
        const boardHeight = transform.height;
        this.cellSize = Math.min(boardWidth / width, boardHeight / height);
        const scale = this.cellSize / this.cellPrefabNativeSize;
        const gridWidth = width * this.cellSize;
        const gridHeight = height * this.cellSize;

        // Lan ra từ GIỮA bàn: ô chính giữa (hoặc cụm giữa, nếu width/height chẵn) hiện trước, các
        // ô cách đó 1 bước (lên/xuống/trái/phải — đúng 5 ô hình dấu cộng ở board lẻ cả 2 chiều) hiện
        // kế tiếp, rồi lan dần ra ngoài theo khoảng cách Manhattan — thay vì lan theo đường chéo từ
        // góc trên-trái như trước.
        const centerRow = (height - 1) / 2;
        const centerColumn = (width - 1) / 2;
        const instant = this.instantSpawnOnce;
        this.instantSpawnOnce = false;
        const minSeconds = Math.max(0.01, Math.min(this.spawnMinSeconds, this.spawnMaxSeconds));
        const maxSeconds = Math.max(minSeconds, this.spawnMinSeconds, this.spawnMaxSeconds);
        const slowCount = Math.max(1, this.spawnSlowCellCount);
        const fastCount = Math.max(slowCount + 1, this.spawnFastCellCount);
        const progress = Math.max(0, Math.min(1, (width * height - slowCount) / (fastCount - slowCount)));
        const spawnDuration = instant ? 0 : maxSeconds + (minSeconds - maxSeconds) * progress;
        // Lưu lại cho lastSpawnDurationSeconds (getter công khai) — GameplayScreen đọc giá trị NÀY
        // (không tự tính lại công thức) để đồng bộ hiệu ứng khác (vd Encourage) chờ ĐÚNG lúc board
        // hiện xong mới bật lên, xem comment ở getter.
        this.lastSpawnDuration = spawnDuration;
        // Scale both stagger and pop together, preserving the existing center-out rhythm.
        const timingScale = instant ? 0 : spawnDuration / ((centerRow + centerColumn) * APPEAR_STAGGER + APPEAR_DURATION);

        for (let index = 0; index < width * height; index++) {
            const column = index % width;
            const row = Math.floor(index / width);
            const node = this.pool.size() > 0 ? this.pool.get()! : instantiate(prefab);
            node.name = `Cell_${index}`;
            node.parent = this.node;
            node.active = true;
            node.setPosition(
                -gridWidth / 2 + (column + 0.5) * this.cellSize,
                gridHeight / 2 - (row + 0.5) * this.cellSize,
                0,
            );
            const view = node.getComponent(ConnectTracksCellView);
            this.cellViews[index] = view;

            if (instant) {
                view?.showInstant(scale);
            } else {
                const delay = (Math.abs(row - centerRow) + Math.abs(column - centerColumn)) * APPEAR_STAGGER * timingScale;
                view?.playAppear(delay, scale, APPEAR_DURATION * timingScale);
            }
        }

        this.drawGrid(width, height, gridWidth, gridHeight);
        // Khung Mask của tàu phải khớp ĐÚNG kích thước lưới hiện tại (không phải UITransform cố
        // định của Board) — co giãn lại mỗi lần đổi level, như gridGraphics.
        if (this.trainClipArea) {
            this.trainClipArea.setContentSize(gridWidth, gridHeight);
            this.trainClipArea.node.setSiblingIndex(-1);
        }
        this.waitingForGridFade = true;
        for (const { node } of this.clueLabels) {
            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 0;
        }
        // Wait for the final cell's delay AND appear animation before revealing line/clues.
        this.unschedule(this.fadeInGrid);
        this.scheduleOnce(this.fadeInGrid, spawnDuration);
    }

    /**
     * Vẽ line chia ô ở giữa board (mỏng, gridLineWidth) + viền board (dày hơn, borderLineWidth) —
     * cùng màu lineColor, cùng 1 component Graphics. Line chỉ fade sau khi toàn bộ cell spawn xong;
     * số gợi ý fade nối tiếp sau line.
     */
    private drawGrid(width: number, height: number, gridWidth: number, gridHeight: number): void {
        const graphics = this.gridGraphics;
        if (!graphics) {
            return;
        }
        graphics.node.active = true;
        // Mỗi Cell có nền riêng (Background, không trong suốt) — line ở GIỮA board sẽ bị các ô đè
        // kín nếu đứng dưới chúng trong cây con của Board. Luôn đẩy lên sibling CUỐI CÙNG (vẽ sau
        // cùng = nổi trên cùng) mỗi lần rebuild(), vì pool tái dùng/thêm lại node Cell liên tục.
        graphics.node.setSiblingIndex(-1);
        const opacity = graphics.node.getComponent(UIOpacity) ?? graphics.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        // Graphics stores stroke color in its vertices. Fade the stroke itself, not UIOpacity.
        opacity.opacity = 255;
        Tween.stopAllByTarget(this.gridFadeState);
        this.gridFadeState.opacity = 0;
        this.drawGridStroke(width, height, gridWidth, gridHeight, 0);
    }

    private drawGridStroke(width: number, height: number, gridWidth: number, gridHeight: number, alpha: number): void {
        const graphics = this.gridGraphics;
        if (!graphics) return;
        graphics.clear();
        // Làm tròn mọi toạ độ về số nguyên (pixel) — cellSize thường là số lẻ (vd 83.333px), nếu vẽ
        // đúng toạ độ lẻ đó, line rơi vào nửa pixel, bị khử răng cưa (anti-alias) làm MỜ ĐI so với
        // line vô tình rơi đúng pixel nguyên. Làm tròn cho mọi line đều nét như nhau.
        const left = Math.round(-gridWidth / 2);
        const right = Math.round(gridWidth / 2);
        const top = Math.round(gridHeight / 2);
        const bottom = Math.round(-gridHeight / 2);

        graphics.lineWidth = this.gridLineWidth;
        graphics.strokeColor = new Color(this.lineColor.r, this.lineColor.g, this.lineColor.b,
            Math.round(this.lineColor.a * Math.max(0, Math.min(255, alpha)) / 255));
        for (let col = 1; col < width; col++) {
            const x = Math.round(left + col * this.cellSize);
            graphics.moveTo(x, bottom);
            graphics.lineTo(x, top);
        }
        for (let row = 1; row < height; row++) {
            const y = Math.round(bottom + row * this.cellSize);
            graphics.moveTo(left, y);
            graphics.lineTo(right, y);
        }
        graphics.stroke();

        graphics.lineWidth = this.borderLineWidth;
        graphics.moveTo(left, bottom);
        graphics.lineTo(right, bottom);
        graphics.lineTo(right, top);
        graphics.lineTo(left, top);
        graphics.lineTo(left, bottom);
        graphics.stroke();

    }

    /** Line board fade trước (gridFadeSeconds, chậm hơn clue) — clue (số gợi ý) chỉ fade NỐI TIẾP
     * sau khi line fade xong, không cùng lúc (xác nhận từ user). */
    private readonly fadeInGrid = (): void => {
        if (!this.gridGraphics) {
            this.fadeInClues();
            return;
        }
        Tween.stopAllByTarget(this.gridFadeState);
        tween(this.gridFadeState)
            .to(this.gridFadeSeconds * this.revealDurationMultiplier, { opacity: 255 }, {
                onUpdate: () => this.drawGridStroke(this.width, this.height,
                    this.width * this.cellSize, this.height * this.cellSize, this.gridFadeState.opacity),
            })
            .call(() => this.fadeInClues())
            .start();
    };

    private fadeInClues(): void {
        this.waitingForGridFade = false;
        for (const { node } of this.clueLabels) {
            const clueOpacity = node.getComponent(UIOpacity);
            if (!clueOpacity) continue;
            Tween.stopAllByTarget(clueOpacity);
            tween(clueOpacity).to(APPEAR_DURATION * this.revealDurationMultiplier, { opacity: 255 }).start();
        }
    }

    /** Trả toàn bộ ô đang hiện về pool để tái sử dụng ở lần rebuild() kế tiếp. */
    private releaseAllCells(): void {
        for (const view of this.cellViews) {
            // Cocos destroys child components before the board's onDestroy.
            // Their fields have already been cleared; never recycle or pool them.
            if (!view || !isValid(view, true)) continue;
            const node = view.node;
            if (!isValid(node, true)) continue;
            view.recycle();
            this.pool.put(node);
        }
        this.cellViews = [];
    }

    private onTouchEnd(event: EventTouch): void {
        const handler = this.cellPressedHandler;
        const transform = this.transform;
        if (!handler || !transform || this.width === 0 || this.cellSize === 0) {
            return;
        }
        const location = event.getUILocation();
        const local = transform.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0));
        const gridWidth = this.width * this.cellSize;
        const gridHeight = this.height * this.cellSize;
        const gridX = local.x + gridWidth / 2;
        const gridY = gridHeight / 2 - local.y;
        const cell = cellAtGridPoint({ width: this.width, height: this.height }, this.cellSize, gridX, gridY);
        if (cell !== null) {
            handler(cell);
        }
    }
}
