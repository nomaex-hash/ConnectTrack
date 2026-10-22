#!/usr/bin/env node
// Kiểm tra config.json của mọi bundle trong 1 thư mục build web (vd build/web-mobile-008) TRƯỚC khi deploy.
//
// Vì sao cần: Cocos Creator 3.8.x với Compression Type "Merge Dependency" có thể ghi vào `packs` của config
// một UUID DẠNG CHUỖI (thay vì chỉ số trong mảng `uuids`) khi asset đó (vd SpriteAtlas auto-atlas.pac) không
// thuộc bundle nào. Engine lúc khởi động (assetManager._loadProjectBundles -> Config._initPackage) sẽ ném
//   "TypeError: Cannot read properties of undefined (reading 'packs')"
// và game đứng ở màn đen. Preview trong Editor KHÔNG gặp lỗi này, chỉ bản build mới gặp.
//
// Dùng:  node tools/check-bundle-configs.mjs build/web-mobile-008
// Thoát mã 1 nếu có tham chiếu hỏng.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const buildDir = process.argv[2];
if (!buildDir) {
    console.error('Cách dùng: node tools/check-bundle-configs.mjs <thư-mục-build-web>');
    process.exit(2);
}
const assetsDir = join(buildDir, 'assets');
if (!existsSync(assetsDir)) {
    console.error(`Không thấy ${assetsDir}`);
    process.exit(2);
}

let failed = false;
for (const bundle of readdirSync(assetsDir).sort()) {
    const dir = join(assetsDir, bundle);
    if (!statSync(dir).isDirectory()) continue;
    const configPath = join(dir, 'config.json');
    if (!existsSync(configPath)) {
        console.log(`✗ ${bundle}: thiếu config.json`);
        failed = true;
        continue;
    }
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const uuids = config.uuids ?? [];
    const bad = [];
    let refs = 0;
    for (const [packId, ids] of Object.entries(config.packs ?? {})) {
        for (const id of ids) {
            refs++;
            if (!Number.isInteger(id) || id < 0 || id >= uuids.length) bad.push({ packId, id });
        }
    }
    if (bad.length === 0) {
        console.log(`✓ ${bundle}: ${Object.keys(config.packs ?? {}).length} pack, ${refs} tham chiếu — OK`);
    } else {
        failed = true;
        console.log(`✗ ${bundle}: ${bad.length}/${refs} tham chiếu pack HỎNG (sẽ làm engine crash khi khởi động):`);
        for (const b of bad.slice(0, 5)) console.log(`    pack ${b.packId} -> ${JSON.stringify(b.id)}`);
    }
}
process.exit(failed ? 1 : 0);
