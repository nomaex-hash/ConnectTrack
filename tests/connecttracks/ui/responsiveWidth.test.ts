import { describe, expect, it } from 'vitest';
import { isWideScreen } from '../../../assets/scripts/utility/responsiveWidth';

describe('isWideScreen', () => {
    it('rộng hơn ngưỡng -> rộng (như cũ), kể cả đang đứng dọc', () => {
        expect(isWideScreen(800, 1200, 755, true)).toBe(true);
        expect(isWideScreen(800, 1200, 755, false)).toBe(true);
    });

    it('điện thoại đứng dọc (hẹp, cao) -> không rộng', () => {
        expect(isWideScreen(390, 844, 755, true)).toBe(false);
    });

    it('điện thoại xoay ngang nhưng dưới ngưỡng (vd 667x375, 740x360) -> rộng khi bật landscapeIsWide', () => {
        expect(isWideScreen(667, 375, 755, true)).toBe(true);
        expect(isWideScreen(740, 360, 755, true)).toBe(true);
        expect(isWideScreen(667, 375, 755, false)).toBe(false);
    });

    it('đúng bằng ngưỡng hoặc hình vuông không tính là rộng', () => {
        expect(isWideScreen(755, 900, 755, true)).toBe(false);
        expect(isWideScreen(500, 500, 755, true)).toBe(false);
    });
});
