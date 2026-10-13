/**
 * Sinh puzzle tutorial: lưới 5×5, có ĐÚNG MỘT vùng gồm 1 ô (bước 1 dạy đặt chó vào đó),
 * thỏa cả 4 bất biến (đủ vùng, liền khối, có nghiệm, DUY NHẤT nghiệm).
 *
 *   node tools/generate-tutorial.mjs
 *
 * Ghi ra assets/resources/data/tutorial/Tutorial_0.json. Deterministic (seed cố định) nên
 * chạy lại luôn ra cùng một puzzle. Tái dùng solve()/isContiguous() — bản sao 1-1 của
 * validate-puzzles.mjs, khi sửa một bên sửa cả ba (PuzzleValidator, validate, ở đây).
 */
import fs from 'node:fs';

const SIZE = 5;
const OUT_DIR = 'assets/resources/data/tutorial';
const OUT_FILE = `${OUT_DIR}/Tutorial_0.json`;

// ── RNG deterministic (mulberry32) ─────────────────────────────────────────
function rng(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ── solver + contiguity: sao từ validate-puzzles.mjs ────────────────────────
function solve(size, regions, cap = 2) {
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
        if (row === size) {
            solutions.push(placed.map(([r, c]) => r * size + c).sort((a, b) => a - b));
            return;
        }
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

const MID = (SIZE - 1) / 2; // ô giữa: hàng/cột = 2 với lưới 5

// ── Sinh solution: hoán vị cột theo hàng, không kề nhau (kể cả chéo) ─────────
// Ép con chó hàng giữa nằm ở cột giữa → ô GIỮA bàn là dog (để vùng 1 ô ở giữa, đủ ô bao
// quanh mà dạy tích).
function makeSolution(rand) {
    for (let attempt = 0; attempt < 4000; attempt++) {
        const cols = [0, 1, 2, 3, 4];
        for (let i = cols.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [cols[i], cols[j]] = [cols[j], cols[i]];
        }
        // Đưa cột giữa về đúng hàng giữa.
        const mid = MID;
        const at = cols.indexOf(mid);
        [cols[mid], cols[at]] = [cols[at], cols[mid]];

        let ok = cols[mid] === mid;
        for (let r = 1; r < SIZE && ok; r++) {
            if (Math.abs(cols[r] - cols[r - 1]) <= 1) ok = false; // hàng kề: cột phải cách ≥ 2
        }
        if (ok) return cols.map((c, r) => r * SIZE + c);
    }
    throw new Error('không dựng được solution có dog ở giữa và không kề nhau');
}

/**
 * Nuôi 5 vùng liền khối từ 5 hạt (mỗi hạt là một ô dog), mỗi vùng chứa đúng 1 dog. Một
 * dog được chọn làm vùng 1 ô: KHÓA không cho vùng đó lớn thêm.
 */
function growRegions(solution, singleDogIndex, rand) {
    const regions = new Array(SIZE * SIZE).fill(-1);
    const frozen = new Set([singleDogIndex]); // vùng bị đóng băng ở kích thước 1

    solution.forEach((cell, region) => { regions[cell] = region; });
    const singleRegion = solution.indexOf(singleDogIndex);

    const neighbors = (c) => {
        const r = Math.floor(c / SIZE), col = c % SIZE, out = [];
        if (r > 0) out.push(c - SIZE);
        if (r < SIZE - 1) out.push(c + SIZE);
        if (col > 0) out.push(c - 1);
        if (col < SIZE - 1) out.push(c + 1);
        return out;
    };

    let remaining = SIZE * SIZE - SIZE;
    let guard = 0;
    while (remaining > 0 && guard++ < 100000) {
        // Chọn một ô chưa gán, kề với một vùng CHƯA đóng băng, rồi hút nó vào vùng đó.
        const region = Math.floor(rand() * SIZE);
        if (region === singleRegion || frozen.has(region)) continue;
        const owned = [];
        regions.forEach((rg, i) => { if (rg === region) owned.push(i); });
        const border = [];
        for (const c of owned) for (const n of neighbors(c)) if (regions[n] === -1) border.push(n);
        if (border.length === 0) continue;
        const pick = border[Math.floor(rand() * border.length)];
        regions[pick] = region;
        remaining--;
    }

    if (remaining > 0) return null; // có ô cô lập không hút được — thử seed khác
    return regions;
}

function generate() {
    // Seed cố định: puzzle tutorial phải ổn định giữa các build.
    const rand = rng(20260717);
    for (let attempt = 0; attempt < 5000; attempt++) {
        const solution = makeSolution(rand);
        // Vùng 1 ô = con chó ở GIỮA bàn: có đủ ô 4 phía + cả hàng cả cột để dạy tích.
        const singleDogIndex = MID * SIZE + MID;
        if (!solution.includes(singleDogIndex)) continue;
        const regions = growRegions(solution, singleDogIndex, rand);
        if (!regions) continue;
        if (new Set(regions).size !== SIZE) continue;
        if (!isContiguous(SIZE, regions)) continue;
        const solutions = solve(SIZE, regions, 2);
        if (solutions.length !== 1) continue;
        if (solutions[0].join(',') !== [...solution].sort((a, b) => a - b).join(',')) continue;

        // Kiểm tra lại: đúng một vùng có kích thước 1.
        const sizes = {};
        for (const r of regions) sizes[r] = (sizes[r] ?? 0) + 1;
        const singles = Object.values(sizes).filter((s) => s === 1).length;
        if (singles !== 1) continue;

        return {
            id: 0,
            size: SIZE,
            regions,
            solution: [...solution].sort((a, b) => a - b),
            prePlacedDogs: [],
            prePlacedMarks: [],
        };
    }
    throw new Error('không sinh được puzzle tutorial hợp lệ sau 5000 lần thử');
}

const puzzle = generate();
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(puzzle, null, 2)}\n`);

// In lưới cho người xem
const singleCell = (() => {
    const sizes = {};
    puzzle.regions.forEach((r) => { sizes[r] = (sizes[r] ?? 0) + 1; });
    const singleRegion = +Object.keys(sizes).find((k) => sizes[k] === 1);
    return puzzle.regions.indexOf(singleRegion);
})();

console.log(`✓ ${OUT_FILE}`);
console.log(`  solution: ${puzzle.solution.join(', ')}`);
console.log(`  vùng 1 ô ở cell ${singleCell} (row ${Math.floor(singleCell / SIZE)}, col ${singleCell % SIZE})`);
let grid = '';
for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
        const i = r * SIZE + c;
        grid += (puzzle.solution.includes(i) ? '[' : ' ') + puzzle.regions[i] + (puzzle.solution.includes(i) ? ']' : ' ');
    }
    grid += '\n';
}
console.log(grid);
