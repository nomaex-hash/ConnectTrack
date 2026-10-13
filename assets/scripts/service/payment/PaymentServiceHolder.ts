import { IPaymentService } from './IPaymentService';
import { MockPaymentService } from './MockPaymentService';

export class PaymentServiceHolder {
    private static _current: IPaymentService = new MockPaymentService();

    static get current(): IPaymentService {
        return this._current;
    }

    static set(service: IPaymentService): void {
        this._current = service;
    }
}
