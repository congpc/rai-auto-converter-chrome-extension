const regex = Object.keys(currencyNotation).reduce((rs, curr) => {
  const notation = currencyNotation[curr];
  rs[curr] = {
    prefix: contentRegex.prefixNotation(notation),
    suffix: contentRegex.suffixNotation(notation),
  };
  return rs;
}, {});

let gRAIPrice;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { from, type } = message;
  /* Message from background */
  if (from === 'background') {
    if (type === messToBgType.getRAIPrice && message.data) {
      convertToRAI(message.data, document.body);
      startObserver();
      gRAIPrice = { ...message.data };
    }
  }
});

const observer = new MutationObserver((mutations) => {
  for (let i = 0; i < mutations.length; i++) {
    const mutation = mutations[i];
    if (mutation.type === 'characterData') {
      convertToRAI(gRAIPrice, mutation.target.parentNode);
    } else if (mutation.type === 'childList') {
      mutation.addedNodes.forEach((node) => {
        convertToRAI(gRAIPrice, node);
      });
    }
  }
});

$(async function () {
  sendMessageToBg(messToBgType.getRAIPrice);
});

// Chrome functions

/* Send message to background */
function sendMessageToBg(type, data = {}) {
  return chrome.runtime.sendMessage({ type, from: 'content', data });
}

/* Get data from chrome storage */
function getDataFromContent(key) {
  return new Promise((resolve) => {
    return chrome.storage.sync.get(key, (data) => {
      resolve(data);
    });
  });
}

/* Set data to chrome storage */
function setData(key, data) {
  return chrome.storage.sync.set({ [key]: data });
}

// Helper functions

/* Detect currency type */
function getCurrencyType(text) {
  if (regex) {
    return Object.keys(regex).find(
      (currKey) =>
        regex[currKey]['prefix'].test(text) ||
        regex[currKey]['suffix'].test(text)
    );
  }
  return null;
}

/* Update UI from currency to RAI */
async function _convertOneNodeToRAI(raiPrice, node) {
  if (node instanceof Node) {
    const currencyType = getCurrencyType(node.nodeValue);
    if (currencyType) {
      let rawText = node.nodeValue.match(regex[currencyType]['prefix']);
      if (!rawText) {
        rawText = node.nodeValue.match(regex[currencyType]['suffix'])[0];
      } else {
        rawText = rawText[0];
      }
      if (rawText) {
        let price = Number(
          rawText.replace(/\,/g, '').match(contentRegex.onlyNumber)[0]
        );
        if (rawText.match(contentRegex.kilo)) {
          price *= 1000;
        } else if (rawText.match(contentRegex.million)) {
          price *= 1000000;
        } else if (rawText.match(contentRegex.billion)) {
          price *= 1000000000;
        }
        price *= raiPrice[currencyType];
        let decimals = 0;
        if (rawText.match(contentRegex.getDecimals)) {
          const decimalNumber = rawText.match(contentRegex.getDecimals)[0];
          if (decimalNumber.length > 2) {
            decimals = decimalNumber.length - 1;
          }
        }
        node.nodeValue = node.nodeValue.replace(
          rawText,
          price.toLocaleString('en-US', {
            maximumFractionDigits: decimals,
            minimumFractionDigits: decimals,
          }) + ' RAI'
        );
      }
    }
  }
}

function convertToRAI(raiPrice, rootNode) {
  const treeWalker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);

  while (treeWalker.nextNode()) {
    const node = treeWalker.currentNode;
    if (
      !avoidedTags.includes(node.parentNode.tagName.toLowerCase()) &&
      node.nodeValue.match(contentRegex.common)
    ) {
      _convertOneNodeToRAI(raiPrice, node);
    }
  }
}

// Observations
function startObserver() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function disconnectObserver() {
  observer.disconnect();
}
