export interface PlatformPlayer {
    readonly id: string;
    readonly name: string;
    readonly photoUrl: string;
}

export interface SignedPlayerInfo {
    readonly playerId: string;
    readonly signature: string;
}

export interface ContextUpdatePayload {
    readonly text: string;
    readonly imageBase64?: string;
}

/**
 * Trừu tượng nền tảng (danh tính người chơi + context chơi cùng bạn bè). Bản mock dùng
 * ngay để test luồng trong Editor/preview; khi build Facebook Instant Games chỉ cần
 * FBInstantManagerHolder.set(new FBInstantManager()) — gameplay/UI KHÔNG phải sửa.
 */
export interface IFBInstantManager {
    /** Gọi 1 lần lúc boot — BẮT BUỘC trước khi ẩn loading screen (yêu cầu của nền tảng). */
    init(): Promise<void>;

    isReady(): boolean;

    /** null nếu chưa init xong hoặc nền tảng không cung cấp thông tin người chơi. */
    getPlayer(): PlatformPlayer | null;

    /**
     * Ký MỚI mỗi lần gọi — KHÔNG cache. Facebook không công bố TTL cố định cho chữ ký này
     * (chỉ khuyến nghị server tự validate issued_at trong payload), nên best practice là
     * luôn lấy chữ ký sát thời điểm dùng — xem PGSPlayInstantManager.
     */
    getSignedPlayerInfo(): Promise<SignedPlayerInfo | null>;

    getContextId(): string | null;
    chooseContext(): Promise<void>;
    createContext(playerId: string): Promise<void>;
    switchContext(contextId: string): Promise<void>;
    updateContext(payload: ContextUpdatePayload): Promise<void>;
}
