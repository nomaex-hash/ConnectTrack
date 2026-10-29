/** Cách canh cả cụm chữ số quanh gốc node. */
export enum DigitAlign {
    /** Canh giữa: thêm chữ số thì cả cụm giãn đều 2 bên (chữ số đầu bị xê dịch). */
    Center = 0,
    /** Canh trái: chữ số đầu đứng yên tại gốc node, chữ số mới hiện thêm về bên phải. */
    Left = 1,
    /** Canh phải: chữ số cuối đứng yên tại gốc node, chữ số mới hiện thêm về bên trái. */
    Right = 2,
}

/** Số đo của 1 sprite chữ số, tính bằng px GỐC (trước khi co giãn node). */
export interface DigitMetrics {
    /** Kích thước nguyên bản (chưa trim) của ảnh — chính là contentSize của node khi Sprite.trim = false. */
    readonly canvasW: number;
    readonly canvasH: number;
    /** Bề rộng NÉT CHỮ thật (rect của SpriteFrame, đã bỏ viền trong suốt). */
    readonly inkW: number;
    /** Tâm nét chữ lệch bao nhiêu so với tâm canvas theo trục X (SpriteFrame.offset.x). */
    readonly inkOffsetX: number;
}

export interface DigitLayout {
    /** Toạ độ X của node từng chữ số (tâm canvas), đã canh giữa cả cụm quanh 0. */
    readonly xs: number[];
    readonly maxCanvasW: number;
    readonly maxCanvasH: number;
}

/**
 * Xếp các chữ số sao cho khoảng cách NHÌN THẤY giữa 2 nét chữ liền kề đúng bằng `spacing`, bất kể mỗi ảnh
 * có viền trong suốt hay bề rộng khác nhau.
 *
 * BUG cũ: contentSize được đặt bằng rect ĐÃ TRIM (vd 136x187) trong khi Sprite.trim = false — với trim=false engine
 * (assembler simple.ts) hiểu contentSize là kích thước ẢNH GỐC (originalSize, vd 180x256) rồi tự dịch nét chữ theo
 * viền trim; nên mỗi ảnh bị co một tỉ lệ KHÁC NHAU (136/180, 123/180, 144/180...) và bước nhảy giữa các chữ số tính theo
 * rect nên spacing không còn khớp thứ nhìn thấy. Giờ contentSize = originalSize (mọi chữ số cùng canvas, thẳng hàng) và
 * khoảng cách tính theo bề rộng NÉT CHỮ + offset.
 *
 * `edgePadding` (tương thích cũ): bớt thêm ngần này px ở MỖI BÊN nét chữ khi tính khoảng cách (cho phép sát/chồng
 * nhau hơn nữa); 0 = không dùng.
 */
export function layoutDigits(
    metrics: readonly DigitMetrics[],
    spacing: number,
    edgePadding = 0,
    align: DigitAlign = DigitAlign.Center,
): DigitLayout {
    const slot = (m: DigitMetrics): number => Math.max(0, m.inkW - 2 * edgePadding);
    const total = metrics.reduce((sum, m, i) => sum + slot(m) + (i > 0 ? spacing : 0), 0);
    const xs: number[] = [];
    let cursor = -total / 2;
    for (const m of metrics) {
        const inkCenter = cursor + slot(m) / 2;
        xs.push(inkCenter - m.inkOffsetX);
        cursor += slot(m) + spacing;
    }
    // Căn trái/phải: GHIM tâm canvas của chữ số đầu (trái) hoặc cuối (phải) tại x = 0 (gốc node) — nên khi số có
    // thêm chữ số, chữ số đầu KHÔNG bị xê dịch, các chữ số mới chỉ nối thêm về bên phải (hoặc bên trái nếu căn phải).
    if (xs.length > 0 && align !== DigitAlign.Center) {
        const shift = -xs[align === DigitAlign.Left ? 0 : xs.length - 1];
        for (let i = 0; i < xs.length; i++) xs[i] += shift;
    }
    return {
        xs,
        maxCanvasW: metrics.reduce((max, m) => Math.max(max, m.canvasW), 0),
        maxCanvasH: metrics.reduce((max, m) => Math.max(max, m.canvasH), 0),
    };
}
