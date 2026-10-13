import { GameResourceKind } from './ShopPackageDataConfig';

export interface LeaderboardRewardEntry {
    readonly resource: GameResourceKind;
    readonly amount: number;
}

/**
 * Quà top-3 BẢNG XẾP HẠNG — index 0 = hạng 1, 1 = hạng 2, 2 = hạng 3. GD tự chỉnh số lượng
 * tại đây, không cần đổi code. Dogdoku không có hệ thống tài nguyên đa dạng như dự án gốc
 * (currency/GameResource) — chỉ có 2 loại: placeDogCharges/hintCharges (xem PlayerData.inventory).
 */
export const WEEKLY_TOP3_REWARDS: readonly (readonly LeaderboardRewardEntry[])[] = [
    [
        { resource: 'placeDogCharges', amount: 1 },
        { resource: 'hintCharges', amount: 1 },
    ],
    [
        { resource: 'placeDogCharges', amount: 1 },
        { resource: 'hintCharges', amount: 0 },
    ],
    [
        { resource: 'placeDogCharges', amount: 0 },
        { resource: 'hintCharges', amount: 1 },
    ],
];

/** Quà top-3 BẢNG XẾP HẠNG THẾ GIỚI (toàn thời gian, không reset theo tuần) — index 0 = hạng 1. */
export const WORLD_TOP3_REWARDS: readonly (readonly LeaderboardRewardEntry[])[] = [
    [
        { resource: 'placeDogCharges', amount: 20 },
        { resource: 'hintCharges', amount: 20 },
    ],
    [
        { resource: 'placeDogCharges', amount: 10 },
        { resource: 'hintCharges', amount: 10 },
    ],
    [
        { resource: 'placeDogCharges', amount: 5 },
        { resource: 'hintCharges', amount: 5 },
    ],
];
