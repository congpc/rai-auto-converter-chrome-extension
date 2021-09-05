const defaultPreferences = {
  conversion: 0,
  decimals: 2,
  enabled: false,
  refreshConversionTime: 300,
  marketPrice: '1',
  supportedCurrencies: ['usd', 'eur', 'gbp', 'jpy', 'krw', 'cny', 'inr'],
  supportedCoins: ['rai', 'dai', 'usdc', 'susd', 'usdt', 'pax', 'ust', 'busd', 'lusd', 'float'],
  supportedCoinIds: ['rai', 'dai', 'usd-coin', 'nusd', 'tether', 'payperex', 'terrausd', 'busd', 'liquity-usd', 'float-protocol-float']
};
let storedDataBg;
let conversionInterval;

/**
 * Stores default preferences on extension intalled
 */
chrome.runtime.onInstalled.addListener((reason) => {
  if (reason !== chrome.runtime.OnInstalledReason.INSTALL) {
    return;
  }
  chrome.storage.sync.set({ data: defaultPreferences });
});

/**
 * Gets stored preferences
 */
chrome.storage.sync.get('data', (res) => {
  if (chrome.runtime.lastError) {
    console.error(chrome.runtime.lastError);
    return;
  }

  if (res && res.data) {
    storedDataBg = res.data;
  } else {
    storedDataBg = defaultPreferences;
  }

  updateConversion();
  if (typeof Number(storedDataBg.refreshConversionTime) === 'number') {
    turnOnRefreshData(Number(storedDataBg.refreshConversionTime));
  }
});

/**
 * Runs foreground script on page loaded
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && /^(http|file)/.test(tab.url)) {
    executeForeGround(tabId);
  }
});

/**
 * Listens to preferences updates sent from the popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const hasChanges = needToRefresh(message, storedDataBg);
  // console.log({
  //   message,
  //   storedDataBg,
  //   hasChanges,
  // });
  if (hasChanges) {
    turnOffRefreshData();
    storedDataBg = Object.assign({ ...storedDataBg }, { ...message });
    updateConversion();
    turnOnRefreshData(message.refreshConversionTime);

    // Forward changes to the foreground
    chrome.tabs.query({}, (tabs) => {
      for (let i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, storedDataBg);
      }
    });
  }
});

/**
 * Updates the conversion rate RAI/USD
 */
async function updateConversion() {
  const retrievedConversion = await getMarketPrice();
  storedDataBg.supportedCurrencies = defaultPreferences.supportedCurrencies;
  storedDataBg.supportedCoins = defaultPreferences.supportedCoins;
  if (retrievedConversion) {
    let newConversion = {};
    let otherConversions = {};
    const retrievedConversionRai = retrievedConversion.rai;
    const keys = Object.keys(retrievedConversionRai);
    keys.forEach(key => {
      const value = retrievedConversionRai[key];
      newConversion[key] = Number(value).toFixed(
        storedDataBg.decimals
      );
    });
    const supportedCoinIds = defaultPreferences.supportedCoinIds;
    supportedCoinIds.forEach((value, index) => {
      if (value !== 'rai') {
        const coinName = defaultPreferences.supportedCoins[index];
        otherConversions[coinName] = retrievedConversion[value];
      }
    });
    storedDataBg.conversion = newConversion.usd;
    storedDataBg.conversions = newConversion;
    storedDataBg.otherConversions = otherConversions;
    printLog('storedDataBg:', storedDataBg);

    // Store current conversion
    chrome.storage.sync.set({ data: storedDataBg });

    // Send new conversion to the popup
    chrome.runtime.sendMessage({ newConversion });

    // Send new conversion to the foreground
    chrome.tabs.query({}, (tabs) => {
      for (let i = 0; i < tabs.length; ++i) {
        chrome.tabs.sendMessage(tabs[i].id, storedDataBg);
      }
    });
  }
}

/**
 * Gets current market price form CoinGecko API
 * https://www.coingecko.com/api/documentations/v3
 */
async function getMarketPrice() {
  try {
    const supportedCurrencies = defaultPreferences.supportedCurrencies;
    const supportedCoinIds = defaultPreferences.supportedCoinIds;
    const currencies = supportedCurrencies.join();
    const coins = supportedCoinIds.join();
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${currencies}`;
    printLog('url', url);
    const response = await fetch(url).catch((err) => {
      console.log(err);
      return null;
    });
    if (response && response.ok) {
      const json = await response.json();
      printLog('json', json);
      return json;
    } else {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

function turnOnRefreshData(second) {
  // console.log('turnOnRefreshData', second);
  if (conversionInterval) {
    turnOffRefreshData();
  }
  conversionInterval = setInterval(updateConversion, Number(second) * 1000);
}

function turnOffRefreshData() {
  // console.log('turnOffRefreshData');
  if (conversionInterval) {
    clearInterval(conversionInterval);
    conversionInterval = null;
  }
}

function needToRefresh(sourceObject, targetObject) {
  const fields = [
    'conversion',
    'decimals',
    'marketPrice',
    'refreshConversionTime',
  ];
  return fields.some((field) => {
    const differType =
      typeof sourceObject[field] !== typeof targetObject[field];
    const differValue = sourceObject[field] !== targetObject[field];
    return differType || differValue;
  });
}

function executeForeGround(tabId) {
  chrome.scripting
    .executeScript({
      target: { tabId },
      files: ['./foreground.js'],
    })
    .catch((err) => console.log(err));
}

function printLog(title, message) {
  if (message !== undefined) {
    console.log(title, message);
  } else {
    console.log(title);
  }
}