/* ==========================================================================
   Build Yourself — storage.js
   A thin persistence layer over localStorage. Every collection is stored
   under its own key so the whole app can be pointed at Firebase later by
   swapping this module's internals for async calls with the same method
   names (get/set/all/remove) — nothing above this layer needs to change.
   ========================================================================== */

const Storage = (() => {
  const NS = "by:"; // Build Yourself namespace
  const KEYS = {
    challenges: NS + "challenges",
    tasks: NS + "tasks",           // { [challengeId]: [ {day, title, desc, note, status, doneDate} ] }
    income: NS + "income",         // { [challengeId]: [ {id, day, amount, source, note, date} ] }
    reports: NS + "reports",       // { [challengeId]: {...snapshot} }
    chats: NS + "chats",           // { [challengeId]: [ {role, text, ts} ] }
    settings: NS + "settings",
    profile: NS + "profile",
    notifications: NS + "notifications" // [ {id, type, text, ts, read} ]
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn("Storage read failed for", key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.warn("Storage write failed for", key, e);
      return false;
    }
  }

  // ---------- Challenges ----------
  function allChallenges() { return read(KEYS.challenges, []); }
  function saveChallenges(list) { return write(KEYS.challenges, list); }
  function getChallenge(id) { return allChallenges().find(c => c.id === id) || null; }
  function upsertChallenge(challenge) {
    const list = allChallenges();
    const idx = list.findIndex(c => c.id === challenge.id);
    if (idx >= 0) list[idx] = challenge; else list.push(challenge);
    saveChallenges(list);
    return challenge;
  }
  function deleteChallenge(id) {
    saveChallenges(allChallenges().filter(c => c.id !== id));
    const t = allTasksMap(); delete t[id]; write(KEYS.tasks, t);
    const i = allIncomeMap(); delete i[id]; write(KEYS.income, i);
    const r = allReportsMap(); delete r[id]; write(KEYS.reports, r);
    const c = allChatsMap(); delete c[id]; write(KEYS.chats, c);
  }

  // ---------- Tasks ----------
  function allTasksMap() { return read(KEYS.tasks, {}); }
  function getTasks(challengeId) { return allTasksMap()[challengeId] || []; }
  function setTasks(challengeId, tasks) {
    const map = allTasksMap();
    map[challengeId] = tasks;
    write(KEYS.tasks, map);
  }

  // ---------- Income ----------
  function allIncomeMap() { return read(KEYS.income, {}); }
  function getIncome(challengeId) { return allIncomeMap()[challengeId] || []; }
  function addIncome(challengeId, entry) {
    const map = allIncomeMap();
    if (!map[challengeId]) map[challengeId] = [];
    map[challengeId].push(entry);
    write(KEYS.income, map);
  }

  // ---------- Reports ----------
  function allReportsMap() { return read(KEYS.reports, {}); }
  function getReport(challengeId) { return allReportsMap()[challengeId] || null; }
  function setReport(challengeId, report) {
    const map = allReportsMap();
    map[challengeId] = report;
    write(KEYS.reports, map);
  }

  // ---------- Chats (per-challenge, isolated AI memory) ----------
  function allChatsMap() { return read(KEYS.chats, {}); }
  function getChat(challengeId) { return allChatsMap()[challengeId] || []; }
  function setChat(challengeId, messages) {
    const map = allChatsMap();
    map[challengeId] = messages;
    write(KEYS.chats, map);
  }
  function pushChat(challengeId, message) {
    const msgs = getChat(challengeId);
    msgs.push(message);
    setChat(challengeId, msgs);
    return msgs;
  }

  // ---------- Settings ----------
  const DEFAULT_SETTINGS = { theme: "dark", language: "en", notifications: true };
  function getSettings() { return { ...DEFAULT_SETTINGS, ...read(KEYS.settings, {}) }; }
  function setSettings(patch) {
    const next = { ...getSettings(), ...patch };
    write(KEYS.settings, next);
    return next;
  }

  // ---------- Profile ----------
  const DEFAULT_PROFILE = { name: "Builder", currentEarn: 0, pastEarn: 0, longestStreak: 0 };
  function getProfile() { return { ...DEFAULT_PROFILE, ...read(KEYS.profile, {}) }; }
  function setProfile(patch) {
    const next = { ...getProfile(), ...patch };
    write(KEYS.profile, next);
    return next;
  }

  // ---------- Notifications ----------
  function getNotifications() { return read(KEYS.notifications, []); }
  function addNotification(n) {
    const list = getNotifications();
    list.unshift({ id: Utils.uid("ntf"), ts: Date.now(), read: false, ...n });
    write(KEYS.notifications, list.slice(0, 60));
  }
  function markAllRead() {
    const list = getNotifications().map(n => ({ ...n, read: true }));
    write(KEYS.notifications, list);
  }

  // ---------- Bulk export / import / reset ----------
  function exportAll() {
    const dump = {};
    Object.entries(KEYS).forEach(([name, key]) => { dump[name] = read(key, name === "settings" ? DEFAULT_SETTINGS : (name === "profile" ? DEFAULT_PROFILE : (["challenges", "notifications"].includes(name) ? [] : {}))); });
    dump._exportedAt = new Date().toISOString();
    dump._version = 1;
    return dump;
  }

  function importAll(dump) {
    if (!dump || typeof dump !== "object") return false;
    Object.entries(KEYS).forEach(([name, key]) => {
      if (dump[name] !== undefined) write(key, dump[name]);
    });
    return true;
  }

  function resetAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
  }

  return {
    KEYS,
    allChallenges, saveChallenges, getChallenge, upsertChallenge, deleteChallenge,
    getTasks, setTasks,
    getIncome, addIncome,
    getReport, setReport,
    getChat, setChat, pushChat,
    getSettings, setSettings,
    getProfile, setProfile,
    getNotifications, addNotification, markAllRead,
    exportAll, importAll, resetAll
  };
})();
