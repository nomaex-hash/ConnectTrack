export interface CoinExchangeOption {
    readonly id: string;
    readonly resource: 'hintCharges' | 'placeDogCharges';
    readonly amount: number;
    readonly coinCost: number;
}

/** GD thêm/bớt tỉ lệ đổi coin -> hint/placeDog tại đây — không cần đổi code. */
export const COIN_EXCHANGE_OPTIONS: readonly CoinExchangeOption[] = [
    { id: 'exchange_hint_1', resource: 'hintCharges', amount: 1, coinCost: 20 },
    { id: 'exchange_placedog_1', resource: 'placeDogCharges', amount: 1, coinCost: 20 },
];

export function findCoinExchangeOption(id: string): CoinExchangeOption | null {
    return COIN_EXCHANGE_OPTIONS.find((option) => option.id === id) ?? null;
}
