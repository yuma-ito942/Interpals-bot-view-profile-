import { countryMatchesContinents } from "./countries.js";
import { extractAllByClass, extractByClass, extractLinks, matchOne, stripTags } from "./html.js";

const BASE = "https://www.interpals.net";
const MIN_CONTACT_AGE = 18;

export function looksLoggedIn(html, finalUrl = "") {
  const text = html ?? "";
  const url = finalUrl ?? "";

  if (/\/app\/auth\/logout|\/app\/logout/i.test(text)) return true;
  if (/href=["'][^"']*logout/i.test(text)) return true;
  if (/\b(sign out|log out)\b/i.test(text) && !/header-signin-btn|id=["']auth-card["']/.test(text)) {
    return true;
  }

  const onApp = /\/app\//i.test(url) || /\/pm\.php/i.test(url);
  const onHome = /https?:\/\/(?:www\.)?interpals\.net\/?(?:\?|#|$)/i.test(url);
  const hasSearchUi = /name=["']age1["']|class=["'][^"']*sResMain|id=["']search/i.test(text);
  const hasSignInWall = /header-signin-btn|id=["']auth-card["']/.test(text);

  if (onApp && !hasSignInWall) return true;
  if (hasSearchUi && !hasSignInWall) return true;
  if (onHome && hasSignInWall) return false;
  return false;
}

export class InterpalsApi {
  constructor(fetcher, snapshot) {
    this.fetcher = fetcher;
    this.snapshot = snapshot;
  }

  async fetch(path, { method = "GET", params, body, redirect = "follow" } = {}) {
    let url = path.startsWith("http") ? path : `${BASE}${path.startsWith("/") ? path : `/${path}`}`;

    if (params && method === "GET") {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const item of value) search.append(key, item);
        } else if (value !== undefined && value !== null && value !== "") {
          search.append(key, value);
        }
      }
      const qs = search.toString();
      if (qs) url += (url.includes("?") ? "&" : "?") + qs;
    }

    const headers = {};
    if (method === "POST") {
      headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }

    const init = {
      url,
      method,
      headers,
      redirect: "follow",
      body: method === "POST" ? new URLSearchParams(body).toString() : undefined,
    };

    if (this.fetcher) {
      return this.fetcher(init);
    }

    const pageOrigin = globalThis.location?.hostname?.endsWith("interpals.net")
      ? globalThis.location.origin
      : "";
    const requestUrl = pageOrigin
      ? `${new URL(url, pageOrigin).pathname}${new URL(url, pageOrigin).search}`
      : url;

    const response = await fetch(requestUrl, {
      method,
      credentials: "include",
      redirect: "follow",
      headers,
      body: init.body,
    });
    const responseHeaders = {};
    for (const [key, value] of response.headers.entries()) {
      responseHeaders[key] = value;
    }
    return {
      ok: response.ok,
      status: response.status,
      url: response.url,
      headers: responseHeaders,
      text: await response.text(),
    };
  }

  async ensureLoggedIn() {
    let snapshot = null;
    if (this.snapshot) {
      try {
        snapshot = await this.snapshot();
      } catch {
        snapshot = null;
      }
    }

    try {
      const response = await this.fetch("/app/search");
      if (looksLoggedIn(response.text, response.url)) {
        return response.text;
      }
    } catch (error) {
      if (snapshot?.loggedIn && snapshot.text) {
        return snapshot.text;
      }
      throw error;
    }

    if (snapshot?.loggedIn && snapshot.text) {
      return snapshot.text;
    }

    throw new Error(
      "Not logged in. Open interpals.net, sign in, keep that tab open, then press Start again."
    );
  }

  findCsrfToken(html) {
    const patterns = [
      /name=["']csrf_token["'][^>]*value=["']([^"']+)["']/i,
      /value=["']([^"']+)["'][^>]*name=["']csrf_token["']/i,
      /<meta[^>]+name=["']csrf[_-]token["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']csrf[_-]token["']/i,
      /csrf_token["']?\s*[:=]\s*["']([^"']+)["']/i,
    ];

    for (const pattern of patterns) {
      const token = matchOne(html, pattern);
      if (token) return token;
    }

    throw new Error("Could not find CSRF token on search page.");
  }

  buildSearchParams(settings, csrfToken, offset = 0) {
    const countries = settings.countries?.length > 0 ? settings.countries : ["---"];
    const ageMin = Math.max(MIN_CONTACT_AGE, Number(settings.ageMin) || MIN_CONTACT_AGE);
    const ageMax = Math.max(ageMin, Number(settings.ageMax) || 110);

    const params = {
      offset: String(offset),
      sort: "last_login",
      age1: String(ageMin),
      age2: String(ageMax),
      "sex[]": settings.sex?.length ? settings.sex : ["male", "female"],
      "continents[]": settings.continents?.length
        ? settings.continents
        : ["AF", "AS", "EU", "NA", "OC", "SA"],
      "countries[]": countries,
      "languages[]": ["---"],
      "lfor[]": [
        "lfor_email",
        "lfor_snail",
        "lfor_langex",
        "lfor_friend",
        "lfor_flirt",
        "lfor_relation",
      ],
      keywords: settings.keywords ?? "",
      username: "",
      csrf_token: csrfToken,
    };

    if (settings.onlineOnly) params.online = "1";
    return params;
  }

  parseSearchResults(html) {
    const users = [];

    for (const block of extractAllByClass(html, "sResMain")) {
      const username = this.usernameFromBlock(block);
      if (username) users.push(username);
    }

    if (users.length === 0) {
      const profileLinks = html.matchAll(
        /<a[^>]+href=["']\/([A-Za-z0-9_]+)(?:\?[^"']*)?["'][^>]*(?:title=["']View profile["'])?[^>]*>/gi
      );
      for (const match of profileLinks) {
        const username = match[1];
        if (username && !this.isReservedPath(username)) users.push(username);
      }
    }

    return [...new Set(users)];
  }

  usernameFromBlock(block) {
    const links = extractLinks(block);
    for (const link of links) {
      const href = link.href ?? "";
      if (!href.startsWith("/") || href.startsWith("/app/")) continue;
      const username = href.slice(1).split("?")[0].split("/")[0];
      if (username && /^[A-Za-z0-9_]+$/.test(username) && !this.isReservedPath(username)) {
        return username;
      }
    }

    const text = stripTags(block);
    const fallback = text.split(",")[0]?.trim();
    if (fallback && /^[A-Za-z0-9_]+$/.test(fallback)) return fallback;
    return null;
  }

  isReservedPath(value) {
    return /^(app|pm\.php|images|css|js|static|account|search|auth|faq|privacy|terms)$/i.test(
      value
    );
  }

  parseProfile(html, username) {
    if (html.includes("User not found.")) {
      throw new Error(`User not found: ${username}`);
    }

    const uid =
      matchOne(html, /user-id=["'](\d+)["']/i) ??
      matchOne(html, /class=["'][^"']*hidden-uid[^"']*["'][^>]*>(\d+)/i) ??
      matchOne(html, /["']uid["']\s*[:=]\s*["']?(\d+)/i) ??
      "";

    let age = null;
    let name = username;
    let country = "";
    let countryCode = "";

    const profileBox = extractByClass(html, "profileBox") ?? "";
    const boxText = stripTags(profileBox);
    const ageMatch = boxText.match(/,\s*(\d+)\s*y\.o\./i) ?? boxText.match(/\b(\d{2})\s*y\.o\./i);
    if (ageMatch) age = Number(ageMatch[1]);

    const nameMatch = boxText.match(/^([^,]+),\s*\d+/);
    if (nameMatch) name = nameMatch[1].trim() || username;

    const location = extractByClass(html, "profLocation") ?? "";
    const links = extractLinks(location);
    if (links.length >= 1) {
      const countryLink = links[links.length - 1];
      country = countryLink.text;
      const href = countryLink.href ?? "";
      const codeMatch = href.match(/(?:countries|country)=([A-Za-z]{2})/i) ?? href.match(/([A-Za-z]{2})$/);
      countryCode = (codeMatch?.[1] ?? href.slice(-2)).toUpperCase();
    }

    if (!age) {
      const pageAge = stripTags(html).match(/,\s*(\d{1,3})\s*y\.o\./i);
      if (pageAge) age = Number(pageAge[1]);
    }

    return { username, uid, age, name, country, countryCode };
  }

  matchesFilters(profile, settings) {
    if (profile.age != null && profile.age < MIN_CONTACT_AGE) return false;

    const ageMin = Math.max(MIN_CONTACT_AGE, Number(settings.ageMin) || MIN_CONTACT_AGE);
    const ageMax = Math.max(ageMin, Number(settings.ageMax) || 110);

    if (profile.age != null && (profile.age < ageMin || profile.age > ageMax)) {
      return false;
    }

    if (settings.countries?.length > 0 && profile.countryCode) {
      if (!settings.countries.includes(profile.countryCode)) return false;
    }

    if (!countryMatchesContinents(profile.countryCode, settings.continents)) {
      return false;
    }

    return true;
  }

  async searchUsers(settings, offset = 0) {
    const searchHtml = await this.ensureLoggedIn();
    const csrfToken = this.findCsrfToken(searchHtml);
    const params = this.buildSearchParams(settings, csrfToken, offset);
    const response = await this.fetch("/app/search", { params });
    const body = response.text ?? "";

    if (!looksLoggedIn(body, response.url)) {
      throw new Error(
        "Not logged in. Open interpals.net, sign in, keep that tab open, then press Start again."
      );
    }

    return {
      users: this.parseSearchResults(body),
      csrfToken,
    };
  }

  async getProfile(username) {
    const response = await this.fetch(`/${encodeURIComponent(username)}`);
    return this.parseProfile(response.text ?? "", username);
  }
}
