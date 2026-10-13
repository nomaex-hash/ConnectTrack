# Dogdoku — UI Flow

> Mô tả toàn bộ luồng giao diện và trải nghiệm người dùng. Chi tiết hóa phần UI đã nhắc tới nhưng chưa mô tả trong [01](../vision/01-project-overview.md), [02](../vision/02-gameplay-loop.md), [03](../architecture/03-system-architecture.md); dùng đúng model của [05](../architecture/05-data-model.md), Event của [06](06-event-flow.md), và Intent của [11](../architecture/11-gameplay-system.md).
>
> Tài liệu này **không** định nghĩa luật chơi (xem 02), **không** định nghĩa kiến trúc (xem 03) — chỉ mô tả người chơi nhìn thấy gì, chạm vào đâu, và màn hình phản ứng ra sao.
>


---

# 1. Mục tiêu của hệ thống UI

## 1.1 Vai trò của UI

UI chỉ làm hai việc:

* **Hiển thị trạng thái** do Gameplay/Manager phát ra qua Event.
* **Chuyển thao tác chạm thành Intent** (gửi vào Gameplay) hoặc **Requested Event** (gửi tới GameManager).

UI không quyết định luật chơi, không đổi bất kỳ Data Model nào ([05 — ch.9](../architecture/05-data-model.md)).

## 1.2 Ranh giới phụ thuộc — quy tắc cứng

Đây là ràng buộc dễ vi phạm nhất khi viết UI, nên nhắc lại rõ:

* `ui/` **được** import: `core/`, `event/`, `config/` (chỉ đọc), và API đọc + Intent của `gameplay/`.
* `ui/` **bị cấm** import: `manager/`, `service/`, `data/` (ghi) — theo [04 — mục 5](../architecture/04-folder-structure.md) và [03 — ch.8.1](../architecture/03-system-architecture.md).
* **Ngoại lệ duy nhất:** `UIManager` được phép import Manager — nó chính là cầu nối giữa hai tầng.

Hệ quả thực tế: Screen/Popup **không bao giờ** gọi thẳng GameManager hay SaveManager. Muốn tác động ra ngoài Gameplay thì phát Requested Event.

## 1.3 Nguyên tắc thiết kế

* **Mobile First** — thiết kế cho màn hình cầm tay, không thu nhỏ từ desktop.
* **Responsive** — một bộ layout chạy đúng từ 16:9 tới 20:9 (mục 11).
* **Dùng được một tay** — vùng chạm quan trọng (Bottom Toolbar, nút Back) nằm ở nửa dưới màn hình.
* **Tối thiểu số lần chạm** — vào ván chỉ tốn 2 chạm, không có màn hình xác nhận thừa.
* **Overlay thay vì đổi Scene** — toàn bộ điều hướng MVP nằm trong **một Scene duy nhất** ([03 — ch.5.3](../architecture/03-system-architecture.md)). Pause, Result, Settings, Confirm đều là Popup che lên Screen, giữ nguyên trạng thái Gameplay phía dưới.

---

# 2. Danh sách Screen

Bốn Screen, ánh xạ đúng AppState ([02 — mục 7](../vision/02-gameplay-loop.md)). Chỉ một Screen hiển thị tại một thời điểm; Popup nằm ở tầng riêng (mục 9).

## 2.1 Boot

* **Mục đích:** hiển thị lúc hệ thống khởi tạo ([03 — ch.10.1](../architecture/03-system-architecture.md)). Không tương tác.
* **Thành phần:** logo, splash. *(Đã dựng sẵn trong `Boot.scene`, không do UIManager quản lý.)*
* **Đi tới đâu:** Main Menu khi `AppStateChangedEvent (Loading → MainMenu)`.

> **Boot không bao giờ vào thẳng Gameplay.** Ván đang dở được xử lý ở Main Menu qua thẻ "Tiếp tục" (mục 4.2) — quyết định này giữ nguyên AppState machine hiện có (`Loading → MainMenu → Gameplay`), không cần thêm transition mới.

## 2.2 Main Menu

* **Mục đích:** trung tâm điều hướng.
* **Thành phần:** logo, nút **Chơi**, thẻ **Daily Puzzle**, thẻ **Tiếp tục** (chỉ hiện khi có ván dở), nút **Cài đặt**, tiến trình tổng quát ("Level 35 / 617").
* **Mở từ đâu:** sau Boot; Back từ Level Select; Result Popup (nút "Về Menu").
* **Đi tới đâu:** Level Select, Gameplay (qua Daily hoặc Tiếp tục), Settings Popup.

## 2.3 Level Select

* **Mục đích:** chọn level campaign.
* **Thành phần:** danh sách cuộn 617 ô level, trạng thái khóa/mở/đã xong trên từng ô, nút Back.
* **Mở từ đâu:** Main Menu (nút Chơi); Result Popup (nút "Chọn Level").
* **Đi tới đâu:** Gameplay (tap level đã mở khóa); Main Menu (Back).

## 2.4 Gameplay

* **Mục đích:** màn chơi chính — BoardView + HUD (mục 5).
* **Mở từ đâu:** Level Select; Main Menu (Daily hoặc Tiếp tục).
* **Đi tới đâu:** không tự chuyển Screen. Kết thúc ván mở **Result Popup**; người chơi tự bấm để rời màn.

---

# 3. Danh sách Popup

Popup che lên Screen, không thay Screen. Popup **dùng lại instance qua pool** ([06 — mục 6](06-event-flow.md)) — đăng ký/hủy listener theo cặp `onEnable`/`onDisable`, vì popup chỉ ẩn/hiện chứ không hủy Node.

## 3.1 Pause Popup

* **Mở khi:** `PauseRequestedEvent` (tap icon Pause, hoặc Back Android lúc Ready/Playing).
* **Đóng khi:** `ResumeRequestedEvent`; hoặc chọn Thoát → Confirm → rời Screen.
* **Chặn input phía dưới:** **Có — nhưng chặn ở LỚP UI.**

> **Đính chính quan trọng:** Gameplay **không biết Pause tồn tại** ([11 — mục 8](../architecture/11-gameplay-system.md)) — `PuzzleSession` vẫn nhận Intent bình thường trong lúc Pause. Việc chặn là do **UI khóa gesture trên BoardView**, không phải do Gameplay từ chối. Bằng chứng: nút **Restart trên Pause Popup vẫn gửi Intent `Restart` và vẫn chạy** — nếu Gameplay thật sự chặn thì nút đó đã chết.

* **Lưu trạng thái:** không cần — board đã auto-save liên tục qua các Event trước đó ([06 — mục 4.16](06-event-flow.md)).
* **Thành phần:** Resume, Restart (qua Confirm), Cài đặt (mở Settings chồng lên), Thoát (qua Confirm).

## 3.2 Result Popup

* **Mở khi:** `PuzzleSolvedEvent` hoặc `PuzzleFailedEvent`.
* **Đóng khi:** người chơi bấm một nút hành động. **Không có nút "X"** — tránh bỏ lỡ phần thưởng.
* **Chặn input phía dưới:** Có (ở lớp UI). Gameplay cũng đã tự khóa vì PuzzleState là Solved/Failed ([11 — mục 4.4](../architecture/11-gameplay-system.md)) — hai lớp bảo vệ độc lập.

> **Result Popup KHÔNG tự lắng nghe Event.**
>
> Lý do: GameManager phát `LevelUnlockedEvent` / `DailyRewardGrantedEvent` **đồng bộ, ngay bên trong lúc xử lý `PuzzleSolvedEvent`**. Nếu popup tự nghe, kết quả phụ thuộc vào thứ tự đăng ký listener — popup có thể còn chưa mở khi event bay qua, và phần thưởng biến mất khỏi màn hình.
>
> **Cách đúng:** `UIManager` (bên duy nhất được import Manager) lắng nghe, gom đủ dữ liệu, rồi **truyền một object kết quả vào ResultPopup lúc mở**. Popup chỉ hiển thị thứ được đưa cho. Điều này cũng đúng nguyên tắc "Event không dùng để truy vấn dữ liệu" ([03 — ch.4.2](../architecture/03-system-architecture.md)).

* **Hai biến thể:**

| Biến thể | Nội dung | Nút |
|---|---|---|
| **Thắng** (campaign) | Hoàn thành, số mistake đã dùng, hiệu ứng mở khóa level kế | "Level Tiếp Theo" (chính), "Chọn Level", "Chơi Lại" |
| **Thắng** (daily) | Hoàn thành, khối streak mới + phần thưởng Place Dog | "Về Menu" (chính) |
| **Thua** | Hết lượt sai | "Chơi Lại" (chính), "Chọn Level" / "Về Menu" |

"Chơi Lại" luôn tạo **một Puzzle Session mới** — session cũ không tái sử dụng ([11 — mục 2.1](../architecture/11-gameplay-system.md)).

## 3.3 Settings Popup

* **Mở khi:** nút Cài đặt trên Main Menu hoặc trên Pause Popup.
* **Đóng khi:** nút Đóng, hoặc Back Android.
* **Chặn input:** Có.
* **Đọc giá trị:** nhận giá trị hiện tại từ UIManager lúc mở (UIManager đọc `GameSettingsData` qua GameManager).
* **Ghi giá trị:** phát **`SettingsChangeRequestedEvent`**. GameManager nghe, cập nhật `GameSettingsData` (nó là chủ ghi duy nhất — [05 — ch.9](../architecture/05-data-model.md)), rồi phát `SettingsChangedEvent` để AudioManager và các UI khác đồng bộ.

> **Settings Popup KHÔNG gọi thẳng GameManager.** `ui/` bị cấm import `manager/` ([04 — mục 5](../architecture/04-folder-structure.md)). Mọi thay đổi đi qua Requested Event, đúng như `PauseRequestedEvent`.

* **Thành phần:** thanh âm lượng BGM, thanh âm lượng SFX. *(Không có mục ngôn ngữ — Localization ngoài phạm vi MVP.)*

## 3.4 Confirm Popup

* **Mở khi:** trước mọi hành động **không thể hoàn tác** khởi phát từ UI — Restart (mất tiến trình ván), Thoát giữa ván, Thoát app.
* **Đóng khi:** Đồng ý (thực thi hành động gốc) hoặc Hủy.
* **Chặn input:** Có.
* **Trạng thái:** không giữ gì — nhận một thông điệp + hai callback, tái sử dụng cho mọi tình huống.

## 3.5 How-to-play Popup

* **Mở khi:** tap nút **?** trên HUD (mục 5.2).
* **Đóng khi:** nút Đóng, hoặc Back Android.
* **Chặn input:** Có.
* **Trạng thái:** không có — thuần hiển thị luật chơi. Không nhận dữ liệu, không callback.
* **Mở qua `PopupController`**, không qua Event — pure UI, không ai ngoài UIManager quan tâm.

> Không có Popup riêng cho Daily Reward — nội dung nằm trong biến thể Thắng của Result Popup, tránh chồng hai popup liên tiếp.

---

# 4. Navigation Flow

## 4.1 Luồng chính

```
Boot
 ↓
Main Menu
 ↓ (nút Chơi)
Level Select
 ↓ (chọn level đã mở khóa)
Gameplay
 ↓ (Solved / Failed)
Result Popup
 ↓ (nút hành động)
Level Select  hoặc  Gameplay (level kế / chơi lại)  hoặc  Main Menu
```

## 4.2 Luồng "Tiếp tục" (ván đang dở)

**Đã chốt:** Boot **luôn** về Main Menu. Nếu `boardInProgress` khác rỗng, Main Menu hiện thêm thẻ **Tiếp tục**.

```
Boot → Main Menu
         │
         ├── có boardInProgress → hiện thẻ "Tiếp tục — Level N"
         │                          ↓ (tap)
         │                        Gameplay (resume đúng chỗ cũ)
         │
         └── không có → thẻ ẩn
```

**Vì sao không vào thẳng Gameplay:** giữ nguyên AppState machine hiện có (`Loading → MainMenu → Gameplay` đều hợp lệ; `Loading → Gameplay` thì không). Và quan trọng hơn — không ép người chơi quay lại đúng ván họ đang bế tắc và muốn bỏ; họ vẫn có thể đi chơi Daily hoặc chọn level khác.

**Snapshot daily hết hạn:** nếu ván dở là daily và ngày trong snapshot ≠ hôm nay, thẻ Tiếp tục **không hiện** — "sang ngày mới thì thay puzzle, không chơi bù" ([02 — mục 3](../vision/02-gameplay-loop.md)). GameManager đã xử lý việc này khi dựng session.

## 4.3 Luồng Daily Puzzle

```
Main Menu
 ↓ (tap thẻ Daily)
   đã hoàn thành hôm nay → KHÔNG đổi Screen; thẻ hiện "Đã xong ✔" + streak
   chưa hoàn thành ↓
Gameplay (context = daily)
 ↓ (Solved)
Result Popup (biến thể Thắng daily: streak + reward)
 ↓
Main Menu
```

Daily **không đi qua Level Select** — pool tách biệt hoàn toàn ([02 — mục 3](../vision/02-gameplay-loop.md)).

Daily **Fail** thì được Retry không giới hạn trong ngày — Result Popup (Thua) có nút "Chơi Lại".

## 4.4 Luồng Pause

```
Gameplay (Ready/Playing)
 ↓ (tap icon Pause  hoặc  Back Android)
Pause Popup
 │
 ├─ Resume ──────────────→ đóng Popup, về Gameplay
 ├─ Cài đặt ─────────────→ Settings Popup chồng lên Pause
 ├─ Restart → Confirm ───→ Đồng ý: gửi Intent Restart, đóng cả hai Popup
 │                          Hủy: về lại Pause Popup
 └─ Thoát → Confirm ─────→ Đồng ý: rời Screen
                            (campaign → Level Select; daily → Main Menu)
                            Hủy: về lại Pause Popup
```

## 4.5 Luồng Settings

Cùng **một** Settings Popup dùng ở cả Main Menu lẫn Pause Popup — không có hai bản riêng. Đóng lại thì về đúng chỗ cũ.

---

# 5. Gameplay HUD

Bố cục theo ảnh mẫu game tham chiếu.

## 5.1 Top Bar

| Thành phần | Hiển thị | Cập nhật khi |
|---|---|---|
| **Level Name** | Số level (campaign) hoặc "Daily Puzzle" | `PuzzleReadyEvent` (một lần) |
| **Hearts** | Dãy tim = số lượt sai còn lại (tim đầy còn mạng, tim rỗng đã mất). Thay cho chữ "3/3" — trực quan hơn | `PuzzleReadyEvent`, `MistakeChangedEvent`, `BoardRestartedEvent` |
| **Nút Cài đặt** | Icon bánh răng → mở Settings Popup qua `PopupController` | Tĩnh |

## 5.2 Hàng tiến trình (dưới Top Bar)

| Thành phần | Hiển thị | Cập nhật khi |
|---|---|---|
| **Thanh tiến trình chó** | Số chó đã đặt / tổng ("2/6") + thanh fill | `PuzzleReadyEvent`, `CellChangedEvent`, `PlaceDogUsedEvent`, `BoardRestartedEvent` |
| **Nút ?** | Mở How-to-play Popup (mục 3.5) | Tĩnh |

Số chó đếm lại từ trạng thái bàn (API chỉ đọc của session) mỗi lần thay đổi — bàn ≤ 121 ô nên chi phí không đáng, đổi lại không bao giờ lệch số.

## 5.3 Bottom Toolbar

| Thành phần | Hiển thị | Cập nhật khi |
|---|---|---|
| **Nút Hint** | Icon gợi ý + **số lượt còn lại**. Hint là vật phẩm có hạn ([11 — mục 7.2](../architecture/11-gameplay-system.md)) | `PuzzleReadyEvent` (giá trị đầu), `HintShownEvent` |
| **Nút Place Dog** | Icon + số lượt còn lại | `PuzzleReadyEvent` (giá trị đầu), `PlaceDogUsedEvent` |

**Không có nút Restart trên toolbar** — theo ảnh mẫu. Restart nằm trong Pause Popup (mục 4.4), đi qua Confirm.

## 5.4 Khung luật chơi

Khung tĩnh hiển thị 3 luật chính (1 chó mỗi màu, 1 chó mỗi hàng/cột, các chó không chạm nhau). **Chỉ hiển thị, không có tác vụ.** Ảnh do người dựng scene đặt.

## 5.5 Board Area

BoardView chiếm phần lớn không gian giữa Top Bar và Bottom Toolbar, tự co giãn theo N (4×4 → 11×11) mà **giữ ô vuông tuyệt đối** (mục 11).

**Quy tắc vẽ lại:**

* `PuzzleReadyEvent` → dựng lại **toàn bộ** board (kích thước N có thể đã đổi).
* `CellChangedEvent` → cập nhật **đúng một** CellView.
* `BoardRestartedEvent` → vẽ lại **toàn bộ** board một lần. Đây là lý do Restart cố tình phát một event cho cả bàn thay vì 121 `CellChangedEvent` ([11 — mục 7.3](../architecture/11-gameplay-system.md)).
* `HintShownEvent` → highlight nhóm (hàng/cột/vùng) trong payload; tự tắt sau vài giây hoặc sau nước đi kế tiếp.

**Ô khóa (pre-placed):** vẽ khác biệt rõ (nền mờ / viền riêng) và **không nhận gesture**. Danh sách ô khóa nằm trong payload `PuzzleReadyEvent`.

---

# 6. UI State

| Screen/Popup | Trạng thái |
|---|---|
| **Boot** | Loading (không tương tác) |
| **Main Menu** | Normal. Thẻ Daily có state con: "Khả dụng" / "Đã xong hôm nay". Thẻ Tiếp tục: "Hiện" / "Ẩn" |
| **Level Select** | Normal (truy vấn Progression là tức thời, không cần thanh loading) |
| **Gameplay** | Ánh xạ 1-1 với PuzzleState: Loading → Ready → Playing → Solved/Failed. UI khóa toàn bộ gesture board khi Solved/Failed |
| **Pause / Settings / Confirm Popup** | Normal, không có state con |
| **Result Popup** | Win / Lose (mục 3.2) |

**Disabled cục bộ** (không phải state của Screen): nút Place Dog khi hết lượt; toàn bộ HUD trong khoảnh khắc chuyển tiếp giữa Solved/Failed và lúc Result Popup mở hẳn.

---

# 7. UI Transition

| Chuyển tiếp | Hiệu ứng | Thời lượng |
|---|---|---|
| Đổi Screen (Main Menu ↔ Level Select) | Fade + Slide ngang nhẹ | 0.25s |
| Vào Gameplay | Fade | 0.3s |
| Mở Popup | Scale 0.9→1.0 + Fade | 0.2s |
| Đóng Popup | Scale 1.0→0.9 + Fade | 0.15s (nhanh hơn mở — cảm giác dứt khoát) |
| Cell → Dog | Scale nảy (pop) | 0.15s |
| Cell → Wrong Mark | Rung ngắn (shake) | 0.15s |
| Level mở khóa | Icon khóa biến mất + lấp lánh | 0.4s |

**Phân biệt đúng/sai bằng cả chuyển động, không chỉ màu sắc** — hỗ trợ người chơi khó phân biệt màu.

**Nhất quán:** mọi Popup dùng chung một cặp easing/thời lượng; mọi đổi Screen dùng chung một kiểu. Không Popup nào tự chọn hiệu ứng riêng.

Hiệu ứng mở khóa level chỉ chạy khi Level Select **đang mở** lúc nhận `LevelUnlockedEvent`; nếu không, lần sau mở ra thấy trạng thái mở khóa tĩnh, không phát lại.

---

# 8. Input Flow

Ranh giới đã chốt ở [11 — mục 4.1](../architecture/11-gameplay-system.md): UI chỉ làm **Gesture Detection** và quy đổi thành Intent; không suy luận đúng/sai.

| Input | Vùng | UI gửi đi |
|---|---|---|
| **Single Tap** trên ô | BoardView | Intent `ToggleMark` |
| **Double Tap** trên ô | BoardView | Intent `PlaceDogAttempt` |
| **Drag** qua nhiều ô | BoardView | Intent `DragMark` — **một** Intent cho cả cú kéo, kèm danh sách ô + chế độ |
| Tap icon Pause | Top Bar | `PauseRequestedEvent` |
| Tap Resume | Pause Popup | `ResumeRequestedEvent` |
| Tap Hint / Place Dog / Restart | Bottom Toolbar | Intent `ShowHint` / `UsePlaceDog` / `Restart` |
| Tap một ô level | Level Select | `LevelSelectedEvent` (context = campaign, levelId) |
| Tap thẻ Daily | Main Menu | `LevelSelectedEvent` (context = daily) |
| Kéo thanh âm lượng | Settings Popup | `SettingsChangeRequestedEvent` |

**Ngưỡng double tap và drag đọc từ `GameConfig`** — không hard-code trong UI ([11 — mục 4.1](../architecture/11-gameplay-system.md)).

**Chế độ Drag** xác định bởi ô **đầu tiên** của cú kéo: ô đó đang `Empty` → chế độ `mark`; đang `Mark` → chế độ `erase` ([11 — mục 4.3](../architecture/11-gameplay-system.md)). UI đọc trạng thái ô qua API chỉ đọc của session.

## 8.1 Back Android

| Đang ở | Hành vi |
|---|---|
| Popup bất kỳ đang mở | Đóng popup đó (tương đương nút Hủy/Đóng của nó) |
| Gameplay, không popup | Mở Pause Popup |
| Level Select | Về Main Menu |
| Main Menu | Confirm Popup hỏi thoát app |
| Boot | Vô hiệu hóa |

## 8.2 Khóa input board

UI khóa gesture trên BoardView khi:

* Có **bất kỳ Popup nào** đang mở.
* PuzzleState là **Solved / Failed**.

Gameplay cũng tự từ chối Intent trong hai trường hợp này ([11 — mục 4.4](../architecture/11-gameplay-system.md)) — nhưng UI vẫn phải khóa ở lớp mình, để không gửi Intent vô ích và không tạo log warning giả.

---

# 9. UI Layer

Từ dưới lên (layer trên vẽ đè layer dưới):

```
3. Block Input   (trong suốt — chặn tuyệt đối trong lúc chuyển tiếp)
2. Popup         (Pause / Result / Settings / Confirm)
1. Screen        (Main Menu / Level Select / Gameplay)
```

**Block Input trên cùng:** chặn mọi thao tác trong lúc Screen/Popup đang animate dở dang (mục 7), tránh bấm trúng nút chưa vào vị trí.

> **Cố tình KHÔNG có layer Toast và Tutorial.** MVP không có tính năng nào dùng đến chúng, và [03 — ch.1.8](../architecture/03-system-architecture.md) cấm tạo thành phần chỉ để phục vụ tính năng chưa có kế hoạch. Khi cần (ví dụ Toast cho lỗi mạng lúc làm Online Levels), chèn thêm layer là việc cục bộ — thứ tự ba layer trên không đổi.

---

# 10. UI Component Reuse

| Component | Dùng ở đâu |
|---|---|
| **PrimaryButton** | Mọi nút hành động chính: Chơi, Resume, Đồng ý, Level Tiếp Theo |
| **IconButton** | Pause, Hint, Place Dog, Restart, Back |
| **CounterView** | Mistake Counter **và** Place Dog Counter — cùng một component (icon + số), khác icon và nguồn Event |
| **DialogFrame** | Khung nền chung cho cả 4 Popup |
| **CellView** | Một ô board. Tối đa 121 instance (11×11), lấy từ **NodePool** — không instantiate/destroy mỗi lần vào màn |
| **BoardView** | Lưới CellView, dựng lại theo N mỗi `PuzzleReadyEvent` |
| **LevelCell** | Một ô Level Select — xem mục 10.1 |

## 10.1 Level Select: 617 level (quyết định hiệu năng)

**Đã chốt: cuộn vô hạn + tái sử dụng node (virtualization).**

* Một danh sách cuộn duy nhất 1 → 617.
* Chỉ dựng khoảng **30 `LevelCell`** — đủ phủ vùng khả kiến cộng một hàng đệm mỗi đầu.
* Khi cuộn, node ra khỏi màn được **tái sử dụng** cho ô mới, chỉ đổi nội dung (số level, trạng thái khóa/mở/xong). Không tạo, không hủy node trong lúc cuộn.
* Mở màn hình thì **tự cuộn tới level đang mở** — người chơi không phải tìm.

**Vì sao không dựng 617 node:** 617 Node × (Sprite + Label + Button) trên Android tầm trung là hàng nghìn component và hàng trăm draw call — chắc chắn giật khi cuộn và tốn memory vô ích. Đây là ràng buộc hiệu năng của [01 — mục 6](../vision/01-project-overview.md), không phải tối ưu sớm.

**Trạng thái mỗi ô** suy ra từ API chỉ đọc của `ProgressionSystem` (thuộc `gameplay/`, UI được phép import): đã hoàn thành / đang mở / còn khóa. **Không đọc `PlayerData` trực tiếp** ([03 — ch.8.2](../architecture/03-system-architecture.md)).

---

# 11. Responsive Rules

* **Safe Area:** mọi phần tử tương tác (Top Bar, Bottom Toolbar, Back) nằm trong safe area — tự né notch và thanh cử chỉ hệ thống.
* **Portrait only.** Landscape ngoài phạm vi MVP.
* **Dải tỷ lệ 16:9 → 20:9.** Top Bar và Bottom Toolbar neo theo cạnh (anchor top/bottom); Board Area lấp đầy khoảng giữa.
* **Board giữ ô vuông tuyệt đối:** co theo **cạnh ngắn hơn** của vùng khả dụng, scale đồng nhất cả hai trục. Không bao giờ scale X/Y riêng.
* **Tablet:** Board Area có **kích thước tối đa** — không phóng to vô hạn theo màn hình lớn; phần thừa hai bên để padding.
* **Vùng chạm tối thiểu:** kể cả CellView nhỏ nhất (khi N=11), **hit area lớn hơn sprite** nếu cần, để ngón tay chạm thoải mái.
* **Anchor, không toạ độ tuyệt đối:** mọi phần tử HUD dùng anchor theo cạnh tương ứng.

---

# 12. Asset Mapping

Khớp cấu trúc thư mục ở [04](../architecture/04-folder-structure.md). Mỗi Screen/Popup có đúng một Component trong `ui/screen/` hoặc `ui/popup/`, và một Prefab cùng tên.

| Screen/Popup | Prefab | Script |
|---|---|---|
| Main Menu | `prefabs/screen/MainMenuScreen.prefab` | `ui/screen/MainMenuScreen.ts` |
| Level Select | `prefabs/screen/LevelSelectScreen.prefab` | `ui/screen/LevelSelectScreen.ts` |
| Gameplay | `prefabs/screen/GameplayScreen.prefab` | `ui/screen/GameplayScreen.ts` |
| Pause | `prefabs/popup/PausePopup.prefab` | `ui/popup/PausePopup.ts` |
| Result | `prefabs/popup/ResultPopup.prefab` | `ui/popup/ResultPopup.ts` |
| Settings | `prefabs/popup/SettingsPopup.prefab` | `ui/popup/SettingsPopup.ts` |
| Confirm | `prefabs/popup/ConfirmPopup.prefab` | `ui/popup/ConfirmPopup.ts` |

| Component tái sử dụng | Prefab | Script |
|---|---|---|
| BoardView | `prefabs/board/Board.prefab` | `ui/board/BoardView.ts` |
| CellView | `prefabs/board/Cell.prefab` | `ui/board/CellView.ts` |
| LevelCell | `prefabs/widget/LevelCell.prefab` | `ui/widget/LevelCell.ts` |
| CounterView | `prefabs/widget/CounterView.prefab` | `ui/widget/CounterView.ts` |
| DialogFrame | `prefabs/widget/DialogFrame.prefab` | `ui/widget/DialogFrame.ts` |
| PrimaryButton / IconButton | `prefabs/widget/` | `ui/widget/` |

> **Bổ sung so với [04 — mục 2](../architecture/04-folder-structure.md):** `ConfirmPopup.prefab`, `LevelCell.prefab`, `CounterView.prefab`, `DialogFrame.prefab`, `PrimaryButton.prefab`, `IconButton.prefab`. Cây thư mục trong 04 liệt kê `MistakeCounterView` và `PlaceDogCounterView` riêng — nay gộp thành **một** `CounterView` dùng chung. Cần cập nhật 04.

---

# 13. UI Event Mapping

| UI | Lắng nghe |
|---|---|
| **UIManager** | `AppStateChangedEvent` (mở/đóng Screen), `PuzzleSolvedEvent`, `PuzzleFailedEvent`, `LevelUnlockedEvent`, `DailyRewardGrantedEvent` → gom dữ liệu, mở Result Popup |
| **GameplayScreen** (HUD) | `PuzzleReadyEvent`, `MistakeChangedEvent`, `PlaceDogUsedEvent` |
| **BoardView** | `PuzzleReadyEvent`, `CellChangedEvent`, `HintShownEvent`, `BoardRestartedEvent` |
| **LevelSelectScreen** | `LevelUnlockedEvent` |
| **MainMenuScreen** | `DailyRewardGrantedEvent` (cập nhật streak trên thẻ Daily) |
| **SettingsPopup** | `SettingsChangedEvent` (đồng bộ nếu đổi từ nơi khác) |
| **ResultPopup** | **Không lắng nghe Event nào** — nhận dữ liệu từ UIManager lúc mở (lý do ở mục 3.2) |

**UI phát ra:** `LevelSelectedEvent`, `PauseRequestedEvent`, `ResumeRequestedEvent`, `SettingsChangeRequestedEvent` — và các **Intent** gửi thẳng vào `PuzzleSession` qua `PuzzleSessionHolder`.

---

# 14. Quy tắc đặt tên UI

Khớp Naming Convention của CLAUDE.md, áp riêng cho UI:

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Screen | Tên chức năng + `Screen` | `MainMenuScreen`, `GameplayScreen` |
| Popup | Tên chức năng + `Popup` | `PausePopup`, `ConfirmPopup` |
| Prefab | Trùng tên Component gắn trên root Node | `ResultPopup.prefab` |
| Component tái sử dụng | Mô tả vai trò, không hậu tố Screen/Popup | `CellView`, `CounterView`, `DialogFrame` |
| Node trong Prefab | PascalCase, mô tả vai trò — **không** `Node1`, `Panel2` | `BtnResume`, `TxtMistakeCount`, `IconPlaceDog` |
| Button | Tiền tố `Btn` | `BtnPause`, `BtnRestart`, `BtnConfirmYes` |
| Animation Clip | Hành động + đối tượng, camelCase | `popupOpen`, `cellPlaceDogPop`, `cellWrongMarkShake` |
| Intent gửi từ UI | Trùng tên đã chốt ở [11 — mục 4.2](../architecture/11-gameplay-system.md) | `ToggleMark`, `PlaceDogAttempt` |

**Không dùng "Cat" ở bất kỳ đâu** — toàn bộ asset và mã nguồn dùng "Dog" thống nhất.

---

# 15. Những lỗi cần tránh

| Lỗi | Hậu quả |
|---|---|
| Screen/Popup import `manager/` hoặc `service/` | Vi phạm quy tắc phụ thuộc ([04 — mục 5](../architecture/04-folder-structure.md)); UI và luồng app dính chặt, thay UI phải sửa Manager |
| Popup tự nghe Event phát **đồng bộ** bởi handler khác | Bẫy thứ tự listener — popup chưa mở thì event đã bay qua, dữ liệu biến mất (chính xác lý do ResultPopup không nghe Event) |
| UI tự đổi `CellState` "cho phản hồi mượt" trước khi Gameplay xác nhận | Hai chủ ghi trên BoardData; hiển thị lệch luật chơi ([05 — ch.11](../architecture/05-data-model.md)) |
| Dựng đủ 617 `LevelCell` | Giật khi cuộn, phình memory trên Android tầm trung (mục 10.1) |
| `instantiate`/`destroy` CellView mỗi lần vào màn | Bỏ phí NodePool; GC dồn cục lúc vào màn |
| Hard-code ngưỡng double tap / drag trong UI | Không tune được; lệch với `GameConfig` mà Gameplay dùng |
| Phân biệt đúng/sai **chỉ** bằng màu | Người chơi khó phân biệt màu không chơi được (mục 7) |
| Đăng ký listener ở `onEnable` nhưng hủy ở `onDestroy` (popup pool) | Listener sống tiếp khi popup đã ẩn — đúng rủi ro "Event Listener rò rỉ" ([01 — mục 11](../vision/01-project-overview.md)) |
