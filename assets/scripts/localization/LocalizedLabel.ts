import { _decorator, Component, Label } from 'cc';
import { EventManager } from '../core/EventManager';
import { CurvedLabel } from '../ui/widget/CurvedLabel';
import { LANGUAGE_CHANGED_EVENT } from './LocalizationEvents';
import { Localization } from './Localization';

const { ccclass, property } = _decorator;


@ccclass('LocalizedLabel')
export class LocalizedLabel extends Component {
    @property({ tooltip: 'Key trong file JSON, ví dụ menu.play. Xem LocalizationKeys.ts.' })
    key = '';

    @property({ type: Label, tooltip: 'Trống thì dùng cc.Label trên chính node này.' })
    label: Label | null = null;

    onLoad(): void {
        if (!this.label) this.label = this.getComponent(Label);
    }

    onEnable(): void {
        EventManager.instance.on(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        this.refresh();
    }

    onDisable(): void {
        EventManager.instance.off(LANGUAGE_CHANGED_EVENT, this.refresh, this);
    }

    onDestroy(): void {
        EventManager.instance.targetOff(this);
    }

    setKey(key: string): void {
        this.key = key;
        this.refresh();
    }

    private refresh = (): void => {
        if (this.key.length === 0) return;
        const text = Localization.get(this.key);

        // Node có gắn CurvedLabel (chữ cong) trên CÙNG node — ưu tiên dựng chữ cong, đồng
        // thời tắt hẳn Label thẳng (nếu có) để không hiện đè lên chữ cong.
        const curved = this.getComponent(CurvedLabel);
        if (curved) {
            curved.setText(text);
            if (this.label) this.label.enabled = false;
            return;
        }

        if (this.label) this.label.string = text;
    };
}
