import { _decorator, Component, Mat4, Node, ParticleSystem, UITransform, Vec2, Vec3 } from 'cc';
import { Point, poseAtDistance, polylineLength } from './trainPath';
import { AudioManager } from '../../manager/AudioManager';

const { ccclass, property } = _decorator;

/**
 * Chạy đầu tàu + các toa dọc theo 1 polyline (toạ độ local của Board, xem trainPath.ts) — gọi
 * play() đúng 1 lần khi GameSession vừa Won. Không quyết định gameplay gì cả: polyline/khi nào
 * play() được quyết định ở ConnectTracksBoardView, component này chỉ lo chuyển động + hiện/ẩn.
 */
@ccclass('ConnectTracksTrainView')
export class ConnectTracksTrainView extends Component {
    @property({ type: Node, tooltip: 'Node đầu tàu — đi ĐẦU, dẫn đường cho các toa phía sau.' })
    private engine: Node | null = null;

    @property({
        type: [Node],
        tooltip:
            'Danh sách toa tàu, ĐÚNG THỨ TỰ từ toa gần đầu tàu nhất tới toa xa nhất (thường 3 toa). ' +
            'Mỗi toa tự theo đúng đường đầu tàu đã đi, cách nhau carSpacing.',
    })
    private cars: Node[] = [];

    @property({
        min: 0.01,
        tooltip:
            'Tốc độ THẤP NHẤT, tính theo SỐ Ô/giây (KHÔNG còn px/giây — xác nhận từ user: cố định ' +
            'px/giây khiến board nhiều ô/board ít ô (cellSize khác nhau) chạy nhìn nhanh/chậm khác ' +
            'nhau) — áp dụng khi đường ray NGẮN (ít ô). Tốc độ tàu không cố định: tỉ lệ theo số ô ' +
            'đường ray, đường dài hơn referenceTrackCellsForMaxSpeed thì chạy đúng bằng ' +
            'maxSpeedCellsPerSecond, ngắn hơn thì giảm dần về mức này. Nhân với cellSize THẬT của ' +
            'CHÍNH màn đang chơi (tham số cellSize của play()) ra px/giây thật sự dùng để di chuyển — ' +
            'cùng 1 số ô/giây luôn mất CÙNG 1 khoảng thời gian đi hết 1 ô bất kể board to hay nhỏ.',
    })
    private minSpeedCellsPerSecond = 2;

    @property({ min: 0.01, tooltip: 'Tốc độ CAO NHẤT, tính theo SỐ Ô/giây — áp dụng khi đường ray đủ DÀI (xem referenceTrackCellsForMaxSpeed). Cùng cách quy đổi ra px/giây như minSpeedCellsPerSecond.' })
    private maxSpeedCellsPerSecond = 4.5;

    @property({
        tooltip:
            'Số ô đường ray (từ cổng vào tới lối ra) ứng với tốc độ CAO NHẤT. Đường ray có ít ô hơn ' +
            'mức này thì tốc độ giảm dần tuyến tính về minSpeedCellsPerSecond; nhiều ô hơn vẫn giữ ' +
            'nguyên maxSpeedCellsPerSecond (không tăng thêm nữa).',
    })
    private referenceTrackCellsForMaxSpeed = 20;

    @property({ tooltip: 'Khoảng cách GIỮA 2 TOA liên tiếp (đơn vị Board, từ toa thứ 2 trở đi) — KHÔNG áp dụng cho khoảng từ đầu tàu tới toa đầu, xem engineCarSpacing. Tự điều chỉnh theo chiều dài đã scale để giữ cùng khoảng hở.' })
    private carSpacing = 70;

    @property({
        tooltip:
            'Khoảng cách RIÊNG từ đầu tàu tới toa đầu tiên (đơn vị Board) — tách khỏi carSpacing ' +
            'để chỉnh được độc lập (xác nhận từ user: toa mới thêm không bám sát đầu tàu như các ' +
            'toa còn lại, do kích thước toa đó khác các toa kia làm khoảng hở tính lệch). Mặc định ' +
            'bằng carSpacing.',
    })
    private engineCarSpacing = 70;

    @property({ min: 1, tooltip: 'Kích thước cell tham chiếu (đơn vị Board) khi thiết kế tàu. Cell thực tế bằng giá trị này thì giữ scale đã chỉnh trong Editor; cell nhỏ/lớn hơn thì toàn bộ tàu co/phóng theo tỷ lệ. Mặc định 100.' })
    private referenceCellSize = 100;

    @property({ min: 0.01, tooltip: 'Hệ số kích thước tàu so với tỷ lệ cell. 1 = tỷ lệ chuẩn; 0.8 = nhỏ hơn 20%. Tự áp dụng cả khoảng cách toa và offset khói.' })
    private trainSizeMultiplier = 1;

    private authoredScale: Vec3 | null = null;
    private cellScaleFactor = 1;
    /** Tutorial-only (xác nhận từ user): hệ số nhân THÊM vào trainSizeMultiplier/tốc độ đã cấu
     * hình trong Editor — tutorial có thể cần kích thước/tốc độ tàu khác gameplay thật. 1 = không
     * đổi gì (mặc định). KHÔNG tự reset — caller (tutorial) tự đặt lại 1 khi dùng xong, tránh rò rỉ
     * sang gameplay thật (vốn dùng CHUNG 1 instance train này). */
    private scaleMultiplierOverride = 1;
    private speedMultiplierOverride = 1;

    setScaleMultiplierOverride(multiplier: number): void {
        this.scaleMultiplierOverride = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    }

    setSpeedMultiplierOverride(multiplier: number): void {
        this.speedMultiplierOverride = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1;
    }

    private fitToCell(cellSize: number): void {
        if (!this.authoredScale) this.authoredScale = this.node.scale.clone();
        const reference = Number.isFinite(this.referenceCellSize) && this.referenceCellSize > 0 ? this.referenceCellSize : 100;
        const multiplier = Number.isFinite(this.trainSizeMultiplier) && this.trainSizeMultiplier > 0 ? this.trainSizeMultiplier : 1;
        this.cellScaleFactor = (Number.isFinite(cellSize) && cellSize > 0 ? cellSize / reference : 1)
            * multiplier * this.scaleMultiplierOverride;
        const scale = this.authoredScale;
        this.node.setScale(scale.x * this.cellScaleFactor, scale.y * this.cellScaleFactor, scale.z * this.cellScaleFactor);
    }

    @property({
        tooltip:
            'Góc (độ) CỘNG THÊM vào hướng di chuyển tính được (0° = hướng +X/phải). Nếu sprite đầu ' +
            'tàu/toa được vẽ mặc định hướng khác (ví dụ hướng lên trên), chỉnh số này cho đúng — ' +
            'cùng áp dụng cho cả đầu tàu lẫn toa vì chúng dùng chung 1 bộ art xoay theo hướng đi.',
    })
    private angleOffset = 0;

    @property({
        min: 0,
        tooltip:
            'Tốc độ quay TỐI ĐA của đầu tàu/toa (độ/giây) khi hướng đi đổi đột ngột (vào khúc cua) — ' +
            '0 = TẮT làm mượt, xoay "cứng" khớp ngay hướng đường ray như cũ (không có độ trễ). Số ' +
            'càng NHỎ thì xoay càng chậm/mượt (tàu "rẽ" từ từ thay vì xoay góc tức thì). KHÔNG áp ' +
            'dụng cho khói (smoke luôn bám chính xác hướng đường ray để offset không bị lệch).',
    })
    private maxTurnDegreesPerSecond = 0;

    /** Góc hiện tại (độ) của TỪNG node đang được làm mượt — chỉ dùng khi maxTurnDegreesPerSecond > 0.
     * Reset mỗi lần play() (qua updatePoses(null) lúc đó) để không mang góc cũ từ lần chạy TRƯỚC
     * sang, tránh tàu "xoay ngược" từ hướng của lần thắng trước về hướng ban đầu của lần này. */
    private currentAngleByNode = new Map<Node, number>();

    @property({
        type: ParticleSystem,
        tooltip:
            'Particle khói — xác nhận từ user: chạy liên tục, ghim vào đầu tàu, CHỈ tắt khi TOA CUỐI ' +
            'đi hết board (không phải lúc chính đầu tàu ra khỏi board, sớm hơn nhiều). Đặt node này ' +
            'làm CON của node GỐC component này (CÙNG CẤP với engine/toa, KHÔNG phải con của engine ' +
            '— nếu là con của engine, nó sẽ bị ẩn theo ngay khi đầu tàu ra khỏi board, trước khi toa ' +
            'cuối xong). Code tự định vị nó theo đúng vị trí đầu tàu mỗi khung hình, giữ nguyên tại ' +
            'điểm ra khi đầu tàu đã khuất. Để trống thì bỏ qua.',
    })
    private smoke: ParticleSystem | null = null;

    @property({
        type: Vec2,
        tooltip:
            'Lệch vị trí khói so với tâm đầu tàu, đơn vị Board (CÙNG hệ đơn vị với carSpacing) — X = ' +
            'lệch THEO HƯỚNG ĐI (dương = phía trước đầu tàu, âm = phía sau), Y = lệch VUÔNG GÓC hướng ' +
            'đi (dương = bên trái theo hướng đi, âm = bên phải). Tự xoay theo đúng hướng tàu đang đi ' +
            'mỗi khung hình — chỉnh để khói ra đúng vị trí ống khói trên art, không cần sửa code.',
    })
    private smokeOffset: Vec2 = new Vec2(0, 0);

    private polyline: readonly Point[] | null = null;
    private pathSpace: Node | null = null;
    private totalDistance = 0;
    private traveled = 0;
    private carOffsets: number[] = [];
    private running = false;
    private currentSpeedPxPerSecond = 0;
    private onFinished: (() => void) | null = null;

    onLoad(): void {
        this.node.active = false;
    }

    /**
     * Bắt đầu chạy dọc theo polyline đã tính sẵn (xem trainPath.buildTrainPolyline). Gọi lại được
     * (ví dụ Restart rồi thắng lại) — tự reset từ đầu mỗi lần gọi.
     *
     * `trackCellCount`: số ô đường ray thật sự đi qua (từ cổng vào tới lối ra, KHÔNG tính 2 đoạn
     * nối dài thêm off-board) — quyết định tốc độ chạy trong khoảng [min, max] (xác nhận từ user:
     * nhiều đường ray thì chạy nhanh, ít đường ray thì chạy chậm), KHÔNG cố định 1 tốc độ.
     *
     * `onFinished`: gọi ĐÚNG 1 LẦN khi toa cuối cùng đã đi hết polyline (tàu biến mất hẳn) — dùng
     * để mở ResultPopup CHỈ SAU KHI tàu chạy xong (xác nhận từ user: đây là điều kiện thắng DUY
     * NHẤT mà người chơi thấy, không phải lúc GameSession chuyển Won).
     *
     * `cellSize`: kích thước 1 ô (đơn vị LOCAL của board) CỦA CHÍNH màn đang chơi — BUG đã sửa
     * (báo lỗi của user: "board nhiều ô tàu chạy rất nhanh, board ít ô tàu đi chậm"): tốc độ KHÔNG
     * còn tính bằng px/giây cố định nữa (dễ lệch vì cellSize/scale khác nhau tuỳ board) mà tính
     * bằng SỐ Ô/giây (minSpeedCellsPerSecond/maxSpeedCellsPerSecond) rồi NHÂN với cellSize của
     * CHÍNH màn này ra px/giây local thật sự dùng để di chuyển — cùng 1 số ô/giây luôn mất CÙNG 1
     * khoảng thời gian đi hết 1 ô bất kể board to hay nhỏ, không cần biết/bù scale hiển thị nữa.
     */
    play(polyline: readonly Point[], trackCellCount: number, onFinished?: () => void, pathSpace?: Node, cellSize = this.referenceCellSize): void {
        this.pathSpace = pathSpace ?? this.node;
        // Board supplies local cell size; its victory zoom is already inherited by the train.
        // Do not multiply the current scale on every play/restart.
        this.fitToCell(cellSize);
        // Đẩy lên sibling CUỐI CÙNG của cha — board/grid/line gợi ý cũng tự làm vậy mỗi lần vẽ lại,
        // nên tàu (chỉ chạy 1 lần lúc thắng) phải tự giành lại vị trí trên cùng ngay lúc này.
        this.node.setSiblingIndex(-1);

        this.polyline = polyline;
        // Toa CUỐI phải đi hết polyline trước khi cả đoàn tàu biến mất hẳn.
        this.carOffsets = this.buildCarOffsets();
        this.totalDistance = polylineLength(polyline) + (this.carOffsets[this.carOffsets.length - 1] ?? 0);
        this.traveled = 0;
        this.running = true;
        this.onFinished = onFinished ?? null;
        this.node.active = true;
        AudioManager.maybeInstance?.startTrainSound();

        const ratio = this.referenceTrackCellsForMaxSpeed > 0
            ? Math.min(1, Math.max(0, trackCellCount / this.referenceTrackCellsForMaxSpeed))
            : 1;
        const speedCellsPerSecond =
            (this.minSpeedCellsPerSecond + (this.maxSpeedCellsPerSecond - this.minSpeedCellsPerSecond) * ratio)
            * this.speedMultiplierOverride;
        const effectiveCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : this.referenceCellSize;
        this.currentSpeedPxPerSecond = speedCellsPerSecond * effectiveCellSize;

        // LOG TẠM ĐỂ DEBUG (theo yêu cầu user — xem tốc độ tàu tuỳ theo từng màn) — xoá sau khi xác
        // nhận speedCellsPerSecond (số ô/giây) giống nhau giữa các màn mà vẫn nhìn tốc độ hợp lý,
        // dù currentSpeedPxPerSecond (local px/giây thật sự dùng để di chuyển) khác nhau tuỳ cellSize.

        // stop() rồi play() lại (không chỉ play()) — an toàn khi play() được gọi lại (Restart rồi
        // thắng lần nữa) trong lúc khói cũ vẫn còn đang phát dở, giống pattern ConnectTracksVictoryView.
        this.smoke?.stop();
        this.smoke?.play();

        this.updatePoses();
    }

    /** Dừng ngay, ẩn tàu, KHÔNG gọi onFinished — dùng khi Restart trong lúc tàu đang chạy dở
     * (không phải tàu chạy xong thật, không tính là đã hoàn thành). */
    stop(): void {
        AudioManager.maybeInstance?.stopTrainSound();
        this.running = false;
        this.polyline = null;
        this.onFinished = null;
        this.node.active = false;
        this.smoke?.stop();
    }

    onDisable(): void {
        AudioManager.maybeInstance?.stopTrainSound();
    }

    update(dt: number): void {
        if (!this.running || !this.polyline) {
            return;
        }
        this.traveled += this.currentSpeedPxPerSecond * dt;
        this.updatePoses(dt);
        if (this.traveled > this.totalDistance) {
            this.running = false;
            this.node.active = false;
            this.smoke?.stop();
            const onFinished = this.onFinished;
            this.onFinished = null;
            onFinished?.();
        }
    }

    /** `dt`: null khi gọi NGAY lúc play() bắt đầu (đặt pose khởi tạo, xoay "cứng" tức thì, KHÔNG
     * làm mượt — đồng thời seed lại currentAngleByNode đúng góc ban đầu, xoá sạch góc cũ từ lần
     * chạy TRƯỚC); số giây trôi qua khi gọi từ update() mỗi khung hình (có làm mượt nếu
     * maxTurnDegreesPerSecond > 0). */
    private updatePoses(dt: number | null = null): void {
        this.applyPose(this.engine, this.traveled, dt);
        this.cars.forEach((car, index) => {
            this.applyPose(car, this.traveled - this.carOffsets[index], dt);
        });
        this.applySmokePose();
    }

    /**
     * Khói bám đúng vị trí đầu tàu trong lúc đầu tàu còn trên polyline. Một khi đầu tàu đã đi quá
     * polyline (applyPose ẩn hẳn node engine lúc đó — SỚM hơn nhiều so với lúc toa cuối xong), vị
     * trí bị CHỐT lại đúng mép cuối polyline (clamp khoảng cách) thay vì tiếp tục tính pose (sẽ ra
     * null) — khói vẫn đứng yên tại cổng ra và tiếp tục phát cho tới khi update() tắt hẳn cả tàu
     * (đúng lúc toa cuối đi hết board — xác nhận từ user), KHÔNG bị ẩn sớm theo engine vì smoke là
     * con của node gốc (luôn active suốt lúc running), không phải con của engine.
     */
    private applySmokePose(): void {
        const node = this.smoke?.node;
        if (!node || !this.polyline) {
            return;
        }
        const clamped = Math.min(Math.max(this.traveled, 0), polylineLength(this.polyline));
        const pose = poseAtDistance(this.polyline, clamped);
        if (!pose) {
            return;
        }
        // smokeOffset tính theo hệ trục CỦA TÀU (X = theo hướng đi, Y = vuông góc) — tự xoay theo
        // pose.angleDeg mỗi khung hình rồi mới cộng vào điểm trên polyline, nên khói luôn lệch ĐÚNG
        // hướng so với đầu tàu bất kể tàu đang đi hướng nào.
        const radians = pose.angleDeg * Math.PI / 180;
        const forwardX = Math.cos(radians);
        const forwardY = Math.sin(radians);
        const point: Point = {
            x: pose.point.x + (forwardX * this.smokeOffset.x - forwardY * this.smokeOffset.y) * this.cellScaleFactor,
            y: pose.point.y + (forwardY * this.smokeOffset.x + forwardX * this.smokeOffset.y) * this.cellScaleFactor,
        };
        this.applyTransform(node, point, pose.angleDeg);
    }

    private buildCarOffsets(): number[] {
        const lengths = [this.engine].concat(this.cars).map((node) => {
            const ui = node?.getComponent(UITransform);
            if (!node || !ui || !this.pathSpace) return 0;
            const angle = this.angleOffset * Math.PI / 180;
            const scale = node.worldScale;
            const boardScale = this.pathSpace.worldScale;
            const length = Math.abs(Math.cos(angle)) * ui.width * Math.abs(scale.x)
                + Math.abs(Math.sin(angle)) * ui.height * Math.abs(scale.y);
            return length / Math.max(1e-6, Math.abs(boardScale.x));
        });
        let offset = 0;
        return this.cars.map((_, index) => {
            // BUG đã sửa (báo lỗi của user: "toa mới thêm không chạy theo đầu tàu như các toa còn
            // lại") — trước đây `gap` chỉ tính 1 LẦN từ cặp (đầu tàu, toa đầu) rồi DÙNG CHUNG cho
            // mọi cặp toa khác, nên toa nào có kích thước khác 2 toa đầu tiên sẽ bị lệch khoảng hở
            // thực tế. Giờ tính `gap` RIÊNG cho TỪNG cặp — cặp (đầu tàu, toa đầu) dùng
            // engineCarSpacing (property riêng, xác nhận từ user), các cặp (toa, toa) sau dùng
            // carSpacing như cũ.
            const spacingSetting = index === 0 ? this.engineCarSpacing : this.carSpacing;
            const spacing = Math.max(0, spacingSetting) * this.cellScaleFactor;
            const gap = spacing - ((lengths[index] ?? 0) + (lengths[index + 1] ?? 0)) / 2;
            // Missing visual dimensions fall back to the authored centre spacing.
            const separation = lengths[index] > 0 && lengths[index + 1] > 0
                ? Math.max(0, (lengths[index] + lengths[index + 1]) / 2 + gap)
                : spacing;
            offset += separation;
            return offset;
        });
    }

    private applyPose(node: Node | null, distance: number, dt: number | null): void {
        if (!node || !this.polyline) {
            return;
        }
        const pose = poseAtDistance(this.polyline, distance);
        if (!pose) {
            node.active = false;
            return;
        }
        node.active = true;
        this.applyTransform(node, pose.point, pose.angleDeg, dt);
    }

    /** `dt`: null = xoay "cứng" tức thì theo `angleDeg` (dùng cho smoke — luôn bám CHÍNH XÁC hướng
     * đường ray, xem applySmokePose() — và cho pose khởi tạo lúc play() vừa bắt đầu). Số giây = làm
     * mượt góc quay của chính `node`, giới hạn tối đa maxTurnDegreesPerSecond độ/giây, đi theo
     * chiều NGẮN HƠN (xem shortestAngleDelta) — maxTurnDegreesPerSecond <= 0 vẫn xoay cứng như cũ. */
    private applyTransform(node: Node, point: Point, angleDeg: number, dt: number | null = null): void {
        const source = this.pathSpace;
        if (!source || !node.parent) return;
        const radians = angleDeg * Math.PI / 180;
        const worldPosition = Vec3.transformMat4(new Vec3(), new Vec3(point.x, point.y, 0), source.worldMatrix);
        const worldAhead = Vec3.transformMat4(new Vec3(), new Vec3(point.x + Math.cos(radians), point.y + Math.sin(radians), 0), source.worldMatrix);
        const inverseParent = Mat4.invert(new Mat4(), node.parent.worldMatrix);
        const localPosition = Vec3.transformMat4(new Vec3(), worldPosition, inverseParent);
        const localAhead = Vec3.transformMat4(new Vec3(), worldAhead, inverseParent);
        node.setPosition(localPosition);
        // pose.angleDeg (atan2) và node.angle của Cocos CÙNG quy ước: dương = ngược kim đồng hồ,
        // 0° = hướng +X (phải) — cộng thẳng angleOffset, không cần đổi dấu.
        const targetAngle = Math.atan2(localAhead.y - localPosition.y, localAhead.x - localPosition.x) * 180 / Math.PI + this.angleOffset;
        node.angle = this.smoothedAngle(node, targetAngle, dt);
    }

    private smoothedAngle(node: Node, targetAngle: number, dt: number | null): number {
        if (dt === null || this.maxTurnDegreesPerSecond <= 0) {
            this.currentAngleByNode.set(node, targetAngle);
            return targetAngle;
        }
        const current = this.currentAngleByNode.get(node) ?? targetAngle;
        const maxDelta = this.maxTurnDegreesPerSecond * dt;
        const delta = ConnectTracksTrainView.shortestAngleDelta(current, targetAngle);
        const next = current + Math.max(-maxDelta, Math.min(maxDelta, delta));
        this.currentAngleByNode.set(node, next);
        return next;
    }

    /** Hiệu số góc NGẮN HƠN từ `from` tới `to`, luôn trong khoảng (-180, 180] — tránh tàu xoay
     * "vòng xa" (vd 179° -> -179° lẽ ra chỉ cần xoay 2°, không phải gần 360°). */
    private static shortestAngleDelta(from: number, to: number): number {
        let delta = (to - from) % 360;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        return delta;
    }
}
