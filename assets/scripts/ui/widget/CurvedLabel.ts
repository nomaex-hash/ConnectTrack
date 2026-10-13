import { _decorator, Component, Label, Node, UIOpacity, UITransform, instantiate } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Chữ CONG theo cung tròn — cc.Label không hỗ trợ sẵn nên tự tách chuỗi ra từng ký tự,
 * nhân bản `templateLabel` (giữ nguyên font/cỡ/màu/viền) cho mỗi ký tự rồi xếp dọc theo
 * 1 cung tròn bán kính `radius`, xoay từng ký tự theo đúng tiếp tuyến của cung.
 *
 * Dùng cho chữ kết quả (WELL DONE/GREAT JOB...) — nội dung đổi ngẫu nhiên mỗi lần mở popup
 * nên không thể bake sẵn thành 1 ảnh cong, phải dựng lại bằng code mỗi lần setText().
 */
@ccclass('CurvedLabel')
export class CurvedLabel extends Component {
    @property({
        type: Label,
        tooltip:
            'Label MẪU — lấy font/cỡ chữ/màu/viền từ đây để nhân bản cho từng ký tự. ' +
            'Tự ẩn label này khi setText() chạy, không cần tự tắt trong prefab.',
    })
    templateLabel: Label | null = null;

    @property({ tooltip: 'Bán kính đường cong (px). Càng nhỏ chữ càng cong gắt, càng lớn càng gần thẳng.' })
    radius = 400;

    @property({ tooltip: 'Cong lên (chữ giữa cao nhất, 2 đầu chúc xuống) hay cong xuống (ngược lại).' })
    curveUp = true;

    @property({
        tooltip:
            'Khoảng CÁCH THÊM giữa 2 ký tự (độ, quy đổi ra px theo radius) — CỘNG THÊM vào bề ' +
            'rộng thật của từng ký tự, không phải khoảng cách cố định cho mọi ký tự (ký tự rộng/hẹp ' +
            'tự động cách đều nhau).',
    })
    anglePerChar = 8;

    @property({
        tooltip:
            'Chỉnh tay tâm cong lệch trái/phải (px) — dương dịch tâm sang PHẢI (chữ cong ' +
            'nhiều hơn bên trái), âm dịch sang TRÁI. Dùng khi thấy lệch nhẹ do bo/viền chữ ' +
            'không hoàn toàn đối xứng dù công thức đã tự căn giữa theo bề rộng thật.',
    })
    centerOffsetPx = 0;

    private readonly charNodes: Node[] = [];
    private pendingNodes: Node[] = [];
    private pendingSign = 1;
    private pendingGapPx = 0;

    onDestroy(): void {
        this.unschedule(this.applyLayout);
        this.clearChars();
    }

    /** Dựng lại toàn bộ ký tự theo `text` mới — gọi lại mỗi lần đổi nội dung. */
    setText(text: string): void {
        this.clearChars();
        this.unschedule(this.applyLayout);

        const template = this.templateLabel;
        if (!template) return;

        template.node.active = false;

        const chars = Array.from(text);
        const sign = this.curveUp ? 1 : -1;
        // Trị tuyệt đối để tránh chuỗi bị lật ngược nếu Inspector lỡ để giá trị âm.
        const gapPx = (Math.abs(this.anglePerChar) * Math.PI * this.radius) / 180;

        // Tạo node + set string cho từng ký tự trước, NHƯNG chưa định vị/hiện ngay — đo bề
        // rộng thật (UITransform.width) đôi khi chưa ổn định với 1-2 ký tự cuối nếu đọc NGAY
        // trong cùng khung hình vừa set string, làm tâm cong bị lệch. Ẩn TẠM bằng opacity (giữ
        // active=true để Label vẫn khởi tạo assembler và đo đúng) rồi đợi đúng 1 khung hình cho
        // Cocos đo xong hết mới định vị (applyLayout) để tránh lệch tâm.
        const nodes: Node[] = [];
        for (let i = 0; i < chars.length; i++) {
            const node = instantiate(template.node);
            node.name = `Char_${i}`;
            node.active = true;
            node.setParent(this.node);

            const label = node.getComponent(Label)!;
            const ch = chars[i]!;
            label.string = ch === ' ' ? ' ' : ch;
            label.updateRenderData(true);

            const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
            opacity.opacity = 0;

            nodes.push(node);
            this.charNodes.push(node);
        }

        this.pendingNodes = nodes;
        this.pendingSign = sign;
        this.pendingGapPx = gapPx;
        this.scheduleOnce(this.applyLayout, 0);
    }

    /** Đo bề rộng thật (đã ổn định sau 1 khung hình) rồi xếp từng ký tự dọc theo cung tròn. */
    private applyLayout = (): void => {
        const nodes = this.pendingNodes;
        if (nodes.length === 0) return;

        const widths = nodes.map((n) => n.getComponent(UITransform)?.width ?? 0);

        // Cộng dồn khoảng cách theo CHIỀU DÀI CUNG (px) rồi mới đổi sang góc — đảm bảo
        // khoảng cách thực tế giữa các ký tự đều nhau, không phụ thuộc bề rộng ký tự.
        const centersArc: number[] = [];
        let arc = 0;
        for (let i = 0; i < nodes.length; i++) {
            if (i > 0) arc += widths[i - 1]! / 2 + widths[i]! / 2 + this.pendingGapPx;
            centersArc.push(arc);
        }
        // Căn giữa theo MÉP TRÁI của ký tự đầu và MÉP PHẢI của ký tự cuối (không phải theo
        // tâm 2 ký tự đó) — nếu ký tự đầu/cuối rộng khác nhau (vd 'R' rộng, '!' hẹp) thì tâm
        // cong bị lệch, khiến 1 bên cong nhiều hơn bên còn lại.
        const leftEdge = centersArc[0]! - widths[0]! / 2;
        const rightEdge = centersArc[centersArc.length - 1]! + widths[widths.length - 1]! / 2;
        const offset = (leftEdge + rightEdge) / 2 + this.centerOffsetPx;
        const sign = this.pendingSign;

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i]!;
            if (!node.isValid) continue;

            const arcPos = centersArc[i]! - offset;
            const angleRad = arcPos / this.radius;
            const angleDeg = (angleRad * 180) / Math.PI;

            // y: tâm ở 0, 2 đầu càng ra xa càng thấp hơn (curveUp) hoặc cao hơn (!curveUp).
            const x = this.radius * Math.sin(angleRad);
            const y = sign * this.radius * (Math.cos(angleRad) - 1);
            node.setPosition(x, y, 0);
            node.angle = -sign * angleDeg;

            const opacity = node.getComponent(UIOpacity);
            if (opacity) opacity.opacity = 255;
        }
    };

    private clearChars(): void {
        for (const node of this.charNodes) {
            if (node.isValid) node.destroy();
        }
        this.charNodes.length = 0;
        this.pendingNodes = [];
    }
}
