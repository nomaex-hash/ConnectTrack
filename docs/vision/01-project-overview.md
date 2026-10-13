# Dogdoku — Tổng Quan Dự Án

>Đọc tài liệu này trước, sau đó đọc [CLAUDE.md](../claude.md) để nắm chi tiết quy tắc phát triển.

---

## 1. Mục tiêu của dự án

Xây dựng một game puzzle mobile mô phỏng lại **Dogdoku: Brain Test** (Oakever Games).

- Mục tiêu giai đoạn đầu là **feature parity** — tái hiện đúng gameplay loop, luồng UX, hệ thống progression và trải nghiệm người chơi của game gốc.
- **Không sáng tạo gameplay mới trong giai đoạn MVP.** Đổi mới chỉ bắt đầu sau khi MVP hoàn thành.

## 2. Đối tượng người chơi

*(Suy ra từ game tham chiếu, do dự án đặt mục tiêu feature parity)*

- Người chơi **casual**, thích các game giải đố logic nhẹ nhàng (Sudoku, Queens, Star Battle).
- Chơi trong các phiên ngắn, không áp lực thời gian — game không có timer.
- Sử dụng **thiết bị di động cảm ứng**, bao gồm cả máy Android tầm trung.

## 3. Gameplay cốt lõi

Dogdoku thuộc họ puzzle **Queens / Star Battle** (không phải sudoku cổ điển):

- Bàn chơi là lưới **N×N** được chia thành **đúng N vùng màu**. Trong bộ data hiện tại, N chạy từ **4 đến 11**.
- Người chơi đặt chó lên các ô sao cho:
  1. Mỗi **hàng** có đúng 1 con chó.
  2. Mỗi **cột** có đúng 1 con chó.
  3. Mỗi **vùng màu** có đúng 1 con chó.
  4. Không có 2 con chó nào **chạm nhau**, kể cả theo đường chéo.
- Hoàn thành puzzle khi tất cả chó được đặt đúng luật.
- Mỗi puzzle có **đúng một lời giải duy nhất** — điều kiện bắt buộc, được kiểm chứng bằng máy lúc build data (xem [02 — mục 10.3](02-gameplay-loop.md)).

**Nguồn puzzle:** level được **thiết kế thủ công** (handcrafted), lưu dạng JSON — **617 level campaign** và **154 puzzle daily** (hai pool tách biệt, không trùng nhau). Không sinh puzzle bằng thuật toán trong MVP, nhưng hệ thống puzzle phải được thiết kế để sau này hỗ trợ generator, online levels và DLC mà không phải sửa gameplay logic.

## 4. Các tính năng MVP

| Nhóm | Tính năng |
|---|---|
| **Gameplay** | Bàn chơi (Puzzle Board), tương tác ô (Cell Interaction), kiểm tra luật (Rule Validation), hoàn thành puzzle |
| **Progression** | Main Menu, chọn level, mở khóa level, lưu tiến trình |
| **Hỗ trợ người chơi** | Place Dog, Hint, highlight lỗi sai (Wrong Mark) |
| **Daily Puzzle** | Thử thách hàng ngày, phần thưởng hàng ngày |
| **Persistence** | Save/Load game, dữ liệu người chơi |
| **UI** | Main Menu, Gameplay HUD, Pause, Result, Settings, Level Select |
| **Audio** | Nhạc nền (BGM), hiệu ứng âm thanh (SFX), cài đặt âm thanh |

## 5. Những tính năng CHƯA làm trong MVP

Các tính năng dưới đây **không nằm trong MVP**, nhưng kiến trúc phải sẵn sàng hỗ trợ chúng sau này mà không cần refactor lớn:

- Puzzle Generator (sinh puzzle tự động)
- Online Levels / Downloadable Content
- Cloud Save
- Theme System / Skins
- Achievements
- Events / LiveOps
- Analytics
- Monetization
- Localization

## 6. Target Platform

- **Android** và **iOS** — native mobile first, thiết kế ưu tiên cho thiết bị cảm ứng.
- Luôn cân nhắc: **FPS, memory, pin, thời gian load**, và đặc biệt là **máy Android tầm trung**.

## 7. Tech Stack

| Thành phần | Công nghệ |
|---|---|
| Engine | Cocos Creator **3.8.6** |
| Ngôn ngữ | TypeScript (**Strict Mode**) |
| Nền tảng build | Android / iOS (native) |
| Quản lý version | Git |

## 8. Nguyên tắc phát triển

Thứ tự ưu tiên của dự án: **Kiến trúc → Dễ bảo trì → Mở rộng được → Hiệu năng → Tốc độ phát triển.**

### Kiến trúc

- **Component-Based Architecture** theo chuẩn Cocos Creator.
- Tách lớp rõ ràng: **Gameplay không được biết UI tồn tại.Gameplay chỉ phát ra state hoặc event.UI lắng nghe state/event và tự cập nhật giao diện.Điều này giúp Gameplay có thể được kiểm thử, mở rộng hoặc thay thế UI mà không cần sửa logic.**
- Các Manager (GameManager, UIManager, AudioManager, SaveManager, SceneManager, ResourceManager, EventManager) — **mỗi manager một trách nhiệm duy nhất**, không gọi trực tiếp lẫn nhau, giao tiếp qua **event-driven**.
- Tránh God Object và circular dependency.
- Code được tổ chức theo cấu trúc thư mục cố định trong `assets/scripts/` (`core/`, `gameplay/`, `manager/`, `ui/`, `service/`, `data/`, ... — xem chi tiết trong [CLAUDE.md](../claude.md)). Không tự ý tạo thư mục mới.

### Coding style

- TypeScript strict, tránh `any`, ưu tiên interface thay vì phụ thuộc cụ thể.
- Hàm nhỏ, class tập trung một nhiệm vụ, không lặp code, ưu tiên **code dễ đọc hơn code "khôn"**.
- Ưu tiên Composition hơn Inheritance.
- Naming convention: `xxxManager`, `xxxController`, `xxxService`, `xxxPopup`, `xxxPanel`, `xxxConfig`, `xxxData`, `xxxModel`, `xxxSystem`, `xxxComponent`.

### Hiệu năng (mobile)

- Không allocate object trong `update()`; cache component, tái sử dụng `Vec3`/`Color`.
- Dùng NodePool khi phù hợp; hạn chế instantiate/destroy không cần thiết.
- Chú ý memory leak và draw calls.

### Quy trình

- **Design trước, code sau**: hiểu yêu cầu → phân tích hệ thống ảnh hưởng → thiết kế kiến trúc/module → giải thích trade-off → được duyệt → mới viết code. Không bỏ qua bước thiết kế.
- Git workflow: **Feature → Review → Refactor → Test → Commit → Push.** Không commit code chưa review.

## 9. Success Criteria

MVP được coi là hoàn thành khi đáp ứng các tiêu chí sau:

### Gameplay

- Người chơi có thể hoàn thành toàn bộ handcrafted puzzles.
- Rule validation hoạt động chính xác.
- Place Dog, Hint và Mistake Highlight hoạt động ổn định.

### Progression

- Level được mở khóa đúng.
- Tiến trình được lưu và tải chính xác.

### Daily Puzzle

- Người chơi có thể chơi Daily Puzzle mỗi ngày.
- Phần thưởng được cấp đúng.

### UI/UX

- Hoạt động tốt trên nhiều tỷ lệ màn hình.
- Trải nghiệm cảm ứng mượt mà.

### Performance

- Duy trì 60 FPS trên thiết bị Android tầm trung.
- Không có memory leak nghiêm trọng.
- Không có crash blocker.

## 10. Out of Scope

Những nội dung sau KHÔNG thuộc phạm vi MVP:

- Multiplayer
- Leaderboard
- Cloud Save
- Puzzle Generator
- Online Levels
- Theme Shop
- Skin System
- LiveOps
- Analytics
- In-App Purchase

Nếu cần triển khai các tính năng trên, hãy thực hiện sau khi MVP hoàn thành.

## 11. Technical Risks

Các rủi ro kỹ thuật cần chú ý:

- Gameplay Logic phụ thuộc UI.
- GameManager trở thành God Object.
- Save Data khó mở rộng.
- Event Listener bị rò rỉ.
- Asset Loading gây giật khung hình.
- Puzzle Data khó mở rộng.
- Quá nhiều dependency giữa các Manager.

Claude nên chủ động cảnh báo nếu phát hiện các vấn đề trên.

## 12. Development Rules

Trong quá trình phát triển:

- Không viết code trước khi thống nhất thiết kế.
- Không sửa nhiều module trong một feature nếu không cần thiết.
- Không trộn Gameplay Logic với UI.
- Không thêm Singleton khi chưa có lý do rõ ràng.
- Không tạo Utility chung nếu chỉ dùng một nơi.
- Luôn ưu tiên giải pháp dễ bảo trì hơn giải pháp ngắn hơn.

## 13. Puzzle Data

- Tất cả level được lưu dưới dạng **file JSON, mỗi level một file**. Gameplay không hard-code dữ liệu level.
- **PuzzleProvider là thành phần duy nhất** đọc các file JSON này và chuyển thành PuzzleData.
- Chỉnh sửa hoặc bổ sung level về sau chỉ cần chỉnh JSON, **không sửa code**.
- **Mọi puzzle phải qua kiểm định bằng máy trước khi vào build**: đúng cấu trúc vùng màu, giải được, và **chỉ có đúng một lời giải**. Quy tắc này áp dụng cho cả puzzle viết tay lẫn puzzle sinh tự động hoặc tải từ server sau này. Chi tiết ở [02 — mục 10.3](02-gameplay-loop.md).

> **Nguyên tắc cuối cùng:** Khi phân vân, luôn chọn giải pháp **rõ ràng, dễ bảo trì và dễ mở rộng** — kể cả khi nó dài hơn.
