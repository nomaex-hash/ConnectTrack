import { describe, expect, it } from 'vitest';
import { DigitMetrics, layoutDigits } from '../../assets/scripts/ui/widget/streakDigitLayout';

// Số liệu thật của daily_check_in_streak_number_{1,4}_unchecked.png: canvas 180x256, nét chữ rộng 123 và 144.
const one: DigitMetrics = { canvasW: 180, canvasH: 256, inkW: 123, inkOffsetX: 0 };
const four: DigitMetrics = { canvasW: 180, canvasH: 256, inkW: 144, inkOffsetX: 3 };

const inkEdges = (m: DigitMetrics, x: number) => ({
    left: x + m.inkOffsetX - m.inkW / 2,
    right: x + m.inkOffsetX + m.inkW / 2,
});

describe('layoutDigits', () => {
    it('khoảng cách NHÌN THẤY giữa 2 nét chữ đúng bằng spacing, dù bề rộng/offset khác nhau', () => {
        for (const spacing of [-6, 0, 1, 4, 20]) {
            const { xs } = layoutDigits([one, four], spacing);
            const gap = inkEdges(four, xs[1]).left - inkEdges(one, xs[0]).right;
            expect(gap).toBeCloseTo(spacing);
        }
    });

    it('cả cụm canh giữa quanh 0 (theo nét chữ)', () => {
        const { xs } = layoutDigits([one, four, one], 4);
        const left = inkEdges(one, xs[0]).left;
        const right = inkEdges(one, xs[2]).right;
        expect(left + right).toBeCloseTo(0);
    });

    it('1 chữ số: nét chữ nằm giữa 0 (bù offset)', () => {
        const { xs } = layoutDigits([four], 4);
        const e = inkEdges(four, xs[0]);
        expect(e.left + e.right).toBeCloseTo(0);
    });

    it('giảm spacing thật sự kéo gần hai chữ số hơn', () => {
        const wide = layoutDigits([one, four], 20).xs;
        const tight = layoutDigits([one, four], 0).xs;
        expect(wide[1] - wide[0] - (tight[1] - tight[0])).toBeCloseTo(20);
    });

    it('maxCanvas lấy theo canvas lớn nhất, edgePadding bớt mỗi bên và không âm', () => {
        const layout = layoutDigits([one, four], 4, 10);
        expect(layout.maxCanvasW).toBe(180);
        expect(layout.maxCanvasH).toBe(256);
        const tiny = layoutDigits([{ canvasW: 10, canvasH: 10, inkW: 4, inkOffsetX: 0 }], 4, 50);
        expect(tiny.xs[0]).toBeCloseTo(0);
    });
});
