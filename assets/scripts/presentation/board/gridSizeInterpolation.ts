/**
 * Nội suy tuyến tính giữa giá trị cho màn ÍT cell và giá trị cho màn NHIỀU cell, theo kích thước lưới
 * (cạnh lớn nhất = max(width, height)).
 *
 *  - gridSize <= fewSize  -> atFew  (màn ÍT cell, cell to)
 *  - gridSize >= manySize -> atMany (màn NHIỀU cell, cell nhỏ)
 *  - ở giữa: nội suy tuyến tính.
 *
 * Dùng cho gợi ý nối nhàn rỗi (dash/chấm tròn): Min áp cho màn nhiều cell, Max cho màn ít cell — giá trị
 * thực sự CHẠM Min/Max ở 2 đầu, khác với cách cũ chỉ kẹp (clamp) một giá trị tỉ lệ theo cellSize.
 * Nếu fewSize >= manySize (cấu hình sai) thì trả atFew để không chia cho 0.
 */
export function interpolateByGridSize(
    atFew: number,
    atMany: number,
    gridSize: number,
    fewSize: number,
    manySize: number,
): number {
    if (!(manySize > fewSize)) return atFew;
    const t = Math.min(1, Math.max(0, (gridSize - fewSize) / (manySize - fewSize)));
    return atFew + (atMany - atFew) * t;
}
