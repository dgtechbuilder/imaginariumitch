// Deterministic LCG PRNG — produces reproducible mock data on every server start
function makePrng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xFFFFFFFF
  }
}

const rng = makePrng(42)
const pick = (arr) => arr[Math.floor(rng() * arr.length)]
const between = (lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))

const CAMPAIGNS = [
  {
    id: 'cmp_001',
    name: 'ImagineAfrica Brand Launch',
    advertiser: 'Kunta Content',
    gameTitle: 'FullComposite',
    status: 'active',
    placementTypes: ['cutscene', 'environmental'],
    targetRegions: ['West Africa', 'East Africa'],
    targetCohorts: ['casual_18-24', 'mid-core_25-34'],
    budget: 12000,
    startDate: '2026-02-15',
    endDate: '2026-06-30',
  },
  {
    id: 'cmp_002',
    name: 'Savanna Cosmetics Integration',
    advertiser: 'Afrique Luxe',
    gameTitle: 'FullComposite',
    status: 'active',
    placementTypes: ['cosmetic', 'banner'],
    targetRegions: ['Southern Africa', 'West Africa'],
    targetCohorts: ['hardcore_25-34', 'casual_18-24'],
    budget: 8500,
    startDate: '2026-03-10',
    endDate: '2026-05-31',
  },
  {
    id: 'cmp_003',
    name: 'Pan-African Sports Banner Run',
    advertiser: 'Volta Athletics',
    gameTitle: 'FullComposite',
    status: 'completed',
    placementTypes: ['banner'],
    targetRegions: ['North Africa', 'East Africa'],
    targetCohorts: ['mid-core_25-34', 'hardcore_35+'],
    budget: 5000,
    startDate: '2026-01-01',
    endDate: '2026-02-28',
  },
  {
    id: 'cmp_004',
    name: 'Heritage Cutscene Campaign',
    advertiser: 'Ubuntu Media',
    gameTitle: 'FullComposite',
    status: 'completed',
    placementTypes: ['cutscene'],
    targetRegions: ['West Africa', 'Southern Africa'],
    targetCohorts: ['casual_18-24', 'casual_35+'],
    budget: 9200,
    startDate: '2026-01-15',
    endDate: '2026-03-15',
  },
  {
    id: 'cmp_005',
    name: 'Lagos Tech Environmental',
    advertiser: 'Nairobi Digital',
    gameTitle: 'FullComposite',
    status: 'paused',
    placementTypes: ['environmental'],
    targetRegions: ['West Africa'],
    targetCohorts: ['hardcore_25-34', 'mid-core_25-34'],
    budget: 6000,
    startDate: '2026-04-01',
    endDate: '2026-07-31',
  },
]

const PLACEMENT_TYPES = ['banner', 'cutscene', 'cosmetic', 'environmental']
const REGIONS = ['West Africa', 'East Africa', 'Southern Africa', 'North Africa']
const COHORTS = ['casual_18-24', 'mid-core_25-34', 'hardcore_25-34', 'hardcore_35+', 'casual_35+']
const EVENT_TYPES = ['impression', 'engagement', 'session_start', 'session_end', 'recall_signal']

// Engagement probability by placement type (higher = more engaging)
const ENGAGEMENT_RATE = { cutscene: 0.28, cosmetic: 0.22, environmental: 0.14, banner: 0.10 }
// Regional engagement skew multipliers
const REGION_SKEW = { 'West Africa': 1.2, 'East Africa': 1.0, 'Southern Africa': 0.9, 'North Africa': 0.8 }

function seedEvents() {
  const events = []
  let idCounter = 1
  const nowMs = new Date('2026-05-15T00:00:00Z').getTime()
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000

  for (const campaign of CAMPAIGNS) {
    const placements = campaign.placementTypes
    const regions = campaign.targetRegions
    const cohorts = campaign.targetCohorts

    // ~10k events per campaign spread over 90 days
    const eventCount = between(8000, 12000)

    for (let i = 0; i < eventCount; i++) {
      const offsetMs = Math.floor(rng() * ninetyDaysMs)
      const ts = new Date(nowMs - offsetMs).toISOString()
      const placement = pick(placements)
      const region = pick(regions)
      const engRate = ENGAGEMENT_RATE[placement] * REGION_SKEW[region]

      const sessionId = `sess_${campaign.id}_${between(1, 3000)}`
      const isEngagement = rng() < engRate

      events.push({
        id: `evt_${String(idCounter++).padStart(7, '0')}`,
        campaignId: campaign.id,
        type: isEngagement ? 'engagement' : 'impression',
        placementType: placement,
        region,
        cohort: pick(cohorts),
        gameTitle: campaign.gameTitle,
        sessionId,
        durationMs: isEngagement ? between(2000, 30000) : null,
        timestamp: ts,
        metadata: {
          deviceType: pick(['desktop', 'mobile', 'tablet']),
          level: between(1, 20),
          adCreativeId: `cr_${placement}_v${between(1, 4)}`,
        },
      })

      // ~5% chance of recall signal alongside impression
      if (!isEngagement && rng() < 0.05) {
        events.push({
          id: `evt_${String(idCounter++).padStart(7, '0')}`,
          campaignId: campaign.id,
          type: 'recall_signal',
          placementType: placement,
          region,
          cohort: pick(cohorts),
          gameTitle: campaign.gameTitle,
          sessionId,
          durationMs: null,
          timestamp: ts,
          metadata: { deviceType: pick(['desktop', 'mobile', 'tablet']) },
        })
      }
    }
  }

  return events
}

export const store = {
  campaigns: CAMPAIGNS,
  events: seedEvents(),
}

export const BASELINE_ENGAGEMENT_RATE = 0.18
export { PLACEMENT_TYPES, REGIONS, COHORTS }
