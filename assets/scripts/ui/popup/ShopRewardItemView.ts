import { _decorator, Component, Label, Sprite, SpriteFrame } from 'cc';
import { ShopResourceReward } from '../../config/ShopPackageDataConfig';

const { ccclass, property } = _decorator;

/**
 * 1 icon phần thưởng bên trong 1 dòng ShopBundleItemView — mirror ItemRewardBox.ts (cùng pattern
 * icon+label theo resource, đã dùng cho RewardPopup). Gộp Reference/ItemRewardShop.ts +
 * ItemRewardBase.ts thành 1 class, bỏ nhánh BOOSTER/SPECIAL (không tồn tại trong Dogdoku).
 */
@ccclass('ShopRewardItemView')
export class ShopRewardItemView extends Component {
    @property(Sprite)
    icon: Sprite | null = null;

    @property(Label)
    countLabel: Label | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icon khi resource = placeDogCharges.' })
    placeDogIcon: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icon khi resource = hintCharges.' })
    hintIcon: SpriteFrame | null = null;

    @property({ type: SpriteFrame, tooltip: 'Icon khi resource = coin.' })
    coinIcon: SpriteFrame | null = null;

    bind(reward: ShopResourceReward): void {
        if (this.icon) {
            this.icon.spriteFrame =
                reward.resource === 'placeDogCharges'
                    ? this.placeDogIcon
                    : reward.resource === 'hintCharges'
                      ? this.hintIcon
                      : this.coinIcon;
        }
        if (this.countLabel) this.countLabel.string = `x${reward.amount}`;
    }
}
