import './instrument.js'
import * as Sentry from '@sentry/node'
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

Sentry.setupFastifyErrorHandler(fastify)

fastify.register(pingRoute)
fastify.register(leaderboardRoute)
fastify.register(scoreRoute)

fastify.get('/debug-sentry', function() {
  throw new Error('Sentry test error from Imaginarium backend')
})

const port = Number(process.env.PORT) || 3000
try {
  await fastify.listen({ port, host: '0.0.0.0' })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
