# Boot mới

Luồng: background của scene được vẽ trước → tải prefab → fade-in (mặc định 0.4 giây, chỉnh được) → tải game. Thanh load nhận các mốc tiến độ thực của Bootloader; không phải phần trăm byte tải.

## Thiết lập trong Editor 3.8.6

1. Tạo thư mục `assets/resources/boot`, **di chuyển** `assets/prefabs/screen/Boot.prefab` vào đó bằng Assets panel, giữ metadata. Không kéo instance prefab vào scene và không gán Prefab trực tiếp vào Bootloader: như vậy tài nguyên sẽ bị tải sẵn cùng scene.
2. Trong scene Boot, giữ `AppManagers`, `BootController`, `Canvas/Camera`, `Canvas/background`. Xóa `Canvas/splash`, `Canvas/text`, `Canvas/Foot` (các dấu chân). Đây là giữ lại duy nhất background về mặt hình ảnh; vẫn cần camera, canvas và controller.
3. Trên BootController/Bootloader, gán Canvas vào **Boot UI Parent**, giữ **Boot Prefab Path = boot/Boot**. Chỉnh **Boot Fade Seconds** nếu cần.
4. Giữ tên node trong prefab: `Group`, `Train/Train1`, `Particle`, `Loadingbar/load`. `load` cần Sprite, đã có trong prefab hiện tại. Không cần tự gắn BootLoadingView; controller thêm khi instantiate.
5. Code chạy các Animation có defaultClip trong Group và Train. Nếu animation cần chạy lặp trong suốt quá trình tải, chỉnh Wrap Mode của clip thành Loop trong Editor.
6. Particle là ParticleSystem 3D hiện có. Code chuyển node emitter vào Train1, giữ vị trí thế giới lúc đầu để giữ offset ống khói. Giữ Simulation Space = World để khói đã phát ra không bị kéo theo tàu.

## Kiểm tra Preview

- Khởi động từ Boot: background xuất hiện trước; không có dấu chân.
- Prefab fade-in xong mới bắt đầu tiến độ tải game; Group/Train chạy, emitter theo đầu tàu.
- Avatar/khói không liên quan Domain/Application. Hiệu ứng opacity của ParticleSystem qua UIMeshRenderer cần xác nhận trực quan trên Preview; nếu material khói không nhận UIOpacity, cần xử lý alpha material riêng sau khi kiểm tra.
- Vào Main/tutorial như trước và vẫn preload level hiện tại.
- Sai đường dẫn prefab: báo lỗi có kiểm soát trong Console, không tiếp tục tải game với giao diện thiếu.

Main được preload ở khoảng 80–95%. Sau khi preload Main và tác vụ preload level hoàn tất, thanh chạy đầy, chờ frame vẽ rồi mới chuyển scene. Thanh chạy mượt, không lùi hoặc tự tăng vượt mốc công việc đã hoàn tất. Việc dựng UI trong Main vẫn diễn ra sau chuyển scene; 100% trên Boot biểu thị hoàn tất giai đoạn chuẩn bị trước chuyển scene.
