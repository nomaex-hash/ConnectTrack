# 12 — Localization (Đa ngôn ngữ)

Hệ đa ngôn ngữ **tự viết bằng code**, KHÔNG dùng Localization Editor tích hợp của
Cocos (extension đó đã bị tắt và mọi component `L10nLabel` đã bị gỡ khỏi prefab —
xem mục "Lỗi cần tránh").

---

## 1. Kiến trúc

Hoạt động theo mô hình **Service + Manager**, khớp với các manager khác của dự án.

```
Localization (facade tĩnh)  ──►  LocalizationHolder  ──►  LocalizationManager (Component)
        ▲                                                         │ nạp + cache JSON
        │ get(key)                                                ▼
  LocalizedLabel / LocalizedSprite  ◄── LANGUAGE_CHANGED_EVENT ── EventManager
```

| Thành phần | Vai trò |
|---|---|
| `LocalizationManager` | Component trên node `AppManagers` (persist). Nạp/cache dict JSON, đổi ngôn ngữ, fallback, phát event. |
| `Localization` | Facade tĩnh — API công khai (`get/has/setLanguage/getCurrentLanguage/reload`). |
| `LocalizationHolder` | Giữ instance manager cho facade (giống `DailyServiceHolder`). |
| `LocalizedLabel` | Component gắn lên `cc.Label`: nhập key → tự set + tự refresh khi đổi ngôn ngữ. |
| `LocalizedSprite` | Đổi `SpriteFrame` theo ngôn ngữ (ảnh có chữ). |
| `Language` | Danh sách ngôn ngữ + mặc định/fallback. |
| `LocalizationKeys` (`L10N`) | Danh mục key có autocomplete. |
| `LocalizationEvents` | `LANGUAGE_CHANGED_EVENT`. |

**Nguyên tắc giữ đúng kiến trúc hiện có:**
- Event dùng lại `EventManager` (core) — không polling, không quét scene.
- Lưu ngôn ngữ đi qua luồng settings sẵn có: manager phát `SETTINGS_CHANGE_REQUESTED { language }` → `GameManager` ghi `settings.language` → `SETTINGS_CHANGED` → `SaveManager` persist. Localization **không** phụ thuộc trực tiếp `SaveManager`.
- Manager là Component trên `AppManagers`, khởi tạo trong `Bootloader` như 6 manager kia.

---

## 2. Flow

### Khởi động (Boot)
```
SaveManager.load()  →  settings.language
Bootloader: localizationManager.init(language)   // nạp fallback + ngôn ngữ đã lưu (await)
        →  loadMainScene()                        // UI dựng lên đã có đúng chữ
```
Nạp ngôn ngữ TRƯỚC khi vào Main Menu để không "chớp" chữ sai ở khung hình đầu.

### Đổi ngôn ngữ lúc chạy
```
Localization.setLanguage('vi')
  → manager nạp dict 'vi' (nếu chưa cache)
  → SETTINGS_CHANGE_REQUESTED { language:'vi' }  → GameManager ghi save
  → emit LANGUAGE_CHANGED (1 lần)
  → mọi LocalizedLabel / LocalizedSprite đang sống tự refresh()
```

### Lấy text
```
Localization.get('menu.play')
  → dict[current][key]  ?? dict[fallback][key]  ?? key
```

---

## 3. Cấu trúc thư mục

```
assets/scripts/localization/
├─ Language.ts             DEFAULT_LANGUAGE / FALLBACK_LANGUAGE / SUPPORTED_LANGUAGES
├─ LocalizationEvents.ts   LANGUAGE_CHANGED_EVENT + payload
├─ LocalizationKeys.ts     const L10N (autocomplete)
├─ LocalizationHolder.ts   giữ instance manager
├─ LocalizationManager.ts  Component: nạp/cache/đổi ngôn ngữ/fallback
├─ Localization.ts         facade tĩnh
├─ LocalizedLabel.ts       Component cho cc.Label
└─ LocalizedSprite.ts      Component cho cc.Sprite

assets/resources/localization/
├─ en.json
└─ vi.json                 (thêm ja.json / ko.json là chạy)
```

---

## 4. Quy tắc đặt key

- Dạng `nhóm.tên`, viết thường, phân tách bằng dấu chấm: `menu.play`, `settings.title`.
- Nhóm theo màn/chức năng: `common`, `menu`, `gameplay`, `result`, `settings`, `tutorial`, `streak`, `howToPlay`.
- `common.*` cho chữ dùng chung nhiều nơi (`common.next`, `common.home`).
- Text có biến dùng placeholder `{n}`: ví dụ `streak.best = "Best streak: {n}"`. Code thay bằng `.replace('{n}', value)`.
- **Mọi key trong `L10N` phải có mục ở TẤT CẢ file `<lang>.json`.**
- Không gõ chuỗi key trực tiếp trong code — luôn dùng `L10N.xxx`.

---

## 5. JSON format

Object phẳng `key → text`:

```jsonc
// en.json
{
    "menu.play": "PLAY",
    "menu.dailyLocked": "Reach level {n} to unlock the Daily Challenge!",
    "streak.best": "Best streak: {n}"
}
```
```jsonc
// vi.json
{
    "menu.play": "CHƠI",
    "menu.dailyLocked": "Hãy chơi tới level {n} để mở Thử thách hằng ngày!",
    "streak.best": "Chuỗi tốt nhất: {n}"
}
```

---

## 6. Ví dụ sử dụng

**Label tĩnh (không đổi lúc chạy)** — gắn `LocalizedLabel` trong Inspector, nhập `key`:
```
Node "Title"  →  cc.Label + LocalizedLabel { key: "settings.title" }
```
Không cần code. Đổi ngôn ngữ → tự cập nhật.

**Label động (có số/biến)** — dùng facade trong script màn:
```ts
import { Localization } from '../../localization/Localization';
import { L10N } from '../../localization/LocalizationKeys';

const template = Localization.get(L10N.menu.dailyLocked); // "... {n} ..."
this.msgLabel.string = template.replace('{n}', `${unlockLevel}`);
```

**Nút đổi nhãn theo trạng thái** — `LocalizedLabel.setKey()`:
```ts
this.homeButtonLocalized.setKey(playNow ? L10N.common.playNow : L10N.common.home);
```

**Đổi ngôn ngữ (nút trong Settings):**
```ts
Localization.setLanguage('vi');
```

**Ảnh theo ngôn ngữ:** gắn `LocalizedSprite`, điền `languages: ["en","vi"]` + `frames` song song.

---

## 7. Best Practices

- **Ưu tiên `LocalizedLabel`** cho label tĩnh — Screen không phải tự cập nhật.
- Label do code set (số điểm, đồng hồ, tên biến) thì dùng `Localization.get(L10N...)` ngay tại chỗ set.
- Thêm ngôn ngữ = 1 dòng trong `SUPPORTED_LANGUAGES` + 1 file JSON. Không đụng code khác.
- Giữ `L10N` và các file JSON đồng bộ; thiếu key sẽ rơi về fallback rồi về chính key (dev thấy ngay để bổ sung).
- Text đa dòng: nhúng `\n` trong JSON.

## 8. Lỗi cần tránh

- ❌ **Gắn cả `LocalizedLabel` LẪN `L10nLabel` (Cocos) trên cùng Label** → tranh nhau `label.string`. Đây là lỗi đã xảy ra khiến mất chữ; extension Cocos đã bị tắt (`L10nEnable:false`) và mọi `L10nLabel` đã gỡ.
- ❌ **Gán text bằng code lên Label ĐÃ có `LocalizedLabel`** → bị `LANGUAGE_CHANGED` ghi đè lại. Với text động: hoặc để trống key + `setText`, hoặc không gắn `LocalizedLabel`, tự `Localization.get` trong code.
- ❌ `resources.load` mỗi lần lấy text → SAI. Đã cache trong `Map`, chỉ load 1 lần/ngôn ngữ.
- ❌ Quét toàn scene tìm Label để cập nhật → SAI. Mỗi `LocalizedLabel` tự đăng ký/huỷ qua event.
- ❌ Gõ chuỗi key trực tiếp (`'menu.play'`) rải rác → dùng `L10N.menu.play`.
- ❌ Quên `off`/`targetOff` khi destroy → rò rỉ. `LocalizedLabel` đã tự huỷ đăng ký ở `onDisable` + `onDestroy`.

---

## 9. Trạng thái triển khai

- ✅ Lõi hệ thống (manager/facade/holder/label/sprite/keys/events/language).
- ✅ Tích hợp Save (`GameSettingsData.language`, serializer đọc-khoan-dung, không bump version) + Boot (nạp trước khi vào Menu).
- ✅ `en.json` + `vi.json` với bộ key nền.
- ⏳ **Migrate chữ hardcode** sang key: làm dần từng màn (Main Menu, Gameplay, Result, Settings, Tutorial, Streak, HowToPlay). Label tĩnh → gắn `LocalizedLabel`; label động → `Localization.get`.
