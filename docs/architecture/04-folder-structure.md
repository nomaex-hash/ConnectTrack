
## 1. Nguyên tắc tổ chức thư mục

1. **Thư mục ánh xạ đúng kiến trúc phân tầng.** Mỗi thư mục cấp 1 trong `scripts/` tương ứng 1-1 với một tầng trong kiến trúc 6 tầng (03 — ch.2.2). Vị trí một file do tầng nó thuộc về quyết định, không phải cảm tính.
2. **Một thư mục — một trách nhiệm.** Nguyên tắc "single responsibility" của CLAUDE.md áp dụng ở cấp thư mục, không chỉ cấp class.
3. **Asset tổ chức theo loại tài nguyên, không theo tính năng.** Cocos quản lý asset theo type (import pipeline, `.meta`) nên nhóm theo loại (texture, audio, prefab...) dễ bảo trì hơn nhóm theo feature.
4. **Cùng một khái niệm tính năng giữ tên nhất quán xuyên các thư mục theo loại.** Vd "board" xuất hiện ở `gameplay/board/`, `ui/board/`, `prefabs/board/`, `textures/board/` — mỗi nơi chứa loại nội dung khác nhau (logic thuần / code hiển thị / asset cấu trúc / hình ảnh) nhưng cùng tên để dễ tìm theo feature khi cần.
5. **Phân biệt asset tĩnh và asset động.** Chỉ nội dung thực sự cần load theo id lúc runtime mới vào `resources/`; phần còn lại tham chiếu trực tiếp trong scene/prefab để Cocos tự đóng gói theo dependency, tránh phình build.
6. **Không tạo thư mục cho tính năng ngoài MVP.** Các điểm mở rộng tương lai (03 — ch.12) đã có sẵn "chỗ cắm"; không tạo folder rỗng chờ trước cho Theme, Localization, Achievements...
7. **Độ sâu thư mục ở mức tối thiểu cần thiết.** Chỉ tách thư mục con khi thư mục cha đủ nhiều file/khái niệm khác biệt để việc tách thực sự giúp dễ tìm hơn.
8. **13 thư mục cấp 1 của `scripts/` là cố định** (03 — ch.9, khớp CLAUDE.md). Thêm/bớt là thay đổi kiến trúc — phải ghi vào 03 — ch.11 trước khi tạo.

## 2. Cây thư mục hoàn chỉnh

```
assets/
├── scenes/
│   ├── Boot.scene
│   └── Main.scene
│
├── prefabs/
│   ├── screen/
│   │   ├── MainMenuScreen.prefab
│   │   ├── LevelSelectScreen.prefab
│   │   └── GameplayScreen.prefab
│   ├── popup/
│   │   ├── PausePopup.prefab
│   │   ├── ResultPopup.prefab
│   │   └── SettingsPopup.prefab
│   ├── board/
│   │   ├── Board.prefab
│   │   └── Cell.prefab
│   └── widget/
│       ├── MistakeCounterView.prefab
│       └── PlaceDogCounterView.prefab
│
├── scripts/
│   ├── core/
│   ├── event/
│   ├── model/
│   ├── config/
│   ├── data/
│   │   ├── puzzles/
│   ├── gameplay/
│   │   ├── board/
│   │   ├── validation/
│   │   ├── assist/
│   │   ├── state/
│   │   └── progression/
│   ├── manager/
│   ├── service/
│   ├── ui/
│   │   ├── screen/
│   │   ├── popup/
│   │   ├── board/
│   │   └── widget/
│   ├── audio/
│   ├── animation/
│   ├── utility/
│   └── editor/
│
├── resources/                    ← BẮT BUỘC đúng tên "resources" (số nhiều)
│   └── data/
│       ├── puzzles/              Level_1.json .. Level_617.json  (campaign)
│       └── daily/                Daily_1.json .. Daily_154.json  (pool daily)
│
├── textures/
│   ├── board/
│   └── ui/
│
├── atlas/
├── fonts/
│
├── audio/
│   ├── bgm/
│   └── sfx/
│
└── animations/
```

**Ngoài `assets/` — thư mục `tools/` ở gốc project:**

```
tools/
└── validate-puzzles.mjs     Chạy PuzzleValidator trên toàn bộ 771 puzzle
```

**Vì sao `tools/` phải nằm ngoài `assets/`:** Cocos biên dịch **mọi thứ** trong `assets/scripts/` vào bundle runtime. Runner cần `fs`/`path` của Node — đưa vào `scripts/editor/` sẽ làm **vỡ build web/native**. Vì vậy tách đôi: logic kiểm định thuần TS ở `assets/scripts/editor/PuzzleValidator.ts` (an toàn để biên dịch), phần đọc file ở `tools/` (chỉ chạy bằng Node lúc design-time, không vào build).

Chạy: `node tools/validate-puzzles.mjs`

ghi chú: Mỗi level là một file JSON riêng.

Ví dụ

Level_1.json

Level_2.json

Level_3.json

daily_2026_07_01.json
PuzzleProvider chỉ đọc từ thư mục này.

**Cố tình không có trong cây:** `sprites/` (gộp vào `textures/` — trong Cocos một ảnh import vào tự động vừa là Texture2D vừa là SpriteFrame, tách riêng chỉ trùng lặp); `materials/`, `shaders/` (MVP không có nhu cầu shader tuỳ chỉnh nào được ghi nhận — game 2D dùng effect có sẵn của Cocos là đủ); `bundles/` (Online Levels/DLC là hậu MVP — 03 ch.12 chỉ định "bundle của ResourceManager" là điểm cắm tương lai, chưa cần tạo bundle thật); `localization/` (hậu MVP theo 03 ch.12 — text hard-code thẳng trong UI component, điểm mở rộng là "text qua key", chưa cần thư mục); `data/`, `configs/` cấp `assets/` riêng (gộp vào `resources/data/` — lý do ở mục 3.1).

## 3. Giải thích từng thư mục

### 3.1 `assets/` (ngoài `scripts/`)

| Thư mục | Mục đích | File đặt ở đây | Không đặt ở đây | Quan hệ |
|---|---|---|---|---|
| `scenes/` | Đúng 2 scene cho toàn MVP (03 — ch.5.3, ch.10.1) | `Boot.scene`, `Main.scene` | Không tạo scene riêng cho Main Menu/Level Select/Gameplay — đó là UI screen do UIManager quản lý | `scripts/manager/SceneManager.ts` là nơi duy nhất chuyển scene |
| `prefabs/` | Node + Component đã lắp ráp trong Editor | 4 nhóm: `screen/`, `popup/`, `board/`, `widget/` | Không có `prefabs/gameplay/` — Gameplay Layer là TypeScript thuần, không có đại diện dạng prefab (03 — ch.3.1) | Mỗi prefab gắn đúng 1 Component khai báo trong `scripts/ui/` tương ứng |
| `resources/` | Asset cần load động theo id lúc runtime | `data/puzzles/Level_{id}.json` (617 file campaign), `data/daily/Daily_{id}.json` (154 file pool daily) | Không đặt texture/audio/prefab tĩnh — mọi thứ trong `resources/` bị đóng gói vào build dù có dùng hay không. **Không có `data/levels/`** — thứ tự campaign chính là thứ tự id, không cần file danh sách | `PuzzleProvider` (service/) đọc theo levelId (campaign) hoặc theo seed ngày (daily) |
| `textures/` | Ảnh nguồn | `board/` (chó, ô, vùng màu, mark), `ui/` (nút, icon, nền) | Không tách `sprites/` riêng | Nhiều ảnh cùng nhóm được gộp bởi `atlas/` |
| `atlas/` | Định nghĩa Auto Atlas gộp texture để giảm draw call | File cấu hình atlas | Không đặt ảnh gốc — ảnh gốc ở `textures/`, atlas chỉ tham chiếu | Phục vụ trực tiếp mục tiêu hiệu năng (03 — ch.1.7) |
| `fonts/` | Font dùng trong UI | Font file | — | Dùng bởi Label trong `ui/` |
| `audio/` | File âm thanh nguồn | `bgm/`, `sfx/` | Không đặt clip id hay cấu hình âm lượng — đó là code, ở `scripts/audio/` | Phát bởi `AudioManager` |
| `animations/` | Animation clip của Cocos | Clip celebration, hiệu ứng chuyển màn | Không đặt Component điều khiển — đó là code, ở `scripts/animation/` | Trigger bởi Component trong `scripts/animation/` |

**Vì sao `data`/`configs` không phải thư mục cấp 1 riêng trong `assets/`:** PuzzleData cần load động theo levelId hoặc theo ngày (03 — ch.6.1: "PuzzleProvider ... theo levelId hoặc theo ngày"), nên về mặt kỹ thuật Cocos, nó **bắt buộc** phải nằm trong `resources/` (hoặc bundle) — asset ngoài `resources/` chỉ dùng được qua tham chiếu trực tiếp trong scene/prefab, không load theo id được. Vì vậy nội dung đó nằm ở `resources/data/`. Còn GameConfig/LevelListConfig (giá trị tuning) đã được 03 — ch.9 xếp là code trong `scripts/config/`, không phải asset — không cần thêm thư mục `assets/configs/`.

### 3.2 `scripts/` — 13 thư mục cấp 1

| Thư mục | Mục đích | File điển hình | Không đặt ở đây |
|---|---|---|---|
| `core/` | Nền tảng dùng ở mọi nơi, phụ thuộc thấp nhất | `EventManager.ts`, enum (`CellState`, `AppState`, `PuzzleState`), hằng số, type dùng chung | Logic gameplay, bất kỳ thứ gì phụ thuộc Node/Component |
| `event/` | Danh mục toàn bộ event + kiểu payload | `CellChangedEvent.ts`, `PuzzleSolvedEvent.ts`, `PlaceDogUsedEvent.ts`... (03 — ch.4.3) | Logic phát/xử lý event — chỉ định nghĩa kiểu |
| `model/` | Khai báo **kiểu dữ liệu** (shape) | `PuzzleData.ts`, `PlayerData.ts`, `BoardSaveData.ts` | Giá trị tĩnh (→ `config/`), logic đọc/ghi (→ `data/`) |
| `config/` | Giá trị **tĩnh** dùng để tuning | `GameConfig.ts` (max mistake, ngưỡng gesture...), `LevelListConfig.ts` | Kiểu dữ liệu (→ `model/`), logic |
| `data/` | Cơ chế đọc/ghi/serialize/migration | Serializer, migration function theo `version` của PlayerData (03 — ch.7.3) | Kiểu dữ liệu, giá trị tĩnh, logic gameplay |
| `gameplay/` | Toàn bộ luật chơi — TypeScript thuần | Xem 3.3 | Bất kỳ import Node/Component/Sprite/Tween nào |
| `manager/` | 6 manager vòng đời xuyên suốt app + composition root | `GameManager.ts`, `UIManager.ts`, `AudioManager.ts`, `SaveManager.ts`, `SceneManager.ts`, `ResourceManager.ts`, `Bootloader.ts` (03 — ch.11 quyết định #15) | `EventManager.ts` (ở `core/` — xem mục 8), logic gameplay |
| `service/` | Chức năng hỗ trợ, có thể thay implementation | `IPuzzleProvider.ts`, `LocalPuzzleProvider.ts`, `ISaveService.ts`, `LocalSaveService.ts`, `DailyPuzzleService.ts` | `RewardService`, `HintService` — cố tình không tạo (03 — ch.6.2) |
| `ui/` | Hiển thị + nhận thao tác người chơi | Xem 3.3 | Kiểm tra luật chơi, tính thắng/thua |
| `audio/` | Định danh clip, cấu hình âm thanh (code) | `AudioClipId.ts` | File âm thanh thật (→ `assets/audio/`) |
| `animation/` | Component animation (celebration, hiệu ứng UI) | `CelebrationAnimation.ts` | Animation clip thật (→ `assets/animations/`), logic gameplay |
| `utility/` | Tiện ích dùng chung | Vd `NodePool.ts` (dùng cả ở cell view lẫn popup pool — 03 ch.10.2) | Hàm chỉ dùng ở một nơi |
| `editor/` | Logic tool design-time | `PuzzleValidator.ts` — solver + 3 phép kiểm định puzzle (02 — mục 10.3) | Code `fs`/`path` của Node: Cocos biên dịch mọi thứ trong `scripts/` vào bundle → sẽ vỡ build. Phần đọc file nằm ở `tools/` (xem dưới) |

### 3.3 Thư mục con trong `gameplay/` và `ui/`

Đây là phần "thiết kế chi tiết" — thêm thư mục con **bên trong** 2 thư mục cấp 1 đã có sẵn (không phải thư mục cấp 1 mới), dựa theo đúng cách 03 — ch.3 đã chia Puzzle Session thành 5 nhóm con.

| `gameplay/<sub>` | Nội dung | Căn cứ |
|---|---|---|
| `board/` | Board System — trạng thái lưới, vùng màu, trạng thái từng ô | 03 — ch.3.2 |
| `validation/` | Placement Check (so với solution) + Mistake Counter | 03 — ch.3.4 |
| `assist/` | Place Dog, Hint, Restart | 03 — ch.3.5 |
| `state/` | Puzzle State Machine (Loading→Ready→Playing→Solved/Failed/Disposed) | 03 — ch.3.6 |
| `progression/` | Mở khóa level | 02 — mục 5, 03 — ch.1.3 |

`PuzzleSession.ts` (điều phối cả 5 nhóm trên) đặt ở gốc `gameplay/`.

| `ui/<sub>` | Nội dung | Căn cứ |
|---|---|---|
| `screen/` | Main Menu, Level Select, Gameplay (gồm HUD) | 03 — ch.2.3, ch.9 |
| `popup/` | Pause, Result, Settings | 03 — ch.11 quyết định #3 |
| `board/` | BoardView, CellView, gesture detection (Single/Double Tap, Drag) | 03 — ch.3.3, 02 — mục 1.1 |
| `widget/` | Thành phần nhỏ dùng lại: `CounterView` (dùng chung cho Mistake và Place Dog), `LevelCell`, `DialogFrame`, `PrimaryButton`, `IconButton` | 07 — mục 10, 12 |

## 4. Quy tắc đặt file

Khi tạo file mới, hỏi theo thứ tự — dừng ở câu đầu tiên đúng:

1. File có import API **scene-graph** của engine (`Node`, `Component`, `Sprite`, `Label`, `Tween`, `Prefab`...)? → **Không** thể đặt trong `core/`, `data/`, `gameplay/`, `service/`. Tiếp tục xét `manager/`/`ui/`/`animation/`.
   - **Ngoại lệ có chủ đích:** `service/` được phép dùng API **nền tảng** (`sys`, `resources`, `JsonAsset`) — đó chính là lý do service tồn tại: nó là *adapter ra thế giới bên ngoài* (storage, asset). Ví dụ `LocalSaveService` dùng `sys.localStorage`, `LocalPuzzleProvider` dùng `resources.load` (03 — ch.6.1). Ranh giới thật cần giữ là: **`gameplay/` không import bất kỳ thứ gì từ `cc`** — đó mới là điều kiện để luật chơi test được không cần engine (03 — ch.3.7).
2. File chỉ khai báo shape dữ liệu, không có logic? → `model/`.
3. File chứa giá trị tĩnh dùng để tuning? → `config/`.
4. File xử lý đọc/ghi/serialize/migration? → `data/`.
5. File định nghĩa một Event (tên + kiểu payload)? → `event/`.
6. File chứa luật chơi ("điều gì xảy ra", không quan tâm hiển thị)? → `gameplay/`, chọn đúng thư mục con (3.3).
7. File là singleton sống xuyên suốt vòng đời app? → `manager/`.
8. File cung cấp chức năng hỗ trợ, có thể thay implementation, không giữ state lâu dài? → `service/`.
9. File hiển thị dữ liệu hoặc nhận thao tác người chơi? → `ui/`, chọn đúng thư mục con (3.3).
10. File dùng chung, đã có **từ 2 nơi trở lên** cần dùng? → `utility/`. Nếu mới có 1 nơi dùng: để nguyên trong module đó.
11. File chỉ chạy trong Editor? → `editor/`.

## 5. Quy tắc import

| Thư mục | Được import | Cấm import |
|---|---|---|
| `core/` | — (tầng nền) | Tất cả |
| `event/` | `core/` | Tất cả tầng còn lại |
| `model/`, `config/`, `data/` | `core/`; dùng lẫn nhau trong nhóm | `gameplay/`, `manager/`, `service/`, `ui/` |
| `gameplay/` | `core/`, `event/`, `model/`, `config/`, `data/` | `service/`, `manager/`, `ui/`, `audio/`, `animation/` |
| `manager/` | `core/`, `event/`, `model/`, `config/`, `data/`, `service/`, API công khai của `gameplay/` | Nội bộ `gameplay/`; `ui/` (trừ `UIManager` giữ danh mục screen/popup) |
| `service/` | `core/`, `event/`, `model/`, `config/`, `data/` | `gameplay/`, `manager/`, `ui/` |
| `ui/` | `core/`, `event/`, `config/` (chỉ đọc), API đọc + Intent của `gameplay/` | `data/` (ghi), `service/`, `manager/` (trừ `UIManager`) |
| `audio/`, `animation/` (scripts) | `core/`, `event/` | Logic gameplay trực tiếp — chỉ phản ứng theo event |
| `utility/` | `core/` | Không phụ thuộc ngược lại module gọi nó |
| `editor/` | Tự do | Không được import ngược từ runtime |

Ghi chú: `model/`/`config/`/`data/` là 3 vai trong cùng "Data tier" (03 — ch.7.1) nên được dùng lẫn nhau (vd `data/` cần biết shape từ `model/` để serialize). `ui/` được đọc `config/` vì gesture detection cần ngưỡng double-tap/drag từ GameConfig (03 — ch.3.3), nhưng không được **ghi**. Bảng đầy đủ ở cấp tầng: 03 — ch.8.1.

## 6. Naming Convention

Mở rộng bảng của CLAUDE.md cho các trường hợp chưa nêu:

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Interface | `IxxxYyy` | `IPuzzleProvider`, `ISaveService` |
| Event | Việc đã xảy ra → thì quá khứ + `Event` | `CellChangedEvent`, `PuzzleSolvedEvent` |
| Event do UI yêu cầu | + hậu tố `Requested` | `PauseRequestedEvent` |
| Enum | Danh từ số ít, không hậu tố | `CellState`, `AppState`, `PuzzleState` |
| File | 1 class = 1 file, tên file = tên class | `BoardSystem.ts` chứa `class BoardSystem` |
| Prefab | Tên khớp Component chính gắn trên nó | `Board.prefab` ↔ `BoardView.ts` |
| Thư mục | Danh từ số ít, chữ thường | `manager/` không phải `managers/` |

(Manager/Controller/Service/Popup/Panel/Config/Data/Model/System/Component giữ nguyên theo CLAUDE.md.)

## 7. Ví dụ: thêm tính năng Achievements (hậu MVP)

Theo đúng điểm cắm đã ghi ở 03 — ch.12 ("Service mới lắng nghe event sẵn có... không sửa module hiện hữu"):

- `scripts/model/AchievementData.ts` — shape: id, điều kiện, đã mở khóa chưa
- `scripts/config/AchievementListConfig.ts` — danh sách achievement tĩnh
- `scripts/event/AchievementUnlockedEvent.ts` — nếu cần báo cho UI
- `scripts/service/AchievementService.ts` — lắng nghe `PuzzleSolvedEvent` có sẵn, tự tính điều kiện
- `scripts/ui/screen/AchievementListScreen.ts` + `prefabs/screen/AchievementListScreen.prefab`
- `textures/ui/` — icon achievement (không cần `resources/` vì danh sách cố định lúc build, không load theo id)
- Điểm chạm duy nhất vào code hiện có: đăng ký `AchievementService` ở bước boot (03 — ch.10.1), không sửa logic `gameplay/`.

Không file nào cần thêm ở `gameplay/` — đúng tiêu chí "không sửa Gameplay Core" của 03 — ch.12.

## 8. Những lỗi thường gặp

| Lỗi | Vì sao sai | Cách tránh |
|---|---|---|
| Đặt `EventManager` vào `manager/` | `gameplay/` cấm import `manager/` → Gameplay không phát được event nữa | Giữ `EventManager` ở `core/` đúng 03 — ch.9 |
| Đặt `Bootloader` vào `core/` | Bootloader phải import 6 manager, mà `core/` bị cấm import mọi tầng khác (mục 5) → vi phạm chiều phụ thuộc | Đặt ở `manager/` — nó là composition root (03 — ch.11 quyết định #15) |
| Đặt thư mục asset tên `resource/` (số ít) | Cocos chỉ nhận diện thư mục ma thuật tên **`resources`**. Sai tên → `resources.load()` không thấy file → PuzzleProvider không load được puzzle nào | Đúng tên `assets/resources/`. Đổi tên phải làm **trong Cocos Editor**, không đổi ngoài Explorer (sẽ hỏng `.meta`) |
| Tạo `prefabs/gameplay/` | Gameplay Layer là TypeScript thuần, không có prefab | Mọi prefab thuộc 4 nhóm ở `prefabs/` (mục 3.1) |
| Thêm thư mục cấp 1 mới trong `scripts/` vì "thấy hợp lý" | Vi phạm quyết định đã chốt (03 — ch.9) | Ghi quyết định vào 03 — ch.11 trước khi tạo |
| Trộn `.anim` asset với Component animation | Khó tìm khi cần sửa hiệu ứng celebration | Asset ở `assets/animations/`, code ở `scripts/animation/` |
| Đưa toàn bộ audio/texture vào `resources/` "cho chắc" | Mọi thứ trong `resources/` bị đóng gói vào build dù có dùng hay không | Chỉ nội dung cần load theo id (puzzle, level) mới vào `resources/` |
| Tạo `utility/` cho hàm chỉ dùng 1 nơi | Vi phạm 01 — mục 12 | Để hàm ở lại module gọi nó tới khi có nơi thứ 2 cần |
| Gameplay tự gọi `PuzzleProvider` (service) | `gameplay/` cấm import `service/` (03 — ch.8.1) | Manager gọi Service, truyền dữ liệu vào khi khởi tạo Puzzle Session |
| UI tự đọc `PlayerData` để hiển thị Level Select | Vi phạm 03 — ch.8.2 | UI gọi API chỉ đọc của Progression hoặc nhận qua payload event |

---
