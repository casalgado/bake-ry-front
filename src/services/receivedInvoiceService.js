import { BaseService } from './base/resourceService';

export class ReceivedInvoiceService extends BaseService {
  constructor(bakeryId) {
    super('accounting/received_invoices', `/bakeries/${bakeryId}`);
  }

  async #send(method, path, body) {
    try {
      const response = await this.api[method](`${this.getPath()}/${path}`, body);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** One destination per line, in order; null leaves a line undecided. */
  setDestinations(id, destinations) {
    return this.#send('put', `${id}/destinations`, { destinations });
  }

  /**
   * Books the purchase and the records. Safe to repeat after a failure.
   * `payment` ({ isPaid, paymentDate, paymentMethod }) books it paid; without it, it stays owed.
   */
  confirm(id, payment = null) {
    return this.#send('post', `${id}/confirm`, { payment });
  }

  /** Marks a booked invoice paid, or back to owed with { isPaid: false }. */
  setPayment(id, payment) {
    return this.#send('put', `${id}/payment`, payment);
  }

  ignore(id) {
    return this.#send('post', `${id}/ignore`);
  }

  /** Creates the invoice's supplier as a provider and links its pending invoices. */
  createProvider(id) {
    return this.#send('post', `${id}/provider`);
  }
}
