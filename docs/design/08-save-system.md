# Dogdoku — Save System

> Sổ tay **vận hành** hệ thống lưu trữ. Cấu trúc dữ liệu đã định nghĩa ở [05](../architecture/05-data-model.md); danh sách save trigger đã có ở [06 — mục 4.16](06-event-flow.md). Tài liệu này **không lặp lại** hai thứ đó — nó trả lời những câu hỏi khi *vận hành*: đổi schema thì làm gì, save hỏng thì sao, kiểm thử thế nào.
>
> Đối tượng đọc: người sắp đổi cấu trúc `PlayerData`, hoặc đang debug một bug mất tiến trình.

---

# 1. Bản đồ hệ thống

Bốn thành phần, mỗi thành phần một trách nhiệm — đừng trộn chúng:

| Thành phần | Vị trí | Trách nhiệm | KHÔNG làm |
|---|---|---|---|
| **SaveManager** | `manager/` | Giữ document trong memory; quyết định **khi nào** persist; gắn/gỡ snapshot board | Sửa nội dung nghiệp vụ; biết dữ liệu được lưu ở đâu |
| **SaveDataSerializer** | `data/` | Serialize; deserialize; **migration**; lấp giá trị mặc định | Biết về Gameplay, UI, hay storage |
| **ISaveService** | `service/` | Đọc/ghi chuỗi xuống storage | Biết SaveData có hình dạng gì — với nó đó chỉ là một chuỗi |
| **LocalSaveService** | `service/` | Implementation dùng `sys.localStorage` | — |

```
SaveManager  ──(SaveData)──►  SaveDataSerializer  ──(string)──►  ISaveService  ──►  storage
     ▲                                                                                  │
     └──────────────────── PlayerData (đã migrate) ◄────────────────────────────────────┘
```

**Vì sao tách `ISaveService`:** đây là điểm cắm của Cloud Save ([03 — ch.12](../architecture/03-system-architecture.md)). Thay `LocalSaveService` bằng `CloudSaveService` thì không dòng nào ở SaveManager, Gameplay hay UI phải sửa — vì với chúng, storage chỉ là "một nơi nhận chuỗi".

---

# 2. Vòng đời của một lần save

```
Gameplay đổi board
      ↓
phát CellChangedEvent (hoặc Mistake / PlaceDog / BoardRestarted)
      ↓
SaveManager (đang nghe) → lấy snapshot qua API CÔNG KHAI của PuzzleSession
      ↓
gắn snapshot vào PlayerData.boardInProgress
      ↓
serialize TOÀN BỘ SaveData (kèm version)
      ↓
LocalSaveService.write() — ghi MỘT LẦN, nguyên tử
```

**Gameplay không biết SaveManager tồn tại.** Nó chỉ phát event, và cung cấp `createSnapshot()` khi được hỏi ([05 — ch.9](../architecture/05-data-model.md)).

## 2.1 Chống ghi chồng

Save chạy **sau mỗi nước đi** ([02 — mục 9.1](../vision/02-gameplay-loop.md)), nên nhiều trigger có thể dồn vào cùng lúc — ví dụ một cú `DragMark` qua 8 ô phát 8 `CellChangedEvent` liên tiếp.

`SaveManager.persist()` **gộp** chúng: nếu đang ghi dở, lần gọi tiếp theo chỉ **xếp hàng đúng một lần ghi**, không xếp chồng vô hạn. Kết quả: 8 event → tối đa 2 lần ghi, và lần ghi cuối luôn phản ánh trạng thái mới nhất.

## 2.2 Cái bẫy thứ tự đã gặp thật

Khi ván kết thúc, snapshot phải bị **gỡ** (không còn ván dở để resume). Nếu cả GameManager (gỡ snapshot) lẫn SaveManager (persist) cùng nghe `PuzzleSolvedEvent`, kết quả **phụ thuộc handler nào chạy trước** — SaveManager chạy trước thì nó lưu lại snapshot của ván vừa xong, và lần mở app sau người chơi bị resume vào một ván đã kết thúc.

**Cách đã chốt:** SaveManager **không** nghe `PuzzleSolvedEvent` / `PuzzleFailedEvent`. GameManager gỡ snapshot rồi **gọi `persist()` tường minh**. Luồng tuần tự, không còn phụ thuộc ngầm.

> **Bài học tổng quát:** khi hai handler của cùng một event có **quan hệ nhân quả** với nhau, đừng để Event Bus quyết định thứ tự. Biến nó thành lời gọi tuần tự.

---

# 3. Playbook: đổi schema

Đây là phần chính của tài liệu này. Làm đúng thứ tự.

## 3.1 Trường hợp A — thêm một trường mới (phổ biến nhất)

Ví dụ: thêm `achievements` vào `PlayerData`.

1. Thêm trường vào `model/PlayerData.ts`.
2. Thêm **giá trị mặc định** vào `createDefaultPlayerData()`.
3. Thêm dòng đọc trường đó vào `coercePlayerData()`, **có fallback về default khi vắng mặt**.
4. **KHÔNG cần nâng `SAVE_DATA_CURRENT_VERSION`.** Save cũ thiếu trường → `coercePlayerData` tự lấp default.

**Vì sao không cần migration:** `coercePlayerData()` không cast mù (`raw as SaveData`) mà **dựng lại từng trường** với default. Đây chính là lý do nó tồn tại — nếu cast mù thì save cũ thiếu nhánh sẽ cho `undefined` lúc runtime rồi crash ở một chỗ hoàn toàn khác.

## 3.2 Trường hợp B — đổi ý nghĩa hoặc kiểu của trường cũ

Ví dụ: `completedLevelIds` từ `string[]` sang `number[]` (đã làm thật ở giai đoạn 0).

1. Nâng `SAVE_DATA_CURRENT_VERSION` lên N+1.
2. Viết hàm migration `N → N+1` trong bảng `migrations` của `SaveDataSerializer`.
3. Hàm migration **phải tăng trường `version`** trong object trả về — nếu không, vòng lặp migration sẽ phát hiện và bỏ save (kèm cảnh báo), thay vì lặp vô hạn.
4. **KHÔNG BAO GIỜ sửa hàm migration cũ.** Người chơi đang ở version 1 vẫn cần đúng hàm `1→2` như lúc nó được viết.

## 3.3 Trường hợp C — bỏ một trường

Chỉ cần xóa khỏi model và `coercePlayerData()`. Trường thừa trong save cũ sẽ bị bỏ qua khi dựng lại. Không cần migration.

## 3.4 Checklist trước khi merge thay đổi schema

☐ `createDefaultPlayerData()` có trường mới với default hợp lý
☐ `coercePlayerData()` xử lý trường mới **và** trường hợp nó vắng mặt
☐ Nếu nâng version: có hàm migration, và nó tăng `version`
☐ Không sửa hàm migration cũ
☐ Có test: nạp một save **của version cũ** và kiểm tra kết quả đúng

---

# 4. Chế độ hỏng và cách hệ thống phản ứng

`deserializeSaveData()` được thiết kế để **không bao giờ ném lỗi** — người chơi mất tiến trình còn hơn app không mở được.

| Tình huống | Phản ứng | Vì sao |
|---|---|---|
| Không có save (người chơi mới) | Dựng save mặc định | Bình thường |
| JSON hỏng, parse thất bại | Dựng save mặc định | Không cứu được gì từ chuỗi hỏng |
| `version` thiếu hoặc ≤ 0 | Dựng save mặc định | Không biết schema nào để migrate |
| Không có migration cho version đó | Dựng save mặc định **+ log warning** | Save từ nhánh dev cũ, hoặc file bị can thiệp |
| Migration không tăng `version` | Dựng save mặc định **+ log warning** | Bug trong migration — chống lặp vô hạn |
| **`version` mới hơn code** | Dựng save mặc định **+ log warning** | Người chơi hạ cấp app. Đoán bừa dữ liệu của tương lai còn nguy hiểm hơn mất nó |
| Một nhánh thiếu / sai kiểu | Lấp default cho **riêng nhánh đó**, giữ phần còn lại | Mất một phần còn hơn mất tất cả |
| Snapshot board sai kích thước hoặc có `CellState` lạ | Bỏ snapshot, **giữ nguyên progression** | Dựng ra một bàn cờ sai còn tệ hơn mất ván dở |

> **Nguyên tắc chung:** hỏng thì **lùi về giá trị an toàn**, không đoán. Và **luôn log** — người chơi mất tiến trình mà log im lặng là bug không bao giờ tìm ra.

---

# 5. Resume một ván dở

Snapshot chỉ dùng được khi khớp **đúng** ván đang vào. GameManager kiểm ba điều kiện:

1. `snapshot.context` khớp context đang vào (campaign / daily).
2. `snapshot.puzzleId` khớp id đang vào.
3. Nếu là **daily**: `snapshot.puzzleDate` phải là **hôm nay**.

Điều kiện 3 là lý do `BoardSaveData` mang theo ngày. "Sang ngày mới thì thay puzzle, không chơi bù" ([02 — mục 3](../vision/02-gameplay-loop.md)) — snapshot daily của hôm qua **phải bị bỏ**, nếu không người chơi sẽ tiếp tục một puzzle không còn là daily của hôm nay.

**Tập ô khóa (pre-placed) KHÔNG nằm trong snapshot** — nó được dựng lại từ `PuzzleData`. Suy ra được thì không lưu ([05 — nguyên tắc 2.4](../architecture/05-data-model.md)).

**Dữ liệu hint cũng không có trong snapshot** — lượt hint là inventory toàn cục, không phải state của bàn; gợi ý tính lại từ thế cờ mỗi lần ([11 — mục 7.2](../architecture/11-gameplay-system.md)).

Ở tầng UI, ván dở hiện thành thẻ **"Tiếp tục"** trên Main Menu, không tự vào thẳng ([07 — mục 4.2](07-ui-flow.md)).

---

# 6. Kiểm thử

Save là thứ hỏng **âm thầm**: bug chỉ lộ ra khi người chơi mở lại app, tức là rất lâu sau khi code sai được viết. Nên test nó nghiêm.

## 6.1 Đã có

| Nơi | Phủ gì |
|---|---|
| `BoardSystem.test.ts` | Snapshot → restore đúng từng ô; snapshot là bản **sao** (sửa board sau đó không làm bẩn snapshot); từ chối snapshot sai kích thước hoặc có `CellState` lạ |
| `PuzzleSession.test.ts` | Snapshot → resume đúng board + mistake; snapshot daily mang theo ngày |
| `SaveDataSerializer.test.ts` | **Toàn bộ 8 chế độ hỏng ở mục 4**; round-trip; migration tuần tự; migration quên tăng version; lấp default cho nhánh thiếu; lọc phần tử rác trong mảng |
| `SaveResumeFlow.test.ts` | **Vòng đời đầy đủ**: chơi → persist → storage → đọc lại → resume; ván kết thúc thì `boardInProgress` về `null`; snapshot daily hết hạn / sai puzzleId bị từ chối |

**Khe tiêm cho test migration:** `deserializeSaveData()` nhận thêm tham số tùy chọn `{ migrations, currentVersion }`, **chỉ dùng trong test**. Lý do: bảng `migrations` thật hiện rỗng (mới có version 1), nên hai nhánh quan trọng nhất — migration chạy đúng thứ tự, và migration bị lỗi — sẽ **không kiểm chứng được cho tới lần đổi schema đầu tiên**. Mà đó chính là lúc ta cần chúng đã được test sẵn. Code production luôn dùng giá trị mặc định.

## 6.2 Chưa phủ — và vì sao

| Chưa test | Lý do |
|---|---|
| `SaveManager.persist()` gộp ghi chồng | `SaveManager` là Cocos Component (import `cc`), cần stub engine để test. Logic gộp đơn giản; test tương đương ở tầng dữ liệu đã có trong `SaveResumeFlow.test.ts` |
| `GameManager` gỡ snapshot khi ván kết thúc | Tương tự — cần stub `cc`. Hành vi dữ liệu đã được phủ ở `SaveResumeFlow.test.ts` |
| `LocalSaveService` (`sys.localStorage`) | Adapter mỏng; thay bằng `FakeStorage` trong test tích hợp |

Nếu sau này cần phủ nốt, cách rẻ nhất là alias module `cc` sang một stub trong `vitest.config.ts` — chưa làm vì lợi ích chưa xứng chi phí bảo trì stub.

---

# 7. Những lỗi cần tránh

| Lỗi | Hậu quả |
|---|---|
| `raw as SaveData` thay vì dựng lại từng trường | Save cũ thiếu nhánh → `undefined` lúc runtime, crash ở chỗ hoàn toàn khác, cực khó lần |
| Gameplay tự gọi SaveManager để lưu | Bỏ qua ghi nguyên tử; Cloud Save sau này không thay được vì Gameplay đã dính chặt storage |
| SaveManager "sửa giùm" dữ liệu bất thường lúc restore | Luật chơi rò rỉ ra ngoài Gameplay; hai chủ ghi trên cùng một trạng thái |
| Ghi từng nhánh vào từng key riêng | OS kill giữa hai lần ghi để lại document nửa vời — mất tính nguyên tử |
| Sửa hàm migration cũ | Người chơi đang ở version cũ nâng cấp lên sẽ nhận dữ liệu sai |
| Migration quên tăng `version` | Vòng lặp migration — đã có guard chặn, nhưng người chơi vẫn mất save |
| Lưu dữ liệu **suy ra được** (danh sách unlocked, tập ô khóa, chỉ số hint) | Hai nguồn sự thật, sớm muộn lệch nhau |
| **Đổi thứ tự giá trị trong `enum CellState`** | Mọi save cũ hiểu sai bàn chơi — enum này được persist dưới dạng số |
