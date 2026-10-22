import { _decorator, Component, Label, Node, Sprite, SpriteFrame, Tween, tween } from 'cc';
import { DailyServiceHolder } from '../../service/DailyServiceHolder';
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';
import { EventManager } from '../../core/EventManager';
import { LANGUAGE_CHANGED_EVENT } from '../../localization/LocalizationEvents';

const { ccclass, property } = _decorator;

const GLOW_TURN_SECONDS = 15;


@ccclass('StreakButtonView')
export class StreakButtonView extends Component {
    @property({ type: Sprite, tooltip: 'Sprite mặt trời trên nút — đổi ảnh tắt/sáng.' })
    sunSprite: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh mặt trời MỜ (chưa có chuỗi).' })
    dimSunSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh mặt trời SÁNG (đã có chuỗi).' })
    litSunSprite: SpriteFrame | null = null;

    @property({ type: Node, tooltip: 'Vòng glow phía sau — chỉ hiện & xoay khi có chuỗi.' })
    glowNode: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Sprite nền đi kèm phần hiển thị Streak — chỉ hiện khi có chuỗi (ẩn khi chuỗi chưa được thắp).',
    })
    backgroundNode: Node | null = null;

    @property({ type: Label, tooltip: 'Nhãn số chuỗi (dưới mặt trời) — chỉ hiện khi có chuỗi.' })
    streakLabel: Label | null = null;

    @property({ type: Node, tooltip: 'Sprite dấu tích ở góc phải — chỉ hiện khi có chuỗi.' })
    checkNode: Node | null = null;

    onEnable(): void {
        EventManager.instance.on(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        this.refresh();
    }

    onDisable(): void {
        EventManager.instance.off(LANGUAGE_CHANGED_EVENT, this.refresh, this);
        if (this.glowNode) Tween.stopAllByTarget(this.glowNode);
    }

    refresh = (): void => {
        const service = DailyServiceHolder.current;
        const streak = service?.streak ?? 0;

        // "Đã thắp" phải gắn với việc HÔM NAY đã chơi/thắng (playedToday) — không chỉ dựa
        // vào streak > 0, vì streak vẫn giữ nguyên giá trị cũ (chưa hết hạn) suốt tới khi
        // người chơi thắng ván ĐẦU TIÊN của hôm nay. Cùng logic với DailyStreakScreen.
        const hasStreak = streak > 0 && (service?.getStreakBoard().playedToday ?? false);

        if (this.sunSprite) {
            const frame = hasStreak ? this.litSunSprite : this.dimSunSprite;
            if (frame) this.sunSprite.spriteFrame = frame;
        }

        if (this.streakLabel) {
            // Luôn hiện, kể cả khi chưa/không còn chuỗi (0) — không ẩn theo hasStreak nữa như
            // trước, người chơi cần thấy rõ số chuỗi hiện tại mọi lúc. Riêng streak = 0 thì
            // KHÔNG ghép số ("Streak" thay vì "Streak 0") — 0 chưa có gì để khoe, ghép số vào
            // chỉ gây rối mắt không cần thiết.
            this.streakLabel.node.active = true;
            this.streakLabel.string =
                streak > 0 ? `${Localization.get(L10N.menu.streak)} ${streak}` : Localization.get(L10N.menu.streak);
        }
        if (this.checkNode) this.checkNode.active = hasStreak;
        // backgroundNode ("streakCount") là node CHA bọc streakLabel — trước đây ẩn theo
        // hasStreak khiến label bên trong dù active=true vẫn không hiện (cha ẩn thì con ẩn
        // theo). Luôn bật để số streak (kể cả "Streak 0") luôn thấy được.
        if (this.backgroundNode) this.backgroundNode.active = true;

        this.updateGlow(hasStreak);
    }

    private updateGlow(hasStreak: boolean): void {
        const glow = this.glowNode;
        if (!glow) return;

        Tween.stopAllByTarget(glow);
        glow.active = hasStreak;
        if (!hasStreak) return;

        glow.angle = 0;
        tween(glow).by(GLOW_TURN_SECONDS, { angle: -360 }).repeatForever().start();
    }
}
