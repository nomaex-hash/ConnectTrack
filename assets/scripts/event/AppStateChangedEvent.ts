import { AppState } from '../core/AppState';


export const APP_STATE_CHANGED_EVENT = 'AppStateChangedEvent';

export interface AppStateChangedEventPayload {
    readonly from: AppState;
    readonly to: AppState;
}
