/* Bakery settings `features` <-> flat form values. One table: a setting is one line,
 * and the same line reads it into a form and writes it back as a patch.
 *
 * The backend merges a patch group by group, so a form sends only the keys it
 * owns and everything else in `features` is left alone. */
const FIELDS = {
  // order
  activePaymentMethods: 'order.activePaymentMethods',
  defaultDate: 'order.defaultDate',
  allowPartialPayment: 'order.allowPartialPayment',
  timeOfDay: 'order.timeOfDay',
  offlineMode: 'order.offlineMode',
  loadHistoricalOnUserSelection: 'order.loadHistoricalOnUserSelection',
  // products
  offersWholeGrain: 'products.offersWholeGrain',
  // reports
  defaultReportFilter: 'reports.defaultReportFilter',
  showMultipleReports: 'reports.showMultipleReports',
  // invoicing
  taxMode: 'invoicing.taxMode',
  defaultTermsAndConditions: 'invoicing.defaultTermsAndConditions',
  // pos
  posAutoMarkPaid: 'pos.autoMarkPaid',
  posDefaultToCurrentDate: 'pos.defaultToCurrentDate',
  posHideDeliveryOptions: 'pos.hideDeliveryOptions',
  posAutoSelectClient: 'pos.autoSelectClient',
  // modules
  inventoryEnabled: 'inventory.enabled',
  accountingEnabled: 'accounting.enabled',
  // e-invoicing. The backend merges one level deep, so `issuer` and
  // `resolution` are replaced whole: every key they hold must be listed here.
  einvoicingEnabled: 'einvoicing.enabled',
  einvoicingEnvironment: 'einvoicing.environment',
  einvoicingSoftwareId: 'einvoicing.softwareId',
  einvoicingTestSetId: 'einvoicing.testSetId',
  einvoicingNotes: 'einvoicing.notes',
  einvoicingCreditNotePrefix: 'einvoicing.creditNotePrefix',
  issuerNit: 'einvoicing.issuer.nit',
  issuerLegalName: 'einvoicing.issuer.legalName',
  issuerTradeName: 'einvoicing.issuer.tradeName',
  issuerPersonType: 'einvoicing.issuer.personType',
  issuerTaxLevelCode: 'einvoicing.issuer.taxLevelCode',
  issuerPhone: 'einvoicing.issuer.phone',
  issuerEmail: 'einvoicing.issuer.email',
  issuerAddressLine: 'einvoicing.issuer.address.line',
  issuerCityCode: 'einvoicing.issuer.address.cityCode',
  issuerCityName: 'einvoicing.issuer.address.cityName',
  issuerDeptCode: 'einvoicing.issuer.address.deptCode',
  issuerDeptName: 'einvoicing.issuer.address.deptName',
  resolutionNumber: 'einvoicing.resolution.number',
  resolutionPrefix: 'einvoicing.resolution.prefix',
  resolutionFrom: 'einvoicing.resolution.from',
  resolutionTo: 'einvoicing.resolution.to',
  resolutionStartDate: 'einvoicing.resolution.startDate',
  resolutionEndDate: 'einvoicing.resolution.endDate',
  resolutionTechnicalKey: 'einvoicing.resolution.technicalKey',
};

const EINVOICING_FIELDS = Object.keys(FIELDS).filter((key) => FIELDS[key].startsWith('einvoicing.'));

// Who owns what. The system admin never edits an owner field, and the reverse.
export const SIGNUP_FIELDS = [
  'activePaymentMethods', 'defaultDate', 'allowPartialPayment', 'timeOfDay',
];

export const OWNER_FIELDS = [
  ...SIGNUP_FIELDS,
  'offlineMode', 'loadHistoricalOnUserSelection', 'offersWholeGrain',
  'defaultReportFilter', 'showMultipleReports',
  'taxMode', 'defaultTermsAndConditions',
];

export const ADMIN_FIELDS = [
  'posAutoMarkPaid', 'posDefaultToCurrentDate', 'posHideDeliveryOptions', 'posAutoSelectClient',
  'inventoryEnabled', 'accountingEnabled',
  ...EINVOICING_FIELDS,
];

// Complimentary is always on and never drawn, so it does not count as a choice.
export const hasChosenPaymentMethod = (form) =>
  form.activePaymentMethods.some(method => method !== 'complimentary');

export const featuresToForm = (features, keys) => {
  if (!features) return null;
  const form = {};
  for (const key of keys) {
    const value = FIELDS[key].split('.').reduce((node, name) => node?.[name], features);
    form[key] = Array.isArray(value) ? [...value] : value;
  }
  return form;
};

export const formToFeatures = (form, keys) => {
  const features = {};
  for (const key of keys) {
    const path = FIELDS[key].split('.');
    const name = path.pop();
    path.reduce((node, group) => (node[group] ??= {}), features)[name] = form[key];
  }
  return features;
};
