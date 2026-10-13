import { PlayerData } from './PlayerData';

export const SAVE_DATA_CURRENT_VERSION = 1;

export interface SaveData {
    version: number;
    playerData: PlayerData;
}
