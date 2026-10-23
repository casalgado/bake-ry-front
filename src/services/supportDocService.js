import { BaseService } from './base/resourceService';

/** An accepted adjustment note annuls the document it corrects. */
export const isAnnulled = (doc) => doc.adjustmentNote?.status === 'accepted';

/**
 * Documentos soporte: what the business buys from a supplier not obliged to
 * invoice, issued and sent to the DIAN by the backend in one call. A document
 * can name its source (`{ type: 'accountingRecord', id }`): the backend issues
 * one per source, so asking again returns the first.
 */
export class SupportDocService extends BaseService {
  constructor(bakeryId) {
    super('support-docs', `/bakeries/${bakeryId}`);
  }

  async request(fn) {
    try {
      return (await fn()).data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  list() {
    return this.request(() => this.api.get(this.getPath()));
  }

  /** `{ providerId?, date, lines: [{ description, quantity, unitPrice }], source?, payment? }` */
  issue(payload) {
    return this.request(() => this.api.post(this.getPath(), payload));
  }

  checkStatus(id) {
    return this.request(() => this.api.post(`${this.getPath()}/${id}/status`));
  }

  annul(id, reason) {
    return this.request(() => this.api.post(`${this.getPath()}/${id}/annul`, { reason }));
  }
}
