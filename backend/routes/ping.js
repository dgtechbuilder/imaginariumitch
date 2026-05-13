export default async function pingRoute(fastify) {
  fastify.get('/ping', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))
}
