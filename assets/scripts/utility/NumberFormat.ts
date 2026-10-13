/** Thêm dấu "," ngăn cách mỗi 3 số, ví dụ 12345 -> "12,345". Không phụ thuộc locale
 * (toLocaleString không đáng tin cậy trên mọi engine JS di động) nên tự tách bằng regex. */
export function formatThousands(value: number): string {
    const sign = value < 0 ? '-' : '';
    const digits = Math.round(Math.abs(value)).toString();
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
