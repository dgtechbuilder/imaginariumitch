import { store } from '../../data/store.js'

let idCounter = store.events.length + 1

const VALID_TYPES = ['impression', 'engagement', 'session_start', 'session_end', 'recall_signal']
const VALID_PLACEMENTS = ['banner', 'cutscene', 'cosmetic', 'environmental']

function validateEvent(e) {
  if (!e.campaignId) return 'campaignId is required'
  if (!e.type || !VALID_TYPES.includes(e.type)) return `type must be one of: ${VALID_TYPES.join(', ')}`
  if (!e.placementType || !VALID_PLACEMENTS.includes(e.placementType)) return `placementType must be one of: ${VALID_PLACEMENTS.join(', ')}`
  if (!e.region) return 'region is required'
  if (!e.cohort) return 'cohort is required'
  if (!e.gameTitle) return 'gameTitle is required'
  if (!e.timestamp) return 'timestamp is required'
  return null
}

export default async function eventsRoute(fastify) {
  fastify.post('/analytics/events', async (request, reply) => {
    const { events } = request.body ?? {}
    if (!Array.isArray(events) || events.length === 0) {
      reply.code(400)
      return { error: 'body.events must be a non-empty array' }
    }

    let accepted = 0
    let rejected = 0
    const errors = []

    for (const e of events) {
      const err = validateEvent(e)
      if (err) {
        rejected++
        errors.push(err)
        continue
      }
      store.events.push({
        id: `evt_${String(idCounter++).padStart(7, '0')}`,
        campaignId: e.campaignId,
        type: e.type,
        placementType: e.placementType,
        region: e.region,
        cohort: e.cohort,
        gameTitle: e.gameTitle,
        sessionId: e.sessionId ?? null,
        durationMs: e.durationMs ?? null,
        timestamp: e.timestamp,
        metadata: e.metadata ?? {},
      })
      accepted++
    }

    if (accepted === 0) {
      reply.code(400)
    }
    return { accepted, rejected, errors: errors.length > 0 ? errors : undefined }
  })

  fastify.get('/analytics/events', async (request) => {
    const { campaignId, type, from, to, limit = '100' } = request.query
    let events = store.events

    if (campaignId) events = events.filter((e) => e.campaignId === campaignId)
    if (type) events = events.filter((e) => e.type === type)
    if (from) {
      const fromMs = new Date(from).getTime()
      events = events.filter((e) => new Date(e.timestamp).getTime() >= fromMs)
    }
    if (to) {
      const toMs = new Date(to).getTime()
      events = events.filter((e) => new Date(e.timestamp).getTime() <= toMs)
    }

    const total = events.length
    const limitN = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100))
    return { events: events.slice(-limitN), total }
  })
}
