import { _decorator, Component, Label, Node, tween, Tween, Vec3 } from 'cc';
import { EventManager } from '../../core/EventManager';
import { SaveManager } from '../../manager/SaveManager';
import {
    COIN_EXCHANGE_COMPLETED_EVENT,
    CoinExchangeCompletedEventPayload,
    SHOP_PURCHASE_COMPLETED_EVENT,
    SHOP_SCROLL_TO_GOLD_REQUESTED_EVENT,
    ShopPurchaseCompletedEventPayload,
} from '../../event/ShopEvents';

const { ccclass, property } = _decorator;

/**
 * Hiển thị số coin hiện có trên thanh trên cùng của Shop — adapt từ Reference/coinGroup.ts, bỏ
 * hẳn clientEvent/GameResourceConfigManager/SCENE_TYPE (không tồn tại trong Dogdoku). Đọc trực
 * tiếp PlayerData.inventory.coin, cập nhật khi SHOP_PURCHASE_COMPLETED_EVENT hoặc
 * COIN_EXCHANGE_COMPLETED_EVENT bắn ra.
 */
@ccclass('CoinBalanceView')
export class CoinBalanceView extends Component {
    @property(Label)
    txtCoin: Label | null = null;

    @property(Node)
    iconCoin: Node | null = null;

    private pulseTween: Tween<Node> | null = null;

    protected onEnable(): void {
        const bus = EventManager.instance;
        bus.on<ShopPurchaseCompletedEventPayload>(SHOP_PURCHASE_COMPLETED_EVENT, this.onCoinChanged, this);
        bus.on<CoinExchangeCompletedEventPayload>(COIN_EXCHANGE_COMPLETED_EVENT, this.onCoinChanged, this);
        this.refresh();
    }

    protected onDisable(): void {
        EventManager.instance.targetOff(this);
        this.pulseTween?.stop();
        this.pulseTween = null;
    }

    private refresh(): void {
        if (this.txtCoin) this.txtCoin.string = `${SaveManager.instance.playerData.inventory.coin}`;
    }

    private onCoinChanged = (payload: { coin: number }): void => {
        if (this.txtCoin) this.txtCoin.string = `${payload.coin}`;
        this.playPulse();
    };

    private playPulse(): void {
        if (!this.iconCoin) return;
        this.pulseTween?.stop();
        this.pulseTween = tween(this.iconCoin)
            .to(0.1, { scale: new Vec3(1.1, 1.1, 1.1) }, { easing: 'linear' })
            .to(0.1, { scale: new Vec3(1, 1, 1) }, { easing: 'linear' })
            .start();
    }

    /** Gắn clickEvents của btnAddCoin trỏ vào đây — yêu cầu ShopTabGroupManager cuộn tới khu mua coin. */
    onTapAddCoin(): void {
        EventManager.instance.emit(SHOP_SCROLL_TO_GOLD_REQUESTED_EVENT, undefined);
    }
}
