/* ==========================================================================
   Build Yourself — app.js
   Wires router + storage + UI together. Each render_X() function owns one
   view. Keep view HTML thin in index.html; all data-driven markup is built
   here so storage stays the single source of truth.
   ========================================================================== */

(() => {
  const draft = { name: "", description: "", category: "earn", durationId: "7", days: 7, targetEarn: "", startDate: Utils.todayISO() };

  // ---------------- Bootstrapping ----------------
  function injectIcons() {
    Utils.qsa("[data-icon]").forEach(span => {
      const name = span.dataset.icon;
      if (UI.Icon[name]) span.innerHTML = UI.Icon[name];
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);
    const meta = Utils.qs('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#0A0B10" : "#F6F5F9";
  }

  function init() {
    const settings = Storage.getSettings();
    applyTheme(settings.theme);
    injectIcons();
    UI.attachRipple(document);
    wireGlobalNav();
    wireCreateForm();
    wireSettings();
    wirePWAInstall();

    if (!location.hash) {
      location.hash = Challenge.all().length ? "/home" : "/welcome";
    }

    Router.register({
      welcome: renderWelcome,
      home: renderHome,
      create: renderCreate,
      plan: renderPlan,
      challenge: renderChallengeDashboard,
      report: renderReport,
      chat: renderChat,
      history: renderHistory,
      search: renderSearch,
      profile: renderProfile,
      settings: renderSettings
    });
    Router.init();

    setTimeout(() => Utils.qs("#splash")?.classList.add("is-hidden"), 500);
    registerServiceWorker();
  }

  // ---------------- Global nav ----------------
  function wireGlobalNav() {
    Utils.qs("#btn-welcome-start")?.addEventListener("click", () => Router.navigate("/create"));
    Utils.qs("#fab-create")?.addEventListener("click", () => { Utils.vibrate(); Router.navigate("/create"); });

    Utils.qsa(".tabbar__item").forEach(btn => {
      btn.addEventListener("click", () => Router.navigate(btn.dataset.route));
    });

    Utils.qs("#btn-create-back")?.addEventListener("click", () => Router.back("/home"));
    Utils.qs("#btn-plan-back")?.addEventListener("click", () => Router.back("/home"));
    Utils.qs("#btn-challenge-back")?.addEventListener("click", () => Router.back("/home"));
    Utils.qs("#btn-report-back")?.addEventListener("click", () => Router.back("/home"));
    Utils.qs("#btn-chat-back")?.addEventListener("click", () => Router.back("/home"));
    Utils.qs("#btn-settings-back")?.addEventListener("click", () => Router.back("/profile"));
    Utils.qs("#btn-see-history")?.addEventListener("click", () => Router.navigate("/history"));
    Utils.qs("#btn-open-settings")?.addEventListener("click", () => Router.navigate("/settings"));
    Utils.qs("#btn-profile-settings")?.addEventListener("click", () => Router.navigate("/settings"));

    Utils.qs("#btn-notifications")?.addEventListener("click", showNotificationsSheet);
    Utils.qs("#btn-edit-profile")?.addEventListener("click", showEditProfileSheet);
  }

  function showNotificationsSheet() {
    const list = Storage.getNotifications();
    Storage.markAllRead();
    const items = list.length
      ? list.map(n => `
        <div class="list-row" style="cursor:default;">
          <div class="list-row__icon">${UI.Icon.bell}</div>
          <div style="flex:1;">
            <div class="day-card__title" style="font-size:var(--fs-sm);">${Utils.escapeHTML(n.text)}</div>
            <div class="day-card__desc">${new Date(n.ts).toLocaleString()}</div>
          </div>
        </div>`).join("")
      : `<div class="empty-state">${UI.Icon.bell}<p><strong>All quiet</strong>Nothing new yet — reminders and milestones will show up here.</p></div>`;
    UI.openSheet(`
      <div class="sheet__title">Notifications</div>
      <div class="list-group" style="margin-bottom:8px;">${items}</div>
    `);
  }

  function showEditProfileSheet() {
    const profile = Storage.getProfile();
    UI.openSheet(`
      <div class="sheet__title">Edit Profile</div>
      <div class="field"><label for="edit-name">Your name</label><input class="input" id="edit-name" value="${Utils.escapeHTML(profile.name)}" maxlength="30"></div>
      <button class="btn btn-primary" id="save-profile-name">Save</button>
    `);
    Utils.qs("#save-profile-name").addEventListener("click", () => {
      const name = Utils.qs("#edit-name").value.trim() || "Builder";
      Storage.setProfile({ name });
      UI.closeSheet();
      UI.toast("Profile updated", "success");
      renderProfile();
    });
  }

  // ======================================================================
  // WELCOME
  // ======================================================================
  function renderWelcome() {
    // If challenges already exist, skip welcome straight to home next time router hits root without hash handling — handled by hash default, no-op here.
  }

  // ======================================================================
  // HOME
  // ======================================================================
  function renderHome() {
    Utils.qs("#home-date").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    const totals = Income.totals();
    const running = Challenge.byStatus("running");
    const success = Challenge.byStatus("success");
    const failed = Challenge.byStatus("failed");
    const rate = (success.length + failed.length) ? Utils.pct(success.length, success.length + failed.length) : 0;

    Utils.qs("#home-stats").innerHTML = `
      ${statTile("Current Earn", Utils.formatMoney(totals.current), "violet")}
      ${statTile("Past Earn", Utils.formatMoney(totals.past), "amber")}
      ${statTile("Running", running.length, "violet")}
      ${statTile("Completion", rate + "%", "success")}
    `;

    const currentBox = Utils.qs("#home-current");
    if (!running.length) {
      currentBox.innerHTML = emptyState("flame", "No active challenge", "Start one to begin your streak.");
    } else {
      currentBox.innerHTML = running.map(challengeCardHTML).join("");
    }

    Utils.qs("#home-activity").innerHTML = recentActivityHTML();

    const finished = [...success, ...failed].sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0)).slice(0, 3);
    Utils.qs("#home-finished").innerHTML = finished.length
      ? finished.map(challengeCardHTML).join("")
      : emptyState("trophy", "Nothing finished yet", "Completed and failed challenges will land here.");

    bindChallengeCardClicks(Utils.qs("#view-home"));
  }

  function statTile(label, val, accent) {
    return `<div class="card stat-tile accent-${accent}"><div class="val mono">${val}</div><div class="lbl">${label}</div></div>`;
  }

  function emptyState(icon, title, sub) {
    return `<div class="empty-state">${UI.Icon[icon] || ""}<p><strong>${title}</strong>${sub}</p></div>`;
  }

  function recentActivityHTML() {
    const all = Challenge.all();
    const events = [];
    all.forEach(c => {
      Storage.getTasks(c.id).forEach(t => {
        if (t.status !== "pending") events.push({ ts: new Date(t.doneDate || 0).getTime(), text: `${t.status === "done" ? "Completed" : "Missed"} Day ${t.day} of "${c.name}"`, status: t.status });
      });
    });
    events.sort((a, b) => b.ts - a.ts);
    if (!events.length) return emptyState("chart", "No activity yet", "Complete a day to see it here.");
    return events.slice(0, 5).map(e => `
      <div class="card" style="display:flex; align-items:center; gap:12px; padding:14px 16px; margin-bottom:8px;">
        <div class="day-card__num ${e.status === "done" ? "" : ""}" style="width:34px;height:34px;background:${e.status === "done" ? "var(--success-soft)" : "var(--danger-soft)"};color:${e.status === "done" ? "var(--success)" : "var(--danger)"};">
          ${e.status === "done" ? UI.Icon.check : UI.Icon.x}
        </div>
        <div style="font-size:var(--fs-sm); font-weight:550;">${Utils.escapeHTML(e.text)}</div>
      </div>
    `).join("");
  }

  function challengeCardHTML(c) {
    const s = Challenge.stats(c.id);
    const cat = Challenge.categoryMeta(c.category);
    const badge = c.status === "running" ? `<span class="badge badge-running">Running</span>`
      : c.status === "success" ? `<span class="badge badge-success">Success</span>`
      : `<span class="badge badge-failed">Failed</span>`;
    return `
      <div class="card challenge-card" data-open-challenge="${c.id}" style="margin-bottom:12px;">
        <div class="challenge-card__top">
          <div>
            <div class="challenge-card__name">${Utils.escapeHTML(c.name)}</div>
            <div class="challenge-card__desc">${Utils.escapeHTML(c.description || "No description yet.")}</div>
          </div>
          ${badge}
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${s.progressPct}%;"></div></div>
        <div class="challenge-card__meta">
          <span>${UI.Icon.calendar}${s.daysLeft} days left</span>
          <span>${UI.Icon.money}${Utils.formatMoney(c.currentEarn)}</span>
          <span class="badge badge-category">${cat.label}</span>
        </div>
      </div>
    `;
  }

  function bindChallengeCardClicks(root) {
    Utils.qsa("[data-open-challenge]", root).forEach(card => {
      card.addEventListener("click", () => Router.navigate("/challenge", { id: card.dataset.openChallenge }));
    });
  }

  // ======================================================================
  // CREATE CHALLENGE (step 1)
  // ======================================================================
  function wireCreateForm() {
    Utils.qs("#category-chips").innerHTML = Challenge.CATEGORIES.map(c =>
      `<div class="chip ${c.id === draft.category ? "is-selected" : ""}" data-cat="${c.id}">${UI.Icon[c.icon] || ""}${c.label}</div>`
    ).join("");
    Utils.qs("#duration-chips").innerHTML = Challenge.DURATIONS.map(d =>
      `<div class="chip ${d.id === draft.durationId ? "is-selected" : ""}" data-dur="${d.id}">${d.label}</div>`
    ).join("");

    Utils.qs("#category-chips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-cat]"); if (!chip) return;
      draft.category = chip.dataset.cat;
      Utils.qsa("[data-cat]").forEach(c => c.classList.toggle("is-selected", c === chip));
    });

    Utils.qs("#duration-chips").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-dur]"); if (!chip) return;
      draft.durationId = chip.dataset.dur;
      Utils.qsa("[data-dur]").forEach(c => c.classList.toggle("is-selected", c === chip));
      const meta = Challenge.DURATIONS.find(d => d.id === draft.durationId);
      Utils.qs("#custom-days-row").style.display = meta.days ? "none" : "block";
      draft.days = meta.days || Number(Utils.qs("#in-custom-days").value) || 7;
      recalcEndDate();
    });

    Utils.qs("#in-custom-days").addEventListener("input", (e) => {
      draft.days = Utils.clamp(Number(e.target.value) || 1, 1, 365);
      recalcEndDate();
    });

    Utils.qs("#in-start").value = draft.startDate;
    Utils.qs("#in-start").addEventListener("change", (e) => { draft.startDate = e.target.value || Utils.todayISO(); recalcEndDate(); });
    recalcEndDate();

    Utils.qs("#form-create").addEventListener("submit", (e) => {
      e.preventDefault();
      draft.name = Utils.qs("#in-name").value.trim();
      draft.description = Utils.qs("#in-desc").value.trim();
      draft.targetEarn = Utils.qs("#in-target").value;
      if (!draft.name) { UI.toast("Give your challenge a name.", "error"); return; }
      if (!draft.days || draft.days < 1) { UI.toast("Pick a valid duration.", "error"); return; }

      const challenge = Challenge.create({
        name: draft.name, description: draft.description, category: draft.category,
        days: draft.days, targetEarn: draft.targetEarn, startDate: draft.startDate
      });
      const skeleton = Task.generatePlanSkeleton(draft.days);
      Task.savePlan(challenge.id, skeleton);
      Router.navigate("/plan", { id: challenge.id });
    });
  }

  function recalcEndDate() {
    Utils.qs("#in-end").value = Utils.addDays(draft.startDate, (draft.days || 7) - 1);
  }

  function renderCreate() {
    Utils.qs("#form-create").reset();
    draft.name = ""; draft.description = ""; draft.targetEarn = "";
    draft.category = "earn"; draft.durationId = "7"; draft.days = 7;
    Utils.qs("#in-start").value = draft.startDate = Utils.todayISO();
    Utils.qs("#in-custom-days").value = "";
    Utils.qs("#custom-days-row").style.display = "none";
    Utils.qsa("[data-cat]").forEach(c => c.classList.toggle("is-selected", c.dataset.cat === draft.category));
    Utils.qsa("[data-dur]").forEach(c => c.classList.toggle("is-selected", c.dataset.dur === draft.durationId));
    recalcEndDate();
  }

  // ======================================================================
  // DAILY PLANNING (step 2)
  // ======================================================================
  function renderPlan(params) {
    const challenge = Storage.getChallenge(params.id);
    if (!challenge) { Router.navigate("/home"); return; }
    const tasks = Task.getPlan(challenge.id);
    Utils.qs("#plan-days").innerHTML = tasks.map(t => `
      <div class="card" style="margin-bottom:12px;">
        <div class="section-title" style="margin:0 0 10px;">Day ${t.day}</div>
        <div class="field" style="margin-bottom:10px;">
          <input class="input" data-plan-title="${t.day}" placeholder="Task title" value="${Utils.escapeHTML(t.title)}" maxlength="70">
        </div>
        <div class="field" style="margin-bottom:0;">
          <textarea class="textarea" data-plan-desc="${t.day}" placeholder="Description or notes (optional)" style="min-height:60px;">${Utils.escapeHTML(t.description)}</textarea>
        </div>
      </div>
    `).join("");

    const btn = Utils.qs("#btn-save-plan");
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    newBtn.addEventListener("click", () => {
      const updated = tasks.map(t => ({
        ...t,
        title: Utils.qs(`[data-plan-title="${t.day}"]`).value.trim() || `Day ${t.day} task`,
        description: Utils.qs(`[data-plan-desc="${t.day}"]`).value.trim()
      }));
      Task.savePlan(challenge.id, updated);
      Challenge.activate(challenge.id);
      UI.toast("Plan saved — challenge started!", "success");
      Router.navigate("/challenge", { id: challenge.id });
    });
  }

  // ======================================================================
  // CHALLENGE DASHBOARD
  // ======================================================================
  function renderChallengeDashboard(params) {
    const challenge = Storage.getChallenge(params.id);
    if (!challenge) { Router.navigate("/home"); return; }
    const s = Challenge.stats(challenge.id);
    const cat = Challenge.categoryMeta(challenge.category);

    Utils.qs("#challenge-title").innerHTML = `<span class="eyebrow">${cat.label}</span>${Utils.escapeHTML(challenge.name)}`;

    const ringPct = s.progressPct;
    const canFinish = challenge.status === "running";

    Utils.qs("#challenge-body").innerHTML = `
      <div class="card" style="display:flex; gap:20px; align-items:center; margin-bottom:16px;">
        ${UI.ringSVG({ size: 108, stroke: 9, percent: ringPct, centerNum: ringPct + "%", centerLabel: "Mission" })}
        <div style="flex:1;">
          <div class="challenge-card__desc" style="margin-bottom:10px;">${Utils.escapeHTML(challenge.description || "No description.")}</div>
          <div class="challenge-card__meta" style="flex-wrap:wrap; gap:10px;">
            <span>${UI.Icon.calendar}${s.daysLeft} days left</span>
            <span>${UI.Icon.trophy}${s.completed}/${s.total} done</span>
          </div>
        </div>
      </div>

      <div class="stat-grid" style="margin-bottom:16px;">
        ${statTile("Challenge Earn", Utils.formatMoney(s.currentEarn), "amber")}
        ${statTile("Target Earn", challenge.targetEarn ? Utils.formatMoney(challenge.targetEarn) : "—", "violet")}
        ${statTile("Completed", s.completed, "success")}
        ${statTile("Failed", s.failed, "amber")}
      </div>

      ${canFinish ? `
      <div class="btn-block-row" style="margin-bottom:20px;">
        <button class="btn btn-secondary" id="btn-ai-coach">${UI.Icon.sparkle} Ask AI Coach</button>
      </div>` : `
      <div class="btn-block-row" style="margin-bottom:20px;">
        <button class="btn btn-secondary" id="btn-view-report-inline">${UI.Icon.doc} View Report</button>
      </div>`}

      <div class="section-title">Daily Tasks</div>
      <div id="day-cards"></div>

      ${canFinish ? `
      <div class="divider"></div>
      <div class="btn-block-row">
        <button class="btn btn-success" id="btn-finish-success">${UI.Icon.trophy} Project Success</button>
        <button class="btn btn-danger" id="btn-finish-failed">${UI.Icon.x} Project Failed</button>
      </div>` : ""}
    `;

    renderDayCards(challenge, s.tasks);

    Utils.qs("#btn-challenge-report").onclick = () => Router.navigate("/report", { id: challenge.id });
    Utils.qs("#btn-challenge-delete").onclick = () => confirmDeleteChallenge(challenge);
    Utils.qs("#btn-ai-coach")?.addEventListener("click", () => Router.navigate("/chat", { id: challenge.id }));
    Utils.qs("#btn-view-report-inline")?.addEventListener("click", () => Router.navigate("/report", { id: challenge.id }));
    Utils.qs("#btn-finish-success")?.addEventListener("click", () => confirmFinish(challenge, "success"));
    Utils.qs("#btn-finish-failed")?.addEventListener("click", () => confirmFinish(challenge, "failed"));
  }

  function renderDayCards(challenge, tasks) {
    const box = Utils.qs("#day-cards");
    box.innerHTML = tasks.map(t => {
      const state = Task.dayState(challenge, t);
      const cls = state === "done" ? "is-done" : state === "failed" ? "is-failed" : state === "today" ? "is-today" : "is-locked";
      const statusIcon = state === "done" ? UI.Icon.check : state === "failed" ? UI.Icon.x : state === "locked" ? UI.Icon.lock : "";
      const actions = state === "today"
        ? `<button class="btn btn-success btn-sm" data-day-done="${t.day}">Done</button><button class="btn btn-danger btn-sm" data-day-fail="${t.day}">Failed</button>`
        : "";
      return `
        <div class="card day-card ${cls}" style="margin-bottom:10px;">
          <div class="day-card__num">${t.day}</div>
          <div class="day-card__body">
            <div class="day-card__title">${Utils.escapeHTML(t.title || `Day ${t.day}`)}</div>
            <div class="day-card__desc">${Utils.escapeHTML(t.description || "No description")}</div>
          </div>
          ${actions || `<span class="day-card__icon-status">${statusIcon}</span>`}
        </div>
      `;
    }).join("");

    box.querySelectorAll("[data-day-done]").forEach(b => b.addEventListener("click", () => openIncomeModal(challenge, Number(b.dataset.dayDone))));
    box.querySelectorAll("[data-day-fail]").forEach(b => b.addEventListener("click", () => confirmFailDay(challenge, Number(b.dataset.dayFail))));
  }

  function openIncomeModal(challenge, day) {
    UI.openSheet(`
      <div class="sheet__title">Day ${day} — Mark Done</div>
      <div class="field"><label for="inc-amount">Today's income <span style="color:var(--text-tertiary); font-weight:400;">(optional)</span></label><input class="input" id="inc-amount" type="number" min="0" placeholder="0"></div>
      <div class="field"><label>Income source</label><div class="chip-row" id="inc-sources">${Income.SOURCES.map(s => `<div class="chip" data-src="${s}">${s}</div>`).join("")}</div></div>
      <div class="field"><label for="inc-note">Note <span style="color:var(--text-tertiary); font-weight:400;">(optional)</span></label><textarea class="textarea" id="inc-note" placeholder="Anything worth remembering about today?"></textarea></div>
      <button class="btn btn-success" id="submit-income">${UI.Icon.check} Submit</button>
    `);
    let selectedSource = "";
    Utils.qs("#inc-sources").addEventListener("click", (e) => {
      const chip = e.target.closest("[data-src]"); if (!chip) return;
      selectedSource = chip.dataset.src;
      Utils.qsa("[data-src]").forEach(c => c.classList.toggle("is-selected", c === chip));
    });
    Utils.qs("#submit-income").addEventListener("click", () => {
      const amount = Utils.qs("#inc-amount").value;
      const note = Utils.qs("#inc-note").value.trim();
      const res = Task.markDone(challenge.id, day, { income: amount, source: selectedSource, note });
      if (!res.ok) { UI.toast(res.reason, "error"); return; }
      UI.closeSheet();
      UI.toast(`Day ${day} completed`, "success");
      Utils.vibrate(15);
      renderChallengeDashboard({ id: challenge.id });
    });
  }

  function confirmFailDay(challenge, day) {
    UI.openSheet(`
      <div class="sheet__title">Mark Day ${day} as Failed?</div>
      <p style="color:var(--text-secondary); font-size:var(--fs-sm); margin-bottom:16px;">This can't be undone once submitted — past days are locked after recording.</p>
      <div class="field"><label for="fail-note">Note <span style="color:var(--text-tertiary); font-weight:400;">(optional)</span></label><textarea class="textarea" id="fail-note" placeholder="What got in the way?"></textarea></div>
      <div class="btn-block-row">
        <button class="btn btn-secondary" id="cancel-fail">Cancel</button>
        <button class="btn btn-danger" id="confirm-fail">Confirm Failed</button>
      </div>
    `);
    Utils.qs("#cancel-fail").addEventListener("click", UI.closeSheet);
    Utils.qs("#confirm-fail").addEventListener("click", () => {
      const note = Utils.qs("#fail-note").value.trim();
      const res = Task.markFailed(challenge.id, day, note);
      if (!res.ok) { UI.toast(res.reason, "error"); return; }
      UI.closeSheet();
      UI.toast(`Day ${day} marked failed`, "info");
      renderChallengeDashboard({ id: challenge.id });
    });
  }

  function confirmFinish(challenge, outcome) {
    const label = outcome === "success" ? "Mark as Success" : "Mark as Failed";
    UI.openSheet(`
      <div class="sheet__title">${label}?</div>
      <p style="color:var(--text-secondary); font-size:var(--fs-sm); margin-bottom:16px;">
        Earnings of ${Utils.formatMoney(challenge.currentEarn)} will move to your Past Earn, and this challenge will be locked into your History.
      </p>
      <div class="btn-block-row">
        <button class="btn btn-secondary" id="cancel-finish">Cancel</button>
        <button class="btn ${outcome === "success" ? "btn-success" : "btn-danger"}" id="confirm-finish">Confirm</button>
      </div>
    `);
    Utils.qs("#cancel-finish").addEventListener("click", UI.closeSheet);
    Utils.qs("#confirm-finish").addEventListener("click", () => {
      Challenge.finish(challenge.id, outcome);
      UI.closeSheet();
      UI.toast(outcome === "success" ? "Challenge completed!" : "Challenge closed out.", outcome === "success" ? "success" : "info");
      Router.navigate("/report", { id: challenge.id });
    });
  }

  function confirmDeleteChallenge(challenge) {
    UI.openSheet(`
      <div class="sheet__title">Delete "${Utils.escapeHTML(challenge.name)}"?</div>
      <p style="color:var(--text-secondary); font-size:var(--fs-sm); margin-bottom:16px;">This permanently removes its plan, income records, and reports.</p>
      <div class="btn-block-row">
        <button class="btn btn-secondary" id="cancel-del">Cancel</button>
        <button class="btn btn-danger" id="confirm-del">Delete</button>
      </div>
    `);
    Utils.qs("#cancel-del").addEventListener("click", UI.closeSheet);
    Utils.qs("#confirm-del").addEventListener("click", () => {
      Challenge.remove(challenge.id);
      UI.closeSheet();
      UI.toast("Challenge deleted", "info");
      Router.navigate("/home");
    });
  }

  // ======================================================================
  // REPORT
  // ======================================================================
  function renderReport(params) {
    const report = Report.build(params.id);
    if (!report) { Router.navigate("/home"); return; }
    const c = report.challenge;
    const cat = Challenge.categoryMeta(c.category);

    const timelineItems = report.tasks.filter(t => t.status !== "pending").map(t => `
      <div class="timeline-item ${t.status === "done" ? "is-success" : "is-failed"}">
        <div class="t-day">Day ${t.day} · ${t.status}</div>
        <div class="t-title">${Utils.escapeHTML(t.title || "—")}</div>
        ${t.note ? `<div class="t-note">${Utils.escapeHTML(t.note)}</div>` : ""}
      </div>
    `).join("") || `<p style="color:var(--text-tertiary); font-size:var(--fs-sm);">No days recorded yet.</p>`;

    const incomeItems = report.income.length ? report.income.map(e => `
      <div class="timeline-item is-success">
        <div class="t-day">Day ${e.day} · ${e.source}</div>
        <div class="t-title">${Utils.formatMoney(e.amount)}</div>
        ${e.note ? `<div class="t-note">${Utils.escapeHTML(e.note)}</div>` : ""}
      </div>
    `).join("") : `<p style="color:var(--text-tertiary); font-size:var(--fs-sm);">No income recorded.</p>`;

    Utils.qs("#report-body").innerHTML = `
      <div class="card" style="margin-bottom:16px;">
        <div class="challenge-card__top">
          <div>
            <div class="challenge-card__name">${Utils.escapeHTML(c.name)}</div>
            <div class="challenge-card__meta" style="margin-top:6px;">
              <span class="badge badge-category">${cat.label}</span>
              <span>${UI.Icon.calendar}${Utils.formatDate(c.startDate)} – ${Utils.formatDate(c.endDate)}</span>
            </div>
          </div>
          <span class="badge badge-${c.status === "success" ? "success" : c.status === "failed" ? "failed" : "running"}">${c.status}</span>
        </div>
      </div>

      <div class="card glass" style="margin-bottom:16px; padding:18px;">
        <div class="section-title" style="margin:0 0 8px;">${UI.Icon.sparkle} AI Summary</div>
        <p style="font-size:var(--fs-sm); line-height:var(--lh-normal); color:var(--text-secondary);">${Utils.escapeHTML(report.aiSummary)}</p>
      </div>

      <div class="stat-grid" style="margin-bottom:20px;">
        ${statTile("Mission Score", report.missionScore + "%", "violet")}
        ${statTile("Total Earn", Utils.formatMoney(c.currentEarn), "amber")}
        ${statTile("Completed", report.completed, "success")}
        ${statTile("Failed", report.failed, "amber")}
      </div>

      <div class="pill-tabs" id="report-tabs">
        <button class="is-active" data-tab="timeline">Daily Tasks</button>
        <button data-tab="income">Income Timeline</button>
        <button data-tab="lessons">Lessons Learned</button>
      </div>

      <div id="report-tab-timeline" class="timeline">${timelineItems}</div>
      <div id="report-tab-income" class="timeline" style="display:none;">${incomeItems}</div>
      <div id="report-tab-lessons" style="display:none;">
        <ul style="padding-left:18px; display:flex; flex-direction:column; gap:10px;">
          ${report.lessons.map(l => `<li style="font-size:var(--fs-sm); color:var(--text-secondary); line-height:var(--lh-normal);">${Utils.escapeHTML(l)}</li>`).join("")}
        </ul>
      </div>

      <div class="divider"></div>
      <div class="section-title" style="margin-top:0;">Export</div>
      <div class="btn-block-row" style="margin-bottom:10px;">
        <button class="btn btn-secondary" id="export-pdf">${UI.Icon.doc} PDF</button>
        <button class="btn btn-secondary" id="export-md">${UI.Icon.doc} Markdown</button>
        <button class="btn btn-secondary" id="export-json">${UI.Icon.doc} JSON</button>
      </div>
    `;

    Utils.qs("#report-tabs").addEventListener("click", (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      Utils.qsa("#report-tabs button").forEach(b => b.classList.toggle("is-active", b === btn));
      ["timeline", "income", "lessons"].forEach(k => {
        Utils.qs(`#report-tab-${k}`).style.display = k === btn.dataset.tab ? "" : "none";
      });
    });

    Utils.qs("#export-pdf").addEventListener("click", () => Report.exportPDF(report));
    Utils.qs("#export-md").addEventListener("click", () => { Report.exportMarkdown(report); UI.toast("Markdown exported", "success"); });
    Utils.qs("#export-json").addEventListener("click", () => { Report.exportJSON(report); UI.toast("JSON exported", "success"); });
  }

  // ======================================================================
  // AI CHAT
  // ======================================================================
  function renderChat(params) {
    const challenge = Storage.getChallenge(params.id);
    if (!challenge) { Router.navigate("/home"); return; }
    Utils.qs("#chat-title").innerHTML = `<span class="eyebrow">AI Coach · isolated memory</span>${Utils.escapeHTML(challenge.name)}`;
    Chat.seedIfEmpty(challenge.id);
    paintChatHistory(challenge.id);

    Utils.qs("#chat-suggestions").innerHTML = Chat.SUGGESTIONS.map(q => `<div class="suggest-chip" data-q="${Utils.escapeHTML(q)}">${q}</div>`).join("");
    Utils.qs("#chat-suggestions").onclick = (e) => {
      const chip = e.target.closest("[data-q]"); if (!chip) return;
      sendChatMessage(challenge.id, chip.dataset.q);
    };

    const input = Utils.qs("#chat-input");
    const sendBtn = Utils.qs("#chat-send");
    input.oninput = () => { sendBtn.disabled = !input.value.trim(); };
    sendBtn.disabled = true;
    sendBtn.onclick = () => { if (input.value.trim()) sendChatMessage(challenge.id, input.value.trim()); };
    input.onkeydown = (e) => { if (e.key === "Enter" && input.value.trim()) sendChatMessage(challenge.id, input.value.trim()); };
  }

  function paintChatHistory(challengeId) {
    const msgs = Chat.history(challengeId);
    Utils.qs("#chat-window").innerHTML = msgs.map(m => `<div class="msg ${m.role === "ai" ? "msg-ai" : "msg-user"}">${Utils.escapeHTML(m.text)}</div>`).join("");
    Utils.qs("#view-chat").scrollTop = Utils.qs("#view-chat").scrollHeight;
  }

  function sendChatMessage(challengeId, text) {
    Storage.pushChat(challengeId, { role: "user", text, ts: Date.now() });
    paintChatHistory(challengeId);
    Utils.qs("#chat-input").value = "";
    Utils.qs("#chat-send").disabled = true;
    const typing = Utils.qs("#chat-typing");
    typing.style.display = "block";
    Utils.qs("#chat-window").appendChild(typing);
    setTimeout(() => {
      typing.style.display = "none";
      computeReply(challengeId, text);
      paintChatHistory(challengeId);
    }, 650 + Math.random() * 500);
  }

  // Chat module keeps respond() private; re-derive via its send() but we already pushed
  // the user message above for animation control, so call the internal logic directly.
  function computeReply(challengeId, text) {
    // Fallback path: Chat.send() both pushes user + ai; since we already pushed user,
    // pop it back off before delegating to avoid duplication.
    const msgs = Storage.getChat(challengeId);
    msgs.pop();
    Storage.setChat(challengeId, msgs);
    const updated = Chat.send(challengeId, text);
    return updated[updated.length - 1].text;
  }

  // ======================================================================
  // HISTORY
  // ======================================================================
  let historyFilter = "all";
  function renderHistory() {
    Utils.qs("#history-filter").onclick = (e) => {
      const btn = e.target.closest("button"); if (!btn) return;
      historyFilter = btn.dataset.f;
      Utils.qsa("#history-filter button").forEach(b => b.classList.toggle("is-active", b === btn));
      paintHistoryList();
    };
    paintHistoryList();
  }

  function paintHistoryList() {
    let list = [...Challenge.byStatus("success"), ...Challenge.byStatus("failed")];
    if (historyFilter !== "all") list = list.filter(c => c.status === historyFilter);
    list.sort((a, b) => (b.finishedAt || 0) - (a.finishedAt || 0));
    const box = Utils.qs("#history-list");
    box.innerHTML = list.length ? list.map(historyCardHTML).join("") : emptyState("history", "No history yet", "Finished challenges will be archived here.");
    box.querySelectorAll("[data-view-report]").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation();
      Router.navigate("/report", { id: b.dataset.viewReport });
    }));
    bindChallengeCardClicks(box);
  }

  function historyCardHTML(c) {
    const cat = Challenge.categoryMeta(c.category);
    return `
      <div class="card" style="margin-bottom:12px; cursor:pointer;" data-open-challenge="${c.id}">
        <div class="challenge-card__top">
          <div>
            <div class="challenge-card__name">${Utils.escapeHTML(c.name)}</div>
            <div class="challenge-card__meta" style="margin-top:6px;">
              <span class="badge badge-category">${cat.label}</span>
              <span>${UI.Icon.calendar}${c.days} days</span>
              <span>${UI.Icon.money}${Utils.formatMoney(c.currentEarn)}</span>
            </div>
          </div>
          <span class="badge badge-${c.status === "success" ? "success" : "failed"}">${c.status}</span>
        </div>
        <div class="challenge-card__meta">
          <span>Finished ${c.finishedAt ? Utils.formatDate(Utils.dateToISO(new Date(c.finishedAt))) : "—"}</span>
        </div>
        <button class="btn btn-secondary btn-sm" data-view-report="${c.id}" style="width:auto; margin-top:4px;">${UI.Icon.doc} View Report</button>
      </div>
    `;
  }

  // ======================================================================
  // SEARCH
  // ======================================================================
  let searchFilter = "all";
  function renderSearch() {
    const input = Utils.qs("#search-input");
    input.value = "";
    Utils.qs("#search-filters").onclick = (e) => {
      const chip = e.target.closest("[data-sf]"); if (!chip) return;
      searchFilter = chip.dataset.sf;
      Utils.qsa("[data-sf]").forEach(c => c.classList.toggle("is-selected", c === chip));
      paintSearch(input.value);
    };
    input.oninput = Utils.debounce(() => paintSearch(input.value), 150);
    paintSearch("");
  }

  function paintSearch(query) {
    const q = query.trim().toLowerCase();
    let list = Challenge.all();
    if (searchFilter !== "all") list = list.filter(c => c.status === searchFilter);
    if (q) {
      list = list.filter(c => {
        const inName = c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q);
        const inIncome = Income.forChallenge(c.id).some(e => (e.source || "").toLowerCase().includes(q) || (e.note || "").toLowerCase().includes(q));
        return inName || inIncome;
      });
    }
    const box = Utils.qs("#search-results");
    box.innerHTML = list.length ? list.map(challengeCardHTML).join("") : emptyState("search", "No matches", "Try a different keyword or filter.");
    bindChallengeCardClicks(box);
  }

  // ======================================================================
  // PROFILE
  // ======================================================================
  function renderProfile() {
    const profile = Storage.getProfile();
    const totals = Income.totals();
    const all = Challenge.all();
    const success = Challenge.byStatus("success");
    const failed = Challenge.byStatus("failed");
    const running = Challenge.byStatus("running");
    const rate = (success.length + failed.length) ? Utils.pct(success.length, success.length + failed.length) : 0;

    Utils.qs("#profile-avatar").textContent = Utils.initials(profile.name);
    Utils.qs("#profile-name").textContent = profile.name;
    Utils.qs("#profile-since").textContent = all.length ? `${all.length} challenge${all.length === 1 ? "" : "s"} started` : "No challenges yet";

    Utils.qs("#profile-stats").innerHTML = `
      ${statTile("Current Earn", Utils.formatMoney(totals.current), "violet")}
      ${statTile("Past Earn", Utils.formatMoney(totals.past), "amber")}
      ${statTile("Total Earn", Utils.formatMoney(totals.total), "success")}
      ${statTile("Completed", success.length, "success")}
      ${statTile("Failed", failed.length, "amber")}
      ${statTile("Running", running.length, "violet")}
      ${statTile("Completion Rate", rate + "%", "violet")}
    `;

    const best = success.slice().sort((a, b) => (b.currentEarn || 0) - (a.currentEarn || 0))[0];
    Utils.qs("#profile-best").innerHTML = best
      ? challengeCardHTML(best)
      : emptyState("trophy", "No wins yet", "Complete a challenge to see your best one here.");
    bindChallengeCardClicks(Utils.qs("#view-profile"));
  }

  // ======================================================================
  // SETTINGS
  // ======================================================================
  function wireSettings() {
    Utils.qs("#toggle-theme").addEventListener("change", (e) => {
      const theme = e.target.checked ? "light" : "dark";
      Storage.setSettings({ theme });
      applyTheme(theme);
    });
    Utils.qs("#toggle-notif").addEventListener("change", (e) => {
      Storage.setSettings({ notifications: e.target.checked });
      UI.toast(e.target.checked ? "Reminders on" : "Reminders off", "info");
    });
    Utils.qs("#row-language").addEventListener("click", () => {
      UI.toast("More languages are coming soon.", "info");
    });
    Utils.qs("#row-export").addEventListener("click", () => {
      const data = JSON.stringify(Storage.exportAll(), null, 2);
      const blob = new Blob([data], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "build-yourself-backup.json"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      UI.toast("Backup exported", "success");
    });
    Utils.qs("#row-restore").addEventListener("click", () => Utils.qs("#file-restore").click());
    Utils.qs("#file-restore").addEventListener("change", (e) => {
      const file = e.target.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const dump = JSON.parse(reader.result);
          Storage.importAll(dump);
          UI.toast("Backup restored", "success");
          renderHome();
        } catch (err) { UI.toast("That file couldn't be read.", "error"); }
      };
      reader.readAsText(file);
    });
    Utils.qs("#row-install").addEventListener("click", triggerInstallPrompt);
    Utils.qs("#row-delete-data").addEventListener("click", () => confirmDanger("Delete all data?", "This removes every challenge, report, and setting. This cannot be undone.", () => {
      Storage.resetAll();
      UI.toast("All data deleted", "info");
      Router.navigate("/welcome");
    }));
    Utils.qs("#row-reset-app").addEventListener("click", () => confirmDanger("Reset app?", "This restores Build Yourself to its first-run state.", () => {
      Storage.resetAll();
      location.hash = "/welcome";
      location.reload();
    }));
  }

  function confirmDanger(title, body, onConfirm) {
    UI.openSheet(`
      <div class="sheet__title">${title}</div>
      <p style="color:var(--text-secondary); font-size:var(--fs-sm); margin-bottom:16px;">${body}</p>
      <div class="btn-block-row">
        <button class="btn btn-secondary" id="cancel-danger">Cancel</button>
        <button class="btn btn-danger" id="confirm-danger">Confirm</button>
      </div>
    `);
    Utils.qs("#cancel-danger").addEventListener("click", UI.closeSheet);
    Utils.qs("#confirm-danger").addEventListener("click", () => { UI.closeSheet(); onConfirm(); });
  }

  function renderSettings() {
    const settings = Storage.getSettings();
    Utils.qs("#toggle-theme").checked = settings.theme === "light";
    Utils.qs("#toggle-notif").checked = !!settings.notifications;
  }

  // ---------------- PWA install ----------------
  let deferredInstallPrompt = null;
  function wirePWAInstall() {
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
    });
  }
  function triggerInstallPrompt() {
    if (!deferredInstallPrompt) { UI.toast("Use your browser's 'Add to Home Screen' option to install.", "info"); return; }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
