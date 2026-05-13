export default async function scoreRoute(fastify) {
  fastify.post('/score', async (request, reply) => {
    const { player, score } = request.body ?? {}
    if (!player || score == null) {
      return reply.status(400).send({ error: 'Missing player or score' })
    }
    return {
      success: true,
      player,
      score,
      rank: Math.floor(Math.random() * 10) + 1,
    }
  })
}
