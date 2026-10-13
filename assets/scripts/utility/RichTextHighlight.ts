/**
 * Bọc BBCode màu (+ cỡ chữ to hơn, nếu truyền emphasisSize) quanh mọi cụm SỐ (kể cả có dấu %
 * theo sau) trong `text` — dùng cho cc.RichText để làm nổi bật số liệu giữa câu (ví dụ
 * "Faster than 87% of players" -> "...than <color=#4cd137><size=48>87%</size></color> of players").
 *
 * emphasisSize là px TUYỆT ĐỐI (BBCode <size> không hỗ trợ giá trị tương đối) — tính từ
 * fontSize gốc của RichText nhân với 1 tỉ lệ, xem ResultPopup/DailyResultPopup.emphasisSizeRatio.
 * Lệch baseline giữa các cỡ chữ khác nhau trên cùng dòng ĐÃ khắc phục bằng cách canh dòng
 * (vertical align) riêng trên RichText ở Editor — không còn là giới hạn code nữa.
 */
export function highlightNumbers(text: string, colorHex: string, emphasisSize?: number): string {
    return text.replace(/\d+%?/g, (match) => {
        const inner = emphasisSize ? `<size=${emphasisSize}>${match}</size>` : match;
        return `<color=#${colorHex}>${inner}</color>`;
    });
}
