# CONNECTTRACKS-T6-REVIEW-013

Ngày review: 2026-10-06. Reviewer: Codex.

**T6 FINAL CLOSURE: PENDING EVIDENCE RECONCILIATION.** Không xác định gameplay defect mới trong phạm vi đọc; chưa đủ căn cứ để đóng toàn bộ task PASS. Không sửa code hoặc bắt đầu T7.

## 1. Căn cứ và governance hiện hành

Đã đọc AGENTS.md và CLAUDE.md hiện có, gameplay contract tại `docs/game-design/connecttracks-gameplay-contract.md`, kiến trúc/roadmap đang có trên filesystem và code Presentation/Bootstrap liên quan. Không áp dụng lại bộ AGENTS hay gate MIG-001 từ phiên trước.

Explicit user decision và confirmed gameplay contract có ưu tiên. Runtime reference Android khác target Web/Facebook; implementation không tự xác nhận behavior. UNKNOWN vẫn UNKNOWN.

Workspace hiện khác baseline migration cũ: không có `.git`, package.json còn tên/UUID Dogdoku và có legacy code. Architecture `03-system-architecture.md` và roadmap `09-roadmap.md` cũng tự nhận là Dogdoku, trong khi AGENTS/CLAUDE hiện mô tả ConnectTracks layered architecture. Đây là discrepancy tài liệu/identity cần xác định phạm vi áp dụng, không tự coi toàn bộ legacy là vi phạm do T6 tạo ra, cũng không tự đổi tên/xóa/refactor.

Không tìm thấy task/manifest T6, định nghĩa T7 hoặc report chi tiết smoke 1–13 trong tài liệu workspace. Đã yêu cầu user cung cấp. Chưa thể kiểm file-scope diff hoặc xác nhận T7 đã được giao từ roadmap legacy.

## 2. Những gì đã được verify

| Hạng mục | Evidence / kết luận |
| --- | --- |
| Saved ConnectTracksSmoke.scene; latest compiled output; runtime checks 1–13 PASS; console 0 errors | User báo Antigravity đã verify. Chấp nhận là reported target-runtime evidence, không tuyên bố Codex đã chạy lại hoặc tự đặt tên cho 13 checks |
| No runtime-only fixes; files changed during smoke = 0 | User-provided evidence; không có before/after manifest/hash để Codex kiểm độc lập |
| Tests | Codex chạy `node node_modules/vitest/vitest.mjs run tests/connecttracks`: **14 files, 147/147 tests PASS, exit 0**. Lần đầu bị sandbox `spawn EPERM`; chạy lại với quyền thực thi phù hợp thành công, không cài package |
| Smoke asset | Scene và `.meta` tồn tại trên disk, UUID `50cec6bd-9046-489a-ab6b-f97d1d1add3f` |
| Semantic mapping | `gestureToCommand` chuyển semantic gesture thành GameCommand, không dùng timer hoặc tự phân loại raw touch |
| Raw input | `ConnectTracksBoardView` chuyển TOUCH_END thành raw cell index qua callback; không tự gọi tap/doubleTap. Bootstrap hiện không wire callback này thành gameplay command |
| Render / wiring | BoardView nhận GameSnapshot, dùng view model để vẽ debug; hỗ trợ snapshot tới trước Graphics.start. Bootstrap tạo session bằng fixture 3×3 và applyGesture → dispatch → snapshot → render |
| Ownership | Trong phần code đọc, gameplay quyết định ở Application/Domain; Presentation thể hiện snapshot. Không thấy core import `cc`, DOM, FBInstant hoặc global EventBus trong scan |
| Presentation imports | Có dùng trực tiếp Domain data types/helpers. Chưa có task boundary/public API policy mới đủ chi tiết để gắn lỗi theo policy cũ đã bị hủy; không tự yêu cầu redesign |
| Production/parity | Không được suy từ smoke: chưa xác nhận raw gesture classifier, Android timing parity, level production hoặc Facebook SDK/build |

## 3. Discrepancy typecheck và điều kiện đóng

User báo Cocos typecheck PASS. Codex thử:

```text
node C:/ProgramData/cocos/editors/Creator/3.8.6/resources/app.asar.unpacked/node_modules/typescript/lib/tsc.js --project tsconfig.json --skipLibCheck --noEmit
```

Kết quả: exit 1. Có lỗi thiếu `includes` trong readonly arrays ở ConnectTracks Domain/Presentation do lib hiện hành; lỗi `Object.entries`, DogSpineView, localization extension và legacy tests. Phép kiểm này quét rộng, **không mặc định cùng config/scope với typecheck smoke** và không chứng minh T6 gây regression. Không sửa tsconfig/generated config hoặc legacy code để làm review PASS.

Cần trước closure:

1. Manifest/acceptance T6 và report 13 checks, kèm snapshot/hash hoặc revision được kiểm; có thể gửi nội dung nếu nằm ngoài workspace.
2. Lệnh, compiler version, tsconfig/effective options và file scope của typecheck đã PASS. Nếu đó là T6-only check, ghi rõ giới hạn và đối chiếu lại; không bắt buộc sửa toàn legacy để đóng T6.
3. Xác nhận architecture/roadmap nào áp dụng cho slice ConnectTracks khi tài liệu legacy khác AGENTS/CLAUDE; không cần tự động refactor cả project.

`git status --short` trả `not a git repository`; không có Git diff để chứng minh allowlist hoặc quy tác giả thay đổi. Không tự init Git. Dùng source manifest/hash handoff để đối chiếu thay thế.

## 4. UNKNOWN giữ nguyên

- Tap/double-tap: cửa sổ thời gian, thời điểm phát single tap, delayed commit hay rollback khi có tap thứ hai, khoảng cách cho phép giữa hai tap.
- Tap ↔ drag: ngưỡng di chuyển/thời gian, xác định origin và thời điểm khóa drag mode.
- Drag từ Empty: sample nào tính là cell đã đi qua; có nội suy ô bị bỏ qua giữa events không; commit trong drag hay release.
- Drag từ X: thời điểm removal; cách xử lý sample lặp/re-entry chưa được evidence chốt.
- Boundary input: sample nhảy nhiều ô, diagonal/corner, ra ngoài board rồi quay lại, touch cancel, mất focus/multi-touch. Không tự lấy phép floor tọa độ hiện tại làm reference sampling rule.
- Track ? rendering, event ordering/timing, win/lose popup timing vẫn UNKNOWN theo contract; marker debug không xác nhận visual parity.
- Các UNKNOWN khác trong contract vẫn giữ: g, clue encoding/formula, hint/place-track, score, progression, persistence, audio và platform behavior.

Confirmed semantic rules như double tap → TrackPreview và boundary-crossing evaluation không đồng nghĩa đã biết cách phân loại chuỗi pointer thành gesture. Tests dùng semantic commands không chứng minh gesture timing/sampling.

## 5. Đề xuất scope T7 — Gesture Contract & Input Evidence Gate

**Đề xuất mới, chưa phải T7 đã phê duyệt. Chỉ specification/observation, không implementation classifier.** Nếu có kế hoạch T7 hiện hữu, phải đối chiếu trước khi thay thế.

### In scope

1. Lập evidence matrix cho raw pointer trace → semantic gesture → command/commit timing; phân biệt reference Android và target mouse/touch mapping.
2. Quan sát reference các case single/double tap, tap chuyển drag, Empty/X batch, TrackPreview boundary crossing, release/cancel, re-entry và skipped samples. Ghi initial state, trace/timestamp, expected/observed state và nguồn evidence.
3. Chốt từng policy có đủ evidence hoặc quyết định user; dùng nhãn CONFIRMED-BY-USER/OBSERVED/UNKNOWN đúng nguồn, không gọi user observation là automated Android verification.
4. Viết contract cho boundary Presentation input → Application commands: ordering, commit point, cancellation, coordinate mapping và quyền sở hữu transient state. Chưa tạo interface/framework nếu chưa cần.
5. Ghi acceptance traces có expected command sequence và state checkpoints, bao gồm threshold boundary/negative cases **chỉ khi threshold được xác nhận**. Thiếu số đo thì để UNKNOWN và chặn case phụ thuộc.

### Out of scope

- Không classifier code, timer/debounce mặc định, drag interpolation mặc định hoặc hard-coded threshold.
- Không biến TOUCH_END thành single tap hay gọi mỗi pointer move là một cell crossing.
- Không UI polish, Track ? production visual, hints, save/progression, ads/social/FBInstant, level schema hoặc gameplay rule mới.
- Không cleanup Dogdoku, sửa package identity/tooling, rewrite architecture hay thay code T6.

### Deliverables và gate

- Một input/gesture evidence register với trace IDs và nguồn.
- Một gesture contract có confirmed policies và UNKNOWN register; bổ sung gameplay contract chỉ cho quyết định đã được xác nhận.
- Một acceptance matrix và handoff đề xuất implementation slice sau review.
- T7 specification hoàn tất khi mỗi policy có evidence/decision hoặc blocker rõ; **gesture implementation chỉ được mở cho slice không còn UNKNOWN ảnh hưởng acceptance**.

Không có threshold, sampling, commit/cancel policy nào được chốt bằng tài liệu review này. T7 chưa được bắt đầu; cần user giao task.

## 6. Kết luận

- T6 runtime smoke: PASS — theo evidence user cung cấp.
- ConnectTracks unit suite: PASS — Codex chạy lại 147/147.
- T6 architecture trong phần đã đọc: không phát hiện gameplay decision bị đẩy vào render/gesture mapper.
- T6 final closure: PENDING EVIDENCE RECONCILIATION, chưa ghi PASS toàn task.
- Gesture classification/timing/sampling: UNKNOWN.
- T7: đề xuất Gesture Contract & Input Evidence Gate, chưa triển khai.

Review chỉ tạo tài liệu này; không sửa source/config/scene, không cài dependencies, không commit/push. Không bắt đầu implementation T7.
