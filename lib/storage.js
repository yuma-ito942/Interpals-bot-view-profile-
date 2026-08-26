export const DEFAULT_SETTINGS = {
  ageMin: 25,
  ageMax: 25,
  countries: [],
  countryNames: [],
  continents: [],
  continentNames: [],
  sex: ["male"],
  onlineOnly: false,
  keywords: "",
  delaySeconds: 15,
  maxMessages: 50,
  skipMessaged: true,
  defaultsVersion: 3,
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
  if ((settings.defaultsVersion || 0) < 3) {
    if ((settings.defaultsVersion || 0) < 2) {
      merged.sex = ["male"];
      merged.maxMessages = 50;
    }
    merged.ageMin = 25;
    merged.ageMax = 25;
    merged.countries = [];
    merged.countryNames = [];
    merged.defaultsVersion = 3;
    await chrome.storage.local.set({ settings: merged });
  }
  return merged;
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({
    settings: { ...settings, defaultsVersion: 3 },
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
