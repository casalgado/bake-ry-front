// services/einvoiceService.js
import { BaseService } from './base/resourceService';

const toDate = (value) => (value ? new Date(value) : null);

/* The API sends ISO strings; the screens get Dates. */
const normalize = (einvoice) => einvoice && ({
  ...einvoice,
  createdAt: toDate(einvoice.createdAt),
  issuedAt: toDate(einvoice.issuedAt),
  acceptedAt: toDate(einvoice.acceptedAt),
});

/**
 * DIAN electronic invoices and the credit notes that annul them. A document's
 * id is its order's id (invoice) or `{orderId}_nc` (credit note). Issuing,
 * sending and emailing happen server-side in one call; these methods return
 * the document as it ended up.
 */
export class EinvoiceService extends BaseService {
  constructor(bakeryId) {
    super('einvoices', `/bakeries/${bakeryId}`);
  }

  async request(fn) {
    try {
      return (await fn()).data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /** Created between the two dates, newest first. */
  async list({ startDate, endDate } = {}) {
    const data = await this.request(() => this.api.get(this.getPath(), {
      params: { start_date: startDate, end_date: endDate },
    }));
    return data.map(normalize);
  }

  async get(id) {
    return normalize(await this.request(() => this.api.get(`${this.getPath()}/${id}`)));
  }

  /** `{ issuer, einvoice, invoice }`: what issuing would send, or the invoice already issued. */
  async preview(orderId) {
    const data = await this.request(() => this.api.get(`${this.basePath}/orders/${orderId}/einvoice/preview`));
    return { ...data, einvoice: normalize(data.einvoice) };
  }

  async issue(orderId) {
    return normalize(await this.request(() => this.api.post(`${this.basePath}/orders/${orderId}/einvoice`)));
  }

  async annul(orderId, reason) {
    return normalize(await this.request(() => this.api.post(`${this.basePath}/orders/${orderId}/einvoice/annul`, { reason })));
  }

  async checkStatus(id) {
    return normalize(await this.request(() => this.api.post(`${this.getPath()}/${id}/status`)));
  }

  async deliver(id) {
    return normalize(await this.request(() => this.api.post(`${this.getPath()}/${id}/deliver`)));
  }

  /** The PDF as a blob: it needs the auth header, so a plain link won't do. */
  async pdf(id) {
    return this.request(() => this.api.get(`${this.getPath()}/${id}/pdf`, { responseType: 'blob' }));
  }
}
