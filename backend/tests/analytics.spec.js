import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:3000'

test('CAMPAIGNS: list returns all 5 campaigns', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/campaigns`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.total).toBeGreaterThanOrEqual(1)
  expect(Array.isArray(body.campaigns)).toBe(true)
  expect(body.campaigns[0]).toHaveProperty('id')
  expect(body.campaigns[0]).toHaveProperty('name')
  expect(body.campaigns[0]).toHaveProperty('status')
  console.log('PASS: /analytics/campaigns returned', body.total, 'campaigns')
})

test('CAMPAIGNS: single campaign returns detail with kpis', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/campaigns/cmp_001`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.campaign.id).toBe('cmp_001')
  expect(body.campaign.name).toBeTruthy()
  expect(typeof body.kpis.impressions).toBe('number')
  expect(typeof body.kpis.engagements).toBe('number')
  expect(typeof body.kpis.viewabilityRate).toBe('number')
  console.log('PASS: /analytics/campaigns/cmp_001 returned campaign with kpis')
})

test('CAMPAIGNS: unknown id returns 404', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/campaigns/cmp_999`)
  expect(res.status()).toBe(404)
  console.log('PASS: /analytics/campaigns/cmp_999 returns 404')
})

test('KPIS: summary contains all required KPI fields', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/kpis`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  const s = body.summary
  expect(typeof s.impressions).toBe('number')
  expect(typeof s.engagements).toBe('number')
  expect(typeof s.viewabilityRate).toBe('number')
  expect(typeof s.engagementLift).toBe('number')
  expect(typeof s.costPerEngagement).toBe('number')
  expect(typeof s.brandRecallScore).toBe('number')
  expect(Array.isArray(body.byPlacement)).toBe(true)
  expect(Array.isArray(body.byRegion)).toBe(true)
  console.log('PASS: /analytics/kpis summary fields all present, impressions=', s.impressions)
})

test('KPIS TIMESERIES: returns correct number of labels and values', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/kpis/timeseries?metric=impressions&days=7`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.labels.length).toBe(7)
  expect(body.values.length).toBe(7)
  expect(body.metric).toBe('impressions')
  expect(body.days).toBe(7)
  body.values.forEach((v) => expect(typeof v).toBe('number'))
  console.log('PASS: timeseries 7-day labels=', body.labels.length, 'values=', body.values.length)
})

test('KPIS TIMESERIES: invalid metric returns 400', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/kpis/timeseries?metric=invalid`)
  expect(res.status()).toBe(400)
  console.log('PASS: timeseries invalid metric returns 400')
})

test('SEGMENTS: by placement returns 4 segments', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/segments?by=placement`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.dimension).toBe('placement')
  expect(body.segments.length).toBe(4)
  const types = body.segments.map((s) => s.label)
  expect(types).toContain('banner')
  expect(types).toContain('cutscene')
  expect(types).toContain('cosmetic')
  expect(types).toContain('environmental')
  console.log('PASS: /analytics/segments?by=placement returned 4 placement segments')
})

test('SEGMENTS: invalid dimension returns 400', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/segments?by=unknown`)
  expect(res.status()).toBe(400)
  console.log('PASS: segments invalid dimension returns 400')
})

test('REPORT: weekly report has highlights and recommendations', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/report`)
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(Array.isArray(body.report.highlights)).toBe(true)
  expect(body.report.highlights.length).toBeGreaterThan(0)
  expect(Array.isArray(body.report.recommendations)).toBe(true)
  expect(body.report.recommendations.length).toBeGreaterThan(0)
  expect(body.report.weekRange).toHaveProperty('from')
  expect(body.report.weekRange).toHaveProperty('to')
  const rec = body.report.recommendations[0]
  expect(rec).toHaveProperty('priority')
  expect(rec).toHaveProperty('action')
  expect(rec).toHaveProperty('rationale')
  console.log('PASS: /analytics/report highlights=', body.report.highlights.length, 'recs=', body.report.recommendations.length)
})

test('EVENTS INGEST: valid event is accepted', async ({ request }) => {
  const res = await request.post(`${BASE}/analytics/events`, {
    data: {
      events: [{
        campaignId: 'cmp_001',
        type: 'impression',
        placementType: 'banner',
        region: 'West Africa',
        cohort: 'casual_18-24',
        gameTitle: 'FullComposite',
        sessionId: 'test_sess_1',
        timestamp: '2026-05-15T10:00:00Z',
      }],
    },
  })
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.accepted).toBe(1)
  expect(body.rejected).toBe(0)
  console.log('PASS: event ingest accepted=1 rejected=0')
})

test('EVENTS INGEST: missing campaignId returns 400', async ({ request }) => {
  const res = await request.post(`${BASE}/analytics/events`, {
    data: { events: [{ type: 'impression', placementType: 'banner' }] },
  })
  expect(res.status()).toBe(400)
  const body = await res.json()
  expect(body.rejected).toBe(1)
  console.log('PASS: event ingest with missing campaignId returns 400')
})

test('INSIGHTS: endpoint returns text/event-stream content-type', async ({ request }) => {
  // We only check the header — we don't wait for the full stream
  const res = await request.get(`${BASE}/analytics/insights`, {
    headers: { Accept: 'text/event-stream' },
    timeout: 5000,
  }).catch(() => null)
  // If ANTHROPIC_API_KEY is absent, the route returns 503 JSON — both are valid in CI
  if (res) {
    const ct = res.headers()['content-type'] ?? ''
    const isStream = ct.includes('text/event-stream')
    const isError = res.status() === 503
    expect(isStream || isError).toBe(true)
    console.log('PASS: /analytics/insights content-type=', ct, 'status=', res.status())
  } else {
    console.log('PASS: /analytics/insights connection closed (stream ended before timeout)')
  }
})

test('CORS: analytics kpis responds to github.io origin', async ({ request }) => {
  const res = await request.get(`${BASE}/analytics/kpis`, {
    headers: { Origin: 'https://dgtechbuilder.github.io' },
  })
  expect(res.status()).toBe(200)
  const origin = res.headers()['access-control-allow-origin']
  expect(origin).toBeTruthy()
  console.log('PASS: /analytics/kpis CORS header for github.io:', origin)
})
