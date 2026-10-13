import { _decorator, Button, Component, Label } from 'cc';
import { ShopPackageDataConfig } from '../../config/ShopPackageDataConfig';
import { Localization } from '../../localization/Localization';

const { ccclass, property } = _decorator;

@ccclass('ShopItemView')
export class ShopItemView extends Component {
    @property(Label)
    nameLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Liệt kê phần thưởng, vd "+5 Đặt hộ, +10 Gợi ý".' })
    rewardLabel: Label | null = null;

    @property({ type: Label, tooltip: 'Nhãn trên nút mua — GD tự điền giá thật (chưa nối FB price catalog).' })
    priceLabel: Label | null = null;

    @property(Button)
    buyButton: Button | null = null;

    private packageId = '';
    private onTapBuy: ((packageId: string) => void) | null = null;

    bind(config: ShopPackageDataConfig, purchaseCount: number, onTapBuy: (packageId: string) => void): void {
        this.packageId = config.id;
        this.onTapBuy = onTapBuy;

        if (this.nameLabel) this.nameLabel.string = Localization.get(config.nameKey);
        if (this.rewardLabel) {
            this.rewardLabel.string = config.rewards
                .map((reward) => `+${reward.amount} ${reward.resource}`)
                .join(', ');
        }
        if (this.priceLabel) {
            // TODO: thay bằng price thật từ IPaymentService.getCatalog() khi có productID FB thật.
            this.priceLabel.string = purchaseCount > 0 ? `x${purchaseCount}` : '';
        }
        if (this.buyButton) this.buyButton.interactable = true;
    }

    /** Gắn clickEvents của buyButton trỏ vào đây. */
    onTapBuyButton(): void {
        this.onTapBuy?.(this.packageId);
    }
}
