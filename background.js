const currencyNotation = Object.freeze({
  dollar: 'usd',
  euro: 'eur',
  yuan: 'cny',
  yen: 'jpy',
  pound: 'gbp',
  won: 'krw',
  rupee: 'inr',
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

const contentRegexBg = Object.freeze({
  prefixNotation: (notationChar = currencyNotation.dollar) =>
    new RegExp(
      `[\\${'\\' + notationChar}]\\s*\\d+[\\.\\,+\\d\\s*]+[k|m|b]`,
      'gmi'
    ),
  suffixNotation: (notationChar = currencyNotation.dollar) =>
    new RegExp(
      `\\d+[\\.\\,+\\d\\s*]+[k|m|b]+\\s*[\\${'\\' + notationChar}]`,
      'gmi'
    ),
  onlyNumber: new RegExp(`\\d+[\\.\\,+\\d]+`, 'gmi'),
});

const messFromContentType = Object.freeze({
  getRAIPrice: 'GET_RAI_PRICE',
});

function callAPI(url, params = {}) {
  return new Promise((resolve) => {
    return fetch(url, params)
      .then((_) => _.json())
      .then((json) => resolve([null, json]))
      .catch((err) => resolve([err, null]));
  });
}

async function getOneRAIPrice() {
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=rai&vs_currencies=${Object.values(
    currencyNotation
  ).join(',')}`;
  const data = await callAPI(url);
  if (data[0]) {
    return null;
  }

  const result = Object.keys(currencyNotation).reduce((rs, key) => {
    rs[key] = data[1].rai[currencyNotation[key]];
    return rs;
  }, {});
  setData('RAIPrice', result);
  return result;
}

// Helpers
function setData(key, data) {
  return chrome.storage.sync.set({ [key]: data });
}

function getData(key, callback) {
  return chrome.storage.sync.get(key, callback);
}

// Chrome functions
/* Send message to content */
function sendMessToContent(type, data = {}) {
  chrome.tabs.query({}, (tabs) => {
    for (let i = 0; i < tabs.length; ++i) {
      chrome.tabs.sendMessage(tabs[i].id, { from: 'background', type, data });
    }
  });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { from, type } = message;
  /* Message from content */
  if (from === 'content') {
    if (type === messFromContentType.getRAIPrice) {
      (async () => {
        const raiPrice = await getOneRAIPrice();
        sendMessToContent(messFromContentType.getRAIPrice, raiPrice);
      })();
    }
  }
});
