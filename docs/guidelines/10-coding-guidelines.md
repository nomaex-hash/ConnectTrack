# Dogdoku — Coding Guidelines

> **Tài liệu này KHÔNG lặp lại CLAUDE.md.** Những nguyên tắc chung (strict mode, tránh `any`, hàm nhỏ, composition over inheritance, naming convention `xxxManager`/`xxxService`/...) đã nằm ở đó và vẫn có hiệu lực đầy đủ.
>
> Đây là phần **bổ sung**: đặc thù Cocos Creator 3.8.6, các cạm bẫy dự án đã **va phải thật**, và quy trình kiểm chứng trước khi merge.

---

# 1. Cạm bẫy đã va phải — đọc trước khi code

Mỗi mục dưới đây là một lỗi **đã thực sự xảy ra** trong dự án này. Chúng không phải lý thuyết.

## 1.1 Bẫy thứ tự handler trên Event Bus

**Triệu chứng:** hai handler cùng nghe một event, kết quả phụ thuộc handler nào đăng ký trước.

**Ví dụ thật:** khi ván kết thúc, GameManager gỡ snapshot còn SaveManager thì persist. Nếu SaveManager chạy trước, nó lưu lại snapshot của ván **vừa kết thúc** — lần mở app sau, người chơi bị resume vào một ván đã xong.

**Quy tắc:** khi hai handler của cùng một event có **quan hệ nhân quả** với nhau, **đừng để Event Bus quyết định thứ tự**. Biến nó thành lời gọi tuần tự tường minh.

**Cùng loại lỗi, chưa xảy ra nhưng sẽ xảy ra:** Popup tự nghe một event được phát **đồng bộ** bởi handler khác — popup còn chưa mở thì event đã bay qua. Đó là lý do `ResultPopup` **không nghe event nào** mà nhận dữ liệu từ UIManager ([07 — mục 3.2](../design/07-ui-flow.md)).

## 1.2 Tài liệu tự mâu thuẫn

**Triệu chứng:** hai mục trong cùng một tài liệu nói ngược nhau, và code làm theo cả hai.

**Ví dụ thật:** [11 — mục 7.3](../architecture/11-gameplay-system.md) nói Restart đưa PuzzleState về `Ready`, nhưng bảng transition ở mục 8 lại **không cho phép** `Playing → Ready`. Code làm đúng cả hai và nổ ngay khi test.

**Quy tắc:** khi một hành vi được mô tả ở **hai chỗ**, kiểm tra chúng khớp nhau trước khi code. Và **viết test song song với code** — chính test đã bắt được lỗi này.

## 1.3 Lộ dữ liệu nhạy cảm qua payload

Payload event **cấm** chứa `PuzzleSolution`. Nếu lộ, mọi module đều "biết đáp án", nó sẽ xuất hiện trong log và công cụ debug, và không ai kiểm soát được ai đang dùng nó.

Có test canh việc này: payload `PuzzleReadyEvent` không được chứa chuỗi `solution`.

## 1.4 Snapshot phải là bản SAO

`createSnapshot()` trả về mảng `cellStates` **đã copy**. Nếu trả tham chiếu tới mảng nội bộ của board, nước đi tiếp theo sẽ làm bẩn snapshot đã lưu — bug im lặng, chỉ lộ ra khi resume.

---

# 2. Đặc thù Cocos Creator 3.8.6

## 2.1 Giới hạn thư viện TypeScript

Cocos đặt `lib` target **dưới ES2017**. Các API sau **không dùng được**, dù IDE có thể không báo ngay:

| Không dùng | Dùng thay |
|---|---|
| `Array.prototype.includes` | `indexOf(x) >= 0` |
| `String.prototype.padStart` | Hàm pad tự viết |
| `Object.entries` / `Object.fromEntries` | `Object.keys` + map |

Đã va phải cả hai mục đầu. **Luôn chạy `npx tsc --noEmit` trước khi merge** — Cocos Editor không phải lúc nào cũng báo lỗi này.

## 2.2 `skipLibCheck` là bắt buộc

Typings của **chính Cocos** (`cc.d.ts`, `jsb.d.ts`) không strict-clean — chúng sinh ra hàng chục lỗi khi bật `strict: true`. Đây là vấn đề của engine, không phải code ta. `tsconfig.json` bật `skipLibCheck: true` để chỉ strict với code dự án.

## 2.3 Vòng đời Component và listener

**Quy tắc đối xứng — vi phạm là rò rỉ listener** ([01 — mục 11](../vision/01-project-overview.md)):

| Đăng ký ở | Hủy ở | Dùng cho |
|---|---|---|
| `onLoad` | `onDestroy` | Component sống cùng Node (BoardView, CellView, Manager) |
| `onEnable` | `onDisable` | **Popup dùng pool** — popup chỉ ẩn/hiện, Node không bị hủy |

Đăng ký ở `onEnable` nhưng hủy ở `onDestroy` là bug: listener vẫn sống khi popup đã ẩn.

**Luôn truyền `target` khi đăng ký:**

```
EventManager.instance.on(EVENT_NAME, this.onSomething, this);
...
EventManager.instance.targetOff(this);   // hủy TẤT CẢ bằng một lệnh
```

`targetOff` tồn tại chính vì `PuzzleSession` có 5 hệ thống con cùng đăng ký — hủy tay từng cái là con đường chắc chắn dẫn tới rò rỉ.

## 2.4 `director.addPersistRootNode` chỉ nhận node gốc

Node phải là **con trực tiếp của Scene**. Node nằm trong `Canvas` sẽ bị engine **từ chối im lặng** (chỉ warning) — manager sẽ bị hủy khi chuyển scene, và `SomeManager.instance` ném lỗi ở một chỗ hoàn toàn khác.

Đã va phải: `AppManagers` từng nằm dưới `Canvas`.

## 2.5 Đổi tên file làm vỡ tham chiếu scene

Đổi tên file `.ts` → Cocos sinh UUID mới → component trên Node **mất tham chiếu**.

**Cách an toàn:** đổi tên **cả `.ts` và `.ts.meta` cùng lúc** — UUID nằm trong `.meta` nên được giữ nguyên. Trên Windows (filesystem không phân biệt hoa/thường), đổi tên chỉ khác hoa/thường phải làm **hai bước** qua tên trung gian.

## 2.6 Cocos biên dịch MỌI thứ trong `assets/scripts/`

Không đặt code cần `fs`/`path` của Node vào đó — sẽ **vỡ build web/native**.

Vì vậy dự án tách:

* `assets/scripts/editor/PuzzleValidator.ts` — logic thuần TS, an toàn để biên dịch.
* `tools/validate-puzzles.mjs` — phần đọc file, **ngoài** `assets/`, chỉ chạy bằng Node.
* `tests/` — cũng **ngoài** `assets/`, cùng lý do.

---

# 3. Quy tắc riêng theo tầng

Chi tiết đầy đủ ở [04 — mục 5](../architecture/04-folder-structure.md). Ba điều dễ vi phạm nhất:

## 3.1 `gameplay/` không import BẤT KỲ THỨ GÌ từ `cc`

Đây là ranh giới quan trọng nhất của dự án. Nó là điều kiện để 73 test chạy trong Node mà không cần mở Cocos.

Nếu bạn thấy mình cần `Node` hay `Tween` trong `gameplay/` — bạn đang đặt code sai tầng. Hiển thị là việc của `ui/`.

## 3.2 `service/` ĐƯỢC dùng API nền tảng, KHÔNG được dùng API scene-graph

* **Được:** `sys`, `resources`, `JsonAsset` — service là *adapter ra thế giới bên ngoài*.
* **Cấm:** `Node`, `Component`, `Sprite`, `Tween`.

## 3.3 `ui/` không import `manager/` — ngoại lệ duy nhất là `UIManager`

Screen/Popup muốn tác động ra ngoài Gameplay thì **phát Requested Event**, không gọi thẳng Manager.

Cần Intent vào `PuzzleSession`? Lấy qua `PuzzleSessionHolder` (nằm trong `gameplay/`, UI được phép import).

---

# 4. Kiểm thử

## 4.1 Gameplay Core: test là bắt buộc

Gameplay là TypeScript thuần nên **không có lý do gì để không test**. Mọi thay đổi luật chơi phải kèm test.

Cách test: gửi Intent vào `PuzzleSession`, kiểm tra state và event phát ra. Không dựng engine, không dựng UI.

```
npm test           # chạy một lần
npm run test:watch # chạy liên tục khi sửa code
```

## 4.2 Puzzle data: test là bất biến

```
npm run validate:puzzles
```

Mọi puzzle vào build **phải** qua ba phép kiểm định ([02 — mục 10.3](../vision/02-gameplay-loop.md)): đúng cấu trúc vùng màu, giải được, **chỉ có một lời giải**. Bộ data gốc có **229/1000 puzzle hỏng** — đây không phải kiểm tra thừa.

## 4.3 UI: không test tự động trong MVP

Chi phí dựng môi trường test cho Component Cocos không xứng với lợi ích ở quy mô này. Bù lại bằng verify tay trên thiết bị thật.

**Đây là lý do phải giữ Gameplay Core sạch:** thứ *không* test được (UI) phải càng mỏng càng tốt.

---

# 5. Trước khi merge

☐ `npx tsc --noEmit` — sạch (strict mode)
☐ `npm test` — pass
☐ `npm run validate:puzzles` — nếu có đụng data
☐ Không vi phạm quy tắc import ở mục 3
☐ Mọi `on(...)` có `off`/`targetOff` đối xứng đúng vòng đời
☐ Thêm event mới? → **cập nhật danh mục ở [03 — ch.4.3](../architecture/03-system-architecture.md) TRƯỚC**
☐ Thêm Intent mới? → **cập nhật [11 — mục 4.2](../architecture/11-gameplay-system.md) TRƯỚC**
☐ Đổi schema save? → theo playbook ở [08 — mục 3](../design/08-save-system.md)
☐ Đổi kiến trúc? → ghi vào bảng quyết định [03 — ch.11](../architecture/03-system-architecture.md) TRƯỚC

> Ba dòng cuối không phải thủ tục hành chính. Danh mục event, danh mục Intent và bảng quyết định là **nguồn sự thật duy nhất** — code lệch khỏi chúng thì tài liệu thành vô dụng, và người tiếp theo (kể cả chính bạn sau ba tháng) sẽ tin vào tài liệu sai.

---

# 6. Hiệu năng — chỉ những gì áp dụng thật ở dự án này

CLAUDE.md đã nêu nguyên tắc chung. Cụ thể hóa:

| Quy tắc | Áp dụng ở đâu |
|---|---|
| Mảng phẳng enum, không mảng object | `BoardSystem` — 121 ô, đọc/ghi sau mỗi nước đi |
| NodePool, không instantiate/destroy | `CellView` (121 node), popup |
| **Virtualization** | `LevelSelectScreen` — 617 level, chỉ dựng ~30 node |
| Một event cho cả bàn, không 121 event | `BoardRestartedEvent` |
| Gộp lần ghi | `SaveManager.persist()` — save chạy sau mỗi nước đi |
| Không cấp phát trong `update()` | Toàn bộ `ui/` |
| Atlas gộp texture | Giai đoạn 8 |

**Đo trên thiết bị Android tầm trung thật.** Máy dev chạy mượt không nói lên điều gì.
