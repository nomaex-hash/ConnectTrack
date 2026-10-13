# Dogdoku — Roadmap

> Trạng thái thực tế của dự án và những gì còn lại để đạt MVP. Tiêu chí "hoàn thành" lấy từ [01 — mục 9](../vision/01-project-overview.md).
>
> **Cập nhật lần cuối:** 2026-07-14. Tài liệu này phải được cập nhật mỗi khi một giai đoạn kết thúc — roadmap sai còn tệ hơn không có roadmap.

---

# 1. Trạng thái hiện tại

**Toàn bộ phần dưới UI đã xong và có kiểm chứng tự động.** Còn lại chủ yếu là lớp hiển thị.

| Hạng mục | Trạng thái |
|---|---|
| Tài liệu thiết kế (01–08, 11) | ✅ Xong |
| Dữ liệu puzzle | ✅ 771 puzzle đã kiểm định (617 campaign + 154 daily) |
| Boot Scene + Boot Sequence | ✅ Chạy được |
| Core / Model / Config / Data | ✅ Xong |
| Service (Save, PuzzleProvider, Daily) | ✅ Xong |
| **Gameplay Core** | ✅ Xong, không import gì từ `cc` |
| Manager + luồng chơi | ✅ Nối xong |
| Test tự động | ✅ **99 test pass** (gameplay, daily, save, resume) |
| **UI Layer** | ❌ **Chưa làm** — mới chỉ có `SplashScreen` |
| Audio | ❌ Chưa có clip; AudioManager mới là khung |
| Animation | ❌ Chưa làm |

**Con số:** 44 file TypeScript, **99 test tự động**, 0 lỗi typecheck ở strict mode.

## 1.1 Cam kết kiến trúc đã được chứng minh

Không còn là khẩu hiệu — có bằng chứng chạy được:

* **Gameplay không phụ thuộc UI.** Toàn bộ luật chơi test được bằng cách gửi Intent, không dựng engine ([03 — ch.3.7](../architecture/03-system-architecture.md)). 73 test chạy trong Node, không mở Cocos.
* **Puzzle data có bất biến được máy kiểm chứng.** `npm run validate:puzzles` → 771/771 đạt.
* **Save có khả năng migrate.** Đã thực hiện một lần đổi kiểu thật (`string[]` → `number[]`) mà không vỡ.

---

# 2. Việc còn lại

## Giai đoạn 4 — UI Layer *(tiếp theo)*

Phần lớn nhất còn lại. Thiết kế đã chốt ở [07](../design/07-ui-flow.md).

| # | Hạng mục | Rủi ro |
|---|---|---|
| 4.1 | `UIManager` — screen stack + popup stack, pool popup | Trung bình. Phải đúng cặp `onEnable`/`onDisable` cho listener, nếu không sẽ rò rỉ |
| 4.2 | `BoardView` + `CellView` + NodePool 121 cell | **Cao** — vẽ viền vùng màu và giữ ô vuông từ 4×4 tới 11×11 là phần khó nhất |
| 4.3 | Gesture detection → Intent (tap / double tap / drag) | **Cao** — phân biệt tap với drag, và xác định chế độ drag từ ô đầu tiên |
| 4.4 | `GameplayScreen` HUD | Thấp |
| 4.5 | `LevelSelectScreen` — cuộn vô hạn, tái sử dụng ~30 node | **Cao** — quyết định hiệu năng lớn nhất của UI ([07 — mục 10.1](../design/07-ui-flow.md)) |
| 4.6 | `MainMenuScreen` — thẻ Daily, thẻ Tiếp tục, tiến trình | Thấp |
| 4.7 | 4 Popup: Pause, Result, Settings, Confirm | Thấp |
| 4.8 | Responsive + Safe Area | Trung bình |

**Điều kiện xong:** chơi được trọn vòng — Main Menu → chọn level → giải xong → mở khóa level kế → thoát app → mở lại thấy tiến trình còn nguyên.

## Giai đoạn 6 — Audio

| # | Hạng mục |
|---|---|
| 6.1 | Chuẩn bị clip: BGM, SFX (đặt Mark, đặt Dog, Wrong Mark, thắng, thua) |
| 6.2 | `AudioManager` nghe `CellChangedEvent` / `MistakeChangedEvent` / `PuzzleSolvedEvent` / `PuzzleFailedEvent` rồi phát clip tương ứng |
| 6.3 | Settings Popup điều chỉnh âm lượng thật |

AudioManager **chỉ lắng nghe Event**, không bao giờ bị Gameplay gọi trực tiếp ([03 — ch.5.1](../architecture/03-system-architecture.md)). Phần nối đã sẵn, chỉ thiếu asset.

## Giai đoạn 7 — Animation & Polish

| # | Hạng mục |
|---|---|
| 7.1 | Cell pop (đặt Dog), shake (Wrong Mark) — [07 — mục 7](../design/07-ui-flow.md) |
| 7.2 | Celebration khi hoàn thành puzzle |
| 7.3 | Chuyển tiếp Screen / Popup |
| 7.4 | Hiệu ứng mở khóa level |

## Giai đoạn 8 — Hoàn thiện & Build

| # | Hạng mục |
|---|---|
| 8.1 | `ResourceManager.init()` — preload thật (atlas board, sprite, audio) |
| 8.2 | Progress bar Boot — **chỉ khi** preload đủ lâu để cần (xem mục 4) |
| 8.3 | Auto-save khi app vào background; pause audio ([02 — mục 9](../vision/02-gameplay-loop.md)) |
| 8.4 | Nút Back Android ([07 — mục 8.1](../design/07-ui-flow.md)) |
| 8.5 | Atlas gộp texture — giảm draw call |
| 8.6 | Đo FPS trên **thiết bị Android tầm trung thật**, không phải máy dev |
| 8.7 | Kiểm tra memory leak sau nhiều ván liên tiếp |
| 8.8 | Build Android / iOS |

---

# 3. Nợ kỹ thuật đã ghi nhận

Ghi ra để không quên, không phải để làm ngay.

| # | Nợ | Mức độ | Ghi chú |
|---|---|---|---|
| 1 | Solver **trùng lặp** giữa `editor/PuzzleValidator.ts` và `tools/validate-puzzles.mjs` | Trung bình | Sửa một bên phải sửa bên kia. Dứt điểm bằng `tsx`/`esbuild` để runner import thẳng file TS — nhưng đó là thêm dependency cho một vấn đề chưa gây đau |
| 2 | ~~Test save còn thiếu~~ | ✅ **Đã trả** | 26 test mới: 8 chế độ hỏng, migration, lấp default, vòng đời save→resume đầy đủ ([08 — mục 6.1](../design/08-save-system.md)) |
| 3 | `ResourceManager.init()` rỗng | Thấp | Chỉ có nội dung khi có asset thật (giai đoạn 8.1) |
| 4 | Thư mục `assets/resource/` (số ít) — data cũ | Thấp | Cần xóa trong Cocos Editor. Không dùng nữa nhưng vẫn nằm trong repo |
| 5 | ADR-001/002/003 rỗng | Thấp | Quyết định kiến trúc hiện nằm ở [03 — ch.11](../architecture/03-system-architecture.md) (15 mục). Tách ra ADR riêng là lựa chọn, không phải thiếu sót |

---

# 4. Những thứ CỐ TÌNH không làm

Ghi ra để không ai "sửa" nhầm chúng.

| Thứ | Vì sao không làm |
|---|---|
| **Progress bar ở Boot** | Boot hiện gần như tức thì. Thanh progress sẽ phải **giả lập** — tức là cố tình bắt người chơi chờ. Chỉ làm khi `ResourceManager` preload thật đủ lâu để cần |
| **Layer Toast / Tutorial** | Không tính năng MVP nào dùng ([03 — ch.1.8](../architecture/03-system-architecture.md)) |
| **`RewardService` / `HintService`** | Reward chỉ có một nguồn (daily); Hint là hàm thuần thuộc luật chơi ([03 — ch.6.2](../architecture/03-system-architecture.md)) |
| **Undo** | Dog đặt luôn đúng, Mark toggle một chạm — Undo không còn giá trị sử dụng (quyết định #2) |
| **Landscape** | Ngoài phạm vi MVP ([07 — mục 11](../design/07-ui-flow.md)) |
| **Asset Bundle / DLC** | Hậu MVP; điểm cắm đã có ở `IPuzzleProvider` |

---

# 5. Hậu MVP

Mọi mục dưới đây đều là **thêm module mới + lắng nghe event sẵn có**, không sửa Gameplay Core. Điểm cắm đã chừa sẵn ở [03 — ch.12](../architecture/03-system-architecture.md).

| Tính năng | Điểm cắm |
|---|---|
| Cloud Save | `CloudSaveService` implements `ISaveService` |
| Online Levels / DLC | `RemotePuzzleProvider` implements `IPuzzleProvider` |
| Puzzle Generator | Implementation mới của `IPuzzleProvider` — **bắt buộc qua `PuzzleValidator`** |
| Achievements | Service mới nghe `PuzzleSolvedEvent` |
| Analytics | Listener trên Event Bus |
| Theme / Skin | Asset bundle + config; chỉ tầng UI |
| Localization | Text qua key trong UI component |
| Monetization | Continue khi Failed; mua lượt Place Dog |

**Tiêu chí kiểm chứng:** nếu một tính năng tương lai **buộc phải sửa Gameplay Core**, kiến trúc phải được xem xét lại theo quy trình ở [03 — ch.11](../architecture/03-system-architecture.md).

---

# 6. Định nghĩa "MVP xong"

Theo [01 — mục 9](../vision/01-project-overview.md):

☐ Người chơi hoàn thành được toàn bộ 617 level campaign
☑ Rule validation chính xác *(73 test pass)*
☐ Place Dog, Hint, Mistake Highlight hoạt động ổn định **trong game thật**
☑ Level mở khóa đúng *(đã test)*
☐ Tiến trình lưu và tải chính xác **qua nhiều lần mở app thật**
☐ Daily Puzzle chơi được mỗi ngày, phần thưởng cấp đúng
☐ Hoạt động tốt trên nhiều tỷ lệ màn hình
☐ Trải nghiệm cảm ứng mượt
☐ **60 FPS trên thiết bị Android tầm trung thật**
☐ Không memory leak nghiêm trọng
☐ Không crash blocker

> Những mục đã ☑ là **đã đúng ở tầng logic** — chúng chỉ thật sự xong khi chạy được trong game hoàn chỉnh trên thiết bị thật.
