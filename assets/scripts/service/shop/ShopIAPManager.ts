import { ShopIAPSaveData } from '../../model/ShopIAPSaveData';
import { ShopPackageDataConfig, findShopPackage } from '../../config/ShopPackageDataConfig';

const STARTER_PACK_ID = 'starter_bundle';
const STARTER_PACK_SECONDS = 2 * 60 * 60;

/**
 * Trạng thái mua hàng THUẦN, KHÔNG gọi thanh toán/backend (xem IPaymentService cho thanh
 * toán thật, GameManager là nơi phối hợp: gọi payment -> recordPurchase() -> cộng thưởng
 * vào PlayerData.inventory). Mirror ShopIAPManager của dự án gốc.
 */
export class ShopIAPManager {
    constructor(private readonly data: ShopIAPSaveData) {
        this.refreshStarterPackWindow();
    }

    getPurchaseCount(packageId: string): number {
        return this.data.purchaseCounts[packageId] ?? 0;
    }

    hasPurchased(packageId: string): boolean {
        return this.getPurchaseCount(packageId) > 0;
    }

    /** Gọi SAU KHI IPaymentService.purchase() resolve thành công — chỉ ghi nhận, không tự trừ tiền. */
    recordPurchase(packageId: string): ShopPackageDataConfig | null {
        this.data.purchaseCounts[packageId] = this.getPurchaseCount(packageId) + 1;
        return findShopPackage(packageId);
    }

    //#region Starter Pack — có hạn 2 tiếng kể từ lúc mở, tự mở lại vào ngày mới nếu đã hết hạn
    private refreshStarterPackWindow(): void {
        if (this.hasPurchased(STARTER_PACK_ID)) return;

        const now = Math.floor(Date.now() / 1000);
        if (this.data.starterPackStartTime === 0) {
            this.data.starterPackStartTime = now;
            return;
        }

        const startedOnDifferentDay = !isSameLocalDay(this.data.starterPackStartTime, now);
        const alreadyExpired = this.data.starterPackStartTime + STARTER_PACK_SECONDS < now;
        if (startedOnDifferentDay && alreadyExpired) {
            this.data.starterPackStartTime = now;
        }
    }

    getStarterPackSecondsLeft(): number {
        if (this.hasPurchased(STARTER_PACK_ID)) return 0;
        return Math.max(0, this.data.starterPackStartTime + STARTER_PACK_SECONDS - Math.floor(Date.now() / 1000));
    }
    //#endregion
}

function isSameLocalDay(unixSecondsA: number, unixSecondsB: number): boolean {
    const a = new Date(unixSecondsA * 1000);
    const b = new Date(unixSecondsB * 1000);
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}
