import { _decorator, Camera, Canvas, Component, Node, UIOpacity, UITransform, Vec3, game, screen } from 'cc';
import { isWideScreen } from './responsiveWidth';

const { ccclass, property } = _decorator;

/**
 * Tự chuyển node giữa 2 vị trí tuỳ chiều rộng màn hình THẬT (screen.windowSize, quy đổi về CSS px
 * qua devicePixelRatio) — ví dụ 2 booster ở Gameplay: màn rộng hơn widthThreshold thì chuyển sang
 * neo cạnh PHẢI (liên tục bám mép phải MÀN HÌNH THẬT — y hệt cách assets/scripts/presentation/ui/
 * responsiveUI.ts tự neo, xác nhận từ user — không phải snap 1 lần), hẹp hơn/bằng thì về lại vị trí
 * gốc. Đổi vị trí kèm hiệu ứng mờ dần MẤT rồi mờ dần HIỆN LẠI ở vị trí mới — không trượt trực tiếp.
 *
 * BUG đã sửa (báo lỗi của user):
 *   - "729px nhưng chưa di chuyển": view.getVisibleSize().width SAI cho dự án này (designResolution
 *     trong project.json đặt CẢ fitWidth LẪN fitHeight = true — chính sách SHOW_ALL, luôn hiện trọn
 *     720×1280, khiến getVisibleSize() gần như cố định quanh 720, không phản ánh cỡ cửa sổ thật) —
 *     đổi sang screen.windowSize.
 *   - "mốc thật là 260 chứ không phải 520 như code": screen.windowSize trả về PIXEL THIẾT BỊ (vật
 *     lý), gấp devicePixelRatio lần px CSS người dùng thấy trên thanh preview — máy devicePixelRatio
 *     = 2 thì 520 thiết bị = 260 CSS, đúng khớp lệch quan sát được. Chia lại cho devicePixelRatio
 *     trước khi so với widthThreshold (widthThreshold vẫn tính bằng px CSS, đúng như hiển thị).
 *   - "phải luôn neo cạnh phải, dù màn hình to thêm": bản trước chỉ snap theo 1 node anchor CỐ ĐỊNH
 *     tại thời điểm chuyển — đổi sang tự tính lại mép phải (qua Camera, cùng kỹ thuật
 *     responsiveUI.boundsInParent()) MỖI FRAME trong lúc đang "rộng", không cache.
 *
 * Tự kiểm tra lại MỖI FRAME qua lateUpdate() — cùng lateUpdate() responsiveUI.ts dùng (sau khi mọi
 * update() khác, kể cả Canvas tự co giãn theo cỡ màn hình, đã chạy xong trong frame đó).
 */
@ccclass('ResponsiveRepositionNode')
export class ResponsiveRepositionNode extends Component {
    @property({
        tooltip:
            'Ngưỡng chiều rộng màn hình THẬT, đơn vị PX CSS (đúng như số hiển thị trên thanh preview ' +
            'của Cocos Creator, ví dụ "729 x 870") — rộng HƠN mốc này thì neo cạnh phải, hẹp hơn hoặc ' +
            'bằng thì về lại vị trí gốc (vị trí node lúc vào màn). Script tự quy đổi screen.windowSize ' +
            '(px THIẾT BỊ) về px CSS qua devicePixelRatio trước khi so sánh.',
    })
    widthThreshold = 520;

    @property({
        tooltip:
            'Bật: màn hình đang XOAY NGANG (rộng > cao) luôn được coi là "rộng" dù chưa vượt ngưỡng chiều ' +
            'rộng — điện thoại xoay ngang thường chỉ rộng ~640–750px CSS nên chỉ so ngưỡng thì nút không ' +
            'chuyển vị trí. Tắt: chỉ dựa vào Width Threshold như trước.',
    })
    landscapeIsWide = true;

    @property({
        min: 0,
        tooltip:
            'Khoảng cách (px, theo hệ toạ độ node cha) tính từ MÉP PHẢI màn hình thật vào trong — ' +
            'lớn hơn 0 nghĩa là lùi vào trong khỏi mép phải đúng bấy nhiêu.',
    })
    marginRight = 0;

    @property({
        type: Node,
        tooltip:
            'Node TRỐNG dùng để lấy TUNG ĐỘ (Y) mong muốn lúc neo cạnh phải — script quy đổi world Y ' +
            'của nó sang local Y đúng trong node cha của node đang gắn component (được phép đặt ở ' +
            'BẤT KỲ đâu trong cây scene, không bắt buộc cùng cha). HOÀNH ĐỘ (X) KHÔNG lấy từ đây — X ' +
            'luôn tính SỐNG theo mép phải màn hình thật + marginRight ở trên, liên tục bám mép phải ' +
            'dù màn hình đổi kích thước tiếp sau đó (xác nhận từ user). Để trống thì giữ nguyên Y gốc.',
    })
    widePositionAnchor: Node | null = null;

    @property({ min: 0, tooltip: 'Thời gian mờ MẤT (giây) trước khi đổi vị trí.' })
    fadeOutSeconds = 0.15;

    @property({ min: 0, tooltip: 'Thời gian mờ HIỆN LẠI (giây) sau khi đã đổi vị trí.' })
    fadeInSeconds = 0.15;

    private originalPosition: Vec3 | null = null;
    private isWide = false;
    private opacity: UIOpacity | null = null;
    /** Hiệu ứng đổi chỗ chạy bằng lateUpdate + deltaTime (KHÔNG dùng tween): tween có thể bị dừng giữa
     * chừng (node bị tắt/bật, scene đổi...) làm cờ "đang chuyển" kẹt mãi và nút đứng yên sau khi xoay màn. */
    private fadePhase: 'idle' | 'out' | 'in' = 'idle';
    private fadeElapsed = 0;

    onLoad(): void {
        this.originalPosition = this.node.position.clone();
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        this.snapToCurrentScreen();
    }

    onEnable(): void {
        // Màn hình có thể đã xoay lúc node đang bị tắt (lateUpdate không chạy) — vào lại phải khớp ngay,
        // không hiệu ứng, không đợi frame sau.
        if (this.originalPosition) this.snapToCurrentScreen();
    }

    onDisable(): void {
        this.fadePhase = 'idle';
        if (this.opacity) this.opacity.opacity = 255;
    }

    lateUpdate(): void {
        const wide = this.shouldBeWide();
        if (wide !== this.isWide) {
            this.isWide = wide;
            this.startFadeOut();
        }

        if (this.fadePhase === 'out') {
            this.fadeElapsed += game.deltaTime;
            this.setOpacity(1 - this.progress(this.fadeElapsed, this.fadeOutSeconds));
            if (this.fadeElapsed >= this.fadeOutSeconds) {
                // Đổi chỗ theo trạng thái HIỆN TẠI (không phải lúc bắt đầu mờ) — màn hình có thể đã đổi tiếp.
                this.placeForCurrentState();
                this.fadePhase = 'in';
                this.fadeElapsed = 0;
            }
            return;
        }

        if (this.fadePhase === 'in') {
            this.fadeElapsed += game.deltaTime;
            this.setOpacity(this.progress(this.fadeElapsed, this.fadeInSeconds));
            if (this.fadeElapsed >= this.fadeInSeconds) this.fadePhase = 'idle';
        }

        // Đã ở trạng thái "rộng" — tiếp tục bám mép phải MỖI FRAME (không chỉ snap 1 lần lúc vừa
        // chuyển), để màn hình đổi kích thước tiếp tục vẫn luôn đúng, không cần rời/vào lại màn.
        if (this.isWide) {
            const target = this.computeWidePosition();
            if (target) this.node.setPosition(target);
        }
    }

    private snapToCurrentScreen(): void {
        this.isWide = this.shouldBeWide();
        this.fadePhase = 'idle';
        this.setOpacity(1);
        this.placeForCurrentState();
    }

    private placeForCurrentState(): void {
        const target = this.isWide ? this.computeWidePosition() : this.originalPosition;
        if (target) this.node.setPosition(target);
    }

    /** Bắt đầu mờ mất. Nếu đang giữa chừng một hiệu ứng khác thì nối tiếp từ độ mờ hiện tại, không giật. */
    private startFadeOut(): void {
        if (this.fadeOutSeconds <= 0) {
            this.placeForCurrentState();
            this.fadePhase = 'in';
            this.fadeElapsed = 0;
            return;
        }
        const current = this.opacity ? this.opacity.opacity / 255 : 1;
        this.fadePhase = 'out';
        this.fadeElapsed = this.fadeOutSeconds * (1 - current);
    }

    private progress(elapsed: number, duration: number): number {
        return duration <= 0 ? 1 : Math.min(1, Math.max(0, elapsed / duration));
    }

    private setOpacity(fraction: number): void {
        if (this.opacity) this.opacity.opacity = Math.round(255 * fraction);
    }

    private shouldBeWide(): boolean {
        const ratio = screen.devicePixelRatio || 1;
        const size = screen.windowSize;
        return isWideScreen(size.width / ratio, size.height / ratio, this.widthThreshold, this.landscapeIsWide);
    }

    /** Mép PHẢI màn hình thật, quy đổi sang local X đúng trong node cha của node đang gắn component
     * — cùng kỹ thuật ResponsiveUI.boundsInParent() (tìm Canvas gần nhất ở tổ tiên, lấy camera của
     * nó, screenToWorld() 1 điểm ở rìa phải viewport rồi inverseTransformPoint() về local cha). Tính
     * LẠI MỖI LẦN gọi, không cache — camera.rect/windowSize đổi theo thời gian thực. */
    private rightEdgeLocalX(parent: Node): number | null {
        let canvas: Canvas | null = null;
        for (let node: Node | null = parent; node; node = node.parent) {
            canvas = node.getComponent(Canvas);
            if (canvas) break;
        }
        const camera = canvas?.cameraComponent as Camera | null;
        if (!camera) return null;

        const size = screen.windowSize;
        const viewport = camera.rect;
        const screenPoint = new Vec3(
            (viewport.x + viewport.width) * size.width,
            (viewport.y + 0.5 * viewport.height) * size.height,
            0,
        );
        const worldPoint = new Vec3();
        camera.screenToWorld(screenPoint, worldPoint);
        const localPoint = new Vec3();
        parent.inverseTransformPoint(localPoint, worldPoint);
        return localPoint.x;
    }

    private computeWidePosition(): Vec3 | null {
        const parent = this.node.parent;
        if (!parent) return null;
        const rightEdgeX = this.rightEdgeLocalX(parent);
        if (rightEdgeX === null) return null;

        let y = this.originalPosition?.y ?? this.node.position.y;
        if (this.widePositionAnchor) {
            const parentTransform = parent.getComponent(UITransform);
            if (parentTransform) {
                const local = new Vec3();
                parentTransform.convertToNodeSpaceAR(this.widePositionAnchor.worldPosition, local);
                y = local.y;
            }
        }

        return new Vec3(rightEdgeX - this.marginRight, y, this.originalPosition?.z ?? 0);
    }
}
