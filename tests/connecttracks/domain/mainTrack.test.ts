import { describe, expect, it } from 'vitest';
import { Direction } from '../../../assets/scripts/domain/board/direction';
import { createLevelData } from '../../../assets/scripts/domain/level/levelData';
import { deriveMainTrack } from '../../../assets/scripts/domain/level/mainTrack';
import { TEST_LEVEL, TEST_LEVEL_WITH_MIDDLE_GIVEN } from './fixtures';

describe('Main Track derivation', () => {
    it('gives the start cell the outward a and the direction toward s[1]', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL);
        expect([...mainTrack.portsAt(0)]).toEqual([Direction.Left, Direction.Right]);
    });

    it('gives the end cell the outward b and the direction toward s[-2]', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL);
        expect([...mainTrack.portsAt(8)]).toEqual([Direction.Down, Direction.Up]);
    });

    it('maps the first endpoint s[0] to a and the last endpoint s[-1] to b', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL);
        expect(mainTrack.portsAt(TEST_LEVEL.solutionPath[0])[0]).toBe(TEST_LEVEL.outwardStart);
        const last = TEST_LEVEL.solutionPath[TEST_LEVEL.solutionPath.length - 1];
        expect(mainTrack.portsAt(last)[0]).toBe(TEST_LEVEL.outwardEnd);
    });

    it('takes the second port from s[1] at the start and from s[length - 2] at the end', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL);
        const path = TEST_LEVEL.solutionPath;
        expect(mainTrack.portsAt(path[0])[1]).toBe(Direction.Right); // toward s[1] = 1
        expect(mainTrack.portsAt(path[path.length - 1])[1]).toBe(Direction.Up); // toward s[-2] = 5
    });

    it('has no ports on cells that are not path endpoints', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL);
        expect(mainTrack.portsAt(1)).toEqual([]);
        expect(mainTrack.portsAt(4)).toEqual([]);
    });

    it('is fixed by the level: deriving twice gives identical ports', () => {
        const first = deriveMainTrack(TEST_LEVEL);
        const second = deriveMainTrack(TEST_LEVEL);
        expect([...second.portsAt(0)]).toEqual([...first.portsAt(0)]);
    });

    it('uses the ports the level declares (a and b feed the endpoint ports)', () => {
        const level = createLevelData({
            width: 3,
            height: 3,
            solutionPath: [0, 3],
            given: [0, 3],
            outwardStart: Direction.Up,
            outwardEnd: Direction.Left,
        });
        const mainTrack = deriveMainTrack(level);
        expect([...mainTrack.portsAt(0)]).toEqual([Direction.Up, Direction.Down]);
        expect([...mainTrack.portsAt(3)]).toEqual([Direction.Left, Direction.Up]);
    });
});

describe('Main Track derivation: given cells beyond the two endpoints (CONFIRMED-BY-USER)', () => {
    it('gives a middle given cell ports toward its own path neighbours, not an outward port', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL_WITH_MIDDLE_GIVEN);
        // path: 0 -> 1 -> 2 -> 5 -> 8, given cell 2's neighbours on the path are 1 and 5.
        expect([...mainTrack.portsAt(2)]).toEqual([Direction.Left, Direction.Down]);
    });

    it('still derives the two endpoints normally when extra given cells are present', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL_WITH_MIDDLE_GIVEN);
        expect([...mainTrack.portsAt(0)]).toEqual([Direction.Left, Direction.Right]);
        expect([...mainTrack.portsAt(8)]).toEqual([Direction.Down, Direction.Up]);
    });

    it('has no ports on a path cell that is not in given', () => {
        const mainTrack = deriveMainTrack(TEST_LEVEL_WITH_MIDDLE_GIVEN);
        expect(mainTrack.portsAt(1)).toEqual([]); // on the path, but not in given: [0, 2, 8].
        expect(mainTrack.portsAt(5)).toEqual([]);
    });
});
