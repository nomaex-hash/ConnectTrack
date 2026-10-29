/**
 * Chuyển động "tăng tốc đều rồi chạy đều" của hàng "tôi" khi leo hạng — hàm thuần (không phụ thuộc engine) để test.
 *
 * Vận tốc tăng ĐỀU từ 0 tới `speed` (px/giây) trong `accelSeconds` giây rồi giữ nguyên `speed`:
 *   v(t) = speed * min(t / accelSeconds, 1)
 * Quãng đường đi được:
 *   s(t) = speed * t² / (2 * accelSeconds)            khi t < accelSeconds
 *   s(t) = speed * accelSeconds / 2 + speed * (t - accelSeconds)   khi t >= accelSeconds
 * accelSeconds <= 0 thì bật tốc độ `speed` ngay (chạy đều từ đầu, như hành vi cũ).
 *
 * Toàn bộ quãng leo (pha cuộn + pha tự bay) dùng CHUNG một đường cong này, mỗi pha lấy một đoạn —
 * nên vận tốc liên tục khi chuyển pha, không bị tăng tốc lại từ 0 ở pha sau.
 */

/** Quãng đường (px) đã đi sau `t` giây kể từ lúc bắt đầu leo. */
export function climbDistanceAt(t: number, speed: number, accelSeconds: number): number {
    if (t <= 0 || speed <= 0) return 0;
    if (accelSeconds <= 0) return speed * t;
    if (t < accelSeconds) return (speed * t * t) / (2 * accelSeconds);
    return (speed * accelSeconds) / 2 + speed * (t - accelSeconds);
}

/** Thời gian (giây) cần để đi được `distance` px kể từ lúc bắt đầu leo — nghịch đảo của climbDistanceAt(). */
export function climbTimeForDistance(distance: number, speed: number, accelSeconds: number): number {
    if (distance <= 0 || speed <= 0) return 0;
    if (accelSeconds <= 0) return distance / speed;
    const rampDistance = (speed * accelSeconds) / 2;
    if (distance <= rampDistance) return Math.sqrt((2 * distance * accelSeconds) / speed);
    return distance / speed + accelSeconds / 2;
}

/** Thời gian (giây) để đi đoạn [fromDistance, toDistance] của đường leo. */
export function climbSegmentDuration(fromDistance: number, toDistance: number, speed: number, accelSeconds: number): number {
    return Math.max(
        0,
        climbTimeForDistance(toDistance, speed, accelSeconds) - climbTimeForDistance(fromDistance, speed, accelSeconds),
    );
}

/**
 * Hàm easing cho 1 đoạn [fromDistance, toDistance] của đường leo: nhận tiến độ thời gian p (0..1) của đoạn,
 * trả về tỉ lệ quãng đường đã đi (0..1) của riêng đoạn đó — đưa thẳng vào `easing` của tween.
 */
export function climbSegmentEasing(
    fromDistance: number,
    toDistance: number,
    speed: number,
    accelSeconds: number,
): (p: number) => number {
    const length = toDistance - fromDistance;
    const startTime = climbTimeForDistance(fromDistance, speed, accelSeconds);
    const duration = climbSegmentDuration(fromDistance, toDistance, speed, accelSeconds);
    return (p: number): number => {
        if (length <= 0 || duration <= 0) return 1;
        if (p <= 0) return 0;
        if (p >= 1) return 1;
        const travelled = climbDistanceAt(startTime + p * duration, speed, accelSeconds) - fromDistance;
        return Math.min(1, Math.max(0, travelled / length));
    };
}
