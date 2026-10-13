import { describe, expect, it } from 'vitest';
import { requiredCellsFor } from '../../../assets/scripts/application/session/requiredCells';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from '../domain/fixtures';

describe('requiredCellsFor', () => {
    it('is every solution cell except the two given endpoints, when given has no other cells', () => {
        // TEST_LEVEL: path [0,1,2,5,8], given [0,8].
        expect(requiredCellsFor(TEST_LEVEL)).toEqual([1, 2, 5]);
    });

    it('also excludes extra given (pre-filled) cells, not just the two endpoints (CONFIRMED-BY-USER)', () => {
        // TEST_LEVEL_WITH_MIDDLE_GIVEN: path [0,1,2,5,8], given [0,2,8].
        expect(requiredCellsFor(TEST_LEVEL_WITH_MIDDLE_GIVEN)).toEqual([1, 5]);
    });
});
