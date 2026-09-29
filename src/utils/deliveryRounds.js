// ponytail: one client, hardcoded. Move to bakery settings when a second client asks (tech debt #9).
const ES_ALIMENTO_ROUNDS = ['9am', '2pm', '4pm'];
const DELIVERY_ROUNDS_BY_BAKERY = {
  'es-alimento': ES_ALIMENTO_ROUNDS,
  'es-alimento-dev': ES_ALIMENTO_ROUNDS,
};

// Round n (1-based) is labels[n - 1]; undefined for bakeries without rounds.
export const deliveryRoundLabels = (bakeryId) => DELIVERY_ROUNDS_BY_BAKERY[bakeryId];

// Spread into a DataTable's columns: [] for bakeries without rounds.
// 0 (unassigned) is last so an order with no value moves to round 1 on first click.
export const deliveryRoundColumns = (bakeryId) => {
  const labels = deliveryRoundLabels(bakeryId);
  if (!labels) return [];

  return [{
    id: 'deliveryRound',
    label: 'Ruta',
    field: 'deliveryRound',
    sortable: true,
    type: 'toggle',
    options: [
      ...labels.map((label, i) => ({ value: i + 1, displayText: label })),
      { value: 0, displayText: '-' },
    ],
  }];
};

// Spread into a DataTable's filters: [] for bakeries without rounds.
export const deliveryRoundFilters = (bakeryId) => {
  const labels = deliveryRoundLabels(bakeryId);
  if (!labels) return [];

  return [{
    field: 'deliveryRound',
    options: [
      ...labels.map((label, i) => ({ label, value: i + 1 })),
      { label: 'sin ruta', value: 0 },
    ],
  }];
};
