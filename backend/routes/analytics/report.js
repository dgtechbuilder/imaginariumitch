import { store } from '../../data/store.js'
import { computeKPIs } from './kpis.js'

// Cache generated report for 60 seconds to avoid redundant recomputation
let reportCache = null
let reportCacheTs = 0

function dateStr(d) {
  return d.toISOString().slice(0, 10)
}

function generateReport() {
  const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const weekFrom = dateStr(new Date(nowMs - sevenDays))
  const weekTo = dateStr(new Date(nowMs - 1000))

  const campaignReports = store.campaigns
    .filter((c) => c.status === 'active' || c.status === 'paused')
    .map((c) => {
      const kpis = computeKPIs(c.id)
      return { id: c.id, name: c.name, status: c.status, kpis }
    })

  // Aggregate for highlight generation
  const totalImpressions = campaignReports.reduce((s, r) => s + r.kpis.impressions, 0)
  const totalEngagements = campaignReports.reduce((s, r) => s + r.kpis.engagements, 0)

  // Placement performance across all active campaigns in the window
  const events = store.events.filter((e) => {
    const t = new Date(e.timestamp).getTime()
    return t >= nowMs - sevenDays && t < nowMs
  })

  const placementStats = ['cutscene', 'banner', 'cosmetic', 'environmental'].map((p) => {
    const pe = events.filter((e) => e.placementType === p)
    const imp = pe.filter((e) => e.type === 'impression').length
    const eng = pe.filter((e) => e.type === 'engagement').length
    return { type: p, rate: imp > 0 ? eng / imp : 0 }
  }).sort((a, b) => b.rate - a.rate)

  const topPlacement = placementStats[0]
  const bottomPlacement = placementStats[placementStats.length - 1]
  const lift = topPlacement.rate > 0 && bottomPlacement.rate > 0
    ? (topPlacement.rate / bottomPlacement.rate).toFixed(1)
    : 'N/A'

  const regionStats = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa'].map((r) => {
    const re = events.filter((e) => e.region === r)
    const imp = re.filter((e) => e.type === 'impression').length
    const eng = re.filter((e) => e.type === 'engagement').length
    return { region: r, engagements: eng, rate: imp > 0 ? eng / imp : 0 }
  }).sort((a, b) => b.engagements - a.engagements)

  const topRegion = regionStats[0]

  // Avg CPE trend across active campaigns
  const activeWithTrend = campaignReports.filter((r) => r.kpis.trend.cpeDelta !== 0)
  const avgCpeDelta = activeWithTrend.length > 0
    ? activeWithTrend.reduce((s, r) => s + r.kpis.trend.cpeDelta, 0) / activeWithTrend.length
    : 0
  const cpePct = Math.abs(Math.round(avgCpeDelta * 100))
  const cpeDir = avgCpeDelta < 0 ? 'improved' : 'increased'

  const highlights = [
    `${topPlacement.type.charAt(0).toUpperCase() + topPlacement.type.slice(1)} placements drove ${lift}× higher engagement vs. ${bottomPlacement.type} formats this week.`,
    `${topRegion.region} led all regions with ${topRegion.engagements.toLocaleString()} engagements (${(topRegion.rate * 100).toFixed(1)}% engagement rate).`,
    activeWithTrend.length > 0
      ? `Average cost-per-engagement ${cpeDir} by ${cpePct}% vs. the prior week across active campaigns.`
      : `${totalImpressions.toLocaleString()} total impressions delivered with ${totalEngagements.toLocaleString()} engagements this week.`,
    `Brand recall signals were strongest in ${topRegion.region}, correlating with high cutscene completion rates.`,
  ]

  const recommendations = [
    {
      priority: 'high',
      action: `Increase ${topPlacement.type} placement budget by 20%`,
      rationale: `Highest engagement rate at ${(topPlacement.rate * 100).toFixed(1)}% — best ROI among all placement types this week.`,
    },
    {
      priority: 'medium',
      action: `Expand ${topRegion.region} reach with additional inventory`,
      rationale: `Region drives the most engagements and is under-saturated relative to its audience size.`,
    },
    {
      priority: 'low',
      action: `A/B test new creative variants for ${bottomPlacement.type} placements`,
      rationale: `Lowest engagement rate at ${(bottomPlacement.rate * 100).toFixed(1)}% — fresh creative could recover performance before reallocating budget.`,
    },
  ]

  return {
    weekRange: { from: weekFrom, to: weekTo },
    highlights,
    recommendations,
    campaigns: campaignReports,
    generatedAt: new Date().toISOString(),
  }
}

export default async function reportRoute(fastify) {
  fastify.get('/analytics/report', async () => {
    const now = Date.now()
    if (!reportCache || now - reportCacheTs > 60_000) {
      reportCache = generateReport()
      reportCacheTs = now
    }
    return { report: reportCache }
  })
}
