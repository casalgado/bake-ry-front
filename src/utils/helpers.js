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
  console.log('category', category);
  // Handle empty input
  if (!fullName) {
    return { firstName: '', lastName: '', type: 'unknown' };
  }

  // Clean the input
  fullName = fullName.replace(/ñ/g, '__n__').replace(/Ñ/g, '__N__');  // Preserve ñ/Ñ
  fullName = fullName.normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/\.$/, '')  // Remove trailing period
    .replace(/\s+/g, ' ') // Normalize multiple spaces
    .trim()
    .toLowerCase();
  fullName = fullName.replace(/__n__/g, 'ñ').replace(/__N__/g, 'ñ');

  // Explicit business name patterns
  const businessPatterns = [
    /^(cafe|harissa)\s/,
    /\b(sas|foods|group|fithub)\b/,
    /^(inversiones|manufacturas)\s/,
    /plaza del parque/,
    /libros y cafe$/,
    /cafe$/,
    /\b(luzar|ponki)\b/,
  ];

  // Check for business names
  if (businessPatterns.some(pattern => pattern.test(fullName)) || category === 'B2B') {
    return {
      firstName: capitalize(fullName),
      name: capitalize(fullName),
      lastName: '',
    };
  }

  // Handle parenthetical information
  fullName = fullName.replace(/\s*\([^)]*\)/g, '');

  // Handle single word names
  const parts = fullName.split(' ').filter(Boolean);
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
  if (parts[0] === 'maria' && parts[1] === 'del' && parts[2]) {
    firstName = `${parts[0]} ${parts[1]} ${parts[2]}`;
    lastName = parts.slice(3).join(' ');
  }
  // Handle other compound first names
  else if (['maria', 'jose', 'juan', 'ana', 'luis', 'carlos'].includes(parts[0]) && parts[1]) {
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

export { abbreviateText, parseSpanishName, capitalize };
