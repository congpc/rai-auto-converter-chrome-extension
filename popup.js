let storedData = {
  conversion: 0,
  decimals: 2,
  enabled: false,
  refreshConversionTime: 300,
  marketPrice: '1',
};

const minDecimals = 0;
const maxDecimals = 18;
const minInterval = 3;
const maxInterval = 3600;

const decimalsInput = document.getElementById('decimals');
const intervalInput = document.getElementById('interval');
const enabledInput = document.getElementById('enabled');
const priceTypeInput = document.getElementById('priceType');
const raiPriceEl = document.getElementById('raiPrice');

// Asynchronously retrieve data from storage.sync, then cache it.
const initStorageCache = getAllStorageSyncData().then((res) => {
  // Copy the data retrieved from storage into storageCache.
  if (res.data) {
    storedData = Object.assign(storedData, res.data);
  }

  raiPriceEl.textContent = Number(storedData.conversion).toFixed(
    Number(storedData.decimals)
  );
  decimalsInput.value = storedData.decimals;
  intervalInput.value = storedData.refreshConversionTime;
  enabledInput.checked = storedData.enabled;
  priceTypeInput.value = storedData.marketPrice ? '1' : '0';
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    await initStorageCache();
  } catch (e) {
    // Handle error that occurred during storage initialization.
    console.error(e);
  }
  // Normal action handler logic.
});

function getAllStorageSyncData() {
  // Immediately return a promise and start asynchronous work
  return new Promise((resolve, reject) => {
    // Asynchronously fetch all data from storage.sync.
    chrome.storage.sync.get('data', (items) => {
      // console.log('----', items);
      // Pass any observed errors down the promise chain.
      if (chrome.runtime.lastError) {
        return reject(chrome.runtime.lastError);
      }
      // Pass the data retrieved from storage down the promise chain.
      resolve(items);
    });
  });
}

/**
 * Gets stored data
 */
// chrome.storage.sync.get('data', (res) => {
//   if (chrome.runtime.lastError) {
//     console.log(chrome.runtime.lastError);
//     console.log(res);
//     return;
//   }

//   storedData = res.data;

//   raiPriceEl.textContent = Number(storedData.conversion).toFixed(2);
//   decimalsInput.value = storedData.decimals || 2;
//   intervalInput.value = storedData.refreshConversionTime || 300;
//   enabledInput.checked = storedData.enabled;
//   priceTypeInput.value = storedData.marketPrice ? '1' : '0';
// });

/**
 * Listens to conversion updates sent from the backend
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Update price in the front end
  raiPriceEl.textContent = message.newConversion + '';
  storedData.conversion = message.newConversion;
});

/**
 * Manages changes in decimals input
 */
decimalsInput.addEventListener('change', (e) => {
  let value = e.target.value;

  if (value < minDecimals) {
    value = minDecimals;
    decimalsInput.value = value;
  } else if (value > maxDecimals) {
    value = maxDecimals;
    decimalsInput.value = value;
  }

  storedData.decimals = value;
  updatePreferences();
});

/**
 * Manages changes in interval input
 */
intervalInput.addEventListener('change', (e) => {
  let value = e.target.value;

  if (value < minInterval) {
    value = minInterval;
    intervalInput.value = value;
  } else if (value > maxInterval) {
    value = maxInterval;
    intervalInput.value = value;
  }

  storedData.refreshConversionTime = value;
  updatePreferences();
});

/**
 * Manages changes in enabled switch
 */
enabledInput.addEventListener('change', (e) => {
  storedData.enabled = e.target.checked;
  updatePreferences();
});

/**
 * Manages changes in price type input
 */
priceTypeInput.addEventListener('change', (e) => {
  storedData.marketPrice = Boolean(Number(e.target.value));
  updatePreferences();
});

/**
 * Stores updated preferences
 */
function updatePreferences() {
  if (storedData) {
    chrome.storage.sync.set({ data: storedData });
    // Sends message to the background
    chrome.runtime.sendMessage(storedData);
  }
}
