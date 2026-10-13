/**
 * Chạy kiểm định trên toàn bộ puzzle data.
 *
 *   node tools/validate-puzzles.mjs
 *
 * Vì sao file này nằm NGOÀI `assets/`: Cocos biên dịch mọi thứ trong `assets/scripts/`
 * vào bundle. Runner cần `fs`/`path` của Node, đưa vào đó sẽ làm vỡ build web/native.
 * Logic kiểm định thật nằm ở `assets/scripts/editor/PuzzleValidator.ts` (TypeScript thuần,
 * không engine, không filesystem) — file này chỉ lo đọc file rồi gọi vào đó.
 *
 * Logic dưới đây là bản sao 1-1 của PuzzleValidator. Khi sửa một bên phải sửa cả hai.
 * (Chưa dựng bước build TS cho tooling — nếu sau này thêm, hãy import thẳng từ đó.)
 */

import fs from 'node:fs';
import path from 'node:path';

const POOLS = [
    { name: 'campaign', dir: 'assets/resources/data/puzzles', prefix: 'Level_', expected: 617 },
    { name: 'daily', dir: 'assets/resources/data/daily', prefix: 'Daily_', expected: 154 },
];

function solve(size, regions, targetCount, cap = 2) {
    const regionAt = (row, col) => regions[row * size + col];
    const solutions = [];
    const usedCols = new Set();
    const usedRegions = new Set();
    const placed = [];

    const canPlace = (row, col) => {
        if (usedCols.has(col)) return false;
        if (usedRegions.has(regionAt(row, col))) return false;
        for (const [pRow, pCol] of placed) {
            if (Math.abs(pRow - row) <= 1 && Math.abs(pCol - col) <= 1) return false;
        }
        return true;
    };

    const search = (row) => {
        if (solutions.length >= cap) return;
        if (placed.length === targetCount) {
            solutions.push(placed.map(([r, c]) => r * size + c).sort((a, b) => a - b));
            return;
        }
        if (row === size) return;

        // Bỏ qua hàng này (không bắt buộc mỗi hàng phải có 1 con).
        search(row + 1);
        if (solutions.length >= cap) return;

        for (let col = 0; col < size; col++) {
            if (!canPlace(row, col)) continue;
            const region = regionAt(row, col);
            usedCols.add(col);
            usedRegions.add(region);
            placed.push([row, col]);
            search(row + 1);
            placed.pop();
            usedRegions.delete(region);
            usedCols.delete(col);
            if (solutions.length >= cap) return;
        }
    };

    search(0);
    return solutions;
}

function isContiguous(size, regions) {
    const byRegion = new Map();
    regions.forEach((r, i) => {
        if (!byRegion.has(r)) byRegion.set(r, []);
        byRegion.get(r).push(i);
    });
    for (const cells of byRegion.values()) {
        const set = new Set(cells);
        const seen = new Set([cells[0]]);
        const stack = [cells[0]];
        while (stack.length) {
            const c = stack.pop();
            const r = Math.floor(c / size), col = c % size;
            const nb = [];
            if (r > 0) nb.push(c - size);
            if (r < size - 1) nb.push(c + size);
            if (col > 0) nb.push(c - 1);
            if (col < size - 1) nb.push(c + 1);
            for (const n of nb) if (set.has(n) && !seen.has(n)) { seen.add(n); stack.push(n); }
        }
        if (seen.size !== cells.length) return false;
    }
    return true;
}

function validatePuzzle(p) {
    const errors = [];
    const { size, regions } = p;

    if (!Number.isInteger(size) || size < 1) return ['`size` không hợp lệ.'];
    if (!Array.isArray(regions) || regions.length !== size * size) {
        return [`'regions' phải có ${size * size} phần tử.`];
    }

    const distinctRegions = new Set(regions).size;
    if (distinctRegions !== size) {
        return [`Có ${distinctRegions} vùng màu, phải có đúng ${size}.`];
    }
    if (!isContiguous(size, regions)) {
        errors.push('Vùng màu KHÔNG liền khối.');
    }

    const targetCount = Array.isArray(p.solution) ? p.solution.length : size;
    const solutions = solve(size, regions, targetCount, 2);
    if (solutions.length === 0) errors.push('VÔ NGHIỆM.');
    else if (solutions.length > 1) errors.push('TỪ 2 NGHIỆM TRỞ LÊN.');

    if (Array.isArray(p.solution) && solutions.length === 1) {
        const baked = [...p.solution].sort((a, b) => a - b).join(',');
        if (baked !== solutions[0].join(',')) errors.push('solution trong file khác nghiệm thật.');
    } else if (!Array.isArray(p.solution)) {
        errors.push("Thiếu trường 'solution'.");
    }

    for (const cell of p.prePlacedDogs ?? []) {
        if (!(p.solution ?? []).includes(cell)) {
            errors.push(`prePlacedDogs chứa ô ${cell} không nằm trong solution.`);
        }
    }
    for (const cell of p.prePlacedMarks ?? []) {
        if ((p.solution ?? []).includes(cell)) {
            errors.push(`prePlacedMarks chứa ô ${cell} NẰM TRONG solution.`);
        }
    }

    return errors;
}

let totalFailed = 0;
let totalChecked = 0;

for (const pool of POOLS) {
    if (!fs.existsSync(pool.dir)) {
        console.error(`✗ Không tìm thấy thư mục: ${pool.dir}`);
        totalFailed++;
        continue;
    }

    const files = fs.readdirSync(pool.dir).filter((f) => f.endsWith('.json'));
    const failures = [];
    const sizes = {};

    for (const file of files) {
        const puzzle = JSON.parse(fs.readFileSync(path.join(pool.dir, file), 'utf8'));
        const errors = validatePuzzle(puzzle);
        totalChecked++;
        sizes[puzzle.size] = (sizes[puzzle.size] ?? 0) + 1;
        if (errors.length > 0) failures.push({ file, errors });
    }

    // Id phải liên tục 1..N — mở khóa tuyến tính sẽ kẹt nếu thủng một id.
    const ids = new Set(files.map((f) => Number(f.replace(pool.prefix, '').replace('.json', ''))));
    const missing = [];
    for (let i = 1; i <= pool.expected; i++) if (!ids.has(i)) missing.push(i);

    console.log(`\n=== ${pool.name.toUpperCase()} (${pool.dir})`);
    console.log(`   File            : ${files.length} (kỳ vọng ${pool.expected})`);
    console.log(`   Phân bố size    : ${JSON.stringify(sizes)}`);
    if (missing.length > 0) {
        console.log(`   ✗ THIẾU id      : ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? '…' : ''}`);
        totalFailed += missing.length;
    }
    if (failures.length === 0) {
        console.log('   ✓ Mọi puzzle hợp lệ');
    } else {
        console.log(`   ✗ ${failures.length} puzzle HỎNG:`);
        for (const f of failures.slice(0, 20)) {
            console.log(`      ${f.file}: ${f.errors.join(' | ')}`);
        }
        if (failures.length > 20) console.log(`      … và ${failures.length - 20} file nữa`);
        totalFailed += failures.length;
    }
}

console.log(`\n${'─'.repeat(60)}`);
if (totalFailed === 0) {
    console.log(`✓ ĐẠT — ${totalChecked} puzzle qua toàn bộ kiểm định.`);
    process.exit(0);
} else {
    console.log(`✗ HỎNG — ${totalFailed} vấn đề trên ${totalChecked} puzzle.`);
    console.log('  Puzzle hỏng KHÔNG được đưa vào build (02 — mục 10.3).');
    process.exit(1);
}
