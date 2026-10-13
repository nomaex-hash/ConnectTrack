import { _decorator, Color, Component, Node, Sprite, Tween, UIOpacity, UITransform, Vec3, isValid, sp, tween } from 'cc';
import { Direction } from '../../domain/board/direction';
import { CellViewModel, EntranceRole } from './boardViewModel';
import { trackOrientationOf, TrackOrientation } from './trackOrientation';

const { ccclass, property } = _decorator;

/**
 * Mark/X dùng CHUNG 1 node Spine (icon_X) cho cả X thường và RedX. Phân biệt bằng animation;
 * Active_correct và Idle_correct dùng correctMarkColor (mặc định #7C7E96), các clip còn lại dùng màu gốc. Cơ chế đổi clip theo
 * assets/scripts/ui/board/CellView.ts của game gốc: skin "default" + 4 animation clip
 * Active_correct/Idle_correct (X thường) và Active_false/Idle_false (RedX).
 *
 * Khôi phục lại ĐÚNG cách game gốc tách biệt 2 trường hợp (xem CellView.playMarkSpineCorrect vs
 * CellView.playMarkSpine/showWrongMarkSpine — phần "tim vỡ" dùng spine riêng không áp dụng ở đây):
 *   - X ĐÚNG: phát Active_correct rồi Idle_correct, CỘNG THÊM hiệu ứng pop — scale nhỏ (×0.4) phóng
 *     lên scale gốc (easing backOut) + opacity mờ→đậm, cùng lúc, trong POP_SECONDS.
 *   - RedX (SAI): phát Active_false rồi Idle_false, hiện THẲNG (không pop, không mờ dần).
 */
const SPINE_TRACK = 0;
const MARK_ANIM_APPEAR = 'Active_correct';
const MARK_ANIM_IDLE = 'Idle_correct';
const WRONG_ANIM_APPEAR = 'Active_false';
const WRONG_ANIM_IDLE = 'Idle_false';
type MarkKind = 'none' | 'correct' | 'false';

/** Dùng chung cho mọi hiệu ứng pop-in/pop-out đơn giản (Mark/X đúng, pop-out lúc biến mất). */
const POP_FROM_SCALE = 0.4;
const POP_SECONDS = 0.22;

/**
 * Hiệu ứng "bounce" (xác nhận từ user): phóng to hơn scale gốc 1 chút (overshoot), đập xuống nhỏ
 * hơn scale gốc 1 chút (undershoot), rồi về đúng scale gốc — cộng với opacity mờ→đậm suốt 3 chặng.
 * Dùng cho TrackPreview, Track ?, và từng phần Sleeper/Rail của 1 Track hoàn chỉnh.
 */
const BOUNCE_OVERSHOOT_SCALE = 1.15;
const BOUNCE_UNDERSHOOT_SCALE = 0.9;

/**
 * Unit vector (local X, Y) pointing from this cell's centre toward its outward edge. The Entrance
 * node's position is computed from this every render (× entranceReachRatio × cellSize), not
 * authored once in the Editor — cellSize is recomputed per level, so a fixed Editor position could
 * only ever be right for one board size.
 */
const ENTRANCE_OFFSET_BY_DIRECTION: Readonly<Record<Direction, readonly [number, number]>> = {
    [Direction.Up]: [0, 1],
    [Direction.Down]: [0, -1],
    [Direction.Left]: [-1, 0],
    [Direction.Right]: [1, 0],
};

/**
 * entranceIn/entranceOut được vẽ sẵn trong Editor cho ĐÚNG 1 hướng tham chiếu — xác nhận từ bằng
 * chứng thực tế (màn có entrance ở cạnh TRÊN thì đúng hướng, cạnh khác thì sai), hướng tham chiếu
 * đó là Up. Code phải tự xoay thêm phần chênh lệch giữa Up và edgeDirection thật của từng ô —
 * cùng quy ước với node.angle/atan2 (dương = ngược kim đồng hồ, 0° = hướng +X).
 */
const ENTRANCE_AUTHORED_DIRECTION: Direction = Direction.Up;

const ANGLE_DEG_BY_DIRECTION: Readonly<Record<Direction, number>> = {
    [Direction.Right]: 0,
    [Direction.Up]: 90,
    [Direction.Left]: 180,
    [Direction.Down]: -90,
};

/**
 * Cùng giá trị với hiệu ứng "hiện ô" của game gốc (xem assets/scripts/ui/board/CellView.ts,
 * APPEAR_DURATION) — giữ nguyên cảm giác spawn, chỉ đổi logic gameplay bên trong ô.
 */
export const APPEAR_DURATION = 0.22;

/**
 * Renders one Cell from a CellViewModel. Pure presentation: every value it shows comes from the
 * view model, and it makes no gameplay decision (it never reads Solution Truth or mutates state).
 *
 * Each possible shape is its own fixed node with its own sprite already assigned in the Editor;
 * this component only turns the right one on and the rest off. It never swaps a SpriteFrame.
 */
@ccclass('ConnectTracksCellView')
export class ConnectTracksCellView extends Component {
    private hintHiddenTracks = new Map<Node, boolean>();

    /** Hide only original player-track art while a Hint overlays a replacement shape. */
    setHintTrackHidden(hidden: boolean): void {
        if (!hidden) {
            for (const [node, active] of this.hintHiddenTracks) if (isValid(node, true)) node.active = active;
            this.hintHiddenTracks.clear();
            return;
        }
        for (const node of [this.trackPreview, this.questionTop, this.questionBottom, this.questionLeft,
            this.questionRight, this.straightHorizontal, this.straightVertical, this.curveTopLeft,
            this.curveTopRight, this.curveBottomLeft, this.curveBottomRight]) {
            if (!node || !isValid(node, true)) continue;
            if (!this.hintHiddenTracks.has(node)) this.hintHiddenTracks.set(node, node.active);
            node.active = false;
        }
    }
    private initialRenderPending = true;
    private renderingInitialState = false;
    @property({
        type: Node,
        tooltip:
            'Background — node nền của ô (có component Sprite). Dùng để tô màu khác cho ô thuộc ' +
            'given (ô cho sẵn, xem Main Track) so với ô thường — để trống thì bỏ qua, không tô màu gì.',
    })
    private background: Node | null = null;

    @property({ tooltip: 'Màu nền của ô THƯỜNG (không thuộc given).' })
    private normalBackgroundColor: Color = new Color(109, 109, 109);

    @property({ tooltip: 'Màu nền của ô THUỘC GIVEN (ô cho sẵn — xem Main Track) — khác màu ô thường để người chơi nhận ra ngay.' })
    private givenBackgroundColor: Color = new Color(109, 109, 60);

    @property({
        type: Node,
        tooltip:
            'Sprite viền xanh — hiện khi ô này đang được chọn cho Track option menu (xác nhận từ ' +
            'user: single tap vào ô TrackPreview/Track/Track ? mở menu chọn hình dạng track, đồng ' +
            'thời hiện viền xanh ở ô đó). Để trống thì bỏ qua, không hiện viền.',
    })
    private selectedOutline: Node | null = null;

    // Track/Main: 2 ô đầu mút cố định của Main Track. 6 node con, mỗi node 1 hình cố định.
    @property({ type: Node, tooltip: 'Track/Main/StraightHorizontal. Hiện khi 2 port cố định của Main Track là Left+Right.' })
    private mainStraightHorizontal: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Main/StraightVertical. Hiện khi 2 port cố định của Main Track là Up+Down.' })
    private mainStraightVertical: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Main/CurveTopLeft. Hiện khi 2 port cố định của Main Track là Up+Left.' })
    private mainCurveTopLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Main/CurveTopRight. Hiện khi 2 port cố định của Main Track là Up+Right.' })
    private mainCurveTopRight: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Main/CurveBottomLeft. Hiện khi 2 port cố định của Main Track là Down+Left.' })
    private mainCurveBottomLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Main/CurveBottomRight. Hiện khi 2 port cố định của Main Track là Down+Right.' })
    private mainCurveBottomRight: Node | null = null;

    // Track/Entrance: mũi tên đánh dấu hướng tàu vào/ra, neo sát cạnh TRONG của board. 2 NODE
    // RIÊNG (xác nhận từ user) — "in" chỉ hiện ở đúng ô s[0] (tàu đi vào), "out" chỉ hiện ở đúng
    // ô s[-1] (tàu đi ra); không bao giờ cả 2 cùng active trên 1 ô. CẢ 2 node được vẽ trong Editor
    // ĐÚNG HƯỚNG CHO CẠNH TRÊN (Up) — code tự bật/tắt, TỰ ĐỊNH VỊ theo cellSize hiện tại, VÀ TỰ
    // XOAY cho đúng cạnh thật của từng ô (xem ENTRANCE_AUTHORED_DIRECTION — màn chỉ có entrance ở
    // cạnh trên mới đúng hướng "miễn phí", cạnh khác cần code xoay thêm, xác nhận từ ảnh thực tế).
    @property({
        type: Node,
        tooltip:
            'Track/Entrance/In — mũi tên TÀU ĐI VÀO, vẽ trong Editor theo hướng cạnh TRÊN (Up). Chỉ ' +
            'hiện ở ô s[0]. Code tự bật/tắt, định vị VÀ xoay theo cạnh thật của ô (không cần vẽ lại ' +
            'cho từng hướng).',
    })
    private entranceIn: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Track/Entrance/Out — mũi tên TÀU ĐI RA, vẽ trong Editor theo hướng cạnh TRÊN (Up). Chỉ ' +
            'hiện ở ô s[-1]. Code tự bật/tắt, định vị VÀ xoay theo cạnh thật của ô (không cần vẽ lại ' +
            'cho từng hướng).',
    })
    private entranceOut: Node | null = null;

    private raisedSelection: { node: Node; parent: Node; sibling: number } | null = null;

    /** Raise only the selection sprite above the grid, preserving its world transform. */
    raiseSelectionOutline(layer: Node): void {
        const node = this.selectedOutline;
        if (!node || !isValid(node, true) || !node.active || !node.parent) return;
        if (!this.raisedSelection) {
            this.raisedSelection = { node, parent: node.parent, sibling: node.getSiblingIndex() };
            node.setParent(layer, true);
        }
        node.setSiblingIndex(-1);
    }

    private restoreSelectionOutline(): void {
        const entry = this.raisedSelection;
        this.raisedSelection = null;
        if (!entry || !isValid(entry.node, true) || !isValid(entry.parent, true)) return;
        entry.node.setParent(entry.parent, true);
        entry.node.setSiblingIndex(entry.sibling);
    }

    private raisedEntrances: {
        node: Node; parent: Node; sibling: number;
        position: Vec3; scale: Vec3; eulerAngles: Vec3;
    }[] = [];

    /** Only the gate art is raised above the train, never the cell background or rail. */
    raiseEntrances(layer: Node): void {
        // Defensive: a pooled instance reused across a dev-server hot reload can have this field's
        // class-field initializer skipped (the patched class isn't re-constructed on an existing
        // instance) — seen in practice as "this.raisedEntrances is not iterable" from restoreEntrances.
        if (!this.raisedEntrances) {
            this.raisedEntrances = [];
        }
        for (const node of [this.entranceIn, this.entranceOut]) {
            if (!node?.active || !node.parent || node.parent === layer) continue;
            this.raisedEntrances.push({
                node, parent: node.parent, sibling: node.getSiblingIndex(),
                position: node.position.clone(), scale: node.scale.clone(), eulerAngles: node.eulerAngles.clone(),
            });
            node.setParent(layer, true);
        }
    }

    private restoreEntrances(): void {
        if (!this.raisedEntrances) {
            this.raisedEntrances = [];
            return;
        }
        for (const { node, parent, sibling, position, scale, eulerAngles } of this.raisedEntrances) {
            if (!node.isValid || !parent.isValid) continue;
            // World-transform decomposition may represent negative Y scale as a 180-degree
            // rotation + negative X. applyEntrance overwrites rotation, so restore the exact
            // local pose before rotating for the next cell/level.
            node.setParent(parent);
            node.setPosition(position);
            node.setScale(scale);
            node.setRotationFromEuler(eulerAngles);
            node.setSiblingIndex(sibling);
        }
        this.raisedEntrances = [];
    }

    @property({
        range: [0, 0.5, 0.01],
        slide: true,
        tooltip:
            'Entrance lệch khỏi TÂM ô bao nhiêu, tính theo tỉ lệ cellSize hiện tại, để ghim vào cạnh ' +
            'TRONG của board — 0.5 = đúng mép ngoài ô (không nên vượt quá, sẽ lồi ra khỏi board). ' +
            'Đang để thấp (0.3) để chắc chắn nằm trong board — tăng dần nếu còn quá sâu vào giữa ô.',
    })
    private entranceReachRatio = 0.3;

    @property({ type: Node, tooltip: 'Track/preview. Hiện khi ô đang là TrackPreview và chưa có connection nào (kết quả double-tap, trước khi kéo).' })
    private trackPreview: Node | null = null;

    /** Đang hiện trackPreview hay không — tránh phát lại hiệu ứng mỗi lần render() nếu trạng thái
     * không đổi (chỉ phát lúc MỚI bật/tắt). */
    private trackPreviewVisible = false;

    // Track/Straight: 2 node con. Mỗi node giờ có 2 con riêng "Sleeper" và "Rail" (xác nhận từ
    // user) — code tự tìm qua getChildByName, không cần thêm property mới.
    @property({ type: Node, tooltip: 'Track/Straight/Horizontal (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Left+Right (Track thẳng nằm ngang).' })
    private straightHorizontal: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Straight/Vertical (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Up+Down (Track thẳng nằm dọc).' })
    private straightVertical: Node | null = null;

    // Track/Curve: 4 node con, mỗi node cũng có 2 con riêng "Sleeper" và "Rail".
    @property({ type: Node, tooltip: 'Track/Curve/TopLeft (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Up+Left.' })
    private curveTopLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Curve/TopRight (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Up+Right.' })
    private curveTopRight: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Curve/BottomLeft (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Down+Left.' })
    private curveBottomLeft: Node | null = null;

    @property({ type: Node, tooltip: 'Track/Curve/BottomRight (có 2 con sleeper + rail). Hiện khi ô có 2 connection là Down+Right.' })
    private curveBottomRight: Node | null = null;

    /** Orientation Track hoàn chỉnh đang hiện (null = chưa có) — biết khi nào THỰC SỰ đổi để phát
     * lại chuỗi Sleeper -> Rail, không phát lại mỗi lần render() nếu orientation không đổi. */
    private trackOrientationShown: TrackOrientation | null = null;

    // Track/Track?: 4 node con, theo hướng của connection duy nhất đã biết.
    @property({ type: Node, tooltip: "Track/Track?/Top. Hiện khi ô là Track ? (1 connection) và hướng đã biết là Up." })
    private questionTop: Node | null = null;

    @property({ type: Node, tooltip: "Track/Track?/Bottom. Hiện khi ô là Track ? (1 connection) và hướng đã biết là Down." })
    private questionBottom: Node | null = null;

    @property({ type: Node, tooltip: "Track/Track?/Left. Hiện khi ô là Track ? (1 connection) và hướng đã biết là Left." })
    private questionLeft: Node | null = null;

    @property({ type: Node, tooltip: "Track/Track?/Right. Hiện khi ô là Track ? (1 connection) và hướng đã biết là Right." })
    private questionRight: Node | null = null;

    /** Hướng Track ? đang hiện (null = chưa có) — xem trackOrientationShown, cùng lý do. */
    private questionDirectionShown: Direction | null = null;

    @property({
        type: Node,
        tooltip:
            'Mark/X (icon_X, component sp.Skeleton) — dùng CHUNG cho cả X thường và RedX, KHÔNG ' +
            'cần node riêng cho RedX. Hiện khi PlayerCellState là X HOẶC ô đang RedX (bị khoá do ' +
            'đặt sai). Code tự chuyển animation: Active_correct → Idle_correct khi X thường, ' +
            'Active_false → Idle_false khi RedX — cần Spine data icon_X có đủ 4 clip này.',
    })
    private markX: Node | null = null;

    @property({ type: Color, tooltip: 'Màu dấu X cho Active_correct và Idle_correct. Không đổi màu RedX.' })
    private correctMarkColor: Color = new Color(124, 126, 150, 255);

    @property({ min: 0.01, tooltip: 'Thời gian hiện TrackPreview (giây). Nhỏ hơn = nhanh hơn.' })
    private trackPreviewAppearSeconds = 0.12;

    @property({ min: 0.01, tooltip: 'Thời gian hiện mỗi phần sleeper/rail và Track ? (giây). Track đủ hai phần chạy nối tiếp nên tổng thời gian gấp đôi.' })
    private trackAppearSeconds = 0.12;

    /** Animation clip đang hiện trên markX ('none' = node đang tắt) — tránh phát lại animation Appear
     * mỗi lần render() nếu kind không đổi (chỉ phát lúc MỚI chuyển sang X/RedX). */
    private markKind: MarkKind = 'none';
    private victoryMarkOpacity: number | null = null;
    private victoryMarkActive = false;

    /** Cosmetic only: preserve both ordinary X and wrong-mark gameplay state. */
    setVictoryMarkFade(progress: number): void {
        const node = this.markX;
        if (!node?.isValid || this.markKind === 'none') return;
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        if (this.victoryMarkOpacity === null) {
            this.victoryMarkOpacity = opacity.opacity;
            this.victoryMarkActive = node.active;
            Tween.stopAllByTarget(opacity);
        }
        opacity.opacity = this.victoryMarkOpacity * (1 - Math.max(0, Math.min(1, progress)));
        // Opacity alone does not stop Spine updates. Remove invisible marks from the active tree.
        if (progress >= 1) node.active = false;
    }

    restoreVictoryMark(): void {
        if (this.victoryMarkOpacity !== null && this.markX?.isValid) {
            const opacity = this.markX.getComponent(UIOpacity);
            if (opacity) opacity.opacity = this.victoryMarkOpacity;
            this.markX.active = this.victoryMarkActive;
        }
        this.victoryMarkOpacity = null;
    }

    /** Scale GỐC (lúc authoring) của từng node — lấy 1 lần duy nhất trước khi tween đầu tiên đụng
     * tới, để biết tween phải phóng NGƯỢC LẠI đúng scale nào (không phải luôn là 1,1). Dùng chung
     * cho mọi node có hiệu ứng (markX, trackPreview, Track ?, Sleeper/Rail…) thay vì 1 field riêng
     * cho từng node. */
    private readonly baseScaleCache = new WeakMap<Node, Vec3>();

    private baseScaleOf(node: Node): Vec3 {
        let scale = this.baseScaleCache.get(node);
        if (!scale) {
            scale = new Vec3(node.scale.x, node.scale.y, node.scale.z);
            this.baseScaleCache.set(node, scale);
        }
        return scale;
    }

    /**
     * Hiệu ứng "hiện ô" lúc spawn — y hệt game gốc (CellView.playAppear): scale từ 0 phóng lên
     * finalScale (easing backOut), trễ theo `delay` (board tự tính stagger theo đường chéo
     * row+col). Chỉ gọi lúc spawn/acquire ô mới, không gọi lại ở mỗi lần render() thông thường.
     */
    playAppear(delay: number, finalScale: number, duration = APPEAR_DURATION): void {
        this.initialRenderPending = true;
        this.restoreEntrances();
        this.setRailGlow(false);
        Tween.stopAllByTarget(this.node);
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 0;
        this.node.setScale(0, 0, 1);
        tween(this.node)
            .delay(delay)
            .call(() => { opacity.opacity = 255; })
            .to(duration, { scale: new Vec3(finalScale, finalScale, 1) }, { easing: 'backOut' })
            .start();
    }

    /** Spawn tức thì, không pop/stagger — dùng khi caller (ví dụ tutorial) tự lo hiệu ứng "hiện
     * bàn" riêng (xem ConnectTracksBoardView.setInstantSpawn), thay vì để từng ô tự pop lên. */
    showInstant(finalScale: number): void {
        this.initialRenderPending = true;
        this.restoreEntrances();
        this.setRailGlow(false);
        Tween.stopAllByTarget(this.node);
        const opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        this.node.setScale(finalScale, finalScale, 1);
    }

    /** Dọn trạng thái trước khi trả ô về pool để tái sử dụng (huỷ tween dở, nếu có). */
    recycle(): void {
        this.restoreSelectionOutline();
        this.setHintTrackHidden(false);
        this.restoreVictoryMark();
        this.setRailGlow(false);
        this.restoreEntrances();
        Tween.stopAllByTarget(this.node);
        this.stopNodeTween(this.markX);
        this.stopNodeTween(this.trackPreview);
        this.markKind = 'none';
        this.trackPreviewVisible = false;
        this.questionDirectionShown = null;
        this.trackOrientationShown = null;
    }

    /**
     * Optional art nodes authored by the user under each Track/Main orientation.
     *
     * Bug (regression): recycle() calls this during ConnectTracksBoardView.releaseAllCells(), which
     * can itself run from onDestroy() while Cocos is already tearing down the whole board subtree
     * (e.g. navigating back to Home mid-level) — by the time `visit` recurses into some child, that
     * child node may already be destroyed, and a destroyed Node's `.children` throws instead of
     * returning []. Guard every node with isValid(..., true) (strict: catches a node mid-destroy,
     * not just one already fully gone) before touching it, same pattern as
     * ConnectTracksBoardView.clearClueLabels.
     */
    setRailGlow(active: boolean, opacity = 131): void {
        const visit = (node: Node): void => {
            if (!isValid(node, true)) {
                return;
            }
            for (const child of node.children) {
                if (!isValid(child, true)) {
                    continue;
                }
                if (child.name.toLowerCase() === 'glowingsleeper') {
                    const fade = child.getComponent(UIOpacity) ?? child.addComponent(UIOpacity);
                    fade.opacity = active ? Math.max(0, Math.min(131, opacity)) : 0;
                    child.active = active;
                }
                else visit(child);
            }
        };
        visit(this.node);
    }

    /** Draws this cell. Call again whenever its view model changes. */
    render(cell: CellViewModel): void {
        this.restoreSelectionOutline();
        const hideForHint = this.hintHiddenTracks.size > 0;
        if (hideForHint) this.setHintTrackHidden(false);
        this.renderingInitialState = this.initialRenderPending;
        this.applyBackground(cell);
        this.setActive(this.selectedOutline, cell.isOptionMenuSelected);
        this.applyMark(cell);
        this.applyTrackPreview(cell);

        this.applyMain(trackOrientationOf(cell.mainPortDirections));
        this.applyEntrance(cell.entranceRole, cell.entranceDirection);
        this.applyQuestion(cell.trackQuestionDirection);

        const orientation =
            cell.visual === 'track' || cell.trackDirections.length === 2
                ? trackOrientationOf(cell.trackDirections)
                : null;
        this.applyTrack(orientation);
        this.initialRenderPending = false;
        this.renderingInitialState = false;
        if (hideForHint) this.setHintTrackHidden(true);
    }

    /** Ô thuộc given (có mainPortDirections, bất kể là s[0]/s[-1] hay ô cho sẵn ở giữa) tô màu nền
     * khác — xác nhận từ user. */
    private applyBackground(cell: CellViewModel): void {
        const sprite = this.background?.getComponent(Sprite);
        if (!sprite) {
            return;
        }
        const isGivenCell = cell.mainPortDirections.length > 0;
        sprite.color = isGivenCell ? this.givenBackgroundColor : this.normalBackgroundColor;
    }

    private trackNodeFor(orientation: TrackOrientation | null): Node | null {
        switch (orientation) {
            case 'straightHorizontal':
                return this.straightHorizontal;
            case 'straightVertical':
                return this.straightVertical;
            case 'curveTopLeft':
                return this.curveTopLeft;
            case 'curveTopRight':
                return this.curveTopRight;
            case 'curveBottomLeft':
                return this.curveBottomLeft;
            case 'curveBottomRight':
                return this.curveBottomRight;
            default:
                return null;
        }
    }

    /**
     * Track hoàn chỉnh: mỗi orientation giờ có 2 con "Sleeper" và "Rail" (xác nhận từ user) — lúc
     * MỚI xuất hiện (hoặc đổi hướng, kể cả do redirect), Sleeper hiện trước với hiệu ứng bounce,
     * NGAY KHI XONG mới hiện Rail với CÙNG hiệu ứng — không hiện cả cụm cùng lúc như trước.
     * Không phát lại chuỗi này nếu orientation render() gọi lại mà không đổi.
     */
    private applyTrack(orientation: TrackOrientation | null): void {
        if (orientation === this.trackOrientationShown) {
            this.setActive(this.straightHorizontal, orientation === 'straightHorizontal');
            this.setActive(this.straightVertical, orientation === 'straightVertical');
            this.setActive(this.curveTopLeft, orientation === 'curveTopLeft');
            this.setActive(this.curveTopRight, orientation === 'curveTopRight');
            this.setActive(this.curveBottomLeft, orientation === 'curveBottomLeft');
            this.setActive(this.curveBottomRight, orientation === 'curveBottomRight');
            return;
        }
        for (const node of [
            this.straightHorizontal,
            this.straightVertical,
            this.curveTopLeft,
            this.curveTopRight,
            this.curveBottomLeft,
            this.curveBottomRight,
        ]) {
            this.resetTrackPieceVisual(node);
        }
        const next = this.trackNodeFor(orientation);
        if (next) {
            this.revealTrackPiece(next);
        }
        this.trackOrientationShown = orientation;
    }

    /** sleeper hiện trước (bounce), xong mới lập tức hiện rail cùng hiệu ứng. */
    private revealTrackPiece(node: Node): void {
        node.active = true;
        const sleeper = node.getChildByName('sleeper');
        const rail = node.getChildByName('rail');
        if (this.renderingInitialState) {
            if (sleeper) this.showSpawnPart(sleeper);
            if (rail) this.showSpawnPart(rail);
            return;
        }
        if (rail) {
            this.hideInstant(rail);
        }
        if (sleeper) {
            this.playBounceAppear(sleeper, () => {
                if (rail) this.playBounceAppear(rail);
            });
        } else if (rail) {
            this.playBounceAppear(rail);
        }
    }

    /** Tắt hẳn 1 track piece (và con sleeper/rail của nó, nếu có) — không hiệu ứng, dùng khi đổi
     * sang orientation khác hoặc không còn Track hoàn chỉnh nữa. */
    private resetTrackPieceVisual(node: Node | null): void {
        if (!node) {
            return;
        }
        this.hideInstant(node.getChildByName('sleeper'));
        this.hideInstant(node.getChildByName('rail'));
        this.setActive(node, false);
    }

    private applyMain(orientation: TrackOrientation | null): void {
        this.setActive(this.mainStraightHorizontal, orientation === 'straightHorizontal');
        this.setActive(this.mainStraightVertical, orientation === 'straightVertical');
        this.setActive(this.mainCurveTopLeft, orientation === 'curveTopLeft');
        this.setActive(this.mainCurveTopRight, orientation === 'curveTopRight');
        this.setActive(this.mainCurveBottomLeft, orientation === 'curveBottomLeft');
        this.setActive(this.mainCurveBottomRight, orientation === 'curveBottomRight');
        if (this.renderingInitialState) {
            for (const node of [this.mainStraightHorizontal, this.mainStraightVertical, this.mainCurveTopLeft,
                this.mainCurveTopRight, this.mainCurveBottomLeft, this.mainCurveBottomRight]) {
                if (!node?.active) continue;
                this.showSpawnPart(node);
                for (const name of ['sleeper', 'rail']) {
                    const part = node.getChildByName(name);
                    if (part) this.showSpawnPart(part);
                }
            }
        }
    }

    /**
     * Bật ĐÚNG 1 trong 2 node (entranceIn ở ô s[0], entranceOut ở ô s[-1], theo `role`), tắt node
     * còn lại — không bao giờ cả 2 cùng active trên 1 ô. Định vị + XOAY node đang dùng theo
     * `edgeDirection` (hướng outward thật — cạnh vật lý của ô).
     *
     * entranceIn/entranceOut chỉ được vẽ đúng hướng cho CẠNH TRÊN (xác nhận từ ảnh thực tế: màn có
     * entrance ở cạnh trên hiện đúng, màn có entrance ở cạnh khác lại sai) — một sprite tĩnh không
     * thể đúng hướng cho cả 4 cạnh cùng lúc, nên code phải tự xoay thêm phần chênh lệch góc giữa
     * ENTRANCE_AUTHORED_DIRECTION (Up) và edgeDirection thật của ô này.
     *
     * Vị trí = tâm ô dịch ra theo edgeDirection, xa bằng entranceReachRatio × kích thước GỐC (chưa
     * scale) của chính node ô này (UITransform.width) — KHÔNG phải cellSize cuối cùng trên màn
     * hình. Lý do (tìm được từ ảnh thực tế — màn 5 đúng, màn khác lệch xa hơn viền): node Cell cha
     * tự nó đã bị SCALE theo cellSize/cellPrefabNativeSize (xem
     * ConnectTracksBoardView.rebuild → playAppear(delay, scale, …)) — nếu dùng cellSize (giá trị
     * ĐÃ nhân scale) để đặt vị trí LOCAL của entrance, vị trí đó lại bị nhân scale THÊM 1 LẦN NỮA
     * lúc render, khiến độ lệch thực tế trên màn hình bị bình phương theo cellSize: chỉ "tình cờ"
     * đúng khi scale ≈ 1 (ô to, ít cột/hàng, như màn 5), sai dần khi scale nhỏ (ô nhỏ, nhiều cột/
     * hàng). Dùng kích thước GỐC thì scale chỉ nhân đúng 1 lần, luôn đúng tỉ lệ ở mọi kích thước
     * board — chỉnh entranceReachRatio trong Editor nếu vẫn chưa sát cạnh board.
     */
    private applyEntrance(role: EntranceRole, edgeDirection: Direction | null): void {
        this.restoreEntrances();
        const node = role === 'in' ? this.entranceIn : role === 'out' ? this.entranceOut : null;
        this.setActive(this.entranceIn, role === 'in');
        this.setActive(this.entranceOut, role === 'out');
        if (!node || edgeDirection === null) {
            return;
        }
        const [unitX, unitY] = ENTRANCE_OFFSET_BY_DIRECTION[edgeDirection];
        const nativeSize = this.node.getComponent(UITransform)?.width ?? 100;
        const reach = nativeSize * this.entranceReachRatio;
        node.setPosition(unitX * reach, unitY * reach, 0);
        node.angle = ANGLE_DEG_BY_DIRECTION[edgeDirection] - ANGLE_DEG_BY_DIRECTION[ENTRANCE_AUTHORED_DIRECTION];
    }

    /**
     * X thường và RedX dùng CHUNG 1 node Spine (markX) — bật/tắt theo "có cần hiện X không" rồi
     * chuyển đúng cặp animation Appear + Idle tuỳ có khoá (RedX) hay không. Không có node
     * WrongMark riêng, theo đúng cách node icon_X đã được dựng sẵn trong Cell.prefab (xác nhận
     * từ user). Chỉ phát lại khi kind THỰC SỰ đổi — giữ nguyên animation Idle đang chạy, hoặc
     * animation pop đang chạy dở, nếu render() gọi lại mà kind không đổi.
     *
     * Bỏ đánh dấu (X -> Empty bằng tap): KHÔNG tắt node ngay — chạy hiệu ứng pop-out (scale+opacity
     * xuống) rồi mới ẩn, đối xứng với lúc xuất hiện (xác nhận từ user).
     *
     * X -> TrackPreview (bằng double-tap): tắt mark NGAY LẬP TỨC, không pop-out — TrackPreview tự
     * pop-in đè lên cùng lúc (xác nhận từ user: "tắt mark luôn và hiện track preview đè lên").
     */
    private applyMark(cell: CellViewModel): void {
        const visible = cell.visual === 'x' || cell.isLocked;
        const kind: MarkKind = !visible ? 'none' : cell.isLocked ? 'false' : 'correct';
        if (kind === this.markKind) {
            this.setActive(this.markX, visible); // Giữ đúng trạng thái active, kể cả lần render() đầu tiên.
            return;
        }
        if (kind === 'none') {
            if (cell.visual === 'trackPreview') {
                this.hideInstant(this.markX);
            } else {
                this.playShrinkExit(this.markX);
            }
        } else {
            this.setActive(this.markX, true);
            this.playMarkAnimation(kind);
        }
        this.markKind = kind;
    }

    private playMarkAnimation(kind: 'correct' | 'false'): void {
        const node = this.markX;
        const skeleton = node?.getComponent(sp.Skeleton);
        if (!node || !skeleton) {
            return;
        }
        const baseScale = this.baseScaleOf(node);

        const appearClip = kind === 'correct' ? MARK_ANIM_APPEAR : WRONG_ANIM_APPEAR;
        const idleClip = kind === 'correct' ? MARK_ANIM_IDLE : WRONG_ANIM_IDLE;
        // Apply tint when a clip starts, including the queued idle transition.
        // White leaves the original Spine artwork colors unchanged (including RedX).
        skeleton.setStartListener((entry) => {
            skeleton.color = entry.animation?.name === MARK_ANIM_APPEAR || entry.animation?.name === MARK_ANIM_IDLE
                ? this.correctMarkColor
                : new Color(255, 255, 255, 255);
        });
        skeleton.color = kind === 'correct'
            ? this.correctMarkColor
            : new Color(255, 255, 255, 255);
        if (this.renderingInitialState) {
            skeleton.setAnimation(SPINE_TRACK, idleClip, true);
            this.showSpawnPart(node);
            return;
        }
        skeleton.setAnimation(SPINE_TRACK, appearClip, false);
        skeleton.addAnimation(SPINE_TRACK, idleClip, true);

        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);

        if (kind === 'correct') {
            node.setScale(baseScale.x * POP_FROM_SCALE, baseScale.y * POP_FROM_SCALE, baseScale.z);
            opacity.opacity = 0;
            tween(node).to(POP_SECONDS, { scale: baseScale }, { easing: 'backOut' }).start();
            tween(opacity).to(POP_SECONDS, { opacity: 255 }).start();
        } else {
            // RedX: hiện THẲNG, không pop, không mờ dần — đúng game gốc (showWrongMarkSpine).
            node.setScale(baseScale);
            opacity.opacity = 255;
        }
    }

    /**
     * Track/preview: hiệu ứng bounce (xem hằng số BOUNCE_*) khi xuất hiện. Biến mất (bị thay thế —
     * ví dụ đủ 1 connection thành Track ?, đủ 2 thành Track hoàn chỉnh, hoặc Restart): chạy pop-out
     * (chỉ giảm scale, không fade opacity) rồi mới tắt — trạng thái TRƯỚC khi đổi phải có
     * hiệu ứng biến mất kiểu này, không tắt NGAY.
     */
    private applyTrackPreview(cell: CellViewModel): void {
        const visible = cell.visual === 'trackPreview' && cell.trackDirections.length === 0;
        if (visible === this.trackPreviewVisible) {
            this.setActive(this.trackPreview, visible);
            return;
        }
        if (visible && this.trackPreview) {
            this.playBounceAppear(this.trackPreview, undefined, this.trackPreviewAppearSeconds, false, true);
        } else {
            this.playShrinkExit(this.trackPreview, false);
        }
        this.trackPreviewVisible = visible;
    }

    private questionNodeFor(direction: Direction | null): Node | null {
        switch (direction) {
            case Direction.Up:
                return this.questionTop;
            case Direction.Down:
                return this.questionBottom;
            case Direction.Left:
                return this.questionLeft;
            case Direction.Right:
                return this.questionRight;
            default:
                return null;
        }
    }

    /** Track ?: cùng hiệu ứng bounce khi MỚI hiện ở 1 hướng. Đổi hướng (hoặc biến mất): hướng CŨ
     * chạy pop-out (scale+opacity giảm dần) trước khi tắt — cùng nguyên tắc với TrackPreview. */
    private applyQuestion(direction: Direction | null): void {
        if (direction === this.questionDirectionShown) {
            this.setActive(this.questionTop, direction === Direction.Up);
            this.setActive(this.questionRight, direction === Direction.Right);
            this.setActive(this.questionBottom, direction === Direction.Down);
            this.setActive(this.questionLeft, direction === Direction.Left);
            return;
        }
        const previous = this.questionNodeFor(this.questionDirectionShown);
        if (previous) {
            this.playShrinkExit(previous);
        }
        const next = this.questionNodeFor(direction);
        if (next) {
            this.playBounceAppear(next);
        }
        this.questionDirectionShown = direction;
    }

    /**
     * Hiệu ứng bounce dùng chung: scale gốc -> overshoot (lớn hơn) -> undershoot (nhỏ hơn) -> scale
     * gốc, cộng opacity mờ -> đậm suốt 3 chặng (xác nhận từ user). `onComplete` chạy ngay khi chặng
     * cuối xong — dùng để nối tiếp Sleeper -> Rail.
     */
    private playBounceAppear(node: Node, onComplete?: () => void, duration = this.trackAppearSeconds, fadeOpacity = true, startOversized = false): void {
        if (this.renderingInitialState) {
            this.showSpawnPart(node);
            onComplete?.();
            return;
        }
        const seconds = Number.isFinite(duration) ? Math.max(0.01, duration) : 0.12;
        const stageSeconds = seconds / (startOversized ? 2 : 3);
        node.active = true;
        const baseScale = this.baseScaleOf(node);
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        const overshootScale = startOversized ? 1.05 : BOUNCE_OVERSHOOT_SCALE;
        const overshoot = new Vec3(baseScale.x * overshootScale, baseScale.y * overshootScale, baseScale.z);
        const undershootScale = startOversized ? 0.95 : BOUNCE_UNDERSHOOT_SCALE;
        const undershoot = new Vec3(baseScale.x * undershootScale, baseScale.y * undershootScale, baseScale.z);
        node.setScale(startOversized ? overshoot : baseScale);
        opacity.opacity = fadeOpacity ? 0 : 255;
        const bounce = tween(node);
        // Preview starts already enlarged: no initial grow-in stage.
        if (!startOversized) bounce.to(stageSeconds, { scale: overshoot }, { easing: 'quadOut' });
        bounce
            .to(stageSeconds, { scale: undershoot }, { easing: 'quadInOut' })
            .to(stageSeconds, { scale: baseScale }, { easing: 'quadOut' })
            .call(() => onComplete?.())
            .start();
        if (fadeOpacity) tween(opacity).to(seconds, { opacity: 255 }).start();
    }

    /** Pop-out đơn giản: scale thu nhỏ (quadIn) + opacity mờ dần, xong mới thật sự tắt node và trả
     * scale/opacity về gốc. Dùng cho Mark/X (bỏ đánh dấu bằng tap) và TrackPreview (biến mất). */
    private playShrinkExit(node: Node | null, fadeOpacity = true): void {
        if (this.renderingInitialState) {
            this.hideInstant(node);
            return;
        }
        if (!node) {
            return;
        }
        const baseScale = this.baseScaleOf(node);
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(node);
        Tween.stopAllByTarget(opacity);
        const shrink = new Vec3(baseScale.x * POP_FROM_SCALE, baseScale.y * POP_FROM_SCALE, baseScale.z);
        if (!fadeOpacity) {
            opacity.opacity = 255;
            tween(node)
                .to(POP_SECONDS, { scale: shrink }, { easing: 'quadIn' })
                .call(() => {
                    node.active = false;
                    node.setScale(baseScale);
                })
                .start();
            return;
        }
        tween(node).to(POP_SECONDS, { scale: shrink }, { easing: 'quadIn' }).start();
        tween(opacity)
            .to(POP_SECONDS, { opacity: 0 })
            .call(() => {
                node.active = false;
                node.setScale(baseScale);
                opacity.opacity = 255;
            })
            .start();
    }

    /** Tắt NGAY, không hiệu ứng, và trả scale/opacity về gốc (nếu đã biết gốc) — dùng khi 1 hiệu
     * ứng khác đã/sẽ che mất sự biến mất này (ví dụ TrackPreview đè lên Mark/X). */
    private hideInstant(node: Node | null): void {
        if (!node) {
            return;
        }
        this.stopNodeTween(node);
        node.active = false;
        const baseScale = this.baseScaleCache.get(node);
        if (baseScale) {
            node.setScale(baseScale);
        }
    }

    private stopNodeTween(node: Node | null): void {
        if (!node) {
            return;
        }
        Tween.stopAllByTarget(node);
        const opacity = node.getComponent(UIOpacity);
        if (opacity) {
            Tween.stopAllByTarget(opacity);
            opacity.opacity = 255;
        }
    }

    private setActive(node: Node | null, active: boolean): void {
        if (node && node.active !== active) {
            node.active = active;
        }
    }

    private showSpawnPart(node: Node): void {
        this.stopNodeTween(node);
        node.setScale(this.baseScaleOf(node));
        node.active = true;
    }
}
