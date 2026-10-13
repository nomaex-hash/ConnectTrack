import { describe, expect, it } from 'vitest';
import { responsiveLayout, ResponsiveLayoutInput } from '../../../assets/scripts/presentation/ui/responsiveLayout';
const input: ResponsiveLayoutInput = {
    bounds: { left: -180, right: 180, bottom: -640, top: 640 },
    width: 720, height: 1000, anchorX: .5, anchorY: .5, scaleX: 1, scaleY: 1,
    x: 12, y: 34, horizontal: 2, vertical: 2, fitWidth: true, fitHeight: true,
    left: 0, right: 0, top: 0, bottom: 0,
};
describe('responsive UI sizing', () => {
    it('fits a narrow viewport uniformly', () => {
        expect(responsiveLayout(input)).toEqual({ x: 0, y: 0, scaleX: .5, scaleY: .5 });
    });
    it('shrinks for short screens and never exceeds original scale when enlarged', () => {
        expect(responsiveLayout({ ...input, bounds: { left: -800, right: 800, bottom: -200, top: 200 } }).scaleX).toBe(.4);
        expect(responsiveLayout({ ...input, bounds: { left: -800, right: 800, bottom: -1000, top: 1000 }, scaleX: .8, scaleY: .6 }).scaleX).toBe(.8);
    });
    it('pins scaled right/top edges with margins and a noncentral anchor', () => {
        const result = responsiveLayout({ ...input, width: 100, height: 80, anchorX: 0, anchorY: 0,
            horizontal: 3, vertical: 3, right: 20, top: 30 });
        expect(result).toEqual({ x: 60, y: 530, scaleX: 1, scaleY: 1 });
    });
    it('preserves position on an unmanaged axis and handles flipped scale', () => {
        expect(responsiveLayout({ ...input, width: 100, scaleX: -1, anchorX: 0, horizontal: 1, vertical: 0 }).x).toBe(-80);
        expect(responsiveLayout({ ...input, vertical: 0 }).y).toBe(34);
    });
    it('handles exhausted margins without negative scale', () => {
        expect(responsiveLayout({ ...input, left: 400, right: 400 }).scaleX).toBe(0);
    });
});
