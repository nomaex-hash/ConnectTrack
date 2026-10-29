import { _decorator, Component, Node, Label, UITransform, UIOpacity, Vec3, instantiate, tween, Tween } from 'cc';
const { ccclass, property } = _decorator;

/**
 * Hiệu ứng dòng chữ khi thắng: từng ký tự bật ra (scale từ 0, overshoot) lần lượt từ trái sang phải,
 * cả dòng uốn cong theo cung tròn (giữa cao, hai đầu cúi xuống).
 *
 * Cấu trúc node:
 *   WinText (gắn component này)
 *     ├─ shadow  (Label mẫu cho bóng chữ)
 *     └─ text    (Label mẫu cho chữ chính)
 * Hai node con chỉ là MẪU: component tự tắt chúng và nhân bản thành từng ký tự.
 * Font/size/màu/viền lấy nguyên từ 2 Label mẫu. Nếu để trống 2 property, component tự tìm
 * node con tên "text" và "shadow".
 *
 *   await this.getComponent(WinTextArc)!.play('Không một bước nào sai!');
 *   await this.getComponent(WinTextArc)!.hide();
 */
@ccclass('WinTextArc')
export class WinTextArc extends Component {
    @property({ type: Label, tooltip: 'Label mẫu cho CHỮ CHÍNH. Để trống = tự tìm node con tên "text".' })
    textTemplate: Label | null = null;

    @property({ type: Label, tooltip: 'Label mẫu cho BÓNG CHỮ (vẽ dưới chữ chính). Để trống = tự tìm node con tên "shadow"; không có thì bỏ bóng.' })
    shadowTemplate: Label | null = null;

    @property({ tooltip: 'Nội dung mặc định nếu play() không truyền text' })
    text = 'Không một bước nào sai!';

    @property({ tooltip: 'Khoảng cách thêm giữa các ký tự (px)' }) spacing = 0;
    @property({ tooltip: 'Bán kính cung. Nhỏ = cong nhiều. 0 = chữ thẳng' }) arcRadius = 1100;

    @property({
        min: 0,
        tooltip:
            'Độ rộng TỐI ĐA (px, local — cùng đơn vị với kích thước thiết kế của Canvas) mà cả dòng ' +
            'chữ được phép chiếm. Chữ càng dài (nhiều ký tự) càng dễ tràn ra ngoài màn hình — nếu độ ' +
            'rộng thật sự đo được (sau khi xếp hết ký tự lên cung) VƯỢT QUÁ giá trị này, CẢ node tự ' +
            'co lại (scale đều, không méo) cho vừa đúng khít. 0 = tắt, không tự co giãn gì cả.',
    })
    maxWidth = 650;

    @property({ tooltip: 'Lệch THÊM của bóng theo X (px), cộng vào độ lệch sẵn có giữa node shadow và text trong Editor' }) shadowOffsetX = 0;
    @property({ tooltip: 'Lệch THÊM của bóng theo Y (px), cộng vào độ lệch sẵn có giữa node shadow và text trong Editor' }) shadowOffsetY = 0;

    @property({ tooltip: 'Line-height tối thiểu = fontSize x hệ số này. Tăng nếu viền/bóng phía dưới vẫn bị cắt' }) lineHeightScale = 1.5;

    @property({ tooltip: 'Bù lỗi engine: Label dùng Shadow tích hợp bị ép nhỏ lại + lệch vì canvas vẽ lớn hơn node. Bật để chữ giữ đúng kích thước/vị trí như Label thường.' })
    fixShadowSquash = true;

    @property({ tooltip: 'Thời gian giữa 2 ký tự liên tiếp (giây)' }) charInterval = 0.04;
    @property({ tooltip: 'Thời gian bật của 1 ký tự (giây) — chặng phóng lên charOvershootScale.' }) popDuration = 0.22;
    @property({ min: 0.01, tooltip: 'Scale CUỐI CÙNG mà mỗi ký tự dừng lại (1 = đúng cỡ chữ của Label mẫu, 1.5 = to gấp rưỡi).' })
    charScale = 1;
    @property({
        min: 0.01,
        tooltip:
            'Scale CAO NHẤT mỗi ký tự phóng TỚI trước khi thu nhỏ về lại charScale — tách riêng khỏi ' +
            'charScale để chỉnh được mức "vượt quá" (overshoot) độc lập, không phụ thuộc overshoot ' +
            'ngầm của easing backOut nữa. Phải >= charScale để còn thấy hiệu ứng phóng to rồi thu lại; ' +
            'bằng charScale thì tắt hẳn chặng thu nhỏ (phóng thẳng tới charScale, không overshoot).',
    })
    charOvershootScale = 1.2;
    @property({ min: 0.01, tooltip: 'Thời gian (giây) thu nhỏ từ charOvershootScale về lại charScale — chặng 2, chạy ngay sau popDuration.' })
    charSettleDuration = 0.12;

    private _chars: Node[] = [];

    onLoad() {
        if (!this.textTemplate) this.textTemplate = this.node.getChildByName('text')?.getComponent(Label) ?? null;
        if (!this.shadowTemplate) this.shadowTemplate = this.node.getChildByName('shadow')?.getComponent(Label) ?? null;
        // Tắt 2 node mẫu để không hiện chồng lên các ký tự được sinh ra.
        if (this.textTemplate) this.textTemplate.node.active = false;
        if (this.shadowTemplate) this.shadowTemplate.node.active = false;
    }

    /** Chạy hiệu ứng; resolve khi ký tự cuối đã bật xong (hoặc khi bị play/hide/clear gọi đè). */
    play(text?: string): Promise<void> {
        this.clear();
        const tpl = this.textTemplate;
        if (!tpl) {
            console.warn('[WinTextArc] Thiếu textTemplate (node con "text" có Label).');
            return Promise.resolve();
        }
        const glyphs = Array.from(text || this.text);

        // Độ lệch bóng so với chữ trong Editor + độ lệch thêm.
        const shadowTpl = this.shadowTemplate;
        const shadowPos = new Vec3();
        if (shadowTpl) {
            Vec3.subtract(shadowPos, shadowTpl.node.position, tpl.node.position);
            shadowPos.x += this.shadowOffsetX;
            shadowPos.y += this.shadowOffsetY;
        }

        // 1. Tạo 2 lớp: TẤT CẢ bóng nằm dưới, TẤT CẢ chữ nằm trên (tránh bóng ký tự sau đè lên chữ ký tự trước).
        //    QUAN TRỌNG: wrapper phải được addChild vào cây node TRƯỚC khi tạo label,
        //    nếu không Label chưa active nên updateRenderData không đo được bề rộng.
        const widths: number[] = [];
        const shadowWrappers: Node[] = [];
        const textWrappers: Node[] = [];
        const newWrapper = (ch: string) => {
            const wrapper = new Node(ch);
            wrapper.layer = this.node.layer;
            wrapper.addComponent(UITransform).setAnchorPoint(0.5, 0.5);
            wrapper.addComponent(UIOpacity).opacity = 0;
            wrapper.setScale(0, 0, 1);
            this.node.addChild(wrapper);
            this._chars.push(wrapper);
            return wrapper;
        };
        if (shadowTpl) {
            glyphs.forEach((ch) => {
                const w = newWrapper(ch);
                this.makeGlyph(shadowTpl.node, w, ch, shadowPos);
                shadowWrappers.push(w);
            });
        }
        glyphs.forEach((ch) => {
            const w = newWrapper(ch);
            const textLabel = this.makeGlyph(tpl.node, w, ch, Vec3.ZERO);
            let width = textLabel.node.getComponent(UITransform)!.width;
            if (ch === ' ') width = (textLabel.fontSize || 32) * 0.3;
            else if (!(width > 1)) width = (textLabel.fontSize || 32) * 0.6; // phòng khi không đo được
            widths.push(width + this.spacing);
            textWrappers.push(w);
        });

        // 2. Xếp các wrapper lên cung tròn (bóng và chữ cùng vị trí).
        const total = widths.reduce((a, b) => a + b, 0);
        let cursor = -total / 2;
        const R = this.arcRadius;
        let minEdge = Infinity;
        let maxEdge = -Infinity;
        glyphs.forEach((_, i) => {
            const x = cursor + widths[i] / 2;
            cursor += widths[i];
            minEdge = Math.min(minEdge, x - widths[i] / 2);
            maxEdge = Math.max(maxEdge, x + widths[i] / 2);
            [shadowWrappers[i], textWrappers[i]].forEach((node) => {
                if (!node) return;
                if (R > 0) {
                    const theta = x / R; // rad
                    node.setPosition(R * Math.sin(theta), R * (Math.cos(theta) - 1), 0);
                    node.angle = -theta * 180 / Math.PI; // bên phải xoay xuống (theo chiều kim đồng hồ)
                } else {
                    node.setPosition(x, 0, 0);
                }
            });
        });

        // "Chữ dài quá bị tràn ra ngoài màn hình, muốn tự co scale theo kích thước màn hình" (xác
        // nhận từ user) — độ rộng CHIỀU NGANG thật sự đo được (minEdge..maxEdge, tính trên trục x
        // CHƯA cong — xấp xỉ đủ tốt cho mục đích clamp, cong hẹp lại một chút so với con số thẳng
        // nên không bao giờ co NHẦM ÍT hơn mức cần). Co đều cả node (scale X=Y) nếu vượt maxWidth,
        // KHÔNG méo hình — chỉ co nhỏ lại, KHÔNG phóng to thêm nếu chữ ngắn hơn maxWidth.
        const measuredWidth = glyphs.length > 0 ? maxEdge - minEdge : 0;
        const fitScale = this.maxWidth > 0 && measuredWidth > this.maxWidth
            ? this.maxWidth / measuredWidth : 1;
        this.node.setScale(fitScale, fitScale, 1);

        // 3. Bật từng ký tự (bóng và chữ cùng nhịp).
        return new Promise<void>((resolve) => {
            glyphs.forEach((ch, i) => {
                if (ch === ' ') return;
                [shadowWrappers[i], textWrappers[i]].forEach((node) => {
                    if (!node) return;
                    const op = node.getComponent(UIOpacity)!;
                    const overshoot = tween(node).delay(i * this.charInterval)
                        .to(this.popDuration, { scale: new Vec3(this.charOvershootScale, this.charOvershootScale, 1) }, { easing: 'backOut' });
                    if (this.charOvershootScale !== this.charScale) {
                        overshoot.to(this.charSettleDuration, { scale: new Vec3(this.charScale, this.charScale, 1) }, { easing: 'quadOut' });
                    }
                    overshoot.start();
                    tween(op)
                        .delay(i * this.charInterval)
                        .to(this.popDuration * 0.4, { opacity: 255 })
                        .start();
                });
            });
            const settleDuration = this.charOvershootScale !== this.charScale ? this.charSettleDuration : 0;
            const dur = Math.max(glyphs.length - 1, 0) * this.charInterval + this.popDuration + settleDuration;
            this.scheduleOnce(() => { this._pending = null; resolve(); }, dur);
            // Nếu bị play/hide/clear đè giữa chừng, vẫn resolve để không treo await.
            this._pending = resolve;
        });
    }

    private _pending: (() => void) | null = null;

    /** Nhân bản 1 Label mẫu thành 1 ký tự dưới wrapper, reset transform & overflow. */
    private makeGlyph(template: Node, wrapper: Node, ch: string, pos: Readonly<Vec3>): Label {
        const n = instantiate(template);
        n.active = true;
        n.setParent(wrapper);
        n.setPosition(pos.x, pos.y, 0);
        n.setScale(1, 1, 1);
        n.angle = 0;
        const ui = n.getComponent(UITransform)!;
        ui.setAnchorPoint(0.5, 0.5);
        const label = n.getComponent(Label)!;
        // Overflow NONE để bề rộng node = bề rộng thật của ký tự (template có thể đang để fix width / shrink / resize).
        label.overflow = Label.Overflow.NONE;
        label.enableWrapText = false;
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        // Chống cắt viền/bóng: cache theo ký tự (CHAR) và line-height nhỏ làm viền dưới bị cắt theo hình chữ nhật
        // của từng ký tự -> khi xoay trên cung thành đường cong răng cưa. Tắt cache + nới line-height.
        label.cacheMode = Label.CacheMode.NONE;
        label.lineHeight = Math.max(label.lineHeight, Math.ceil(label.fontSize * this.lineHeightScale));
        label.string = ch;
        label.updateRenderData(true);
        if (this.fixShadowSquash) this.compensateShadowPadding(label, n, pos);
        return label;
    }

    /**
     * Engine (text-processing.ts) tính canvas = chữ + padding (outline + shadowBlur + lệch shadow) nhưng
     * node.contentSize chỉ cộng THÊM outline (contentSizeExtend), KHÔNG cộng padding của shadow; quad lại
     * vẽ nguyên canvas vào khung node -> Label bật Shadow tích hợp bị ÉP NHỎ + lệch tâm. Ở đây tính lại
     * đúng công thức của engine rồi scale node bằng canvas/node và dời lại để chữ đúng cỡ, đúng tâm.
     */
    private compensateShadowPadding(label: Label, node: Node, basePos: Readonly<Vec3>): void {
        if (!label.enableShadow) return;
        const eps = 1e-4;
        const ox = label.shadowOffset.x;
        const oy = label.shadowOffset.y;
        if (!(label.shadowBlur > 0 || Math.abs(ox) > eps || Math.abs(oy) > eps)) return;

        const outline = label.enableOutline && label.outlineWidth > 0 ? label.outlineWidth : 0;
        const sw = label.shadowBlur + outline;
        const left = Math.max(outline, -ox + sw);
        const right = Math.max(outline, ox + sw);
        const top = Math.max(outline, oy + sw);
        const bottom = Math.max(outline, -oy + sw);

        const ui = node.getComponent(UITransform)!;
        const w = ui.width;
        const h = ui.height;
        const canvasW = w - 2 * outline + left + right;
        const canvasH = h - 2 * outline + top + bottom;
        if (!(w > 0 && h > 0)) return;

        node.setScale(canvasW / w, canvasH / h, 1);
        // Tâm chữ lệch so với tâm canvas: ngang (left-right)/2, dọc (top-bottom)/2 -> dời ngược lại.
        node.setPosition(basePos.x + (right - left) / 2, basePos.y + (top - bottom) / 2, 0);
    }

    /** Mờ dần rồi xoá. */
    hide(duration = 0.25): Promise<void> {
        return new Promise<void>((resolve) => {
            const ops = this._chars.map((n) => n.getComponent(UIOpacity)!);
            if (ops.length === 0) { resolve(); return; }
            ops.forEach((op, i) => {
                const t = tween(op).to(duration, { opacity: 0 });
                if (i === ops.length - 1) t.call(() => { this.clear(); resolve(); });
                t.start();
            });
        });
    }

    clear() {
        this.unscheduleAllCallbacks();
        this._chars.forEach((n) => {
            if (!n.isValid) return;
            n.getComponentsInChildren(UIOpacity).forEach((o) => Tween.stopAllByTarget(o));
            const op = n.getComponent(UIOpacity);
            if (op) Tween.stopAllByTarget(op);
            Tween.stopAllByTarget(n);
            n.destroy();
        });
        this._chars = [];
        if (this._pending) { const r = this._pending; this._pending = null; r(); }
    }

    onDestroy() { this.clear(); }
}
