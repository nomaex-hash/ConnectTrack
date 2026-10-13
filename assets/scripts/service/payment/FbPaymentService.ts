import { IPaymentService, ProductInfo, PurchaseResult } from './IPaymentService';
import '../platform/FBInstantTypes';

/** Implementation thật — bọc FBInstant.payments.* (catalog/purchase/consume). */
export class FbPaymentService implements IPaymentService {
    isAvailable(): boolean {
        return typeof FBInstant !== 'undefined';
    }

    async getCatalog(): Promise<readonly ProductInfo[]> {
        if (typeof FBInstant === 'undefined') return [];

        const products = await FBInstant.payments.getCatalogAsync();
        return products.map((p) => ({ productId: p.productID, priceLabel: p.price }));
    }

    async purchase(productId: string): Promise<PurchaseResult> {
        if (typeof FBInstant === 'undefined') {
            throw new Error('[FbPaymentService] FBInstant SDK chưa được nạp.');
        }

        const purchase = await FBInstant.payments.purchaseAsync({ productID: productId, developerPayload: 'dogdoku' });
        return { productId: purchase.productID, purchaseToken: purchase.purchaseToken };
    }

    async consumePurchase(purchaseToken: string): Promise<void> {
        if (typeof FBInstant === 'undefined') return;
        await FBInstant.payments.consumePurchaseAsync(purchaseToken);
    }
}
