/* ==========================================================================
   Build Yourself — utils.js
   Small pure helpers shared across modules.
   ========================================================================== */

const Utils = (() => {
  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function todayISO() {
    return dateToISO(new Date());
  }

  function dateToISO(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addDays(iso, n) {
    const d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + n);
    return dateToISO(d);
  }

  function daysBetween(isoStart, isoEnd) {
    const a = new Date(isoStart + "T00:00:00");
    const b = new Date(isoEnd + "T00:00:00");
    return Math.round((b - a) / 86400000);
  }

  // Which day-number (1-indexed) "today" falls on for a challenge, clamped.
  function dayIndexForToday(startISO, totalDays) {
    const diff = daysBetween(startISO, todayISO());
    return Math.min(Math.max(diff + 1, 0), totalDays + 1);
  }

  function formatDate(iso, opts = {}) {
    if (!iso) return "—";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", ...opts });
  }

  function formatMoney(n, currency = "৳") {
    const v = Number(n) || 0;
    return `${currency}${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function clamp(n, min, max) { return Math.min(Math.max(n, min), max); }

  function pct(part, whole) {
    if (!whole) return 0;
    return clamp(Math.round((part / whole) * 100), 0, 100);
  }

  function escapeHTML(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function initials(name = "") {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function qs(sel, root = document) { return root.querySelector(sel); }
  function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function debounce(fn, ms = 250) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  function vibrate(ms = 10) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} }
  }

  return {
    uid, todayISO, dateToISO, addDays, daysBetween, dayIndexForToday,
    formatDate, formatMoney, clamp, pct, escapeHTML, initials,
    el, qs, qsa, debounce, vibrate
  };
})();
