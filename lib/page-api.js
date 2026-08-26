import { ensureInterpalsTab, sendToTab, navigateTab, sleep } from "./tab-fetch.js";

async function callPageApiOnTab(tabId, method, ...args) {
  const response = await sendToTab(tabId, {
    type: "interpalsApi",
    method,
    args,
  });

  if (!response?.ok) {
    throw new Error(
      response?.error ||
        "The InterPals tab could not handle that request. Refresh interpals.net and press Start again."
    );
  }

  return response.result;
}

export async function callPageApi(method, ...args) {
  const tab = await ensureInterpalsTab();
  return callPageApiOnTab(tab.id, method, ...args);
}

function tabOrigin(tab) {
  try {
    return new URL(tab.url).origin;
  } catch {
    return "https://www.interpals.net";
  }
}

async function openPath(path) {
  const tab = await ensureInterpalsTab();
  const url = `${tabOrigin(tab)}${path.startsWith("/") ? path : `/${path}`}`;
  const current = (tab.url || "").split("#")[0];
  if (current === url.split("#")[0]) {
    return tab;
  }
  const loaded = await navigateTab(tab.id, url);
  await sleep(800);
  return loaded;
}

export async function openProfile(username) {
  const tab = await openPath(`/${encodeURIComponent(username)}`);
  try {
    await chrome.tabs.update(tab.id, { active: true });
  } catch {
    // The tab may already be focused.
  }
  await sleep(400);
  return callPageApiOnTab(tab.id, "readOpenProfile", username);
}
