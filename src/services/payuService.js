// services/payuService.js
import { BaseService } from './base/resourceService';

export class PayUService extends BaseService {
  constructor(bakeryId) {
    super('payu', `/bakeries/${bakeryId}`);
  }

  // Create a new credit card token
  async createToken(cardData) {
    try {
      const response = await this.api.post(`${this.getPath()}/cards`, {
        cardNumber: cardData.cardNumber,
        expirationDate: cardData.expiryDate,
        cvv: cardData.cvv,
        cardholderName: cardData.cardholderName,
        identificationNumber: cardData.identificationNumber,
        paymentMethod: this.detectCardType(cardData.cardNumber),
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Get all stored payment methods
  async getStoredCards() {
    try {
      const response = await this.api.get(`${this.getPath()}/cards`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Delete a stored card token
  async deleteToken(cardId) {
    try {
      const response = await this.api.delete(`${this.getPath()}/cards/${cardId}`);
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Process a payment using a stored token
  async processPayment(paymentData) {
    try {
      const response = await this.api.post(`${this.getPath()}/payments`, {
        cardId: paymentData.cardId,
        amount: paymentData.amount,
        currency: paymentData.currency || 'COP',
        description: paymentData.description,
        cvv: paymentData.cvv, // Still need CVV for payments
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Create recurring payment
  async createRecurringPayment(recurringData) {
    try {
      const response = await this.api.post(`${this.getPath()}/recurring`, {
        cardId: recurringData.cardId,
        amount: recurringData.amount,
        currency: recurringData.currency || 'COP',
        frequency: recurringData.frequency, // 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'
        startDate: recurringData.startDate,
        description: recurringData.description,
      });
      return this.handleResponse(response);
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Utility function to detect card type
  detectCardType(cardNumber) {
    const cleanNumber = cardNumber.replace(/\s/g, '');

    if (/^4/.test(cleanNumber)) return 'VISA';
    if (/^5[1-5]/.test(cleanNumber)) return 'MASTERCARD';
    if (/^3[47]/.test(cleanNumber)) return 'AMEX';
    if (/^30[0-5]/.test(cleanNumber) || /^36/.test(cleanNumber) || /^38/.test(cleanNumber)) return 'DINERS';

    return 'VISA'; // Default fallback
  }

  // Format card number with spaces
  static formatCardNumber(value) {
    const cleanValue = value.replace(/\s/g, '');
    const formatted = cleanValue.match(/.{1,4}/g)?.join(' ') || cleanValue;
    return formatted;
  }

  // Format expiry date
  static formatExpiryDate(value) {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue.length >= 2) {
      return cleanValue.slice(0, 2) + '/' + cleanValue.slice(2, 4);
    }
    return cleanValue;
  }
}

/*
● Now try testing again with these PayU test credentials. The error should be resolved.

  To test the tokenization, you can use these PayU test card numbers:
  - VISA: 4037997623271984
  - MASTERCARD: 5178151178151178
  - AMEX: 373434877894038

  Test data format:
  {
    "cardNumber": "4037997623271984",
    "expirationDate": "2030/12",
    "cvv": "123",
    "cardholderName": "Test User",
    "identificationNumber": "123456789",
    "payerId": "test_payer_123"
  }

  The SQL error was happening because PayU couldn't validate the merchant credentials in their system. Now it
  should work with the official test credentials.

  */
