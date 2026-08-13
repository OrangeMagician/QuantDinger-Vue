import { expect, test } from '@playwright/test'

const ok = data => ({ code: 1, msg: 'success', data })

const gotoAppPage = async (page, path) => {
  await page.goto(path)
  if ((page.viewportSize()?.width || 0) > 768) return
  const closeNavigation = page.locator('.mobile-menu-close')
  await closeNavigation.waitFor({ state: 'visible', timeout: 3000 })
  await closeNavigation.click()
}

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
    } else if (url.pathname === '/api/v2/tasks/screen-e2e') {
      body = ok({ task_id: 'screen-e2e', status: 'SUCCEEDED', result: null })
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
})

test('decision pipeline is visible and usable without layout overflow', async ({ page }) => {
  await gotoAppPage(page, '/#/market-screener')
  await expect(page.locator('.screener-page')).toBeVisible()
  await expect(page.getByText('Decision pipeline')).toBeVisible()
  await expect(page.getByPlaceholder(/Describe the stocks/)).toBeVisible()
  await expect(page.getByText('Quality 99.5%')).toBeVisible()
  await expect(page.locator('.draft-state')).toBeVisible()
  await expect(page.getByText(/Ready: about 500 symbols, 2 conditions, 1d/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run screen' })).toBeEnabled()
  const viewport = page.viewportSize()
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }))
  expect(dimensions.width).toBeLessThanOrEqual(viewport.width + 1)
  expect(dimensions.height).toBeGreaterThan(viewport.height / 2)
})

test('manual symbol feedback blocks invalid runs without overflowing the viewport', async ({ page }) => {
  await gotoAppPage(page, '/#/market-screener')
  await page.getByText('Manual', { exact: true }).click()
  await page.getByPlaceholder(/Enter symbols separated/).fill('600519 invalid 002399')

  await expect(page.getByText('2 valid symbols')).toBeVisible()
  await expect(page.getByText('Remove 1 invalid symbols')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Run screen' })).toBeDisabled()
  await page.getByText('Remove 1 invalid symbols').click()
  await expect(page.getByText(/Ready: about 2 symbols, 2 conditions, 1d/)).toBeVisible()

  const viewport = page.viewportSize()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(viewport.width + 1)
})

test('indicator chart switches screener candidates in place and returns to the task', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('qd_screener_candidate_context_v1', JSON.stringify({
      version: 1,
      taskId: 'screen-e2e',
      timeframe: '1D',
      currentSymbol: '600519.SH',
      candidates: [
        { symbol: '600519.SH', name: 'Kweichow Moutai', decisionScore: 91.5, matchScore: 88 },
        { symbol: '002399.SZ', name: 'Hepalink', decisionScore: 82, matchScore: 80 }
      ],
      createdAt: new Date().toISOString()
    }))
  })
  await gotoAppPage(page, '/#/indicator-ide?market=CNStock&symbol=600519.SH&timeframe=1D&builtin=czsc&source=screener&task_id=screen-e2e')

  const review = page.locator('.screener-review-strip')
  await expect(review).toBeVisible()
  await expect(review.getByText('600519.SH')).toBeVisible()
  await expect(review.getByText('1 / 2')).toBeVisible()
  await review.getByRole('button', { name: 'Next candidate' }).click()
  await expect(review.getByText('002399.SZ')).toBeVisible()
  await expect(review.getByText('2 / 2')).toBeVisible()
  await expect(page).toHaveURL(/symbol=002399\.SZ/)

  const viewport = page.viewportSize()
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(viewport.width + 1)

  await review.getByRole('button', { name: 'Back to screener' }).click()
  await expect(page).toHaveURL(/#\/market-screener\?task_id=screen-e2e/)
})
