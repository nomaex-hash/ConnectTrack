import { _decorator, Component } from 'cc';
import { PopupController } from './PopupController';

const { ccclass } = _decorator;


@ccclass('UIScreen')
export abstract class UIScreen extends Component {
  
    protected popups: PopupController | null = null;


    attachPopups(controller: PopupController): void {
        this.popups = controller;
    }


    protected onOpen(): void {
       
    }

   
    protected onClose(): void {
       
    }

  
    open(): void {
        this.onOpen();
    }

  
    close(): void {
        this.onClose();
    }
}
