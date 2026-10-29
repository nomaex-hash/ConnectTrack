/**
 * Kho lưu trữ trên cloud của nền tảng (Facebook Instant Games: player data). Chỉ nhận/trả CHUỖI
 * (đã serialize) để tầng đồng bộ không phụ thuộc cấu trúc dữ liệu nền tảng.
 */
export interface CloudSavePort {
    /** null nếu cloud chưa có dữ liệu; ném lỗi nếu không đọc được (mạng/SDK). */
    read(): Promise<string | null>;
    write(payload: string): Promise<void>;
    /** Ép nền tảng ghi ngay những gì đã `write` (gọi khi game sắp bị tạm dừng/đóng). */
    flush(): Promise<void>;
}
