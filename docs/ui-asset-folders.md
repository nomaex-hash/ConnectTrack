# UI asset folders

314 PNG files from `assets/textures/ui` were moved with their original `.meta`
files. Image and metadata SHA-256 hashes were verified after moving.
See `ui-asset-moves.json` for old/new paths, UUIDs, hashes and direct references.

Folders: `shared`, `main-menu`, `gameplay`, `tutorial`, `shop`, `leaderboard`,
`profile`, `daily`, `settings`, `result-rewards`, `effects`, `large-textures`.
`unassigned` contains images without identified direct serialized references;
this does not mean they are unused. Classification uses references and filenames.
Existing `Avatar` and `Frame` directories remain unchanged.

Resources, Spine assets and game code were not moved. No images were deleted.

## Packing

The root `auto-atlas.pac` retains its UUID and settings. These new folders organize
assets; they do not configure independent atlas packs or exclude effects/large
textures from the existing pack. Review atlas scopes in Creator before splitting
packs. Preserve existing atlas references in prefabs when changing configuration.

Check a fresh Preview and a build: Main Menu, gameplay/hints/Clear, tutorial, shop,
leaderboards, profile, daily and results. Runtime/build verification remains pending.

For future moves, use Creator's Assets panel or move each asset and its `.meta`
together. Update callers if moving assets loaded by resource/bundle path.
