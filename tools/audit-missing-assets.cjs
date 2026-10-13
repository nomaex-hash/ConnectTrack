const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const base64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function normalize(id) {
    const [base, ...suffix] = id.split('@');
    if (base.length !== 22) return id;
    let hex = base.slice(0, 2);
    for (let i = 2; i < 22; i += 2) {
        const n = (base64.indexOf(base[i]) << 6) | base64.indexOf(base[i + 1]);
        hex += n.toString(16).padStart(3, '0');
    }
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-') + (suffix.length ? '@' + suffix.join('@') : '');
}
function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name).replaceAll('\\', '/')]);
}
function parse(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return null; } }
const files = walk('assets');
const engine = 'C:/ProgramData/cocos/editors/Creator/3.8.6/resources/resources/3d/engine/editor/assets';
const known = new Map(), old = new Map(), orphan = [], noMeta = [], invalidJson = [];
function index(meta, file, map) {
    if (meta.uuid) map.set(normalize(meta.uuid), file.replace(/\.meta$/, ''));
    for (const sub of Object.values(meta.subMetas || {})) index(sub, file, map);
}
for (const file of [...files, ...walk(engine)].filter(p => p.endsWith('.meta'))) {
    const meta = parse(file);
    if (!meta) { invalidJson.push(file); continue; }
    if (fs.existsSync(file.slice(0, -5))) index(meta, file, known);
    else if (file.startsWith('assets/')) orphan.push(file);
}
const previous = process.argv.includes('--reuse-history') ? parse('docs/missing-assets-report.json') : null;
for (const entry of previous?.missing || []) if (entry.formerPath) old.set(entry.uuid, entry.formerPath);
const deleted = previous ? [] : cp.execFileSync('git', ['ls-files', '--deleted', '--', 'assets'], { encoding: 'utf8' }).split('\n').filter(p => p.endsWith('.meta'));
for (const file of deleted) {
    try { index(JSON.parse(cp.execFileSync('git', ['show', 'HEAD:' + file], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })), file, old); } catch {}
}
const manifest = parse('docs/ui-asset-moves.json') || [];
for (const item of manifest) old.set(item.uuid, item.to);
const missing = new Map();
function add(uuid, source, location, node, kind) {
    const key = normalize(uuid);
    if (known.has(key)) return;
    const entry = missing.get(key) || { uuid: key, formerPath: old.get(key.split('@')[0]) || old.get(key) || null, references: [] };
    entry.references.push({ source, location, node, kind });
    missing.set(key, entry);
}
for (const file of files) {
    if (!file.endsWith('.meta') && !fs.existsSync(file + '.meta')) noMeta.push(file);
    if (!/\.(prefab|scene|mtl|anim|json|pac|meta)$/.test(file)) continue;
    const data = parse(file);
    if (!data) { invalidJson.push(file); continue; }
    function visit(value, location, node) {
        if (!value || typeof value !== 'object') return;
        if (value.__uuid__) add(value.__uuid__, file, location, node, 'asset');
        if (typeof value.__type__ === 'string' && /^[0-9a-f]{2}[A-Za-z0-9+/]{20}$/.test(value.__type__)) add(value.__type__, file, location + '.__type__', node, 'script');
        for (const [key, child] of Object.entries(value)) {
            if (key !== '__uuid__' && /uuid/i.test(key) && key !== 'uuid' && typeof child === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27}(@.*)?$/i.test(child)) add(child, file, location + '.' + key, node, 'metadata');
            visit(child, location + '.' + key, node);
        }
    }
    if (Array.isArray(data)) data.forEach((v, i) => visit(v, '[' + i + ']', v?.node ? data[v.node.__id__]?._name : v?._name));
    else visit(data, '$', null);
}
console.log(JSON.stringify({ missing: [...missing.values()], orphanMetadata: orphan, assetsWithoutMetadata: noMeta, invalidJson, indexedUuids: known.size }, null, 2));
