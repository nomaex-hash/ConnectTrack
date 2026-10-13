import { _decorator, Label } from 'cc';
import { ShopBundleItemView } from './ShopBundleItemView';
import { ShopPackageDataConfig } from '../../config/ShopPackageDataConfig';

const { ccclass, property } = _decorator;

/**
 * 1 dòng gói tier "gold/coin" (chỉ tặng coin) — adapt từ Reference/ItemShopGold.ts, bỏ hẳn
 * GameResourceConfigManager/CURRENCY_TYPE. Kế thừa ShopBundleItemView vì luồng mua/hiển thị giá
 * giống hệt, chỉ thêm 1 label hiển thị số coin nhận được.
 */
@ccclass('ShopCoinItemView')
export class ShopCoinItemView extends ShopBundleItemView {
    @property(Label)
    txtCurrency_Money: Label | null = null;

    @property(Label)
    txtCurrency_Money_Shadow: Label | null = null;

    protected showInfo(config: ShopPackageDataConfig): void {
        super.showInfo(config);

        const coinReward = config.rewards.find((reward) => reward.resource === 'coin');
        const coinText = coinReward ? `${coinReward.amount}` : '';
        if (this.txtCurrency_Money) this.txtCurrency_Money.string = coinText;
        if (this.txtCurrency_Money_Shadow) this.txtCurrency_Money_Shadow.string = coinText;
    }
}
