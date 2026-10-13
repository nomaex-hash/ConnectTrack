import { Color } from 'cc';
import { RegionColorEntry } from '../../data/config/RegionColorEntry';

/** Chọn phần tử theo regionId, lặp vòng nếu vùng nhiều hơn số phần tử trong mảng. */
function pickByRegionId<T>(items: readonly T[], regionId: number): T | null {
    if (items.length === 0) return null;

    const index = ((regionId % items.length) + items.length) % items.length;
    return items[index] ?? null;
}

/** Bảng tên + màu (RegionColors) — CHỈ dùng để tô màu tên vùng trong text gợi ý, không liên quan
 * tới màu nền ô (xem pickCellRegionColor). */
export function pickRegionColor(
    colors: readonly RegionColorEntry[],
    regionId: number,
): RegionColorEntry | null {
    return pickByRegionId(colors, regionId);
}

/** Bảng màu RIÊNG dùng để tô nền ô (background) — tách khỏi RegionColors (bảng đó giữ nguyên chỉ
 * cho text gợi ý), để 2 việc đổi màu độc lập nhau. */
export function pickCellRegionColor(colors: readonly Color[], regionId: number): Color | null {
    return pickByRegionId(colors, regionId);
}
