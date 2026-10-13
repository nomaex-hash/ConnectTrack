# Dogdoku — Gameplay Loop & Game States

> Tài liệu thiết kế gameplay, là nền tảng cho thiết kế kiến trúc và state machine. Đọc sau [01-project-overview.md](01-project-overview.md).

**Thuật ngữ dùng trong tài liệu:**

| Thuật ngữ | Ý nghĩa |
|---|---|
| **Mark (X)** | Ghi chú loại trừ của người chơi. Không được validate, chỉ hỗ trợ suy luận. |
| **Dog** | Con chó được đặt thành công lên bàn chơi. |
| **Wrong Mark (X đỏ)** | Dấu vết của một lần đặt Dog sai. Không thể xóa bằng thao tác chạm. |
| **Mistake** | Trừ một lượt đặt Dog sai. Tối đa 3 lượt / puzzle. |
| **Placement Check** | Bước kiểm tra khi người chơi đặt Dog, quyết định Dog hay Wrong Mark. |
| **Place Dog** | Công cụ hỗ trợ: đặt đúng 1 Dog vào vị trí đúng, không tính mistake. Số lượng giới hạn. |
| **Hint** | Gợi ý hướng suy luận. Được **suy ra tự động lúc runtime** từ solution + trạng thái bàn hiện tại (không phải nội dung viết tay). |
| **Pre-placed Dog / Mark** | Dog hoặc Mark được đặt sẵn trên bàn ngay khi vào màn, do puzzle data quy định. **Không thể xóa** — kể cả bằng Restart. |

> Ghi chú: tính năng "Mistake Highlight" trong MVP scope của [01-project-overview.md](01-project-overview.md) được hiện thực bằng cơ chế **Mistake Counter - Wrong Mark** mô tả trong tài liệu này.

---

## 1. Core Gameplay Loop

Vòng lặp phút-để-phút bên trong một puzzle. Nhịp của một "nước đi" chỉ vài giây — chuỗi khoảnh khắc "aha" liên tục là trải nghiệm cốt lõi.

```
        ┌───────────────────────────────────────────────────────┐
        │                                (chưa xong, chưa fail)  │
        ▼                                                        │
  QUAN SÁT BÀN CHƠI ──► SUY LUẬN ──► TƯƠNG TÁC Ô ──► PHẢN HỒI ───┘
  (hàng/cột/vùng màu)  (loại trừ ô)  (Mark X /            │
                                      đặt Dog)            │
                                                          ▼
                                       ┌──────────────────────────────────┐
                                       │ Đặt Dog đúng → Dog vào bàn chơi  │
                                       │ Đặt Dog sai  → Wrong Mark (X đỏ) │
                                       │                + Mistake -1      │
                                       └────────────────┬─────────────────┘
                                ┌───────────────────────┴────────────────┐
                                ▼                                        ▼
                       [Mistakes = 0/3]                          [Đủ N Dog đúng]
                                │                                        │
                                ▼                                        ▼
                         PUZZLE FAILED                            PUZZLE SOLVED
                        (Result: Retry)                    (celebration → Result)
```

### 1.1 Cell Interaction (Tương tác ô)

Người chơi tương tác với bàn chơi hoàn toàn qua thao tác cảm ứng.

**Single Tap** — chạm một lần vào một ô:

- Ô đang trống → đặt **Mark (X)**.
- Ô đang có **Mark (X)** → xóa Mark, ô trở lại trạng thái trống.

**Double Tap** — chạm nhanh hai lần liên tiếp vào một ô. Hệ thống chạy **Placement Check** trước khi đặt Dog:

- **Nếu hợp lệ**: đặt một **Dog**. Nếu ô đang có Mark (X) thì Mark được thay bằng Dog.
- **Nếu không hợp lệ**: không đặt Dog. Ô nhận **Wrong Mark (X đỏ)** và **Mistake Counter -1**. Wrong Mark không thể bị xóa bằng thao tác chạm của người chơi.

**Drag Marking** — chạm giữ và kéo qua nhiều ô: mỗi ô trống đi qua được đánh **Mark (X)**. Drag chỉ dùng để đặt Mark, không dùng để đặt Dog. Thao tác ngược lại để xóa bỏ các ô đánh dấu X.

**Interaction Priority** (thứ tự ưu tiên khi nhận input):

1. Double Tap
2. Single Tap
3. Drag Marking

**Interaction Rules:**

- Mỗi ô chỉ có đúng một trạng thái: `Empty | Mark | Dog | Wrong Mark`.
- Dog và Mark không thể cùng tồn tại trên một ô.
- Sau mỗi thao tác phải cập nhật trạng thái bàn chơi.
- Sau mỗi thay đổi phải chạy kiểm tra hoàn thành / thất bại.
- Đặt Dog sai thì tạo Wrong Mark thay vì đặt Dog.
- **Ô pre-placed bị khóa**: mọi thao tác chạm lên ô pre-placed đều bị bỏ qua. Ô này giữ nguyên trạng thái suốt ván, kể cả sau Restart.

**Pre-placed Dog / Mark:** một số puzzle mở màn với sẵn vài ô đã điền (do puzzle data quy định) — vai trò như điểm tựa suy luận cho người mới. Pre-placed Dog luôn nằm trong solution, nên nó **được tính vào N Dog cần đặt**: người chơi chỉ cần đặt N trừ đi số Dog pre-placed.

*Thực tế trong dataset hiện tại: 7/771 puzzle có đúng 1 pre-placed Dog; chưa puzzle nào dùng pre-placed Mark. Cơ chế vẫn được hiện thực đầy đủ cho cả hai vì data format đã hỗ trợ.*

**Cell State Diagram:**

```
                       Single Tap (toggle)
              ┌────────────────────────────────┐
              ▼                                │
        ┌───────────┐    Single Tap      ┌─────┴────┐
        │   EMPTY   │ ─────────────────► │ MARK (X) │
        └─────┬─────┘                    └─────┬────┘
              │                                │
              │ Double Tap                     │ Double Tap
              │ (Placement Check)              │ (Placement Check)
              ▼                                ▼
        ┌─────────────────── Kết quả check ──────────────────┐
        │  Đúng → DOG          (thay thế Mark nếu có)        │
        │  Sai  → WRONG MARK   (X đỏ) + Mistake -1           │
        └────────────────────────────────────────────────────┘

        DOG        : chỉ gỡ được bằng Restart.
        WRONG MARK : không xóa được bằng thao tác chạm;
                     chỉ Restart mới xóa.
```

### 1.2 Placement Check

Khi người chơi double tap để đặt Dog, hệ thống kiểm tra: **ô này có đúng là vị trí Dog trong solution của puzzle không**.

Tiền đề bắt buộc: **mỗi puzzle có đúng một solution duy nhất**. Đây không phải giả định — nó được **kiểm chứng bằng máy** lúc build data: puzzle nào vô nghiệm hoặc có từ 2 nghiệm trở lên đều bị loại khỏi bộ level (xem mục 10).

- **Đúng vị trí solution** → đặt Dog.
- **Sai vị trí solution** → Wrong Mark + Mistake -1.

Bốn luật của puzzle (mỗi hàng / mỗi cột / mỗi vùng màu có đúng 1 Dog, không có 2 Dog chạm nhau kể cả chéo) là **định nghĩa tính đúng đắn của solution** — chúng được dùng khi thiết kế puzzle và có thể dùng để hiển thị *lý do sai* (highlight hàng/cột/vùng conflict) khi tạo Wrong Mark.

> **Design note — vì sao check theo solution thay vì check theo luật?**
> Nếu chỉ check theo luật (conflict với các Dog hiện có), một ô có thể bị từ chối *chỉ vì* người chơi đã đặt nhầm Dog khác trước đó — trong khi ô đó chính là vị trí đúng của solution. Khi ấy Wrong Mark (vốn không xóa được) sẽ chặn vĩnh viễn vị trí đúng → bàn chơi rơi vào thế **không thể thắng nhưng chưa fail**. Check theo solution loại bỏ hoàn toàn rủi ro này: Wrong Mark luôn nằm trên ô chắc chắn không phải Dog, và mọi Dog đã đặt luôn đúng.

**Hệ quả của thiết kế này:**

- Dog đã đặt luôn đúng → hoàn thành puzzle = **đặt đủ N Dog** (không cần bước validate toàn bàn cuối cùng).

### 1.3 Gameplay Systems

Các hệ thống tham gia vào core loop (chi tiết kiến trúc sẽ nằm ở tài liệu architecture):

| System | Trách nhiệm |
|---|---|
| Board System | Quản lý trạng thái bàn chơi |
| Input System | Xử lý thao tác cảm ứng (tap / double tap / drag) |
| Placement Check System | Kiểm tra nước đặt Dog, phát sinh Wrong Mark |
| Hint System | Suy ra nước đi kế tiếp từ solution + trạng thái bàn hiện tại (mục 4.3) |
| Place Dog System | Đặt 1 Dog vào vị trí đúng, không tính mistake |
| Progression System | Mở khóa level |
| Reward System | Cấp thưởng |
| Daily Puzzle System | Puzzle hằng ngày |

### 1.4 Event Flow của một nước đi

```
Player Input (tap / double tap / drag)
        │
        ▼
[nếu Double Tap] Placement Check
        │
        ▼
Cell Changed (Mark / Dog / Wrong Mark)
        │
        ▼
Board Updated
        │
        ▼
Completion / Failure Check
        │
        ├──► Puzzle Solved  ──► Reward Granted ──► Save Progress
        ├──► Puzzle Failed  ──► (không reward) ──► Save Progress
        └──► (tiếp tục chơi) ─────────────────────► Save Progress
```

---

## 2. Meta Gameplay Loop

Vòng lặp phiên-để-phiên: động lực là **mở khóa và tiến sâu vào các puzzle khó hơn**.

```
┌─────────────┐  chọn level   ┌──────────┐  giải xong   ┌────────┐
│ LEVEL SELECT│ ────────────► │ GAMEPLAY │ ───────────► │ RESULT │
└──────▲──────┘               └──────────┘              └───┬────┘
       │                                                    │
       │        unlock level kế tiếp + save progress        │
       ├────────────────◄───────[ Back ]────────────────────┤
       │                                                    │
       └──────── Gameplay level kế tiếp ◄────[ Next ]───────┘
```

Người chơi có thể đi thẳng Result → Next mà không quay lại Level Select — giữ flow liền mạch, giảm friction giữa các puzzle.

---

## 3. Daily Gameplay Loop

Lý do tồn tại: tạo thói quen quay lại mỗi ngày (retention), tách khỏi campaign.

```
Mở game ──► [Có Daily Puzzle hôm nay chưa chơi?]
                 │ Có                      │ Đã hoàn thành
                 ▼                         ▼
          Chơi Daily Puzzle          Hiển thị "Đã xong ✔"
                 │                   + streak hiện tại
                 ▼
          Hoàn thành ──► Daily Reward ──► Streak +1 ──► quay lại ngày mai
```

**Quy tắc MVP:**

- **1 puzzle / ngày**, xác định theo ngày local của thiết bị (server time là hậu MVP).
- Puzzle lấy từ **pool daily riêng (154 puzzle)**, hoàn toàn tách biệt với pool campaign — không puzzle nào xuất hiện ở cả hai. Chọn bằng seed từ ngày → mọi người chơi cùng ngày nhận cùng puzzle.
- Pool daily được lấy **rải đều trên dải độ khó** (cứ 5 puzzle trong danh sách đã sắp theo độ khó thì tách 1 sang daily), nên daily có đủ cả lưới nhỏ lẫn lưới lớn — không dồn toàn puzzle khó.
- Pool 154 puzzle nghĩa là chu kỳ lặp lại khoảng **5 tháng**. Chấp nhận được cho MVP; bổ sung puzzle mới là việc thêm file data, không đụng code.
- Chưa xong thì puzzle còn khả dụng đến hết ngày; sang ngày mới thì thay. **Không chơi bù ngày cũ** trong MVP.
- **Fail ở Daily Puzzle** → được Retry trong ngày, không giới hạn số lần.
- **Streak recovery**: bỏ lỡ một ngày → được khôi phục streak, tối đa 3 lần; đến lần bỏ lỡ thứ 4 thì streak reset về 0.

---

## 4. Failure & Recovery Loop

Dogdoku không có áp lực thời gian, nhưng **có trạng thái thất bại trong một màn chơi**. Failure đến từ **số lần đặt Dog sai**, không đến từ timer.

### 4.1 Failure Condition & Mistake Counter

Người chơi có tối đa **3 lượt sai** trong mỗi puzzle. Một lượt sai được tính khi:

1. Người chơi double tap đặt Dog vào một ô không hợp lệ.
2. Hệ thống từ chối đặt Dog.
3. Ô đó nhận **Wrong Mark (X đỏ)**.
4. Mistake Counter -1.

```
Mistakes:  3/3 ──► 2/3 ──► 1/3 ──► 0/3 ──► PUZZLE FAILED
```

Mistake Counter hiển thị rõ trên HUD trong suốt quá trình chơi.

### 4.2 Failure State

Khi Mistake Counter chạm 0/3:

- Puzzle kết thúc với trạng thái **Failed**.
- Bàn chơi bị khóa — người chơi không thể thao tác tiếp.
- Hiển thị Result (thất bại) với các lựa chọn:
  - **Retry** — chơi lại màn ngay lập tức.
  - **Quay về Level Select.**
  - *(Hậu MVP: dùng vật phẩm hoặc xem quảng cáo để tiếp tục — ads/IAP nằm ngoài scope MVP.)*

Thất bại **không làm mất tiến trình đã mở khóa**.

### 4.3 Recovery Flow

**Khi chưa chạm giới hạn lỗi** — người chơi tự phục hồi ngay trong màn:

```
Đặt Dog sai ──► Wrong Mark (X đỏ) ──► Mistake -1 ──► tiếp tục chơi
                                                        │
                        ┌───────────────┬───────────────┤
                        ▼               ▼               ▼
                   PLACE DOG          HINT            RESTART
                  (đặt 1 Dog      (gợi ý hướng     (xóa bàn, chơi
                   đúng)           suy luận)        lại từ đầu)
```


- **Place Dog**: công cụ chống bí chính — đặt đúng 1 Dog vào vị trí đúng, **không** tính mistake. Số lượng giới hạn; nhận thêm qua **Daily Reward** (đã chốt: Daily Reward là lượt Place Dog, số lượng khai báo trong GameConfig).
- **Hint**: gợi ý hướng suy luận, **suy ra tự động lúc runtime** — xem chi tiết bên dưới.
- **Restart**: xóa toàn bộ bàn do người chơi điền (gồm cả Wrong Mark), **giữ nguyên ô pre-placed**, và **reset Mistake Counter về 3/3**.

**Hint hoạt động thế nào**

Hint System biết solution, nên nó không cần nội dung viết tay. Khi người chơi bấm Hint, hệ thống tìm **một nước đi kế tiếp có thể suy luận ra được** và chỉ ra *hướng* suy luận, chứ không đặt Dog hộ:

1. Tìm hàng / cột / vùng màu mà — sau khi loại trừ các ô đã bị Dog hiện có chiếu tới — **chỉ còn đúng một ô khả dĩ**.
2. Highlight hàng / cột / vùng đó, để người chơi tự nhìn ra ô duy nhất còn lại.
3. Nếu không tìm được nhóm nào như vậy, lùi về mức yếu hơn: highlight một vùng màu **chưa có Dog** mà ô đúng của nó chưa được đặt.

**Vì sao thiết kế lại so với bản trước:** thiết kế cũ quy định hint là danh sách nội dung **handcrafted lưu trong puzzle data**. Bộ data thực tế có 771 puzzle và **không chứa hint nào** — viết tay hint cho từng puzzle là bất khả thi, và mọi puzzle bổ sung sau này (kể cả từ generator) sẽ lại thiếu hint. Hint suy luận tự động áp dụng được cho **mọi** puzzle, kể cả puzzle chưa tồn tại, nên nó cũng đúng tinh thần "thêm puzzle không phải sửa gameplay".

**Khác biệt giữa Hint và Place Dog:** Hint chỉ *hướng* (highlight nhóm), người chơi vẫn phải tự đặt và vẫn chịu rủi ro sai. Place Dog *đặt hộ* một Dog đúng. Hai công cụ không trùng vai trò.

**Khi đã chạm giới hạn lỗi:**

```
Mistake = 0/3 ──► PUZZLE FAILED ──► Result (thất bại) ──► Retry
                                                            │
                          (board + Wrong Mark + Mistake Counter reset)
                                                            │
                                                            ▼
                                                     Gameplay (chơi lại)
```

### 4.4 Design Principles

Failure được thiết kế nhằm:

- Tăng thử thách — mỗi lần đặt Dog là một quyết định có trọng lượng.
- Khuyến khích **suy luận** (dùng Mark X để loại trừ) thay vì đoán bừa.
- Không gây áp lực thời gian.
- Retry ngay lập tức, không trừng phạt tiến trình.

---

## 5. Player Progression

```
Campaign (tuyến tính):

  [✔ 1] [✔ 2] [✔ 3] [● 4] [🔒 5] [🔒 6] ... [🔒 N]
   done  done  done  next  locked

  ✔ Completed   ● Unlocked (chưa xong)   🔒 Locked
```

- **Mở khóa tuyến tính**: hoàn thành level N → mở level N+1. Đơn giản, đúng game gốc, đủ cho MVP.
- **Campaign có 617 level**, đánh số liên tục 1→617.
- **Độ khó tăng theo kích thước lưới**: level được sắp xếp theo size tăng dần (4×4 → 5×5 → ... → 11×11), nên độ khó tăng đều mà không cần gán tay chỉ số độ khó cho từng puzzle.

| Size lưới | 4×4 | 5×5 | 6×6 | 7×7 | 8×8 | 9×9 | 10×10 | 11×11 |
|---|---|---|---|---|---|---|---|---|
| Số level campaign | 1 | 2 | 18 | 159 | 186 | 122 | 128 | 1 |
| Level id bắt đầu | 1 | 2 | 4 | 22 | 181 | 367 | 489 | 617 |

- **Completion là binary** (xong / chưa xong) — không sao, không điểm, không xếp hạng thời gian. Giữ đúng feature parity; hệ thống sao/score nếu muốn sẽ là hậu MVP.
- Progress (level hoàn thành, level đang mở, daily streak) được lưu qua SaveManager sau **mỗi thay đổi**.

---

## 6. Reward Loop

Nguyên tắc: **intrinsic là chính, extrinsic là phụ và tối giản** (MVP không có monetization/currency shop — theo Out of Scope của overview).

| Tầng | Phần thưởng | Thời điểm |
|---|---|---|
| Intrinsic | Khoảnh khắc "aha" khi suy luận đúng | Mỗi nước đi (phản hồi tức thì) |
| Intrinsic | Cảm giác chinh phục + celebration (animation, SFX) | Hoàn thành puzzle |
| Extrinsic | Mở khóa level mới | Hoàn thành level campaign |
| Extrinsic | Daily Reward (**đã chốt**: lượt Place Dog) + streak tăng | Hoàn thành Daily Puzzle |
| Extrinsic | Tiến độ tổng thể ("35/617 puzzles") | Xem Level Select |

```
Solved ──► Celebration ──► Unlock + Reward ──► động lực chơi tiếp
   ▲                                                  │
   └──────────────────────────────────────────────────┘

Failed ──► Retry ──► KHÔNG có reward
```

Guardrail: **không** thêm loại currency nào khác ngoài Place Dog token trong MVP.

---

## 7. Game State Flow

Hai tầng state tách biệt — đây là ranh giới kiến trúc quan trọng:

- **AppState** — luồng màn hình toàn app (SceneManager/UIManager quan tâm).
- **PuzzleState** — trạng thái bàn chơi bên trong Gameplay (gameplay core quan tâm, không biết gì về UI).

```
AppState:
                ┌──────┐     ┌─────────┐     ┌───────────┐
                │ BOOT │ ──► │ LOADING │ ──► │ MAIN MENU │
                └──────┘     └─────────┘     └─────┬─────┘
                                                   │
                        ┌──────────────┬───────────┴─┐
                        ▼              ▼             ▼
                 ┌──────────────┐  [Daily]     (Settings ▣)
                 │ LEVEL SELECT │      │
                 └──────┬───────┘      │
                        ▼              │
                 ┌──────────────┐ ◄────┘
                 │   GAMEPLAY   │ ◄──── (Pause ▣)
                 └──────┬───────┘
                        ▼
                   (Result ▣)  ← hiển thị cho CẢ Solved lẫn Failed

   ▣ = overlay/popup đè lên màn hình hiện tại, KHÔNG phải scene riêng
```

```
PuzzleState (bên trong Gameplay):

   LOADING ──► READY ──► PLAYING ──┬──► SOLVED  (đặt đủ N Dog)
   (load       (board      │       │
    puzzle      dựng       │       └──► FAILED  (Mistake 0/3)
    data)       xong)      │
                           └──► DISPOSED (thoát giữa chừng,
                                board được auto-save)

   Retry / Next / Replay → quay về LOADING với puzzle tương ứng.
   Không có transition nào khác từ SOLVED / FAILED.
```

---

## 8. State Transition

### 8.1 AppState Transitions

Mọi transition đi qua event (EventManager phát, SceneManager/UIManager xử lý); UI không tự chuyển màn hình. Transition không có trong bảng = không hợp lệ → ignore + log warning.

| Từ | Đến | Trigger (event) | Ghi chú |
|---|---|---|---|
| Boot | Loading | App khởi động | Init managers, load config |
| Loading | MainMenu | Save data + core assets sẵn sàng | |
| MainMenu | LevelSelect | Tap "Play" | |
| MainMenu | Gameplay | Tap "Daily Puzzle" | Context = daily |
| LevelSelect | Gameplay | Chọn level đã unlock | Context = campaign + levelId |
| Gameplay | Pause ▣ | Tap pause / app vào background | Auto-save board |
| Pause ▣ | Gameplay | Tap "Resume" | |
| Pause ▣ | LevelSelect / MainMenu | Tap "Quit" | Auto-save board đang dở |
| Gameplay | Result ▣ | Event `PuzzleSolved` / `PuzzleFailed` | Result hiển thị nội dung thắng / thua tương ứng |
| Result ▣ | Gameplay | Tap "Next" / "Replay" (Solved) hoặc "Retry" (Failed) | Load puzzle tương ứng |
| Result ▣ | LevelSelect / MainMenu | Tap "Back" | Daily → về MainMenu |
| Bất kỳ | Settings ▣ | Tap "Settings" | Overlay, đóng lại là về chỗ cũ |

### 8.2 PuzzleState Transitions

| Từ | Đến | Trigger |
|---|---|---|
| Loading | Ready | Puzzle data load xong, board dựng xong |
| Ready | Playing | Input hợp lệ đầu tiên của người chơi |
| Playing | Playing | Mỗi nước đi (Mark / Dog / Wrong Mark / Place Dog / Hint) |
| Playing | Solved | Đặt đủ N Dog (Dog cuối cùng vào bàn) |
| Playing | Failed | Mistake Counter chạm 0/3 |
| Solved / Failed | Loading | Tap "Next" / "Replay" / "Retry" — load puzzle mới hoặc reset |
| Ready / Playing | Disposed | Người chơi thoát (kèm auto-save) |

---

## 9. Gameplay Session Lifecycle

Vòng đời một phiên chơi trên mobile — bao gồm cả gián đoạn, vì app mobile **có thể bị OS kill bất kỳ lúc nào không báo trước**.

```
APP LAUNCH
   │  Boot: init managers, load config
   │  Loading: load save data, preload core assets
   ▼
MAIN MENU ──► ACTIVE PLAY (1..n puzzles, phiên mục tiêu 3–10 phút)
   │                │
   │                ├── INTERRUPTED (cuộc gọi, chuyển app, tắt màn hình)
   │                │      • auto-save ngay: board đang dở + progress
   │                │      • pause BGM/SFX
   │                │      • quay lại → resume ĐÚNG chỗ cũ (mid-puzzle)
   │                │
   │                └── APP KILLED (OS thu hồi / user thoát)
   │                       • lần mở sau: Loading khôi phục board
   │                         đang dở → người chơi tiếp tục như chưa thoát
   ▼
EXIT
```

### 9.1 Chiến lược Save

Quyết định thiết kế: **save sau mỗi thay đổi**, không đợi pause/exit.

- *Ưu điểm*: chống mất dữ liệu khi OS kill app đột ngột (rất phổ biến trên Android tầm trung); dữ liệu board rất nhỏ (mảng trạng thái ô + mistake counter) nên chi phí ghi không đáng kể.
- *Nhược điểm*: I/O thường xuyên hơn — chấp nhận được vì payload nhỏ; nếu đo được ảnh hưởng, có thể chuyển sang debounce (gộp ghi sau X giây) mà không đổi kiến trúc.

### 9.2 Save Triggers

Save được kích hoạt sau mỗi:

- Đặt Dog / Mark / Wrong Mark (kèm Mistake Counter hiện tại).
- Dùng Place Dog (kèm số lượt còn lại).
- Kết thúc puzzle (Solved hoặc Failed).
- Unlock level.
- Nhận Daily Reward / thay đổi streak.
- Thay đổi Settings.

Board đang dở được lưu **đầy đủ trạng thái**: vị trí Dog, Mark, Wrong Mark và Mistake Counter — để resume chính xác như trước khi thoát.

---

## 10. Puzzle Source & Data Pipeline

### 10.1 Puzzle Loading

Gameplay không tạo puzzle bằng code.

```
Level ID (hoặc ngày, với daily)
        │
        ▼
PuzzleProvider  ── đọc JSON ──►  PuzzleData
        │
        ▼
Board System
```

Gameplay chỉ làm việc với PuzzleData. **Không gameplay nào được phép đọc file JSON trực tiếp.**

### 10.2 Nguồn puzzle

Puzzle là **handcrafted**, lưu thành file JSON, mỗi puzzle một file:

| Pool | Vị trí | Số lượng |
|---|---|---|
| Campaign | `assets/resources/data/puzzles/Level_{id}.json` | 617 |
| Daily | `assets/resources/data/daily/Daily_{id}.json` | 154 |

Mỗi file mô tả: kích thước lưới, bản đồ vùng màu, **solution**, và các ô pre-placed.

### 10.3 Kiểm định data (bắt buộc)

Bộ data thô ban đầu có **1000 puzzle nhưng 229 puzzle hỏng**. Editor tool đã loại chúng ra:

| Lý do loại | Số lượng | Vì sao là lỗi chí mạng |
|---|---|---|
| Vô nghiệm | 81 | Người chơi không thể nào hoàn thành → kẹt cứng campaign |
| Có từ 2 nghiệm trở lên | 138 | Người chơi đặt Dog đúng luật nhưng trúng nghiệm khác với nghiệm ta lưu → bị tính sai → Wrong Mark **không xóa được** chặn vĩnh viễn ô đúng → bàn chơi hỏng. Đúng cái bẫy mà Placement Check (mục 1.2) sinh ra để né |
| Số vùng màu ≠ kích thước lưới | 10 | Vi phạm luật "mỗi vùng đúng 1 chó" — sẽ có vùng màu không chứa chó nào |

Ngoài ra, **84% puzzle còn lại có vùng màu KHÔNG liền khối** — đúng luật nhưng cùng một màu bị tách thành nhiều mảnh rời, trông vỡ so với game tham chiếu (vùng Star Battle phải liền khối như miếng ghép). Toàn bộ region map đã được **sinh lại** bằng generator đã kiểm định (`tools/generate-puzzles.mjs`), giữ nguyên kích thước từng level để thứ tự độ khó không đổi.

**Quy tắc bất di bất dịch:** mọi puzzle được thêm vào game sau này — viết tay, sinh tự động, hay tải từ server — **phải qua đủ bốn phép kiểm định**: đúng số vùng, **vùng liền khối**, giải được, một nghiệm duy nhất. Đây là điều kiện tiên quyết để Placement Check theo solution hoạt động đúng.

Editor tool nằm ở `assets/scripts/editor/`, chạy lúc design-time, không nằm trong build runtime.

