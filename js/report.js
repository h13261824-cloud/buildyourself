/* ==========================================================================
   Build Yourself — report.js
   Professional challenge report: timeline, income, AI summary, exports.
   ========================================================================== */

const Report = (() => {
  function build(challengeId) {
    const c = Storage.getChallenge(challengeId);
    if (!c) return null;
    const tasks = Storage.getTasks(challengeId).slice().sort((a, b) => a.day - b.day);
    const income = Income.forChallenge(challengeId);
    const s = Challenge.stats(challengeId);
    const bySource = Income.bySource(challengeId);
    return {
      challenge: c, tasks, income, bySource,
      completed: s.completed, failed: s.failed, total: s.total,
      missionScore: s.missionScore,
      aiSummary: aiSummary(c, tasks, income, s),
      lessons: lessons(c, tasks, income, s)
    };
  }

  function aiSummary(c, tasks, income, s) {
    const outcome = c.status === "success" ? "completed successfully" : c.status === "failed" ? "ended without reaching the goal" : "still in progress";
    const earnLine = c.targetEarn
      ? `earned ${Utils.formatMoney(c.currentEarn)} against a ${Utils.formatMoney(c.targetEarn)} target`
      : `earned ${Utils.formatMoney(c.currentEarn)} along the way`;
    return `"${c.name}" ${outcome} after ${s.total} planned days, with ${s.completed} completed and ${s.failed} missed. `
      + `The plan ${earnLine}, and execution quality landed at ${s.missionScore}% of decided days going to plan. `
      + (s.missionScore >= 80
        ? "That is a strong, consistent run — the habit loop clearly held."
        : s.missionScore >= 50
        ? "That is a workable pace, but consistency broke down more than once — worth tightening the daily trigger."
        : "Consistency was the main blocker this round, more than the plan's difficulty.");
  }

  function lessons(c, tasks, income, s) {
    const out = [];
    if (s.failed === 0 && s.completed === s.total) out.push("Perfect completion — this plan's scope and pacing suited you well; reuse this structure for the next challenge.");
    if (s.failed > 0) out.push(`${s.failed} day(s) were missed — look at what happened right before those days (time of day, workload, motivation dips).`);
    const streakBreaks = countStreakBreaks(tasks);
    if (streakBreaks > 1) out.push("Momentum broke more than once. Shorter daily tasks or a fixed time slot could help hold the streak.");
    if (c.targetEarn && c.currentEarn < c.targetEarn) out.push(`Earnings landed ${Utils.formatMoney(c.targetEarn - c.currentEarn)} short of target — consider a longer runway or a higher-leverage income source next time.`);
    if (c.targetEarn && c.currentEarn >= c.targetEarn) out.push("Target earnings were met or exceeded — a good sign to raise the bar on the next challenge.");
    if (!out.length) out.push("Not enough signal yet — keep going and the pattern will get clearer.");
    return out;
  }

  function countStreakBreaks(tasks) {
    let breaks = 0, lastWasFail = false;
    tasks.forEach(t => {
      if (t.status === "failed") { if (!lastWasFail) breaks++; lastWasFail = true; }
      else if (t.status === "done") { lastWasFail = false; }
    });
    return breaks;
  }

  // ---------------- Exports ----------------
  function toMarkdown(report) {
    const { challenge: c, tasks, income } = report;
    let md = `# ${c.name}\n\n`;
    md += `**Category:** ${Challenge.categoryMeta(c.category).label}  \n`;
    md += `**Duration:** ${c.days} days (${Utils.formatDate(c.startDate)} → ${Utils.formatDate(c.endDate)})  \n`;
    md += `**Status:** ${c.status}  \n`;
    md += `**Earnings:** ${Utils.formatMoney(c.currentEarn)}${c.targetEarn ? ` / target ${Utils.formatMoney(c.targetEarn)}` : ""}  \n\n`;
    md += `## Summary\n\n${report.aiSummary}\n\n`;
    md += `## Daily Tasks\n\n| Day | Title | Status | Income |\n|---|---|---|---|\n`;
    tasks.forEach(t => { md += `| ${t.day} | ${t.title || "—"} | ${t.status} | ${t.income ? Utils.formatMoney(t.income) : "—"} |\n`; });
    md += `\n## Income Timeline\n\n`;
    if (!income.length) md += "_No income recorded._\n";
    income.forEach(e => { md += `- Day ${e.day}: ${Utils.formatMoney(e.amount)} — ${e.source}${e.note ? ` (${e.note})` : ""}\n`; });
    md += `\n## Lessons Learned\n\n`;
    report.lessons.forEach(l => { md += `- ${l}\n`; });
    return md;
  }

  function toJSON(report) {
    return JSON.stringify(report, null, 2);
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportMarkdown(report) {
    downloadBlob(toMarkdown(report), `${slug(report.challenge.name)}-report.md`, "text/markdown");
  }

  function exportJSON(report) {
    downloadBlob(toJSON(report), `${slug(report.challenge.name)}-report.json`, "application/json");
  }

  function exportPDF(report) {
    const c = report.challenge;
    const win = window.open("", "_blank");
    if (!win) { UI.toast("Allow pop-ups to export as PDF.", "error"); return; }
    const rows = report.tasks.map(t => `<tr><td>${t.day}</td><td>${Utils.escapeHTML(t.title || "—")}</td><td>${t.status}</td><td>${t.income ? Utils.formatMoney(t.income) : "—"}</td></tr>`).join("");
    const lessonItems = report.lessons.map(l => `<li>${Utils.escapeHTML(l)}</li>`).join("");
    win.document.write(`
      <html><head><title>${Utils.escapeHTML(c.name)} — Report</title>
      <style>
        body{font-family:-apple-system,Segoe UI,sans-serif;color:#14151C;padding:40px;max-width:720px;margin:0 auto;}
        h1{margin-bottom:4px;} .meta{color:#5B5F6E;font-size:14px;margin-bottom:24px;}
        table{width:100%;border-collapse:collapse;margin:16px 0;} td,th{border:1px solid #ddd;padding:8px;font-size:13px;text-align:left;}
        h2{margin-top:28px;font-size:18px;} .summary{background:#F6F5F9;padding:16px;border-radius:12px;font-size:14px;line-height:1.6;}
      </style></head><body>
      <h1>${Utils.escapeHTML(c.name)}</h1>
      <div class="meta">${Challenge.categoryMeta(c.category).label} · ${c.days} days · ${Utils.formatDate(c.startDate)} – ${Utils.formatDate(c.endDate)} · ${c.status}</div>
      <div class="summary">${Utils.escapeHTML(report.aiSummary)}</div>
      <h2>Daily Tasks</h2>
      <table><tr><th>Day</th><th>Title</th><th>Status</th><th>Income</th></tr>${rows}</table>
      <h2>Lessons Learned</h2>
      <ul>${lessonItems}</ul>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 300);
  }

  function slug(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "challenge"; }

  return { build, exportMarkdown, exportJSON, exportPDF };
})();
