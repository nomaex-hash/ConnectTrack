import { LevelData } from '../../domain/level/levelData';

/**
 * Application-owned port: where level data comes from.
 * Implementations live in Infrastructure. `levelId` is an opaque string; a given implementation
 * decides its format (e.g. the Cocos adapter uses the campaign level id from the real level data,
 * "0".."200"). How the player's campaign progression picks which id to load next is UNKNOWN and
 * is not this port's concern.
 */
export interface LevelDataPort {
    loadLevel(levelId: string): Promise<LevelData>;
}
