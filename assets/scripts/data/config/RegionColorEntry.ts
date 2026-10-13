import { _decorator, Color } from 'cc';

const { ccclass, property } = _decorator;

/**
 * 1 mục màu vùng — GD gán mảng này trên BoardView.regionColors, CÙNG THỨ TỰ/INDEX với
 * regionSprites (vùng id N dùng phần tử N ở cả 2 mảng, lặp vòng nếu vùng nhiều hơn mục).
 * Dùng để tô đúng màu tên vùng trong text gợi ý (vd "{color}" -> "<color=#4cd137>xanh lá</color>").
 */
@ccclass('RegionColorEntry')
export class RegionColorEntry {
    @property({ tooltip: 'Key L10N cho tên màu hiển thị, vd "color.green".' })
    nameKey = '';

    @property
    color: Color = new Color(255, 255, 255);
}
