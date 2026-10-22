#!/usr/bin/env node
// Vá lỗi build Cocos Creator 3.8.x: xoá khỏi `packs` của config.json những tham chiếu là UUID DẠNG CHUỖI.
//
// Bối cảnh: các SpriteAtlas (auto-atlas.pac có "Remove SpriteAtlas In Bundle" bật) bị bộ build loại khỏi
// danh sách `uuids` của bundle, nhưng vẫn để lại UUID thô trong `packs`. Engine khi khởi động
// (Config._initPackage) gặp UUID thô sẽ ném "Cannot read properties of undefined (reading 'packs')".
// Các asset đó đã bị loại khỏi bundle nên bỏ tham chiếu thừa khỏi pack là an toàn về mặt cấu trúc.
//
// Dùng (SAU khi build, TRƯỚC khi deploy):
//   node tools/fix-bundle-configs.mjs build/web-mobile-009          # vá tại chỗ
//   node tools/fix-bundle-configs.mjs build/web-mobile-009 --dry    # chỉ liệt kê, không ghi
// Rồi kiểm tra lại:
//   node tools/check-bundle-configs.mjs build/web-mobile-009
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [buildDir, flag] = process.argv.slice(2);
const dry = flag === '--dry';
if (!buildDir) {
    console.error('Cách dùng: node tools/fix-bundle-configs.mjs <thư-mục-build-web> [--dry]');
    process.exit(2);
}
const assetsDir = join(buildDir, 'assets');
if (!existsSync(assetsDir)) {
    console.error(`Không thấy ${assetsDir}`);
    process.exit(2);
}

let total = 0;
for (const bundle of readdirSync(assetsDir).sort()) {
    const configPath = join(assetsDir, bundle, 'config.json');
    if (!statSync(join(assetsDir, bundle)).isDirectory() || !existsSync(configPath)) continue;
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    const uuids = config.uuids ?? [];
    const removed = [];
    for (const [packId, ids] of Object.entries(config.packs ?? {})) {
        const kept = ids.filter((id) => {
            const valid = Number.isInteger(id) && id >= 0 && id < uuids.length;
            if (!valid) removed.push(id);
            return valid;
        });
        config.packs[packId] = kept;
    }
    if (removed.length === 0) {
        console.log(`✓ ${bundle}: không có gì để vá`);
        continue;
    }
    total += removed.length;
    console.log(`${dry ? '•' : '✔'} ${bundle}: ${dry ? 'sẽ bỏ' : 'đã bỏ'} ${removed.length} tham chiếu: ${removed.join(', ')}`);
    if (!dry) writeFileSync(configPath, JSON.stringify(config));
}
console.log(total === 0 ? 'Không có thay đổi.' : `${dry ? 'Cần vá' : 'Đã vá'} ${total} tham chiếu.`);
