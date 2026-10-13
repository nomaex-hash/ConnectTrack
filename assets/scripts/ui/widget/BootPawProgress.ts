import { _decorator, Component, Node, Tween, UIOpacity, Vec3, tween } from 'cc';
import { EventManager } from '../../core/EventManager';
import { BOOT_PROGRESS_EVENT, BootProgressEventPayload } from '../../event/AppEvents';

const { ccclass, property } = _decorator;

/**
 * Chỉ báo loading kiểu "dấu chân" cho màn Boot — thay cho thanh chạy (BootProgressBar). Vị trí và
 * góc xoay của TỪNG dấu chân do người thiết kế tự đặt sẵn trong Editor (kéo mảng paws theo đúng
 * thứ tự muốn hiện); component này CHỈ bật/tắt + tạo hiệu ứng "bật lên" cho từng dấu chân, không
 * đụng tới position/rotation đã đặt sẵn. Cứ mỗi 1/paws.length tiến độ (100%/5 = 20% với 5 dấu
 * chân) thì hiện thêm 1 dấu chân kế tiếp.
 */
@ccclass('BootPawProgress')
export class BootPawProgress extends Component {
    @property({ type: [Node], tooltip: 'Các node dấu chân, ĐÚNG THỨ TỰ hiện dần (paws[0] hiện đầu tiên). Vị trí/góc xoay tự đặt sẵn trong Editor.' })
    paws: Node[] = [];

    @property({ tooltip: 'Thời gian hiệu ứng "bật lên" cho mỗi dấu chân (giây).' })
    popDuration = 0.25;

    @property({ tooltip: 'Scale phóng to lúc bắt đầu bật lên (0 = từ không có gì phình ra).' })
    popFromScale = 0.4;

    @property({ tooltip: 'Khoảng cách TỐI THIỂU giữa 2 lần hiện dấu chân liên tiếp (giây). Nếu data load nhanh hơn mốc này thì các dấu chân còn lại sẽ được xếp hàng và hiện lần lượt cách nhau đúng khoảng thời gian này; nếu data load chậm hơn thì không delay thêm.' })
    minPawInterval = 0.5;

    @property({ tooltip: 'Mốc tiến độ (0-1) mà từ đó coi như ĐÃ XONG để hiện luôn dấu chân cuối cùng, thay vì phải đợi đúng progress = 1. Giúp người chơi kịp thấy sprite cuối trước khi màn Boot chuyển cảnh. Ví dụ 0.9 = còn 10% cuối là hiện hết.' })
    finalPawEarlyProgress = 0.9;

    @property({ tooltip: 'Khoảng cách RIÊNG (giây) từ dấu chân áp chót đến dấu chân CUỐI CÙNG, ghi đè minPawInterval chỉ cho lần hiện cuối này. Dùng để cho dấu chân cuối chậm/nhanh hơn nhịp chung, ví dụ chờ lâu hơn để người chơi chắc chắn kịp thấy.' })
    lastPawInterval = 0.5;

    /** Số dấu chân đã thực sự hiện lên (đã pop xong lượt gọi showNextPaw). */
    private shownCount = 0;
    /** Số dấu chân đã được đưa vào hàng đợi (kể cả những cái đang chờ tới lượt) — dùng để không đẩy trùng vào queue. */
    private queuedCount = 0;
    /** Hàng đợi CHỈ SỐ (index trong mảng paws) các dấu chân đang chờ tới lượt hiện — cần index để biết lượt sắp tới có phải dấu chân cuối hay không. */
    private queue: number[] = [];
    /** Đang có 1 vòng scheduleOnce chờ hiện paw kế tiếp hay không — tránh chạy chồng nhiều vòng lặp. */
    private isProcessingQueue = false;
    /** Mốc thời gian (giây, theo Date.now()/1000) của lần hiện paw gần nhất. -Infinity để paw đầu tiên hiện ngay, không delay. */
    private lastShowTime = -Infinity;

    onLoad(): void {
        // Giữ paw.active = TRUE ngay từ đầu (chỉ ẩn qua opacity = 0), KHÔNG active = false — nếu
        // để inactive thì Cocos chưa hề submit draw call nào cho sprite này, tới lúc dấu chân ĐẦU
        // TIÊN thật sự cần hiện (showNextPaw() bật active = true lần đầu) mới phải biên dịch
        // shader/upload material lên GPU — đúng lúc đó gây khựng hình 1 khung hình, CHỈ xảy ra ở
        // dấu chân đầu vì các dấu chân sau dùng chung material đã "làm nóng" sẵn. Để active sẵn
        // (dù vô hình vì opacity=0) khiến chi phí "làm nóng" này trả trước, rải vào lúc app còn
        // đang load các bước nhanh phía đầu (rảnh rỗi), không còn dồn vào đúng lúc cần hiện nữa.
        for (const paw of this.paws) {
            paw.active = true;
            paw.setScale(new Vec3(1, 1, 1));
            const opacity = paw.getComponent(UIOpacity) ?? paw.addComponent(UIOpacity);
            // opacity = 1 (KHÔNG phải 0) cố ý — Cocos có thể bỏ qua hẳn draw call khi opacity = 0
            // (tối ưu "hoàn toàn trong suốt thì khỏi vẽ"), làm mất tác dụng "làm nóng" ở đây. 1/255
            // mắt thường không phân biệt được với vô hình nhưng vẫn ép GPU thực sự vẽ.
            opacity.opacity = 1;
        }
        this.shownCount = 0;
        this.queuedCount = 0;
        this.queue = [];
        this.isProcessingQueue = false;
        this.lastShowTime = -Infinity;

        EventManager.instance.on<BootProgressEventPayload>(BOOT_PROGRESS_EVENT, this.onProgress, this);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
        this.unscheduleAllCallbacks();
    }

    private onProgress = (payload: BootProgressEventPayload): void => {
        if (this.paws.length === 0) return;

        const value = Math.max(0, Math.min(1, payload.progress));
        // Từ mốc finalPawEarlyProgress trở đi, coi như đã 100% để hiện luôn dấu chân cuối —
        // tránh trường hợp dấu chân cuối chỉ hiện đúng lúc progress = 1, dễ bị cảnh Boot chuyển
        // đi ngay sau đó khiến người chơi không kịp thấy sprite cuối. Các dấu chân trước đó vẫn
        // giữ nguyên mốc hiện của mình vì threshold của chúng luôn nhỏ hơn finalPawEarlyProgress.
        const effectiveValue = value >= this.finalPawEarlyProgress ? 1 : value;
        // Cứ mỗi 1/paws.length tiến độ thì hiện thêm 1 dấu chân — với 5 dấu chân tức 20%/dấu.
        const targetCount = Math.min(this.paws.length, Math.floor(effectiveValue * this.paws.length + 1e-6));

        // Không hiện ngay — chỉ đẩy index các paw còn thiếu vào hàng đợi, để processQueue tự giãn cách.
        while (this.queuedCount < targetCount) {
            this.queue.push(this.queuedCount);
            this.queuedCount++;
        }

        this.processQueue();
    };

    /**
     * Rút từng paw ra khỏi hàng đợi theo index, đảm bảo cách lần hiện trước đúng khoảng thời gian
     * quy định — `lastPawInterval` riêng nếu paw sắp hiện là dấu chân CUỐI CÙNG, còn lại dùng
     * `minPawInterval` chung. Nếu progress đã tự nhiên đến chậm hơn mốc này rồi thì hiện ngay
     * (wait = 0); nếu đến dồn dập (data load quá nhanh) thì các paw dư sẽ phải đợi đủ khoảng cách
     * rồi mới hiện lần lượt.
     */
    private processQueue(): void {
        if (this.isProcessingQueue || this.queue.length === 0) return;

        const nextIndex = this.queue[0];
        const isLastPaw = nextIndex === this.paws.length - 1;
        const interval = isLastPaw ? this.lastPawInterval : this.minPawInterval;

        const now = Date.now() / 1000;
        const elapsed = now - this.lastShowTime;
        const wait = Math.max(0, interval - elapsed);

        this.isProcessingQueue = true;
        this.scheduleOnce(() => {
            this.isProcessingQueue = false;

            const index = this.queue.shift();
            const paw = index !== undefined ? this.paws[index] : undefined;
            if (paw && paw.isValid) {
                this.showNextPaw(paw);
                this.shownCount++;
                this.lastShowTime = Date.now() / 1000;
            }

            // Còn paw trong hàng đợi thì tiếp tục vòng kế tiếp.
            this.processQueue();
        }, wait);
    }

    private showNextPaw(paw: Node): void {
        Tween.stopAllByTarget(paw);
        paw.active = true;
        const opacity = paw.getComponent(UIOpacity) ?? paw.addComponent(UIOpacity);
        opacity.opacity = 255;
        paw.setScale(new Vec3(this.popFromScale, this.popFromScale, 1));
        tween(paw)
            .to(this.popDuration, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();
    }
}