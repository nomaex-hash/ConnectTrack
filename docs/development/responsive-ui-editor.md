# Responsive UI — ghim cạnh và thu nhỏ vừa vùng hiển thị

Component: `assets/scripts/presentation/ui/responsiveUI.ts` (`ResponsiveUI`).
Chỉ thay đổi position/scale của node được gắn; không thay dữ liệu gameplay, scene hoặc prefab tự động.

## Nguyên tắc

- `Target Area` trống: dùng viewport camera Canvas, đổi sang tọa độ parent trước khi tính.
- Có `Target Area`: ghim/fit theo UITransform của vùng đó, có tính scale/position của parent.
- `Fit Width`/`Fit Height`: thu nhỏ đồng đều khi thiếu chỗ, tối đa bằng scale tại lúc component onLoad.
  Màn rộng trở lại thì scale phục hồi, không cộng dồn scale từ các lần resize trước.
- `Horizontal`: Keep/Left/Center/Right. `Vertical`: Keep/Bottom/Center/Top.
- Margin tính theo đơn vị UI local của parent, không phải pixel vật lý của thiết bị.
- Chỉ ghi transform khi kích thước hoặc cấu hình layout đổi, không ghi lại mỗi frame.
- Dùng cho UI phẳng với camera Canvas orthographic; wrapper và hệ trục vùng chứa không xoay.
- Viewport không tự trừ tai thỏ/browser overlay. Muốn giới hạn vùng an toàn hoặc vùng giữa header/footer,
  tạo vùng UI riêng và gán `Target Area` vào vùng đó.

## Nút ghim cạnh màn hình

1. Tạo node `SettingsAnchor` dưới screen, thêm UITransform với Content Size bằng kích thước nút.
2. Đặt Button hiện có thành con của nó, local position `(0,0,0)`; giữ animation bấm trên Button con.
3. Thêm ResponsiveUI vào SettingsAnchor: Target Area trống, Horizontal = Right, Vertical = Top.
4. Đặt Margin Right/Top, ví dụ 24; Fit Width/Height bật nếu nút cũng cần thu nhỏ khi thiếu chỗ.
5. Bỏ/tắt Widget và ScreenFitNode trên **SettingsAnchor**. Không để Layout của parent điều khiển wrapper.

Nút quay lại: Left + Top. Nút nhận thưởng phía dưới: Center + Bottom.

## Cụm bảng xếp hạng/popup bị cắt hai bên

```text
Screen
├── HeaderAnchor / CloseAnchor
├── ContentFitRoot       ← ResponsiveUI + UITransform
│   └── AnimatedContent  ← popup/nhóm top 3 và animation hiện có
└── BottomButtonAnchor
```

1. Content Size của ContentFitRoot phải bao trọn thiết kế của AnimatedContent ở scale gốc.
   Component không tự đo mọi Sprite con; để mặc định 100×100 sẽ cho kết quả sai.
2. Gắn ResponsiveUI, Horizontal = Center; Vertical = Center nếu fit cả popup.
3. Bật Fit Width + Fit Height; đặt margin bốn phía để chừa mép.
4. Với riêng nhóm top 3: có thể dùng Vertical = Keep, Fit Width bật, Fit Height tắt để giữ vị trí dọc.
5. Với vùng giữa tiêu đề và nút dưới: tạo UITransform cho vùng đó, gán Target Area.
6. Chỉnh scale gốc của wrapper **trước khi Play**. Script ghi nhớ scale này làm mức tối đa.

Không gắn ResponsiveUI trực tiếp lên Board đang có animation di chuyển thắng hoặc lên node
đang được tween scale/position. Dùng wrapper riêng để layout và animation không tranh quyền điều khiển.
Không gán Target Area là chính wrapper hoặc node con của wrapper.
Nếu lỡ gán như vậy, component cảnh báo một lần và dùng viewport Canvas thay thế.

### Thiết lập groupWeekly

- Giữ UITransform 720×1280 nếu kích thước này bao trọn nội dung thiết kế.
- Target Area: **None**; Horizontal/Vertical: **Center**; Fit Width/Height: bật.
- Không để Widget, ScreenFitNode hoặc Layout của parent điều khiển đồng thời groupWeekly.
- Khi Preview đã nạp script/prefab mới, resize cửa sổ sẽ tự tính lại mỗi frame, không cần reload game.
  Việc cập nhật script/prefab vào một Preview đang chạy vẫn có thể cần mở lại Preview một lần.
- Component chạy trong game, không tự chỉnh bố cục trong chế độ sửa prefab của Editor.

## Kiểm tra Preview

- Thử viewport hẹp, rộng, thấp và resize liên tục: cụm không méo, không phóng vượt scale gốc.
- Kiểm tra ghim phải/trên và trái/dưới, khoảng cách tính từ mép hình chứ không từ tâm node.
- Thử parent có scale khác 1, anchor khác 0.5; mở/đóng popup và animation bấm nút.
- Kiểm tra Content Size của wrapper bao đủ toàn bộ art, không chỉ nền ở giữa.
- Bản thay đổi này chưa gán component tự động cho các prefab; cần thực hiện các bước trên trong Editor.
