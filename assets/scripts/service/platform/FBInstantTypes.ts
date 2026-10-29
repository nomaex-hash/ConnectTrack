/**
 * Khai báo TỐI THIỂU cho FBInstant SDK global — chỉ gồm những gì FBInstantManager thực sự
 * gọi tới, KHÔNG phải toàn bộ API Facebook Instant Games. SDK thật được nạp qua thẻ
 * <script src="https://connect.facebook.net/en_US/fbinstant.7.1.js"> trong index.html của
 * bản build Facebook Instant Games — KHÔNG import qua npm, biến FBInstant chỉ tồn tại ở
 * runtime trên nền tảng FB (không có trong Editor/preview).
 */

export interface FBInstantSignedPlayerInfo {
    getPlayerID(): string;
    getSignature(): string;
}

export interface FBInstantPlayer {
    getID(): string | null;
    getName(): string | null;
    getPhoto(): string | null;
    getSignedPlayerInfoAsync(requirePayload?: string): Promise<FBInstantSignedPlayerInfo>;
    getDataAsync(keys: readonly string[]): Promise<Record<string, unknown>>;
    setDataAsync(data: Record<string, unknown>): Promise<void>;
    flushDataAsync(): Promise<void>;
}

export interface FBInstantContext {
    getID(): string | null;
    chooseAsync(): Promise<void>;
    createAsync(playerId: string): Promise<void>;
    switchAsync(contextId: string): Promise<void>;
}

export interface FBInstantUpdatePayload {
    readonly action: 'CUSTOM';
    readonly cta: string;
    readonly template: string;
    readonly text: { readonly default: string };
    readonly data?: Record<string, unknown>;
}

export interface FBInstantProduct {
    readonly productID: string;
    readonly price: string;
    readonly priceCurrencyCode: string;
}

export interface FBInstantPurchase {
    readonly productID: string;
    readonly purchaseToken: string;
    readonly paymentID: string;
}

export interface FBInstantPayments {
    getCatalogAsync(): Promise<readonly FBInstantProduct[]>;
    purchaseAsync(payload: { productID: string; developerPayload?: string }): Promise<FBInstantPurchase>;
    consumePurchaseAsync(purchaseToken: string): Promise<void>;
    getPurchasesAsync(): Promise<readonly FBInstantPurchase[]>;
}

export interface FBInstantSDK {
    startGameAsync(): Promise<void>;
    readonly player: FBInstantPlayer;
    readonly context: FBInstantContext;
    readonly payments: FBInstantPayments;
    updateAsync(payload: FBInstantUpdatePayload): Promise<void>;
    onPause(callback: () => void): void;
}

declare global {
    const FBInstant: FBInstantSDK | undefined;
}
