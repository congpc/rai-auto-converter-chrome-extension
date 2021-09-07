let RAI = ' RAI';
let storedDataFg;

/**
 * Gets stored data
 */
chrome.storage.sync.get('data', (res) => {
  if (chrome.runtime.lastError) {
    console.log(chrome.runtime.lastError);
  }
  storedDataFg = res.data;

  if (storedDataFg.enabled) {
    searchCurrency(document.body);
    startObserver();
  }
});

/**
 * Listens to preferences and conversion updates sent from the background
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const oldData = { ...storedDataFg };
  storedDataFg = Object.assign(storedDataFg, message);
  if (oldData.enabled && !message.enabled) {
    disconnectObserver();
  } else if (message.enabled) {
    searchCurrency(document.body);
    if (!oldData.enabled) {
      startObserver();
    }
    const differConversion =
      Number(message.conversion) !== Number(oldData.conversion);
    const differMarketPrice = message.marketPrice !== oldData.marketPrice;
    if (differConversion || differMarketPrice) {
      refreshUI(oldData);
    }
  }
});

/**
 * Observer to check for changes in the DOM
 */
const observer = new MutationObserver((mutations) => {
  mutations.forEach(function (mutation) {
    if (mutation.type === 'characterData') {
      searchCurrency(mutation.target.parentNode);
    } else if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        searchCurrency(node);
      });
    }
  });
});

/**
 * Starts observer
 */
function startObserver() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/**
 * Disconnects observer
 */
function disconnectObserver() {
  observer.disconnect();
}

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
const regExpAmount = '-?\\d+(?:\\.\\d+)?(?:,\\d+(?:\\.\\d+)?)*';

/**
 * Searches nodes for currency symbols
 */
function searchCurrency(rootNode) {
  const supportedCurrencies = storedDataFg.supportedCurrencies;
  // printLog('supportedCurrencies:', supportedCurrencies);
  const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    if (!avoidedTags.includes(node.parentNode.tagName.toLowerCase())) {
      if (node.nodeValue && node.nodeValue.trim().length > 0) {
        // console.log('node.nodeValue:', node.nodeValue);
        supportedCurrencies.forEach(currency => {
          processCurrency(node, currency);
        })
      }
    }
  }
}
function getCurrencySymbol(currency) {
  switch(currency) {
    case 'usd':
      return '$';
    case 'eur':
      return '€';
    case 'gbp':
      return '£';
    case 'cny':
      return '元';
    case 'jpy':
      return '¥';
    case 'krw':
      return '₩';
    case 'inr':
      return '₹';
    default:
      break
  }
  return '';
}
function getCurrencyName(currency) {
  switch(currency) {
    case 'usd':
      return 'Dollar';
    case 'eur':
      return 'Euro';
    case 'gbp':
      return 'Pound';
    case 'cny':
      return 'Yuan';
    case 'jpy':
      return 'Yen';
    case 'krw':
      return 'Won';
    case 'inr':
      return 'Rupee';
    default:
      break
  }
  return '';
}
function getCurrencyRegexShort(currency) {
  if (currency === undefined || currency.length < 3) {
    return '(USD|U.S.D.|US\\s?\\$|U.S.\\s?\\$|\\$)';
  }
  const currencyUp = currency.toUpperCase();
  const chars = currencyUp.split('');
  let currencyDot = chars.join('.');
  currencyDot = currencyDot + '.';
  const symbol = getCurrencySymbol(currency);
  const symbolRegex = (symbol.length > 0) ? `\\${symbol}`: '';
  const regex = `(${currencyUp}|${currencyDot}|${currencyUp.substring(0, 2)}\\s?${symbolRegex}|${currencyDot.substring(0, 4)}\\s?${symbolRegex}|${symbolRegex})`;
  // printLog('[getCurrencyRegexShort] currency:' + currency + ', regex:', regex);
  return regex;
}
function getCurrencyRegexLong(currency) {
  if (currency === undefined || currency.length < 3) {
    return '((^|(?<=\\s))((U\\.?S\\.?\\s*)?Dollar[s]?)\\b)';
  }
  const currencyUp = currency.toUpperCase();
  const chars = currencyUp.split('');
  const currencyName = getCurrencyName(currency);
  const regex = `((^|(?<=\\s))((${chars[0]}\\.?${chars[1]}\\.?\\s*)?${currencyName}[s]?)\\b)`;
  // printLog('[getCurrencyRegexLong] currency:' + currency + ', regex:', regex);
  return regex;
}
function processCurrency(node, currency) {
  // console.log('currency:', currency);
  const baseRegExpShortDollar = getCurrencyRegexShort(currency);
  const avoidedChars = '[a-zA-Z0-9$]';
  const regExpPriceJoined =
    '(?<!' +
    avoidedChars +
    ')(' +
    regExpAmount +
    '(' +
    baseRegExpShortDollar +
    '(?!' +
    avoidedChars +
    ')))|(((?<!' +
    avoidedChars +
    ')' +
    baseRegExpShortDollar +
    ')' +
    regExpAmount +
    ')(?!' +
    avoidedChars +
    ')'; // Amount and currency without space
  const regExpDollarShort =
    '(?<!' +
    avoidedChars +
    ')' +
    baseRegExpShortDollar +
    '(?!' +
    avoidedChars +
    ')'; // Currency (amount can be at left or right)
  const regExpDollarLong = getCurrencyRegexLong(currency); // Currency (amount can be at left)
  const regExpExtra = '(k|m|b)';
  const regExpPriceWithNotation = /[\$]\d+?.\d+[?=k|m|b]/gi;
  const regExpPriceWithoutNotation = /(?!\$)\d+?.\d+(?=k|m|b)/gi;

  let nodeValue = node.nodeValue;
  const extraRegex = new RegExp(regExpAmount + '\\s*' + '(kilo|million|billion)', 'gi');
  const result = extraRegex.test(nodeValue);
  // console.log('NodeValue:', nodeValue, ', result:', result);
  if (result) {
    nodeValue = nodeValue.replace(/kilo/gi, 'k');
    nodeValue = nodeValue.replace(/million/gi, 'm');
    nodeValue = nodeValue.replace(/billion/gi, 'b');
    node.nodeValue = nodeValue;
  }

  const joinedResult = new RegExp(regExpPriceJoined, 'gi').test(nodeValue);
  // if (node.nodeValue.indexOf('k') >= 0 || node.nodeValue.indexOf('m') >= 0 || node.nodeValue.indexOf('b') >= 0) {
  //   console.log('Process value:', node.nodeValue, ', result:', joinedResult);
  // }
  if (joinedResult) {
    const expResult = regExpPriceWithNotation.test(nodeValue);
    if (expResult) {
      // Amount and currency with notations (e.g. $2.94k - $2.94m - $2.94b)
      convertPriceWithNotation(node, regExpPriceWithNotation, regExpPriceWithoutNotation, currency);
    } else {
      // Amount and currency without space found (e.g. 11.1USD - $22)
      convertPrice(node, new RegExp(regExpPriceJoined, 'gi'), regExpAmount, currency);
    }
  } else if (new RegExp(regExpDollarShort, 'gi').test(nodeValue)) {
    // Currency found --> search amount left and right
    // -?\d+(?:\.\d+)?(?:,\d+(?:\.\d+)?)*\s*(?<![a-zA-Z0-9$])(USD|U.S.D.|US\s?\$|U.S.\s?\$|\$)(?![a-zA-Z0-9$])
    const regExpPriceLeftStr = regExpAmount + '\\s*' + regExpDollarShort;
    const regExpPriceRightStr = regExpDollarShort + '\\s*' + regExpAmount;
    const regExpPriceLeftExtraStr = regExpAmount + '\\s*' + regExpExtra + '\\s*' + regExpDollarShort;
    const regExpPriceRightExtraStr = regExpDollarShort + '\\s*' + regExpAmount + '\\s*' + regExpExtra;
    const regExpPriceLeft = new RegExp(regExpPriceLeftStr, 'gi');
    const regExpPriceRight = new RegExp(regExpPriceRightStr, 'gi');
    const regExpPriceLeftExtra = new RegExp(regExpPriceLeftExtraStr, 'gi');
    const regExpPriceRightExtra = new RegExp(regExpPriceRightExtraStr, 'gi');
    const leftExtraResult = regExpPriceLeftExtra.test(nodeValue);
    const rightExtraResult = regExpPriceRightExtra.test(nodeValue);
    // console.log('Process short value:', nodeValue, ', result:', leftExtraResult, rightExtraResult);
    if (leftExtraResult) {
      // Amount found at left (e.g. 111.11 k $)
      convertPriceWithNotation(node, regExpPriceLeftExtra, regExpAmount, currency);
    } else if (rightExtraResult) {
      // Amount found at left (e.g. $ 111.11 k)
      convertPriceWithNotation(node, regExpPriceRightExtra, regExpAmount, currency);
    } else if (regExpPriceLeft.test(nodeValue)) {
      // Amount found at left (e.g. 5.55 $)
      convertPrice(node, regExpPriceLeft, regExpAmount, currency);
    } else if (regExpPriceRight.test(nodeValue)) {
      // Amount found at right (e.g. USD 66)
      convertPrice(node, regExpPriceRight, regExpAmount, currency);
    } else if (
      new RegExp('^(' + regExpDollarShort + '|' + regExpDollarShort + ')$', 'gi').test(node.nodeValue.trim())
    ) {
      // Currency symbol isolated in node --> search amount in other nodes (e.g. <span>$</span><span>6.66</span>)
      searchAmount(node, regExpDollarShort, true, currency);
    }
  } else if (new RegExp(regExpDollarLong, 'gi').test(nodeValue)) {
    // console.log('Process long value:', nodeValue);
    // Currency found --> search amount left
    const regExpPriceLeft = new RegExp(regExpAmount + '\\s*' + regExpDollarLong, 'gi');
    if (regExpPriceLeft.test(nodeValue)) {
      // Amount found at left (e.g. 7.77 Dollars)
      convertPrice(node, regExpPriceLeft, regExpAmount, currency);
    } else if (
      new RegExp('^(' + regExpDollarLong + '|' + regExpDollarShort + ')$', 'gi').test(nodeValue.trim())
    ) {
      // Currency symbol isolated in node --> search amount in other nodes (e.g. <span>8</span><span>US Dollar</span>)
      searchAmount(node, regExpDollarLong, false, currency);
    }
  }
}

/**
 * Searches amounts near to a currency symbol
 */
function searchAmount(currencyNode, regExpDollar, searchBothSides, currency) {
  //////////////////// Search in right nodes //////////////////

  if (searchBothSides) {
    // Search in 'uncle' right nodes
    const firstRightUncle = getNextSibling(currencyNode.parentNode);
    if (
      firstRightUncle &&
      firstRightUncle.nodeType === currencyNode.TEXT_NODE &&
      isAmount(firstRightUncle.nodeValue)
    ) {
      const raiAmount = fiatToRai(
        firstRightUncle.nodeValue.match(regExpAmount)[0], currency
      );
      firstRightUncle.nodeValue = raiAmount + RAI;
      currencyNode.nodeValue = '';
      return;
    }

    // Search in 'cousin' right nodes
    if (
      firstRightUncle &&
      firstRightUncle.firstChild &&
      firstRightUncle.firstChild.nodeType === currencyNode.TEXT_NODE &&
      isAmount(firstRightUncle.firstChild.nodeValue)
    ) {
      const firstRightCousin = firstRightUncle.firstChild;
      currencyNode.nodeValue = '';

      if (containsDecimals(firstRightCousin.nodeValue)) {
        const raiAmount = fiatToRai(
          firstRightCousin.nodeValue.match(regExpAmount)[0], currency
        );
        firstRightCousin.nodeValue = raiAmount + RAI;
        return;
      }

      const secondRightUncle = getNextSibling(firstRightUncle);
      if (
        secondRightUncle &&
        secondRightUncle.firstChild &&
        secondRightUncle.firstChild.nodeType === currencyNode.TEXT_NODE &&
        isNumber(secondRightUncle.firstChild.nodeValue, false)
      ) {
        const secondRightCousin = secondRightUncle.firstChild;
        const raiAmount = fiatToRai(
          firstRightCousin.nodeValue.trim() +
            '.' +
            secondRightCousin.nodeValue.trim(), currency
        );
        firstRightCousin.nodeValue = raiAmount + RAI;
        secondRightCousin.nodeValue = '';
      } else {
        const raiAmount = fiatToRai(firstRightCousin.nodeValue, currency);
        firstRightCousin.nodeValue = raiAmount + RAI;
      }

      return;
    }

    // Search in 'nephew' right nodes
    const firstRightBrother = getNextSibling(currencyNode);
    if (
      firstRightBrother &&
      firstRightBrother.firstChild &&
      firstRightBrother.firstChild.nodeType === currencyNode.TEXT_NODE &&
      isAmount(firstRightBrother.firstChild.nodeValue)
    ) {
      const firstRightNephew = firstRightBrother.firstChild;
      currencyNode.nodeValue = '';

      if (containsDecimals(firstRightNephew.nodeValue)) {
        const raiAmount = fiatToRai(
          firstRightNephew.nodeValue.match(regExpAmount)[0], currency
        );
        firstRightNephew.nodeValue = raiAmount + RAI;
        return;
      }

      const secondRightBrother = getNextSibling(firstRightBrother);
      if (
        secondRightBrother &&
        secondRightBrother.firstChild &&
        secondRightBrother.firstChild.nodeType === currencyNode.TEXT_NODE &&
        isNumber(secondRightBrother.firstChild.nodeValue, false)
      ) {
        const secondRightNephew = secondRightBrother.firstChild;
        const raiAmount = fiatToRai(
          firstRightNephew.nodeValue.trim() +
            '.' +
            secondRightNephew.nodeValue.trim(), currency
        );
        firstRightNephew.nodeValue = raiAmount + RAI;
        secondRightNephew.nodeValue = '';
      } else {
        const raiAmount = fiatToRai(firstRightNephew.nodeValue, currency);
        firstRightNephew.nodeValue = raiAmount;
      }

      return;
    }
  }

  //////////////////// Search in left nodes //////////////////

  // Search in 'uncle' left nodes
  const firstLeftUncle = getPrevSibling(currencyNode.parentNode);

  if (
    firstLeftUncle &&
    firstLeftUncle.nodeType === currencyNode.TEXT_NODE &&
    isAmount(firstLeftUncle.nodeValue)
  ) {
    const raiAmount = fiatToRai(
      firstLeftUncle.nodeValue.match(regExpAmount)[0], currency
    );
    firstLeftUncle.nodeValue = raiAmount;
    currencyNode.nodeValue = currencyNode.nodeValue.replace(
      new RegExp(regExpDollar, 'gi'),
      RAI
    );
    return;
  }

  // Search in 'cousin' left nodes
  if (
    firstLeftUncle &&
    firstLeftUncle.firstChild &&
    firstLeftUncle.firstChild.nodeType === currencyNode.TEXT_NODE &&
    isAmount(firstLeftUncle.firstChild.nodeValue)
  ) {
    const firstLeftCousin = firstLeftUncle.firstChild;
    currencyNode.nodeValue = currencyNode.nodeValue.replace(
      new RegExp(regExpDollar, 'gi'),
      RAI
    );

    if (containsDecimals(firstLeftCousin.nodeValue)) {
      const raiAmount = fiatToRai(
        firstLeftCousin.nodeValue.match(regExpAmount)[0], currency
      );
      firstLeftCousin.nodeValue = raiAmount;
      return;
    }

    const secondLeftUncle = getPrevSibling(firstLeftUncle);
    if (
      secondLeftUncle &&
      secondLeftUncle.firstChild &&
      secondLeftUncle.firstChild.nodeType === currencyNode.TEXT_NODE &&
      isNumber(secondLeftUncle.firstChild.nodeValue, true)
    ) {
      const secondLeftCousin = secondLeftUncle.firstChild;
      const raiAmount = fiatToRai(
        secondLeftCousin.nodeValue.trim() +
          '.' +
          firstLeftCousin.nodeValue.trim(), currency
      );
      if (raiAmount.split('.').length > 1) {
        firstLeftCousin.nodeValue = raiAmount.split('.')[1];
        secondLeftCousin.nodeValue = raiAmount.split('.')[0];
      } else {
        firstLeftCousin.nodeValue = '';
        secondLeftCousin.nodeValue = raiAmount.split('.')[0];
      }
    } else {
      const raiAmount = fiatToRai(
        firstLeftCousin.nodeValue.match(regExpAmount)[0], currency
      );
      firstLeftCousin.nodeValue = raiAmount;
    }
    return;
  }

  // Search in 'nephew' left nodes
  const firstLeftBrother = getPrevSibling(currencyNode);
  if (
    firstLeftBrother &&
    firstLeftBrother.firstChild &&
    firstLeftBrother.firstChild.nodeType === currencyNode.TEXT_NODE &&
    isAmount(firstLeftBrother.firstChild.nodeValue)
  ) {
    const firstLeftNephew = firstLeftBrother.firstChild;
    currencyNode.nodeValue = currencyNode.nodeValue.replace(
      new RegExp(regExpDollar, 'gi'),
      RAI
    );

    if (containsDecimals(firstLeftNephew.nodeValue)) {
      const raiAmount = fiatToRai(
        firstLeftNephew.nodeValue.match(regExpAmount)[0], currency
      );
      firstLeftNephew.nodeValue = raiAmount;
      return;
    }

    const secondLeftBrother = getPrevSibling(firstLeftBrother);
    if (
      firstLeftBrother &&
      firstLeftBrother.firstChild &&
      firstLeftBrother.firstChild.nodeType === currencyNode.TEXT_NODE &&
      isNumber(secondLeftBrother.firstChild.nodeValue, true)
    ) {
      const secondLeftNephew = secondLeftBrother.firstChild;
      const raiAmount = fiatToRai(
        secondNephew.nodeValue.trim() + '.' + firstNephew.nodeValue.trim(), currency
      );
      if (raiAmount.split('.').length > 1) {
        firstLeftNephew.nodeValue = raiAmount.split('.')[1];
        secondLeftNephew.nodeValue = raiAmount.split('.')[0];
      } else {
        firstLeftNephew.nodeValue = raiAmount.split('.')[0];
        secondLeftNephew.nodeValue = '';
      }
    } else {
      const raiAmount = fiatToRai(
        firstLeftNephew.nodeValue.match(regExpAmount)[0], currency
      );
      firstLeftNephew.nodeValue = raiAmount;
    }
    return;
  }
}

/**
 * Checks if value is a valid amount
 */
function isAmount(value) {
  return new RegExp(regExpAmount, 'gi').test(value);
}

/**
 * Checks if value is a number
 */
function isNumber(value, allowCommas) {
  if (allowCommas) {
    value = value.replace(/,/g, '');
  }
  return !isNaN(value) && !isNaN(parseFloat(value));
}

/**
 * Checks if amount contains decimal part
 */
function containsDecimals(amount) {
  return amount.split('.').length === 2;
}

/**
 * Transforms price node
 */
function convertPrice(node, regExpPrice, regExpAmount, currency) {
  node.nodeValue.match(regExpPrice).forEach((price) => {
    let priceStr = price.match(regExpAmount)[0];
    // console.log('[convertPrice] price:', price, ', priceStr:', priceStr);
    const raiAmount = fiatToRai(priceStr, currency);
    node.nodeValue = node.nodeValue.replace(price, raiAmount + RAI);
  });
}

function convertPriceWithNotation(node, regExpPrice, regExpAmount, currency = 'usd') {
  const nodes = node.nodeValue.match(regExpPrice);
  if (nodes instanceof Array && nodes.length > 0) {
    nodes.forEach((rawPrice) => {
      const rawPriceLower = rawPrice.toLowerCase();
      let priceStr = rawPriceLower.match(regExpAmount)[0];
      if (priceStr && priceStr.length > 0) {
        priceStr = priceStr.trim().toLowerCase();
        priceStr = priceStr.replace(/,/g, '');
        let price = Number(priceStr);
        // console.log('rawPrice:', rawPrice, ', priceStr:', priceStr, ', price:', price);
        if (price) {
          if (rawPriceLower.indexOf('k') >= 0) {
            price *= 1000;
          } else if (rawPriceLower.indexOf('m') >= 0) {
            price *= 1000000;
          } else if (rawPriceLower.indexOf('b') >= 0) {
            price *= 1000000000;
          }
          const raiAmount = fiatToRai(price + '', currency, true);
          // console.log('raiAmount:', raiAmount);
          node.nodeValue = node.nodeValue.replace(rawPrice, raiAmount + RAI);
        }
      }
    });
  }
}

/**
 * Converts amount to RAI
 */
function fiatToRai(amountString, currency = 'usd', isShorten = false) {
  let decimalsCount = countDecimals(amountString);
  if (decimalsCount === 0) {
    decimalsCount = storedDataFg.decimals;
  }
  // console.log('storedDataFg.decimals:', storedDataFg.decimals, ',amountDecimals:', amountDecimals, ',decimalsCount:', decimalsCount);
  // console.log('[fiatToRai] storedDataFg:', storedDataFg);
  const amountNumber = Number(amountString.replace(/,/g, ''));
  const minToShow = 1 / Math.pow(10, decimalsCount);
  const conversion = storedDataFg.conversions[currency] || storedDataFg.conversion;
  const raiNumber = Number(amountNumber / Number(conversion));
  // const raiNumber = Number(amountNumber / Number(storedDataFg.conversion));
  if (Math.abs(raiNumber) > 0 && Math.abs(raiNumber) < minToShow) {
    const prev = raiNumber < 0 ? '>-' : '<';
    return prev + minToShow;
  }
  let value = raiNumber;
  if (isShorten) {
    value = shortenLargeNumber(raiNumber, decimalsCount);
  }
  // printLog('amountString:' + amountString + ', raiNumber:' + raiNumber + ', value:' + value);
  return value.toLocaleString('en-US', {
    maximumFractionDigits: decimalsCount,
    minimumFractionDigits: decimalsCount,
  });
}

/**
 * Gets next sibling node, skipping space nodes
 */
function getNextSibling(node) {
  nextSibling = node.nextSibling;

  while (
    nextSibling &&
    nextSibling.nodeType === node.TEXT_NODE &&
    nextSibling.nodeValue.trim() === ''
  ) {
    nextSibling = nextSibling.nextSibling;
  }

  return nextSibling;
}

/**
 * Gets previous sibling node, skipping space nodes
 */
function getPrevSibling(node) {
  prevSibling = node.previousSibling;

  while (
    prevSibling &&
    prevSibling.nodeType === node.TEXT_NODE &&
    prevSibling.nodeValue.trim() === ''
  ) {
    prevSibling = prevSibling.previousSibling;
  }

  return prevSibling;
}

function refreshUI(oldData) {
  const rootNode = document.body;
  const expRegRAINode = /\d+[\,|\.+\d]+\d RAI$/gm;
  const expRegRAIValue = /\d+[\,|\.+\d]+\d (?=RAI)/gm;

  const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  const rate = Number(storedDataFg.conversion) / Number(oldData.conversion);
  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    if (
      !avoidedTags.includes(node.parentNode.tagName.toLowerCase()) &&
      expRegRAINode.test(node.nodeValue)
    ) {
      let price = Number(
        node.nodeValue.replace(/\,/gm, '').match(expRegRAIValue)[0]
      );
      // console.log({ price, regex: node.nodeValue.match(expRegRAIValue) });
      if (price) {
        price *= rate;
        const rawValue = node.nodeValue;
        node.nodeValue = node.nodeValue.replace(
          rawValue,
          `${price.toLocaleString('en-US', {
            maximumFractionDigits: storedDataFg.decimals,
            minimumFractionDigits: storedDataFg.decimals,
          })} ${RAI}`
        );
      }
    }
  }
}

/**
 * Shorten number to thousands, millions, billions, etc.
 * http://en.wikipedia.org/wiki/Metric_prefix
 *
 * @param {number} num Number to shorten.
 * @param {number} [digits=0] The number of digits to appear after the decimal point.
 * @returns {string|number}
 *
 * @example
 * // returns '12.5k'
 * shortenLargeNumber(12543, 1)
 *
 * @example
 * // returns '-13k'
 * shortenLargeNumber(-12567)
 *
 * @example
 * // returns '51m'
 * shortenLargeNumber(51000000)
 *
 * @example
 * // returns 651
 * shortenLargeNumber(651)
 *
 * @example
 * // returns 0.12345
 * shortenLargeNumber(0.12345)
 */
function shortenLargeNumber(num, digits) {
  let units = ['k', 'm', 'b'],
      decimal;
  for(let i=units.length-1; i>=0; i--) {
      decimal = Math.pow(1000, i+1);
      if(num <= -decimal || num >= decimal) {
          return +(num / decimal).toFixed(digits) + units[i];
      }
  }
  return num;
}

// get number right of the dot length
function countDecimals(value) {
  if(Math.floor(value) === value) return 0;
  const arr = value.toString().split(".");
  return (arr.length > 1) ? arr[1].length : 0; 
}

function printLog(title, message) {
  if (message !== undefined) {
    console.log(title, message);
  } else {
    console.log(title);
  }
}