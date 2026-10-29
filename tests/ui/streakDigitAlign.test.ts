import { describe, expect, it } from 'vitest';
import { DigitAlign, DigitMetrics, layoutDigits } from '../../assets/scripts/ui/widget/streakDigitLayout';

const one: DigitMetrics = { canvasW: 180, canvasH: 256, inkW: 123, inkOffsetX: 0 };
const four: DigitMetrics = { canvasW: 180, canvasH: 256, inkW: 144, inkOffsetX: 3 };
const zero: DigitMetrics = { canvasW: 180, canvasH: 256, inkW: 136, inkOffsetX: -2 };

describe('layoutDigits — căn trái/phải', () => {
    it('căn trái: chữ số đầu đứng yên tại gốc dù có thêm chữ số thứ 2, thứ 3', () => {
        const x1 = layoutDigits([four], 4, 0, DigitAlign.Left).xs[0];
        const x2 = layoutDigits([four, zero], 4, 0, DigitAlign.Left).xs[0];
        const x3 = layoutDigits([four, zero, one], 4, 0, DigitAlign.Left).xs[0];
        expect(x1).toBeCloseTo(0);
        expect(x2).toBeCloseTo(0);
        expect(x3).toBeCloseTo(0);
    });

    it('căn trái: chữ số mới nối thêm về bên PHẢI và giữ đúng khoảng cách nhìn thấy', () => {
        const [a, b] = layoutDigits([one, four], 6, 0, DigitAlign.Left).xs;
        expect(b).toBeGreaterThan(a);
        const gap = (b + four.inkOffsetX - four.inkW / 2) - (a + one.inkOffsetX + one.inkW / 2);
        expect(gap).toBeCloseTo(6);
    });

    it('căn trái: vị trí chữ số thứ 2 không đổi khi thêm chữ số thứ 3', () => {
        const two = layoutDigits([one, four], 4, 0, DigitAlign.Left).xs;
        const three = layoutDigits([one, four, zero], 4, 0, DigitAlign.Left).xs;
        expect(three[0]).toBeCloseTo(two[0]);
        expect(three[1]).toBeCloseTo(two[1]);
    });

    it('căn phải: chữ số cuối đứng yên tại gốc, chữ số mới thêm về bên trái', () => {
        const xs = layoutDigits([one, four, zero], 4, 0, DigitAlign.Right).xs;
        expect(xs[2]).toBeCloseTo(0);
        expect(xs[0]).toBeLessThan(xs[1]);
        expect(xs[1]).toBeLessThan(xs[2]);
    });

    it('căn giữa (mặc định) giữ nguyên hành vi cũ: cả cụm quanh 0', () => {
        const xs = layoutDigits([one, four], 4).xs;
        const left = xs[0] + one.inkOffsetX - one.inkW / 2;
        const right = xs[1] + four.inkOffsetX + four.inkW / 2;
        expect(left + right).toBeCloseTo(0);
    });
});
