import { IPaymentService, ProductInfo, PurchaseResult } from './IPaymentService';

/**
 * isAvailable() luôn false — không có FBInstant.payments thật để gọi (Editor/preview).
 *
 * TẠM THỜI: purchase()/consumePurchase() giả lập THÀNH CÔNG luôn (không gọi thanh toán thật)
 * để test luồng mua hàng trong Preview/Editor. Trước khi build thật cho FB Instant, thay
 * PaymentServiceHolder.current bằng 1 IPaymentService thật (vd FbPaymentService) — xem
 * FbPaymentService.ts.
 */
export class MockPaymentService implements IPaymentService {
    isAvailable(): boolean {
        return false;
    }

    async getCatalog(): Promise<readonly ProductInfo[]> {
        return [];
    }

    async purchase(productId: string): Promise<PurchaseResult> {
        return { productId, purchaseToken: `mock_${productId}_${Date.now()}` };
    }

    async consumePurchase(_purchaseToken: string): Promise<void> {
        // no-op — không có thanh toán thật để consume.
    }
}
