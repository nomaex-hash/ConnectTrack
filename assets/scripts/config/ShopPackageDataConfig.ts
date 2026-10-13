export enum PriceType {
    RealMoney = 'realMoney',
}

/** Khớp CHÍNH XÁC tên field trong PlayerData.inventory — không có kho tài nguyên nào khác. */
export type GameResourceKind = 'placeDogCharges' | 'hintCharges' | 'coin';

export interface ShopResourceReward {
    readonly resource: GameResourceKind;
    readonly amount: number;
}

export interface ShopPackageDataConfig {
    /** PHẢI khớp productID đã khai báo trên FB App Dashboard (dùng thẳng cho FBInstant.payments). */
    readonly id: string;
    readonly nameKey: string;
    readonly priceType: PriceType;
    readonly rewards: readonly ShopResourceReward[];
    /** Chỉ Starter Pack dùng — số giây còn hiệu lực kể từ lúc cửa sổ mở (xem ShopIAPManager). */
    readonly timeLimitedSeconds?: number;
}

/** GD thêm/bớt gói tại đây — không cần đổi code. */
export const SHOP_PACKAGES: readonly ShopPackageDataConfig[] = [
    {
        id: 'starter_bundle',
        nameKey: 'shop.starterBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 2 },
            { resource: 'hintCharges', amount: 3 },
        ],
        timeLimitedSeconds: 2 * 60 * 60,
    },
    {
        id: 'small_bundle',
        nameKey: 'shop.smallBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 1 },
            { resource: 'hintCharges', amount: 1 },
        ],
    },
    {
        id: 'medium_bundle',
        nameKey: 'shop.mediumBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 3 },
            { resource: 'hintCharges', amount: 3 },
        ],
    },
    {
        id: 'large_bundle',
        nameKey: 'shop.largeBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 8 },
            { resource: 'hintCharges', amount: 8 },
        ],
    },
    {
        id: 'big_bundle',
        nameKey: 'shop.bigBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 18 },
            { resource: 'hintCharges', amount: 18 },
        ],
    },
    {
        id: 'mega_bundle',
        nameKey: 'shop.megaBundle',
        priceType: PriceType.RealMoney,
        rewards: [
            { resource: 'placeDogCharges', amount: 36 },
            { resource: 'hintCharges', amount: 36 },
        ],
    },
    {
        id: 'coin_small',
        nameKey: 'shop.coinSmall',
        priceType: PriceType.RealMoney,
        rewards: [{ resource: 'coin', amount: 100 }],
    },
    {
        id: 'coin_medium',
        nameKey: 'shop.coinMedium',
        priceType: PriceType.RealMoney,
        rewards: [{ resource: 'coin', amount: 550 }],
    },
    {
        id: 'coin_large',
        nameKey: 'shop.coinLarge',
        priceType: PriceType.RealMoney,
        rewards: [{ resource: 'coin', amount: 1200 }],
    },
];

/** Gói thuộc tier "gold/coin" (chỉ tặng coin) — dùng để tách hiển thị arrGoldGroup khỏi arrBundleGroup trong ShopTabGroupManager. */
export function isCoinPackage(config: ShopPackageDataConfig): boolean {
    return config.rewards.length === 1 && config.rewards[0].resource === 'coin';
}

export function findShopPackage(id: string): ShopPackageDataConfig | null {
    return SHOP_PACKAGES.find((pack) => pack.id === id) ?? null;
}
