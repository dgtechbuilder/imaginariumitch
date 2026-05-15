import Anthropic from '@anthropic-ai/sdk'
import { store, BASELINE_ENGAGEMENT_RATE } from '../../data/store.js'
import { computeKPIs } from './kpis.js'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function buildPrompt(campaigns, kpis, byPlacement, byRegion) {
  const campaignNames = campaigns.map((c) => c.name).join(', ')
  const topPlacement = [...byPlacement].sort((a, b) => b.engagements - a.engagements)[0]
  const topRegion = [...byRegion].sort((a, b) => b.engagements - a.engagements)[0]
  const placementLines = byPlacement
    .map((p) => `  ${p.type}: ${p.impressions.toLocaleString()} impressions, ${p.engagements.toLocaleString()} engagements, CPE $${p.cpe.toFixed(2)}`)
    .join('\n')
  const regionLines = byRegion
    .map((r) => `  ${r.region}: ${r.impressions.toLocaleString()} impressions, ${r.engagements.toLocaleString()} engagements (${(r.engagementRate * 100).toFixed(1)}% rate)`)
    .join('\n')

  return `You are a media analytics expert specializing in in-game advertising for African markets. Analyze the following 7-day campaign performance data and provide exactly 3-5 specific insights followed by 2-3 actionable recommendations. Be precise with numbers. Use plain prose only — no markdown headers or bullet symbols. Keep your total response under 280 words.

Campaigns: ${campaignNames}
Platform: FullComposite Unity WebGL Game

KPI Summary (last 7 days):
- Total Impressions: ${kpis.impressions.toLocaleString()} (${kpis.trend?.impressionsDelta >= 0 ? '+' : ''}${((kpis.trend?.impressionsDelta ?? 0) * 100).toFixed(1)}% WoW)
- Total Engagements: ${kpis.engagements.toLocaleString()} (${kpis.trend?.engagementsDelta >= 0 ? '+' : ''}${((kpis.trend?.engagementsDelta ?? 0) * 100).toFixed(1)}% WoW)
- Viewability Rate: ${(kpis.viewabilityRate * 100).toFixed(1)}%
- Engagement Lift vs. Baseline: ${(kpis.engagementLift * 100).toFixed(1)}%
- Cost Per Engagement: $${kpis.costPerEngagement.toFixed(2)}
- Brand Recall Score: ${kpis.brandRecallScore}/100

Placement Breakdown:
${placementLines}

Regional Breakdown:
${regionLines}

Top-performing placement: ${topPlacement?.type ?? 'N/A'}
Top-performing region: ${topRegion?.region ?? 'N/A'} (${topRegion?.engagements.toLocaleString() ?? 0} engagements)`
}

export default async function insightsRoute(fastify) {
  fastify.get('/analytics/insights', async (request, reply) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      reply.code(503)
      return { error: 'ANTHROPIC_API_KEY not configured' }
    }

    const { campaignId } = request.query
    const campaigns = campaignId
      ? store.campaigns.filter((c) => c.id === campaignId)
      : store.campaigns.filter((c) => c.status === 'active')

    if (campaigns.length === 0) {
      reply.code(404)
      return { error: 'No matching campaigns found' }
    }

    // Aggregate KPIs across selected campaigns
    const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    const ids = new Set(campaigns.map((c) => c.id))
    const totalBudget = campaigns.reduce((s, c) => s + c.budget, 0)

    const events = store.events.filter((e) => {
      const t = new Date(e.timestamp).getTime()
      return ids.has(e.campaignId) && t >= nowMs - sevenDays && t < nowMs
    })

    const aggregated = campaigns.length === 1
      ? computeKPIs(campaigns[0].id)
      : (() => {
          const imp = events.filter((e) => e.type === 'impression').length
          const eng = events.filter((e) => e.type === 'engagement').length
          const viewable = events.filter((e) => e.type === 'engagement' && e.durationMs >= 2000).length
          const recall = events.filter((e) => e.type === 'recall_signal').length
          const engRate = imp > 0 ? eng / imp : 0
          return {
            impressions: imp,
            engagements: eng,
            viewabilityRate: imp > 0 ? viewable / imp : 0,
            engagementRate: engRate,
            engagementLift: (engRate - BASELINE_ENGAGEMENT_RATE) / BASELINE_ENGAGEMENT_RATE,
            costPerEngagement: eng > 0 ? totalBudget / eng : 0,
            brandRecallScore: imp > 0 ? Math.min(100, Math.round((recall / imp) * 1000)) : 0,
            trend: { impressionsDelta: 0, engagementsDelta: 0, cpeDelta: 0 },
          }
        })()

    const placements = ['banner', 'cutscene', 'cosmetic', 'environmental'].map((type) => {
      const pe = events.filter((e) => e.placementType === type)
      const imp = pe.filter((e) => e.type === 'impression').length
      const eng = pe.filter((e) => e.type === 'engagement').length
      const budget = campaigns
        .filter((c) => c.placementTypes.includes(type))
        .reduce((s, c) => s + c.budget * (1 / c.placementTypes.length), 0)
      return { type, impressions: imp, engagements: eng, cpe: eng > 0 ? budget / eng : 0 }
    })

    const regions = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa'].map((region) => {
      const re = events.filter((e) => e.region === region)
      const imp = re.filter((e) => e.type === 'impression').length
      const eng = re.filter((e) => e.type === 'engagement').length
      return { region, impressions: imp, engagements: eng, engagementRate: imp > 0 ? eng / imp : 0 }
    })

    const prompt = buildPrompt(campaigns, aggregated, placements, regions)

    // Stream SSE response using reply.raw
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': request.headers.origin ?? '*',
    })

    return new Promise((resolve) => {
      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        reply.raw.end()
        resolve()
      }

      client.messages
        .stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 512,
          messages: [{ role: 'user', content: prompt }],
        })
        .on('text', (text) => {
          reply.raw.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`)
        })
        .on('finalMessage', () => {
          reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          finish()
        })
        .on('error', (err) => {
          reply.raw.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`)
          finish()
        })
    })
  })
}
