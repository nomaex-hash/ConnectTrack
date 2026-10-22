import { _decorator, Component, Node, Size, Sprite, SpriteFrame, UITransform } from 'cc';

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

    @property({ tooltip: 'Khoảng cách (px, TRƯỚC khi co giãn vừa khung) giữa 2 chữ số liền kề.' })
    digitSpacing = 4;

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

    @property({ min: 0.01, tooltip: 'Hệ số nhân THÊM vào scale đã tự tính theo fitSize — chỉnh tay nếu muốn cả cụm to/nhỏ hơn mà không cần đổi fitSize. 1 = giữ nguyên.' })
    sizeScale = 1;

    setValue(value: number, gold: boolean): void {
        const text = String(Math.max(0, Math.floor(value)));
        const sprites = gold ? this.goldSprites : this.graySprites;

        while (this.node.children.length < text.length) this.createDigitNode();
        const children = this.node.children;
        for (let i = 0; i < children.length; i++) children[i].active = i < text.length;

        const sizes: { w: number; h: number }[] = [];
        for (let i = 0; i < text.length; i++) {
            const digit = text.charCodeAt(i) - 48; // '0'.charCodeAt(0) === 48
            const frame = sprites[digit] ?? null;
            const digitNode = children[i];
            const sprite = digitNode.getComponent(Sprite) ?? digitNode.addComponent(Sprite);
            // "Các sprite đều không dùng trim" (xác nhận từ user) — Trim bật sẵn sẽ vẽ theo vùng ĐÃ
            // CẮT bỏ viền trong suốt của riêng từng ảnh, khiến các chữ số có độ đệm trong suốt khác
            // nhau bị lệch kích thước/canh lề so với nhau dù cùng 1 contentSize.
            sprite.trim = false;
            sprite.spriteFrame = frame;
            const rect = frame?.rect;
            const w = rect ? rect.width : 0;
            const h = rect ? rect.height : 0;
            (digitNode.getComponent(UITransform) ?? digitNode.addComponent(UITransform)).setContentSize(w, h);
            sizes.push({ w, h });
        }

        const totalWidth = sizes.reduce((sum, s, i) => sum + s.w + (i > 0 ? this.digitSpacing : 0), 0);
        // BUG đã sửa (xác nhận từ user — "chuỗi 2-3 chữ số bị bé hơn hẳn 1 chữ số"): scale phải tính
        // theo kích thước của 1 CHỮ SỐ ĐƠN LẺ (maxWidth, không phải totalWidth cả cụm cộng lại) —
        // nếu không, càng nhiều chữ số thì scale càng bị ép nhỏ lại mới vừa fitSize.width, khiến mỗi
        // chữ số trong số nhiều chữ số số luôn bé hơn hẳn so với số 1 chữ số.
        const maxWidth = sizes.reduce((max, s) => Math.max(max, s.w), 0);
        const maxHeight = sizes.reduce((max, s) => Math.max(max, s.h), 0);
        // BUG đã sửa (xác nhận từ user — "chỉnh fitSize.width to lên nhưng chữ vẫn không rộng ra"):
        // trước đây dùng CHUNG 1 scale (Math.min của cả 2 tỉ lệ) cho cả X lẫn Y để giữ đúng tỉ lệ
        // ảnh gốc — nếu height là tỉ lệ nhỏ hơn, nó luôn là "nút thắt cổ chai", tăng fitSize.width
        // bao nhiêu cũng không có tác dụng. Giờ tính RIÊNG scaleX/scaleY theo ĐÚNG fitSize.width/
        // height — CHẤP NHẬN MÉO HÌNH nếu tỉ lệ fitSize khác tỉ lệ ảnh gốc (xác nhận từ user: "chấp
        // nhận bị méo").
        const scaleX = maxWidth > 0 ? this.fitSize.width / maxWidth : 1;
        const scaleY = maxHeight > 0 ? this.fitSize.height / maxHeight : 1;

        let x = -totalWidth / 2;
        for (let i = 0; i < text.length; i++) {
            const w = sizes[i].w;
            children[i].setPosition(x + w / 2, 0, 0);
            x += w + this.digitSpacing;
        }
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
