import { AppState } from '../core/AppState';
import { PuzzleContext } from '../model/BoardSaveData';



export const LEVEL_SELECTED_EVENT = 'LevelSelectedEvent';
export const PAUSE_REQUESTED_EVENT = 'PauseRequestedEvent';
export const RESUME_REQUESTED_EVENT = 'ResumeRequestedEvent';
export const SETTINGS_CHANGE_REQUESTED_EVENT = 'SettingsChangeRequestedEvent';
export const NAVIGATE_REQUESTED_EVENT = 'NavigateRequestedEvent';
/**
 * Bấm Restart ở popup Settings (SettingsPopup.onTapReplay) — SettingsPopup không giữ reference tới
 * GameplayScreen hay connectTracksSession nên không tự restart được, chỉ emit sự kiện này; màn
 * Gameplay đang mở tự nghe và restart ĐÚNG session hiện tại của nó (ConnectTracks song song với
 * luồng Dogdoku cũ qua PuzzleSessionHolder — IntentType.Restart vẫn được gửi riêng, không đổi).
 */
export const CONNECT_TRACKS_RESTART_REQUESTED_EVENT = 'ConnectTracksRestartRequestedEvent';
/**
 * Cộng thêm lượt Place Track (ConnectTracks) — SettingsPopup không giữ reference tới
 * connectTracksInventory nên không tự cộng được, chỉ emit sự kiện này; màn Gameplay đang mở tự
 * nghe và cộng thẳng vào kho Place Track của nó (song song với PLACE_DOG_GRANT_REQUESTED_EVENT
 * của luồng Dogdoku cũ — không dùng chung, vì 2 kho hoàn toàn tách biệt).
 */
export const CONNECT_TRACKS_PLACE_TRACK_GRANT_REQUESTED_EVENT = 'ConnectTracksPlaceTrackGrantRequestedEvent';


export interface NavigateRequestedEventPayload {
    readonly to: AppState;
}

export interface LevelSelectedEventPayload {
    readonly context: PuzzleContext;
    readonly levelId: number | null;
}

export interface SettingsChangeRequestedEventPayload {
    readonly bgmVolume?: number;
    readonly sfxVolume?: number;
    readonly vibration?: boolean;
    readonly language?: string;
}


export const LEVEL_UNLOCKED_EVENT = 'LevelUnlockedEvent';
export const SETTINGS_CHANGED_EVENT = 'SettingsChangedEvent';

export const SAVE_REQUESTED_EVENT = 'SaveRequestedEvent';

export interface LevelUnlockedEventPayload {
    readonly levelId: number;
}

export interface SettingsChangedEventPayload {
    readonly bgmVolume: number;
    readonly sfxVolume: number;
    readonly vibration: boolean;
}

export const PLACE_DOG_GRANT_REQUESTED_EVENT = 'PlaceDogGrantRequestedEvent';

export interface PlaceDogGrantRequestedEventPayload {
    readonly amount: number;
}

export interface ConnectTracksPlaceTrackGrantRequestedEventPayload {
    readonly amount: number;
}

export const HINT_GRANT_REQUESTED_EVENT = 'HintGrantRequestedEvent';

export interface HintGrantRequestedEventPayload {
    readonly amount: number;
}

export const BOOT_PROGRESS_EVENT = 'BootProgressEvent';

export interface BootProgressEventPayload {
    readonly progress: number;
    readonly step?: string;
}
