/* ==========================================================================
   Build Yourself — income.js
   Aggregation helpers for a challenge's earnings.
   ========================================================================== */

const Income = (() => {
  const SOURCES = ["Fiverr", "YouTube", "Freelancing", "Client", "Affiliate", "Business", "Other"];

  function forChallenge(challengeId) {
    return Storage.getIncome(challengeId).slice().sort((a, b) => a.day - b.day);
  }

  function total(challengeId) {
    return forChallenge(challengeId).reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  function bySource(challengeId) {
    const map = {};
    forChallenge(challengeId).forEach(e => {
      map[e.source || "Other"] = (map[e.source || "Other"] || 0) + Number(e.amount || 0);
    });
    return map;
  }

  function totals() {
    const profile = Storage.getProfile();
    return {
      current: profile.currentEarn || 0,
      past: profile.pastEarn || 0,
      total: (profile.currentEarn || 0) + (profile.pastEarn || 0)
    };
  }

  return { SOURCES, forChallenge, total, bySource, totals };
})();
