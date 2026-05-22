const MODES = {
  survival: { Food: 0.4, Transport: 0.18, Shopping: 0.08, Entertainment: 0.06, Health: 0.08, Other: 0.2 },
  balanced: { Food: 0.35, Transport: 0.2, Shopping: 0.15, Entertainment: 0.12, Health: 0.08, Other: 0.1 },
  party: { Food: 0.25, Transport: 0.15, Shopping: 0.1, Entertainment: 0.35, Health: 0.05, Other: 0.1 },
};

function buildAllocation(pool, mode = 'survival') {
  const weights = MODES[mode] || MODES.survival;
  const plan = {};
  let assigned = 0;
  const entries = Object.entries(weights);
  entries.forEach(([cat, w], idx) => {
    if (idx === entries.length - 1) {
      plan[cat] = Math.max(0, pool - assigned);
    } else {
      const slice = Math.round(pool * w);
      plan[cat] = slice;
      assigned += slice;
    }
  });
  return plan;
}

function buildSurvivalPlan(ctx, params = {}) {
  const reserved = Math.max(0, Number(params.reservedForEvent || params.partyReserve || 0));
  const pool = Math.max(0, ctx.remaining - reserved);
  const daysLeft = ctx.daysLeft;
  const dailyLimit = daysLeft > 0 ? Math.floor(pool / daysLeft) : 0;
  const mode = params.mode || 'survival';
  const plan = buildAllocation(pool, mode);

  return {
    plan,
    survivalMeta: {
      remaining: ctx.remaining,
      daysLeft,
      dailyLimit,
      reserved,
      afterReserve: pool,
      mode,
      projectedMonthEndBalance: ctx.projectedMonthEndBalance,
    },
  };
}

module.exports = { buildSurvivalPlan, buildAllocation };
