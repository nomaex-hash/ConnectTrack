/**
 * Sinh lại region map cho toàn bộ puzzle: VÙNG LIỀN KHỐI + NGHIỆM DUY NHẤT.
 *
 *   node tools/generate-puzzles.mjs
 *
 * Vì sao cần: bộ data thô có 84% puzzle với vùng bị tách rời — đúng luật nhưng trông khác
 * hẳn game tham chiếu (vùng phải liền khối như miếng ghép jigsaw).
 *
 * Thuật toán, với mỗi puzzle (giữ nguyên kích thước để thứ tự độ khó không đổi):
 *   1. Sinh một nghiệm hợp lệ: N chó, mỗi hàng/cột đúng 1, không 2 con kề nhau (kể cả chéo).
 *   2. Gieo mỗi vùng bằng một ô chó, mọc vùng theo 4-liên thông → liền khối, mỗi vùng 1 chó.
 *   3. PHÁ NGHIỆM PHỤ: nếu puzzle còn nghiệm khác, dịch biên một vùng để triệt tiêu nghiệm
 *      đó, lặp đến khi duy nhất. Mọc vùng ngẫu nhiên trên bàn lớn gần như không bao giờ
 *      cho nghiệm duy nhất ngay — nên phải tinh chỉnh chủ động.
 *
 * Reproducible: RNG gieo theo id nên chạy lại cho kết quả y hệt.
 */

import fs from 'node:fs';
import path from 'node:path';

const POOLS = [
    { name: 'campaign', dir: 'assets/resources/data/puzzles', prefix: 'Level_' },
    { name: 'daily', dir: 'assets/resources/data/daily', prefix: 'Daily_' },
];

// ── RNG tất định (mulberry32) ──────────────────────────────────────────────
function makeRng(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffle(arr, rng) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function neighbors(cell, size) {
    const r = Math.floor(cell / size);
    const c = cell % size;
    const out = [];
    if (r > 0) out.push(cell - size);
    if (r < size - 1) out.push(cell + size);
    if (c > 0) out.push(cell - 1);
    if (c < size - 1) out.push(cell + 1);
    return out;
}

// ── Sinh nghiệm: mỗi hàng/cột 1 chó, cột liền kề lệch nhau >= 2 ──────────────
function generateSolution(size, rng) {
    const cols = new Array(size).fill(-1);
    const used = new Array(size).fill(false);

    function place(row) {
        if (row === size) return true;
        for (const c of shuffle([...Array(size).keys()], rng)) {
            if (used[c]) continue;
            if (row > 0 && Math.abs(c - cols[row - 1]) <= 1) continue;
            cols[row] = c;
            used[c] = true;
            if (place(row + 1)) return true;
            used[c] = false;
            cols[row] = -1;
        }
        return false;
    }

    return place(0) ? cols.map((c, r) => r * size + c) : null;
}

// ── Mọc vùng liền khối từ các ô chó ─────────────────────────────────────────
function growRegions(size, solution, rng) {
    const total = size * size;
    const owner = new Array(total).fill(-1);
    const frontier = [];

    solution.forEach((cell, region) => {
        owner[cell] = region;
        for (const nb of neighbors(cell, size)) frontier.push({ cell: nb, region });
    });

    let assigned = solution.length;
    while (assigned < total && frontier.length > 0) {
        const idx = Math.floor(rng() * frontier.length);
        const { cell, region } = frontier[idx];
        frontier.splice(idx, 1);
        if (owner[cell] !== -1) continue;

        owner[cell] = region;
        assigned++;
        for (const nb of neighbors(cell, size)) {
            if (owner[nb] === -1) frontier.push({ cell: nb, region });
        }
    }

    return assigned === total ? owner : null;
}

// ── Solver: trả về tối đa `cap` nghiệm (mỗi nghiệm = mảng ô đã sort) ─────────
function solve(size, owner, cap = 2) {
    const at = (r, c) => owner[r * size + c];
    const sols = [];
    const cols = new Set();
    const regs = new Set();
    const placed = [];

    const ok = (r, c) => {
        if (cols.has(c) || regs.has(at(r, c))) return false;
        for (const [pr, pc] of placed) {
            if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) return false;
        }
        return true;
    };

    const rec = (r) => {
        if (sols.length >= cap) return;
        if (r === size) {
            sols.push(placed.map(([pr, pc]) => pr * size + pc).sort((a, b) => a - b));
            return;
        }
        for (let c = 0; c < size; c++) {
            if (!ok(r, c)) continue;
            cols.add(c); regs.add(at(r, c)); placed.push([r, c]);
            rec(r + 1);
            placed.pop(); regs.delete(at(r, c)); cols.delete(c);
        }
    };
    rec(0);
    return sols;
}

/** Vùng `region` (sau khi bỏ ô `without`) còn liền khối và vẫn chứa `mustHave` không? */
function stillConnected(owner, size, region, without, mustHave) {
    const cells = [];
    for (let i = 0; i < owner.length; i++) {
        if (owner[i] === region && i !== without) cells.push(i);
    }
    if (cells.indexOf(mustHave) < 0) return false;

    const set = new Set(cells);
    const seen = new Set([mustHave]);
    const stack = [mustHave];
    while (stack.length) {
        const c = stack.pop();
        for (const nb of neighbors(c, size)) {
            if (set.has(nb) && !seen.has(nb)) { seen.add(nb); stack.push(nb); }
        }
    }
    return seen.size === cells.length;
}

/**
 * Tinh chỉnh region map đến khi nghiệm duy nhất, bằng cách dịch biên phá nghiệm phụ.
 * `owner` bị sửa tại chỗ. Trả về true nếu đạt duy nhất.
 */
function makeUnique(size, owner, solution, rng, maxSteps = 500) {
    const intendedCellOfRegion = solution; // region r luôn có chó gốc tại solution[r]
    const intendedSet = new Set(solution);

    for (let step = 0; step < maxSteps; step++) {
        const sols = solve(size, owner, 2);
        if (sols.length <= 1) return true;

        const intendedKey = [...solution].sort((a, b) => a - b).join(',');
        const alt = sols.find((s) => s.join(',') !== intendedKey);
        if (!alt) return true;

        // Với mỗi vùng, ô chó của nghiệm phụ.
        const altStarOfRegion = new Map();
        for (const cell of alt) altStarOfRegion.set(owner[cell], cell);

        // Tìm một vùng dịch được để phá nghiệm phụ này.
        let broke = false;
        for (const region of shuffle([...altStarOfRegion.keys()], rng)) {
            const x = altStarOfRegion.get(region);
            if (intendedSet.has(x)) continue; // không dịch ô chó gốc

            // x phải kề một vùng KHÁC để chuyển sang.
            const otherRegions = neighbors(x, size)
                .map((nb) => owner[nb])
                .filter((rg) => rg !== region);
            if (otherRegions.length === 0) continue;

            // Bỏ x khỏi `region` mà vẫn liền khối + giữ chó gốc.
            if (!stillConnected(owner, size, region, x, intendedCellOfRegion[region])) continue;

            owner[x] = shuffle(otherRegions, rng)[0];
            broke = true;
            break;
        }

        if (!broke) return false; // bí — để ngoài retry với nghiệm/vùng khác
    }
    return solve(size, owner, 2).length === 1;
}

/**
 * Đường cong độ khó MỚI cho campaign: cỡ bàn theo level.
 *
 * Bản cũ quá phẳng (level 22–180 đều 7×7 → 159 màn 7 mèo), nên tới level 64 vẫn 7 mèo và
 * thắng quá nhanh. Bản này dồn cỡ nhỏ về đầu, cho cỡ lớn tới sớm hơn "một chút":
 *   level 64 → 8×8 (trước là 7), level ~120 → 9, ~250 → 10, cuối → 11.
 * Đổi bảng này rồi chạy lại generator là toàn bộ campaign đổi độ khó (RNG tất định theo id).
 */
export function campaignSize(level) {
    if (level <= 1) return 4;
    if (level <= 3) return 5;
    if (level <= 12) return 6;
    if (level <= 40) return 7;
    if (level <= 110) return 8;
    if (level <= 250) return 9;
    if (level <= 550) return 10;
    return 11; // 551–617: đỉnh độ khó (ít màn — 11×11 vừa cực khó vừa sinh rất chậm)
}

// ── Sinh một puzzle hoàn chỉnh ──────────────────────────────────────────────
export function generatePuzzle(size, seed, prePlacedCount) {
    const rng = makeRng(seed);

    for (let attempt = 0; attempt < 400; attempt++) {
        const solution = generateSolution(size, rng);
        if (!solution) continue;

        const owner = growRegions(size, solution, rng);
        if (!owner) continue;

        if (!makeUnique(size, owner, solution, rng)) continue;

        // Kiểm tra cuối: đúng N vùng, liền khối, một nghiệm.
        if (new Set(owner).size !== size) continue;

        const sorted = [...solution].sort((a, b) => a - b);
        return {
            size,
            regions: owner,
            solution: sorted,
            prePlacedDogs: sorted.slice(0, prePlacedCount),
            prePlacedMarks: [],
        };
    }
    return null;
}

// ── Chạy ────────────────────────────────────────────────────────────────────
// Chỉ chạy khi gọi trực tiếp `node tools/generate-puzzles.mjs`; import từ nơi khác thì bỏ
// qua (để probe tái dùng generatePuzzle mà không ghi đè file).
const runDirectly = process.argv[1] && process.argv[1].endsWith('generate-puzzles.mjs');

let totalOk = 0;
let totalFail = 0;

if (runDirectly) for (const pool of POOLS) {
    const files = fs.readdirSync(pool.dir).filter((f) => f.endsWith('.json'));
    const bySize = {};
    let failed = 0;

    for (const file of files) {
        const p = path.join(pool.dir, file);
        const old = JSON.parse(fs.readFileSync(p, 'utf8'));
        const prePlacedCount = Array.isArray(old.prePlacedDogs) ? old.prePlacedDogs.length : 0;

        // Campaign: cỡ theo đường cong độ khó mới. Daily: giữ nguyên cỡ cũ.
        const size = pool.name === 'campaign' ? campaignSize(old.id) : old.size;

        const seed = ((pool.name === 'daily' ? 1_000_000 : 0) + old.id * 2654435761) >>> 0;
        const g = generatePuzzle(size, seed, prePlacedCount);

        if (!g) {
            console.error(`✗ ${file}: không sinh được size ${size}`);
            failed++;
            totalFail++;
            continue;
        }

        fs.writeFileSync(
            p,
            JSON.stringify(
                {
                    id: old.id,
                    size: g.size,
                    regions: g.regions,
                    solution: g.solution,
                    prePlacedDogs: g.prePlacedDogs,
                    prePlacedMarks: g.prePlacedMarks,
                    sourceLevel: old.sourceLevel ?? old.id,
                },
                null,
                2,
            ) + '\n',
        );

        bySize[g.size] = (bySize[g.size] || 0) + 1;
        totalOk++;
    }

    console.log(`\n=== ${pool.name.toUpperCase()}: ${files.length - failed}/${files.length}`);
    console.log(`   Phân bố size: ${JSON.stringify(bySize)}`);
    if (failed) console.log(`   ✗ ${failed} thất bại`);
}

if (runDirectly) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(totalFail === 0 ? `✓ Sinh lại ${totalOk} puzzle.` : `✗ ${totalFail} thất bại / ${totalOk + totalFail}.`);
    process.exit(totalFail === 0 ? 0 : 1);
}
