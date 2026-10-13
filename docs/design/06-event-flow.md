# Dogdoku — Event Flow

> Chi tiết hóa cơ chế Event-Driven Architecture đã chốt ở [03-system-architecture.md](03-system-architecture.md) (chương 2, 3, 4) và [04-folder-structure.md](04-folder-structure.md) (mục 3.2, mục 5), dùng đúng model của [05-data-model.md](05-data-model.md). Tài liệu này **không** định nghĩa Event mới, không đổi luồng chơi, không đổi kiến trúc — chỉ trình bày lại theo góc nhìn "luồng" (flow) và bổ sung phần còn thiếu: kết quả sau khi nhận Event, quy tắc subscribe/unsubscribe cụ thể theo từng loại chủ thể, và checklist kiểm tra hệ thống Event.

---

# 1. Mục tiêu của Event System

**Vì sao dùng Event-Driven Architecture.** CLAUDE.md và 03 (ch.2, ch.3.1) đã chốt: Gameplay không được biết UI tồn tại; các tầng giao tiếp một chiều qua Event Bus. Event System là cơ chế **thực thi** quyết định đó — không có Event Bus, "Gameplay không biết UI" chỉ là khẩu hiệu, không phải điều có thể kiểm chứng trong code.

**Vai trò trong việc giảm coupling.** Event Bus cho phép nhiều module lắng nghe cùng một sự việc mà module phát ra không cần biết có bao nhiêu người đang nghe. Nhờ vậy:

* Thêm Subscriber mới (ví dụ Achievements — 03 ch.12) không sửa Gameplay Core.
* Thay UI không sửa Gameplay.
* Test Gameplay không cần dựng UI (03 ch.3.7).

**Quan hệ giữa Gameplay, UI, Manager và Service qua Event:**

| Tầng | Vai trò với Event |
|---|---|
| Gameplay | Phát Event, không phát tới ai cụ thể; không import UI/Manager/Service (04 — mục 5) |
| UI | Chỉ lắng nghe Event và gửi Intent/Requested Event; không import Data để ghi (05 — ch.1.4) |
| Manager | Cầu nối liên tầng — nghe Event từ Gameplay, tự phát Event mới cho UI/Manager khác khi cần điều phối (ví dụ GameManager nghe `PuzzleSolvedEvent`, phát `LevelUnlockedEvent`) |
| Service | Không phát Event. Chỉ được Manager gọi trực tiếp, trả kết quả qua giá trị hàm (03 — ch.6; `gameplay/` và `service/` không phụ thuộc nhau) |

---

# 2. Nguyên tắc thiết kế Event

Đã chốt ở 03 — ch.4.2, nhắc lại ngắn gọn để tra cứu:

* Kiểu dữ liệu rõ ràng — không dùng chuỗi tự do, không `any`.
* Tên ở thì quá khứ; Event do UI yêu cầu thêm hậu tố `Requested`.
* Payload bất biến, tối giản — cấm chứa Node/Component/tham chiếu engine.
* Event không dùng để truy vấn dữ liệu — không có Event "trả kết quả"; truy vấn đi qua API chỉ đọc.
* Không phát Event trong `update()` theo từng frame.

Bổ sung riêng cho góc nhìn Flow (nội dung mới của tài liệu này):

* **Mỗi flow có đúng một Intent khởi đầu.** Không flow nào bắt đầu bằng việc một hệ thống tự lắng nghe Event mà chính nó chuẩn bị phát ra ngay sau — tránh vòng lặp ngầm (xem mục 9).
* **Không dùng Event thay lời gọi hàm nội bộ cùng tầng.** Trong một Puzzle Session, Board System gọi thẳng Placement Check bằng lời gọi hàm bình thường; Event chỉ dùng khi thông tin cần vượt ranh giới tầng (03 — ch.2.7).
* **Trước khi thêm Event mới, tra danh mục ở mục 3.** Nếu một Event đã có đủ mô tả "việc gì xảy ra", dùng lại thay vì thêm biến thể.

---

# 3. Danh sách Event

13 Event chính thức của MVP (nguồn: 03 — ch.4.3), sắp xếp lại theo nhóm và bổ sung cột "điều gì xảy ra sau khi nhận".

## 3.1 Gameplay Events

Chỉ Gameplay (Puzzle Session và các hệ thống con) được phát nhóm này.

**PuzzleReadyEvent**
Ý nghĩa: Puzzle Session đã sẵn sàng, board đã dựng xong. Khi nào phát: Puzzle State chuyển Loading → Ready. Ai phát: Gameplay. Ai nghe: UI. Sau khi nhận: UI dựng BoardView theo kích thước + vùng màu, hiển thị trạng thái ô ban đầu (gồm ô pre-placed), HUD hiển thị mistake + số lượt Place Dog ban đầu. Payload **không bao giờ chứa PuzzleSolution** (05 — ch.11).

**CellChangedEvent**
Ý nghĩa: một ô vừa đổi trạng thái. Khi nào phát: sau Mark toggle, đặt Dog đúng, tạo Wrong Mark, hoặc Place Dog assist — không phát khi Restart (xem `BoardRestartedEvent`). Ai phát: Gameplay. Ai nghe: UI, AudioManager, SaveManager. Sau khi nhận: UI cập nhật đúng CellView (kèm lý do sai nếu là Wrong Mark); AudioManager phát SFX tương ứng; SaveManager lấy snapshot board mới nhất qua API công khai, cập nhật `boardInProgress`.

**MistakeChangedEvent**
Ý nghĩa: số mistake còn lại vừa đổi. Khi nào phát: ngay sau khi tạo Wrong Mark. Ai phát: Gameplay. Ai nghe: UI, AudioManager. Sau khi nhận: UI cập nhật widget đếm mistake; AudioManager có thể phát cảnh báo riêng khi về 0 (tùy thiết kế âm thanh, không bắt buộc).

**PlaceDogUsedEvent**
Ý nghĩa: người chơi vừa dùng một lượt Place Dog. Khi nào phát: ngay sau khi Assist System đặt xong Dog. Ai phát: Gameplay. Ai nghe: UI, **GameManager**, SaveManager. Sau khi nhận: UI cập nhật widget đếm lượt + hiệu ứng ô vừa đặt; GameManager trừ 1 khỏi `inventory` trong PlayerData (05 — ch.9: GameManager là chủ ghi duy nhất của inventory); SaveManager cập nhật snapshot.
> *Bổ sung so với 03 — ch.4.3:* bảng gốc chỉ ghi "UI, SaveManager". GameManager phải nghe Event này vì 05 xác nhận việc trừ lượt nằm ở GameManager, không tự động xảy ra.

**HintShownEvent**
Ý nghĩa: một gợi ý vừa được tính ra, kèm số lượt hint còn lại. Khi nào phát: sau khi Assist System suy ra nhóm cần highlight (và trừ lượt nếu có gợi ý). Ai phát: Gameplay. Ai nghe: UI, **GameManager**. Sau khi nhận: UI highlight hàng / cột / vùng + cập nhật số lượt hint trên HUD; GameManager đồng bộ `inventory.hintCharges` rồi persist.
> *Ghi chú:* Hint là **vật phẩm có hạn** (11 — mục 7.2). Lượt là inventory toàn cục (như Place Dog), KHÔNG phải state của bàn — nên BoardSaveData vẫn không chứa dữ liệu hint (05 — ch.4.3). SaveManager không nghe Event này để tránh bẫy thứ tự; GameManager persist tường minh (08 — mục 2.2).

**BoardRestartedEvent**
Ý nghĩa: board vừa được đưa về trạng thái ban đầu. Khi nào phát: ngay sau khi Assist System xử lý xong Intent Restart. Ai phát: Gameplay. Ai nghe: UI, SaveManager. Sau khi nhận: UI vẽ lại board trắng, đưa HUD về ban đầu; SaveManager cập nhật snapshot (lượt Place Dog đã dùng **không** hoàn lại — 03 ch.11 quyết định #9).

**PuzzleSolvedEvent**
Ý nghĩa: puzzle vừa hoàn thành đúng luật. Khi nào phát: Puzzle State chuyển Playing → Solved. Ai phát: Gameplay. Ai nghe: GameManager, UIManager, AudioManager, SaveManager. Sau khi nhận: xem chi tiết ở luồng 4.9.

**PuzzleFailedEvent**
Ý nghĩa: puzzle thất bại vì hết lượt sai. Khi nào phát: Puzzle State chuyển Playing → Failed. Ai phát: Gameplay. Ai nghe: GameManager, UIManager, AudioManager, SaveManager. Sau khi nhận: xem chi tiết ở luồng 4.8.

## 3.2 UI Events

Hậu tố `Requested` — chỉ UI được phát nhóm này.

**LevelSelectedEvent (Requested)**
Ý nghĩa: người chơi chọn một level hoặc Daily. Khi nào phát: tap level trong Level Select, hoặc tap nút Daily. Ai phát: UI. Ai nghe: GameManager. Sau khi nhận: GameManager chuyển AppState sang Gameplay, tải đúng puzzle, tạo Puzzle Session mới.

**PauseRequestedEvent**
Ý nghĩa: người chơi muốn tạm dừng. Khi nào phát: tap icon Pause. Ai phát: UI. Ai nghe: GameManager. Sau khi nhận: xem luồng 4.14.

**ResumeRequestedEvent**
Ý nghĩa: người chơi muốn tiếp tục. Khi nào phát: tap nút Resume trên Pause Popup. Ai phát: UI. Ai nghe: GameManager. Sau khi nhận: xem luồng 4.15.

**NavigateRequestedEvent**
Ý nghĩa: người chơi muốn sang một màn hình khác. Khi nào phát: nút Chơi (→ LevelSelect), nút Back (→ MainMenu), nút Thoát trên Pause Popup. Ai phát: UI. Ai nghe: GameManager. Sau khi nhận: GameManager kiểm tra transition có hợp lệ không rồi đổi AppState; nếu rời Gameplay thì hủy Puzzle Session.
> *Vì sao cần:* UI không tự chuyển màn hình (03 — ch.8.2). Không có Event này thì Level Select và nút Back buộc phải gọi thẳng GameManager, mà `ui/` bị cấm import `manager/`.

**SettingsChangeRequestedEvent**
Ý nghĩa: người chơi muốn đổi một giá trị settings. Khi nào phát: kéo thanh âm lượng trên Settings Popup. Ai phát: UI. Ai nghe: GameManager. Sau khi nhận: GameManager cập nhật `GameSettingsData` (nó là chủ ghi duy nhất — 05 ch.9) rồi phát `SettingsChangedEvent`.
> *Vì sao cần Event này thay vì để UI gọi thẳng GameManager:* `ui/` bị cấm import `manager/` (04 — mục 5). Không có Event này thì Settings Popup buộc phải vi phạm quy tắc phụ thuộc.

## 3.3 Manager Events

Trong 6 manager, **chỉ GameManager** phát Event của riêng nhóm này (5 manager còn lại chỉ Subscribe — xem mục 5).

**AppStateChangedEvent**
Ý nghĩa: AppState vừa chuyển. Khi nào phát: mọi lần AppState machine chuyển hợp lệ (02 — mục 7). Ai phát: GameManager. Ai nghe: UIManager, SceneManager, AudioManager. Sau khi nhận: UIManager mở/đóng đúng screen hoặc overlay; SceneManager chuyển scene nếu cần (hiếm — chỉ Boot → Main trong MVP); AudioManager đổi nhạc nền nếu thiết kế âm thanh yêu cầu.

**SettingsChangedEvent**
Ý nghĩa: một giá trị settings vừa đổi. Khi nào phát: sau khi GameManager cập nhật `GameSettingsData`. Ai phát: GameManager. Ai nghe: AudioManager, SaveManager. Sau khi nhận: AudioManager áp dụng âm lượng mới ngay; SaveManager lưu.

## 3.4 Save Events

**Nhóm này không có Event nào.** SaveManager chỉ Subscribe (mục 3.1, 3.3), không bao giờ tự phát Event — hoàn thành trách nhiệm "điều phối lưu" chỉ bằng cách nghe Event đã có sẵn (03 — ch.5.1). Không tạo Event rỗng để lấp đầy nhóm này.

## 3.5 Progression Events

**LevelUnlockedEvent**
Ý nghĩa: một level campaign vừa được mở khóa. Khi nào phát: ngay sau `PuzzleSolvedEvent` với context campaign, khi GameManager xác nhận có level mới mở. Ai phát: GameManager. Ai nghe: UI, SaveManager. Sau khi nhận: UI (Level Select) mở khóa ô level tương ứng; SaveManager lưu nhánh `progression`.
Ghi chú sở hữu: Progression (Gameplay) là chủ ghi duy nhất của `LevelProgressData` (05 — ch.9); GameManager không tự ghi dữ liệu, chỉ đọc qua API công khai rồi phát Event thông báo ra ngoài Gameplay — xem giải thích đầy đủ ở luồng 4.19.

## 3.6 Daily Puzzle Events

**DailyRewardGrantedEvent**
Ý nghĩa: phần thưởng Daily vừa được cấp. Khi nào phát: ngay sau khi DailyPuzzleService cập nhật streak. Ai phát: GameManager. Ai nghe: UI, SaveManager. Sau khi nhận: UI hiện thông báo thưởng + streak mới; GameManager cộng lượt Place Dog vào `inventory`; SaveManager lưu nhánh `daily` + `inventory`.

## 3.7 Audio Events

**Nhóm này không có Event nào.** AudioManager chỉ Subscribe các Event ở 3.1 và 3.3 (`CellChangedEvent`, `MistakeChangedEvent`, `PuzzleSolvedEvent`, `PuzzleFailedEvent`, `AppStateChangedEvent`, `SettingsChangedEvent`) — đúng quy tắc "bị gọi trực tiếp từ Gameplay là sai; chỉ nghe Event" (03 — ch.5.1).

---

# 4. Event Flow

Mỗi luồng dùng sơ đồ ASCII dạng cột dọc, mũi tên biểu diễn thứ tự thời gian.

## 4.1 Khởi động game

```text
Boot Scene
↓
EventManager sẵn sàng
↓
ResourceManager preload asset lõi
↓
SaveManager đọc SaveData qua SaveService
↓
data/ kiểm tra version, chạy migration nếu cần → PlayerData
↓
AudioManager áp dụng GameSettingsData (âm lượng)
↓
GameManager khởi tạo AppState, kiểm tra boardInProgress
↓
SceneManager chuyển Main Scene
↓
GameManager phát AppStateChangedEvent (Boot → MainMenu)
↓
UIManager mở Main Menu
```

Nếu `boardInProgress` khác rỗng, GameManager có thể đưa AppState tới Gameplay thay vì Main Menu. Cách xử lý cụ thể (tự vào thẳng hay hỏi lại người chơi) là quyết định UX, không thuộc phạm vi tài liệu này.

## 4.2 Chọn Level

```text
UI (Level Select) — người chơi tap một level
↓
UI phát LevelSelectedEvent [Requested] (levelId)
↓
GameManager nhận, chuyển AppState → Gameplay
↓
GameManager gọi PuzzleProvider theo levelId → PuzzleData
↓
GameManager tạo Puzzle Session mới, truyền PuzzleData vào
```

Tiếp diễn ở 4.3.

## 4.3 Load Puzzle

```text
Puzzle Session nhận PuzzleData
↓
Board System dựng BoardData
  — mới: toàn Empty, rồi áp ô pre-placed (Dog/Mark đặt sẵn, khóa)
  — hoặc restore từ BoardSaveData nếu đang resume
    (tập ô khóa dựng lại từ PuzzleData, không lấy từ snapshot — 05 ch.4.3)
↓
Puzzle State: Loading → Ready
↓
Gameplay phát PuzzleReadyEvent (puzzleId, kích thước, trạng thái board)
↓
UI dựng BoardView + HUD ban đầu
```

## 4.4 Tap Cell

```text
UI (gesture detection trên BoardView) nhận Single Tap
↓
UI gửi Intent: ToggleMark (vị trí ô)
↓
Board System: Empty ↔ Mark
↓
Gameplay phát CellChangedEvent (vị trí, trạng thái mới)
↓
UI cập nhật CellView  |  AudioManager phát SFX  |  SaveManager cập nhật snapshot
```

## 4.5 Double Tap đặt Dog

```text
UI (gesture detection) nhận Double Tap
↓
UI gửi Intent: PlaceDogAttempt (vị trí ô)
↓
Puzzle Session chuyển cho Placement Check
↓
So vị trí với PuzzleSolution
↓
   khớp → 4.6 Đặt đúng          không khớp → 4.7 Đặt sai
```

## 4.6 Đặt đúng

```text
Placement Check: vị trí khớp Solution
↓
Board System: ô → Dog (thay Mark nếu có)
↓
Gameplay phát CellChangedEvent (trạng thái mới: Dog)
↓
Puzzle State Machine kiểm tra: đủ N Dog chưa?
↓
   chưa đủ → tiếp tục Playing     đủ → 4.9 Hoàn thành Puzzle
```

## 4.7 Đặt sai

```text
Placement Check: vị trí không khớp Solution
↓
Board System: ô → Wrong Mark (kèm lý do sai từ RegionData)
↓
Gameplay phát CellChangedEvent (trạng thái mới: Wrong Mark, lý do)
↓
Mistake Counter − 1
↓
Gameplay phát MistakeChangedEvent (số lượt còn lại)
↓
Puzzle State Machine kiểm tra: Mistake = 0?
↓
   còn lượt → tiếp tục Playing     hết lượt → 4.8 Sai đủ 3 lần
```

## 4.8 Sai đủ 3 lần

```text
Mistake Counter = 0
↓
Puzzle State: Playing → Failed (khóa mọi Intent tiếp theo)
↓
Gameplay phát PuzzleFailedEvent (puzzleId, context)
↓
GameManager: gỡ boardInProgress (ván kết thúc)
UIManager: mở Result Popup (thua, có Retry)
AudioManager: phát SFX/nhạc thua
SaveManager: lưu kết quả cuối
```

## 4.9 Hoàn thành Puzzle

```text
Đủ N Dog đặt đúng
↓
Puzzle State: Playing → Solved (khóa mọi Intent tiếp theo)
↓
Gameplay phát PuzzleSolvedEvent (puzzleId, context)
↓
  context = campaign                      context = daily
  ↓                                        ↓
GameManager hỏi API đọc của Progression   GameManager gọi DailyPuzzleService
— level nào vừa mở khóa                    cập nhật streak
  ↓                                        ↓
GameManager phát LevelUnlockedEvent       GameManager phát DailyRewardGrantedEvent
  (chi tiết ở 4.19)                         (chi tiết ở 4.18)
↓ (cả hai nhánh)
UIManager: mở Result Popup (thắng)
AudioManager: phát SFX/nhạc thắng
SaveManager: gỡ boardInProgress, lưu kết quả cuối
```

## 4.10 Restart

```text
UI (nút Restart) gửi Intent: Restart
↓
Board System: xóa Dog/Mark/Wrong Mark do NGƯỜI CHƠI điền → Empty
             giữ nguyên ô pre-placed (02 — mục 1.1)
Mistake Counter → 3/3
↓
Gameplay phát BoardRestartedEvent (puzzleId)
↓
UI vẽ lại board trắng, đưa HUD về ban đầu
SaveManager cập nhật snapshot
```

Lượt Place Dog đã dùng **không** hoàn lại (03 — ch.11, quyết định #9 — chặn khai thác dùng lượt để biết đáp án rồi Restart lấy lại).

## 4.11 Undo

```text
(không tồn tại trong MVP)
```

Undo đã bị loại khỏi kiến trúc từ 03 — ch.11 (quyết định #2): Dog đặt luôn đúng và Mark toggle chỉ bằng một chạm khiến Undo không còn giá trị sử dụng — trade-off được ghi nhận là "người chơi muốn làm lại dùng Restart". Vì vậy: không có Intent Undo, không có Event Undo. Mục này giữ nguyên trong tài liệu để trả lời trực tiếp mục 4 của đề cương, đồng thời giữ đúng phạm vi đã chốt — không thêm luồng cho một tính năng không tồn tại.

## 4.12 Hint

```text
UI (nút Hint) gửi Intent: ShowHint
↓
Assist System kiểm tra lượt hint của session
↓
   hết lượt → từ chối, không phát gì thêm
   còn lượt ↓
Suy ra gợi ý từ (PuzzleSolution + trạng thái board):
tìm hàng / cột / vùng chỉ còn đúng một ô khả dĩ
↓
   có gợi ý  → trừ 1 lượt
   không có  → không trừ (gợi ý rỗng, không tính phí)
↓
Gameplay phát HintShownEvent (nhóm cần highlight, số lượt còn lại)
↓
UI highlight nhóm + cập nhật số lượt trên HUD
GameManager đồng bộ inventory.hintCharges rồi persist
```

Hint **không đặt Dog hộ** (khác Place Dog — 4.13). Lượt hint là inventory toàn cục, không phải state của bàn — nên board snapshot không đổi.

## 4.13 Place Dog

```text
UI (nút Place Dog) gửi Intent: UsePlaceDog
↓
Assist System kiểm tra lượt khả dụng của session
↓
   hết lượt → từ chối, không phát gì thêm
   còn lượt ↓
Chọn 1 vị trí đúng chưa đặt trong PuzzleSolution
↓
Board System: ô → Dog (dùng chung cơ chế với 4.6)
↓
Gameplay phát CellChangedEvent + PlaceDogUsedEvent (vị trí, lượt còn lại)
↓
UI cập nhật CellView + widget đếm lượt
GameManager (nghe PlaceDogUsedEvent) trừ 1 khỏi inventory
SaveManager cập nhật snapshot
↓
Puzzle State Machine kiểm tra đủ N Dog như 4.6 (có thể dẫn tới 4.9)
```

## 4.14 Pause

```text
UI (icon Pause trên HUD) phát PauseRequestedEvent
↓
GameManager chuyển AppState (Gameplay → mở overlay Pause)
↓
GameManager phát AppStateChangedEvent
↓
UIManager mở Pause Popup
AudioManager giảm nhạc nền (tùy thiết kế âm thanh)
```

Puzzle State Machine không đổi — Pause chỉ là khái niệm AppState; Gameplay không biết về Pause (02 — mục 7, 03 — ch.3.6).

## 4.15 Resume

```text
UI (nút Resume trên Pause Popup) phát ResumeRequestedEvent
↓
GameManager chuyển AppState (đóng overlay Pause)
↓
GameManager phát AppStateChangedEvent
↓
UIManager đóng Pause Popup
AudioManager khôi phục âm lượng
```

## 4.16 Save

```text
Bất kỳ Event nào trong nhóm:
CellChangedEvent | MistakeChangedEvent | PlaceDogUsedEvent
BoardRestartedEvent | PuzzleSolvedEvent | PuzzleFailedEvent
LevelUnlockedEvent | DailyRewardGrantedEvent | SettingsChangedEvent

(HintShownEvent KHÔNG do SaveManager nghe — GameManager cập nhật inventory.hintCharges
 rồi persist tường minh, tránh bẫy thứ tự handler; xem 3.1)
↓
SaveManager (đang lắng nghe) lấy dữ liệu mới nhất
  — board: qua API công khai của Puzzle Session
  — nhánh khác: từ PlayerData đã được Manager/Service cập nhật
↓
Gắn vào document PlayerData trong bộ nhớ
↓
data/ serialize toàn bộ SaveData (kèm version)
↓
SaveService ghi xuống storage — nguyên tử, một lần
```

Save không phải hành động riêng của người chơi — là phản ứng đứng sau gần như mọi flow khác (02 — mục 9.1). Đây là lý do "Save Events" ở mục 3.4 không có Event riêng: bản thân việc save luôn được kích hoạt bởi Event của module khác.

## 4.17 Load

```text
(là bước 3 trong luồng Khởi động game — 4.1)
SaveService đọc SaveData từ storage
↓
data/: kiểm tra version → chạy migration tuần tự tới bản mới nhất nếu cần
↓
SaveManager nhận PlayerData đã migrate, giữ instance duy nhất
```

Không có Event riêng cho Load — đây là thao tác nội bộ của SaveManager lúc Boot, không phải phản ứng theo Event.

## 4.18 Daily Puzzle

```text
UI (nút Daily) phát LevelSelectedEvent [Requested] (daily)
↓
GameManager gọi DailyPuzzleService
↓
   đã hoàn thành hôm nay → không vào Gameplay,
                            UI hiện trạng thái "đã xong" + streak
   chưa hoàn thành ↓
DailyPuzzleService chọn puzzleId theo seed ngày
↓
(tiếp diễn như 4.3 Load Puzzle, context = daily)
...
↓ (khi Solved — nhánh daily của 4.9)
DailyPuzzleService cập nhật streak + ngày hoàn thành gần nhất
↓
GameManager phát DailyRewardGrantedEvent (phần thưởng, streak mới)
↓
UI hiện thông báo thưởng
GameManager cộng lượt Place Dog vào inventory
SaveManager lưu nhánh daily + inventory
```

## 4.19 Unlock Level

```text
(nhánh của 4.9 khi context = campaign)
Progression (Gameplay) đã ghi levelId vừa hoàn thành vào LevelProgressData
↓
GameManager hỏi API chỉ đọc của Progression — level nào vừa mở khóa?
↓
GameManager phát LevelUnlockedEvent (levelId)
↓
UI (Level Select) mở khóa ô level tương ứng
SaveManager lưu nhánh progression
```

Progression là chủ ghi duy nhất của `LevelProgressData` (05 — ch.9); GameManager không tự ghi, chỉ đọc rồi phát Event thông báo ra ngoài Gameplay.

---

# 5. Event Ownership

**Chỉ Gameplay được phát** (việc đã xảy ra trong luật chơi):
`PuzzleReadyEvent`, `CellChangedEvent`, `MistakeChangedEvent`, `PlaceDogUsedEvent`, `HintShownEvent`, `BoardRestartedEvent`, `PuzzleSolvedEvent`, `PuzzleFailedEvent`.

**Chỉ UI được phát** (yêu cầu từ người chơi, hậu tố Requested):
`LevelSelectedEvent`, `NavigateRequestedEvent`, `PauseRequestedEvent`, `ResumeRequestedEvent`, `SettingsChangeRequestedEvent`.

**Chỉ GameManager được phát** (trong 6 manager, GameManager là manager duy nhất phát Event):
`AppStateChangedEvent`, `LevelUnlockedEvent`, `DailyRewardGrantedEvent`, `SettingsChangedEvent`.

**Chỉ Subscribe, không bao giờ phát Event của riêng mình:**
UIManager, AudioManager, SaveManager, SceneManager, ResourceManager. Đây không phải thiếu sót — 5 manager này hoàn thành trách nhiệm chỉ bằng cách lắng nghe Event đã có sẵn, đúng tinh thần "mỗi manager một trách nhiệm, không tự ý mở rộng" của CLAUDE.md.

---

# 6. Quy tắc Subscribe / Unsubscribe

Nguyên tắc gốc ở 03 — ch.4.4, áp dụng cụ thể cho từng loại chủ thể trong dự án:

| Chủ thể | Đăng ký lúc nào | Hủy lúc nào | Ghi chú |
|---|---|---|---|
| 6 Manager (singleton, sống toàn app) | Một lần lúc Boot (`onLoad`) | Không hủy — sống tới khi thoát app | MVP chỉ boot một lần, không có vòng đời "tạo lại" |
| Puzzle Session | Lúc khởi tạo, nhận PuzzleData | Lúc chuyển sang Disposed | Hủy toàn bộ listener của chính nó bằng một lệnh (03 — ch.4.4), không hủy rải rác từng cái |
| Popup (Pause / Result / Settings) | `onEnable` — popup dùng lại instance qua pool, không tạo Node mỗi lần hiện | `onDisable` | Cặp `onEnable`/`onDisable`, **không phải** `onLoad`/`onDestroy`, vì popup chỉ ẩn/hiện chứ không hủy Node |
| BoardView / CellView | `onLoad`, khi Puzzle Session tạo | `onDestroy`, đồng thời với Puzzle Session Disposed | Không tồn tại độc lập với Puzzle Session |
| Scene unload | — | — | MVP chỉ có 2 scene (Boot, Main — 03 ch.5.3); unload chỉ xảy ra đúng một lần lúc Boot → Main, không phải cơ chế lặp lại cần xử lý riêng |

Quy tắc chống rò rỉ bổ sung: mọi đăng ký gắn định danh chủ thể, cho phép hủy toàn bộ bằng một lệnh thay vì liệt kê từng listener (03 — ch.4.4) — bắt buộc áp dụng cho Puzzle Session vì nhiều hệ thống con (Board, Validation, Assist, State, Progression) cùng đăng ký.

---

# 7. Dependency Rules — Gameplay → Event → UI

Nếu Gameplay gọi thẳng UI:

```text
Gameplay
↓ (gọi trực tiếp hàm của UI)
UI
```

Hậu quả: Gameplay phải import kiểu của UI → không biên dịch/test được nếu thiếu UI (03 — ch.3.7); mỗi UI mới phải sửa code Gameplay; luật chơi và cách hiển thị dính chặt vào nhau — vi phạm "Gameplay không được biết UI tồn tại" (CLAUDE.md).

Kiến trúc dự án dùng:

```text
Gameplay
↓ (phát Event, không biết ai đang nghe)
Event Bus
↓ (bất kỳ ai đăng ký đều nhận được)
UI, AudioManager, SaveManager, ...
```

Vì sao luồng này giải quyết đúng vấn đề trên:

1. **Gameplay không cần biết UI tồn tại** — biên dịch và test được chỉ với Event Bus, đúng tiêu chí "test bằng cách gửi Intent trực tiếp, không cần dựng UI" (03 — ch.3.7).
2. **Một Event, nhiều người nghe mà Gameplay không cần sửa** — `CellChangedEvent` đồng thời phục vụ UI, AudioManager, SaveManager; thêm Achievements sau này chỉ là thêm một Subscriber mới (03 — ch.12), không đụng dòng nào trong Gameplay.
3. **Thay UI không ảnh hưởng luật chơi** — đổi giao diện, hoạt ảnh, miễn UI mới tiếp tục lắng nghe đúng Event thì Gameplay giữ nguyên.

Đây chính là quy tắc phụ thuộc một chiều đã chốt ở 03 — ch.2.7 và 04 — mục 5: Gameplay chỉ được phụ thuộc `event/`, không bao giờ phụ thuộc `ui/`.

---

# 8. Best Practices

Đã chốt ở 03 — ch.4.2 (nhắc lại ngắn gọn):

* Một Event chỉ mang một ý nghĩa, đặt tên ở thì quá khứ.
* Payload tối giản, bất biến, không tham chiếu engine.
* Không dùng Event để truy vấn dữ liệu.
* Không phát Event trong `update()` theo từng frame.

Bổ sung riêng cho thiết kế Flow (nội dung mới của tài liệu này):

* **Mỗi flow có đúng một Intent khởi đầu** — không flow nào bắt đầu bằng cách một hệ thống tự lắng nghe Event mà chính nó sắp phát ra (xem mục 9, "Event vòng lặp").
* **Không dùng Event thay lời gọi hàm nội bộ cùng tầng** — dùng khi và chỉ khi thông tin cần vượt ranh giới tầng (03 — ch.2.7); giao tiếp nội bộ cùng tầng dùng lời gọi hàm bình thường.
* **Tra danh mục ở mục 3 trước khi thêm Event mới** — nếu một Event đã có đủ mô tả sự việc, dùng lại thay vì thêm biến thể.

---

# 9. Những lỗi cần tránh

| Lỗi | Ví dụ cụ thể trong dự án | Hậu quả |
|---|---|---|
| Gameplay gọi UI trực tiếp | Board System tự gọi hàm vẽ lại CellView thay vì phát `CellChangedEvent` | Mất khả năng test Gameplay không cần engine (03 — ch.3.7) |
| UI sửa Data trực tiếp | BoardView tự đổi CellState "cho mượt" trước khi Gameplay xác nhận | Hai chủ ghi trên BoardData, hiển thị lệch luật chơi (chi tiết hậu quả đã nêu ở 05 — ch.11) |
| Manager gọi chéo nhau | AudioManager tự gọi SaveManager để lưu ngay sau khi phát xong SFX | Phá quy tắc "thông báo giữa manager đi qua Event" (03 — ch.5.2), tạo phụ thuộc ẩn khó debug |
| Event trùng chức năng | Thêm `DogPlacedEvent` riêng bên cạnh `CellChangedEvent` đã có | Hai nơi cùng mô tả một sự thật — Subscriber không biết nghe cái nào, dễ lệch dữ liệu |
| Event vòng lặp | SaveManager, sau khi lưu xong, phát một Event mà Gameplay lắng nghe rồi đổi BoardData, khiến `CellChangedEvent` phát lại | Vòng lặp vô hạn hoặc lưu liên tục không cần thiết — Event là kênh một chiều "thông báo", không phải kênh hai chiều |
| Subscribe nhưng quên Unsubscribe đúng cặp | Popup đăng ký ở `onEnable` nhưng hủy bằng `onDestroy` trong khi popup chỉ ẩn (`onDisable`), không hủy Node | Listener cũ vẫn tồn tại sau khi popup ẩn, xử lý Event trên popup đã ẩn — đúng rủi ro "Event Listener bị rò rỉ" (01 — mục 11) |
| Event quá lớn | Payload `PuzzleSolvedEvent` kèm toàn bộ BoardData hoặc PuzzleSolution | Vi phạm payload tối giản (03 — ch.4.2); lộ đáp án ra ngoài Gameplay (rủi ro đã nêu ở 05 — ch.11) |

---

# 10. Checklist

☐ Gameplay không import `ui/`, `manager/`, `service/` (04 — mục 5)
☐ UI không ghi bất kỳ Data Model nào — chỉ gửi Intent hoặc Requested Event (05 — ch.9)
☐ Không có phụ thuộc vòng giữa các tầng (03 — ch.2.7)
☐ Mọi Event đều có đúng một nơi phát
☐ Mọi Event đều có ít nhất một nơi lắng nghe — nếu không, cân nhắc bỏ Event đó
☐ Không có hai Event mô tả cùng một sự việc
☐ Mọi đăng ký lắng nghe có nơi hủy đối xứng theo đúng vòng đời chủ thể (mục 6)
☐ Payload không chứa Node, Component hay tham chiếu engine
☐ Không có Event nào phát bên trong `update()`
☐ Có thể thêm Subscriber mới (ví dụ Achievements) mà không sửa Gameplay Core (03 — ch.12)