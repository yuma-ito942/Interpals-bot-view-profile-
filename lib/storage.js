export const DEFAULT_SETTINGS = {
  ageMin: 25,
  ageMax: 70,
  countries: [],
  countryNames: [],
  continents: ["EU"],
  continentNames: ["Europe"],
  sex: ["male"],
  onlineOnly: false,
  keywords: "",
  delaySeconds: 45,
  maxMessages: 50,
  skipMessaged: true,
  defaultsVersion: 6,
  filterOnPage: true,
};

export const DEFAULT_STATE = {
  running: false,
  openedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  lastUsername: "",
  lastStatus: "Idle",
  queueRemaining: 0,
  offset: 0,
  queue: [],
};

export async function getSettings() {
  const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get("settings");
  const merged = { ...DEFAULT_SETTINGS, ...settings };
  if ((settings.defaultsVersion || 0) < 6) {
    if ((settings.defaultsVersion || 0) < 2) {
      merged.sex = ["male"];
      merged.maxMessages = 50;
    }
    if ((settings.defaultsVersion || 0) < 3) {
      merged.ageMin = 25;
      merged.countries = [];
      merged.countryNames = [];
    }
    if ((settings.defaultsVersion || 0) < 4) {
      merged.continents = ["EU"];
      merged.continentNames = ["Europe"];
    }
    if ((settings.defaultsVersion || 0) < 5) {
      merged.ageMax = 70;
    }
    merged.delaySeconds = 45;
    merged.defaultsVersion = 6;
    await chrome.storage.local.set({ settings: merged });
  }
  return merged;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({
    settings: { ...settings, defaultsVersion: 6 },
  });
}

export async function getState() {
  const { botState = DEFAULT_STATE } = await chrome.storage.local.get("botState");
  return { ...DEFAULT_STATE, ...botState };
}

export async function saveState(botState) {
  await chrome.storage.local.set({ botState });
}

export async function getMessagedUsers() {
  const { messagedUsers = [] } = await chrome.storage.local.get("messagedUsers");
  return new Set(messagedUsers);
}

export async function markMessaged(username) {
  const set = await getMessagedUsers();
  set.add(username);
  await chrome.storage.local.set({ messagedUsers: [...set] });
}

export async function clearMessagedUsers() {
  await chrome.storage.local.set({ messagedUsers: [] });
}
