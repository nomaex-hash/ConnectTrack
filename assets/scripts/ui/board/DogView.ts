import { _decorator, Component, Vec3 } from 'cc';

const { ccclass } = _decorator;

/**
 * Hợp đồng chung cho "nhân vật đứng trong ô" (chó / chim cánh cụt / skin khác).
 *
 * BoardView tìm component theo lớp cơ sở này nên đổi bộ hình chỉ là đổi prefab —
 * gameplay và CellView không phải sửa gì.
 *
 * Hiện có 2 bản cài đặt:
 *  - DogSpineView    → Spine (atlas head_dog)
 *  - PenguinAnimView → animation khung hình (cc.Animation, thư mục animations/)
 */
@ccclass('DogView')
export abstract class DogView extends Component {
    /** Đặt vào vị trí ô (toạ độ local trong lớp chứa) và co cho vừa cạnh ô. */
    abstract place(localPos: Readonly<Vec3>, size: number): void;

    /**
     * Vừa được LẤY RA TỪ POOL (acquire) để gán cho một ô mới — dọn sạch mọi trạng thái
     * còn sót từ lần dùng TRƯỚC đó (particle, ring, animation đang chờ FINISHED, tween
     * dở dang...). BẮT BUỘC gọi trước khi dùng node cho ô mới, vì node được TÁI SỬ DỤNG
     * giữa các ô/màn chơi — không dọn thì hiệu ứng cũ (ví dụ particle chưa kịp tự ẩn lúc
     * thoát màn giữa chừng) sẽ "rò rỉ" sang lần dùng sau.
     */
    abstract reset(): void;

    /**
     * Vừa được đặt xuống ô — đặt ĐÚNG do người chơi thao tác (particle/ring/bounce đầy đủ).
     * `onSettled` (nếu có) được gọi khi hiệu ứng đã chạy XONG HẲN (đập xuống xong) — dùng
     * cho chỗ nào cần đợi đúng lúc hiệu ứng kết thúc mới làm gì tiếp theo.
     */
    abstract playAppear(onSettled?: () => void): void;

    /**
     * Ô đã có chó SẴN lúc bàn cờ vừa dựng xong (mới vào màn MỚI) — KHÔNG phải người chơi
     * vừa đặt, nên KHÔNG chạy particle/ring, chỉ hiệu ứng nhẹ hơn. Ván RESUME đang chơi dở
     * dùng sprite tĩnh riêng (CellView.showStaticDog) — không gọi tới hàm này.
     */
    abstract playRevealAppear(): void;

    /** Trạng thái đứng yên. */
    abstract playIdle(): void;

    /** Người chơi đặt sai ở đâu đó. */
    abstract playFrustrated(): void;

    /** Thua màn. */
    abstract playCry(): void;

    /** Thắng màn. */
    abstract playCelebrate(): void;
}
