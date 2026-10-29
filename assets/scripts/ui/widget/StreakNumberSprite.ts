import { _decorator, Component, Enum, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';
import { DigitAlign, DigitMetrics, layoutDigits } from './streakDigitLayout';

const { ccclass, property } = _decorator;

/**
 * Hiển thị 1 số (chuỗi hiện tại ở màn Streak) ghép từ NHIỀU sprite chữ số đơn (0-9), thay cho
 * Label chữ (xác nhận từ user: "label số ở màn streak, thay bằng sprite"). 2 bộ sprite riêng cho 2
 * trạng thái — XÁM (graySprites, chưa thắp chuỗi hôm nay) và VÀNG (goldSprites, đã thắp xong) —
 * `setValue(value, gold)` chọn bộ tương ứng. Scale cả `this.node` theo kích thước của 1 CHỮ SỐ ĐƠN
 * LẺ vừa khít `fitSize` — KHÔNG phải theo tổng chiều rộng cả cụm (BUG đã sửa, xác nhận từ user:
 * "chuỗi 2-3 chữ số bị bé hơn hẳn 1 chữ số") — nên mỗi chữ số LUÔN cùng kích thước dù số có 1, 2
 * hay 3 chữ số; cụm nhiều chữ số có thể rộng hơn `fitSize.width`. scaleX/scaleY tính RIÊNG theo
 * fitSize.width/height (xác nhận từ user: "chấp nhận bị méo") — KHÔNG còn giữ tỉ lệ ảnh gốc, chữ sẽ
 * bị kéo giãn/méo nếu tỉ lệ fitSize khác tỉ lệ ảnh gốc của sprite.
 *
 * Đọc/ghi danh sách con qua `this.node.children` thay vì tự giữ mảng riêng — component này còn
 * phải sống sót qua `instantiate()` (xem DailyStreakScreen.rollOneSprite dùng bản clone làm "số
 * cũ" trượt ra trong hiệu ứng quay số) — 1 field riêng sẽ RỖNG lại trên bản clone (field runtime
 * không serialize) dù cây con Digit đã bị clone theo, gây tạo trùng node nếu không đọc thẳng từ
 * children thật.
 */
@ccclass('StreakNumberSprite')
export class StreakNumberSprite extends Component {
    @property({
        type: [SpriteFrame],
        tooltip:
            'Sprite CHỮ SỐ XÁM (chưa thắp chuỗi hôm nay) — ĐÚNG 10 phần tử, index = chữ số 0-9 ' +
            '(để trống phần tử nào chưa có ảnh — ví dụ số 0 nếu chuỗi không bao giờ hiện số 0).',
    })
    graySprites: (SpriteFrame | null)[] = [];

    @property({
        type: [SpriteFrame],
        tooltip: 'Sprite CHỮ SỐ VÀNG (đã thắp chuỗi xong) — ĐÚNG 10 phần tử, index = chữ số 0-9.',
    })
    goldSprites: (SpriteFrame | null)[] = [];

    @property({ tooltip: 'Khoảng cách NHÌN THẤY (px, TRƯỚC khi co giãn vừa khung) giữa 2 nét chữ liền kề — chính xác, không phụ thuộc viền trong suốt của ảnh. Có thể ÂM để các chữ số chồng sát nhau.' })
    digitSpacing = 4;

    @property({
        min: 0,
        tooltip:
            'BUG đã sửa (xác nhận từ user: "giảm digitSpacing xuống rất thấp nhưng 2 số vẫn cách xa ' +
            'nhau") — nguyên nhân thật: digitSpacing chỉ cộng THÊM khoảng cách, trong khi vị trí mỗi ' +
            'chữ số vẫn bước đúng theo ĐỘ RỘNG GỐC CHƯA TRIM của sprite (sprite.trim=false, giữ cố ' +
            'định để không lệch canh lề giữa các chữ số — xem comment setValue()); nếu ảnh gốc mỗi ' +
            'chữ số có viền trong suốt (padding) 2 bên, khoảng cách NHÌN THẤY giữa 2 chữ số luôn dính ' +
            'chết phần padding đó dù digitSpacing về 0 hay âm. Field này trừ bớt ĐÚNG số px này ở MỖI ' +
            'BÊN (trái/phải, px TRƯỚC khi co giãn) khỏi độ rộng dùng để tính khoảng cách/vị trí — ' +
            'KHÔNG đụng gì tới contentSize/scale thật của sprite (hình chữ số vẫn vẽ đủ, không bị cắt ' +
            'hay méo gì cả, chỉ các chữ số được XẾP GẦN NHAU HƠN). Tăng dần tới khi 2 chữ số sát đúng ' +
            'ý muốn.',
    })
    digitEdgePadding = 0;

    @property({
        tooltip:
            'Kích thước khung mà 1 CHỮ SỐ ĐƠN LẺ (không phải cả cụm) vừa khít — width/height tính ' +
            'RIÊNG scaleX/scaleY, KHÔNG giữ tỉ lệ ảnh gốc (xác nhận từ user: "chấp nhận bị méo") — ' +
            'chữ sẽ bị kéo giãn méo nếu tỉ lệ 2 cạnh khác tỉ lệ ảnh gốc. BUG đã sửa (xác nhận từ ' +
            'user: "chuỗi 2-3 chữ số bị bé hơn hẳn 1 chữ số") — trước đây fitSize áp cho TỔNG chiều ' +
            'rộng cả cụm, nên càng nhiều chữ số thì scale càng phải nhỏ lại mới vừa khung. Giờ ' +
            'fitSize CHỈ quyết định kích thước của 1 CHỮ SỐ (không đổi dù số có mấy chữ số) — cụm ' +
            '2-3 chữ số rộng hơn, có thể tràn ra ngoài fitSize.width (fitSize.width lúc này chỉ còn ' +
            'ý nghĩa với số 1 chữ số).',
    })
    fitSize: Size = new Size(120, 80);

    @property({
        type: Enum(DigitAlign),
        tooltip:
            'Cách canh cả cụm chữ số quanh gốc node (vị trí node trong Editor). LEFT (mặc định): chữ số ĐẦU đứng yên tại ' +
            'gốc, số có thêm chữ số thì chữ số mới hiện thêm về bên PHẢI, không làm xê dịch chữ số đầu. CENTER: canh giữa ' +
            '(thêm chữ số thì cả cụm giãn đều 2 bên — hành vi cũ). RIGHT: chữ số cuối đứng yên, chữ số mới thêm về bên trái.',
    })
    align: DigitAlign = DigitAlign.Left;

    @property({ min: 0.01, tooltip: 'Hệ số nhân THÊM vào scale đã tự tính theo fitSize — chỉnh tay nếu muốn cả cụm to/nhỏ hơn mà không cần đổi fitSize. 1 = giữ nguyên.' })
    sizeScale = 1;

    setValue(value: number, gold: boolean): void {
        const text = String(Math.max(0, Math.floor(value)));
        const sprites = gold ? this.goldSprites : this.graySprites;

        while (this.node.children.length < text.length) this.createDigitNode();
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) children[i].active = i < text.length;

        const metrics: DigitMetrics[] = [];
        for (let i = 0; i < text.length; i++) {
            const digit = text.charCodeAt(i) - 48; // '0'.charCodeAt(0) === 48
            const frame = sprites[digit] ?? null;
            const digitNode = children[i];
            const sprite = digitNode.getComponent(Sprite) ?? digitNode.addComponent(Sprite);
            // "Các sprite đều không dùng trim" (xác nhận từ user): Trim=false -> engine hiểu contentSize là kích
            // thước ẢNH GỐC (originalSize) và tự đặt nét chữ theo viền trim của từng ảnh, nên mọi chữ số cùng canvas.
            sprite.trim = false;
            sprite.spriteFrame = frame;
            // BUG đã sửa: trước đây contentSize = frame.rect (kích thước ĐÃ TRIM, vd 136x187) trong khi trim=false
            // cần originalSize (vd 180x256) — mỗi chữ số bị co một tỉ lệ khác nhau và digitSpacing không khớp
            // khoảng cách nhìn thấy (xem layoutDigits).
            const original = frame?.originalSize;
            const rect = frame?.rect;
            const canvasW = original ? original.width : 0;
            const canvasH = original ? original.height : 0;
            (digitNode.getComponent(UITransform) ?? digitNode.addComponent(UITransform)).setContentSize(canvasW, canvasH);
            metrics.push({
                canvasW,
                canvasH,
                inkW: rect ? rect.width : 0,
                inkOffsetX: frame ? frame.offset.x : 0,
            });
        }

        // Scale tính theo canvas của 1 CHỮ SỐ ĐƠN LẺ (maxCanvas, không phải tổng cả cụm — xem comment đầu file), riêng
        // scaleX/scaleY theo fitSize.width/height (xác nhận từ user: "chấp nhận bị méo").
        const layout = layoutDigits(metrics, this.digitSpacing, this.digitEdgePadding, this.align);
        const scaleX = layout.maxCanvasW > 0 ? this.fitSize.width / layout.maxCanvasW : 1;
        const scaleY = layout.maxCanvasH > 0 ? this.fitSize.height / layout.maxCanvasH : 1;
        for (let i = 0; i < text.length; i++) children[i].setPosition(layout.xs[i], 0, 0);
        this.node.setScale(scaleX * this.sizeScale, scaleY * this.sizeScale, 1);
    }

    private createDigitNode(): Node {
        const node = new Node('Digit');
        node.layer = this.node.layer;
        node.addComponent(UITransform);
        node.addComponent(Sprite);
        node.parent = this.node;
        return node;
    }
}
