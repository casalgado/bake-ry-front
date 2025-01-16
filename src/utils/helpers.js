const abbreviateText = (text, options = {}) => {
  const defaultOptions = {
    singleWordLength: 4,
    firstWordLength: 2,
    lastWordLength: 2,
    separator: '.',
  };

  // Merge default options with provided options
  const config = { ...defaultOptions, ...options };

  if (!text) return '';

  const words = text.trim().split(/\s+/);

  if (words.length === 1) {
    // Single word - take first N letters based on config
    return words[0].slice(0, config.singleWordLength).toLowerCase();
  } else {
    // Multiple words - take first N of first word + separator + first N of last word
    const lastWord = words[words.length - 1];
    return (
      words[0].slice(0, config.firstWordLength) +
      config.separator +
      lastWord.slice(0, config.lastWordLength)
    ).toLowerCase();
  }
};

const parseSpanishName = (fullName, category) => {
  // Handle empty input
  if (!fullName) {
    return { firstName: '', lastName: '', type: 'unknown' };
  }

  // Clean the input while preserving diacritics and ñ
  let cleanName = fullName
    .replace(/\.$/, '')      // Remove trailing period
    .replace(/\s+/g, ' ')    // Normalize multiple spaces
    .trim()
    .toLowerCase();

  // Check for business names
  if (category === 'B2B') {
    return {
      firstName: capitalize(cleanName),
      name: capitalize(cleanName),
      lastName: '',
    };
  }

  // Handle parenthetical information
  cleanName = cleanName.replace(/\s*\([^)]*\)/g, '');

  // Handle single word names
  const parts = cleanName.split(' ').filter(Boolean);
  if (parts.length === 1) {
    return {
      firstName: capitalize(parts[0]),
      lastName: '',
      name: capitalize(parts[0]),
    };
  }

  let firstName = '';
  let lastName = '';

  // Handle special compound names with "del/de la"
  if (parts[0] === 'maría' && parts[1] === 'del' && parts[2]) {
    firstName = `${parts[0]} ${parts[1]} ${parts[2]}`;
    lastName = parts.slice(3).join(' ');
  }
  // Handle other compound first names
  else if (['maría', 'josé', 'juan', 'ana', 'luís', 'carlos'].includes(parts[0]) && parts[1]) {
    firstName = `${parts[0]} ${parts[1]}`;
    lastName = parts.slice(2).join(' ');
  }
  // Handle cases with "de", "de la", "de las", "de los"
  else if (parts.length >= 2 && parts[1] === 'de') {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }
  // Default case
  else {
    firstName = parts[0];
    lastName = parts.slice(1).join(' ');
  }

  // Clean up and return
  return {
    firstName: capitalize(firstName),
    lastName: capitalize(lastName).replace(/\b(De|Del|La|Las|Los)\b/g, match => match.toLowerCase()),
    name: `${capitalize(firstName)} ${capitalize(lastName).replace(/\b(De|Del|La|Las|Los)\b/g, match => match.toLowerCase())}`,
  };
};

const cleanString = (input) => {
  if (!input) return '';

  let cleaned = input;

  // Convert to string if not already
  cleaned = String(cleaned);

  // Trim whitespace
  cleaned = cleaned.trim();

  // Remove trailing periods
  cleaned = cleaned.replace(/\.+$/, '');

  // Trim again
  cleaned = cleaned.trim();

  // Convert to lowercase
  cleaned = cleaned.toLowerCase();

  // Remove multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ');

  // Remove HTML tags if present
  cleaned = cleaned.replace(/<[^>]*>/g, '');

  return cleaned;
};

const formatMoney = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
};

// Helper function to capitalize words
const capitalize = (str) => {
  if (!str) return '';
  return str.split(' ')
    .map(word => {
      // Don't capitalize connectors and prepositions
      if (['de', 'del', 'la', 'las', 'los', 'y', 'e', 'sin', 'el'].includes(word)) {
        return word;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
};

export { abbreviateText, parseSpanishName, capitalize, formatMoney, cleanString };
