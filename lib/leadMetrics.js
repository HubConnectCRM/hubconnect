export const LEAD_PROBABILITIES = ["T90", "T70", "T50"];
export const LEAD_OUTCOMES = ["won", "failed", "postponed", "open"];

const WON_STATUSES = new Set(["won", "sale", "sales", "sold", "converted", "completed", "closed_won"]);
const FAILED_STATUSES = new Set(["lost", "failed", "declined", "rejected", "closed_lost"]);
const POSTPONED_STATUSES = new Set(["postponed", "postpone", "paused", "on_hold", "on hold", "deferred"]);

function emptyBucket() {
  return { total: 0, won: 0, failed: 0, postponed: 0, open: 0 };
}

export function emptyLeadMetrics() {
  return {
    total: 0,
    outcomes: { won: 0, failed: 0, postponed: 0, open: 0 },
    byProbability: Object.fromEntries(LEAD_PROBABILITIES.map((probability) => [probability, emptyBucket()])),
  };
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function probabilityOf(row) {
  const probability = String(row?.probability || "T50").trim().toUpperCase();
  return LEAD_PROBABILITIES.includes(probability) ? probability : "T50";
}

function dealOutcome(deal) {
  const stage = normalize(deal?.stage);
  if (stage === "won" || deal?.po_won || deal?.pushed_event_id) return "won";
  if (FAILED_STATUSES.has(stage)) return "failed";
  if (POSTPONED_STATUSES.has(stage)) return "postponed";
  return "open";
}

export function leadOutcome(row, relatedDeals = []) {
  const status = normalize(row?.status);
  const dealOutcomes = relatedDeals.map(dealOutcome);
  if (WON_STATUSES.has(status) || dealOutcomes.includes("won")) return "won";
  if (FAILED_STATUSES.has(status) || dealOutcomes.includes("failed")) return "failed";
  if (POSTPONED_STATUSES.has(status) || dealOutcomes.includes("postponed")) return "postponed";
  return "open";
}

export function summarizeLeadContacts(leadContacts = [], deals = []) {
  const dealsByContact = new Map();
  for (const deal of deals || []) {
    for (const rep of deal?.reps || []) {
      const contactId = rep?.contact_id || rep?.contact?.id;
      if (!contactId) continue;
      if (!dealsByContact.has(contactId)) dealsByContact.set(contactId, []);
      dealsByContact.get(contactId).push(deal);
    }
  }

  const metrics = emptyLeadMetrics();
  for (const row of leadContacts || []) {
    const probability = probabilityOf(row);
    const contactId = row?.contact_id || row?.contact?.id;
    const outcome = leadOutcome(row, dealsByContact.get(contactId) || []);
    metrics.total += 1;
    metrics.outcomes[outcome] += 1;
    metrics.byProbability[probability].total += 1;
    metrics.byProbability[probability][outcome] += 1;
  }
  return metrics;
}

export function combineLeadMetrics(items = []) {
  const combined = emptyLeadMetrics();
  for (const metrics of items || []) {
    if (!metrics) continue;
    combined.total += Number(metrics.total || 0);
    for (const outcome of LEAD_OUTCOMES) combined.outcomes[outcome] += Number(metrics.outcomes?.[outcome] || 0);
    for (const probability of LEAD_PROBABILITIES) {
      combined.byProbability[probability].total += Number(metrics.byProbability?.[probability]?.total || 0);
      for (const outcome of LEAD_OUTCOMES) combined.byProbability[probability][outcome] += Number(metrics.byProbability?.[probability]?.[outcome] || 0);
    }
  }
  return combined;
}

export function leadRate(value, total) {
  return total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;
}
