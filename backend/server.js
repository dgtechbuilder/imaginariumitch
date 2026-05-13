import Fastify from 'fastify'
import cors from '@fastify/cors'
import pingRoute from './routes/ping.js'
import leaderboardRoute from './routes/leaderboard.js'
import scoreRoute from './routes/score.js'

const fastify = Fastify({ logger: true })

await fastify.register(cors, {
  origin: [
    /\.github\.io$/,
    'https://imagineafrica.site',
    'http://localhost:3000',
    'http://localhost:8080',
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
})

fastify.register(pingRoute)
fastify.register(leaderboardRoute)
fastify.register(scoreRoute)

const port = Number(process.env.PORT) || 3000
try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
