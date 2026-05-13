const mockLeaderboard = [
  { rank: 1, player: 'AcePlayer',  score: 9800 },
  { rank: 2, player: 'StarGazer',  score: 8750 },
  { rank: 3, player: 'NightOwl',   score: 7600 },
  { rank: 4, player: 'SwiftFox',   score: 6500 },
  { rank: 5, player: 'CosmicRay',  score: 5400 },
  { rank: 6, player: 'DawnRider',  score: 4300 },
  { rank: 7, player: 'IronWolf',   score: 3200 },
  { rank: 8, player: 'LunaStrike', score: 2100 },
  { rank: 9, player: 'EchoBlast',  score: 1050 },
  { rank: 10, player: 'NewPlayer', score: 500  },
]

export default async function leaderboardRoute(fastify) {
  fastify.get('/leaderboard', async (request, reply) => {
    reply.header('Cache-Control', 'public, max-age=10')
    return { leaderboard: mockLeaderboard, total: mockLeaderboard.length }
  })
}
