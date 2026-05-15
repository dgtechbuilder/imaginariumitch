import { store } from '../../data/store.js'
import { PLACEMENT_TYPES, REGIONS, COHORTS } from '../../data/store.js'

const GAME_TITLES = ['FullComposite']

function segmentEvents(events, key, values) {
  return values.map((val) => {
    const seg = events.filter((e) => e[key] === val)
    const impressions = seg.filter((e) => e.type === 'impression').length
    const engagements = seg.filter((e) => e.type === 'engagement').length
    const recallSignals = seg.filter((e) => e.type === 'recall_signal').length
    const engagementRate = impressions > 0 ? Math.round((engagements / impressions) * 1000) / 1000 : 0
    return { label: val, impressions, engagements, engagementRate, recallSignals }
  })
}

export default async function segmentsRoute(fastify) {
  fastify.get('/analytics/segments', async (request, reply) => {
    const { by = 'placement', campaignId } = request.query
    const validDimensions = ['placement', 'region', 'game', 'cohort']
    if (!validDimensions.includes(by)) {
      reply.code(400)
      return { error: `by must be one of: ${validDimensions.join(', ')}` }
    }

    const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    let events = store.events.filter((e) => {
      const t = new Date(e.timestamp).getTime()
      return t >= nowMs - sevenDays && t < nowMs
    })
    if (campaignId) events = events.filter((e) => e.campaignId === campaignId)

    let segments
    switch (by) {
      case 'placement':
        segments = segmentEvents(events, 'placementType', PLACEMENT_TYPES)
        break
      case 'region':
        segments = segmentEvents(events, 'region', REGIONS)
        break
      case 'cohort':
        segments = segmentEvents(events, 'cohort', COHORTS)
        break
      case 'game':
        segments = segmentEvents(events, 'gameTitle', GAME_TITLES)
        break
    }

    return { segments, dimension: by }
  })
}
