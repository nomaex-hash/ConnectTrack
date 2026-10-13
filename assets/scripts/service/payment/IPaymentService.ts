export interface ProductInfo {
    readonly productId: string;
    readonly priceLabel: string;
}

export interface PurchaseResult {
    readonly productId: string;
    readonly purchaseToken: string;
}

/**
 * Trừu tượng thanh toán thật (FBInstant.payments.*) — TÁCH RIÊNG khỏi ShopIAPManager: service
 * này chỉ biết "trả tiền xong chưa", KHÔNG biết gói nào cho thưởng gì (đó là việc của
 * ShopPackageDataConfig/ShopIAPManager). Bản mock không có gì để trả nên isAvailable() luôn false.
 */
export interface IPaymentService {
    isAvailable(): boolean;

    getCatalog(): Promise<readonly ProductInfo[]>;
    purchase(productId: string): Promise<PurchaseResult>;
    consumePurchase(purchaseToken: string): Promise<void>;
}
