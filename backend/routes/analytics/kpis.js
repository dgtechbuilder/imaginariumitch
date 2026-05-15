import { store, BASELINE_ENGAGEMENT_RATE } from '../../data/store.js'

function isoDateStr(d) {
  return d.toISOString().slice(0, 10)
}

// Core KPI computation for a time window over an event set
function computeKPIsFromEvents(events, budget) {
  const impressions = events.filter((e) => e.type === 'impression').length
  const engagements = events.filter((e) => e.type === 'engagement').length
  const viewable = events.filter((e) => e.type === 'engagement' && e.durationMs >= 2000).length
  const recallSignals = events.filter((e) => e.type === 'recall_signal').length

  const viewabilityRate = impressions > 0 ? viewable / impressions : 0
  const engagementRate = impressions > 0 ? engagements / impressions : 0
  const engagementLift = (engagementRate - BASELINE_ENGAGEMENT_RATE) / BASELINE_ENGAGEMENT_RATE
  const cpe = engagements > 0 ? (budget / engagements) : 0
  const brandRecallScore = impressions > 0 ? Math.min(100, Math.round((recallSignals / impressions) * 1000)) : 0

  return {
    impressions,
    engagements,
    viewabilityRate: Math.round(viewabilityRate * 1000) / 1000,
    engagementRate: Math.round(engagementRate * 1000) / 1000,
    engagementLift: Math.round(engagementLift * 1000) / 1000,
    costPerEngagement: Math.round(cpe * 100) / 100,
    brandRecallScore,
    recallSignals,
  }
}

// Returns KPI snapshot for a campaign (last 7 days + trend vs prior 7 days)
export function computeKPIs(campaignId) {
  const campaign = store.campaigns.find((c) => c.id === campaignId)
  if (!campaign) return null

  const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  const campaignEvents = store.events.filter((e) => e.campaignId === campaignId)
  const current = campaignEvents.filter((e) => {
    const t = new Date(e.timestamp).getTime()
    return t >= nowMs - sevenDays && t < nowMs
  })
  const prior = campaignEvents.filter((e) => {
    const t = new Date(e.timestamp).getTime()
    return t >= nowMs - sevenDays * 2 && t < nowMs - sevenDays
  })

  const currentKPIs = computeKPIsFromEvents(current, campaign.budget)
  const priorKPIs = computeKPIsFromEvents(prior, campaign.budget)

  const delta = (cur, prev) =>
    prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 1000 : 0

  return {
    ...currentKPIs,
    trend: {
      impressionsDelta: delta(currentKPIs.impressions, priorKPIs.impressions),
      engagementsDelta: delta(currentKPIs.engagements, priorKPIs.engagements),
      cpeDelta: delta(currentKPIs.costPerEngagement, priorKPIs.costPerEngagement),
      viewabilityDelta: delta(currentKPIs.viewabilityRate, priorKPIs.viewabilityRate),
    },
  }
}

export default async function kpisRoute(fastify) {
  // GET /analytics/kpis — aggregate summary across all (or one) campaign
  fastify.get('/analytics/kpis', async (request) => {
    const { campaignId } = request.query
    const campaigns = campaignId
      ? store.campaigns.filter((c) => c.id === campaignId)
      : store.campaigns

    const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0)
    const ids = new Set(campaigns.map((c) => c.id))

    const events = store.events.filter((e) => {
      const t = new Date(e.timestamp).getTime()
      return ids.has(e.campaignId) && t >= nowMs - sevenDays && t < nowMs
    })

    const summary = computeKPIsFromEvents(events, totalBudget)

    // Breakdown by placement
    const placements = ['banner', 'cutscene', 'cosmetic', 'environmental']
    const byPlacement = placements.map((type) => {
      const pe = events.filter((e) => e.placementType === type)
      const budget = campaigns
        .filter((c) => c.placementTypes.includes(type))
        .reduce((s, c) => s + c.budget * (1 / c.placementTypes.length), 0)
      const k = computeKPIsFromEvents(pe, budget)
      return { type, impressions: k.impressions, engagements: k.engagements, cpe: k.costPerEngagement, viewabilityRate: k.viewabilityRate }
    })

    // Breakdown by region
    const regions = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa']
    const byRegion = regions.map((region) => {
      const re = events.filter((e) => e.region === region)
      const k = computeKPIsFromEvents(re, totalBudget / regions.length)
      return { region, impressions: k.impressions, engagements: k.engagements, engagementRate: k.engagementRate }
    })

    return { summary, byPlacement, byRegion }
  })

  // GET /analytics/kpis/timeseries — daily metric over N days
  fastify.get('/analytics/kpis/timeseries', async (request, reply) => {
    const { campaignId, metric = 'impressions', days = '30' } = request.query
    const numDays = Math.min(90, Math.max(1, parseInt(days, 10) || 30))
    const validMetrics = ['impressions', 'engagements', 'viewabilityRate', 'costPerEngagement']
    if (!validMetrics.includes(metric)) {
      reply.code(400)
      return { error: `metric must be one of: ${validMetrics.join(', ')}` }
    }

    const ids = campaignId ? new Set([campaignId]) : new Set(store.campaigns.map((c) => c.id))
    const events = store.events.filter((e) => ids.has(e.campaignId))
    const totalBudget = store.campaigns
      .filter((c) => ids.has(c.id))
      .reduce((s, c) => s + c.budget, 0)

    const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
    const dayMs = 24 * 60 * 60 * 1000

    const labels = []
    const values = []

    for (let i = numDays - 1; i >= 0; i--) {
      const from = nowMs - (i + 1) * dayMs
      const to = nowMs - i * dayMs
      const dayEvents = events.filter((e) => {
        const t = new Date(e.timestamp).getTime()
        return t >= from && t < to
      })
      const k = computeKPIsFromEvents(dayEvents, totalBudget / numDays)
      labels.push(isoDateStr(new Date(from)))
      values.push(k[metric] ?? 0)
    }

    return { labels, values, metric, days: numDays }
  })
}
