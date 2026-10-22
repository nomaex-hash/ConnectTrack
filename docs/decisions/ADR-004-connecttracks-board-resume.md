# ADR-004 — Lưu bàn ConnectTracks đang chơi

Ngày: 2026-10-09. Căn cứ: user yêu cầu về Main rồi vào lại để tiếp tục bàn cũ.


> **Cập nhật 2026-10-22 (user yêu cầu gộp về 1 key):** toàn bộ dữ liệu local nay nằm trong ĐÚNG 1 key
> `connecttracks:save:v1` (`connectTracksLocalStore`): `sessions` (bàn đang chơi), `placeTrackCharges`,
> `player` (trước là `dogdoku_save_data`) và `legacyConfig` (trước là key `MagicSort` của
> `framework/configuration`). Hai key cũ được migrate 1 lần khi load: không ghi đè dữ liệu mới, chỉ xoá
> key cũ sau khi ghi và đọc lại kiểm tra khớp; thất bại thì giữ key cũ. Các dòng bên dưới nói về
> `dogdoku_save_data`/keyspace riêng là lịch sử trước thay đổi này.

- Application sở hữu `SessionProgressPort` và định dạng `SessionProgress` v1.
- `GameSession` xuất bản sao bất biến, kiểm tra bản lưu trước khi thay trạng thái.
- Infrastructure dùng `sys.localStorage`, giống backend lưu local hiện có nhưng dùng keyspace
  `connecttracks:session:v1:` riêng, không ghi đè `dogdoku_save_data`.
- Legacy `GameplayScreen` tiếp tục là nơi composition như adapter level hiện có: tạo adapter qua
  port, tải trước lần render đầu, lưu sau cập nhật và khi đóng màn. Đây là tích hợp tại màn legacy;
  các module Presentation mới không import Infrastructure. Domain/Application không import `cc`.
- Lưu X, RedX, TrackPreview, trạng thái ray, thứ tự hướng nối, số lỗi; không lưu gesture đang kéo.
- Key phân biệt context/level/ngày daily. Signature kiểm tra kích thước, đáp án, given, cửa vào/ra,
  requiredCells: dữ liệu không tương thích hoặc hỏng bị bỏ qua, không áp dụng một phần.
- Restart lưu bàn mới. Won/Lost xóa bản lưu đang chơi. Score/progression legacy không thay đổi.
- Không thêm cloud/Facebook sync hoặc dependency. Storage lỗi chỉ cảnh báo, không chặn gameplay.

## Kiểm tra Editor/Preview

1. Spawn level: given/Main Track và toàn bộ thành phần có sẵn xuất hiện theo Cell, không pop riêng.
2. Đánh dấu X, tạo RedX, TrackPreview và nối một phần đường ray; về Main rồi vào lại cùng level.
3. Bàn và số tim phải khớp, không có drag cũ đang hoạt động. Chỉ hiệu ứng spawn của Cell chạy lại.
4. Settings → Restart: không lỗi `this.sendIntent`; bàn và số lỗi reset. Về Main/vào lại vẫn bàn mới.
5. Thử level khác, daily khác ngày, dữ liệu lưu hỏng, thay nội dung level cùng kích thước.
6. Đóng màn trong lúc đang tải level: kết quả tải cũ không áp dụng sang màn mới.

Các test tự động không thay thế kiểm tra hình ảnh/runtime trong Editor.
