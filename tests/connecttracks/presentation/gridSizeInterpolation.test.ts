import { describe, expect, it } from 'vitest';
import { interpolateByGridSize } from '../../../assets/scripts/presentation/board/gridSizeInterpolation';

// Max cho ÍT cell (lưới 6), Min cho NHIỀU cell (lưới 10) — đúng phạm vi level thật.
const dashScale = (grid: number) => interpolateByGridSize(1.4, 0.6, grid, 6, 10);

describe('interpolateByGridSize', () => {
    it('chạm đúng Max ở lưới ít cell và đúng Min ở lưới nhiều cell', () => {
        expect(dashScale(6)).toBeCloseTo(1.4);
        expect(dashScale(10)).toBeCloseTo(0.6);
    });

    it('giữa 2 mốc nội suy tuyến tính, giảm dần khi nhiều cell hơn', () => {
        expect(dashScale(8)).toBeCloseTo(1.0);
        const values = [6, 7, 8, 9, 10].map(dashScale);
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeLessThan(values[i - 1]);
    });

    it('ngoài phạm vi thì kẹp ở Min/Max (lưới 4,5 hoặc 12)', () => {
        expect(dashScale(4)).toBeCloseTo(1.4);
        expect(dashScale(12)).toBeCloseTo(0.6);
    });

    it('khoảng cách dash: 56 (ít cell) -> 24 (nhiều cell)', () => {
        expect(interpolateByGridSize(56, 24, 6, 6, 10)).toBe(56);
        expect(interpolateByGridSize(56, 24, 10, 6, 10)).toBe(24);
        expect(interpolateByGridSize(56, 24, 8, 6, 10)).toBe(40);
    });

    it('cấu hình sai (few >= many) không chia cho 0, trả giá trị ít cell', () => {
        expect(interpolateByGridSize(1.4, 0.6, 8, 10, 10)).toBe(1.4);
        expect(interpolateByGridSize(1.4, 0.6, 8, 12, 6)).toBe(1.4);
    });
});
