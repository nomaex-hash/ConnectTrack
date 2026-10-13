export const SHOP_PURCHASE_COMPLETED_EVENT = 'ShopPurchaseCompletedEvent';

export interface ShopPurchaseCompletedEventPayload {
    readonly packageId: string;
    /** Tổng lượt hiện có SAU khi cộng thưởng — UI dùng để cập nhật ngay, khỏi tính lại. */
    readonly placeDogCharges: number;
    readonly hintCharges: number;
    readonly coin: number;
}

export const COIN_EXCHANGE_COMPLETED_EVENT = 'CoinExchangeCompletedEvent';

export interface CoinExchangeCompletedEventPayload {
    readonly optionId: string;
    readonly placeDogCharges: number;
    readonly hintCharges: number;
    readonly coin: number;
}

/** Bấm nút "+" cạnh số coin trong Shop — yêu cầu cuộn tới khu mua coin (arrGoldGroup). */
export const SHOP_SCROLL_TO_GOLD_REQUESTED_EVENT = 'ShopScrollToGoldRequestedEvent';
