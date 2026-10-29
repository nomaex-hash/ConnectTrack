import { describe, expect, it } from 'vitest';
import {
    climbDistanceAt,
    climbSegmentDuration,
    climbSegmentEasing,
    climbTimeForDistance,
} from '../../../assets/scripts/gameplay/leaderboardpreview/climbMotion';

const SPEED = 600;
const ACCEL = 0.5;

describe('climbMotion — tăng tốc đều rồi chạy đều', () => {
    it('accel = 0: chạy đều ngay từ đầu (như hành vi cũ)', () => {
        expect(climbDistanceAt(0.5, SPEED, 0)).toBeCloseTo(300);
        expect(climbTimeForDistance(300, SPEED, 0)).toBeCloseTo(0.5);
        expect(climbSegmentDuration(0, 600, SPEED, 0)).toBeCloseTo(1);
    });

    it('vận tốc bắt đầu từ 0 (quãng đường rất nhỏ lúc đầu) và đạt tốc độ tối đa sau accelSeconds', () => {
        // Lúc t nhỏ, quãng đường tỉ lệ t² — chưa tới 1% của quãng chạy đều trong cùng thời gian.
        expect(climbDistanceAt(0.05, SPEED, ACCEL)).toBeLessThan(0.11 * SPEED * 0.05);
        // Hết thời gian tăng tốc: đã đi đúng nửa của (tốc độ × thời gian tăng tốc).
        expect(climbDistanceAt(ACCEL, SPEED, ACCEL)).toBeCloseTo((SPEED * ACCEL) / 2);
        // Sau đó chạy đều đúng `SPEED` px/giây.
        const d1 = climbDistanceAt(1.5, SPEED, ACCEL);
        const d2 = climbDistanceAt(2.5, SPEED, ACCEL);
        expect(d2 - d1).toBeCloseTo(SPEED);
    });

    it('time và distance là nghịch đảo của nhau, cả trong lẫn sau giai đoạn tăng tốc', () => {
        for (const t of [0.05, 0.2, 0.49, 0.5, 0.8, 2, 3.7]) {
            const d = climbDistanceAt(t, SPEED, ACCEL);
            expect(climbTimeForDistance(d, SPEED, ACCEL)).toBeCloseTo(t, 6);
        }
    });

    it('quãng ngắn (chưa tăng tốc xong) vẫn đúng: tốn nhiều thời gian hơn chạy đều', () => {
        const short = (SPEED * ACCEL) / 4;
        const t = climbTimeForDistance(short, SPEED, ACCEL);
        expect(t).toBeGreaterThan(short / SPEED);
        expect(t).toBeLessThan(ACCEL);
        expect(climbDistanceAt(t, SPEED, ACCEL)).toBeCloseTo(short);
    });

    it('hai đoạn nối nhau dùng chung 1 đường cong: tổng thời gian khớp và vận tốc liên tục chỗ nối', () => {
        const total = 1000;
        const split = 250; // pha cuộn 250px rồi pha tự bay 750px
        const t1 = climbSegmentDuration(0, split, SPEED, ACCEL);
        const t2 = climbSegmentDuration(split, total, SPEED, ACCEL);
        expect(t1 + t2).toBeCloseTo(climbTimeForDistance(total, SPEED, ACCEL), 9);

        // Vận tốc cuối đoạn 1 == vận tốc đầu đoạn 2 (không bị bật lại 0 hoặc nhảy vọt).
        const e1 = climbSegmentEasing(0, split, SPEED, ACCEL);
        const e2 = climbSegmentEasing(split, total, SPEED, ACCEL);
        const dt = 1e-4;
        const endVelocity1 = ((split - e1(1 - dt / t1) * split) / dt);
        const startVelocity2 = (e2(dt / t2) * (total - split)) / dt;
        expect(startVelocity2).toBeCloseTo(endVelocity1, 0);
    });

    it('easing của đoạn: 0 ở đầu, 1 ở cuối, đơn điệu tăng', () => {
        const ease = climbSegmentEasing(0, 800, SPEED, ACCEL);
        expect(ease(0)).toBe(0);
        expect(ease(1)).toBe(1);
        let previous = 0;
        for (let p = 0.05; p <= 1.0001; p += 0.05) {
            const value = ease(Math.min(1, p));
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
        // Đầu đoạn chậm hơn chạy đều (tăng tốc từ 0).
        expect(ease(0.1)).toBeLessThan(0.1);
    });

    it('đoạn rỗng hoặc tốc độ <= 0 không ném lỗi', () => {
        expect(climbSegmentEasing(100, 100, SPEED, ACCEL)(0.5)).toBe(1);
        expect(climbTimeForDistance(100, 0, ACCEL)).toBe(0);
        expect(climbDistanceAt(1, 0, ACCEL)).toBe(0);
    });
});
