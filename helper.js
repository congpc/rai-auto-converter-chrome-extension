const currencyNotation = Object.freeze({
  dollar:
    'US DOLLARS{0,}|DOLLARS{0,}|USD|U\\.S\\.D\\.|US\\$|U\\.S\\.\\$|US \\$|U\\.S\\. \\$|\\$',
  euro: 'euros{0,}|eur|e\\.u\\.r\\.|e\\.u\\.r\\.\\€|e\\.u\\.r\\. \\€|eu\\€|e\\.u\\.\\€|eu \\€|e\\.u\\. \\€|\\€',
  yuan: 'yuans{0,}|cny|c\\.n\\.y\\.|c\\.n\\.y\\.\\元|c\\.n\\.y\\. \\元|cn\\元|c\\.n\\.\\元|cn \\元|c\\.n\\. \\元|\\元',
  yen: 'yens{0,}|jpy|j\\.p\\.y\\.|j\\.p\\.y\\.\\¥|j\\.p\\.y\\. \\¥|jp\\¥|j\\.p\\.\\¥|jp \\¥|j\\.p\\. \\¥|\\¥',
  pound:
    'pound sterlings{0,}|pounds{0,}|gbp|g\\.b\\.p\\.|g\\.b\\.p\\.\\£|g\\.b\\.p\\. \\£|gb\\£|g\\.b\\.\\£|gb \\£|g\\.b\\. \\£|\\£',
  won: 'south korean wons{0,}|krw|k\\.r\\.w\\.|k\\.r\\.w\\.\\₩|k\\.r\\.w\\. \\₩|kr\\₩|k\\.r\\.\\₩|kr \\₩|k\\.r\\. \\₩|\\₩',
  rupee:
    'indian rupees{0,}|rupees{0,}|inr|i\\.n\\.r\\.|i\\.n\\.r\\.\\₹|i\\.n\\.r\\. \\₹|in\\₹|i\\.n\\.\\₹|in \\₹|i\\.n\\. \\₹|\\₹',
});

const currencyCharacter = Object.freeze({
  dollar: '$',
  euro: '€',
  yuan: '元',
  yen: '¥',
  pound: '£',
  won: '₩',
  rupee: '₹',
});

const contentRegex = Object.freeze({
  common: new RegExp('.*\\d+[\\.\\,+\\d].*', 'gmi'),
  prefixNotation: (notation = currencyNotation.dollar) =>
    new RegExp(
      `^(\\-\\s*)*(${notation})\\s*\\d+[\\.\\,+\\d\\s*]+[k|kilo|m|million|b|billion]*$`,
      'gmi'
    ),
  suffixNotation: (notation = currencyNotation.dollar) =>
    new RegExp(
      `^(\\-\\s*)*\\d+[\\.\\,+\\d\\s*]+[k|kilo|m|million|b|billion]*\\s*(${notation})$`,
      'gmi'
    ),
  onlyNumber: new RegExp(`\\d+[\\.\\,+\\d]+`, 'gmi'),
  kilo: new RegExp('(k|kilo)\\s{0,}', 'gmi'),
  million: new RegExp('(m|million)\\s{0,}', 'gmi'),
  billion: new RegExp('(b|billion)\\s{0,}', 'gmi'),
  getDecimals: new RegExp('(?!\\d+)(\\.\\d+)', 'gmi'),
});

const messToBgType = Object.freeze({
  getRAIPrice: 'GET_RAI_PRICE',
});

const avoidedTags = [
  'html',
  'head',
  'script',
  'noscript',
  'style',
  'img',
  'textarea',
  'input',
  'audio',
  'video',
];
