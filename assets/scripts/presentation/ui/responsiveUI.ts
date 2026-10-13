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
        const values = [bounds.left, bounds.right, bounds.bottom, bounds.top, rect.width, rect.height,
            rect.anchorX, rect.anchorY, this.horizontal, this.vertical, +this.fitWidth, +this.fitHeight,
            this.marginLeft, this.marginRight, this.marginTop, this.marginBottom];
        if (values.some(v => !Number.isFinite(v)) || values.every((v, i) => Math.abs(v - this.last[i]) < .001)) return;
        this.last = values;
        const result = responsiveLayout({ bounds, width: rect.width, height: rect.height,
            anchorX: rect.anchorX, anchorY: rect.anchorY, scaleX: this.originalScale.x, scaleY: this.originalScale.y,
            x: this.node.position.x, y: this.node.position.y, horizontal: this.horizontal, vertical: this.vertical,
            fitWidth: this.fitWidth, fitHeight: this.fitHeight,
            left: this.marginLeft, right: this.marginRight, top: this.marginTop, bottom: this.marginBottom });
        if (this.node.scale.x !== result.scaleX || this.node.scale.y !== result.scaleY)
            this.node.setScale(result.scaleX, result.scaleY, this.originalScale.z);
        if (this.node.position.x !== result.x || this.node.position.y !== result.y)
            this.node.setPosition(result.x, result.y, this.node.position.z);
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
