import { _decorator, instantiate, Node, Prefab } from 'cc';
import { BaseTabGroupManager } from '../../home/BaseTabGroupManager';
import { ShopItemView } from './ShopItemView';
import { SHOP_PACKAGES } from '../../config/ShopPackageDataConfig';
import { ShopIAPManagerHolder } from '../../service/shop/ShopIAPManagerHolder';
import { GameManager } from '../../manager/GameManager';
import { EventManager } from '../../core/EventManager';
import { SHOP_PURCHASE_COMPLETED_EVENT } from '../../event/ShopEvents';

const { ccclass, property } = _decorator;

/**
 * Trang Shop trên bottom bar Home (carousel, xem HomeTabGroupManager) — danh sách tĩnh
 * SHOP_PACKAGES, KHÔNG dùng cell-pool. Mua qua GameManager.instance.purchasePackage().
 */
@ccclass('ShopPopup')
export class ShopPopup extends BaseTabGroupManager {
    @property({ type: Prefab, tooltip: 'Prefab 1 dòng gói hàng, gắn component ShopItemView.' })
    itemPrefab: Prefab | null = null;

    @property({ type: Node, tooltip: 'Node cha chứa các dòng gói hàng (Layout dọc).' })
    contentContainer: Node | null = null;

    private readonly items: ShopItemView[] = [];
    private buying = false;
    private bound = false;

    showGroup(): void {
        super.showGroup();

        if (!this.bound) {
            EventManager.instance.on(SHOP_PURCHASE_COMPLETED_EVENT, this.onPurchaseCompleted, this);
            this.bound = true;
        }
        this.rebuild();
    }

    setHide(): void {
        super.setHide();
        EventManager.instance.targetOff(this);
        this.bound = false;
    }

    private rebuild(): void {
        if (!this.itemPrefab || !this.contentContainer) return;

        this.contentContainer.removeAllChildren();
        this.items.length = 0;

        const shop = ShopIAPManagerHolder.current;
        for (const config of SHOP_PACKAGES) {
            const node = instantiate(this.itemPrefab);
            node.setParent(this.contentContainer);

            const view = node.getComponent(ShopItemView);
            if (!view) {
                console.warn('[ShopPopup] itemPrefab thiếu component ShopItemView.');
                continue;
            }
            view.bind(config, shop?.getPurchaseCount(config.id) ?? 0, this.onTapBuyPackage);
            this.items.push(view);
        }
    }

    private onTapBuyPackage = (packageId: string): void => {
        if (this.buying) return;
        this.buying = true;

        GameManager.instance
            .purchasePackage(packageId)
            .then(() => {
                this.buying = false;
            })
            .catch((error: unknown) => {
                console.warn(`[ShopPopup] Mua gói '${packageId}' thất bại:`, error);
                this.buying = false;
            });
    };

    private onPurchaseCompleted = (): void => {
        this.rebuild();
    };
}
