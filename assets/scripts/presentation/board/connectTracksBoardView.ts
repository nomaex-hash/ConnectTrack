import {
    _decorator,
    Color,
    Component,
    EventTouch,
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

    @property({ type: Color })
    private clueColor = new Color(124, 126, 150, 255);

    @property({ type: Color })
    private completedClueColor = new Color(65, 180, 90, 255);

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

    private clueLabels: { node: Node; label: Label }[] = [];
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
    }

    /** Sets where raw touch cells are reported. Unset means touches are ignored. */
    setCellPressedHandler(handler: ((cell: number) => void) | null): void {
        this.cellPressedHandler = handler;
    }

    /** The board's CURRENT cell size (px), recomputed per level in rebuild(). 0 before the first render. */
    getCellSize(): number {
        return this.cellSize;
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

    setRailGlow(cell: number, active: boolean, opacity = 131): void {
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
        const clues = [...snapshot.rowClues, ...snapshot.columnClues];
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
                this.clueLabels.push({ node, label });
            }
        }
        const halfWidth = snapshot.width * this.cellSize / 2;
        const halfHeight = snapshot.height * this.cellSize / 2;
        clues.forEach((clue, index) => {
            const { node, label } = this.clueLabels[index];
            const isRow = index < snapshot.height;
            const line = isRow ? index : index - snapshot.height;
            node.name = `${isRow ? 'Row' : 'Column'}Clue_${line}`;
            node.setPosition(
                isRow ? -halfWidth - this.clueOffset : -halfWidth + (line + 0.5) * this.cellSize,
                isRow ? halfHeight - (line + 0.5) * this.cellSize : halfHeight + this.clueOffset,
                0,
            );
            label.string = String(clue.required);
            label.color = clue.satisfied ? this.completedClueColor : this.clueColor;
        });
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
