# Dogdoku — Data Model

> Tài liệu thiết kế kiến trúc dữ liệu. Chi tiết hóa chương 7 của [03-system-architecture.md](03-system-architecture.md). Đọc sau 03 và [04-folder-structure.md](04-folder-structure.md).


# 1. Mục tiêu của Data Layer

## 1.1 Vai trò

Data Layer mô tả và lưu giữ **trạng thái** của trò chơi — và chỉ trạng thái.

Nó trả lời các câu hỏi:

* Dữ liệu có hình dạng như thế nào.
* Ai sở hữu dữ liệu đó.
* Dữ liệu sống bao lâu.
* Dữ liệu có được lưu xuống storage hay không.

Nó **không** trả lời câu hỏi "dữ liệu bị biến đổi ra sao" — mọi biến đổi dữ liệu nằm ở Gameplay hoặc Service (03 — ch.1.2).

## 1.2 Trách nhiệm

Data Layer gồm ba vai, ánh xạ đúng ba thư mục của 04 — mục 3.2:

| Vai | Thư mục | Trách nhiệm |
|---|---|---|
| Khai báo hình dạng dữ liệu (shape) | `scripts/model/` | Định nghĩa các model được mô tả trong tài liệu này |
| Giá trị tĩnh | `scripts/config/` | GameConfig, LevelListConfig |
| Cơ chế đọc / ghi | `scripts/data/` | Serialize, deserialize, migration theo version của SaveData |

## 1.3 Phạm vi

**Thuộc phạm vi tài liệu này:** toàn bộ model của ba nhóm dữ liệu (Config / Runtime / Persistent — chương 3).

**Không thuộc phạm vi:**

* `AppState`, `PuzzleState`, `CellState` — đây là **enum trạng thái**, nằm ở `core/` (04 — mục 3.2), thuộc về các state machine đã thiết kế trong 02 — mục 7 và 03 — ch.3.6. Chúng là *giá trị* xuất hiện bên trong model, không phải model.
* Kiểu payload của từng event — định nghĩa tại `event/` theo danh mục 03 — ch.4.3.
* Nơi lưu trữ vật lý (localStorage, file...) — quyết định của SaveService, sẽ chi tiết ở tài liệu 08 (Save System).

## 1.4 Quan hệ với các tầng khác

| Tầng | Quan hệ với Data Layer | Chiều phụ thuộc |
|---|---|---|
| Gameplay | Nhận Config Model đã nạp sẵn khi khởi tạo Puzzle Session; sở hữu và biến đổi Runtime Model; là chủ ghi của nhánh progression | Gameplay → Data (một chiều) |
| UI | **Không** đọc/ghi model trực tiếp. Nhận dữ liệu hiển thị qua payload event hoặc API chỉ đọc của Gameplay (03 — ch.8.2) | UI không import Data để ghi |
| Save System | SaveManager giữ instance PlayerData duy nhất, quyết định *thời điểm* persist; `data/` lo serialize + migration; SaveService lo storage | Save → Data (một chiều) |
| Service | PuzzleProvider trả PuzzleData; DailyPuzzleService đọc/ghi DailyPuzzleData khi được GameManager gọi | Service → Data (một chiều) |

Data Layer không phụ thuộc tầng nào (03 — ch.2.7): model không import Gameplay, UI, Manager hay Service. Nhờ đó mọi model đều serialize được trực tiếp và test được không cần engine.

---

# 2. Nguyên tắc thiết kế

## 2.1 Model chỉ chứa dữ liệu, không chứa logic

Theo 03 — ch.1.2. **Lý do:** model không logic thì serialize trực tiếp được, test được không cần engine, và không bao giờ trở thành nơi trốn của luật chơi (luật chỉ ở Gameplay).

## 2.2 Ba nhóm dữ liệu với tính khả biến khác nhau

| Nhóm | Tính khả biến | Persist |
|---|---|---|
| Config Data | **Bất biến** sau khi nạp | Không — đóng gói theo build |
| Runtime Data | Khả biến, trong phạm vi một session | Không — chụp snapshot khi cần |
| Persistent Data | Khả biến, mỗi model đúng một chủ ghi | Có — qua SaveManager |

**Lý do:** quy tắc kiến trúc (ai được ghi, có save không, sống bao lâu) đi theo *tính chất* dữ liệu chứ không theo tên gọi. Phân nhóm trước, mọi model mới sau này chỉ cần xếp vào đúng nhóm là thừa hưởng toàn bộ quy tắc.

## 2.3 Config là bất biến tuyệt đối lúc runtime

Không module nào được sửa PuzzleData, GameConfig, LevelListConfig sau khi nạp. **Lý do:** config bất biến thì được phép cache và chia sẻ tham chiếu thoải mái (không cần copy phòng thủ — tốt cho memory trên máy tầm trung); Restart/Replay luôn nhận đúng dữ liệu gốc; bug "config bị ai đó sửa" là loại bug rất khó lần.

## 2.4 Một nguồn sự thật — dữ liệu suy diễn được thì không lưu

Ví dụ áp dụng trong MVP:

* Danh sách level **unlocked** suy ra từ danh sách level **completed** + thứ tự trong LevelListConfig → không lưu riêng.
* "Daily hôm nay đã xong chưa" suy ra bằng so sánh *ngày hoàn thành gần nhất* với ngày hiện tại → không lưu cờ riêng (và tự "hết hạn" khi sang ngày mới, không cần code dọn dẹp).

**Lý do:** hai bản ghi của cùng một sự thật sớm muộn sẽ lệch nhau, và save data càng nhỏ càng an toàn khi ghi nguyên tử.

## 2.5 Tham chiếu chéo nhóm bằng id, không nhúng dữ liệu

Persistent Data trỏ tới Config Data bằng `puzzleId` / `levelId` (chuỗi định danh), không bao giờ nhúng nội dung puzzle vào save. **Lý do:** save nhỏ; cập nhật content (sửa puzzle, thêm level) không làm hỏng save cũ; không có nguy cơ hai bản puzzle lệch nhau.

## 2.6 Mỗi model đúng một chủ ghi

Mỗi model (hoặc nhánh của PlayerData) có đúng **một** module được quyền thay đổi (ma trận ở chương 9). **Lý do:** đây là cách duy nhất giữ được luồng dữ liệu một chiều của 03 — ch.2.4; nhiều chủ ghi là nguồn gốc của race condition logic và bug không tái hiện được.

## 2.7 Persist nguyên tử, có version

Toàn bộ dữ liệu bền nằm trong **một document duy nhất** (SaveData), serialize và ghi **một lần** (03 — ch.7.3). Document có trường `version` để migration. **Lý do:** OS kill app giữa chừng (rất phổ biến trên Android tầm trung — 02 mục 9) không thể để lại trạng thái nửa vời; version trả lời trực tiếp Technical Risk "Save Data khó mở rộng" (01 — mục 11).

## 2.8 Thiết kế cho mobile tầm trung

Trạng thái bàn chơi là **mảng phẳng giá trị enum**, không phải mảng object; payload event bất biến và tối giản (03 — ch.4.2). **Lý do:** bàn lớn nhất 11×11 = 121 giá trị — snapshot và save cực nhẹ, không gây áp lực GC khi save sau mỗi nước đi (02 — mục 9.1).

---

# 3. Phân loại Data Model

Ba nhóm theo đúng 03 — ch.7.1:

| Nhóm | Trách nhiệm | Model trong MVP |
|---|---|---|
| **Config Model** (Static Data) | Mô tả nội dung game do người thiết kế tạo ra; chỉ đọc | PuzzleData (gồm RegionData, PuzzleSolution), GameConfig, LevelListConfig |
| **Runtime Model** | Trạng thái sống của một phiên chơi; không persist | BoardData (mảng CellState), trạng thái phiên (mistake còn lại, lượt Place Dog khả dụng của session) |
| **Persistent Model** (Save) | Trạng thái bền của người chơi; persist qua SaveManager | SaveData ⊃ PlayerData ⊃ LevelProgressData, DailyPuzzleData, GameSettingsData, inventory, BoardSaveData |

Về các tên gọi theo domain mà đề cương gợi ý:

* **Puzzle Model** = cụm PuzzleData / RegionData / PuzzleSolution — thuộc nhóm Config.
* **Player Model** = cụm PlayerData và các nhánh — thuộc nhóm Persistent.
* **Save Model** = SaveData + BoardSaveData — thuộc nhóm Persistent.

Tài liệu này phân loại theo **tính chất** (chương 2.2) thay vì theo domain, vì mọi quy tắc kiến trúc (quyền ghi, lifetime, serialization) bám theo tính chất; tên domain chỉ là cách gọi để giao tiếp.

---

# 4. Các Data Model trong MVP

## 4.1 Nhóm Config

### PuzzleData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Mô tả trọn vẹn một puzzle handcrafted: định danh, kích thước lưới N (4→11), bản đồ vùng màu (RegionData), lời giải (PuzzleSolution), tập ô pre-placed (Dog / Mark đặt sẵn). Đây là **hợp đồng ổn định** — mọi nguồn puzzle tương lai (generator, online) phải sinh đúng định dạng này **và phải qua kiểm định của editor tool** (02 — mục 10.3) |
| Owner | Nội dung là asset JSON: campaign ở `resources/data/puzzles/`, daily ở `resources/data/daily/`; LocalPuzzleProvider nạp và trả ra; Puzzle Session giữ tham chiếu bản đang chơi |
| Lifetime | Theo Puzzle Session — nạp khi vào màn, release asset khi session Disposed |
| Read by | Gameplay (dựng board, Placement Check, Hint, Place Dog). UI chỉ nhận phần cần hiển thị (kích thước, vùng màu) qua payload `PuzzleReadyEvent` — **không bao giờ nhận solution** |
| Written by | Không ai lúc runtime. Chỉ tạo/sửa lúc design-time, có editor tool kiểm tra tính hợp lệ (`scripts/editor/`) |
| Khi nào thay đổi | Không bao giờ trong runtime |
| Save | Không — đóng gói theo build |

**Schema file JSON** (đây là hợp đồng — mọi nguồn puzzle phải sinh đúng định dạng này):

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | số | Định danh trong pool của nó (campaign 1→617, daily 1→154) |
| `size` | số | Kích thước lưới N (4→11) |
| `regions` | mảng N×N số | Region id của từng ô, **row-major**. Luôn có đúng N vùng phân biệt |
| `solution` | mảng N số | Chỉ số ô (row-major) của N Dog đúng. Đã bake sẵn, xem quyết định #11 của 03 |
| `prePlacedDogs` | mảng số | Ô có Dog đặt sẵn, khóa. Luôn là tập con của `solution` |
| `prePlacedMarks` | mảng số | Ô có Mark đặt sẵn, khóa |
| `sourceLevel` | số | Số hiệu file gốc — chỉ để truy vết khi debug data, gameplay không dùng |

**Quy ước tọa độ dùng chung toàn dự án:** ô được định danh bằng **chỉ số phẳng row-major** — `index = row * size + col`. Mọi mảng trong PuzzleData và BoardSaveData đều theo quy ước này. Không trộn lẫn với cặp (row, col) khi serialize.

### RegionData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Bản đồ vùng màu của một puzzle: mỗi ô thuộc đúng một vùng, mỗi vùng có định danh riêng. Yêu cầu thiết kế: tra cứu "ô này thuộc vùng nào" phải là phép tra trực tiếp (không duyệt) — cách biểu diễn cụ thể là chi tiết hiện thực |
| Owner | Thành phần bất biến bên trong PuzzleData — không tồn tại độc lập |
| Lifetime | Theo PuzzleData |
| Read by | Gameplay (xác định "lý do sai" cho payload khi tạo Wrong Mark — 03 — ch.3.4); UI (tô màu vùng khi dựng BoardView) |
| Written by | Không ai |
| Khi nào thay đổi | Không bao giờ |
| Save | Không |

### PuzzleSolution

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Tập N vị trí Dog đúng — nguồn sự thật của Placement Check (quyết định #1, 03 — ch.11). **Tính duy nhất của nghiệm là bất biến bắt buộc**, được editor tool kiểm chứng bằng máy lúc build data; puzzle có 0 hoặc ≥2 nghiệm bị loại khỏi build (02 — mục 10.3) |
| Owner | Thành phần bất biến bên trong PuzzleData, bake sẵn trong file JSON (quyết định #11, 03 — ch.11) |
| Lifetime | Theo PuzzleData |
| Read by | **Chỉ** Placement Check, Place Dog và Hint (đều trong Gameplay). Cấm đưa vào bất kỳ payload event nào phát ra ngoài Gameplay |
| Written by | Không ai |
| Khi nào thay đổi | Không bao giờ |
| Save | Không |

### GameConfig

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Giá trị tuning toàn cục: số mistake tối đa (3), ngưỡng double tap / drag, số lượt Place Dog khởi đầu, phần thưởng daily (số lượt Place Dog nhận được), số lần streak recovery tối đa (3) — theo 03 — ch.7.2 |
| Owner | `scripts/config/` — hằng số trong code |
| Lifetime | Toàn bộ app |
| Read by | Gameplay (mistake tối đa), UI (ngưỡng gesture — 04 mục 5 cho phép UI đọc config), GameManager, DailyPuzzleService (reward, recovery) |
| Written by | Không ai lúc runtime |
| Khi nào thay đổi | Chỉ khi tuning ở design-time |
| Save | Không |

### LevelListConfig

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Ranh giới của hai pool puzzle: **số level campaign (617)**, **số puzzle daily (154)**, và quy ước đường dẫn / tên file để PuzzleProvider tra ra asset. Không chứa danh sách level — thứ tự campaign **chính là** thứ tự id 1→617, nên liệt kê ra là duplicate data (nguyên tắc 2.4) |
| Owner | `scripts/config/` — code TS |
| Lifetime | Toàn bộ app |
| Read by | PuzzleProvider (dựng đường dẫn asset từ id), Progression (biết level cuối cùng để xác định "đã hết campaign"), DailyPuzzleService (chọn index trong pool theo seed ngày), UI Level Select (gián tiếp qua API chỉ đọc của Progression) |
| Written by | Không ai lúc runtime |
| Khi nào thay đổi | Chỉ khi thêm content ở design-time |
| Save | Không |

## 4.2 Nhóm Runtime

### BoardData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Trạng thái sống của bàn chơi trong một ván: lưới N×N, mỗi ô mang một giá trị `CellState` (Empty / Mark / Dog / WrongMark). Biểu diễn bằng **mảng phẳng giá trị enum** — không tạo object cho từng ô (nguyên tắc 2.8) |
| Owner | Board System (`gameplay/board/`) bên trong Puzzle Session |
| Lifetime | Puzzle Session — tạo khi vào màn (dựng mới từ PuzzleData hoặc restore từ BoardSaveData), hủy khi Disposed |
| Read by | Gameplay (Placement Check, kiểm tra Solved, Hint); UI qua API chỉ đọc và qua payload event |
| Written by | **Duy nhất** Board System, khi xử lý Intent hợp lệ hoặc khi restore |
| Khi nào thay đổi | Mỗi nước đi (Mark / Dog / Wrong Mark / Place Dog / Restart); một lần lúc restore |
| Save | Không trực tiếp — được chụp thành BoardSaveData sau mỗi thay đổi (02 — mục 9.2) |

**Ô khóa (pre-placed):** Board System giữ thêm tập ô pre-placed đọc từ PuzzleData. Mọi Intent nhắm vào ô này đều bị từ chối, và Restart không xóa chúng (02 — mục 1.1). Tập này **bất biến trong suốt ván** và suy ra được từ PuzzleData, nên **không cần lưu** trong BoardSaveData (nguyên tắc 2.4).

Cùng nhóm này còn có **trạng thái phiên** đi kèm board (không phải model có tên riêng, sống trong Puzzle Session): mistake còn lại và số lượt Place Dog khả dụng của session (nạp từ inventory lúc khởi tạo — 03 — ch.3.5).

> **Hint không có state.** Hint được suy ra từ (solution + trạng thái board hiện tại) mỗi lần người chơi bấm — nó là hàm thuần, không đếm "đã dùng hint thứ mấy" (03 — ch.3.5). Vì vậy không có "chỉ số hint" ở cả BoardData lẫn BoardSaveData: resume xong bấm Hint vẫn ra đúng gợi ý hợp lý cho thế cờ hiện tại. Đây là hệ quả tốt của việc bỏ hint handcrafted.

### CellData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Khái niệm logic "một ô": tọa độ (hàng, cột) + CellState. Dùng làm **payload event** (`CellChangedEvent`) và tham số API — không phải object sống lâu dài |
| Owner | Không có instance thường trực — được tạo tức thời khi phát event, bất biến |
| Lifetime | Tức thời (trong một lần phát event) |
| Read by | UI (cập nhật đúng CellView), AudioManager, SaveManager (biết có thay đổi để kích hoạt save) |
| Written by | Gameplay tạo mới mỗi lần phát — không ai sửa (payload bất biến, 03 — ch.4.2) |
| Khi nào thay đổi | Không thay đổi — mỗi thay đổi ô tạo một payload mới |
| Save | Không — trạng thái ô đã nằm trong BoardSaveData dưới dạng mảng |

> **Vì sao CellData không phải một mảng object trong BoardData:** 121 object cho bàn 11×11, bị đọc/ghi sau mỗi nước đi, là áp lực GC vô ích trên máy tầm trung. Mảng enum phẳng + payload tức thời rẻ hơn hẳn mà không mất tính rõ ràng.

## 4.3 Nhóm Persistent

### SaveData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | **Vỏ persistence** — document duy nhất được ghi xuống storage. Gồm: `version` (số nguyên schema) + toàn bộ PlayerData. Là đơn vị của migration |
| Owner | SaveManager (quyết định thời điểm); `scripts/data/` (serialize + migration); SaveService (ghi xuống storage) |
| Lifetime | Bền trên storage; trong memory chỉ tồn tại thoáng qua tại thời điểm đọc/ghi |
| Read by | `data/` (deserialize + migration lúc boot), SaveService |
| Written by | **Duy nhất** SaveManager, thông qua `data/` và SaveService |
| Khi nào thay đổi | Mỗi save trigger (02 — mục 9.2); luôn ghi nguyên tử toàn document |
| Save | Chính nó là thứ được lưu |

> **Vì sao tách SaveData khỏi PlayerData:** `version` là chi tiết của cơ chế persistence, không phải dữ liệu nghiệp vụ. Tách vỏ riêng thì Gameplay/Manager không bao giờ nhìn thấy version, và sau này thêm metadata persistence (vd `savedAt` phục vụ xử lý xung đột Cloud Save) chỉ đụng vỏ, không đụng PlayerData. *(Điều chỉnh so với 03 — ch.7.3: version chuyển từ PlayerData lên SaveData.)*

### PlayerData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Document nghiệp vụ gốc — toàn bộ trạng thái bền của người chơi, chia nhánh: `progression` (LevelProgressData), `daily` (DailyPuzzleData), `settings` (GameSettingsData), `inventory` (số lượt Place Dog), `boardInProgress` (BoardSaveData — có thể rỗng). Theo 03 — ch.7.3 |
| Owner | SaveManager giữ instance duy nhất trong memory (nạp lúc boot, sau migration) |
| Lifetime | Toàn bộ app |
| Read by | GameManager (điều phối: cấp lượt Place Dog vào session, kiểm tra trạng thái daily); Progression đọc nhánh progression; AudioManager nhận settings lúc boot; UI **không** đọc trực tiếp (qua API chỉ đọc / event) |
| Written by | Không có chủ ghi "cả document" — **mỗi nhánh có đúng một chủ ghi** (ma trận chương 9) |
| Khi nào thay đổi | Khi một nhánh thay đổi (xem từng nhánh) |
| Save | Có — toàn bộ, nguyên tử, bên trong SaveData |

> **Vì sao inventory không phải model riêng:** MVP có hai loại tài nguyên — lượt Place Dog và lượt Hint — mỗi loại một trường số nguyên trong `inventory` của PlayerData. Vẫn quá đơn giản để cần InventoryData riêng; tách khi có cơ chế phức tạp hơn (số lượng lớn, hết hạn, nhiều tiền tệ) — tách trước là over-engineering (03 — ch.1.8).

### LevelProgressData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Tiến trình campaign: **tập levelId đã hoàn thành**. Trạng thái unlocked được suy ra: level đầu tiên trong LevelListConfig chưa hoàn thành chính là level đang mở (mở khóa tuyến tính — 02 mục 5) |
| Owner | Nhánh `progression` của PlayerData |
| Lifetime | Toàn bộ app (theo PlayerData) |
| Read by | Progression (Gameplay); UI Level Select qua API chỉ đọc của Progression (03 — ch.8.2); GameManager |
| Written by | **Duy nhất** Progression System (Gameplay) — khi puzzle campaign được giải |
| Khi nào thay đổi | Khi `PuzzleSolvedEvent` với context campaign: ghi nhận level hoàn thành (đồng nghĩa mở level kế) |
| Save | Có |

> **Vì sao lưu tập levelId thay vì "chỉ số cao nhất đã đạt":** khi content update chèn level mới vào giữa campaign, save theo id không bị vỡ; và không tồn tại hai bản ghi "completed" / "unlocked" để lệch nhau (nguyên tắc 2.4). Trade-off là save lớn hơn vài chục byte — không đáng kể.

### DailyPuzzleData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Trạng thái Daily Puzzle: streak hiện tại, **ngày hoàn thành gần nhất** (ngày local, dạng chuỗi ngày không kèm giờ), số lần streak recovery đã dùng. "Hôm nay đã xong chưa" suy ra bằng so sánh ngày (nguyên tắc 2.4) |
| Owner | Nhánh `daily` của PlayerData |
| Lifetime | Toàn bộ app (theo PlayerData) |
| Read by | DailyPuzzleService (tính streak / recovery / chọn puzzle), GameManager, UI (qua event `DailyRewardGrantedEvent` và API chỉ đọc) |
| Written by | **Duy nhất** DailyPuzzleService (trong flow do GameManager gọi — 03 — ch.6.3) |
| Khi nào thay đổi | Hoàn thành daily (streak +1, cập nhật ngày); phát hiện bỏ lỡ ngày khi mở game (dùng recovery hoặc reset streak — 02 mục 3) |
| Save | Có |

### GameSettingsData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Cài đặt của người chơi trong MVP: âm lượng BGM, âm lượng SFX. Dùng giá trị mức âm lượng (0..1) — bao được cả nhu cầu bật/tắt lẫn slider; UI cụ thể do tài liệu 07 quyết định |
| Owner | Nhánh `settings` của PlayerData |
| Lifetime | Toàn bộ app (theo PlayerData) |
| Read by | AudioManager (áp dụng lúc boot — 03 — ch.10.1 — và khi nghe `SettingsChangedEvent`); UI Settings hiển thị giá trị hiện tại qua API chỉ đọc |
| Written by | **Duy nhất** GameManager — nhận yêu cầu từ Settings UI, cập nhật rồi phát `SettingsChangedEvent` (03 — ch.4.3) |
| Khi nào thay đổi | Người chơi thao tác trong Settings |
| Save | Có |

### BoardSaveData

| Thuộc tính | Mô tả |
|---|---|
| Purpose | Snapshot ván đang dở để resume đúng chỗ cũ (02 — mục 9): puzzleId, context (campaign / daily — **với daily kèm ngày của puzzle**), mảng trạng thái ô, mistake còn lại |
| Owner | Nhánh `boardInProgress` của PlayerData (có thể rỗng) |
| Lifetime | Từ khi ván có thay đổi đầu tiên đến khi ván kết thúc (Solved / Failed) hoặc snapshot bị hủy — khi đó nhánh về rỗng |
| Read by | GameManager (quyết định resume lúc boot); Board System (restore) |
| Written by | Nội dung snapshot do **Board System** (Gameplay) tạo — bất biến sau khi tạo; **SaveManager** chỉ gắn / thay / gỡ snapshot trong PlayerData rồi persist, không sửa nội dung bên trong |
| Khi nào thay đổi | Thay bằng snapshot mới sau mỗi nước đi; gỡ rỗng khi ván kết thúc |
| Save | Có |

Bốn quyết định thiết kế bên trong BoardSaveData:

1. **Daily kèm ngày:** khi resume, nếu ngày trong snapshot ≠ hôm nay thì hủy snapshot — vì "sang ngày mới thì thay puzzle, không chơi bù" (02 — mục 3).
2. **Không lưu dữ liệu hint:** gợi ý được tính lại từ thế cờ mỗi lần bấm. Lượt hint là **inventory toàn cục** (như Place Dog), không phải state của bàn — nên không nằm trong snapshot.
3. **Không lưu ô pre-placed:** suy ra được từ PuzzleData qua puzzleId — lưu lại là duplicate (nguyên tắc 2.4). Trạng thái ô của chúng vẫn nằm trong mảng trạng thái ô như mọi ô khác; tính "khóa" thì dựng lại từ PuzzleData lúc restore.
4. **Không lưu lượt Place Dog:** đó là inventory toàn cục của PlayerData, không thuộc về một ván — lưu ở hai nơi là duplicate (nguyên tắc 2.4).

---

# 5. Quan hệ giữa các Model

```text
CONFIG (bất biến, đóng gói theo build)
─────────────────────────────────────────────
GameConfig        LevelListConfig ──(dựng đường dẫn từ id)──► PuzzleData
(độc lập)         (số level campaign,                          ├── RegionData
                   số puzzle daily)                            ├── PuzzleSolution
                                                               └── ô pre-placed
                        │
                        │  khởi tạo board (một chiều)
                        ▼
RUNTIME (theo Puzzle Session)
─────────────────────────────────────────────
BoardData (mảng CellState) + trạng thái phiên
(mistake còn lại, lượt Place Dog của session)
        │                      ▲
        │ snapshot             │ restore
        ▼                      │
PERSISTENT (một document, ghi nguyên tử)
─────────────────────────────────────────────
SaveData (version)
  └── PlayerData
        ├── progression: LevelProgressData ──(levelId)──► LevelListConfig
        ├── daily:       DailyPuzzleData
        ├── settings:    GameSettingsData
        ├── inventory:   số lượt Place Dog
        └── boardInProgress: BoardSaveData ──(puzzleId)──► PuzzleData
```

Giải thích các quan hệ:

* **Config → Runtime là một chiều:** PuzzleData sinh ra BoardData lúc khởi tạo; BoardData không giữ tham chiếu ngược về PuzzleData ngoài `puzzleId`. Config không biết gì về runtime — nhờ vậy config được cache và chia sẻ an toàn.
* **Runtime ↔ Persistent chỉ gặp nhau qua cặp snapshot / restore:** BoardData xuất ra BoardSaveData (giá trị bất biến); BoardSaveData dựng lại BoardData khi resume. Hai model không giữ tham chiếu lẫn nhau — Puzzle Session điều phối cả hai chiều. Đây là điểm duy nhất Runtime và Persistent tiếp xúc.
* **Persistent → Config bằng id:** LevelProgressData và BoardSaveData chỉ giữ chuỗi định danh (nguyên tắc 2.5). Đổi nội dung puzzle không vỡ save.
* **Sơ đồ không có mũi tên ngược và không có chu trình** — đúng ràng buộc "tránh circular dependency" của CLAUDE.md. Model nhóm dưới không bao giờ biết nhóm trên tồn tại.

---

# 6. Ownership

Nguyên tắc: **hình dạng (shape) là của chung — instance có đúng một chủ.** Shape khai báo ở `model/` để mọi tầng cùng hiểu; nhưng mỗi instance sống trong đúng một module, module khác chỉ được đọc qua kênh cho phép.

| Model | Module sở hữu instance | Lý do |
|---|---|---|
| PuzzleData (+ RegionData, PuzzleSolution) | Service (PuzzleProvider nạp) → Puzzle Session giữ tham chiếu bản đang chơi | Provider là điểm mở duy nhất cho nguồn puzzle tương lai (03 — ch.6.1); Gameplay chỉ nhận dữ liệu đã chuẩn bị sẵn, không tự đi lấy (03 — ch.6.3) |
| GameConfig, LevelListConfig | Config (`scripts/config/`) | Giá trị tĩnh trong code, mọi tầng được đọc theo quy tắc import của 04 — mục 5 |
| BoardData + trạng thái phiên | Gameplay (Board System / Puzzle Session) | Gameplay là nơi duy nhất có quyền thay đổi trạng thái puzzle (03 — ch.2.4) |
| CellData (payload) | Gameplay tạo, phát qua Event Bus | Payload bất biến — không ai "sở hữu" lâu dài |
| SaveData | SaveManager + `data/` | SaveManager là nơi duy nhất ra lệnh persist (03 — ch.5.1) |
| PlayerData (document) | SaveManager (giữ instance) | Cần đúng một bản trong memory để ghi nguyên tử; SaveManager giữ nhưng **không sửa nội dung nghiệp vụ** |
| — nhánh progression | Gameplay (Progression System) | Mở khóa level là luật chơi, thuộc Gameplay (04 — mục 3.3) |
| — nhánh daily | Service (DailyPuzzleService) | Logic streak / recovery là nghiệp vụ của service này (03 — ch.6.1) |
| — nhánh settings | Manager (GameManager) | Settings là điều phối app, không phải luật chơi; GameManager là nơi phát `SettingsChangedEvent` (03 — ch.4.3) |
| — nhánh inventory | Manager (GameManager) | 03 — ch.3.5: "việc trừ lượt trong PlayerData do bên ngoài xử lý khi nghe event"; cấp thêm lượt khi daily reward cũng do GameManager điều phối |
| — nhánh boardInProgress | Nội dung: Gameplay tạo; vị trí trong document: SaveManager gắn/gỡ | Tách "tạo nội dung" khỏi "quyết định persist" — mỗi bên đúng một trách nhiệm |
| UI | **Không sở hữu model nào** | UI chỉ hiển thị state (CLAUDE.md); trạng thái riêng của UI (screen stack, animation) không phải data model |

---

# 7. Lifetime

| Model | Tạo | Sống trong | Hủy |
|---|---|---|---|
| GameConfig, LevelListConfig | Biên dịch theo build, sẵn sàng từ Boot | Toàn bộ app | Khi thoát app |
| PuzzleData | Nạp khi vào màn (PuzzleProvider) | Một Puzzle Session | Release asset khi session Disposed — tránh giữ JSON của puzzle cũ trong memory |
| BoardData + trạng thái phiên | Khởi tạo Puzzle Session (dựng mới hoặc restore) | Một Puzzle Session | Cùng session (Disposed) — mỗi ván một session mới, không tái sử dụng (03 — ch.3.1) |
| CellData (payload) | Lúc phát event | Một lần phát event | Ngay sau khi event xử lý xong — **cấm giữ tham chiếu lâu dài** (nếu UI cần nhớ, UI chép giá trị) |
| PlayerData (+ mọi nhánh) | Nạp lúc Boot (bước 3 — 03 — ch.10.1), sau migration | Toàn bộ app | Khi thoát app (đã persist liên tục nên không có bước "lưu lúc thoát" riêng) |
| BoardSaveData | Snapshot đầu tiên của ván | Persistent — sống qua cả việc kill app | Gỡ rỗng khi ván kết thúc hoặc snapshot hết hiệu lực (daily qua ngày) |
| SaveData | Tại thời điểm đọc/ghi | Thoáng qua trong memory; bền trên storage | Sau khi đọc/ghi xong |

Lưu ý chống rò rỉ (khớp 03 — ch.10.3): mọi model lifetime "Puzzle Session" phải được hủy tham chiếu khi session Disposed; không model nào giữ tham chiếu tới Node, Component hay asset của engine.

---

# 8. Serialization

## 8.1 Phân loại

| Loại | Model | Ghi chú |
|---|---|---|
| **Cần lưu** (ghi + đọc) | SaveData — bao trọn PlayerData, LevelProgressData, DailyPuzzleData, GameSettingsData, inventory, BoardSaveData | Thứ duy nhất được ghi xuống storage |
| **Chỉ đọc từ asset** (deserialize, không bao giờ ghi) | PuzzleData (+ RegionData, PuzzleSolution) | JSON trong `resources/data/puzzles/` |
| **Không serialize** — chỉ tồn tại runtime | BoardData, trạng thái phiên, CellData payload | Trạng thái ván nằm trong BoardSaveData khi cần bền |
| **Chỉ là config trong code** | GameConfig, LevelListConfig | Không có bước serialize nào |

## 8.2 Thiết kế SaveData để dễ mở rộng

1. **Version ở vỏ:** `version` là số nguyên tăng dần, nằm ở SaveData — không nằm trong PlayerData. Nội dung nghiệp vụ không biết gì về schema versioning.
2. **Migration tuần tự:** mỗi lần đổi schema viết một hàm migration version N → N+1 tại `scripts/data/`; save cũ được nâng cấp qua từng bậc khi nạp lúc Boot (03 — ch.10.1 bước 3). Không bao giờ sửa hàm migration cũ.
3. **Thêm nhánh mới = thêm trường có giá trị mặc định:** tính năng tương lai (achievements, theme đang chọn...) là nhánh mới trong PlayerData với default rõ ràng — đa số trường hợp không cần migration thật, chỉ cần default khi trường vắng mặt.
4. **Ghi nguyên tử toàn document:** serialize toàn bộ SaveData rồi ghi một lần (03 — ch.7.3). Không ghi từng nhánh rời rạc.
5. **Một slot duy nhất trong MVP:** chưa có nhu cầu nhiều profile; nếu cần sau này, slot là tham số của SaveService — không đổi cấu trúc SaveData.
6. **Điểm cắm Cloud Save:** giữ nguyên định dạng SaveData, thay LocalSaveService bằng CloudSaveService qua `ISaveService` (03 — ch.12); khi đó vỏ SaveData là chỗ thêm metadata xung đột (vd thời điểm lưu) mà không đụng PlayerData. Chưa thêm gì trong MVP (03 — ch.1.8).
7. **Ngày của daily lưu theo ngày local** dạng chuỗi ngày (không kèm giờ, không timezone) — đúng quyết định "ngày local của thiết bị, server time là hậu MVP" (02 — mục 3).

## 8.3 Yêu cầu với mọi model được serialize

* Chỉ chứa kiểu dữ liệu thuần (số, chuỗi, boolean, mảng, object lồng nhau).
* Không tham chiếu engine object, không hàm, không tham chiếu vòng.
* Enum persist dưới dạng giá trị ổn định — **đổi thứ tự khai báo enum không được làm hỏng save cũ** (quy ước cụ thể chốt ở tài liệu 08).

---

# 9. Quy tắc thay đổi dữ liệu

Ma trận quyền ghi — mỗi hàng có đúng **một** dấu ✓:

| Model / nhánh | Gameplay | UI | GameManager | DailyPuzzleService | SaveManager | Ghi chú |
|---|---|---|---|---|---|---|
| PuzzleData, GameConfig, LevelListConfig | ✗ | ✗ | ✗ | ✗ | ✗ | Không ai ghi — config bất biến |
| BoardData + trạng thái phiên | ✓ (chỉ Board System / Puzzle Session) | ✗ | ✗ | ✗ | ✗ | UI muốn đổi ô phải gửi Intent |
| progression (LevelProgressData) | ✓ (Progression) | ✗ | ✗ | ✗ | ✗ | |
| daily (DailyPuzzleData) | ✗ | ✗ | ✗ | ✓ | ✗ | GameManager gọi service, không tự ghi |
| settings (GameSettingsData) | ✗ | ✗ | ✓ | ✗ | ✗ | UI phát Requested event |
| inventory (lượt Place Dog + Hint) | ✗ | ✗ | ✓ | ✗ | ✗ | Đồng bộ khi nghe PlaceDogUsedEvent / HintShownEvent; cộng Place Dog khi daily reward |
| boardInProgress (BoardSaveData) | tạo nội dung | ✗ | ✗ | ✗ | ✓ gắn / gỡ | Snapshot bất biến sau khi tạo |
| SaveData (vỏ + persist) | ✗ | ✗ | ✗ | ✗ | ✓ | Qua `data/` + SaveService |

Các quy tắc kèm theo:

1. **UI không ghi bất kỳ model nào.** Mọi thao tác của người chơi đi đường Intent (vào Gameplay) hoặc Requested event (vào GameManager) — theo 03 — ch.2.4 và ch.8.2.
2. **SaveManager không sửa nội dung nghiệp vụ.** Nó chỉ: giữ document, gắn/gỡ snapshot, serialize, ra lệnh persist. Nó không "sửa giùm" bất kỳ giá trị nào — kể cả khi restore gặp dữ liệu bất thường (khi đó báo qua kết quả nạp để GameManager quyết định).
3. **Gameplay không biết SaveData tồn tại.** Gameplay chỉ tạo snapshot BoardSaveData khi được hỏi (qua API công khai của Puzzle Session — Manager được phép gọi theo 03 — ch.8.1) và phát event; việc persist là của SaveManager.
4. **Luồng ghi chuẩn của một nước đi:** UI gửi Intent → Board System đổi BoardData → phát `CellChangedEvent` → SaveManager (nghe event) lấy snapshot qua API công khai → gắn vào document → persist. Đúng luồng một chiều 03 — ch.2.4, không nhánh nào ghi chéo.

---

# 10. Mapping với Folder Structure

Theo đúng ba vai của Data tier trong 04 — mục 3.2 ("shape / giá trị / cơ chế"):

| Vị trí | Chứa gì | Lý do |
|---|---|---|
| `scripts/model/` | Shape của: PuzzleData, RegionData, PuzzleSolution, SaveData, PlayerData, LevelProgressData, DailyPuzzleData, GameSettingsData, BoardSaveData | Khai báo kiểu thuần, không logic — đúng tiêu chí đặt file #2 của 04 — mục 4 |
| `scripts/core/` | Enum `CellState` + kiểu tọa độ ô dùng chung | Enum và common type thuộc `core/` theo 04 — mục 3.2; Gameplay, UI, event đều cần |
| `scripts/event/` | Kiểu payload cụ thể của từng event (trong đó có payload mang dữ liệu ô — khái niệm CellData) | 04 — mục 3.2: `event/` chứa "danh mục toàn bộ event + kiểu payload". Không tạo file model riêng cho CellData |
| `scripts/config/` | GameConfig, LevelListConfig | Giá trị tĩnh tuning — tiêu chí #3 của 04 — mục 4 |
| `scripts/data/` | Serializer của SaveData; các hàm migration theo version | Cơ chế đọc/ghi — tiêu chí #4 của 04 — mục 4 |
| `resources/data/puzzles/` | 617 file JSON campaign (`Level_{id}.json`) | Bắt buộc nằm trong `resources/` (đúng chính tả, số nhiều) vì cần load động theo id — 04 — mục 3.1 |
| `resources/data/daily/` | 154 file JSON pool daily (`Daily_{id}.json`) | Pool tách biệt campaign (02 — mục 3); cũng cần load động nên cũng nằm trong `resources/` |
| Chỉ tồn tại runtime, không có file asset | BoardData, trạng thái phiên, instance PlayerData trong memory | Được dựng từ config/save lúc chạy — không phải asset |
| Storage của thiết bị | SaveData | Nơi lưu cụ thể do LocalSaveService quyết định — chi tiết ở tài liệu 08 |

Không có `resources/data/levels/`: thứ tự campaign chính là thứ tự id 1→617, nên một file "danh sách level" sẽ là duplicate data (nguyên tắc 2.4).

---

# 11. Những lỗi cần tránh

| Lỗi | Ví dụ cụ thể trong dự án | Hậu quả |
|---|---|---|
| **Duplicate Data** | Lưu danh sách "unlocked" song song "completed"; nhúng nội dung PuzzleData vào BoardSaveData; lưu lượt Place Dog vừa trong inventory vừa trong BoardSaveData | Hai nguồn sự thật lệch nhau — bug hiển thị sai level mở khóa, resume sai lượt; save phình |
| **Circular Dependency** | BoardSaveData giữ tham chiếu object BoardData; model import từ `gameplay/` | Không serialize được; vỡ quy tắc "Data không phụ thuộc tầng nào" (03 — ch.2.7); khóa chặt khả năng test Gameplay thuần |
| **God Model** | Dồn mọi trường vào PlayerData phẳng không chia nhánh; PuzzleData chứa cả trạng thái đang chơi | Không xác định được chủ ghi cho từng phần → mọi module đụng vào một cục dữ liệu; migration thành ác mộng vì mọi thay đổi đều chạm schema tổng |
| **Mutable Config** | Gameplay ghi trạng thái ván trực tiếp vào PuzzleData; UI sửa giá trị vùng màu để đổi hiển thị | Restart / Replay nhận dữ liệu đã bẩn; config được cache chia sẻ nên một ván làm hỏng mọi ván sau; bug gần như không lần ra |
| **Đưa puzzle chưa kiểm định vào build** | Thêm file JSON mới bằng tay, bỏ qua editor tool | Puzzle vô nghiệm → người chơi kẹt cứng campaign. Puzzle nhiều nghiệm → người chơi đặt Dog đúng luật nhưng bị tính sai, Wrong Mark không xóa được chặn vĩnh viễn ô đúng → **bàn chơi hỏng không cứu được**. Đây là lỗi đã xảy ra thật với 229/1000 puzzle của bộ data gốc (02 — mục 10.3) |
| **UI sửa Runtime Data** | BoardView tự đổi CellState "cho phản hồi nhanh" trước khi Gameplay xác nhận | Hiển thị lệch luật chơi (ô hiện Dog nhưng luật chưa công nhận); phá luồng một chiều 03 — ch.2.4; hai chủ ghi trên BoardData |
| **Gameplay sửa SaveData** | Puzzle Session tự serialize và ghi storage "cho chắc" | Bypass ghi nguyên tử + version → save hỏng khi OS kill giữa chừng; Cloud Save sau này không thay được vì Gameplay đã dính chặt vào storage |
| **SaveManager sửa Gameplay Data** | SaveManager "sửa giùm" mistake counter khi thấy snapshot bất thường lúc restore | Hai chủ ghi trên trạng thái ván; luật chơi rò rỉ ra ngoài Gameplay — vi phạm trách nhiệm duy nhất của SaveManager (03 — ch.5.1) |
| **Giữ tham chiếu engine trong model** | Payload event / model chứa Node, SpriteFrame | Memory leak khi node bị hủy mà model còn sống; model không serialize được; vi phạm 03 — ch.4.2 |
| **Ghi từng phần rời rạc** | Ghi progression riêng một key, daily riêng một key | OS kill giữa hai lần ghi để lại document nửa vời — mất tính nguyên tử (nguyên tắc 2.7) |
| **Để solution lọt ra ngoài Gameplay** | Đưa PuzzleSolution vào payload `PuzzleReadyEvent` cho UI | Phá ranh giới "UI chỉ hiển thị state"; mọi module đều "biết đáp án" — không thể kiểm soát ai dùng nó; lộ đáp án ra log / công cụ debug |

---

# Phụ lục — Checklist khi thêm model mới

1. Model thuộc nhóm nào (Config / Runtime / Persistent)? — thừa hưởng toàn bộ quy tắc của nhóm.
2. Ai là **chủ ghi duy nhất**? Cập nhật ma trận chương 9.
3. Lifetime là gì? Cập nhật bảng chương 7.
4. Có cần persist không? Nếu có: thêm trường mới với giá trị mặc định vào PlayerData, cân nhắc có cần nâng version SaveData.
5. Có dữ liệu nào **suy diễn được** từ model khác không? Nếu có — không lưu (nguyên tắc 2.4).
6. Shape đặt ở `model/`, giá trị tĩnh ở `config/`, cơ chế đọc/ghi ở `data/` (chương 10).
