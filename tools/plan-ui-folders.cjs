// Read-only inventory: stdout is the move manifest; no assets are changed here.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
function walk(p) {
    return fs.readdirSync(p, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(p, e.name)) : [path.join(p, e.name)]);
}
function category(p) {
    for (const [pattern, group] of [
        [/HowToPlay|tutorial/i, 'tutorial'], [/board\/|Gameplay|Hint/i, 'gameplay'],
        [/shop|Store|IAP|Offer/i, 'shop'], [/Leaderboard|Tournament|rewardTop3/i, 'leaderboard'],
        [/Profile|Avatar/i, 'profile'], [/Daily|Streak/i, 'daily'],
        [/Result|Reward|Heart/i, 'result-rewards'], [/Settings/i, 'settings'], [/MainMenu|home-tabs/i, 'main-menu'],
    ]) if (pattern.test(p)) return group;
    return 'shared';
}
const refs = walk('assets').filter(p => /\.(prefab|scene|mtl|anim|fnt)$/.test(p))
    .map(p => ({ p: p.replaceAll('\\', '/'), text: fs.readFileSync(p, 'utf8') }));
const root = 'assets/textures/ui';
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const plan = fs.readdirSync(root).filter(n => /\.png$/i.test(n)).map(name => {
    const from = root + '/' + name;
    const meta = JSON.parse(fs.readFileSync(from + '.meta', 'utf8'));
    const uses = refs.filter(r => r.text.includes(meta.uuid));
    const groups = [...new Set(uses.map(r => category(r.p)))];
    let group = groups.length === 1 ? groups[0] : groups.length > 1 ? 'shared' : 'unassigned';
    for (const [pattern, value] of [
        [/^(avatar_|frame_)/i, 'profile'], [/^tut_|slot_tut/i, 'tutorial'],
        [/^(color=|Clear!|Amazing|Excellent|Good\.|Great\.|Nice_|Perfect|Unbeliev|Unreal|x-mark|slider_gameplay|slot_gameplay|gamedplay)/i, 'gameplay'],
        [/^(music_|volume|off_mode|on_mode)/i, 'settings'],
        [/^(bg_shop|roof_shop|shop_|store\.|bundles_|bar_bundle|coins_title|i_\d|medium_pack|pre_pack|starter_pack|specialoffer|tag_sale|removeads|remove_ads|slot_premium)/i, 'shop'],
        [/^(rank_|icon_rank|banner_leaderboard)/i, 'leaderboard'], [/^(win_|lose_)/i, 'result-rewards'],
        [/^(daily_|StreakPanel|streak_icon|img_daily)/i, 'daily'],
    ]) if (pattern.test(name)) { group = value; break; }
    if (uses.some(r => /\.mtl$/.test(r.p)) || /^(fx_|VFX_|spark|confetti|tex_glow|glow|bg_glow)/i.test(name)) group = 'effects';
    const buf = fs.readFileSync(from);
    if (buf.readUInt32BE(16) >= 2048 || buf.readUInt32BE(20) >= 2048 || /Atlas|^sactx-/i.test(name)) group = 'large-textures';
    return { from, to: root + '/' + group + '/' + name, uuid: meta.uuid, sha: hash(from), metaSha: hash(from + '.meta'), references: uses.map(r => r.p) };
});
console.log(JSON.stringify(plan, null, 2));
