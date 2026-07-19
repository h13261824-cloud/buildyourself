/* ==========================================================================
   Build Yourself — task.js
   Daily planning + the rules that govern which day can be actioned.
   ========================================================================== */

const Task = (() => {
  function generatePlanSkeleton(days) {
    return Array.from({ length: days }, (_, i) => ({
      day: i + 1,
      title: "",
      description: "",
      note: "",
      status: "pending", // pending -> done | failed
      doneDate: null,
      income: 0
    }));
  }

  function savePlan(challengeId, tasks) {
    Storage.setTasks(challengeId, tasks);
  }

  function getPlan(challengeId) {
    return Storage.getTasks(challengeId);
  }

  // A day can be actioned only if it is "today" relative to the challenge's
  // start date, and every prior day already has a final status.
  function dayState(challenge, task) {
    const todayIdx = Utils.dayIndexForToday(challenge.startDate, challenge.days);
    if (task.status === "done") return "done";
    if (task.status === "failed") return "failed";
    if (task.day < todayIdx) return "missed-locked"; // past day never actioned — still locked from editing, shown as overdue
    if (task.day === todayIdx) return "today";
    return "locked"; // future
  }

  function canComplete(challenge, tasks, day) {
    const target = tasks.find(t => t.day === day);
    if (!target || target.status !== "pending") return { ok: false, reason: "Already recorded." };
    const todayIdx = Utils.dayIndexForToday(challenge.startDate, challenge.days);
    if (day !== todayIdx) return { ok: false, reason: "Only today's task can be completed." };
    const alreadyActedToday = tasks.some(t => t.status !== "pending" && t.doneDate === Utils.todayISO());
    if (alreadyActedToday) return { ok: false, reason: "You already recorded a day today." };
    return { ok: true };
  }

  function markDone(challengeId, day, { income = 0, source = "", note = "" } = {}) {
    const challenge = Storage.getChallenge(challengeId);
    const tasks = getPlan(challengeId);
    const check = canComplete(challenge, tasks, day);
    if (!check.ok) return { ok: false, reason: check.reason };

    const idx = tasks.findIndex(t => t.day === day);
    tasks[idx] = { ...tasks[idx], status: "done", doneDate: Utils.todayISO(), income: Number(income) || 0, note: note || tasks[idx].note };
    savePlan(challengeId, tasks);

    if (Number(income) > 0) {
      Storage.addIncome(challengeId, {
        id: Utils.uid("inc"), day, amount: Number(income), source, note, date: Utils.todayISO()
      });
      challenge.currentEarn = (challenge.currentEarn || 0) + Number(income);
      Storage.upsertChallenge(challenge);
      const profile = Storage.getProfile();
      Storage.setProfile({ currentEarn: (profile.currentEarn || 0) + Number(income) });
    }

    Storage.addNotification({ type: "task_done", text: `Day ${day} of "${challenge.name}" marked done.` });
    return { ok: true, tasks };
  }

  function markFailed(challengeId, day, note = "") {
    const challenge = Storage.getChallenge(challengeId);
    const tasks = getPlan(challengeId);
    const check = canComplete(challenge, tasks, day);
    if (!check.ok) return { ok: false, reason: check.reason };

    const idx = tasks.findIndex(t => t.day === day);
    tasks[idx] = { ...tasks[idx], status: "failed", doneDate: Utils.todayISO(), note: note || tasks[idx].note };
    savePlan(challengeId, tasks);
    return { ok: true, tasks };
  }

  return { generatePlanSkeleton, savePlan, getPlan, dayState, canComplete, markDone, markFailed };
})();
