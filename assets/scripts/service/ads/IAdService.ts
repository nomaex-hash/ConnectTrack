/** Kết quả một lượt xem quảng cáo có thưởng. */
export interface RewardedAdResult {
    /** Người chơi đã xem đủ để nhận thưởng chưa (tắt giữa chừng → false). */
    readonly rewarded: boolean;
    /** Lý do khi không nhận được thưởng (log/hiển thị). */
    readonly reason?: string;
}

/**
 * Trừu tượng quảng cáo. Bản mock dùng ngay để test luồng; khi tích hợp SDK thật
 * (AdMob / Facebook Audience Network...) chỉ cần một implementation khác — UI và
 * gameplay KHÔNG phải sửa.
 */
export interface IAdService {
    /** Có quảng cáo sẵn để xem không (dùng để bật/tắt nút). */
    isRewardedReady(): boolean;

    /** Mở quảng cáo có thưởng; resolve khi đóng quảng cáo. */
    showRewarded(location?: string, buttonName?: string): Promise<RewardedAdResult>;

    /** Có thể hiện quảng cáo xen kẽ ngay bây giờ không (đã nạp xong, đủ giãn cách, chưa mua gỡ QC...). */
    isInterstitialReady(): boolean;

    /** Hiện quảng cáo xen kẽ nếu được phép; resolve true nếu đã hiện, false nếu bỏ qua/lỗi (không bao giờ ném). */
    showInterstitial(location?: string, buttonName?: string): Promise<boolean>;
}
