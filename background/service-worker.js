import { InterpalsApi } from "../lib/api.js";
import { callPageApi, openProfile } from "../lib/page-api.js";
import {
  getSettings,
  getState,
  saveState,
  getMessagedUsers,
  markMessaged,
} from "../lib/storage.js";

const ALARM_NAME = "interpals-bot-tick";
const helpers = new InterpalsApi();
let tickInFlight = false;

async function updateState(partial) {
  const current = await getState();
  const next = { ...current, ...partial };
  await saveState(next);
  chrome.runtime.sendMessage({ type: "stateUpdated", state: next }).catch(() => {});
  return next;
}

async function scheduleTick(delaySeconds = 0) {
  const when = Date.now() + Math.max(0, delaySeconds) * 1000;
  await chrome.alarms.create(ALARM_NAME, { when });
}

async function clearTick() {
  await chrome.alarms.clear(ALARM_NAME);
}

function reachedLimit(state, settings) {
  return state.openedCount >= settings.maxMessages;
}

function doneStatus(state) {
  return `Done. Viewed ${state.openedCount} profile(s).`;
}

async function processUser(username, settings, visited) {
  if (settings.skipMessaged && visited.has(username)) {
    const state = await getState();
    await updateState({
      skippedCount: state.skippedCount + 1,
      lastStatus: `Skipped ${username} (already viewed)`,
    });
    return false;
  }

  await updateState({ lastStatus: `Viewing ${username}…` });
  const profile = await openProfile(username);
  if (profile.age != null && profile.age < 18) {
    const state = await getState();
    await updateState({
      skippedCount: state.skippedCount + 1,
      lastStatus: `Skipped ${username} (under 18)`,
    });
    return false;
  }

  if (!helpers.matchesFilters(profile, settings)) {
    const state = await getState();
    await updateState({
      skippedCount: state.skippedCount + 1,
      lastStatus: `Skipped ${username} (filter mismatch)`,
    });
    return false;
  }

  await markMessaged(username);

  const state = await getState();
  await updateState({
    openedCount: state.openedCount + 1,
    lastUsername: username,
    lastStatus: `Viewed ${username}`,
  });
  return true;
}

async function finish(status) {
  await clearTick();
  await updateState({
    running: false,
    queue: [],
    queueRemaining: 0,
    lastStatus: status,
  });
}

async function tick() {
  if (tickInFlight) return;
  tickInFlight = true;

  try {
    const state = await getState();
    if (!state.running) {
      await clearTick();
      return;
    }

    const settings = await getSettings();
    if (reachedLimit(state, settings)) {
      await finish(doneStatus(state));
      return;
    }

    let queue = Array.isArray(state.queue) ? [...state.queue] : [];
    let offset = Number(state.offset) || 0;

    if (queue.length === 0) {
      await updateState({ lastStatus: `Searching (offset ${offset})…` });
      const { users } = await callPageApi("searchUsers", settings, offset);

      if (users.length === 0) {
        await finish(state.openedCount > 0 ? doneStatus(state) : "No more search results.");
        return;
      }

      queue = users;
      offset += users.length;
      await updateState({
        queue,
        offset,
        queueRemaining: queue.length,
      });
    }

    const username = queue.shift();
    await updateState({
      queue,
      queueRemaining: queue.length,
      lastStatus: `Working on ${username}…`,
    });

    const visited = await getMessagedUsers();
    try {
      await processUser(username, settings, visited);
    } catch (error) {
      const current = await getState();
      await updateState({
        errorCount: current.errorCount + 1,
        lastStatus: `${username}: ${error.message}`,
      });
    }

    const next = await getState();
    if (!next.running) {
      await clearTick();
      return;
    }
    if (reachedLimit(next, settings)) {
      await finish(doneStatus(next));
      return;
    }

    await scheduleTick(settings.delaySeconds);
    await updateState({
      lastStatus: `${next.lastStatus} · next in ${settings.delaySeconds}s`,
    });
  } catch (error) {
    await finish(error.message);
  } finally {
    tickInFlight = false;
  }
}

async function startBot() {
  const current = await getState();
  if (current.running) return { ok: false, error: "Bot is already running." };

  try {
    await updateState({ lastStatus: "Checking InterPals login…" });
    await callPageApi("checkLogin");
  } catch (error) {
    await updateState({ running: false, lastStatus: error.message });
    return { ok: false, error: error.message };
  }

  await updateState({
    running: true,
    openedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    lastUsername: "",
    lastStatus: "Starting…",
    queueRemaining: 0,
    offset: 0,
    queue: [],
  });
  await scheduleTick(0);
  return { ok: true };
}

async function stopBot() {
  await clearTick();
  await updateState({
    running: false,
    queue: [],
    queueRemaining: 0,
    lastStatus: "Stopped.",
  });
  return { ok: true };
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) tick();
});

chrome.runtime.onStartup.addListener(async () => {
  const state = await getState();
  if (state.running) await scheduleTick(0);
});

chrome.runtime.onInstalled.addListener(async () => {
  const state = await getState();
  if (state.running) await scheduleTick(0);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case "startBot":
        sendResponse(await startBot());
        break;
      case "stopBot":
        sendResponse(await stopBot());
        break;
      case "getState":
        sendResponse({ state: await getState(), settings: await getSettings() });
        break;
      default:
        sendResponse({ ok: false });
    }
  })().catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
