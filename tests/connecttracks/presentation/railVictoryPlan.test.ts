import { describe, expect, it } from 'vitest';
import { railStarAmount } from '../../../assets/scripts/presentation/board/railVictoryPlan';

describe('rail star batches', () => {
    it.each([2, 3, 4, 5, 6, 7, 10, 101])('counts all %i rails, including the last partial batch', length => {
        const amounts = Array.from({ length }, (_, index) => railStarAmount(length, index));
        expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(length);
        expect(amounts.filter(value => value > 0)).toHaveLength(Math.ceil(length / 3));
        expect(amounts[0]).toBe(Math.min(3, length));
        amounts.forEach((value, index) => { if (index % 3 !== 0) expect(value).toBe(0); });
    });
});
