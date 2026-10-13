import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * Dogdoku không có hệ thống tim/năng lượng (xác nhận từ người dùng) — component này CHỈ tồn tại
 * để Cocos resolve được script cho node heartGroup còn sót lại từ prefab tham khảo (MagicSort).
 * Không có logic gì cả. Nên đặt node heartGroup inactive trong Editor, hoặc xoá hẳn node này khi
 * dọn prefab.
 */
@ccclass('HeartGroupPlaceholder')
export class HeartGroupPlaceholder extends Component {}
