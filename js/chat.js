/* ==========================================================================
   Build Yourself — chat.js
   Per-challenge AI coach. Each challenge keeps its own chat history and its
   own "context" — the assistant is only ever handed the currently open
   challenge's data, never the full app, so nothing leaks between projects.
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

  // Changed back to synchronous so it works perfectly with your existing ui.js
  function send(challengeId, userText) {
    // 1. Save user message
    Storage.pushChat(challengeId, { role: "user", text: userText, ts: Date.now() });
    
    // 2. Generate reply immediately
    const reply = respond(challengeId, userText);
    
    // 3. Save AI reply and return it so ui.js can render it instantly
    return Storage.pushChat(challengeId, { role: "ai", text: reply, ts: Date.now() });
  }

  function respond(challengeId, text) {
    const ctx = buildContext(challengeId);
    if (!ctx) return "I couldn't find this challenge's data.";
    const t = text.toLowerCase();

    if (/today|now|next task|do today/.test(t)) return todayAdvice(ctx);
    if (/behind|schedule|late|pace|slow/.test(t)) return paceAdvice(ctx);
    if (/earn faster|earn more|money|income/.test(t)) return earnAdvice(ctx);
    if (/review|how am i doing|progress|status/.test(t)) return reviewAdvice(ctx);
    if (/next challenge|generate|new challenge|suggest.*challenge/.test(t)) return nextChallengeAdvice(ctx);
    if (/motivat|tired|give up|hard|struggl/.test(t)) return motivation(ctx);
    if (/mistake|wrong|fail|missed/.test(t)) return mistakeAdvice(ctx);
    if (/hello|hi|hey|coach/.test(t)) return `Hello! I'm here to help you crush your "${ctx.name}" challenge. What's on your mind?`;

    return generic(ctx, text);
  }

  function todayAdvice(ctx) {
    if (!ctx.todayTask) return `Day ${ctx.currentDay} isn't in your plan — this challenge may already be finished. Open the report to see how it went.`;
    if (ctx.todayTask.status !== "pending") return `Day ${ctx.currentDay} is already recorded as ${ctx.todayTask.status}. Nothing left to do today — come back tomorrow.`;
    return `Today is Day ${ctx.currentDay}: "${ctx.todayTask.title || "your planned task"}". ${ctx.todayTask.description ? ctx.todayTask.description + " " : ""}Mark it done as soon as you finish it.`;
  }

  function paceAdvice(ctx) {
    const done = ctx.completedTasks.length, failed = ctx.failedTasks.length;
    const expected = ctx.currentDay - 1;
    const actual = done + failed;
    if (actual >= expected && failed === 0) return `You're right on pace — ${done} of ${expected} expected days are done cleanly. Keep the streak alive.`;
    if (failed > 0) return `You've completed ${done} and missed ${failed} of ${expected} expected days. You're not out of it — keep today's day clean.`;
    return `You're at day ${ctx.currentDay} of ${ctx.duration}, ${ctx.missionProgress}% through the plan. That's a normal spot to be.`;
  }

  function earnAdvice(ctx) {
    const gap = ctx.targetEarn ? Math.max(ctx.targetEarn - ctx.currentEarn, 0) : 0;
    const bySource = {};
    ctx.incomeHistory.forEach(e => { bySource[e.source] = (bySource[e.source] || 0) + e.amount; });
    const top = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0];
    let out = `You've earned ${Utils.formatMoney(ctx.currentEarn)} so far`;
    out += ctx.targetEarn ? `, ${Utils.formatMoney(gap)} short of your ${Utils.formatMoney(ctx.targetEarn)} target. ` : ". ";
    if (top) out += `Your strongest source is ${top[0]} (${Utils.formatMoney(top[1])}).`;
    else out += "No income logged yet.";
    return out;
  }

  function reviewAdvice(ctx) {
    return `Day ${ctx.currentDay} of ${ctx.duration}. Progress: ${ctx.missionProgress}%. Completed: ${ctx.completedTasks.length}, Missed: ${ctx.failedTasks.length}. Earnings: ${Utils.formatMoney(ctx.currentEarn)}. `
      + (ctx.failedTasks.length === 0 ? "Clean run so far." : `You've missed ${ctx.failedTasks.length} day(s).`);
  }

  function nextChallengeAdvice(ctx) {
    const harder = ctx.missionProgress >= 80;
    const nextDays = harder ? Math.min(ctx.duration * 2, 30) : ctx.duration;
    return `Based on how "${ctx.name}" went, I'd suggest a ${nextDays}-day challenge next. Give it a clear name and a small daily task.`;
  }

  function motivation(ctx) {
    return `${ctx.completedTasks.length} day(s) are already banked — that's proof, not luck. Do today's task, and tomorrow takes care of itself.`;
  }

  function mistakeAdvice(ctx) {
    if (!ctx.failedTasks.length) return "No missed days yet on this challenge — nothing to flag.";
    return `Days ${ctx.failedTasks.join(", ")} were missed. Look for a pattern and try to avoid it today.`;
  }

  function generic(ctx, text) {
    // Adding variations so it doesn't give the same reply to random messages
    const fallbacks = [
      `On "${ctx.name}": you're ${ctx.missionProgress}% through, day ${ctx.currentDay} of ${ctx.duration}. Ask me things like "what should I do today".`,
      `I'm currently tracking your data. You've earned ${Utils.formatMoney(ctx.currentEarn)} so far. What's the plan for today?`,
      `Keep your focus on finishing day ${ctx.currentDay} strong. Need a quick progress review?`,
      `I hear you. You have ${ctx.remainingTasks.length} tasks remaining in this challenge. Let's finish them!`,
      `Got it. I'm here to analyze your stats. If you want a full breakdown, just ask to "review my progress".`
    ];
    // This will pick a pseudo-random reply based on the length of the user's text
    const idx = text.length % fallbacks.length;
    return fallbacks[idx];
  }

  return { SUGGESTIONS, buildContext, history, seedIfEmpty, send };
})();
