# Âm thanh ConnectTracks

Đã gán 11 AudioClip dưới đây trong `assets/scenes/Boot.scene`, node **AppManagers → AudioManager**, từ `assets/audio/AudioConnecTrack`. Không cần kéo lại; bảng dùng để kiểm tra hoặc thay clip sau này:

| Property | File |
|---|---|
| Board Enter Clip | board_enter_a.m4a |
| Level Win Clip | level_win.m4a |
| Level Fail Clip | level_fail_a.m4a |
| Mark Clip | mark_x.m4a |
| Wrong Clip | mark_wrong_a.m4a |
| Create Preview Clip | create_preset_track.m4a |
| Switch Preview Clip | switch_preset_track.m4a |
| Create Track Clip | create_real_track.m4a |
| Switch Track Clip | switch_real_track.m4a |
| Train Run Clip | train_run_a.m4a |
| Train Whistle Clip | train_whistle_c.m4a |

Giữ Button Click, Dialog Open, Unmark, Hint và Praise Clips hiện tại theo quyết định user. Bgm Clip vẫn chưa có file mới được xác định; không lấy hiệu ứng ngắn làm nhạc nền.

Các âm đặt/đổi ray chỉ phát khi snapshot thay đổi. Không phát hàng loạt khi restore bàn chơi hoặc restart. Nhiều ô đổi cùng lần cập nhật chỉ phát một lần cho mỗi clip, áp dụng throttle có sẵn.

Preview bao gồm ray chưa đủ hai connection. Ray đủ hai connection dùng âm create_real_track; đổi hướng ray hoàn chỉnh dùng switch_real_track. Đổi preview/connection chưa hoàn chỉnh dùng switch_preset_track.

Âm thắng phát khi session vừa chuyển Won. Âm còi phát khi tàu bắt đầu chạy, train_run lặp trong lúc tàu chạy và dừng khi tàu bị ẩn/dừng/rời màn. Âm lượng tuân theo SFX trong Settings.

Các file all_cleared, fire, rank_*, rate_star_* chưa được gán vì cần xác định chính xác thời điểm phát. Không tự gắn chúng vào thao tác khác dựa riêng vào tên file.

Kiểm tra Preview: vào màn, đặt X/sai, tạo preview, nối ray, đổi hướng, thắng, tàu chạy/kết thúc; tắt SFX trong lúc tàu chạy; thoát và vào lại bàn đã lưu. Chỉ binding AudioManager trong scene được cập nhật; không chỉnh Domain/Application hoặc xóa asset âm cũ. Binding đã kiểm tra UUID trên ổ đĩa, chưa xác nhận nghe trực tiếp trong Preview.
