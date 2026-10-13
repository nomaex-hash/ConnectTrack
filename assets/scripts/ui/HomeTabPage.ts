import { _decorator } from 'cc';
import { BaseTabGroupManager } from '../home/BaseTabGroupManager';

const { ccclass } = _decorator;

/**
 * Trang "Home" trong carousel bottom bar — 1 trang bình thường như Shop/Leaderboard, bị đẩy đi
 * khi tab khác trượt vào (xem HomeTabGroupManager). KHÔNG cần tự fetch/dựng dữ liệu gì thêm,
 * MainMenuScreen đã tự refresh() khi scene mở — dùng nguyên showGroup()/setHide() mặc định của
 * BaseTabGroupManager, chỉ đóng vai trò đánh dấu 1 trang trong carousel.
 */
@ccclass('HomeTabPage')
export class HomeTabPage extends BaseTabGroupManager {}
