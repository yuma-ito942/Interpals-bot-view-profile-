import { CONTINENTS } from "../lib/countries.js";
import {
  getSettings,
  saveSettings,
  clearMessagedUsers,
} from "../lib/storage.js";

const SEARCH_INPUT_IDS = new Set(["continentSearch"]);

const els = {
  ageMin: document.getElementById("ageMin"),
  ageMax: document.getElementById("ageMax"),
  continents: document.getElementById("continents"),
  continentSearch: document.getElementById("continentSearch"),
  continentCount: document.getElementById("continentCount"),
  sexMale: document.getElementById("sexMale"),
  sexFemale: document.getElementById("sexFemale"),
  onlineOnly: document.getElementById("onlineOnly"),
  keywords: document.getElementById("keywords"),
  maxMessages: document.getElementById("maxMessages"),
  delaySeconds: document.getElementById("delaySeconds"),
  skipMessaged: document.getElementById("skipMessaged"),
  filterOnPage: document.getElementById("filterOnPage"),
  statusText: document.getElementById("statusText"),
  openedCount: document.getElementById("openedCount"),
  skippedCount: document.getElementById("skippedCount"),
  errorCount: document.getElementById("errorCount"),
  startBtn: document.getElementById("startBtn"),
  stopBtn: document.getElementById("stopBtn"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
};

function selectedValues(container) {
  return [...container.querySelectorAll("input:checked")].map((input) => input.value);
}

function selectedContinents() {
  return selectedValues(els.continents);
}

function updateContinentCount() {
  const count = selectedContinents().length;
  els.continentCount.textContent = count === 0 ? "All continents" : `${count} selected`;
}

function addCheckItem(container, { name, code, checked }) {
  const label = document.createElement("label");
  label.className = "country-item";
  label.dataset.name = name.toLowerCase();
  label.dataset.code = code.toLowerCase();

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.value = code;
  checkbox.checked = checked;

  const text = document.createElement("span");
  text.textContent = name;

  label.append(checkbox, text);
  container.appendChild(label);
}

function populateContinents(selected = []) {
  els.continents.innerHTML = "";
  for (const continent of CONTINENTS) {
    addCheckItem(els.continents, {
      name: continent.name,
      code: continent.code,
      checked: selected.includes(continent.code),
    });
  }
  updateContinentCount();
}

function readForm() {
  const continents = selectedContinents();
  const continentNames = continents.map(
    (code) => CONTINENTS.find((continent) => continent.code === code)?.name ?? code
  );
  const sex = [];
  if (els.sexMale.checked) sex.push("male");
  if (els.sexFemale.checked) sex.push("female");

  return {
    ageMin: Math.max(18, Number(els.ageMin.value) || 25),
    ageMax: Math.max(Math.max(18, Number(els.ageMin.value) || 25), Number(els.ageMax.value) || 70),
    continents,
    continentNames,
    countries: [],
    countryNames: [],
    sex: sex.length ? sex : ["male"],
    onlineOnly: els.onlineOnly.checked,
    keywords: els.keywords.value.trim(),
    maxMessages: Math.max(1, Number(els.maxMessages.value) || 50),
    delaySeconds: Math.min(300, Math.max(5, Number(els.delaySeconds.value) || 45)),
    skipMessaged: els.skipMessaged.checked,
    filterOnPage: els.filterOnPage.checked,
  };
}

function fillForm(settings) {
  els.ageMin.value = Math.max(18, settings.ageMin);
  els.ageMax.value = Math.max(18, settings.ageMax);
  const continents = settings.continents?.length >= CONTINENTS.length ? [] : settings.continents ?? [];
  populateContinents(continents);
  els.sexMale.checked = !settings.sex?.length || settings.sex.includes("male");
  els.sexFemale.checked = Boolean(settings.sex?.includes("female"));
  els.onlineOnly.checked = settings.onlineOnly;
  els.keywords.value = settings.keywords;
  els.maxMessages.value = settings.maxMessages;
  els.delaySeconds.value = settings.delaySeconds;
  els.skipMessaged.checked = settings.skipMessaged;
  els.filterOnPage.checked = settings.filterOnPage;
}

function renderState(state) {
  els.statusText.textContent = state.lastStatus || "Idle";
  els.openedCount.textContent = state.openedCount ?? 0;
  els.skippedCount.textContent = state.skippedCount;
  els.errorCount.textContent = state.errorCount;
  els.startBtn.disabled = state.running;
  els.stopBtn.disabled = !state.running;
}

async function refreshState() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "getState" });
    if (response?.state) renderState(response.state);
  } catch {
    // Service worker may be waking up.
  }
}

async function persistSettings() {
  const settings = readForm();
  els.ageMin.value = settings.ageMin;
  els.ageMax.value = settings.ageMax;
  els.maxMessages.value = settings.maxMessages;
  els.delaySeconds.value = settings.delaySeconds;
  updateContinentCount();
  await saveSettings(settings);
}

els.startBtn.addEventListener("click", async () => {
  await persistSettings();
  const response = await chrome.runtime.sendMessage({ type: "startBot" });
  if (response?.error) {
    els.statusText.textContent = response.error;
    return;
  }
  await refreshState();
});

els.stopBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "stopBot" });
  await refreshState();
});

els.clearHistoryBtn.addEventListener("click", async () => {
  await clearMessagedUsers();
  els.statusText.textContent = "Viewed-profile history cleared.";
});

function listItems(container) {
  return [...container.querySelectorAll(".country-item")];
}

function applyListFilter(container, searchEl) {
  const query = searchEl.value.trim().toLowerCase();
  for (const item of listItems(container)) {
    const haystack = `${item.dataset.name} ${item.dataset.code}`;
    item.classList.toggle("hidden", Boolean(query) && !haystack.includes(query));
  }
}

function findListItemForQuery(container, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const items = listItems(container);
  const exactName = items.find((item) => item.dataset.name === q);
  if (exactName) return exactName;

  const exactCode = items.find((item) => item.dataset.code === q);
  if (exactCode) return exactCode;

  const nameStarts = items.filter((item) => item.dataset.name.startsWith(q));
  if (nameStarts.length === 1) return nameStarts[0];
  if (nameStarts.length > 1) {
    return [...nameStarts].sort((a, b) => a.dataset.name.length - b.dataset.name.length)[0];
  }

  const visible = items.filter((item) => !item.classList.contains("hidden"));
  if (visible.length === 1) return visible[0];

  const nameContains = items.filter((item) => item.dataset.name.includes(q));
  if (nameContains.length === 1) return nameContains[0];

  return null;
}

function selectListItemFromSearch(container, searchEl) {
  const item = findListItemForQuery(container, searchEl.value);
  if (!item) return;

  const checkbox = item.querySelector("input");
  if (!checkbox) return;

  if (!checkbox.checked) {
    checkbox.checked = true;
    persistSettings();
  }

  searchEl.value = "";
  applyListFilter(container, searchEl);
  item.scrollIntoView({ block: "nearest" });
}

function bindSearchableList(container, searchEl) {
  searchEl.addEventListener("input", () => applyListFilter(container, searchEl));
  searchEl.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    selectListItemFromSearch(container, searchEl);
  });
  container.addEventListener("change", persistSettings);
}

bindSearchableList(els.continents, els.continentSearch);

for (const input of document.querySelectorAll("input")) {
  if (SEARCH_INPUT_IDS.has(input.id)) continue;
  input.addEventListener("change", persistSettings);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "stateUpdated") {
    renderState(message.state);
  }
});

const settings = await getSettings();
fillForm(settings);
await refreshState();
setInterval(refreshState, 2000);
