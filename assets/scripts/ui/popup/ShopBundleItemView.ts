import { _decorator, Component, instantiate, Label, Node, Prefab } from 'cc';
import { ShopPackageDataConfig } from '../../config/ShopPackageDataConfig';
import { ShopRewardItemView } from './ShopRewardItemView';
import { Localization } from '../../localization/Localization';

const { ccclass, property } = _decorator;

/**
 * 1 dòng gói mua bằng tiền thật (starter/medium/large/big/mega bundle) — adapt từ
 * Reference/ItemBaseShopBundle.ts, bỏ hẳn FBInstantManager/localConfig/clientEvent/PackageName
 * (IAP thật đi qua GameManager.purchasePackage(), xem ShopTabGroupManager). Mirror
 * ShopItemView.bind() đã có sẵn cho ShopPopup — cùng convention (bind + callback rời).
 */
@ccclass('ShopBundleItemView')
export class ShopBundleItemView extends Component {
    @property(Label)
    txtPrice: Label | null = null;

    @property(Label)
    txtPrice_Shadow: Label | null = null;

    @property(Label)
    txtNamePackage: Label | null = null;

    @property({ type: Node, tooltip: 'Node cha chứa các ShopRewardItemView, xoá hết con rồi dựng lại theo config.rewards.' })
    groupReward: Node | null = null;

    @property({ type: Prefab, tooltip: 'Prefab 1 icon phần thưởng, gắn component ShopRewardItemView.' })
    rewardItemPrefab: Prefab | null = null;

    protected packageId = '';
    protected onTapBuy: ((packageId: string, sourceNode: Node) => void) | null = null;

    bind(config: ShopPackageDataConfig, onTapBuy: (packageId: string, sourceNode: Node) => void): void {
        this.packageId = config.id;
        this.onTapBuy = onTapBuy;

        if (this.txtNamePackage) this.txtNamePackage.string = Localization.get(config.nameKey);
        this.showInfo(config);
        this.rebuildRewards(config);
    }

    protected showInfo(config: ShopPackageDataConfig): void {
        // TODO: thay bằng price thật từ IPaymentService.getCatalog() khi có productID FB thật
        // (giống TODO đã có sẵn trong ShopItemView.ts).
        const priceText = config.id;
        if (this.txtPrice) this.txtPrice.string = priceText;
        if (this.txtPrice_Shadow) this.txtPrice_Shadow.string = priceText;
    }

    private rebuildRewards(config: ShopPackageDataConfig): void {
        if (!this.groupReward || !this.rewardItemPrefab) return;

        this.groupReward.removeAllChildren();
        for (const reward of config.rewards) {
            const node = instantiate(this.rewardItemPrefab);
            node.setParent(this.groupReward);
            node.getComponent(ShopRewardItemView)?.bind(reward);
        }
    }

    /** Gắn clickEvents của btnBuy trỏ vào đây. */
    onTapBuyButton(): void {
        this.onTapBuy?.(this.packageId, this.node);
    }
}
