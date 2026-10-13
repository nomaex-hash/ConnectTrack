export interface ShopIAPSaveData {
    /** packageId (ShopPackageDataConfig.id) -> số lần đã mua. */
    purchaseCounts: Record<string, number>;

    /** unix seconds — mốc bắt đầu cửa sổ Starter Pack hiện tại (xem ShopIAPManager). */
    starterPackStartTime: number;
}
