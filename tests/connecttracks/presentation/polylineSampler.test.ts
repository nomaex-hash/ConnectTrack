import { describe, expect, it } from 'vitest';
import { buildPolylineSampler, SampledPose } from '../../../assets/scripts/presentation/board/polylineSampler';
import { poseAtDistance, polylineLength, Point } from '../../../assets/scripts/presentation/board/trainPath';

// Đường có đoạn thẳng, rẽ góc, đoạn suy biến (trùng điểm) và các điểm có heading khác nhau (cung tròn).
const polyline: Point[] = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 0 }, // đoạn suy biến
    { x: 100, y: 50, heading: 90 },
    { x: 130, y: 80, heading: 45 },
    { x: 180, y: 80, heading: 350 },
    { x: 180, y: -20 },
];

describe('buildPolylineSampler', () => {
    const sampler = buildPolylineSampler(polyline);

    it('chiều dài khớp polylineLength()', () => {
        expect(sampler.length).toBeCloseTo(polylineLength(polyline));
    });

    it('kết quả giống hệt poseAtDistance() trên rất nhiều khoảng cách (kể cả ranh giới đoạn)', () => {
        const out: SampledPose = { x: 0, y: 0, angleDeg: 0 };
        const total = polylineLength(polyline);
        const distances = [0, 100, 150, 100 + 50, 100 + 50 + Math.hypot(30, 30), total];
        for (let d = 0; d <= total; d += total / 237) distances.push(d);
        for (const d of distances) {
            const expected = poseAtDistance(polyline, d);
            expect(expected).not.toBeNull();
            expect(sampler.sample(d, out)).toBe(true);
            expect(out.x).toBeCloseTo(expected!.point.x, 6);
            expect(out.y).toBeCloseTo(expected!.point.y, 6);
            expect(out.angleDeg).toBeCloseTo(expected!.angleDeg, 6);
        }
    });

    it('trả false khi distance âm hoặc vượt chiều dài, và không đụng out', () => {
        const out: SampledPose = { x: 7, y: 8, angleDeg: 9 };
        expect(sampler.sample(-0.001, out)).toBe(false);
        expect(sampler.sample(sampler.length + 0.001, out)).toBe(false);
        expect(out).toEqual({ x: 7, y: 8, angleDeg: 9 });
    });

    it('đường rỗng hoặc chỉ 1 điểm thì luôn false', () => {
        const out: SampledPose = { x: 0, y: 0, angleDeg: 0 };
        expect(buildPolylineSampler([]).sample(0, out)).toBe(false);
        expect(buildPolylineSampler([{ x: 1, y: 1 }]).sample(0, out)).toBe(false);
    });
});
