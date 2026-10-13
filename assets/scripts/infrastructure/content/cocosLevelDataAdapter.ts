import { JsonAsset, resources } from 'cc';
import { LevelDataPort } from '../../application/ports/levelDataPort';
import { LevelData } from '../../domain/level/levelData';
import { levelFromRecord } from './levelRecordMapper';

const INDEX_PATH = 'ConnectTrackData/levelIndex';
const LEVEL_DIR = 'ConnectTrackData/Level';

interface LevelIndexEntry {
    readonly stageLevelId: number;
    readonly file: string;
}

function loadJson(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
        resources.load(path, JsonAsset, (loadError, asset) => {
            if (loadError) {
                reject(loadError);
                return;
            }
            if (!asset) {
                reject(new Error(`Resource is missing: ${path}`));
                return;
            }
            resolve(asset.json);
        });
    });
}

function isLevelIndexEntry(value: unknown): value is LevelIndexEntry {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return typeof candidate.stageLevelId === 'number' && typeof candidate.file === 'string';
}

/**
 * Loads one ConnectTracks campaign level from assets/resources/ConnectTrackData.
 *
 * `levelId` is the campaign level id from tblevels_combined_0to200.json's "id" field ("0".."200"
 * in the current data), as a string. Level selection and progression beyond "load by id" remain
 * UNKNOWN; this adapter only resolves one id to its LevelData.
 *
 * tblevels_combined_0to200.json maps that id to a stage_level_id, but which Level/level_*.json
 * batch file holds the record for that stage_level_id is not predictable (no naming/range
 * pattern; verified against the real data). So this reads levelIndex.json — built once by
 * tools/generate-connecttrack-level-index.mjs — to find { stageLevelId, file } for the id, loads
 * only that one batch file, and parses the record at that key. Re-run the generator script after
 * tblevels_combined_0to200.json or any Level/level_*.json file changes.
 */
export class CocosLevelDataAdapter implements LevelDataPort {
    async loadLevel(levelId: string): Promise<LevelData> {
        const index = await loadJson(INDEX_PATH);
        if (typeof index !== 'object' || index === null) {
            throw new Error('ConnectTracks level index is malformed.');
        }
        const entry = (index as Record<string, unknown>)[levelId];
        if (!isLevelIndexEntry(entry)) {
            throw new Error(`Unknown ConnectTracks level id: ${levelId}`);
        }

        const batch = await loadJson(`${LEVEL_DIR}/${entry.file}`);
        if (typeof batch !== 'object' || batch === null) {
            throw new Error(`Level batch file is malformed: ${entry.file}.json`);
        }
        const record = (batch as Record<string, unknown>)[String(entry.stageLevelId)];
        if (record === undefined) {
            throw new Error(`Level id ${levelId} (stage ${entry.stageLevelId}) not found in ${entry.file}.json`);
        }

        return levelFromRecord(record);
    }
}
