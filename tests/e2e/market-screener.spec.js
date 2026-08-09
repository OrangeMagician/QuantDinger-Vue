import { expect, test } from '@playwright/test'

const ok = data => ({ code: 1, msg: 'success', data })

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error(`pageerror: ${error.message}`))
  page.on('console', message => { if (message.type() === 'error') console.error(`console: ${message.text()}`) })
  await page.addInitScript(() => {
    localStorage.setItem('Access-Token', JSON.stringify('e2e-token'))
  })
  await page.route('**/*', async route => {
    const url = new URL(route.request().url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    let body = ok([])
    if (url.pathname === '/api/auth/info') {
      body = ok({
        id: 1,
        username: 'e2e',
        nickname: 'E2E',
        role: { id: 'admin', permissions: ['dashboard'] },
        is_demo: false,
        must_change_initial_password: false
      })
    } else if (url.pathname === '/api/v2/factors/catalog') {
      body = ok({
        feature_conditions: [
          { id: 'czsc_direction', name_en: 'Trend direction', name_zh: '趋势方向', operators: ['eq'], options: [{ value: 'up', label_en: 'Up', label_zh: '向上' }], default_condition: { factor: 'czsc_direction', source: 'feature', operator: 'eq', value: 'up' } },
          { id: 'ma_state', name_en: 'MA state', name_zh: '均线状态', operators: ['truthy'], default_condition: { factor: 'ma_state', source: 'feature', operator: 'truthy', value: true } }
        ],
        enhanced_signals: [],
factor_library: [],
template_signals: [],
operators: ['eq', 'truthy']
      })
    } else if (url.pathname === '/api/v2/stock-pools/options') {
      body = ok({ classifications: [{ value: 'Tech', label: 'Technology', group: 'industry' }], limits: { max_pool_limit: 6000 }, snapshot: { symbols: 5528, refreshed_at: '2026-08-09T05:40:20Z' } })
    } else if (url.pathname === '/api/v2/screens/history') {
      body = ok({ items: [] })
    } else if (url.pathname === '/api/v2/screens/data-quality') {
      body = ok({ quality_score: 99.5, latest: { symbols: 5528, errors: 29 } })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('decision pipeline is visible and usable without layout overflow', async ({ page }) => {
  await page.goto('/#/market-screener')
  await expect(page.locator('.screener-page')).toBeVisible()
  await expect(page.getByText('Decision pipeline')).toBeVisible()
  await expect(page.getByPlaceholder(/Describe the stocks/)).toBeVisible()
  await expect(page.getByText('Quality 99.5%')).toBeVisible()
  const viewport = page.viewportSize()
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
  expect(dimensions.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(dimensions.height).toBeGreaterThan(viewport.height / 2)
})
