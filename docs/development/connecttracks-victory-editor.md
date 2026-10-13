# Cài chuỗi thắng ConnectTracks trong Cocos Creator 3.8.6

Code đã chuẩn bị; người dùng tự thao tác Editor. Không cần cài dependency hay chỉnh level JSON.

## 1. Cell.prefab — sprite sleeper phát sáng

Trong **mỗi orientation của Track và Main Track**, thêm Sprite tên chính xác `glowingsleeper`.
Đặt cùng cấp với `sleeper`/`rail` hoặc bên dưới nhóm art của orientation, căn đúng hình sleeper.
Đặt glow sau sleeper trong Hierarchy để vẽ lên trên; thường đặt trước rail để ray vẫn rõ.
Gán ảnh phát sáng rồi tắt Active mặc định. Code chỉ bật khi sóng tới ô và tắt khi sóng rời ô.
Không đặt glow ở ngoài Cell. Code không thay ảnh Sprite hay chỉnh scale của glow.

## 2. GameplayScreen.prefab — các node UI

Tạo cấu trúc tương tự dưới root GameplayScreen:

```text
GameplayScreen
├── HUD / các nhóm UI hiện có
├── Board                     (giữ instance hiện có)
├── BoardCenterTarget         (node trống, căn giữa vùng màn hình)
├── RailGroup                 (UITransform; bg + icon + Label số)
│   ├── bg
│   ├── icon
│   └── CountLabel
├── VictoryFlightLayer        (node trống UITransform, ngoài các Mask)
└── NextButton                (Button sao chép art từ ResultPopup)
```

- Đặt Layer các node là UI_2D; RailGroup/FlightLayer/NextButton **không nằm trong Board**.
- RailGroup pivot (0.5, 0.5), scale gốc tùy chọn. CountLabel khởi đầu `0`.
- BoardCenterTarget có thể dùng Widget căn giữa Canvas/GameplayScreen. Đây là đích vị trí **world** cho Board; không dùng target làm con Board.
- Sao chép **chỉ node nút**, không sao chép ResultPopup script. Xóa Click Events cũ gọi `ResultPopup.onTapContinue`; code tự bind nút mới. Gán Label của nút nếu muốn text tự đổi màn kế/Về trang chủ.
- RailGroup và NextButton có thể tắt Active trong Editor; code tự bật/ẩn. Node chứa component điều phối phải luôn active.
- Board không nằm dưới nhóm HUD sẽ bị ẩn. Không dùng Layout liên tục ghi đè vị trí Board; code tạm tắt Widget trực tiếp trên Board khi di chuyển và phục hồi khi reset.
- Background được giữ nguyên khi thắng. Gán property **Background**; nếu để trống, code dùng node con trực tiếp tên `Background` của GameplayScreen. HUD khác vẫn fade, không fade root vì sẽ làm Board mờ.

## 3. Prefab sao

Tạo `RailStar.prefab`: node gốc UITransform, Sprite hình ngôi sao, có MotionStreak trên node gốc hoặc node con.
Gán texture/material phù hợp của MotionStreak trong Editor; prefab không tự có art.
Đặt Layer UI_2D. Không gắn Widget/Layout/animation khác tự di chuyển node.
Code instantiate sao tại world position của ô, reset trail, rồi bay theo đường cong tới world position RailGroup.

Có thể tạo prefab gồm ba node con, tất cả Layer UI_2D:

```text
RailStar (UITransform)
├── Trail (MotionStreak)
├── Sparkles (ParticleSystem)
└── Icon (Sprite hình sao)
```

Đặt các node con tại (0,0,0). Root được code di chuyển; không gắn tween di chuyển riêng cho node con.
MotionStreak dùng texture vệt sáng, chỉnh Fade Time/Stroke theo hình mong muốn.
Sparkles dùng **ParticleSystem 3D**, bật Loop, đặt Rate over Time > 0 và Start Lifetime ngắn.
Gán material particle có texture sao; kiểm tra kích thước hạt theo tỷ lệ thực tế của UI.
Dùng Simulation Space = World để hạt đã phát lưu lại dọc đường và tắt dần; emitter vẫn đi theo root.
Dùng Local khi muốn cả hạt đã phát cùng di chuyển theo sao.
Code reset MotionStreak và gọi stop()/play() trên ParticleSystem tại điểm xuất phát,
hủy cả prefab khi tới Rail hoặc hủy chuỗi thắng.
ParticleSystem là renderer 3D: cần camera nhìn thấy layer UI_2D của prefab, vị trí Z nằm trong
near/far clip và material phù hợp. Không mặc định thứ tự che phủ particle giống Sprite UI;
kiểm tra trong Preview với camera hiện có trước khi thêm camera hoặc đổi cấu trúc scene.

## 4. Gán component

Thêm `ConnectTracksVictoryView` lên root GameplayScreen hoặc một node điều phối luôn active bên dưới root.
Gán:

| Property | Node / component |
|---|---|
| Rail Group | RailGroup |
| Rail Label | CountLabel |
| Star Prefab | RailStar.prefab (thiếu thì cảnh báo và bỏ hình sao bay; chuỗi thắng vẫn tiếp tục) |
| Flight Layer | VictoryFlightLayer |
| Board Center Target | BoardCenterTarget |
| Next Button | Button của NextButton |
| Next Label | Label chữ nút, tùy chọn |

Trong component `GameplayScreen`, kéo component vừa tạo vào **Connect Tracks Victory**.
Giữ binding Board/Input/Train hiện có. Không dùng Diagnostic Bootstrap để kiểm tra chuỗi GameplayScreen.
Thiếu binding bắt buộc: code cảnh báo, không mở popup thắng thay thế.

## 5. Timing

Các giá trị mặc định chỉ là cấu hình trình bày, chỉnh được trong Inspector:

| Property | Giây mặc định |
|---|---:|
| Wave Cell Seconds | 0.07 |
| Star Flight Seconds | 0.45 |
| Rail Reveal Seconds | 0.20 (hiện và ẩn) |
| Rail Pulse Seconds | 0.16 |
| Hud Fade Seconds | 0.25 |
| Board Move Seconds | 0.40 |
| Next Fade Seconds | 0.25 |

Initial pause cố định 0.1 giây theo yêu cầu. Rail pulse 100% → 110% → 100%.
Sao từ ô 1 mang 3 ray, ô 4 mang 3 ray... nhóm cuối mang phần còn lại. Ví dụ 8 ray: +3, +3, +2 = 8.
Rail chưa lưu persistence và chưa dùng tính leaderboard. Logic leaderboard cũ khi hoàn thành màn không đổi.

## 6. Preview checklist (chưa được runtime-verified)

1. Đặt đủ ray nhưng chưa nối đúng: còn điều khiển được, không chạy chuỗi thắng.
2. Hoàn thành một đường liền mạch: đợi 0.1s, Rail xuất hiện và sóng bắt đầu tại cửa vào.
3. Glow chạy qua từng ô rồi tắt; sao sinh ở 1/4/7...; chỉ tăng số khi sao tới Rail.
4. Thử đường 5 hoặc 8 ô để kiểm tra nhóm cuối. Tổng gồm ô cho sẵn và bằng số ô đường ray.
5. Tăng thời gian bay sao: Rail phải chờ sao cuối cùng/pulse xong mới ẩn.
6. HUD mờ rồi tắt; Background và Board còn rõ; Board di chuyển đúng target.
7. Ngay khi Board tới target: ghi nhận hoàn thành, tàu bắt đầu chạy và Next bắt đầu fade lên đồng thời. Nút dùng được sau fade, không chờ tàu chạy hết. Không có popup win/Streak/Leaderboard chen ngang; bấm một lần sang màn kế và dừng tàu cũ khi đóng màn.
8. Khi không có màn kế: nút về trang chủ như luồng Result cũ.
9. Restart/thoát khi sóng đang quét, sao đang bay, Board đang di chuyển, tàu đang chạy: không callback muộn, không tăng Rail cũ, HUD/Board được phục hồi.
10. Màn kế kích thước khác và cùng kích thước: số Rail lại từ 0, glow không còn sót.
11. Thua: vẫn mở ResultPopup lose.

Kiểm thử tự động dùng mock Cocos cho thứ tự/lifecycle; không thay thế Preview kiểm tra art, mask, layer và vị trí thực tế.
