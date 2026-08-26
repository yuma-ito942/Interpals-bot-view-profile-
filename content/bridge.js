if (!globalThis.__interpalsOpenerBridgeInstalled) {
  globalThis.__interpalsOpenerBridgeInstalled = true;

  let apiLoader = null;

  function loadApiModule() {
    if (!apiLoader) {
      apiLoader = import(chrome.runtime.getURL("lib/api.js"));
    }
    return apiLoader;
  }

  loadApiModule().catch(() => {});

  function pageLooksLoggedIn(looksLoggedIn) {
    const html = document.documentElement?.innerHTML ?? "";
    if (looksLoggedIn?.(html, location.href)) return true;
    if (/\/app\/auth\/logout|\/app\/logout/i.test(html)) return true;
    if (document.querySelector('a[href*="logout"]')) return true;
    if (/^\/app\//.test(location.pathname) || location.pathname === "/pm.php") {
      return !document.getElementById("header-signin-btn");
    }
    if (document.getElementById("header-signin-btn") || document.getElementById("auth-card")) {
      return false;
    }
    return Boolean(document.querySelector(".sResMain, input[name='age1'], .profileBox"));
  }

  function toSameOrigin(url) {
    try {
      const target = new URL(url, location.origin);
      if (/(?:^|\.)interpals\.net$/i.test(target.hostname)) {
        return `${target.pathname}${target.search}${target.hash}` || "/";
      }
      return target.href;
    } catch {
      return url;
    }
  }

  function xhrRequest(url, { method = "GET", body } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.withCredentials = true;
      if (method === "POST") {
        xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset=UTF-8");
      }
      xhr.onload = () => {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 400,
          status: xhr.status,
          url: xhr.responseURL || `${location.origin}${url}`,
          headers: {},
          text: xhr.responseText ?? "",
        });
      };
      xhr.onerror = () => reject(new Error("Failed to fetch"));
      xhr.ontimeout = () => reject(new Error("InterPals request timed out."));
      xhr.send(body ?? null);
    });
  }

  async function pageFetch(init) {
    const path = toSameOrigin(init.url);
    const options = {
      method: init.method || "GET",
      body: init.body || undefined,
    };

    try {
      const headers = {};
      if (options.method === "POST") {
        headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
        headers["X-Requested-With"] = "XMLHttpRequest";
      }
      const response = await fetch(path, {
        ...options,
        headers,
        credentials: "include",
        redirect: "follow",
      });
      return {
        ok: response.ok,
        status: response.status,
        url: response.url,
        headers: {},
        text: await response.text(),
      };
    } catch {
      return xhrRequest(path, options);
    }
  }

  function readProfileFromDom(username) {
    const html = document.documentElement?.outerHTML ?? "";
    const uid =
      document.querySelector("a.profReportLink")?.getAttribute("user-id") ||
      document.querySelector("[user-id]")?.getAttribute("user-id") ||
      document.querySelector(".hidden-uid")?.textContent?.trim() ||
      html.match(/user-id=["'](\d+)["']/i)?.[1] ||
      html.match(/["']uid["']\s*[:=]\s*["']?(\d+)/i)?.[1] ||
      "";

    const box = document.querySelector(".profileBox");
    const text = (box?.textContent || document.body.textContent || "").replace(/\s+/g, " ").trim();
    const ageMatch = text.match(/,\s*(\d+)\s*y\.o\./i) || text.match(/\b(\d{2})\s*y\.o\./i);
    const nameMatch = text.match(/^([A-Za-z][^,]{0,60}),\s*\d+/) || text.match(/([A-Za-z][A-Za-z0-9_ .'-]{1,40}),\s*\d+/);

    let country = "";
    let countryCode = "";
    const links = [...(document.querySelector(".profLocation")?.querySelectorAll("a") ?? [])];
    if (links.length) {
      const last = links[links.length - 1];
      country = last.textContent.trim();
      const href = last.getAttribute("href") ?? "";
      countryCode = (href.match(/(?:countries|country)=([A-Za-z]{2})/i)?.[1] ?? href.slice(-2)).toUpperCase();
    }

    return {
      username,
      uid,
      age: ageMatch ? Number(ageMatch[1]) : null,
      name: nameMatch?.[1]?.trim() || username,
      country,
      countryCode,
    };
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitForProfileReady(username, timeoutMs = 8000) {
    const start = Date.now();
    const wanted = String(username || "").toLowerCase();

    while (Date.now() - start < timeoutMs) {
      const pathUser = location.pathname.replace(/^\//, "").split("/")[0].toLowerCase();
      const onProfile = Boolean(wanted) && pathUser === wanted;
      const hasBox = Boolean(
        document.querySelector(".profileBox, [user-id], a.profReportLink, .hidden-uid")
      );
      if ((onProfile || !wanted) && hasBox) return true;
      if (/user not found/i.test(document.body?.innerText || "")) return false;
      await sleep(150);
    }

    return Boolean(document.querySelector(".profileBox, [user-id], a.profReportLink"));
  }

  async function dwellOnProfile() {
    try {
      const y = Math.min(420, Math.floor((document.body?.scrollHeight || 0) / 3));
      window.scrollTo({ top: y, behavior: "smooth" });
      await sleep(500);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Ignore scroll errors on unusual pages.
    }
    return true;
  }

  async function handleApi(method, args = []) {
    const { InterpalsApi, looksLoggedIn } = await loadApiModule();
    const api = new InterpalsApi(pageFetch);

    if (method === "checkLogin") {
      if (pageLooksLoggedIn(looksLoggedIn)) {
        return { loggedIn: true, href: location.href };
      }
      await api.ensureLoggedIn();
      return { loggedIn: true, href: location.href };
    }

    if (method === "readOpenProfile") {
      const username = args[0] || location.pathname.replace(/^\//, "").split("/")[0];
      await waitForProfileReady(username);
      await dwellOnProfile();
      try {
        return api.parseProfile(document.documentElement.outerHTML, username);
      } catch {
        return readProfileFromDom(username);
      }
    }

    if (typeof api[method] !== "function") {
      throw new Error(`Unknown InterPals method: ${method}`);
    }

    const result = await api[method](...args);
    return result ?? true;
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "interpalsPing") {
      sendResponse({ ok: true, href: location.href, ready: true });
      return false;
    }

    if (message?.type === "interpalsApi") {
      handleApi(message.method, message.args ?? [])
        .then((result) => sendResponse({ ok: true, result }))
        .catch((error) =>
          sendResponse({
            ok: false,
            error: error.message || String(error),
          })
        );
      return true;
    }

    return false;
  });
}
