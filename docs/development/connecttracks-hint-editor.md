# Thiết lập Booster Hint ConnectTracks

Code đã có; chưa chỉnh prefab/scene hoặc xác minh runtime. Chỉ dùng sprites màu có sẵn.

## Trong GameplayScreen prefab

1. Tạo `HintOverlay` dưới GameplayScreen, cùng cấp với Board. Gắn UITransform,
   Widget phủ kín screen và component `ConnectTracksHintView`. Giữ root active.
2. Bên trong tạo `Dim`: Sprite nền đen trong suốt phủ kín màn, Widget stretch.
   Gán vào **Dim Node**. Code thêm BlockInputEvents khi mở Hint.
3. Tạo `Content` cùng cấp với Dim, chứa khung mô tả, RichText và nút **Áp dụng**.
   Gán **Content** và **Text Label**. Nút Áp dụng gọi
   `ConnectTracksHintView.onTapApply` trên HintOverlay, không gọi HintController cũ.
   Nếu có nút đóng, gọi `onTapCancel`.
   Gán nút vào **Apply Button Node**; nếu để trống, code tự tìm `Content/btnApply`
   (con trực tiếp). Nút có thể để inactive trong prefab: Hint tự bật khi mở và tắt khi đóng.
4. Gán `HintOverlay/ConnectTracksHintView` vào property **Connect Tracks Booster Hint**
   của GameplayScreen. Nút booster giữ handler `GameplayScreen.onTapHint`.
5. Tạo node `Templates` dưới HintOverlay, rồi tạo 8 node mẫu bên trong: Preview, X,
   StraightHorizontal, StraightVertical và 4 Curve. Mỗi node có UITransform và Sprite
   (nên đặt Sprite ở node con). Root mẫu có UITransform vuông, ví dụ 100×100, đại diện
   cho toàn bộ cell. Gán ảnh màu có sẵn vào Sprite con, đặt **Size Mode = CUSTOM**
   để chỉnh Content Size/Scale của ảnh bên trong khung cell.
   Kéo **node từ Hierarchy** vào **Preview Node**, **X Node**, **Straight Horizontal Node**,
   **Straight Vertical Node** và 4 **Curve … Node** của ConnectTracksHintView.
   Các property SpriteFrame cũ đã được thay bằng property Node mới, cần gán lại.
   Bộ `assets/textures/ConnectTrack/item_hint_track_*.png` có các hình ray tương ứng;
   kiểm tra hình trong Inspector trước khi gán. Code không tint hoặc tự chọn ảnh theo tên.
6. Không dùng HintController Meowdoku để điều khiển overlay mới. Không xóa controller
   cũ nếu các màn legacy vẫn dùng nó. Overlay mới không đăng ký global EventBus.

Tắt active của `Templates` để mẫu không xuất hiện trong game. Code tạo bản sao cho từng
ô đích, bật root bản sao và ép khung root bằng đúng kích thước cell hiện tại.
Sprite và bố cục node con giữ nguyên tỷ lệ trong khung mẫu.
Node con có Sprite phải được bật active trong mẫu. Không gắn Widget/Layout điều khiển
kích thước root mẫu hoặc component gameplay/input vào mẫu.

Đặt root mẫu Position `(0,0,0)`, Rotation `(0,0,0)`, Scale `(1,1,1)`, anchor `(0.5,0.5)`.
Code thay vị trí/scale root để khớp cell, không dùng offset và độ lớn scale của root mẫu.
Chỉnh vị trí/kích thước ảnh tại **node con**, không chỉnh scale root để thu nhỏ ảnh.
Ví dụ root 100×100, Sprite con 80×80: cell 60×60 sẽ có ảnh 48×48. Muốn ảnh phủ kín
cell thì Sprite con cũng 100×100. Root phải có chiều rộng/cao lớn hơn 0; root vuông
giúp giữ đúng tỷ lệ ảnh khi fit vào cell vuông. Board scale được áp dụng thêm như bình thường.

## Viền trắng cho ô mục tiêu

**X Preview Size Ratio** chỉnh riêng khung dấu X xám xem trước theo kích thước cell:
1 = bằng cell, 1.2 = lớn hơn 20%, 0.8 = nhỏ hơn 20%. Dấu X giữ nguyên tâm ô.
Nếu ảnh có khoảng trong suốt ở mép, phần X nhìn thấy sẽ nhỏ hơn khung; có thể tăng tỷ lệ
để bù. Không ảnh hưởng dấu X đã đặt, sprite ray hoặc viền Hint.

Viền ngoài vùng ô được nhấc chỉnh tại **Region Border Width** (độ dày, mặc định 3;
0 để ẩn) và **Region Border Color** (mặc định xám). Độ dày tính theo đơn vị local
của Board, chịu scale chung của Board. Hai property này không đổi viền đỏ/xanh của ô mục tiêu.

Tạo thêm node mẫu `TargetBorder` dưới Templates, có UITransform vuông và Sprite viền
trắng (ở root hoặc node con). Kéo vào **Target Border Node** của ConnectTracksHintView.
Sprite chỉ chứa hình viền, nền trong suốt; không đặt chung ảnh track/X trong mẫu này.

**Target Border Padding**: nới viền ô mục tiêu ra mỗi cạnh, theo đơn vị local của Board.
Mặc định 0. Ví dụ cell 100×100 và Padding 5 → khung sprite viền 110×110, vẫn cùng tâm
với cell. Chỉ nới viền mục tiêu, không phóng to sprite track/X hoặc viền xám của vùng.

Code tạo bản sao viền cho từng ô mục tiêu, fit khung root bằng cell và tint các Sprite
trong bản sao: **Error Border Color** cho A0/B1 sai hướng, **Correct Border Color** cho
gợi ý còn lại. Có thể chỉnh hai màu trong Inspector. Mẫu gốc vẫn trắng; ảnh track/X
không bị tint. Viền xám bao ngoài vùng nhấc vẫn vẽ theo vùng để không có cạnh nội bộ.
Chưa gán Target Border Node thì dùng viền Graphics cũ. Không cần thay các binding Hint khác.

## Nút Settings cộng 50 lượt Hint

Trong SettingsPopup prefab, thêm Button với nhãn `+50 Hint` vào dialogGameplay (và
dialogMainMenu nếu muốn có ở cả hai nơi). Trong Click Events:

- Target: node gắn `SettingsPopup`.
- Component: `SettingsPopup`.
- Handler: `onTapAdd50Hints`.

Mỗi lần bấm cộng đúng 50 lượt qua luồng inventory/save có sẵn; không cần custom event data.
Không gán đồng thời event Inspector và listener khác cho cùng nút để tránh cộng hai lần.

`HintCells` được tạo runtime giữa Dim và Content: các ô được chuyển lên lớp này giữ
nguyên world transform. Code vẽ viền xám ở cạnh ngoài từng vùng, không vẽ cạnh chung.
Viền xanh/đỏ chỉ vẽ ở ô mục tiêu. Sprite xem trước phủ lên ô đó; dùng alpha có sẵn của ảnh.
Với B1, hình TrackPreview/Track?/ray gốc tại ô mục tiêu được tạm ẩn để không chồng lên
sprite ray gợi ý. Nền ô và các ô đánh dấu làm bằng chứng vẫn hiện. Đóng hoặc Áp dụng
khôi phục art gốc trước khi render trạng thái mới, không cần gán thêm property.
Đóng/Áp dụng/restart/đổi màn sẽ trả ô về parent, thứ tự, vị trí và scale cũ.

## Hành vi đã nối

- A0–A6 theo thứ tự; A7 bỏ qua. B1 chỉ ở giai đoạn đã tìm đủ track đáp án.
- A8 gọi lựa chọn Place Track sẵn có và đặt preview trực tiếp, không bịa thêm câu mô tả.
- Hint bình thường trừ lượt khi overlay mở thành công, như chính sách Hint cũ;
  đóng không hoàn lượt. Thiếu binding/sprite hoặc không có gợi ý không trừ lượt.
- Bộ đếm/quảng cáo/save lượt vẫn dùng bridge inventory hiện có ở GameplayScreen;
  không gọi bộ suy luận Hint Meowdoku. `hint=null` notification chỉ cập nhật inventory.
- B1 không có preview nhận connection đúng: không tự sửa một track khác; không có
  gợi ý, không trừ lượt. Hành vi fallback rộng hơn chưa được chốt.
- Thứ tự: A2 đủ ray nên đánh X ô còn lại → A3 nối theo hướng còn lại khi bị chặn → A4 dùng hết ô còn lại để đặt preview.
- A4 coi RedX là ô non-track khóa sẵn, không phải ứng viên đặt preview.
- Apply kiểm tra đúng pending hint và board chưa thay đổi, không cho áp dụng hai lần.

## Kiểm tra Preview

- Đặt X lên đáp án → A0 đỏ → Áp dụng chỉ gỡ X, không trừ tim.
- A1 đặt preview cạnh given, không tự nối ray.
- A4/A2 nhiều ô: xem trước không đổi snapshot; Áp dụng cập nhật cả nhóm.
- A3 không tự thêm hướng vào given; A5 xử lý ngõ cụt; A6 dùng hai hướng bắt buộc.
- B1 chỉ ô mục tiêu có viền xanh/đỏ; ô X cạnh đó được nhấc nhưng không có viền xanh.
- Trong Hint không drag board; đóng xong input hoạt động lại.
- Restart/thoát/đổi màn khi Hint đang mở không làm mất cell hoặc còn overlay cũ.
- Kiểm tra lần mở đầu tiên, nhiều lần mở/đóng, có sẵn scale board khác 1.
- Sau Apply B1 cuối cùng, chuỗi thắng và save chạy như các command khác.
