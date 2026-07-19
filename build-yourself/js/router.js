/* ==========================================================================
   Build Yourself — router.js
   Minimal in-app router: swaps .view sections, keeps a back-stack, and
   syncs the bottom tab bar. Uses location.hash so the browser/PWA back
   gesture and history work naturally.
   ========================================================================== */

const Router = (() => {
  let routes = {};
  let currentRoute = null;
  let onChangeCb = null;

  function register(routeMap) { routes = routeMap; }
  function onChange(cb) { onChangeCb = cb; }

  function parse() {
    const hash = location.hash.slice(1) || "/welcome";
    const [path, query] = hash.split("?");
    const params = {};
    if (query) query.split("&").forEach(kv => {
      const [k, v] = kv.split("=");
      params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    });
    return { path, params };
  }

  function navigate(path, params = {}) {
    const qs = Object.keys(params).length
      ? "?" + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")
      : "";
    location.hash = path + qs;
  }

  function back(fallback = "/home") {
    if (history.length > 1) history.back();
    else navigate(fallback);
  }

  function render() {
    const { path, params } = parse();
    currentRoute = path;
    Utils.qsa(".view").forEach(v => v.classList.remove("is-active"));
    const key = path.split("/")[1] || "welcome";
    const view = document.getElementById(`view-${key}`);
    if (view) view.classList.add("is-active");

    Utils.qsa(".tabbar__item").forEach(t => {
      t.classList.toggle("is-active", t.dataset.route === `/${key}`);
    });

    window.scrollTo(0, 0);
    if (routes[key]) routes[key](params);
    if (onChangeCb) onChangeCb(key, params);
  }

  function init() {
    window.addEventListener("hashchange", render);
    render();
  }

  return { register, onChange, navigate, back, init, get current() { return currentRoute; } };
})();
