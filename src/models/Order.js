import BaseModel from './base/BaseModel.js';
import Combination from './Combination.js';
import { generateId  } from '../utils/helpers.js';

class OrderItem {
  constructor({
    id,
    productId,
    productName,
    collectionId,
    collectionName,
    quantity,
    basePrice,
    currentPrice,
    variation,
    combination,
    recipeId,
    taxPercentage = 0,
    isComplimentary = false,
    productionBatch = 1,
    status = 0,
  }) {
    this.id = id || generateId();
    this.productId = productId;
    this.productName = productName;
    this.collectionId = collectionId;
    this.collectionName = collectionName;
    this.quantity = quantity;
    this.basePrice = basePrice;
    this.currentPrice = currentPrice;
    this.recipeId = recipeId;
    this.taxPercentage = Number(Number(taxPercentage).toFixed(1));
    this.isComplimentary = isComplimentary;
    this.productionBatch = productionBatch;
    this.status = status;

    // Auto-migration: Convert old variation to new combination
    if (variation && !combination) {
      this.combination = Combination.fromLegacyVariation(variation, currentPrice, basePrice);
      this.variation = variation; // Keep for historical reference
    } else if (combination) {
      this.combination = new Combination(combination);
      this.variation = variation; // May be null for new orders
    } else {
      // Handle case where variation is null/undefined and no combination exists
      this.variation = null; // Explicitly set to null instead of leaving undefined
      this.combination = null;
    }

    // Calculate derived values
    this.taxAmount = this.calculateTaxAmount();
    this.preTaxPrice = this.calculatePreTaxPrice();
    this.subtotal = this.calculateSubtotal();
  }

  calculateTaxAmount() {
    if (this.isComplimentary) return 0;
    return this.taxPercentage ?
      Math.round((this.currentPrice * this.taxPercentage) / (100 + this.taxPercentage)) : 0;
  }

  calculatePreTaxPrice() {
    if (this.isComplimentary) return 0;
    return this.currentPrice - this.taxAmount;
  }

  calculateSubtotal() {
    if (this.isComplimentary) return 0;
    return this.quantity * this.currentPrice;
  }

  // Helper to get display name from combination or variation
  getVariationName() {
    if (this.combination) {
      return this.combination.getDisplayName();
    }
    return this.variation?.name || '';
  }

  getItemTotal() {
    if (this.isComplimentary) return 0;

    const price = this.combination ?
      this.combination.currentPrice :
      this.currentPrice;

    return price * this.quantity;
  }

  // Get the effective price from combination or fallback to currentPrice
  getEffectivePrice() {
    return this.combination ? this.combination.currentPrice : this.currentPrice;
  }

  toPlainObject() {
    const data = { ...this };

    // Serialize combination if it exists
    if (this.combination) {
      data.combination = this.combination.toFirestore();
    }

    Object.keys(data).forEach(key => {
      if (data[key] === undefined) {
        delete data[key];
      }
    });
    return data;
  }

  toClientHistoryObject() {
    return {
      productId: this.productId,
      productName: this.productName,
      collectionId: this.collectionId,
      collectionName: this.collectionName,
      isComplimentary: this.isComplimentary,
      taxPercentage: this.taxPercentage,
      quantity: this.quantity,
      currentPrice: this.currentPrice,
      variation: this.variation,
      combination: this.combination ? this.combination.toFirestore() : null,
      taxAmount: this.taxAmount,
      preTaxPrice: this.preTaxPrice,
      subtotal: this.subtotal,
    };
  }
}

class Order extends BaseModel {
  constructor({
    // Basic Information
    id,
    bakeryId,
    userId,
    userName,
    userEmail,
    userPhone,
    userCategory = '',
    userLegalName = '',
    userNationalId = '',
    orderItems = [],

    // Dates
    preparationDate,
    dueDate,
    dueTime,
    createdAt,
    updatedAt,
    paymentDate = null,
    partialPaymentDate = null,

    // Status and Payment
    status = 0,
    isPaid = false,

    isDeliveryPaid = false,
    paymentMethod = 'transfer',
    partialPaymentAmount = 0,

    // Fulfillment
    fulfillmentType = 'pickup',
    deliveryAddress = '',
    deliveryInstructions = '',
    deliveryDriverId = '-',
    driverMarkedAsPaid = false,
    deliverySequence = 1,
    deliveryFee = 0,
    deliveryCost = 0,
    numberOfBags = 1,

    // Notes
    customerNotes = '',
    deliveryNotes = '',
    internalNotes = '',
    isDeleted = false,
    lastEditedBy = null,
  } = {}) {
    super({ id, createdAt, updatedAt, preparationDate, dueDate, paymentDate, partialPaymentDate });

    // Basic Information
    this.bakeryId = bakeryId;
    this.userId = userId;
    this.userName = userName;
    this.userEmail = userEmail;
    this.userPhone = userPhone;
    this.userLegalName = userLegalName;
    this.userCategory = userCategory;

    this.userNationalId = userNationalId;
    this.orderItems = orderItems.map(item =>
      item instanceof OrderItem ? item : new OrderItem({ ...item }),
    );
    this.dueTime = dueTime;

    // Status and Payment
    this.status = status;
    this.isPaid = isPaid;
    this.isDeliveryPaid = isDeliveryPaid;
    this.paymentMethod = paymentMethod;
    this.partialPaymentAmount = partialPaymentAmount;

    // Fulfillment
    this.fulfillmentType = fulfillmentType;
    this.deliveryAddress = deliveryAddress;
    this.deliveryInstructions = deliveryInstructions;
    this.deliveryDriverId = deliveryDriverId;
    this.driverMarkedAsPaid = driverMarkedAsPaid;
    this.deliverySequence = deliverySequence;
    this.deliveryFee = deliveryFee == '' ? 0 : deliveryFee;
    this.deliveryCost = deliveryCost == '' ? 0 : deliveryCost;
    this.numberOfBags = numberOfBags == '' ? 0 : numberOfBags;

    // Set isComplimentary based on paymentMethod
    this.isComplimentary = paymentMethod === 'complimentary' || paymentMethod === 'quote';
    this.isQuote = paymentMethod === 'quote';

    // Calculate all pricing components
    this.calculatePricing();

    // Notes and Flags
    this.customerNotes = customerNotes;
    this.deliveryNotes = deliveryNotes;
    this.internalNotes = internalNotes;
    this.isDeleted = isDeleted;
    this.lastEditedBy = lastEditedBy ? {
      userId: lastEditedBy.userId || null,
      email: lastEditedBy.email || null,
      role: lastEditedBy.role || null,
    } : null;
  }

  calculatePricing() {
    if (this.isComplimentary) {
      this.taxableSubtotal = 0;
      this.nonTaxableSubtotal = 0;
      this.subtotal = 0;
      this.totalTaxAmount = 0;
      this.preTaxTotal = 0;
      this.total = 0;
      return;
    }

    // Calculate subtotals
    this.taxableSubtotal = this.orderItems
      .filter(item => item.taxPercentage > 0)
      .reduce((sum, item) => sum + item.subtotal, 0);

    this.nonTaxableSubtotal = this.orderItems
      .filter(item => !item.taxPercentage)
      .reduce((sum, item) => sum + item.subtotal, 0);

    this.subtotal = this.taxableSubtotal + this.nonTaxableSubtotal;

    // Calculate tax amounts
    this.totalTaxAmount = this.orderItems
      .reduce((sum, item) => sum + (item.taxAmount * item.quantity), 0);

    // Calculate pre-tax total
    this.preTaxTotal = this.subtotal - this.totalTaxAmount;

    // Calculate final total
    if (this.fulfillmentType === 'delivery') {
      this.total = this.subtotal + this.deliveryFee;
    } else {
      this.total = this.subtotal;
    }
  }

  static get dateFields() {
    return [
      ...super.dateFields,
      'preparationDate',
      'paymentDate',
      'partialPaymentDate',
      'dueDate',
    ];
  }

  toClientHistoryObject() {
    return {
      id: this.id,
      bakeryId: this.bakeryId,
      dueDate: this.dueDate,
      preparationDate: this.preparationDate,
      address: this.deliveryAddress,
      subtotal: this.subtotal,
      preTaxTotal: this.preTaxTotal,
      totalTaxAmount: this.totalTaxAmount,
      total: this.total,
      isDeleted: this.isDeleted,
      isComplimentary: this.isComplimentary,
      orderItems: this.orderItems.map(item => item.toClientHistoryObject()),
      fulfillmentType: this.fulfillmentType,
      paymentMethod: this.paymentMethod,
      deliveryFee: this.deliveryFee,
    };
  }

  toFirestore() {
    const data = super.toFirestore();
    if (this.orderItems.length > 0) {
      data.orderItems = this.orderItems.map(item => item.toPlainObject());
    }
    data.lastEditedBy = this.lastEditedBy || null;
    return data;
  }

  static fromFirestore(doc) {
    const data = super.fromFirestore(doc);

    return new Order({
      ...data,
      id: doc.id,
      paymentDate: data.isPaid ? data.paymentDate : null,
      orderItems: data.orderItems?.map(item => new OrderItem(item)),
    });
  }
}

export { Order, OrderItem };
