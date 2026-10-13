# Dogdoku — Gameplay System

> Thiết kế chi tiết Gameplay Core. Chi tiết hóa [03 — ch.3](03-system-architecture.md), dùng model của [05](05-data-model.md), luật chơi của [02](../vision/02-gameplay-loop.md), event của [06](../design/06-event-flow.md).
>
> Đây là tài liệu **thiết kế** — không chứa code, không chứa interface TypeScript.

---

# 1. Mục tiêu và phạm vi

## 1.1 Gameplay Core là gì

Gameplay Core trả lời đúng một câu hỏi: **"điều gì xảy ra trong trò chơi"**. Nó không trả lời "hiển thị điều đó như thế nào".

Toàn bộ luật chơi nằm ở đây và **chỉ** ở đây. Không một luật nào được rò rỉ sang UI, Manager hay Service.

## 1.2 Ràng buộc nền tảng

* **TypeScript thuần.** Không import `Node`, `Component`, `Sprite`, `Tween`, hay bất kỳ API nào của Cocos Creator ([03 — ch.3.1](03-system-architecture.md)). Hệ quả: toàn bộ luật chơi test được mà không cần dựng engine.
* **Đầu vào là Intent** — yêu cầu trừu tượng do UI gửi tới (mục 4).
* **Đầu ra là Event** — thông báo việc đã xảy ra (mục 10).
* **Không phụ thuộc Service.** Gameplay không tự đi lấy PuzzleData; Manager nạp sẵn rồi truyền vào ([03 — ch.6.3](03-system-architecture.md)).

## 1.3 Phạm vi

**Thuộc phạm vi:** Puzzle Session và 5 hệ thống con (Board, Validation, Assist, State Machine, Progression).

**Không thuộc phạm vi:** gesture detection (thuộc UI — mục 4.1), nạp file JSON (thuộc PuzzleProvider), quyết định thời điểm persist (thuộc SaveManager), điều phối màn hình (thuộc GameManager).

---

# 2. Kiến trúc tổng thể

```text
                    UI (BoardView, HUD)
                          │
                          │  Intent (mục 4)
                          ▼
        ┌─────────────────────────────────────────┐
        │           PUZZLE SESSION                │
        │  (điều phối một ván; sở hữu mọi thứ dưới)│
        │                                          │
        │  ┌────────────────────────────────────┐ │
        │  │ Board System        (mục 5)        │ │
        │  │  — trạng thái ô, ô khóa, snapshot  │ │
        │  └────────────────────────────────────┘ │
        │  ┌────────────────────────────────────┐ │
        │  │ Placement Check     (mục 6)        │ │
        │  │ Mistake Counter     (mục 6.3)      │ │
        │  └────────────────────────────────────┘ │
        │  ┌────────────────────────────────────┐ │
        │  │ Assist: Place Dog / Hint / Restart │ │
        │  │                     (mục 7)        │ │
        │  └────────────────────────────────────┘ │
        │  ┌────────────────────────────────────┐ │
        │  │ Puzzle State Machine (mục 8)       │ │
        │  └────────────────────────────────────┘ │
        └─────────────────────────────────────────┘
                          │
                          │  Event (mục 10)
                          ▼
         Event Bus → UI, AudioManager, SaveManager, GameManager
```

**Progression** (mở khóa level) sống **ngoài** Puzzle Session: nó tồn tại xuyên suốt app, không thuộc về một ván. Xem mục 11.

## 2.1 Vì sao Puzzle Session là ranh giới

Mỗi ván chơi là **một Puzzle Session độc lập**: tạo mới khi vào màn, hủy hoàn toàn khi rời màn, **không tái sử dụng** ([03 — ch.3.1](03-system-architecture.md)).

Lý do: không có session nào mang trạng thái rác sang ván sau. Đây là cách rẻ nhất để loại bỏ cả một lớp bug "ván trước ảnh hưởng ván sau" — thay vì phải nhớ reset đúng từng biến, ta vứt cả object đi.

Puzzle Session cũng là **ranh giới hủy listener**: khi Disposed, nó gọi một lệnh hủy toàn bộ listener của mình (`targetOff`), không hủy rải rác từng cái ([03 — ch.4.4](03-system-architecture.md)).

---

# 3. Dữ liệu đầu vào của một Session

Puzzle Session được khởi tạo với đúng ba thứ, do GameManager chuẩn bị:

| Đầu vào | Nguồn | Vai trò |
|---|---|---|
| **PuzzleData** | PuzzleProvider nạp từ JSON | Kích thước, vùng màu, solution, ô pre-placed |
| **Context + số lượt Place Dog** | GameManager đọc từ PlayerData | `campaign` / `daily`; số lượt assist khả dụng |
| **BoardSaveData** (tùy chọn) | GameManager đọc từ PlayerData | Snapshot để resume; rỗng nếu là ván mới |

Puzzle Session **không** biết PlayerData tồn tại. Nó nhận số lượt Place Dog như một con số, và khi dùng thì phát event — việc trừ lượt trong PlayerData là của GameManager ([05 — ch.9](05-data-model.md)).

---

# 4. Intent Catalog

Intent là **yêu cầu trừu tượng** — nó mô tả người chơi *muốn gì*, không mô tả họ *chạm thế nào*.

## 4.1 Ranh giới UI / Gameplay

| Phần | Tầng | Trách nhiệm |
|---|---|---|
| Gesture Detection | **UI** | Nhận touch thô, phân biệt Single Tap / Double Tap / Drag theo Interaction Priority ([02 — mục 1.1](../vision/02-gameplay-loop.md)), quy đổi tọa độ chạm → chỉ số ô |
| Intent Handling | **Gameplay** | Nhận Intent, thực thi luật chơi |

Ngưỡng nhận diện double tap và drag đọc từ **GameConfig**, không hard-code.

**Vì sao tách:** Gameplay không phụ thuộc hệ thống input của engine → test được bằng cách gửi Intent trực tiếp. Thêm phương thức input mới (chuột, bàn phím khi debug) không đụng vào luật chơi.

## 4.2 Danh mục Intent của MVP

Đây là **danh mục đầy đủ** — thêm Intent mới phải cập nhật bảng này trước khi viết code.

| Intent | Tham số | Sinh ra từ | Ý nghĩa |
|---|---|---|---|
| **ToggleMark** | chỉ số ô | Single Tap | Bật/tắt Mark trên một ô trống |
| **DragMark** | danh sách chỉ số ô + chế độ (`mark` \| `erase`) | Drag | Đặt hoặc xóa Mark trên nhiều ô cùng lúc |
| **PlaceDogAttempt** | chỉ số ô | Double Tap | Thử đặt Dog — chạy Placement Check |
| **UsePlaceDog** | *(không có)* | Nút Place Dog | Dùng một lượt assist: đặt hộ một Dog đúng |
| **ShowHint** | *(không có)* | Nút Hint | Xin gợi ý hướng suy luận |
| **Restart** | *(không có)* | Nút Restart | Đưa board về trạng thái ban đầu |

**Không có Intent Undo** — đã loại khỏi kiến trúc ([03 — ch.11](03-system-architecture.md) quyết định #2).

## 4.3 Thiết kế DragMark

Drag đặt ra một câu hỏi mà 02 chưa chốt hết: kéo qua một ô **đang có Mark** thì sao?

**Quyết định: chế độ được xác định bởi ô ĐẦU TIÊN của cú drag.**

* Ô đầu tiên đang `Empty` → chế độ **mark**: mọi ô `Empty` đi qua đều thành `Mark`. Ô không `Empty` bị bỏ qua.
* Ô đầu tiên đang `Mark` → chế độ **erase**: mọi ô `Mark` đi qua đều thành `Empty`. Ô khác bị bỏ qua.

**Vì sao không toggle từng ô:** toggle khiến việc kéo qua một vùng lẫn lộn Empty/Mark cho ra kết quả loang lổ không đoán trước được. Chốt chế độ ngay từ ô đầu là hành vi chuẩn của thể loại này và đúng mô tả "thao tác ngược lại để xóa bỏ các ô đánh dấu X" ([02 — mục 1.1](../vision/02-gameplay-loop.md)).

**Vì sao DragMark mang danh sách ô + chế độ, thay vì gửi nhiều ToggleMark:** `ToggleMark` bật/tắt tuỳ trạng thái hiện tại của ô, nên gửi lẻ sẽ cho kết quả loang lổ. `DragMark` mang **chế độ tường minh** trong payload, nên mọi ô đi qua đều nhận cùng một thao tác. Gameplay cũng phân biệt được "kéo" với "chạm nhiều lần".

**DragMark được gửi NHIỀU LẦN trong một cú kéo, không phải một lần lúc nhấc tay.** Mỗi khi ngón tay đi qua ô mới, UI gửi ngay một `DragMark` chứa **các ô mới vừa đi qua** — người chơi phải thấy dấu X xuất hiện ngay dưới ngón tay đang di chuyển. Gom cả cú kéo rồi gửi một lần ở cuối thì cả vệt bật lên đột ngột sau khi nhấc tay, mất hoàn toàn cảm giác "vẽ".

Chế độ **cố định theo ô đầu** trong suốt cú kéo, nên nhiều Intent liên tiếp vẫn cho kết quả nhất quán. UI cũng **nội suy** đường đi giữa hai lần `TOUCH_MOVE` — ngón tay lướt nhanh có thể nhảy cóc qua vài ô, không nội suy thì vệt kéo bị thủng lỗ.

Drag **không bao giờ** đặt Dog và **không bao giờ** sinh mistake.

## 4.4 Quy tắc từ chối Intent

Intent bị **từ chối im lặng** (không đổi board, không phát event) khi:

1. **Puzzle State không phải Ready hoặc Playing** — Solved / Failed / Disposed là trạng thái kết thúc, mọi Intent bị chặn ([03 — ch.3.6](03-system-architecture.md)).
2. **Ô đích là ô khóa (pre-placed)** — [02 — mục 1.1](../vision/02-gameplay-loop.md).
3. **Ô đích đang là `Dog` hoặc `WrongMark`** — cả hai chỉ gỡ được bằng Restart.
4. **`UsePlaceDog` khi hết lượt.**

Từ chối là **im lặng**, không phải lỗi: người chơi chạm nhầm là chuyện bình thường, không có gì để thông báo. Nhưng Intent bị từ chối vì lý do **1** thì ghi log warning — đó là dấu hiệu UI không khóa board đúng lúc.

---

# 5. Board System

## 5.1 Trạng thái

| Thành phần | Mô tả | Khả biến |
|---|---|---|
| Kích thước N | 4 → 11 | Bất biến trong ván |
| Bản đồ vùng màu | mảng phẳng N×N, region id mỗi ô | Bất biến (đọc từ PuzzleData) |
| Trạng thái ô | mảng phẳng N×N giá trị `CellState` | **Khả biến** |
| Tập ô khóa | các ô pre-placed | Bất biến trong ván |

`CellState` = `Empty | Mark | Dog | WrongMark`.

**Quy ước tọa độ:** chỉ số phẳng row-major — `index = row * N + col`. Dùng thống nhất ở PuzzleData, BoardData, BoardSaveData và mọi payload event ([05 — mục 4.1](05-data-model.md)).

**Biểu diễn:** mảng phẳng giá trị enum, **không** phải mảng object. Bàn lớn nhất 11×11 = 121 giá trị; tạo 121 object rồi đọc/ghi sau mỗi nước đi là áp lực GC vô ích trên máy tầm trung ([05 — nguyên tắc 2.8](05-data-model.md)).

## 5.2 Khởi tạo

**Ván mới:**
1. Mọi ô = `Empty`.
2. Áp ô pre-placed: `prePlacedDogs` → `Dog`, `prePlacedMarks` → `Mark`.
3. Ghi nhận tập ô khóa = `prePlacedDogs` ∪ `prePlacedMarks`.

**Resume từ snapshot:**
1. Nạp mảng trạng thái ô từ BoardSaveData.
2. Ghi nhận tập ô khóa **dựng lại từ PuzzleData**, không lấy từ snapshot — snapshot không lưu tập này vì nó suy ra được ([05 — ch.4.3](05-data-model.md)).
3. Nạp mistake còn lại từ snapshot.

## 5.3 Trách nhiệm

Board System **chỉ** cung cấp thao tác nguyên tử: đổi trạng thái một ô, truy vấn trạng thái một ô, xuất snapshot, nạp snapshot.

Nó **không chứa** luật thắng/thua, không biết solution, không biết ô được hiển thị thế nào. Việc quyết định "ô này được phép thành Dog không" là của Placement Check, không phải của Board.

**Vì sao tách:** giữ Board thành một cấu trúc dữ liệu ngu ngốc và đáng tin. Mọi luật chơi tập trung ở một chỗ khác, nên khi luật đổi ta biết chính xác phải sửa ở đâu.

---

# 6. Validation System

## 6.1 Placement Check

Khi nhận `PlaceDogAttempt` tại ô X:

```text
X có nằm trong PuzzleSolution không?
    │
    ├── CÓ  → Board: X → Dog (thay Mark nếu đang có)
    │         phát CellChangedEvent
    │         → kiểm tra hoàn thành (6.4)
    │
    └── KHÔNG → Board: X → WrongMark
                Mistake Counter − 1
                phát CellChangedEvent (kèm lý do sai)
                phát MistakeChangedEvent
                → kiểm tra thất bại (6.4)
```

**Check theo solution, không theo luật.** Đây là quyết định #1 của [03 — ch.11](03-system-architecture.md), và nó chỉ đúng nhờ một bất biến: **mỗi puzzle có đúng một lời giải duy nhất**, được kiểm chứng bằng máy lúc build data ([02 — mục 10.3](../vision/02-gameplay-loop.md)).

Nếu bất biến đó bị vi phạm, người chơi có thể đặt Dog đúng luật nhưng trúng nghiệm khác với nghiệm ta lưu → bị tính sai → WrongMark (không xóa được) chặn vĩnh viễn ô đúng → **bàn chơi hỏng không cứu được**.

## 6.2 "Lý do sai"

Bốn luật của puzzle (hàng / cột / vùng / kề nhau) **không** dùng để phán định đúng sai lúc chơi. Chúng chỉ dùng để cung cấp thông tin *vì sao ô này sai* trong payload `CellChangedEvent`, để UI có thể highlight.

Khi tạo WrongMark tại ô X, tìm xung đột với các **Dog đã đặt trên bàn**:

| Xung đột | Điều kiện |
|---|---|
| Hàng | Đã có Dog cùng hàng với X |
| Cột | Đã có Dog cùng cột với X |
| Vùng | Đã có Dog cùng vùng màu với X |
| Kề nhau | Có Dog nằm trong 8 ô bao quanh X |

**Có thể không tìm được xung đột nào** — X sai (không thuộc solution) nhưng chưa xung đột với Dog nào hiện có. Khi đó lý do sai là **rỗng**, và UI chỉ hiện X đỏ không highlight gì. Đây là trạng thái hợp lệ, không phải bug.

UI **quyết định** có highlight hay không; Gameplay chỉ cung cấp thông tin.

## 6.3 Mistake Counter

* Giá trị khởi đầu: đọc từ **GameConfig** (hiện là 3), không hard-code.
* Giảm 1 **chỉ khi** tạo WrongMark. `UsePlaceDog` không bao giờ trừ mistake.
* Về 0 → Puzzle Failed.
* Restart đưa về giá trị khởi đầu.

## 6.4 Kiểm tra kết thúc

Chạy **sau mỗi thay đổi board**:

* **Số Dog trên bàn = N** → Solved.
* **Mistake Counter = 0** → Failed.

Vì mọi Dog đã đặt đều đúng (hệ quả của 6.1), hoàn thành puzzle = **đếm đủ N Dog**. Không cần bước validate toàn bàn cuối cùng.

**Ô pre-placed Dog được tính vào N.** Puzzle có 1 pre-placed Dog thì người chơi chỉ cần đặt N−1 Dog nữa.

---

# 7. Assist Systems

## 7.1 Place Dog

Khi nhận `UsePlaceDog`:

1. Còn lượt không? Hết → từ chối im lặng.
2. Chọn **một** vị trí trong solution chưa có Dog.
3. Board: ô đó → `Dog` (dùng chung cơ chế với 6.1, thay Mark nếu có).
4. Trừ 1 lượt **của session**.
5. Phát `CellChangedEvent` + `PlaceDogUsedEvent` (kèm số lượt còn lại).
6. Kiểm tra hoàn thành như 6.4.

**Không tính mistake** — đây là công cụ chống bí, không phải một nước đi.

**Chọn vị trí nào?** Chọn ô đúng **có chỉ số nhỏ nhất** trong số chưa đặt. Quyết định này là tùy ý nhưng phải **tất định**: cùng một thế cờ luôn cho ra cùng một gợi ý, nên bug tái hiện được và test viết được.

**Lượt đã dùng không hoàn lại khi Restart** ([03 — ch.11](03-system-architecture.md) quyết định #9) — chặn khai thác: dùng lượt để biết vị trí đúng, rồi Restart để lấy lại lượt.

Việc trừ lượt trong **PlayerData** do GameManager làm khi nghe `PlaceDogUsedEvent` — Gameplay chỉ trừ con số của riêng session mình.

## 7.2 Hint

Hint **suy ra lúc runtime** từ (solution + trạng thái board hiện tại). Việc **tính ra** gợi ý là hàm thuần — không đếm "đã dùng hint thứ mấy" cho một puzzle cụ thể ([03 — ch.3.5](03-system-architecture.md)).

Hint **chỉ ra hướng**, **không đặt Dog hộ**. Đây là điểm phân biệt với Place Dog.

**Hint là VẬT PHẨM CÓ HẠN** (theo game tham chiếu). Số lượt là inventory toàn cục, song song Place Dog:

* Lượt nạp vào session lúc khởi tạo (đọc từ PlayerData). Hết lượt → từ chối im lặng.
* **Không trừ lượt khi không còn gợi ý để hiện** (bước 3 dưới): không tính phí cho một gợi ý rỗng.
* Việc trừ trong PlayerData do GameManager làm khi nghe `HintShownEvent`.
* Lượt **không hoàn lại khi Restart** — nó là inventory toàn cục, không phải state của bàn. Vì vậy board snapshot vẫn KHÔNG chứa dữ liệu hint (05 — mục 4.3 vẫn đúng).

### Thuật toán

Định nghĩa: một ô là **khả dĩ** nếu nó chưa có Dog, không phải WrongMark, và không bị bất kỳ Dog nào đang có trên bàn chiếu tới (không cùng hàng, không cùng cột, không cùng vùng, không kề — kể cả chéo).

Chạy lần lượt, dừng ở bước đầu tiên tìm được kết quả:

**Bước 1 — nhóm bị ép buộc.** Duyệt mọi hàng, cột và vùng màu **chưa có Dog**. Tìm nhóm nào chỉ còn **đúng một** ô khả dĩ. Trả về nhóm đó để UI highlight.
*Đây là gợi ý mạnh nhất: người chơi tự nhìn ra ô duy nhất còn lại, tự suy luận, tự đặt.*

**Bước 2 — lùi về gợi ý yếu.** Nếu không nhóm nào bị ép buộc, chọn **vùng màu chưa có Dog** mà ô đúng của nó (theo solution) chưa được đặt, và có **ít ô khả dĩ nhất**. Trả về vùng đó.
*Không chỉ thẳng ra ô, nhưng thu hẹp phạm vi người chơi cần nghĩ.*

**Bước 3 — không còn gì để gợi ý.** Nếu mọi ô đúng đã được đặt (board sắp Solved), trả về **rỗng**; UI không hiện gì.

### Vì sao thiết kế thế này

Thiết kế cũ quy định hint là **danh sách nội dung handcrafted trong PuzzleData**. Bộ data thật có 771 puzzle và **không chứa hint nào** — viết tay hint cho từng puzzle là bất khả thi, và mọi puzzle bổ sung sau này (kể cả từ generator hay server) sẽ lại thiếu hint.

Hint suy luận tự động áp dụng được cho **mọi** puzzle, kể cả puzzle chưa tồn tại — đúng tinh thần "thêm puzzle không phải sửa gameplay".

**Trade-off chấp nhận:** hint mang tính cơ học (highlight nhóm), không "kể chuyện" suy luận như hint viết tay.

**Chi phí:** với N ≤ 11, thuật toán duyệt tối đa vài trăm ô — dưới 1ms, chạy khi người chơi bấm nút chứ không phải mỗi frame. Không có vấn đề hiệu năng.

## 7.3 Restart

1. Mọi ô **không khóa** → `Empty` (xóa Dog, Mark, WrongMark do người chơi điền).
2. Ô khóa (pre-placed) **giữ nguyên** ([02 — mục 1.1](../vision/02-gameplay-loop.md)).
3. Mistake Counter → giá trị khởi đầu.
4. Lượt Place Dog **không** hoàn lại.
5. Puzzle State → `Ready`.
6. Phát `BoardRestartedEvent`.

Restart phát **một** event cho cả bàn, **không** phát `CellChangedEvent` cho từng ô — nếu không, một lần Restart bàn 11×11 sẽ bắn ra 121 event.

---

# 8. Puzzle State Machine

```text
                    ┌──────── Restart ────────┐
                    ▼                         │
LOADING ──► READY ──► PLAYING ──┬──► SOLVED   │  (đặt đủ N Dog)
                        │       │             │
                        │       └──► FAILED   │  (Mistake = 0)
                        │                     │
                        └─────────────────────┘
                        │
                        └──► DISPOSED (thoát giữa chừng)

READY ──► DISPOSED     (thoát trước khi đi nước nào)
SOLVED / FAILED ──► DISPOSED
```

| Từ | Đến | Trigger |
|---|---|---|
| Loading | Ready | PuzzleData nạp xong, board dựng xong |
| Ready | Playing | Intent hợp lệ **đầu tiên** |
| Playing | Playing | Mỗi nước đi |
| **Playing** | **Ready** | **Restart** — board về trạng thái ban đầu, tức là "đã dựng xong, chưa đi nước nào": đúng định nghĩa của Ready |
| Playing | Solved | Đủ N Dog |
| Playing | Failed | Mistake = 0 |
| Ready / Playing / Solved / Failed | Disposed | Rời màn |

**Không có Restart từ Solved/Failed:** hai trạng thái đó khóa mọi Intent, kể cả Restart. Người chơi muốn chơi lại thì dùng Retry/Replay — và đó là **một Puzzle Session mới**.

**Quy tắc:**

* Intent chỉ được xử lý khi state là `Ready` hoặc `Playing`.
* `Solved` và `Failed` là **trạng thái kết thúc** — mọi Intent sau đó bị từ chối, board bị khóa.
* **Không có transition từ Solved/Failed về Loading.** Retry / Next / Replay tạo **một Puzzle Session mới**, không tái sử dụng session cũ. Session cũ chuyển `Disposed`.
* Transition không có trong bảng → bỏ qua + log warning.
* Khi vào `Disposed`: hủy **toàn bộ** listener của session bằng một lệnh, thả tham chiếu PuzzleData.

**Pause không phải PuzzleState.** Pause là khái niệm của AppState — Gameplay không biết Pause tồn tại ([02 — mục 7](../vision/02-gameplay-loop.md)).

---

# 9. API công khai của Puzzle Session

Đây là **ranh giới quyết định** Gameplay có thật sự độc lập UI hay không. Chỉ những gì liệt kê ở đây được lộ ra ngoài.

## 9.1 Nhận Intent

Một cửa duy nhất: nhận một Intent, xử lý, phát event tương ứng. Không có cửa nào khác để tác động vào board.

## 9.2 Đọc (chỉ đọc)

| Cho ai | Đọc được gì |
|---|---|
| **UI** | Kích thước N; bản đồ vùng màu; trạng thái từng ô; tập ô khóa; mistake còn lại; lượt Place Dog còn lại; PuzzleState |
| **Manager** | PuzzleState; snapshot board (để SaveManager persist) |

## 9.3 Cấm tuyệt đối lộ ra ngoài

**PuzzleSolution.** Không đưa vào bất kỳ payload event nào, không đưa vào bất kỳ API đọc nào ([05 — ch.11](05-data-model.md)).

Chỉ Placement Check, Place Dog và Hint được đọc solution — cả ba đều nằm **trong** Gameplay. Lộ solution ra ngoài là mất kiểm soát: mọi module đều "biết đáp án", và nó sẽ xuất hiện trong log hoặc công cụ debug.

## 9.4 Xuất snapshot

Puzzle Session xuất **BoardSaveData** khi được hỏi. Nội dung snapshot **bất biến sau khi tạo**.

SaveManager gọi API này khi nghe save-trigger event, rồi tự gắn vào PlayerData và persist. Gameplay **không biết SaveData tồn tại** ([05 — ch.9](05-data-model.md)).

---

# 10. Event phát ra

Gameplay phát đúng 8 event trong danh mục ([03 — ch.4.3](03-system-architecture.md)) — không thêm event mới:

| Event | Khi nào |
|---|---|
| `PuzzleReadyEvent` | Loading → Ready |
| `CellChangedEvent` | Mỗi ô đổi trạng thái (trừ Restart) |
| `MistakeChangedEvent` | Ngay sau khi tạo WrongMark |
| `PlaceDogUsedEvent` | Sau khi Place Dog đặt xong |
| `HintShownEvent` | Sau khi suy ra được gợi ý |
| `BoardRestartedEvent` | Sau Restart |
| `PuzzleSolvedEvent` | Playing → Solved |
| `PuzzleFailedEvent` | Playing → Failed |

**Payload không bao giờ chứa:** Node, Component, tham chiếu engine, PuzzleSolution, hay tham chiếu tới trạng thái nội bộ có thể đổi sau.

---

# 11. Progression (ngoài Puzzle Session)

Progression **không** thuộc Puzzle Session — nó sống xuyên suốt app, vì tiến trình campaign không thuộc về một ván nào.

| Thuộc tính | Mô tả |
|---|---|
| Trách nhiệm | Ghi nhận level hoàn thành; suy ra level đang mở |
| Chủ ghi | **Duy nhất** Progression ghi `LevelProgressData` ([05 — ch.9](05-data-model.md)) |
| Kích hoạt | Nghe `PuzzleSolvedEvent` với context `campaign` |
| Suy ra "unlocked" | Level đầu tiên (theo id 1→617) **chưa hoàn thành** chính là level đang mở. Không lưu riêng ([05 — nguyên tắc 2.4](05-data-model.md)) |
| API đọc | UI Level Select hỏi qua đây, **không** đọc PlayerData trực tiếp ([03 — ch.8.2](03-system-architecture.md)) |

Puzzle context `daily` **không** đụng Progression — daily có luồng riêng qua DailyPuzzleService.

---

# 12. Kế hoạch kiểm thử

Vì Gameplay là TypeScript thuần, toàn bộ test chạy được **không cần engine** — gửi Intent, kiểm tra state và event phát ra.

## 12.1 Bắt buộc có

| Nhóm | Ca kiểm thử |
|---|---|
| **Placement Check** | Đặt đúng → Dog; đặt sai → WrongMark + mistake −1; đặt lên ô đã có Dog → từ chối; đặt lên WrongMark → từ chối; đặt lên ô khóa → từ chối |
| **Mark** | Toggle Empty ↔ Mark; đặt Dog đúng lên ô đang có Mark → thay bằng Dog |
| **DragMark** | Ô đầu Empty → chế độ mark, chỉ đổi ô Empty; ô đầu Mark → chế độ erase, chỉ đổi ô Mark; drag qua ô khóa → bỏ qua ô đó |
| **Chuỗi mistake** | 3 lần sai → Failed; board khóa; Intent sau đó bị từ chối |
| **Hoàn thành** | Dog cuối cùng → Solved; puzzle có pre-placed Dog chỉ cần đặt N−1 Dog |
| **Place Dog** | Đặt đúng vị trí, không trừ mistake; hết lượt → từ chối; **Restart không hoàn lại lượt** |
| **Hint** | Trả về nhóm chỉ còn 1 ô khả dĩ; board trống → vẫn có gợi ý; board gần xong → không crash, trả rỗng đúng lúc |
| **Restart** | Xóa hết ô người chơi điền; **giữ nguyên ô pre-placed**; mistake về đầy |
| **Snapshot / restore** | Xuất rồi nạp lại → từng ô đúng, mistake đúng, tập ô khóa dựng lại đúng từ PuzzleData |
| **State Machine** | Intent ở Solved/Failed bị từ chối; Disposed hủy sạch listener |

## 12.2 Test bất biến của data

Chạy trên **toàn bộ 771 puzzle**, không phải vài puzzle mẫu:

* Số vùng màu = kích thước lưới.
* Solution có đúng N vị trí, thỏa cả 4 luật.
* Solution là **duy nhất**.
* `prePlacedDogs` ⊆ `solution`.

Đây chính là ba phép kiểm định của [02 — mục 10.3](../vision/02-gameplay-loop.md) — chúng phải chạy được như test tự động, không chỉ như editor tool thủ công.

---

# 13. Những lỗi cần tránh

| Lỗi | Hậu quả |
|---|---|
| Gameplay import `Node` / `Component` / `Tween` | Mất khả năng test không cần engine — phá hủy lợi ích lớn nhất của kiến trúc này |
| Board System tự quyết định "ô này có được thành Dog không" | Luật chơi rải ra hai nơi; đổi luật phải sửa nhiều chỗ, sớm muộn sẽ lệch |
| Lộ PuzzleSolution qua payload event hoặc API đọc | Mọi module "biết đáp án", không kiểm soát được ai dùng; lộ ra log/debug tool |
| Restart phát `CellChangedEvent` cho từng ô | 121 event một lần Restart trên bàn 11×11 |
| Gửi nhiều `ToggleMark` thay vì một `DragMark` | Không xác định được chế độ mark/erase; Gameplay không phân biệt được drag với nhiều lần chạm |
| Tái sử dụng Puzzle Session giữa các ván | Trạng thái rác từ ván trước; listener cũ chưa hủy → rò rỉ ([01 — mục 11](../vision/01-project-overview.md)) |
| Hint đếm "đã dùng hint thứ mấy" | Tạo state không cần thiết phải lưu và phải resume — trong khi hint suy ra được từ thế cờ hiện tại |
| Gameplay gọi thẳng SaveManager để lưu | Bỏ qua ghi nguyên tử; Cloud Save sau này không thay được vì Gameplay đã dính chặt storage |
| Thêm puzzle chưa qua kiểm định | Puzzle nhiều nghiệm làm **hỏng bàn chơi vĩnh viễn** — xem mục 6.1 |
