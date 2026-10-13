import { _decorator, Camera, Canvas, Component, Node, Tween, UIOpacity, UITransform, Vec3, screen, tween } from 'cc';

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
    private transitioning = false;

    onLoad(): void {
        this.originalPosition = this.node.position.clone();
        this.opacity = this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
        // Áp dụng NGAY theo kích thước màn hình hiện tại, không hiệu ứng (tránh chớp mờ ngay lúc
        // vừa vào màn) — chỉ những lần ĐỔI sau đó (do xoay màn/resize) mới chạy hiệu ứng mờ.
        this.isWide = this.shouldBeWide();
        this.applyPosition(this.isWide, false);
    }

    lateUpdate(): void {
        if (this.transitioning) return;
        const wide = this.shouldBeWide();
        if (wide !== this.isWide) {
            this.isWide = wide;
            this.applyPosition(wide, true);
            return;
        }
        // Đã ở trạng thái "rộng" — tiếp tục bám mép phải MỖI FRAME (không chỉ snap 1 lần lúc vừa
        // chuyển), để màn hình đổi kích thước tiếp tục vẫn luôn đúng, không cần rời/vào lại màn.
        if (this.isWide) {
            const target = this.computeWidePosition();
            if (target) this.node.setPosition(target);
        }
    }

    private shouldBeWide(): boolean {
        const ratio = screen.devicePixelRatio || 1;
        return screen.windowSize.width / ratio > this.widthThreshold;
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

    private applyPosition(wide: boolean, animate: boolean): void {
        const target = wide ? this.computeWidePosition() : this.originalPosition;
        if (!target || !this.opacity) return;

        Tween.stopAllByTarget(this.opacity);
        if (!animate) {
            this.node.setPosition(target);
            this.opacity.opacity = 255;
            return;
        }

        this.transitioning = true;
        tween(this.opacity)
            .to(this.fadeOutSeconds, { opacity: 0 })
            .call(() => { if (this.node.isValid) this.node.setPosition(target); })
            .to(this.fadeInSeconds, { opacity: 255 })
            .call(() => { this.transitioning = false; })
            .start();
    }
}
