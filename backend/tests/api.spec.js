import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test('PING: returns 200 OK with status=ok', async ({ request }) => {
  const res = await request.get(`${BASE}/ping`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.status).toBe('ok')
  expect(typeof body.timestamp).toBe('string')
  console.log('PASS: /ping returned 200 with status=ok')
})

test('LEADERBOARD: returns valid JSON array', async ({ request }) => {
  const res = await request.get(`${BASE}/leaderboard`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.leaderboard)).toBe(true)
  expect(body.leaderboard.length).toBeGreaterThan(0)
  expect(typeof body.total).toBe('number')
  console.log('PASS: /leaderboard returned valid JSON with', body.leaderboard.length, 'entries')
})

test('NO AUTH: endpoints return 200 without Authorization header', async ({ request }) => {
  const ping = await request.get(`${BASE}/ping`)
  const lb = await request.get(`${BASE}/leaderboard`)
  expect(ping.status()).not.toBe(401)
  expect(ping.status()).not.toBe(403)
  expect(lb.status()).not.toBe(401)
  expect(lb.status()).not.toBe(403)
  console.log('PASS: No auth headers required — /ping and /leaderboard accessible without Authorization')
})

test('CORS: response includes access-control-allow-origin header', async ({ request }) => {
  const res = await request.get(`${BASE}/ping`, {
    headers: { Origin: 'https://dgtechbuilder.github.io' },
  })
  const origin = res.headers()['access-control-allow-origin']
  expect(origin).toBeTruthy()
  console.log('PASS: CORS header present:', origin)
})
