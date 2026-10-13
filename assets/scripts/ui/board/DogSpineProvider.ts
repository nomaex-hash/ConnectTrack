import { Node, Vec3 } from 'cc';
import { DogView } from './DogView';


export interface DogSpineProvider {

    acquire(localPos: Readonly<Vec3>, size: number): DogView;

    release(view: DogView): void;

    /**
     * Đưa `node` lên làm con CUỐI CÙNG của lớp chó (vẽ đè lên MỌI con chó hiện có) — dùng
     * khi một hiệu ứng khác trên ô (trái tim/X đặt sai) cần tạm thời nổi lên trên tất cả
     * chó vì vừa được kích hoạt SAU. Giữ nguyên vị trí thế giới (không bị nhảy chỗ).
     *
     * `ownerCellNode`: node CHÍNH của ô sở hữu hiệu ứng này — nếu ô đó đang bị "nhấc" ra
     * khỏi cellContainer bình thường (ví dụ tutorial spotlight, nhấc lên trên nền đen),
     * `node` sẽ được nhấc theo ĐÚNG layer đó thay vì luôn đưa vào dogLayer cố định (dogLayer
     * lúc này vẫn nằm DƯỚI nền đen nên sẽ bị che mất nếu cứ đưa vào đó).
     */
    raiseAboveDogs(node: Node, ownerCellNode: Node): void;
}
