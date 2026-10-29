/**
 * Quyết định màn hình có "rộng" (nút neo cạnh phải) hay không — hàm thuần, không phụ thuộc engine để test được.
 *
 * Kích thước tính bằng px CSS. Ngoài ngưỡng chiều rộng, màn đang XOAY NGANG (rộng > cao) cũng được coi là
 * rộng khi `landscapeIsWide`: nhiều điện thoại xoay ngang chỉ rộng ~640–750px CSS (dưới ngưỡng 755), nếu chỉ
 * so ngưỡng thì các máy đó không bao giờ chuyển vị trí dù đã xoay ngang.
 */
export function isWideScreen(widthCss: number, heightCss: number, threshold: number, landscapeIsWide: boolean): boolean {
    if (widthCss > threshold) return true;
    return landscapeIsWide && widthCss > heightCss;
}
