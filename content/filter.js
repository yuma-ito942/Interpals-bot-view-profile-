const HIDDEN_CLASS = "interpals-opener-hidden";
const MIN_CONTACT_AGE = 18;
const ALL_CONTINENTS = ["EU", "AF", "AS", "NA", "SA", "OC"];
const CONTINENT_BY_COUNTRY = {
  US: "NA", CA: "NA", MX: "NA", CR: "NA", PA: "NA", DO: "NA", CU: "NA", PR: "NA",
  UK: "EU", IE: "EU", FR: "EU", DE: "EU", ES: "EU", IT: "EU", PT: "EU", NL: "EU",
  BE: "EU", CH: "EU", AT: "EU", SE: "EU", NO: "EU", FI: "EU", DK: "EU", PL: "EU",
  CZ: "EU", SK: "EU", HU: "EU", RO: "EU", BG: "EU", GR: "EU", HR: "EU", RS: "EU",
  UA: "EU", RU: "EU",
  TR: "AS", IL: "AS", AE: "AS", SA: "AS", QA: "AS", CN: "AS", TW: "AS", HK: "AS",
  JP: "AS", KR: "AS", IN: "AS", PK: "AS", BD: "AS", LK: "AS", NP: "AS", ID: "AS",
  MY: "AS", SG: "AS", TH: "AS", VN: "AS", PH: "AS", KH: "AS",
  EG: "AF", MA: "AF", TN: "AF", DZ: "AF", NG: "AF", GH: "AF", KE: "AF", ZA: "AF",
  AU: "OC", NZ: "OC",
  BR: "SA", AR: "SA", CL: "SA", CO: "SA", PE: "SA", VE: "SA", EC: "SA", UY: "SA", BO: "SA",
};

function parseCard(card) {
  const text = (card.textContent ?? "").replace(/\s+/g, " ").trim();
  const ageMatch = text.match(/,\s*(\d{1,3})\b/);
  const age = ageMatch ? Number(ageMatch[1]) : null;

  let country = "";
  let countryCode = "";

  const flag = card.querySelector('img[src*="/images/flags/iso/"]');
  const src = flag?.getAttribute("src") ?? "";
  const codeMatch = src.match(/\/([a-z]{2})\.(?:gif|png|svg|webp|jpg)/i);
  if (codeMatch) countryCode = codeMatch[1].toUpperCase();

  if (ageMatch) {
    const afterAge = text.slice(text.indexOf(ageMatch[0]) + ageMatch[0].length).replace(/^[\s,]+/, "");
    country = afterAge.split(",").pop().trim();
  }

  return { age, country, countryCode, text };
}

function countryMatches(info, settings) {
  if (!settings.countries?.length) return true;

  if (info.countryCode && settings.countries.includes(info.countryCode)) {
    return true;
  }

  const lower = (info.country || info.text || "").toLowerCase();
  const names = settings.countryNames ?? [];

  return settings.countries.some((code, index) => {
    const name = names[index] ?? code;
    return lower.includes(name.toLowerCase()) || lower.includes(code.toLowerCase());
  });
}

function continentMatches(info, settings) {
  const continents = settings.continents ?? [];
  if (!continents.length || continents.length >= ALL_CONTINENTS.length) return true;

  const names = (settings.continentNames ?? []).map((name) => name.toLowerCase());
  const continent = CONTINENT_BY_COUNTRY[info.countryCode];
  if (continent && continents.includes(continent)) return true;

  const haystack = `${info.country || ""} ${info.text || ""}`.toLowerCase();
  if (names.some((name) => name && haystack.includes(name))) return true;

  return !info.countryCode && !info.country;
}

function cardMatches(card, settings) {
  const info = parseCard(card);
  const ageMin = Math.max(MIN_CONTACT_AGE, Number(settings.ageMin) || MIN_CONTACT_AGE);
  const ageMax = Math.max(ageMin, Number(settings.ageMax) || 110);

  if (info.age != null && (info.age < ageMin || info.age > ageMax)) return false;
  if (settings.countries?.length > 0 && (info.country || info.countryCode)) {
    if (!countryMatches(info, settings)) return false;
  }
  if (!continentMatches(info, settings)) return false;

  return true;
}

function findResultCards() {
  const cards = new Set();

  for (const el of document.querySelectorAll("div.sResMain")) {
    cards.add(el.closest(".sRes, .sResult, article, li") ?? el);
  }

  for (const link of document.querySelectorAll("a[href^='/']")) {
    const href = link.getAttribute("href") ?? "";
    if (href.startsWith("/app/") || href.includes("pm.php")) continue;
    const username = href.slice(1).split("?")[0].split("/")[0];
    if (!/^[A-Za-z0-9_]+$/.test(username)) continue;

    const card = link.closest("article, li, .sRes, .sResult, div") ?? link.parentElement;
    if (card?.textContent?.match(/,\s*\d+/)) cards.add(card);
  }

  return [...cards];
}

function applyFilter(settings) {
  if (!settings.filterOnPage) {
    document.querySelectorAll(`.${HIDDEN_CLASS}`).forEach((el) => {
      el.classList.remove(HIDDEN_CLASS);
    });
    document.getElementById("interpals-opener-filter-badge")?.remove();
    return;
  }

  let visible = 0;
  let hidden = 0;

  for (const card of findResultCards()) {
    const match = cardMatches(card, settings);
    card.classList.toggle(HIDDEN_CLASS, !match);
    if (match) visible += 1;
    else hidden += 1;
  }

  updateBadge(visible, hidden);
}

function updateBadge(visible, hidden) {
  let badge = document.getElementById("interpals-opener-filter-badge");
  if (!badge) {
    badge = document.createElement("div");
    badge.id = "interpals-opener-filter-badge";
    document.body.appendChild(badge);
  }

  badge.textContent =
    hidden === 0
      ? `Filter active · ${visible} visible`
      : `Filter active · ${visible} visible · ${hidden} hidden`;
}

async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get("settings", ({ settings }) => {
      resolve(
        settings ?? {
          ageMin: 25,
          ageMax: 70,
          countries: [],
          countryNames: [],
          continents: ["EU"],
          continentNames: ["Europe"],
          filterOnPage: true,
        }
      );
    });
  });
}

async function init() {
  const settings = await loadSettings();
  let timer = 0;

  const schedule = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => applyFilter(settings), 160);
  };

  applyFilter(settings);

  const observer = new MutationObserver((mutations) => {
    const relevant = mutations.some((mutation) => {
      if (mutation.target?.id === "interpals-opener-filter-badge") return false;
      return ![...mutation.addedNodes, ...mutation.removedNodes].every(
        (node) => node.id === "interpals-opener-filter-badge"
      );
    });
    if (relevant) schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.settings?.newValue) {
      Object.assign(settings, changes.settings.newValue);
      applyFilter(settings);
    }
  });
}

init();
