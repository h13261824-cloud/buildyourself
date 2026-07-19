/* ==========================================================================
   Build Yourself — chat.js
   Per-challenge AI coach. Each challenge keeps its own chat history and its
   own "context" — the assistant is only ever handed the currently open
   challenge's data, never the full app, so nothing leaks between projects.

   NOTE: this runs entirely on-device using the challenge's own data. It is
   not connected to an external model — replace `respond()` with a real API
   call later (see the Firebase/API-ready notes in storage.js) if you want
   a live LLM behind it; the context object below is already shaped for
   that hand-off.
   ========================================================================== */

const Chat = (() => {
  const SUGGESTIONS = [
    "What should I do today?",
    "Am I behind schedule?",
    "How can I earn faster?",
    "Review my challenge.",
    "Generate next challenge."
  ];

  function buildContext(challengeId) {
    const c = Storage.getChallenge(challengeId);
    if (!c) return null;
    const tasks = Storage.getTasks(challengeId);
    const s = Challenge.stats(challengeId);
    const income = Income.forChallenge(challengeId);
    const todayTask = tasks.find(t => t.day === s.todayIdx);
    return {
      name: c.name,
      description: c.description,
      duration: c.days,
      currentDay: s.todayIdx,
      missionProgress: s.progressPct,
      todayTask: todayTask ? { title: todayTask.title, description: todayTask.description, status: todayTask.status } : null,
      completedTasks: tasks.filter(t => t.status === "done").map(t => t.day),
      failedTasks: tasks.filter(t => t.status === "failed").map(t => t.day),
      remainingTasks: tasks.filter(t => t.status === "pending").map(t => t.day),
      currentEarn: c.currentEarn || 0,
      targetEarn: c.targetEarn || 0,
      incomeHistory: income,
      dailyNotes: tasks.filter(t => t.note).map(t => ({ day: t.day, note: t.note }))
    };
  }

  function history(challengeId) { return Storage.getChat(challengeId); }

  function seedIfEmpty(challengeId) {
    const h = history(challengeId);
    if (h.length) return h;
    const ctx = buildContext(challengeId);
    const greeting = `I'm your coach for "${ctx.name}" — and only this challenge. Ask me anything about your plan, pace, or earnings.`;
    return Storage.pushChat(challengeId, { role: "ai", text: greeting, ts: Date.now() });
  }

  function send(challengeId, userText) {
    Storage.pushChat(challengeId, { role: "user", text: userText, ts: Date.now() });
    const reply = respond(challengeId, userText);
    return Storage.pushChat(challengeId, { role: "ai", text: reply, ts: Date.now() });
  }

  function respond(challengeId, text) {
    const ctx = buildContext(challengeId);
    if (!ctx) return "I couldn't find this challenge's data.";
    const t = text.toLowerCase();

    if (/today|now|next task/.test(t)) return todayAdvice(ctx);
    if (/behind|schedule|late|pace/.test(t)) return paceAdvice(ctx);
    if (/earn faster|earn more|money|income/.test(t)) return earnAdvice(ctx);
    if (/review|how am i doing|progress/.test(t)) return reviewAdvice(ctx);
    if (/next challenge|generate|new challenge|suggest.*challenge/.test(t)) return nextChallengeAdvice(ctx);
    if (/motivat|tired|give up|hard|struggl/.test(t)) return motivation(ctx);
    if (/mistake|wrong|fail/.test(t)) return mistakeAdvice(ctx);

    return generic(ctx, text);
  }

  function todayAdvice(ctx) {
    if (!ctx.todayTask) return `Day ${ctx.currentDay} isn't in your plan — this challenge may already be finished. Open the report to see how it went.`;
    if (ctx.todayTask.status !== "pending") return `Day ${ctx.currentDay} is already recorded as ${ctx.todayTask.status}. Nothing left to do today — come back tomorrow.`;
    return `Today is Day ${ctx.currentDay}: "${ctx.todayTask.title || "your planned task"}". ${ctx.todayTask.description ? ctx.todayTask.description + " " : ""}Mark it done as soon as you finish it — momentum compounds faster than the task itself.`;
  }

  function paceAdvice(ctx) {
    const done = ctx.completedTasks.length, failed = ctx.failedTasks.length;
    const expected = ctx.currentDay - 1;
    const actual = done + failed;
    if (actual >= expected && failed === 0) return `You're right on pace — ${done} of ${expected} expected days are done cleanly. Keep the streak alive.`;
    if (failed > 0) return `You've completed ${done} and missed ${failed} of ${expected} expected days. You're not out of it — the goal is to keep today's day clean, not to fix the past.`;
    return `You're at day ${ctx.currentDay} of ${ctx.duration}, ${ctx.missionProgress}% through the plan. That's a normal spot to be — focus only on today's task.`;
  }

  function earnAdvice(ctx) {
    const gap = ctx.targetEarn ? Math.max(ctx.targetEarn - ctx.currentEarn, 0) : 0;
    const bySource = {};
    ctx.incomeHistory.forEach(e => { bySource[e.source] = (bySource[e.source] || 0) + e.amount; });
    const top = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    let out = `You've earned ${Utils.formatMoney(ctx.currentEarn)} so far`;
    out += ctx.targetEarn ? `, ${Utils.formatMoney(gap)} short of your ${Utils.formatMoney(ctx.targetEarn)} target. ` : ". ";
    if (top) out += `Your strongest source is ${top[0]} (${Utils.formatMoney(top[1])}) — doubling down there is usually faster than starting a new channel.`;
    else out += "No income logged yet — even small amounts recorded daily build a much clearer picture than one big number at the end.";
    return out;
  }

  function reviewAdvice(ctx) {
    return `Day ${ctx.currentDay} of ${ctx.duration}. Progress: ${ctx.missionProgress}%. Completed: ${ctx.completedTasks.length}, Missed: ${ctx.failedTasks.length}, Remaining: ${ctx.remainingTasks.length}. Earnings: ${Utils.formatMoney(ctx.currentEarn)}${ctx.targetEarn ? ` of ${Utils.formatMoney(ctx.targetEarn)} target` : ""}. `
      + (ctx.failedTasks.length === 0 ? "Clean run so far — no missed days." : `You've missed ${ctx.failedTasks.length} day(s) — worth a quick look at what got in the way.`);
  }

  function nextChallengeAdvice(ctx) {
    const harder = ctx.missionProgress >= 80;
    const nextDays = harder ? Math.min(ctx.duration * 2, 30) : ctx.duration;
    return `Based on how "${ctx.name}" went, I'd suggest a ${nextDays}-day challenge next${harder ? ", stepping up since this one is going well" : ", keeping the same length until consistency is rock solid"}. Give it a clear, single-outcome name and a daily task small enough to do even on a bad day.`;
  }

  function motivation(ctx) {
    return `${ctx.completedTasks.length} day(s) are already banked — that's proof, not luck. The only job today is one task, not the whole ${ctx.duration}-day plan. Do today's, and tomorrow takes care of itself.`;
  }

  function mistakeAdvice(ctx) {
    if (!ctx.failedTasks.length) return "No missed days yet on this challenge — nothing to flag. Keep the plan realistic and today should go the same way.";
    return `Days ${ctx.failedTasks.join(", ")} were missed. Look for a pattern — same time of day, same trigger — rather than treating each as unrelated. Fixing the pattern fixes every future day at once.`;
  }

  function generic(ctx, text) {
    return `On "${ctx.name}": you're ${ctx.missionProgress}% through, day ${ctx.currentDay} of ${ctx.duration}, with ${Utils.formatMoney(ctx.currentEarn)} earned. Ask me things like "what should I do today" or "review my challenge" and I'll answer using this challenge's own data only.`;
  }

  return { SUGGESTIONS, buildContext, history, seedIfEmpty, send };
})();
