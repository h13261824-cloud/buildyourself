/* ==========================================================================
   Build Yourself — challenge.js
   Challenge model: creation, derived stats, status transitions.
   ========================================================================== */

const Challenge = (() => {
  const CATEGORIES = [
    { id: "earn", label: "Earn", icon: "money" },
    { id: "study", label: "Study", icon: "doc" },
    { id: "fitness", label: "Fitness", icon: "flame" },
    { id: "business", label: "Business", icon: "chart" },
    { id: "content", label: "Content", icon: "sparkle" },
    { id: "reading", label: "Reading", icon: "doc" },
    { id: "health", label: "Health", icon: "flame" },
    { id: "other", label: "Other", icon: "sparkle" }
  ];

  const DURATIONS = [
    { id: "3", label: "3 Days", days: 3 },
    { id: "7", label: "7 Days", days: 7 },
    { id: "15", label: "15 Days", days: 15 },
    { id: "30", label: "30 Days", days: 30 },
    { id: "custom", label: "Custom", days: null }
  ];

  function create({ name, description, category, days, targetEarn, startDate }) {
    const start = startDate || Utils.todayISO();
    const challenge = {
      id: Utils.uid("chal"),
      name: name.trim(),
      description: (description || "").trim(),
      category,
      days,
      targetEarn: Number(targetEarn) || 0,
      startDate: start,
      endDate: Utils.addDays(start, days - 1),
      status: "planning", // planning -> running -> success | failed
      currentEarn: 0,
      createdAt: Date.now()
    };
    Storage.upsertChallenge(challenge);
    return challenge;
  }

  function activate(challengeId) {
    const c = Storage.getChallenge(challengeId);
    if (!c) return null;
    c.status = "running";
    Storage.upsertChallenge(c);
    return c;
  }

  function categoryMeta(id) {
    return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
  }

  // ---------------- Derived stats ----------------
  function stats(challengeId) {
    const c = Storage.getChallenge(challengeId);
    if (!c) return null;
    const tasks = Storage.getTasks(challengeId);
    const completed = tasks.filter(t => t.status === "done").length;
    const failed = tasks.filter(t => t.status === "failed").length;
    const total = c.days;
    const todayIdx = Utils.dayIndexForToday(c.startDate, c.days);
    const daysLeft = Utils.clamp(total - (todayIdx - 1), 0, total);
    const progressPct = Utils.pct(completed + failed, total);
    const missionScore = Utils.pct(completed, Math.max(completed + failed, 1)) ; // quality of execution among decided days
    return {
      challenge: c, tasks, completed, failed, total,
      remaining: total - completed - failed,
      todayIdx, daysLeft, progressPct, missionScore,
      currentEarn: c.currentEarn || 0
    };
  }

  function finish(challengeId, outcome) {
    // outcome: "success" | "failed"
    const c = Storage.getChallenge(challengeId);
    if (!c) return null;
    c.status = outcome;
    c.finishedAt = Date.now();
    Storage.upsertChallenge(c);

    // Move earn: current -> past regardless of outcome, reset challenge/profile current
    const profile = Storage.getProfile();
    const earn = c.currentEarn || 0;
    Storage.setProfile({
      pastEarn: (profile.pastEarn || 0) + earn,
      currentEarn: Math.max((profile.currentEarn || 0) - earn, 0)
    });

    // Snapshot report
    const tasks = Storage.getTasks(challengeId);
    const income = Storage.getIncome(challengeId);
    const s = stats(challengeId);
    Storage.setReport(challengeId, {
      challenge: c, tasks, income,
      completed: s.completed, failed: s.failed, total: s.total,
      missionScore: s.missionScore,
      generatedAt: Date.now()
    });

    Storage.addNotification({
      type: outcome === "success" ? "challenge_completed" : "mission_failed",
      text: outcome === "success"
        ? `"${c.name}" completed — great work.`
        : `"${c.name}" ended without hitting the goal. Earnings were saved.`
    });

    return c;
  }

  function remove(challengeId) {
    Storage.deleteChallenge(challengeId);
  }

  function all() { return Storage.allChallenges(); }

  function byStatus(status) {
    return all().filter(c => c.status === status);
  }

  return { CATEGORIES, DURATIONS, create, activate, categoryMeta, stats, finish, remove, all, byStatus };
})();
