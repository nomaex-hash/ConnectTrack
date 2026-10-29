import { Point } from './trainPath';

/** Vị trí + hướng tại 1 điểm trên đường — đối tượng được TÁI SỬ DỤNG giữa các lần gọi (không cấp phát mới mỗi frame). */
export interface SampledPose {
    x: number;
    y: number;
    angleDeg: number;
}

export interface PolylineSampler {
    /** Tổng chiều dài đường. */
    readonly length: number;
    /**
     * Ghi vị trí + hướng tại `distance` vào `out`. Trả false (không đụng `out`) nếu distance < 0 hoặc vượt quá chiều
     * dài đường — cùng quy ước với poseAtDistance() ở trainPath.ts (null).
     */
    sample(distance: number, out: SampledPose): boolean;
}

/**
 * Bản TỐI ƯU của poseAtDistance(): tính 1 lần (chiều dài từng đoạn, cộng dồn, góc) khi dựng, rồi mỗi lần lấy mẫu chỉ
 * tốn O(log n) bằng tìm nhị phân và KHÔNG cấp phát đối tượng. poseAtDistance() cũ duyệt tuyến tính từ đầu đường và gọi
 * Math.hypot/Math.atan2 cho TỪNG đoạn trước điểm cần lấy, mỗi dash mỗi frame, kèm 2 đối tượng mới trả về — với ~30 dash
 * trên đường dài hàng trăm đoạn (cung tròn) gây tốn CPU + GC làm giật. Kết quả giống hệt poseAtDistance().
 */
export function buildPolylineSampler(polyline: readonly Point[]): PolylineSampler {
    const startX: number[] = [];
    const startY: number[] = [];
    const dirX: number[] = []; // dx, dy của đoạn
    const dirY: number[] = [];
    const segLen: number[] = [];
    const cumEnd: number[] = []; // khoảng cách cộng dồn tới CUỐI mỗi đoạn
    const startAngle: number[] = [];
    const deltaAngle: number[] = [];

    let total = 0;
    for (let i = 0; i + 1 < polyline.length; i++) {
        const a = polyline[i];
        const b = polyline[i + 1];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 1e-8) continue; // bỏ đoạn suy biến, giống poseAtDistance()
        const segmentAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        const from = a.heading ?? segmentAngle;
        const to = b.heading ?? segmentAngle;
        total += length;
        startX.push(a.x);
        startY.push(a.y);
        dirX.push(dx);
        dirY.push(dy);
        segLen.push(length);
        cumEnd.push(total);
        startAngle.push(from);
        deltaAngle.push(((to - from + 540) % 360) - 180);
    }

    return {
        length: total,
        sample(distance: number, out: SampledPose): boolean {
            const n = segLen.length;
            if (n === 0 || distance < 0 || distance > total) return false;
            // Đoạn đầu tiên có cumEnd >= distance (điểm đúng ranh giới thuộc đoạn TRƯỚC, như poseAtDistance()).
            let lo = 0;
            let hi = n - 1;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (cumEnd[mid] >= distance) hi = mid;
                else lo = mid + 1;
            }
            const before = lo === 0 ? 0 : cumEnd[lo - 1];
            const t = (distance - before) / segLen[lo];
            out.x = startX[lo] + dirX[lo] * t;
            out.y = startY[lo] + dirY[lo] * t;
            out.angleDeg = startAngle[lo] + deltaAngle[lo] * t;
            return true;
        },
    };
}
