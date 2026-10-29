import { _decorator, Component, Node, Prefab, Tween, UIOpacity, UITransform, Vec3, instantiate, isValid, tween } from 'cc';
import { GameSession } from '../../application/session/gameSession';
import { GameSnapshot } from '../../application/contracts/gameSnapshot';
import { ConnectTracksBoardView } from './connectTracksBoardView';
import { buildTrainPolyline } from './trainPath';
import { buildPolylineSampler, PolylineSampler, SampledPose } from './polylineSampler';
import { interpolateByGridSize } from './gridSizeInterpolation';
const { ccclass, property } = _decorator;

/**
 * "Sau khi tìm hết track preview, nếu 5s không thao tác thì hiện đường nối (dash chạy dọc đường ray
 * + 2 chấm tròn xanh nhấp nháy ở entrance/exit), giống hệt hiệu ứng step 10b ở Tutorial" (xác nhận
 * từ user). Đây là bản PORT riêng cho gameplay thật, dùng CHUNG các hàm polyline (trainPath.ts) và
 * CÙNG 2 node overlay có sẵn trong Cell.prefab ("TutorialEntranceCircle"/"TutorialExitCircle" —
 * KHÔNG phải tutorial-only thật sự, chỉ là tên đặt từ lúc tutorial dùng trước, mọi cell đều có sẵn
 * bản sao riêng) — KHÔNG đụng/sửa gì ConnectTracksTutorialController, tránh rủi ro hồi quy luồng
 * tutorial đã test kỹ. Không có tay Spine (xác nhận từ user: chỉ dash + 2 chấm tròn).
 */
@ccclass('ConnectTracksIdleConnectHint')
export class ConnectTracksIdleConnectHint extends Component {
    @property({ type: Prefab, tooltip: 'Prefab 1 dấu gạch ngang xanh (dash) — GIỐNG HỆT dashPrefab của Tutorial, code tự spawn nhiều bản chạy dọc đường ray.' })
    dashPrefab: Prefab | null = null;

    @property({
        min: 2,
        tooltip:
            'Cạnh lưới (max(width, height)) được coi là ÍT cell: ở mức này (hoặc nhỏ hơn) mọi thông số Min/Max ' +
            'bên dưới lấy giá trị MAX (cell to). Level thật hiện có lưới 6x6 → 10x10.',
    })
    fewCellsGridSize = 6;
    @property({
        min: 2,
        tooltip:
            'Cạnh lưới (max(width, height)) được coi là NHIỀU cell: ở mức này (hoặc lớn hơn) mọi thông số Min/Max ' +
            'bên dưới lấy giá trị MIN (cell nhỏ). Giữa 2 mốc: nội suy tuyến tính.',
    })
    manyCellsGridSize = 10;

    @property({ min: 0.01, tooltip: 'Khoảng cách NHỎ NHẤT giữa 2 dash — dùng khi màn có NHIỀU cell.' })
    dashSpacingMin = 24;
    @property({ min: 0.01, tooltip: 'Khoảng cách LỚN NHẤT giữa 2 dash — dùng khi màn có ÍT cell.' })
    dashSpacingMax = 56;

    @property({ min: 1, tooltip: 'Tốc độ NHỎ NHẤT (đơn vị board/giây) dash chạy dọc đường ray — dùng khi màn có NHIỀU cell (lưới manyCellsGridSize). Cũ: dashSpeed = 220.' })
    dashSpeedMin = 180;
    @property({ min: 1, tooltip: 'Tốc độ LỚN NHẤT (đơn vị board/giây) dash chạy dọc đường ray — dùng khi màn có ÍT cell (lưới fewCellsGridSize).' })
    dashSpeedMax = 260;

    @property({ min: 1, tooltip: 'Tốc độ XOAY NHỎ NHẤT (độ/giây) của dash khi rẽ góc — dùng khi màn có NHIỀU cell. Nhỏ hơn thì xoay chậm/mượt hơn. Cũ: dashRotationSpeed = 540.' })
    dashRotationSpeedMin = 420;
    @property({ min: 1, tooltip: 'Tốc độ XOAY LỚN NHẤT (độ/giây) của dash khi rẽ góc — dùng khi màn có ÍT cell.' })
    dashRotationSpeedMax = 660;

    @property({ min: 0.01, tooltip: 'Scale NHỎ NHẤT của dash — dùng khi màn có NHIỀU cell. Scale thật = giá trị này ở lưới manyCellsGridSize.' })
    dashScaleMin = 0.6;
    @property({ min: 0.01, tooltip: 'Scale LỚN NHẤT của dash — dùng khi màn có ÍT cell. Scale thật = giá trị này ở lưới fewCellsGridSize.' })
    dashScaleMax = 1.4;

    @property({ min: 0.01, tooltip: 'Scale NHỎ NHẤT của 2 chấm tròn entrance/exit — dùng khi màn có NHIỀU cell. NHÂN với scale gốc tác giả trong Cell.prefab (đã bỏ phần scale của chính ô).' })
    circleScaleMin = 0.6;
    @property({ min: 0.01, tooltip: 'Scale LỚN NHẤT của 2 chấm tròn entrance/exit — dùng khi màn có ÍT cell.' })
    circleScaleMax = 1.4;

    @property({ min: 0, tooltip: 'Thời gian (giây) toàn bộ gợi ý (dash + 2 chấm tròn) HIỆN DẦN từ opacity 0 -> 255 khi bắt đầu hiện. 0 = hiện ngay, không fade.' })
    fadeInSeconds = 0.4;

    @property({
        min: 0,
        tooltip:
            'Thời gian (giây) toàn bộ gợi ý MỜ DẦN về opacity 0 khi người chơi BẮT ĐẦU THAO TÁC (xác ' +
            'nhận từ user) — sau đó nếu lại đứng yên đủ idleSeconds thì hiện dần (fadeInSeconds) trở ' +
            'lại, lặp lại nhiều lần cho tới khi nối xong hẳn. 0 = tắt ngay, không fade.',
    })
    fadeOutSeconds = 0.3;

    @property({ min: 0.1, tooltip: 'Số giây người chơi KHÔNG thao tác gì (sau khi đã tìm hết track preview) trước khi hiệu ứng này hiện lên.' })
    idleSeconds = 5;

    private dashScale = 1;
    private circleScale = 1;
    private effectiveDashSpacing = 40;
    private effectiveDashSpeed = 220;
    private effectiveRotationSpeed = 540;
    private board: ConnectTracksBoardView | null = null;
    private eligible = false;
    private showing = false;
    private idleTimer = 0;
    private pendingPath: readonly number[] | null = null;
    private pendingSnapshot: GameSnapshot | null = null;

    private pathOverlay: Node | null = null;
    private sampler: PolylineSampler | null = null;
    private pathStartDistance = 0;
    private pathEndDistance = 0;
    private dashPool: Node[] = [];
    /** Dash của lần hiện NÀY — số lượng CỐ ĐỊNH, tạo 1 lần lúc hiện, không spawn/huỷ trong lúc chạy ("băng chuyền"). */
    private dashNodes: Node[] = [];
    private dashVisible: boolean[] = [];
    /** Quãng đường băng chuyền đã chạy, trong [0, cycleLength). Vị trí dash k = start + (k*spacing + trailOffset) % cycleLength. */
    private trailOffset = 0;
    private cycleLength = 0;
    private readonly samplePose: SampledPose = { x: 0, y: 0, angleDeg: 0 };
    private circleOriginal: { node: Node; parent: Node; index: number; position: Vec3; scale: Vec3 }[] = [];

    /** Gọi lại mỗi lần GameplayScreen.refreshConnectTracksBoard() chạy — tức sau MỌI thao tác của
     * người chơi trên board. Hành vi (xác nhận từ user): "nếu người chơi thao tác thì tắt kiểu
     * opacity, nếu cứ 5s không thao tác thì bật lại" — LẶP LẠI nhiều lần (không phải chỉ 1 lần), cho
     * tới khi thực sự nối xong hẳn (session.solutionPathForIdleHint() tự trả về null lúc đó). Mọi
     * thao tác đều reset idleTimer về 0; nếu gợi ý ĐANG hiện lúc có thao tác thì mờ dần tắt
     * (fadeOutAndHide, KHÔNG tắt phựt) rồi chờ đủ idleSeconds mới hiện dần lại từ đầu. */
    refresh(board: ConnectTracksBoardView | null, session: GameSession): void {
        this.board = board;
        const path = session.solutionPathForIdleHint();
        const nowEligible = path !== null;
        this.idleTimer = 0;
        if (!nowEligible) {
            // Hết điều kiện (chưa identified hết HOẶC đã nối xong/thắng) — tắt ngay nếu đang hiện,
            // không cần fade (đã thắng thì không còn gì để "chờ lại" nữa).
            this.eligible = false;
            if (this.showing) this.hide();
            this.pendingPath = null;
            this.pendingSnapshot = null;
            return;
        }
        this.eligible = true;
        this.pendingPath = path;
        this.pendingSnapshot = session.snapshot();
        if (this.showing) this.fadeOutAndHide();
    }

    /** Mờ dần opacity overlay về 0 rồi mới thực sự dọn dẹp (recycle dash + trả 2 chấm tròn về ô gốc)
     * trong callback — tránh "tắt phựt" khi người chơi vừa chạm vào board. Đặt showing=false NGAY
     * (không đợi fade xong) để update() bắt đầu đếm lại idleTimer từ thời điểm này, cho phép hiệu
     * ứng tự hiện lại sau idleSeconds nếu người chơi lại đứng yên. */
    private fadeOutAndHide(): void {
        if (!this.showing) return;
        this.showing = false;
        const overlayOpacity = this.pathOverlay && isValid(this.pathOverlay, true)
            ? this.pathOverlay.getComponent(UIOpacity) : null;
        if (!overlayOpacity || this.fadeOutSeconds <= 0) {
            this.hide();
            return;
        }
        Tween.stopAllByTarget(overlayOpacity);
        tween(overlayOpacity).to(this.fadeOutSeconds, { opacity: 0 }).call(() => this.hide()).start();
    }

    /** Tắt NGAY (không tween) — dùng khi đóng màn/đổi level, tránh hiệu ứng chạy lố sang board mới. */
    hideInstant(): void {
        this.eligible = false;
        this.idleTimer = 0;
        if (this.showing) this.hide();
        this.board = null;
        this.pendingPath = null;
        this.pendingSnapshot = null;
    }

    update(dt: number): void {
        if (this.showing) {
            this.updateDashTrail(dt);
            return;
        }
        if (!this.eligible) return;
        this.idleTimer += dt;
        if (this.idleTimer >= this.idleSeconds) this.show();
    }

    private show(): void {
        const board = this.board;
        const path = this.pendingPath;
        const snapshot = this.pendingSnapshot;
        if (!board?.isValid || !this.dashPrefab || !path || !snapshot) return;
        this.showing = true;
        this.beginPathDemo(board, path, snapshot);
    }

    private hide(): void {
        this.showing = false;
        this.sampler = null;
        if (this.pathOverlay && isValid(this.pathOverlay, true)) {
            const overlayOpacity = this.pathOverlay.getComponent(UIOpacity);
            if (overlayOpacity) Tween.stopAllByTarget(overlayOpacity);
        }
        this.recycleDashNodes();
        this.restoreCircles();
    }

    private beginPathDemo(board: ConnectTracksBoardView, path: readonly number[], snapshot: GameSnapshot): void {
        const entranceEntry = snapshot.mainTrackPorts.find((e) => e.cell === snapshot.entranceCell);
        const exitEntry = snapshot.mainTrackPorts.find((e) => e.cell === snapshot.exitCell);
        if (!entranceEntry?.outward || !exitEntry?.outward) return;
        const cellSize = board.getCellSize();
        // Min/Max nội suy theo KÍCH THƯỚC LƯỚI: ít cell (lưới nhỏ) -> Max, nhiều cell (lưới lớn) -> Min.
        // (Cách cũ chỉ kẹp một giá trị tỉ lệ theo cellSize nên với lưới 6x6..10x10 không bao giờ chạm Min/Max.)
        const gridSize = Math.max(snapshot.width, snapshot.height);
        const few = this.fewCellsGridSize;
        const many = this.manyCellsGridSize;
        this.dashScale = interpolateByGridSize(this.dashScaleMax, this.dashScaleMin, gridSize, few, many);
        this.circleScale = interpolateByGridSize(this.circleScaleMax, this.circleScaleMin, gridSize, few, many);
        this.effectiveDashSpacing = interpolateByGridSize(this.dashSpacingMax, this.dashSpacingMin, gridSize, few, many);
        this.effectiveDashSpeed = interpolateByGridSize(this.dashSpeedMax, this.dashSpeedMin, gridSize, few, many);
        this.effectiveRotationSpeed = interpolateByGridSize(this.dashRotationSpeedMax, this.dashRotationSpeedMin, gridSize, few, many);
        const travelPolyline = buildTrainPolyline(
            path, snapshot.width, snapshot.height, cellSize, entranceEntry.outward, exitEntry.outward, 0,
        );
        // Tính sẵn chiều dài/góc từng đoạn 1 lần; mỗi frame chỉ tìm nhị phân, không cấp phát (xem polylineSampler.ts).
        this.sampler = buildPolylineSampler(travelPolyline);
        this.pathStartDistance = cellSize;
        this.pathEndDistance = Math.max(cellSize, this.sampler.length - cellSize);
        if (!this.pathOverlay) {
            this.pathOverlay = new Node('ConnectTracksIdleConnectHintOverlay');
            this.pathOverlay.layer = board.node.layer;
            this.pathOverlay.addComponent(UITransform);
            this.pathOverlay.parent = board.node;
        }
        this.pathOverlay.setSiblingIndex(-1);
        // Hiện dần: UIOpacity trên overlay ảnh hưởng cả dash lẫn 2 chấm tròn (đều là con của overlay). Opacity
        // nhấp nháy riêng của chấm tròn (pulse) nằm trên node con nên NHÂN với opacity này, không xung đột.
        const overlayOpacity = this.pathOverlay.getComponent(UIOpacity) ?? this.pathOverlay.addComponent(UIOpacity);
        Tween.stopAllByTarget(overlayOpacity);
        if (this.fadeInSeconds > 0) {
            overlayOpacity.opacity = 0;
            tween(overlayOpacity).to(this.fadeInSeconds, { opacity: 255 }).start();
        } else {
            overlayOpacity.opacity = 255;
        }
        // Tạo dash TRƯỚC rồi mới đưa 2 chấm tròn lên: chấm tròn là con cuối của overlay nên luôn nằm trên dash mà
        // KHÔNG cần setSiblingIndex mỗi frame như trước (setSiblingIndex tốn kém và làm UI render lại thứ tự).
        this.prewarmDashTrail();
        this.raiseCirclesAboveDash(board, snapshot);
    }

    private raiseCirclesAboveDash(board: ConnectTracksBoardView, snapshot: GameSnapshot): void {
        if (!this.pathOverlay || this.circleOriginal.length > 0) return;
        const targets: [number, string][] = [
            [snapshot.entranceCell, 'TutorialEntranceCircle'],
            [snapshot.exitCell, 'TutorialExitCircle'],
        ];
        for (const [cell, name] of targets) {
            const node = board.getTutorialCellOverlay(cell, name);
            if (!node || !node.parent) continue;
            const entry = {
                node, parent: node.parent, index: node.getSiblingIndex(),
                position: node.position.clone(), scale: node.scale.clone(),
            };
            this.circleOriginal.push(entry);
            node.setParent(this.pathOverlay, true);
            node.setSiblingIndex(-1);
            node.active = true;
            // BUG đã sửa: setParent(overlay, true) giữ NGUYÊN scale thế giới nên node đã mang theo scale của CHÍNH ô
            // (cellSize/100); nhân thêm circleScale lên đó khiến scale thật = tỉ lệ ô x circleScale (bình phương, 0.51..1.42
            // cho lưới 10x10..6x6) và Min/Max không còn đúng ý. Giờ dùng scale GỐC tác giả trong Cell.prefab (entry.scale)
            // rồi nhân circleScale — scale thật chỉ phụ thuộc Min/Max, giống hệt cách dash đang làm.
            const authored = entry.scale;
            node.setScale(authored.x * this.circleScale, authored.y * this.circleScale, authored.z);
            this.pulse(node);
        }
    }

    private restoreCircles(): void {
        for (const entry of this.circleOriginal) {
            if (isValid(entry.node, true) && isValid(entry.parent, true)) {
                entry.node.setParent(entry.parent, true);
                entry.node.setPosition(entry.position);
                entry.node.setScale(entry.scale);
                entry.node.setSiblingIndex(entry.index);
            }
            if (isValid(entry.node, true)) {
                const opacity = entry.node.getComponent(UIOpacity);
                if (opacity) Tween.stopAllByTarget(opacity);
                entry.node.active = false;
            }
        }
        this.circleOriginal = [];
    }

    private pulse(node: Node): void {
        const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
        Tween.stopAllByTarget(opacity);
        opacity.opacity = 255;
        tween(opacity).repeatForever(tween<UIOpacity>().to(0.45, { opacity: 90 }).to(0.45, { opacity: 255 })).start();
    }

    private recycleDashNodes(): void {
        const overlayValid = !!this.pathOverlay && isValid(this.pathOverlay, true);
        for (const node of this.dashNodes) {
            if (!overlayValid || !isValid(node, true)) continue;
            node.active = false;
            this.dashPool.push(node);
        }
        this.dashNodes = [];
        this.dashVisible = [];
    }

    /**
     * Dựng "băng chuyền" dash: số dash CỐ ĐỊNH, cách đều nhau đúng `effectiveDashSpacing` dọc đường, chạy vòng với
     * chu kỳ `cycleLength = count * spacing`. Vị trí mỗi dash là hàm của `trailOffset` (không phải bộ đếm giờ spawn), nên
     * khoảng cách giữa các dash LUÔN đều dù dt nhảy lên xuống; trước đây mỗi lần spawn lại đặt timer = spacing/speed và bỏ
     * phần dt dư nên các dash lệch nhau theo từng frame ("spawn không đều"), kèm instantiate/huỷ node liên tục lúc chạy.
     */
    private prewarmDashTrail(): void {
        const sampler = this.sampler;
        if (!sampler || !this.dashPrefab || !this.pathOverlay) return;
        this.recycleDashNodes();
        const spacing = Math.max(1e-3, this.effectiveDashSpacing);
        const span = Math.max(0, this.pathEndDistance - this.pathStartDistance);
        const count = Math.max(1, Math.floor(span / spacing) + 1);
        this.cycleLength = count * spacing;
        this.trailOffset = 0;
        for (let k = 0; k < count; k++) {
            const fresh = this.dashPool.length === 0;
            const node = fresh ? instantiate(this.dashPrefab) : this.dashPool.pop()!;
            if (fresh) this.applyLayerRecursive(node, this.pathOverlay.layer);
            node.active = false;
            node.parent = this.pathOverlay;
            // Scale đặt 1 LẦN ở đây (node lấy lại từ pool còn mang scale của màn trước), không đặt lại mỗi frame.
            node.setScale(this.dashScale, this.dashScale, 1);
            this.dashNodes.push(node);
            this.dashVisible.push(false);
        }
        this.placeDashes(0);
    }

    private updateDashTrail(dt: number): void {
        const overlay = this.pathOverlay;
        if (!this.sampler || !overlay || !isValid(overlay, true)) return;
        // Chỉ sắp lại thứ tự khi overlay KHÔNG còn là con cuối của board (so sánh O(1)); trước đây gọi setSiblingIndex(-1)
        // cho overlay và 2 chấm tròn MỖI FRAME (indexOf + splice + phát sự kiện thay đổi cây) dù thứ tự không đổi.
        const siblings = overlay.parent?.children;
        if (siblings && siblings[siblings.length - 1] !== overlay) overlay.setSiblingIndex(-1);
        if (this.cycleLength <= 0) return;
        this.trailOffset = (this.trailOffset + this.effectiveDashSpeed * dt) % this.cycleLength;
        this.placeDashes(dt);
    }

    /** Đặt vị trí/hướng cho từng dash theo trailOffset hiện tại. dt = 0 nghĩa là đặt thẳng (không làm mượt góc xoay). */
    private placeDashes(dt: number): void {
        const sampler = this.sampler;
        if (!sampler) return;
        const spacing = this.cycleLength / Math.max(1, this.dashNodes.length);
        const out = this.samplePose;
        for (let k = 0; k < this.dashNodes.length; k++) {
            const node = this.dashNodes[k];
            const distance = this.pathStartDistance + ((k * spacing + this.trailOffset) % this.cycleLength);
            const onPath = distance <= this.pathEndDistance && sampler.sample(distance, out);
            if (!onPath) {
                // Phần chu kỳ nằm sau điểm cuối: ẩn (chỉ đổi active khi trạng thái thật sự thay đổi).
                if (this.dashVisible[k]) { node.active = false; this.dashVisible[k] = false; }
                continue;
            }
            node.setPosition(out.x, out.y, 0);
            if (!this.dashVisible[k] || dt <= 0) {
                // Vừa xuất hiện (hoặc đặt thẳng): lấy đúng góc của đường, không làm mượt từ góc cũ.
                node.angle = out.angleDeg;
                if (!this.dashVisible[k]) { node.active = true; this.dashVisible[k] = true; }
            } else {
                const next = approachAngle(node.angle, out.angleDeg, this.effectiveRotationSpeed * dt);
                if (next !== node.angle) node.angle = next;
            }
        }
    }

    private applyLayerRecursive(node: Node, layer: number): void {
        node.layer = layer;
        for (const child of node.children) this.applyLayerRecursive(child, layer);
    }
}

function approachAngle(current: number, target: number, maxDeltaDeg: number): number {
    const diff = ((target - current + 540) % 360) - 180;
    if (Math.abs(diff) <= maxDeltaDeg) return current + diff;
    return current + Math.sign(diff) * maxDeltaDeg;
}
