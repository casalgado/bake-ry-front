import * as XLSX from 'xlsx';

/**
 * Column headers for export/import
 * Data columns first (editable), IDs last (for matching)
 */
const COLUMNS = {
  productCollectionName: 'Categoria',
  productName: 'Producto',
  combinationName: 'Variacion',
  costPrice: 'Costo',
  basePrice: 'Venta',
  accountingCode: 'Codigo Contable',
  productId: 'ID Producto',
  productCollectionId: 'ID Categoria',
  combinationId: 'ID Variacion',
};

/**
 * Transform a single product into export rows
 * Products with combinations get one row per combination
 * Products without combinations get one row with empty combination columns
 * @param {Object} product - Product object
 * @returns {Array} - Array of row objects
 */
function transformProductToRows(product) {
  const rows = [];

  // Handle both VariationGroups instances and plain objects
  let combinations = [];
  if (product.variations) {
    if (typeof product.variations.toPlainObject === 'function') {
      // It's a VariationGroups instance
      combinations = product.variations.combinations || [];
    } else if (Array.isArray(product.variations)) {
      // Legacy array format - treat each variation as a combination
      combinations = product.variations;
    } else if (product.variations.combinations) {
      // It's a plain object with combinations
      combinations = product.variations.combinations;
    }
  }

  // Debug log
  if (combinations.length > 0) {
    console.log(`Export - Product "${product.name}": ${combinations.length} combinations, first combo:`, combinations[0]);
  } else {
    console.log(`Export - Product "${product.name}": no combinations, variations structure:`, product.variations);
  }

  if (combinations.length === 0) {
    // Product without combinations - single row
    rows.push({
      productCollectionName: product.collectionName || '',
      productName: product.name || '',
      combinationName: '',
      costPrice: product.costPrice ?? '',
      basePrice: product.basePrice ?? '',
      accountingCode: product.accountingCode || '',
      productId: product.id || '',
      productCollectionId: product.collectionId || '',
      combinationId: '',
    });
  } else {
    // Product with combinations - one row per combination
    combinations.forEach(combo => {
      rows.push({
        productCollectionName: product.collectionName || '',
        productName: product.name || '',
        combinationName: combo.name || '',
        costPrice: combo.costPrice ?? '',
        basePrice: combo.basePrice ?? '',
        accountingCode: combo.accountingCode || '',
        productId: product.id || '',
        productCollectionId: product.collectionId || '',
        combinationId: combo.id || '',
      });
    });
  }

  return rows;
}

/**
 * Export products to Excel or CSV file
 * @param {Array} products - Array of product objects
 * @param {string} format - 'xlsx' or 'csv'
 */
export function exportProducts(products, format = 'xlsx') {
  const productsArray = Array.isArray(products) ? products : [];

  // Transform all products into rows
  const allRows = productsArray.flatMap(product => transformProductToRows(product));

  // Rename columns for export (use Spanish labels)
  const exportRows = allRows.map(row => ({
    [COLUMNS.productCollectionName]: row.productCollectionName,
    [COLUMNS.productName]: row.productName,
    [COLUMNS.combinationName]: row.combinationName,
    [COLUMNS.costPrice]: row.costPrice,
    [COLUMNS.basePrice]: row.basePrice,
    [COLUMNS.accountingCode]: row.accountingCode,
    [COLUMNS.productId]: row.productId,
    [COLUMNS.productCollectionId]: row.productCollectionId,
    [COLUMNS.combinationId]: row.combinationId,
  }));

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportRows);

  // Set column widths
  worksheet['!cols'] = [
    { width: 20 }, // Categoria
    { width: 25 }, // Producto
    { width: 20 }, // Variación
    { width: 12 }, // Costo
    { width: 12 }, // Precio
    { width: 18 }, // Código Contable
    { width: 25 }, // ID Producto
    { width: 25 }, // ID Categoria
    { width: 25 }, // ID Variación
  ];

  // Create workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `productos_export_${dateStr}.${format}`;

  // Download file
  if (format === 'csv') {
    XLSX.writeFile(workbook, filename, { bookType: 'csv' });
  } else {
    XLSX.writeFile(workbook, filename);
  }

  return { rowCount: allRows.length };
}

/**
 * Parse an imported Excel/CSV file into row objects
 * @param {File} file - File object from input
 * @returns {Promise<Array>} - Promise resolving to array of parsed rows
 */
export async function parseProductsFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON - use defval to preserve empty cells
        const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        // Debug: log the columns found in first row
        if (rawRows.length > 0) {
          console.log('Import - Columns found:', Object.keys(rawRows[0]));
          console.log('Import - First row sample:', rawRows[0]);
        }

        // Map Spanish column names back to internal names
        const columnMapping = {};
        Object.entries(COLUMNS).forEach(([key, label]) => {
          columnMapping[label] = key;
        });

        const rows = rawRows.map(row => {
          const mappedRow = {};
          Object.entries(row).forEach(([key, value]) => {
            const internalKey = columnMapping[key] || key;
            mappedRow[internalKey] = value;
          });
          return mappedRow;
        });

        // Debug: log mapped row
        if (rows.length > 0) {
          console.log('Import - Mapped first row:', rows[0]);
        }

        resolve(rows);
      } catch (error) {
        reject(new Error(`Error al leer archivo: ${error.message}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Error al leer archivo'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Compute changes between imported rows and existing products
 * Only returns changes for non-empty values in the import
 * @param {Array} rows - Parsed import rows
 * @param {Array} existingProducts - Current products from store
 * @returns {Object} - { changes: Array, errors: Array, summary: Object }
 */
export function computeProductChanges(rows, existingProducts) {
  const changes = [];
  const errors = [];
  const productsMap = new Map();

  // Build lookup map for existing products
  existingProducts.forEach(product => {
    productsMap.set(String(product.id), product);
  });

  rows.forEach((row, rowIndex) => {
    const productId = row.productId ? String(row.productId) : null;
    const combinationId = row.combinationId ? String(row.combinationId) : null;
    const combinationName = row.combinationName ? String(row.combinationName).toLowerCase().trim() : null;

    if (!productId) {
      errors.push({
        row: rowIndex + 2, // +2 for 1-indexed and header row
        message: 'Falta ID de producto',
      });
      return;
    }

    const product = productsMap.get(productId);
    if (!product) {
      errors.push({
        row: rowIndex + 2,
        message: `Producto no encontrado: ${productId}`,
      });
      return;
    }

    const productName = product.name || row.productName;
    const combinations = product.variations?.combinations || [];
    const hasCombinations = combinations.length > 0;

    // Try to find the combination - by ID first, then by name as fallback
    let combo = null;
    if (hasCombinations) {
      if (combinationId) {
        combo = combinations.find(c => String(c.id) === combinationId);
      }
      // Fallback: match by name if ID didn't work
      if (!combo && combinationName) {
        combo = combinations.find(c =>
          (c.name || '').toLowerCase().trim() === combinationName,
        );
      }
    }

    // Determine if we're updating a combination or the product itself
    if (hasCombinations) {
      // Product has combinations - must find a matching combo
      if (!combo) {
        errors.push({
          row: rowIndex + 2,
          message: `Variación no encontrada para ${productName}: ${combinationId || combinationName || '(sin ID ni nombre)'}`,
        });
        return;
      }

      const comboName = combo.name || row.combinationName;
      const actualComboId = combo.id;

      // Check each updatable field
      checkFieldChange(
        changes,
        row,
        'costPrice',
        combo.costPrice,
        productId,
        actualComboId,
        productName,
        comboName,
        'Costo',
      );
      checkFieldChange(
        changes,
        row,
        'basePrice',
        combo.basePrice,
        productId,
        actualComboId,
        productName,
        comboName,
        'Venta',
      );
      checkFieldChange(
        changes,
        row,
        'accountingCode',
        combo.accountingCode || '',
        productId,
        actualComboId,
        productName,
        comboName,
        'Código Contable',
      );
    } else {
      // Product without combinations
      checkFieldChange(
        changes,
        row,
        'costPrice',
        product.costPrice,
        productId,
        null,
        productName,
        null,
        'Costo',
      );
      checkFieldChange(
        changes,
        row,
        'basePrice',
        product.basePrice,
        productId,
        null,
        productName,
        null,
        'Venta',
      );
      checkFieldChange(
        changes,
        row,
        'accountingCode',
        product.accountingCode || '',
        productId,
        null,
        productName,
        null,
        'Código Contable',
      );
    }
  });

  return {
    changes,
    errors,
    summary: {
      totalRows: rows.length,
      changesCount: changes.length,
      errorsCount: errors.length,
      affectedProducts: new Set(changes.map(c => c.productId)).size,
    },
  };
}

/**
 * Helper to check if a field has changed and should be updated
 */
function checkFieldChange(
  changes,
  row,
  field,
  oldValue,
  productId,
  combinationId,
  productName,
  combinationName,
  fieldLabel,
) {
  const newValue = row[field];

  // Skip if new value is empty/undefined (partial update behavior)
  if (newValue === '' || newValue === undefined || newValue === null) {
    return;
  }

  // Convert to appropriate types for comparison
  let normalizedOld = oldValue;
  let normalizedNew = newValue;

  if (field === 'costPrice' || field === 'basePrice') {
    normalizedOld = Number(oldValue) || 0;
    normalizedNew = Number(newValue) || 0;
  } else {
    normalizedOld = String(oldValue || '');
    normalizedNew = String(newValue || '');
  }

  // Check if actually changed
  if (normalizedOld !== normalizedNew) {
    changes.push({
      productId,
      combinationId,
      productName,
      combinationName,
      field,
      fieldLabel,
      oldValue: normalizedOld,
      newValue: normalizedNew,
    });
  }
}

/**
 * Apply computed changes to products via the store using bulk update
 * Groups changes by product and sends a single API call
 * @param {Array} changes - Array of change objects from computeProductChanges
 * @param {Object} productStore - Pinia product store
 * @returns {Promise<Object>} - { success: number, failed: number, errors: Array }
 */
export async function applyProductUpdates(changes, productStore) {
  const results = {
    success: 0,
    failed: 0,
    errors: [],
  };

  // Group changes by productId
  const changesByProduct = new Map();
  changes.forEach(change => {
    if (!changesByProduct.has(change.productId)) {
      changesByProduct.set(change.productId, []);
    }
    changesByProduct.get(change.productId).push(change);
  });

  // Build products map for current data
  const productsMap = new Map();
  productStore.items.forEach(product => {
    productsMap.set(product.id, product);
  });

  // Build bulk updates array
  const updates = [];

  for (const [productId, productChanges] of changesByProduct) {
    const product = productsMap.get(productId);
    if (!product) {
      results.failed++;
      results.errors.push(`Producto no encontrado: ${productId}`);
      continue;
    }

    // Build update payload
    const updateData = {};
    let hasProductLevelChanges = false;
    const combinationUpdates = new Map();

    productChanges.forEach(change => {
      if (change.combinationId) {
        // Combination-level change
        if (!combinationUpdates.has(change.combinationId)) {
          combinationUpdates.set(change.combinationId, {});
        }
        combinationUpdates.get(change.combinationId)[change.field] = change.newValue;
      } else {
        // Product-level change
        updateData[change.field] = change.newValue;
        hasProductLevelChanges = true;
      }
    });

    // Handle combination updates
    if (combinationUpdates.size > 0) {
      // Clone variations structure
      const updatedVariations = JSON.parse(JSON.stringify(
        product.variations?.toPlainObject?.() || product.variations || {},
      ));

      if (updatedVariations.combinations) {
        updatedVariations.combinations = updatedVariations.combinations.map(combo => {
          const comboUpdates = combinationUpdates.get(combo.id);
          if (comboUpdates) {
            return { ...combo, ...comboUpdates };
          }
          return combo;
        });
      }

      updateData.variations = updatedVariations;
    }

    // Add to updates array if there are changes
    if (hasProductLevelChanges || combinationUpdates.size > 0) {
      updates.push({ id: productId, data: updateData });
    }
  }

  // Single bulk API call
  if (updates.length > 0) {
    try {
      const response = await productStore.patchAll(updates);

      if (response.data) {
        results.success = response.data.success?.length || 0;
        results.failed += response.data.failed?.length || 0;

        // Collect error messages from failed updates
        if (response.data.failed) {
          response.data.failed.forEach(fail => {
            results.errors.push(`Error en producto ${fail.id}: ${fail.error}`);
          });
        }
      }
    } catch (error) {
      results.failed = updates.length;
      results.errors.push(`Error en actualización masiva: ${error.message}`);
    }
  }

  return results;
}
