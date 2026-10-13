import { _decorator, Component, Label } from 'cc';
import { EventManager } from '../../core/EventManager';
import { BOOT_PROGRESS_EVENT, BootProgressEventPayload } from '../../event/AppEvents';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';

const { ccclass, property } = _decorator;

/** Bootloader báo tiến độ 0.5 ngay sau khi LocalizationManager.init() xong (bước "Ngôn ngữ"). */
const LANGUAGE_READY_PROGRESS = 0.5;

/**
 * Label ở màn Boot hiện MỘT dòng tip/câu trích dẫn ngẫu nhiên — chọn lại mỗi lần
 * app khởi động. Nội dung nằm trong localization (`boot.tips`, xem
 * assets/resources/localization/en.json và vi.json) để đổi ngôn ngữ tự động.
 *
 * KHÔNG đọc text ngay ở onLoad(): node này thuộc scene Boot nên onLoad() chạy
 * TRƯỚC KHI Bootloader kịp khởi tạo LocalizationManager (race điều kiện khởi
 * động). Phải đợi Bootloader báo tiến độ đã qua bước "Ngôn ngữ" mới đọc.
 */
@ccclass('BootTipLabel')
export class BootTipLabel extends Component {
    @property({ type: Label, tooltip: 'Label hiện tip. Bỏ trống thì lấy Label trên chính node này.' })
    label: Label | null = null;

    private picked = false;

    onLoad(): void {
        if (!this.label) this.label = this.getComponent(Label);
        EventManager.instance.on<BootProgressEventPayload>(
            BOOT_PROGRESS_EVENT,
            this.onBootProgress,
            this,
        );
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
    }

    private onBootProgress = (payload: BootProgressEventPayload): void => {
        if (this.picked || payload.progress < LANGUAGE_READY_PROGRESS) return;

        const text = Localization.getRandom(L10N.boot.tips);
        if (!text || !this.label) return;

        this.label.string = text;
        this.picked = true;
    };
}
