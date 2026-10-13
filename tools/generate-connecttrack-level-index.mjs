#!/usr/bin/env node
/**
 * Builds assets/resources/ConnectTrackData/levelIndex.json.
 *
 * tblevels_combined_0to200.json maps a campaign level id (0..200) to a stage_level_id. The actual
 * puzzle record for that stage_level_id lives as a top-level key inside ONE of the many
 * Level/level_*.json batch files, but which file is not predictable from the id (verified: no
 * naming/range pattern). So this precomputes, once, campaign id -> { stageLevelId, file }, letting
 * the runtime adapter load exactly one small index plus one batch file per level, instead of
 * scanning all ~65 batch files.
 *
 * Run after tblevels_combined_0to200.json or any Level/level_*.json file changes:
 *   node tools/generate-connecttrack-level-index.mjs
 */
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const ROOT = join(import.meta.dirname, '..', 'assets', 'resources', 'ConnectTrackData');
const TBLEVELS_PATH = join(ROOT, 'tblevels_combined_0to200.json');
const LEVEL_DIR = join(ROOT, 'Level');
const OUTPUT_PATH = join(ROOT, 'levelIndex.json');

const tblevels = JSON.parse(readFileSync(TBLEVELS_PATH, 'utf8'));

/** @type {Map<string, string>} stage_level_id (as string) -> batch file base name (no .json) */
const stageIdToFile = new Map();
for (const fileName of readdirSync(LEVEL_DIR)) {
    if (!fileName.endsWith('.json')) continue;
    const data = JSON.parse(readFileSync(join(LEVEL_DIR, fileName), 'utf8'));
    const base = basename(fileName, '.json');
    for (const stageId of Object.keys(data)) {
        const existing = stageIdToFile.get(stageId);
        if (existing && existing !== base) {
            throw new Error(`stage_level_id ${stageId} appears in both ${existing}.json and ${base}.json`);
        }
        stageIdToFile.set(stageId, base);
    }
}

const index = {};
const missing = [];
for (const entry of tblevels) {
    const stageId = String(entry.stage_level_id);
    const file = stageIdToFile.get(stageId);
    if (!file) {
        missing.push(entry.id);
        continue;
    }
    index[String(entry.id)] = { stageLevelId: entry.stage_level_id, file };
}

if (missing.length > 0) {
    throw new Error(`No Level/*.json entry found for tblevels id(s): ${missing.join(', ')}`);
}

writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 1) + '\n', 'utf8');
console.log(`Wrote ${OUTPUT_PATH}: ${Object.keys(index).length} campaign levels indexed.`);

if (!existsSync(OUTPUT_PATH + '.meta')) {
    console.log('No levelIndex.json.meta found yet; Cocos will generate one on the next asset scan,');
    console.log('or copy an existing Level/*.json.meta\'s shape (importer: "json") if you need it sooner.');
}
