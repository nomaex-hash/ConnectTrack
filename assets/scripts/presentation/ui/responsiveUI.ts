import { _decorator, Canvas, Component, Enum, Node, UITransform, Vec3, Widget, screen, warn } from 'cc';
import { FitRect, responsiveLayout } from './responsiveLayout';

const { ccclass, property, requireComponent } = _decorator;
enum HorizontalPin { Keep = 0, Left = 1, Center = 2, Right = 3 }
enum VerticalPin { Keep = 0, Bottom = 1, Center = 2, Top = 3 }

/** Owns a layout wrapper only. Put animated content below it, not on the same node. */
@ccclass('ResponsiveUI')
@requireComponent(UITransform)
export class ResponsiveUI extends Component {
    @property({ type: UITransform, tooltip: 'Vùng chứa để fit/ghim. Để trống dùng viewport của camera Canvas.' })
    targetArea: UITransform | null = null;
    @property({ type: Enum(HorizontalPin) }) horizontal = HorizontalPin.Center;
    @property({ type: Enum(VerticalPin) }) vertical = VerticalPin.Center;
    @property({ tooltip: 'Thu nhỏ đồng đều khi thiếu chiều ngang, không vượt scale gốc.' }) fitWidth = true;
    @property({ tooltip: 'Thu nhỏ đồng đều khi thiếu chiều cao, không vượt scale gốc.' }) fitHeight = true;
    @property({ min: 0 }) marginLeft = 0;
    @property({ min: 0 }) marginRight = 0;
    @property({ min: 0 }) marginTop = 0;
    @property({ min: 0 }) marginBottom = 0;

    @property({
        tooltip:
            'Thu nhỏ thêm khi màn hình quá hẹp — CHỈ áp dụng cho node NEO CẠNH màn hình ' +
            '(horizontal=Left/Right hoặc vertical=Top/Bottom). Node để Center cả 2 trục KHÔNG bị ' +
            'ảnh hưởng, giữ nguyên hiệu ứng fit/pin như cũ.',
    })
    shrinkOnNarrowScreen = false;

    @property({
        visible(this: ResponsiveUI) { return this.shrinkOnNarrowScreen; },
        min: 0,
        tooltip:
            'Ngưỡng chiều rộng màn hình (px) — chiều rộng thật NHỎ HƠN mốc này thì scale node tự ' +
            'thu nhỏ thêm theo BÌNH PHƯƠNG tỉ lệ (chiều rộng màn hình / ngưỡng này) — thu nhỏ RÕ ' +
            'ngay khi vừa qua ngưỡng thay vì mờ dần quá chậm, đạt scale gốc bình thường ngay khi ' +
            'chiều rộng màn hình >= ngưỡng.',
    })
    narrowScreenWidth = 500;

    @property({
        visible(this: ResponsiveUI) { return this.shrinkOnNarrowScreen; },
        min: 0,
        max: 1,
        slide: true,
        step: 0.01,
        tooltip:
            'Mức thu nhỏ TỐI ĐA do màn hình hẹp (tỉ lệ so với scale gốc, 0–1). Vd 0.6 = node chỉ ' +
            'thu nhỏ tới 60% rồi dừng. 0 = không giới hạn.',
    })
    minNarrowScale = 0;

    private originalScale = new Vec3(1, 1, 1);
    private last: number[] = [];
    private readonly point = new Vec3();
    private readonly world = new Vec3();
    private rect: UITransform | null = null;
    private warnedArea: UITransform | null = null;

    onLoad(): void {
        this.originalScale = this.node.scale.clone();
        this.rect = this.getComponent(UITransform);
        if (this.getComponent(Widget)?.enabled || this.getComponent('ScreenFitNode')?.enabled) {
            warn('[ResponsiveUI] Remove/disable Widget or ScreenFitNode on this wrapper to avoid conflicting layout.');
        }
    }

    onEnable(): void { this.last = []; }
    lateUpdate(): void { this.fit(); }

    /** Layout checks may run every frame; transform writes happen only when layout inputs change. */
    fit(): void {
        const rect = this.rect, parent = this.node.parent;
        if (!rect || !parent) return;
        const bounds = this.boundsInParent(parent);
        if (!bounds) return;
        // Có targetArea thì dùng chiều rộng vùng đó (đơn vị cục bộ); không thì dùng chiều rộng
        // màn hình theo pixel CSS (windowSize là pixel vật lý nên chia cho devicePixelRatio).
        const availableWidth = this.targetArea
            ? bounds.right - bounds.left
            : screen.windowSize.width / (screen.devicePixelRatio || 1);
        const narrowRatio = this.narrowScreenRatio(availableWidth);
        const values = [bounds.left, bounds.right, bounds.bottom, bounds.top, rect.width, rect.height,
            rect.anchorX, rect.anchorY, this.horizontal, this.vertical, +this.fitWidth, +this.fitHeight,
            this.marginLeft, this.marginRight, this.marginTop, this.marginBottom, narrowRatio];
        if (values.some(v => !Number.isFinite(v)) || values.every((v, i) => Math.abs(v - this.last[i]) < .001)) return;
        this.last = values;
        // narrowRatio nhân THẲNG vào scale GỐC trước khi đưa cho responsiveLayout — để phần tính
        // vị trí ghim cạnh (align/minX/maxX bên trong responsiveLayout) dùng ĐÚNG kích thước đã
        // thu nhỏ, không bị lệch khoảng cách tới cạnh do size thật nhỏ hơn size dùng để tính vị trí.
        const result = responsiveLayout({ bounds, width: rect.width, height: rect.height,
            anchorX: rect.anchorX, anchorY: rect.anchorY,
            scaleX: this.originalScale.x * narrowRatio, scaleY: this.originalScale.y * narrowRatio,
            x: this.node.position.x, y: this.node.position.y, horizontal: this.horizontal, vertical: this.vertical,
            fitWidth: this.fitWidth, fitHeight: this.fitHeight,
            left: this.marginLeft, right: this.marginRight, top: this.marginTop, bottom: this.marginBottom });
        if (this.node.scale.x !== result.scaleX || this.node.scale.y !== result.scaleY)
            this.node.setScale(result.scaleX, result.scaleY, this.originalScale.z);
        if (this.node.position.x !== result.x || this.node.position.y !== result.y)
            this.node.setPosition(result.x, result.y, this.node.position.z);
    }

    /** 1 nếu KHÔNG áp dụng thu nhỏ thêm (tắt shrinkOnNarrowScreen, node để Center cả 2 trục, hoặc
     * vùng khả dụng còn đủ rộng) — ngược lại trả về tỉ lệ (availableWidth / narrowScreenWidth, luôn
     * < 1) để nhân thêm vào scale gốc.
     *
     * `availableWidth` là pixel CSS của màn hình (windowSize / devicePixelRatio) để `narrowScreenWidth`
     * khớp đúng con số người dùng thấy. KHÔNG dùng bounds cục bộ: khi dùng FIXED_HEIGHT, chiều rộng
     * đơn vị thiết kế = chiều cao thiết kế × (rộng/cao màn hình), nên ngưỡng sẽ kích hoạt lệch so với
     * pixel thật. Khi có targetArea thì fit() truyền chiều rộng vùng đó (đơn vị cục bộ).
     */
    private narrowScreenRatio(availableWidth: number): number {
        if (!this.shrinkOnNarrowScreen || !this.isEdgeAnchored() || this.narrowScreenWidth <= 0) return 1;
        if (availableWidth >= this.narrowScreenWidth) return 1;
        // Bình phương (thay vì tuyến tính) — ngay khi vừa qua ngưỡng đã thấy thu nhỏ RÕ (vd còn 99%
        // chiều rộng ngưỡng → scale còn ~98% thay vì ~99%), càng hẹp càng thu nhỏ nhanh hơn nữa.
        const linear = Math.max(0, availableWidth / this.narrowScreenWidth);
        return Math.max(linear * linear, Math.min(1, Math.max(0, this.minNarrowScale)));
    }

    /** true nếu node neo vào ÍT NHẤT 1 cạnh màn hình (horizontal=Left/Right hoặc vertical=Top/Bottom)
     * — node để Center cả 2 trục (hoặc Keep) trả về false, không bị ảnh hưởng bởi shrinkOnNarrowScreen. */
    private isEdgeAnchored(): boolean {
        return this.horizontal === HorizontalPin.Left || this.horizontal === HorizontalPin.Right
            || this.vertical === VerticalPin.Top || this.vertical === VerticalPin.Bottom;
    }

    private boundsInParent(parent: Node): FitRect | null {
        let area = this.targetArea;
        // A descendant would make fitting depend on its own result and cause feedback/shrinking.
        // Fall back to the viewport instead of silently disabling responsive layout.
        if (area && (area.node === this.node || area.node.isChildOf(this.node))) {
            if (this.warnedArea !== area) {
                warn('[ResponsiveUI] Target Area is self/descendant; using Canvas viewport. Leave Target Area empty to fit the screen.');
                this.warnedArea = area;
            }
            area = null;
        } else {
            this.warnedArea = null;
        }
        // Prefabs can be parented/reparented after onLoad. Resolve the current Canvas.
        let canvas: Canvas | null = null;
        if (!area) for (let node: Node | null = parent; node; node = node.parent) {
            canvas = node.getComponent(Canvas);
            if (canvas) break;
        }
        const camera = canvas?.cameraComponent;
        if (!area && !camera) return null;
        const bounds = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
        let depth = 0;
        if (!area) depth = camera!.worldToScreen(parent.worldPosition, this.point).z;
        const size = screen.windowSize;
        const viewport = camera?.rect;
        for (let y = 0; y <= 1; y++) for (let x = 0; x <= 1; x++) {
            if (area) {
                this.point.set((x - area.anchorX) * area.width, (y - area.anchorY) * area.height, 0);
                area.convertToWorldSpaceAR(this.point, this.world);
            } else {
                this.point.set((viewport!.x + x * viewport!.width) * size.width,
                    (viewport!.y + y * viewport!.height) * size.height, depth);
                camera!.screenToWorld(this.point, this.world);
            }
            parent.inverseTransformPoint(this.point, this.world);
            bounds.left = Math.min(bounds.left, this.point.x); bounds.right = Math.max(bounds.right, this.point.x);
            bounds.bottom = Math.min(bounds.bottom, this.point.y); bounds.top = Math.max(bounds.top, this.point.y);
        }
        return bounds;
    }
}
