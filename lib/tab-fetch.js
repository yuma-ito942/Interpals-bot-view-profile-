const INTERPALS_TAB_URLS = ["https://www.interpals.net/*", "https://interpals.net/*"];
const SEARCH_URL = "https://www.interpals.net/app/search";

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyError(error) {
  const message = error?.message || String(error || "");
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
    return "Could not reach InterPals. Refresh the InterPals tab, stay signed in, and press Start again.";
  }
  if (/Receiving end does not exist|Could not establish connection/i.test(message)) {
    return "The InterPals tab is not ready. Refresh interpals.net and press Start again.";
  }
  return message || "Could not talk to the InterPals tab. Refresh interpals.net and press Start again.";
}

export async function waitTabComplete(tabId, timeoutMs = 25000) {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === "complete") return;

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("InterPals tab timed out while loading. Refresh the page and try again."));
    }, timeoutMs);

    function onUpdated(id, info) {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

export async function navigateTab(tabId, url, timeoutMs = 25000) {
  const finished = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error("InterPals tab timed out while loading. Refresh the page and try again."));
    }, timeoutMs);

    function onUpdated(id, info, tab) {
      if (id !== tabId || info.status !== "complete") return;
      if (!tab.url || tab.url === "about:blank") return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve(tab);
    }

    chrome.tabs.onUpdated.addListener(onUpdated);
  });

  await chrome.tabs.update(tabId, { url });
  return finished;
}

function isUsableTab(tab) {
  return Boolean(
    tab?.id &&
      !tab.discarded &&
      tab.url &&
      /^https:\/\/(www\.)?interpals\.net\//i.test(tab.url)
  );
}

export async function ensureInterpalsTab() {
  const tabs = await chrome.tabs.query({ url: INTERPALS_TAB_URLS });
  const usable = tabs
    .filter(isUsableTab)
    .sort(
      (a, b) =>
        Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0)
    );

  let tab = usable[0];
  if (!tab?.id) {
    tab = await chrome.tabs.create({ url: SEARCH_URL, active: true });
  }

  await waitTabComplete(tab.id);
  return chrome.tabs.get(tab.id);
}

async function injectBridge(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [0] },
      files: ["content/bridge.js"],
    });
  } catch {
    // The script may already be present.
  }
}

export async function sendToTab(tabId, message) {
  const options = { frameId: 0 };
  let lastError;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (attempt === 1 || attempt === 5) {
      await injectBridge(tabId);
    }

    try {
      const ping = await chrome.tabs.sendMessage(tabId, { type: "interpalsPing" }, options);
      if (!ping?.ok) {
        await sleep(350);
        continue;
      }
      if (message.type === "interpalsPing") return ping;

      const response = await chrome.tabs.sendMessage(tabId, message, options);
      if (response) return response;
    } catch (error) {
      lastError = error;
    }

    await sleep(350);
  }

  throw new Error(friendlyError(lastError));
}
