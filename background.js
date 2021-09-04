const defaultPreferences = {
  conversion: 0,
  decimals: 2,
  enabled: false,
  refreshConversionTime: 300,
  marketPrice: '1',
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
  const retrievedConversion = storedDataBg.marketPrice
    ? await getMarketPrice()
    : await getRedemptionPrice();

  // console.log({
  //   retrievedConversion,
  //   storedDataBg,
  // });

  if (retrievedConversion) {
    const newConversion = Number(retrievedConversion).toFixed(
      storedDataBg.decimals
    );
    storedDataBg.conversion = newConversion;

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
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=rai&vs_currencies=usd'
    ).catch((err) => {
      console.log(err);
      return null;
    });

    if (response && response.ok) {
      const json = await response.json();
      return json.rai.usd;
    } else {
      return null;
    }
  } catch (error) {
    console.error(error);
    return null;
  }
}

/**
 * Gets last redemption price form RAI subgraph API
 * https://docs.reflexer.finance/api/api-endpoints
 */
async function getRedemptionPrice() {
  try {
    const data = JSON.stringify({
      query: `{
                systemState(id: "current") {
                  currentRedemptionPrice {
                    value
                  }
                }
              }`,
    });

    const response = await fetch(
      'https://api.thegraph.com/subgraphs/name/reflexer-labs/rai-mainnet',
      {
        method: 'post',
        body: data,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length,
        },
      }
    ).catch((err) => {
      console.log(err);
      return null;
    });

    if (response && response.ok) {
      const json = await response.json();
      return json.data.systemState.currentRedemptionPrice.value;
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
