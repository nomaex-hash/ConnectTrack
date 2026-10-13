import { PopupId } from './PopupId';


export interface PopupController {
   
 
    openPopup<TData>(id: PopupId, data: TData, onClosed?: () => void): void;
}
