import { _decorator, Component, Sprite, SpriteFrame } from 'cc';
import { RankTier } from '../../core/RankTier';

const { ccclass, property } = _decorator;


@ccclass('RankBadge')
export class RankBadge extends Component {
    @property({ type: Sprite, tooltip: 'Sprite hiển thị huy chương.' })
    target: Sprite | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh hạng Vàng.' })
    goldSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh hạng Bạc.' })
    silverSprite: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Ảnh hạng Đồng.' })
    bronzeSprite: SpriteFrame | null = null;

    setTier(tier: RankTier): void {
        if (!this.target) return;

        const frame =
            tier === RankTier.Gold
                ? this.goldSprite
                : tier === RankTier.Silver
                  ? this.silverSprite
                  : this.bronzeSprite;

        if (frame) this.target.spriteFrame = frame;
    }
}
