import { test, expect } from '@playwright/test'

const HOSTS = [
  'https://imagineafrica.site',
  process.env.RENDER_URL || 'https://imaginariumitch.onrender.com',
]

for (const host of HOSTS) {
  test.describe(`Sentry integration — ${host}`, () => {
    test('Sentry initializes without console errors', async ({ page }) => {
      const sentryConsoleErrors = []
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().toLowerCase().includes('sentry')) {
          sentryConsoleErrors.push(msg.text())
        }
      })

      await page.goto(host, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      await page.waitForFunction(
        () => typeof window.Sentry !== 'undefined' && typeof window.Sentry.captureMessage === 'function',
        { timeout: 15_000 }
      )

      expect(sentryConsoleErrors).toHaveLength(0)
    })

    test('dispatched ErrorEvent reaches sentry.io with 200/202', async ({ page }) => {
      const sentryResponsePromise = page.waitForResponse(
        response =>
          response.url().includes('sentry.io/api') &&
          (response.status() === 200 || response.status() === 202),
        { timeout: 30_000 }
      )

      await page.goto(host, { waitUntil: 'domcontentloaded', timeout: 30_000 })

      await page.waitForFunction(
        () => typeof window.Sentry !== 'undefined',
        { timeout: 15_000 }
      )

      await page.evaluate(() => {
        window.dispatchEvent(new ErrorEvent('error', {
          message: 'sentry-playwright-test',
          error: new Error('sentry-playwright-test'),
        }))
      })

      const response = await sentryResponsePromise
      expect([200, 202]).toContain(response.status())
      console.log(`PASS [${host}]: Sentry ingestion responded ${response.status()}`)
    })
  })
}
