import { _decorator, Canvas, Component, UITransform, Vec3, view } from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Neo/dãn node theo cạnh của NODE CHA — thuần code, không dùng cc.Widget. Dùng
 * được cho bất kỳ node nào (background phủ toàn màn hình, hoặc từng node con cần
 * giữ khoảng cách cố định tới mép cha khi tỷ lệ màn hình đổi).
 *
 * Cách hoạt động (giống Widget nhưng tự tính bằng code):
 *   - Bật CẢ HAI cạnh đối diện (VD Align Left + Align Right) → node DÃN ra để
 *     đúng margin cả 2 bên (width = parentWidth - marginLeft - marginRight).
 *   - Chỉ bật MỘT cạnh → node GIỮ NGUYÊN kích thước, chỉ di chuyển để cách đúng
 *     margin so với cạnh đó (không đổi width/height).
 *   - Không bật cạnh nào (theo trục X hoặc Y) → giữ nguyên vị trí/kích thước gốc.
 *
 * Container tham chiếu là UITransform của NODE CHA; nếu không có cha hợp lệ (node
 * gốc ngay dưới Canvas) thì dùng view.getVisibleSize() làm container.
 *
 * @executeInEditMode: tự tính lại MỖI FRAME, kể cả khi chưa bấm Play — sửa giá trị
 * Align/Margin trên Inspector là thấy ngay trong Scene view, giống hệt cc.Widget.
 * Không có cờ này thì Cocos chỉ chạy onLoad() một lần lúc component được tạo, sửa
 * property sau đó trên Inspector sẽ không có tác dụng gì cho tới khi tạo lại.
 */
@ccclass('ScreenFitNode')
@executeInEditMode
export class ScreenFitNode extends Component {
    @property({
        tooltip:
            'Bỏ qua cây cha hoàn toàn, luôn dùng view.getVisibleSize() (kích thước màn hình THẬT ' +
            'của máy) làm container — dùng khi node cha KHÔNG nằm ngay dưới Canvas (VD PopupLayer ' +
            'nằm dưới UIRoot, không phải con trực tiếp của Canvas) nên không tự nhận diện được.',
    })
    useVisibleSize = false;

    @property({ tooltip: 'Neo cạnh TRÁI.' })
    alignLeft = false;
    @property({ visible(this: ScreenFitNode) { return this.alignLeft; }, tooltip: 'Khoảng cách tới cạnh trái của node cha (px).' })
    marginLeft = 0;

    @property({ tooltip: 'Neo cạnh PHẢI.' })
    alignRight = false;
    @property({ visible(this: ScreenFitNode) { return this.alignRight; }, tooltip: 'Khoảng cách tới cạnh phải của node cha (px).' })
    marginRight = 0;

    @property({ tooltip: 'Neo cạnh TRÊN.' })
    alignTop = false;
    @property({ visible(this: ScreenFitNode) { return this.alignTop; }, tooltip: 'Khoảng cách tới cạnh trên của node cha (px).' })
    marginTop = 0;

    @property({ tooltip: 'Neo cạnh DƯỚI.' })
    alignBottom = false;
    @property({ visible(this: ScreenFitNode) { return this.alignBottom; }, tooltip: 'Khoảng cách tới cạnh dưới của node cha (px).' })
    marginBottom = 0;

    private readonly tempPos = new Vec3();

    onLoad(): void {
        this.fit();
    }

    update(): void {
        this.fit();
    }

    fit(): void {
        const transform = this.getComponent(UITransform);
        if (!transform) return;

        const container = this.containerSize();
        const ax = transform.anchorX;
        const ay = transform.anchorY;

        let width = transform.width;
        let height = transform.height;
        let x = this.node.position.x;
        let y = this.node.position.y;

        const halfW = container.width / 2;
        const halfH = container.height / 2;

        if (this.alignLeft && this.alignRight) {
            width = Math.max(0, container.width - this.marginLeft - this.marginRight);
            x = -halfW + this.marginLeft + ax * width;
        } else if (this.alignLeft) {
            x = -halfW + this.marginLeft + ax * width;
        } else if (this.alignRight) {
            x = halfW - this.marginRight - (1 - ax) * width;
        }

        if (this.alignTop && this.alignBottom) {
            height = Math.max(0, container.height - this.marginTop - this.marginBottom);
            y = halfH - this.marginTop - (1 - ay) * height;
        } else if (this.alignTop) {
            y = halfH - this.marginTop - (1 - ay) * height;
        } else if (this.alignBottom) {
            y = -halfH + this.marginBottom + ay * height;
        }

        if (width !== transform.width || height !== transform.height) {
            transform.setContentSize(width, height);
        }
        this.tempPos.set(x, y, this.node.position.z);
        this.node.setPosition(this.tempPos);
    }

    private containerSize(): { width: number; height: number } {
        if (this.useVisibleSize) {
            const visible = view.getVisibleSize();
            return { width: visible.width, height: visible.height };
        }

        // Node cha là Canvas (node gốc ngay dưới Canvas, VD ScreenLayer): UITransform của Canvas
        // LUÔN LUÔN bằng đúng design resolution cố định (VD 720x1280), KHÔNG BAO GIỜ đổi theo
        // kích thước máy thật — đọc nó để "co giãn theo màn hình" là vô nghĩa, dùng
        // view.getVisibleSize() (API trả kích thước thật của thiết bị) thay vào đó.
        const parent = this.node.parent;
        if (parent?.getComponent(Canvas)) {
            const visible = view.getVisibleSize();
            return { width: visible.width, height: visible.height };
        }

        const parentTransform = parent?.getComponent(UITransform);
        if (parentTransform && parentTransform.width > 0 && parentTransform.height > 0) {
            return { width: parentTransform.width, height: parentTransform.height };
        }
        const visible = view.getVisibleSize();
        return { width: visible.width, height: visible.height };
    }
}
