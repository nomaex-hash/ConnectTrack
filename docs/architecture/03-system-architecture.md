
# Kiến trúc Hệ thống

---

# 1. Mục tiêu của kiến trúc

Tài liệu này mô tả kiến trúc tổng thể của dự án **Dogdoku**, bao gồm cách tổ chức các module, quy tắc phụ thuộc giữa các thành phần và trách nhiệm của từng hệ thống.

Kiến trúc được thiết kế nhằm phục vụ mục tiêu phát triển lâu dài, đảm bảo dự án có thể mở rộng và bảo trì dễ dàng mà không làm ảnh hưởng đến các hệ thống đã hoàn thiện.

Trong phạm vi MVP, kiến trúc phải đáp ứng các mục tiêu sau:

## 1.1 Gameplay độc lập với giao diện

Toàn bộ luật chơi, trạng thái bàn cờ và logic xử lý puzzle phải nằm trong **Gameplay Core**.

UI chỉ có nhiệm vụ:

* Hiển thị dữ liệu.
* Nhận thao tác của người chơi.
* Gửi yêu cầu tới Gameplay.

Gameplay không được phụ thuộc vào bất kỳ thành phần giao diện nào.

Điều này giúp:

* Dễ kiểm thử.
* Dễ bảo trì.
* Có thể thay đổi giao diện mà không ảnh hưởng gameplay.

---

## 1.2 Tách biệt dữ liệu và xử lý

Dữ liệu chỉ lưu trữ trạng thái.

Logic xử lý dữ liệu phải nằm trong Gameplay hoặc Service.

Ví dụ:

* `LevelConfig` chỉ mô tả puzzle.
* `PlayerData` chỉ lưu tiến trình.
* `BoardSaveData` chỉ lưu trạng thái bàn chơi.

Không để Data Model chứa logic gameplay.

---

## 1.3 Kiến trúc hướng sự kiện (Event-Driven)

Các hệ thống giao tiếp với nhau thông qua Event.

Gameplay không được gọi trực tiếp:

* UIManager
* AudioManager
* SaveManager

Thay vào đó:

1. Gameplay phát Event.
2. Các hệ thống liên quan tự lắng nghe và xử lý.

Ví dụ:

```text
Đặt Dog thành công

↓

Gameplay phát CellChangedEvent

↓

BoardView cập nhật giao diện

↓

AudioManager phát âm thanh

↓

SaveManager lưu dữ liệu
```

Gameplay không cần biết những hệ thống nào đang lắng nghe Event.

---

## 1.4 Mỗi hệ thống chỉ có một trách nhiệm

Mỗi Manager, Service hoặc System chỉ đảm nhiệm một nhiệm vụ duy nhất.

Ví dụ:

* GameManager quản lý vòng đời trò chơi.
* SaveManager quản lý lưu dữ liệu.
* AudioManager quản lý âm thanh.
* UIManager quản lý giao diện.

Không để một lớp vừa xử lý gameplay, vừa điều khiển UI, vừa lưu dữ liệu.

---

## 1.5 Dễ mở rộng

Kiến trúc phải cho phép bổ sung các tính năng trong tương lai mà không cần thay đổi Gameplay Core.

Các tính năng dự kiến gồm:

* Puzzle Generator.
* Online Level.
* Cloud Save.
* Theme/Skin.
* Achievement.
* Analytics.
* LiveOps.

Những tính năng này sẽ được bổ sung thông qua các Service hoặc Module mới, thay vì sửa đổi các hệ thống hiện có.

---

## 1.6 Phù hợp với Cocos Creator

Kiến trúc được xây dựng dựa trên mô hình Component-Based của Cocos Creator.

Gameplay Core nên hạn chế phụ thuộc vào:

* Node
* Component
* Sprite
* Label
* Tween

Các thành phần phụ thuộc Engine chỉ nên xuất hiện tại tầng UI hoặc tầng Runtime.

Điều này giúp Gameplay dễ kiểm thử và giảm sự phụ thuộc vào Engine.

---

## 1.7 Tối ưu cho thiết bị di động

Dự án hướng đến Android và iOS.

Trong quá trình thiết kế phải luôn ưu tiên:

* FPS ổn định.
* Giảm Garbage Collection.
* Hạn chế cấp phát bộ nhớ.
* Giảm số lần Instantiate/Destroy.
* Tiết kiệm pin.
* Hoạt động tốt trên thiết bị Android tầm trung.

Hiệu năng được xem là một yêu cầu của kiến trúc, không phải bước tối ưu sau cùng.

---

## 1.8 Không thiết kế quá mức (Over-engineering)

Chỉ xây dựng những thành phần thực sự cần cho MVP.

Không tạo Interface, Module hoặc Manager chỉ để phục vụ những tính năng chưa có kế hoạch triển khai.

Mỗi lớp hoặc Interface chỉ nên tồn tại khi có ít nhất một nhu cầu thực tế trong dự án hoặc đã được xác định rõ trong kế hoạch mở rộng.

---

## 1.9 Nguyên tắc thiết kế

Trong mọi trường hợp, ưu tiên theo thứ tự:

1. Kiến trúc rõ ràng.
2. Dễ đọc.
3. Dễ bảo trì.
4. Dễ mở rộng.
5. Hiệu năng.
6. Tốc độ phát triển.

Nếu tồn tại nhiều phương án triển khai, luôn ưu tiên phương án có cấu trúc rõ ràng và dễ hiểu hơn, ngay cả khi phải viết nhiều mã nguồn hơn.

---


# 2. Tổng quan kiến trúc (Architecture Overview)

## 2.1 Triết lý kiến trúc

Dự án **Dogdoku** được xây dựng theo kiến trúc **Component-Based** kết hợp với **Event-Driven Architecture**, phù hợp với mô hình phát triển của **Cocos Creator**.

Mục tiêu của kiến trúc là tách biệt rõ ràng giữa:

* Giao diện người dùng (UI)
* Logic gameplay
* Dữ liệu
* Các dịch vụ hỗ trợ
* Quản lý vòng đời ứng dụng

Mỗi tầng chỉ đảm nhận một nhóm trách nhiệm riêng và giao tiếp với nhau thông qua các giao diện hoặc sự kiện, tránh phụ thuộc trực tiếp giữa các module.

Kiến trúc này giúp:

* Gameplay không phụ thuộc UI.
* UI có thể thay đổi mà không ảnh hưởng gameplay.
* Hệ thống dễ kiểm thử.
* Dễ mở rộng tính năng mới.
* Hạn chế phát sinh Circular Dependency.

---

# 2.2 Kiến trúc phân tầng

Hệ thống được chia thành sáu tầng chính.

```text
┌───────────────────────────────┐
│            UI Layer           │
├───────────────────────────────┤
│         Gameplay Layer        │
├───────────────────────────────┤
│         Service Layer         │
├───────────────────────────────┤
│         Manager Layer         │
├───────────────────────────────┤
│          Data Layer           │
├───────────────────────────────┤
│          Core Layer           │
└───────────────────────────────┘
```

Mỗi tầng có nhiệm vụ riêng và không được vượt quyền sang trách nhiệm của tầng khác.

---

# 2.3 Vai trò của từng tầng

## Core Layer

Core Layer chứa những thành phần nền tảng được sử dụng bởi toàn bộ dự án.

Bao gồm:

* Event Bus
* Global Constants
* Enum
* Common Types
* Utility dùng chung (nếu thực sự cần)

Core Layer không chứa bất kỳ logic gameplay nào.

Đây là tầng có mức phụ thuộc thấp nhất và được phép sử dụng ở mọi nơi.

---

## Data Layer

Data Layer chịu trách nhiệm mô tả dữ liệu của trò chơi.

Bao gồm:

* LevelConfig
* PlayerData
* SaveData
* SettingsData
* DailyPuzzleData

Các lớp trong Data Layer chỉ chứa dữ liệu.

Không được chứa:

* Logic gameplay
* Xử lý UI
* Animation
* Âm thanh

Data Layer có thể được Serialize và Deserialize trực tiếp.

---

## Service Layer

Service Layer cung cấp các chức năng hỗ trợ cho Gameplay và Manager.

Ví dụ:

* PuzzleProvider
* SaveService
* DailyPuzzleService
* RewardService
* HintService

Service thường:

* Không lưu trạng thái lâu dài.
* Chỉ thực hiện một nhiệm vụ cụ thể.
* Có thể thay thế bằng implementation khác.

Ví dụ:

```text
ISaveService

↓

LocalSaveService

↓

CloudSaveService
```

Gameplay không cần biết dữ liệu được lưu ở đâu.

---

## Gameplay Layer

Gameplay Layer là trung tâm của trò chơi.

Đây là nơi xử lý toàn bộ luật chơi.

Bao gồm:

* Board
* Cell
* Puzzle
* Validation
* Hint
* Progression
* Failure
* Place Dog

Gameplay Layer không được phụ thuộc vào:

* UI
* Animation
* Audio
* Popup
* Scene

Gameplay chỉ xử lý:

> "Điều gì xảy ra trong trò chơi."

Không xử lý:

> "Hiển thị điều đó như thế nào."

---

## Manager Layer

Manager chịu trách nhiệm quản lý các hệ thống tồn tại xuyên suốt vòng đời ứng dụng.

Ví dụ:

* GameManager
* UIManager
* SaveManager
* AudioManager
* ResourceManager
* SceneManager

Manager không chứa gameplay.

Manager chỉ điều phối các module.

Ví dụ:

```text
Player chọn Level

↓

GameManager

↓

PuzzleProvider

↓

Gameplay khởi tạo Puzzle

↓

Gameplay phát Event

↓

UIManager mở Gameplay HUD
```

---

## UI Layer

UI Layer chịu trách nhiệm hiển thị thông tin cho người chơi.

Bao gồm:

* Main Menu
* Gameplay HUD
* Pause
* Result
* Settings
* Level Select
* Daily Puzzle

UI chỉ:

* Nhận thao tác người chơi.
* Hiển thị trạng thái.

UI không được:

* Kiểm tra luật chơi.
* Tính điểm.
* Kiểm tra thắng thua.
* Thay đổi dữ liệu trực tiếp.

Mọi thao tác đều phải gửi tới Gameplay.

---

# 2.4 Luồng dữ liệu

Luồng dữ liệu trong dự án luôn đi theo một chiều.

```text
Người chơi

↓

UI

↓

Gameplay

↓

Data

↓

Gameplay

↓

Event

↓

UI
```

Ví dụ:

```text
Double Tap

↓

BoardView

↓

Gameplay

↓

Placement Validation

↓

Board cập nhật

↓

CellChangedEvent

↓

BoardView cập nhật hình ảnh
```

UI không tự ý sửa dữ liệu.

Gameplay là nơi duy nhất có quyền thay đổi trạng thái của Puzzle.

---

# 2.5 Luồng khởi tạo trò chơi

Khi người chơi bắt đầu một màn chơi, hệ thống hoạt động theo trình tự sau:

```text
GameManager

↓

PuzzleProvider

↓

Đọc LevelConfig

↓

Khởi tạo Board

↓

Khởi tạo Gameplay

↓

Gameplay chuyển sang Ready

↓

Gameplay phát PuzzleReadyEvent

↓

UI tạo BoardView

↓

Người chơi bắt đầu chơi
```

Việc tách riêng quá trình khởi tạo giúp Gameplay luôn nhận được dữ liệu hợp lệ trước khi cho phép người chơi tương tác.

---

# 2.6 Luồng kết thúc màn chơi

Một màn chơi chỉ có hai trạng thái kết thúc:

### Hoàn thành

```text
Đặt đủ tất cả Dog

↓

Puzzle Solved

↓

PuzzleState = Solved

↓

Gameplay phát PuzzleSolvedEvent

↓

Progression cập nhật

↓

Save

↓

Result Popup
```

---

### Thất bại

```text
Sai lần thứ ba

↓

Mistake = 0

↓

PuzzleState = Failed

↓

Gameplay phát PuzzleFailedEvent

↓

Save

↓

Result Popup
```

Gameplay không mở Popup.

Gameplay chỉ phát Event.

UI quyết định hiển thị giao diện nào.

---

## 2.7 Quy tắc giao tiếp giữa các tầng

Để đảm bảo kiến trúc luôn rõ ràng và tránh phát sinh phụ thuộc vòng, các tầng phải tuân thủ các quy tắc sau:

| Tầng     | Được phép phụ thuộc      | Không được phụ thuộc  |
| -------- | ------------------------ | --------------------- |
| UI       | Gameplay, Event          | Data, Manager         |
| Gameplay | Data, Event              | UI                    |
| Service  | Data                     | UI                    |
| Manager  | Service, Event           | Gameplay Logic nội bộ |
| Data     | Không phụ thuộc tầng nào | Tất cả các tầng khác  |
| Core     | Không phụ thuộc Gameplay | UI, Gameplay          |

Mọi tương tác giữa các tầng đều phải đi qua giao diện công khai hoặc Event Bus, không được truy cập trực tiếp vào trạng thái nội bộ của tầng khác.

---

# 3. Gameplay Architecture

Gameplay Layer là trung tâm của hệ thống. Toàn bộ luật chơi nằm tại đây và chỉ tại đây.

## 3.1 Nguyên tắc nền tảng

* Gameplay là TypeScript thuần: không import Node, Component, Sprite, Tween hay bất kỳ API nào của Cocos Creator.
* Đầu vào của Gameplay là **Intent** — yêu cầu trừu tượng do UI gửi tới (ví dụ: đánh dấu ô, đặt Dog tại ô).
* Đầu ra của Gameplay là **Event** — thông báo về những gì đã xảy ra.
* Mỗi ván chơi là một **Puzzle Session** độc lập: tạo mới khi vào màn, hủy hoàn toàn khi rời màn. Không dùng lại session giữa các ván.

```text
UI (BoardView, HUD)
      │
      │  Intent: ToggleMark / PlaceDog / DragMark /
      │          UsePlaceDog / ShowHint / Restart
      ▼
Puzzle Session (điều phối một ván chơi)
      ├── Board System          (trạng thái bàn chơi)
      ├── Placement Check       (kiểm tra nước đi theo solution)
      ├── Mistake Counter       (3/3 → 0/3)
      ├── Assist Systems        (Place Dog, Hint, Restart)
      └── Puzzle State Machine  (Loading → Ready → Playing →
      │                          Solved / Failed / Disposed)
      ▼
Event Bus  →  UI, AudioManager, SaveManager, GameManager
```

## 3.2 Board System

Board System quản lý trạng thái bàn chơi.

Dữ liệu gồm:

* Kích thước lưới N (thực tế 4 → 11).
* Bản đồ vùng màu: mỗi ô thuộc đúng một vùng; số vùng luôn bằng N.
* Trạng thái từng ô: `Empty | Mark | Dog | WrongMark`.
* Tập ô **pre-placed** (khóa, không nhận Intent, không bị Restart xóa).
* Solution: tập vị trí Dog đúng (nạp từ PuzzleData, chỉ đọc).

Quy tắc:

* Board chỉ cung cấp thao tác nguyên tử (đổi trạng thái một ô, truy vấn trạng thái) — không chứa luật thắng/thua.
* Trạng thái board phải serialize được thành `BoardSaveData` để phục vụ auto-save và resume (theo 02 — mục 9.2).
* Board không biết ô được hiển thị như thế nào.

## 3.3 Input System

Input được tách làm hai phần, ở hai tầng khác nhau:

| Phần | Tầng | Trách nhiệm |
| --- | --- | --- |
| Gesture Detection | UI | Nhận touch thô trên BoardView, nhận diện Single Tap / Double Tap / Drag theo Interaction Priority (02 — mục 1.1), quy đổi tọa độ chạm thành tọa độ ô |
| Intent Handling | Gameplay | Nhận Intent trừu tượng và thực thi luật chơi |

Lý do tách:

* Gameplay không phụ thuộc hệ thống input của engine — có thể test bằng cách gửi Intent trực tiếp.
* Thêm phương thức input mới (chuột, bàn phím khi debug) không đụng vào luật chơi.

Ngưỡng nhận diện double tap và drag là giá trị trong GameConfig, không hard-code.

## 3.4 Validation System (Placement Check)

Thực thi quy tắc đã chốt ở 02 — mục 1.2:

* Khi nhận Intent đặt Dog: so vị trí với solution.
* Đúng vị trí solution: đặt Dog (thay thế Mark nếu có).
* Sai vị trí solution: tạo Wrong Mark, Mistake Counter trừ 1.

Kiểm tra kết thúc chạy sau mỗi thay đổi:

* Đủ N Dog: chuyển state sang Solved.
* Mistake Counter về 0: chuyển state sang Failed, khóa mọi Intent.

Bốn luật của puzzle (hàng / cột / vùng / kề nhau) không dùng để phán định đúng sai lúc chơi — chúng là định nghĩa tính đúng đắn của solution và chỉ dùng để cung cấp thông tin "lý do sai" trong payload event khi tạo Wrong Mark (UI quyết định có highlight hay không).

## 3.5 Assist Systems

**Place Dog**

* Đặt đúng một Dog vào một vị trí đúng chưa được đặt, không tính mistake.
* Số lượt khả dụng được nạp vào Puzzle Session khi khởi tạo (đọc từ PlayerData, do GameManager cung cấp).
* Khi dùng: phát `PlaceDogUsedEvent` kèm số lượt còn lại. Việc trừ lượt trong PlayerData do bên ngoài xử lý khi nghe event.
* Lượt đã dùng không hoàn lại khi Restart (xem chương 11).

**Hint**

* Gợi ý được **suy ra lúc runtime** từ solution + trạng thái board hiện tại, không phải nội dung lưu sẵn (02 — mục 4.3).
* Hint System trả về **một nhóm cần highlight** (hàng / cột / vùng màu) mà trong đó chỉ còn đúng một ô khả dĩ; nó không đặt Dog. Việc hiển thị highlight là của UI.
* Hint là hàm thuần: `(solution, trạng thái board) → nhóm cần highlight`. Không giữ state, không phụ thuộc puzzle cụ thể → dùng được cho mọi puzzle kể cả puzzle chưa tồn tại.

**Restart**

* Đưa board về trạng thái ban đầu: xóa toàn bộ Dog, Mark, Wrong Mark **do người chơi điền**; **giữ nguyên ô pre-placed**; Mistake Counter về 3/3.
* Phát `BoardRestartedEvent`.

## 3.6 Puzzle State Machine

Máy trạng thái theo đúng 02 — mục 7 và 8.2. Chủ sở hữu là Puzzle Session.

Quy tắc:

* Intent chỉ được xử lý khi state là Ready hoặc Playing. Intent hợp lệ đầu tiên chuyển Ready thành Playing.
* Solved và Failed là trạng thái kết thúc — mọi Intent sau đó bị từ chối.
* Mọi transition đều phát event; transition không hợp lệ bị bỏ qua kèm log warning.

## 3.7 Khả năng kiểm thử

Vì Gameplay là TypeScript thuần, toàn bộ luật chơi test được mà không cần engine. Các nhóm test bắt buộc:

* Placement Check: đúng / sai / ô đã có Dog / ô có Wrong Mark.
* Chuỗi mistake: 3 lần sai dẫn tới Failed, board bị khóa.
* Hoàn thành: Dog cuối cùng chuyển state sang Solved.
* Restart: trạng thái sạch, mistake 3/3, lượt Place Dog không hoàn lại.
* Serialize và restore board: resume đúng từng ô và mistake counter.

---

# 4. Event System

## 4.1 Vị trí và vai trò

Event Bus nằm ở Core Layer, là kênh giao tiếp một chiều "thông báo những gì đã xảy ra". EventManager chỉ làm nhiệm vụ đăng ký, hủy đăng ký và phát event — không chứa bất kỳ logic nào.

## 4.2 Quy tắc thiết kế event

* Mọi event được định nghĩa tập trung tại thư mục `event/`: tên là hằng số, payload có kiểu rõ ràng. Không dùng chuỗi tự do, không dùng `any`.
* Tên event mô tả việc đã xảy ra, ở thì quá khứ: `CellChangedEvent`, `PuzzleSolvedEvent`. Yêu cầu từ UI dùng hậu tố Requested: `PauseRequestedEvent`.
* Payload là dữ liệu bất biến và tối giản. Cấm truyền Node, Component hoặc tham chiếu trạng thái nội bộ trong payload.
* Event không dùng để truy vấn dữ liệu (không có event trả kết quả). Truy vấn đi qua API chỉ đọc theo quy tắc phụ thuộc ở chương 8.
* Không phát event bên trong `update()` theo từng frame.

## 4.3 Danh mục event MVP

| Event | Payload chính | Phát bởi | Lắng nghe bởi |
| --- | --- | --- | --- |
| PuzzleReadyEvent | puzzleId, kích thước, trạng thái board | Gameplay | UI |
| CellChangedEvent | vị trí ô, trạng thái mới, lý do sai (nếu có) | Gameplay | UI, AudioManager, SaveManager |
| MistakeChangedEvent | số lượt còn lại | Gameplay | UI, AudioManager |
| PlaceDogUsedEvent | vị trí, số lượt còn lại | Gameplay | UI, SaveManager |
| HintShownEvent | nhóm cần highlight (hàng / cột / vùng), số lượt hint còn lại | Gameplay | UI, GameManager |
| BoardRestartedEvent | puzzleId | Gameplay | UI, SaveManager |
| PuzzleSolvedEvent | puzzleId, context (campaign / daily) | Gameplay | GameManager, UIManager, AudioManager, SaveManager |
| PuzzleFailedEvent | puzzleId, context | Gameplay | GameManager, UIManager, AudioManager, SaveManager |
| LevelUnlockedEvent | levelId | GameManager | UI, SaveManager |
| DailyRewardGrantedEvent | phần thưởng, streak mới | GameManager | UI, SaveManager |
| AppStateChangedEvent | trạng thái cũ, trạng thái mới | GameManager | UIManager, SceneManager, AudioManager |
| LevelSelectedEvent (Requested) | context (campaign / daily), levelId | UI | GameManager |
| NavigateRequestedEvent (Requested) | AppState đích | UI | GameManager |
| PauseRequestedEvent / ResumeRequestedEvent | — | UI | GameManager |
| SettingsChangeRequestedEvent (Requested) | âm lượng BGM / SFX muốn đổi | UI | GameManager |
| SettingsChangedEvent | âm lượng BGM / SFX sau khi đổi | GameManager | AudioManager, SaveManager |

Danh mục này là nguồn sự thật duy nhất về event của MVP. Thêm event mới phải cập nhật bảng này trước khi viết code.

## 4.4 Quy tắc vòng đời listener

Trả lời trực tiếp Technical Risk "Event Listener bị rò rỉ" (01 — mục 11):

* Đăng ký và hủy đăng ký phải đối xứng theo vòng đời component: đăng ký ở `onEnable` thì hủy ở `onDisable`; đăng ký ở `onLoad` thì hủy ở `onDestroy`.
* Mọi đăng ký đều kèm định danh chủ thể (target) để có thể hủy toàn bộ listener của một chủ thể bằng một lệnh.
* Puzzle Session hủy toàn bộ listener của mình khi chuyển sang Disposed.
* Code review bắt buộc kiểm tra tính đối xứng đăng ký / hủy.

---

# 5. Manager Architecture

## 5.1 Danh sách manager

MVP có đúng bảy manager

| Manager | Trách nhiệm duy nhất | Không được làm |
| --- | --- | --- |
| GameManager | Sở hữu AppState machine; điều phối luồng chơi (vào level, daily, kết thúc ván) | Chứa luật chơi; đụng vào UI; đọc ghi storage trực tiếp |
| UIManager | Mở / đóng screen và overlay; quản lý popup stack | Xử lý logic gameplay; tự quyết định luồng chơi |
| AudioManager | Phát BGM / SFX; áp dụng cài đặt âm lượng | Bị gọi trực tiếp từ Gameplay (chỉ nghe event) |
| SaveManager | Điều phối thời điểm lưu / đọc PlayerData; là nơi duy nhất ra lệnh persist | Tự định nghĩa nơi lưu trữ (việc của SaveService); chứa logic gameplay |
| SceneManager | Chuyển scene (Boot, Main) | Quản lý screen / popup (việc của UIManager) |
| ResourceManager | Load / release asset theo bundle; preload core assets | Bị gọi trong lúc gameplay đang chạy gây giật khung hình |
| EventManager | Đăng ký / hủy / phát event | Chứa bất kỳ logic nghiệp vụ nào |

## 5.2 Quy tắc phối hợp

* Thông báo trạng thái giữa các manager đi qua event.
* Cho phép duy nhất quan hệ điều phối một chiều: GameManager gọi API công khai của manager khác khi luồng cần tính tuần tự (ví dụ: load scene xong mới mở screen). Lý do: điều phối tuần tự thuần bằng event làm luồng trở nên ngầm định và khó debug.
* Không manager nào được gọi ngược về GameManager — chỉ phát event.
* AppState machine và bảng transition tuân theo 02 — mục 7 và 8.1, không định nghĩa lại ở nơi khác.

## 5.3 Quyết định về scene

Sau Boot Scene, toàn bộ game chạy trong một Main Scene duy nhất. Main Menu, Level Select, Gameplay là các UI screen do UIManager quản lý; Pause, Result, Settings là overlay.

* Ưu điểm: không tốn thời gian load scene giữa các màn hình; manager và board không bị hủy dựng lại; phù hợp thiết bị tầm trung.
* Nhược điểm : UIManager phức tạp hơn (screen stack); SceneManager rất mỏng trong MVP nhưng vẫn giữ để đúng phân công của CLAUDE.md và sẵn cho nhu cầu scene mới sau này.

---

# 6. Service Architecture

## 6.1 Danh sách service chính thức của MVP

Chương này là danh sách chính thức (mục 2.3 chỉ nêu ví dụ minh họa). MVP có đúng ba service:

| Service | Trách nhiệm | Interface |
| --- | --- | --- |
| PuzzleProvider | Cung cấp PuzzleData theo levelId hoặc theo ngày (daily) | `IPuzzleProvider` — có roadmap thay thế: Puzzle Generator, Online Levels, DLC (01 — mục 5). MVP dùng LocalPuzzleProvider đọc từ bundle |
| SaveService | Đọc / ghi dữ liệu đã serialize xuống storage | `ISaveService` — có roadmap thay thế: Cloud Save. MVP dùng LocalSaveService |
| DailyPuzzleService | Chọn puzzle theo seed ngày; quản lý streak và streak recovery; xác định phần thưởng daily | Không có interface — chưa có kế hoạch thay thế implementation |

## 6.2 Những service cố tình không tạo

* **RewardService**: MVP chỉ có một nguồn thưởng duy nhất là Daily Puzzle — logic này thuộc DailyPuzzleService. Tách service riêng khi có nguồn thưởng thứ hai (achievements, events).
* **HintService**: hint là hàm thuần suy ra từ solution + trạng thái board (ch.3.5) — đây là luật chơi, thuộc Gameplay. Không có nghiệp vụ độc lập nào cần service.

Nguyên tắc: service mới chỉ được thêm khi có nghiệp vụ độc lập thực tế, kèm giải thích trong chương 11.

## 6.3 Quy tắc chung

* Service không giữ trạng thái lâu dài ngoài cache có chủ đích.
* Service không biết UI, không biết Gameplay — chỉ nhận tham số và trả dữ liệu.
* Manager là nơi duy nhất gọi service; Gameplay nhận dữ liệu đã được manager chuẩn bị.

---

# 7. Data Architecture

## 7.1 Ba nhóm dữ liệu

| Nhóm | Tính chất | Ví dụ |
| --- | --- | --- |
| Static Data | Chỉ đọc, đóng gói theo bản build | PuzzleData, LevelListConfig, GameConfig |
| Player Data | Ghi được, persist qua SaveManager | PlayerData (tiến trình, daily, inventory, settings, board đang dở) |
| Runtime State | Chỉ tồn tại trong phiên chạy, không persist | PuzzleState, AppState |

## 7.2 Static Data

**PuzzleData** — một puzzle gồm:

* id, kích thước lưới N.
* Bản đồ vùng màu (mảng phẳng N×N, mỗi ô mang region id; luôn có đúng N vùng).
* Solution (tập N vị trí Dog) — **bake sẵn trong data**, không tính lúc runtime.
* Tập ô pre-placed: Dog đặt sẵn và Mark đặt sẵn.

Không có trường "độ khó": độ khó được biểu đạt bằng **kích thước lưới + thứ tự level**, không cần gán tay (02 — mục 5). Không có danh sách hint: hint suy ra lúc runtime (ch.3.5).

**LevelListConfig** — số lượng level campaign và số lượng puzzle daily; quy ước đặt tên file để PuzzleProvider tra ra đường dẫn. Thứ tự campaign chính là thứ tự id (1→617), không cần liệt kê.

**GameConfig** — giá trị tuning: số mistake tối đa, ngưỡng double tap / drag, số lượt Place Dog khởi đầu, phần thưởng daily, số lần streak recovery.

Định dạng PuzzleData là hợp đồng ổn định: mọi nguồn puzzle tương lai (generator, online) phải sinh ra đúng định dạng này **và phải qua kiểm định của editor tool** (02 — mục 10.3) — đây chính là điểm mở của IPuzzleProvider.

## 7.3 Player Data

Một document PlayerData duy nhất, gồm các nhánh:

* progression: level đã hoàn thành, level đang mở.
* daily: ngày chơi gần nhất, streak, số lần recovery đã dùng, trạng thái hôm nay.
* inventory: số lượt Place Dog.
* settings: âm lượng BGM / SFX.
* boardInProgress: BoardSaveData (puzzleId, trạng thái từng ô, mistake còn lại, context campaign / daily) — có thể rỗng.

Quy tắc:

* PlayerData được bọc trong **SaveData** — vỏ persistence giữ trường `version`. Khi schema thay đổi, viết hàm migration từ version cũ — trả lời Technical Risk "Save Data khó mở rộng" (01 — mục 11). Version nằm ở vỏ chứ không nằm trong PlayerData, để dữ liệu nghiệp vụ không phải biết gì về schema versioning (chi tiết: 05 — mục 4.3).
* Ghi nguyên tử: serialize toàn bộ document rồi ghi một lần, không ghi từng phần rời rạc.
* Data model không chứa logic — mọi biến đổi dữ liệu nằm ở Gameplay hoặc Service.

---

# 8. Dependency Rules

Chương này chi tiết hóa quy tắc ở mục 2.7.

## 8.1 Bảng phụ thuộc theo tầng

Chiều mũi tên là chiều được phép import.

| Tầng | Được phép import | Bị cấm import |
| --- | --- | --- |
| Core | Không import tầng nào | Tất cả |
| Data | Core | Tất cả tầng còn lại |
| Service | Core, Data | Gameplay, Manager, UI |
| Gameplay | Core, Data | Service, Manager, UI, Audio, Animation |
| Manager | Core, Data, Service, Gameplay (chỉ API công khai) | Nội bộ Gameplay; UI (ngoại lệ: UIManager giữ danh mục screen / popup) |
| UI | Core (event), Gameplay (chỉ API đọc và Intent) | Data (ghi), Service, Manager |

## 8.2 Luồng bị cấm và cách làm đúng

| Nhu cầu | Cách sai | Cách đúng |
| --- | --- | --- |
| Gameplay muốn phát âm thanh | Gọi AudioManager | Phát event; AudioManager tự nghe |
| Gameplay muốn lưu dữ liệu | Gọi SaveManager | SaveManager nghe các event save-trigger (02 — mục 9.2) |
| UI muốn chuyển màn hình | Tự mở screen / load scene | Phát Requested event; GameManager xử lý, UIManager thực thi |
| UI cần tiến trình cho Level Select | Đọc PlayerData trực tiếp | Gọi API chỉ đọc của Progression (thuộc Gameplay) hoặc nhận qua payload event |
| Manager cần kết quả ván chơi | Đọc trạng thái nội bộ Puzzle Session | Nghe PuzzleSolvedEvent / PuzzleFailedEvent |
| Service cần thông báo cho UI | Gọi UI / phát event trực tiếp từ service | Trả kết quả cho Manager; Manager phát event |

## 8.3 Thực thi

* Vi phạm quy tắc phụ thuộc là lỗi chặn merge trong code review.
* Mọi ngoại lệ mới phải được ghi vào chương 11 kèm lý do, trước khi viết code.

---

# 9. Folder Structure

Toàn bộ mã nguồn nằm trong `assets/scripts/`, theo đúng folder convention của CLAUDE.md. Không tạo thư mục mới ngoài danh sách; thư mục chưa có file thì chưa tạo.

```text
assets/scripts/
├── core/        Event Bus (EventManager), hằng số, enum, type dùng chung
├── event/       Định nghĩa toàn bộ event + kiểu payload (danh mục chương 4)
├── model/       Khai báo kiểu dữ liệu: PuzzleData, PlayerData, BoardSaveData
├── config/      GameConfig, LevelListConfig — giá trị tuning tĩnh
├── data/        Serialize / deserialize, save schema, migration giữa các version
├── gameplay/    Puzzle Session, Board, Placement Check, Mistake Counter,
│                Assist Systems, Puzzle State Machine, Progression
├── manager/     GameManager, UIManager, AudioManager, SaveManager,
│                SceneManager, ResourceManager, Bootloader (composition root)
├── service/     PuzzleProvider, SaveService, DailyPuzzleService
├── ui/          Screen, popup, HUD, BoardView, cell view, gesture detection
├── audio/       Định danh audio clip, cấu hình âm thanh
├── animation/   Component animation (celebration, hiệu ứng UI) — tách khỏi gameplay
├── utility/     Tiện ích dùng chung, chỉ tạo khi có từ hai nơi sử dụng
└── editor/      Tool hỗ trợ editor (kiểm tra tính hợp lệ của puzzle data)
```

Phân biệt ba thư mục dữ liệu:

* `model/` — khai báo kiểu (shape của dữ liệu).
* `config/` — giá trị tĩnh của game.
* `data/` — cơ chế đọc / ghi / migration.

Quy tắc đặt tên file theo Naming Convention của CLAUDE.md; mỗi file một class.

---

# 10. Lifetime Management

## 10.1 Trình tự khởi động

```text
Boot Scene
  1. EventManager      (event bus sẵn sàng trước mọi thứ)
  2. ResourceManager   (chuẩn bị bundle, preload core assets)
  3. SaveManager       (đọc PlayerData qua SaveService, chạy migration nếu cần)
  4. AudioManager      (áp dụng âm lượng đã lưu)
  5. GameManager       (dựng AppState machine, state = Loading)
  6. SceneManager      (chuyển sang Main Scene)
  7. UIManager         (dựng screen stack, mở Main Menu)
```

Thứ tự này là tường minh và cố định — không manager nào tự khởi tạo lười (lazy) ở nơi khác.

## 10.2 Vòng đời theo loại đối tượng

| Đối tượng | Tạo | Hủy |
| --- | --- | --- |
| 7 Manager | Boot, một lần duy nhất, gắn trên persist root node | Chỉ khi thoát app |
| Puzzle Session | Vào màn Gameplay | Rời màn (Disposed) — hủy kèm toàn bộ listener |
| Screen / Overlay | UIManager mở | UIManager đóng; popup dùng lại qua pool nếu mở thường xuyên |
| Cell view | Lấy từ NodePool khi dựng board | Trả về pool khi rời màn — không destroy |

## 10.3 Quy tắc chống rò rỉ

* Singleton chỉ gồm bảy manager. Thêm singleton mới phải có lý do được duyệt (01 — mục 12).
* Mỗi ván một Puzzle Session mới — không tái sử dụng, không còn trạng thái rác giữa các ván.
* Component hủy listener và scheduler đúng vòng đời (quy tắc chương 4.4).
* NodePool cho cell view khởi tạo theo kích thước lưới lớn nhất trong data — **11×11 = 121 cell**; không instantiate / destroy cell trong lúc chơi.
* Khi app vào background: auto-save và tạm dừng audio (02 — mục 9); không giữ tham chiếu tới node đã bị release.

---

# 11. Design Principles & Architecture Decisions

Nguyên tắc chung đã có trong CLAUDE.md — không nhắc lại. Chương này ghi các quyết định riêng của dự án. Mọi thay đổi kiến trúc sau này phải bổ sung vào bảng này trước khi viết code.

| # | Quyết định | Lý do | Trade-off chấp nhận |
| --- | --- | --- | --- |
| 1 | Placement Check theo solution, không theo luật | Tránh thế "không thể thắng nhưng chưa fail" do Wrong Mark không xóa được (02 — mục 1.2) | Solution nằm trong puzzle data đóng gói theo build |
| 2 | Không có Undo trong MVP | Dog đặt luôn đúng, Mark toggle bằng một chạm — Undo không còn giá trị sử dụng | Người chơi muốn làm lại phải dùng Restart |
| 3 | Pause / Result / Settings là overlay, không phải scene | Chuyển đổi tức thì, giữ nguyên context ván chơi | UIManager quản lý popup stack |
| 4 | Một Main Scene duy nhất sau Boot | Không tốn load scene giữa màn hình; manager không bị hủy dựng lại | SceneManager rất mỏng trong MVP |
| 5 | Save sau mỗi thay đổi | Chống mất dữ liệu khi OS kill app (02 — mục 9.1) | I/O thường xuyên; có thể chuyển debounce mà không đổi kiến trúc |
| 6 | Chỉ hai interface: IPuzzleProvider, ISaveService | Cả hai có kế hoạch thay thế rõ trong roadmap (generator / online levels; cloud save) | Các thành phần khác dùng class cụ thể, tạo interface sau nếu cần |
| 7 | Không có RewardService, HintService | Reward chỉ có một nguồn (daily); hint là hàm thuần thuộc luật chơi, nằm trong Gameplay | Khi reward đa nguồn sẽ tách, điểm tách đã rõ |
| 8 | Gameplay là TypeScript thuần, giao tiếp bằng Intent / Event | Kiểm thử không cần engine; thay UI không đụng luật chơi | Cần lớp chuyển đổi gesture → Intent ở UI |
| 9 | Lượt Place Dog không hoàn lại khi Restart | Chặn exploit: dùng lượt để biết vị trí đúng rồi Restart để lấy lại lượt | Người chơi cần cân nhắc trước khi dùng |
| 10 | GameManager được gọi một chiều tới manager khác cho luồng tuần tự | Điều phối tuần tự thuần bằng event khó theo dõi và debug | Chấp nhận một điểm phụ thuộc trực tiếp, có kiểm soát |
| 11 | Solution được **bake sẵn vào file puzzle JSON** bằng editor tool, không solve lúc runtime | Kiểm chứng được tính duy nhất của nghiệm ngay lúc build data — điều kiện sống còn của quyết định #1; runtime không tốn CPU | Phải chạy lại editor tool mỗi khi thêm / sửa puzzle |
| 12 | Data thô bị **loại bỏ 229/1000 puzzle hỏng**, giữ 771 (617 campaign + 154 daily) | Puzzle vô nghiệm làm kẹt campaign; puzzle nhiều nghiệm làm hỏng bàn chơi vĩnh viễn (02 — mục 10.3) | Số level ít hơn kỳ vọng ban đầu; id được đánh số lại nên không khớp id file nguồn |
| 13 | Hint **suy ra lúc runtime**, không phải nội dung handcrafted trong PuzzleData | Data thực tế không có hint; viết tay hint cho 771 puzzle là bất khả thi và mọi puzzle tương lai sẽ lại thiếu hint | Hint mang tính cơ học (highlight nhóm còn 1 ô khả dĩ), không "kể chuyện" suy luận như hint viết tay |
| 16 | Hint là **vật phẩm có hạn** (có số lượt như Place Dog), không phải miễn phí không giới hạn | Feature parity với game tham chiếu — ảnh mẫu cho thấy Hint có badge số lượt. Đảo lại một phần quyết định trước ("Hint không giới hạn") | Lượt hint là inventory toàn cục; không trừ khi không có gợi ý để hiện; board snapshot vẫn không chứa dữ liệu hint |
| 14 | Hỗ trợ **ô pre-placed** (Dog / Mark đặt sẵn, khóa vĩnh viễn) | Data đã có sẵn cơ chế này; hữu ích làm điểm tựa cho level tutorial | Board và BoardSaveData phải mang thêm khái niệm "ô bị khóa" |
| 15 | **Bootloader thuộc `manager/`**, không phải `core/` | Bootloader phải import 6 manager để khởi tạo → là composition root. `core/` bị cấm import mọi tầng khác (ch.8.1), đặt ở đó là vi phạm chiều phụ thuộc | Thư mục `manager/` chứa một thành phần không phải Manager thuần; chấp nhận vì nó là điểm lắp ráp |

---

# 12. Future Expansion

Các tính năng hậu MVP (01 — mục 5 và 10) và điểm cắm tương ứng đã chừa sẵn trong kiến trúc:

| Tính năng | Điểm cắm | Phạm vi sửa đổi dự kiến |
| --- | --- | --- |
| Puzzle Generator | Implementation mới của IPuzzleProvider | Thêm module mới; gameplay, UI, data format không đổi |
| Online Levels / DLC | RemotePuzzleProvider + bundle của ResourceManager | Thêm module mới; PuzzleData format giữ nguyên |
| Cloud Save | CloudSaveService (ISaveService) | Thêm implementation; SaveManager bổ sung xử lý xung đột |
| Theme / Skin | Asset bundle + theme config; UI đọc config | Chỉ tầng UI và config |
| Localization | Text qua key trong UI component | Chỉ tầng UI; không sửa scene, không sửa gameplay |
| Achievements | Service mới lắng nghe event sẵn có (PuzzleSolvedEvent...) | Thêm service + UI; không sửa module hiện hữu |
| Analytics | Listener trên Event Bus | Thêm service; không chạm module nào |
| Monetization (ads / IAP) | Điểm chèn đã có trong flow: continue khi Failed, mua lượt Place Dog | Thêm service + UI; gameplay không đổi |
| LiveOps / Events | Mở rộng DailyPuzzleService (server time, event pool) | Thay đổi khoanh vùng trong service |

Tiêu chí kiểm chứng: mọi dòng trong bảng trên đều là "thêm module mới và lắng nghe event sẵn có" — không dòng nào yêu cầu sửa Gameplay Core. Nếu một tính năng tương lai buộc phải sửa Gameplay Core, kiến trúc phải được xem xét lại theo quy trình ở chương 11.

---