import { store } from '../../data/store.js'
import { computeKPIs } from './kpis.js'

export default async function campaignsRoute(fastify) {
  fastify.get('/analytics/campaigns', async (request) => {
    const { status } = request.query
    const campaigns = status
      ? store.campaigns.filter((c) => c.status === status)
      : store.campaigns
    return { campaigns, total: campaigns.length }
  })

  fastify.get('/analytics/campaigns/:id', async (request, reply) => {
    const campaign = store.campaigns.find((c) => c.id === request.params.id)
    if (!campaign) {
      reply.code(404)
      return { error: 'Campaign not found' }
    }
    const kpis = computeKPIs(request.params.id)
    return { campaign, kpis }
  })
}
