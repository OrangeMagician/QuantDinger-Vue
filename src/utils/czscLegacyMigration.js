import { importLegacyResults } from '@/api/domain'

const MIGRATION_KEY = 'quantdinger.czsc.domain-migration.v1'
const SOURCES = [
  { key: 'quantdinger.czsc.backtests.v1', type: 'backtest', array: true },
  { key: 'quantdinger.czsc.factor-lab.v1', type: 'factor' },
  { key: 'quantdinger.czsc.quality.v1', type: 'factor_quality' },
  { key: 'quantdinger.czsc.scan.v2', type: 'screen' },
  { key: 'quantdinger.czsc.cockpit.v1', type: 'market_opportunity' },
  { key: 'quantdinger.czsc.watchlist-scan.v1', type: 'screen' },
  { key: 'quantdinger.czsc.multi-period.v1', type: 'structure' },
  { key: 'quantdinger.czsc.research-ops.v1', type: 'research' }
]

function parseValue (key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || 'null')
  } catch (error) {
    return null
  }
}

function legacyItems () {
  const items = []
  SOURCES.forEach(source => {
    const state = parseValue(source.key)
    const results = source.array
      ? (Array.isArray(state) ? state : [])
      : (state && state.result ? [state.result] : [])
    results.forEach((result, index) => {
      if (!result || typeof result !== 'object') return
      items.push({
        legacy_id: `${source.key}:${result.run_id || result.generated_at || index}`,
        result_type: source.type,
        engine: 'czsc',
        engine_version: result.czsc_version || 'legacy',
        dataset_snapshot: { version: result.dataset_version || 'legacy-browser' },
        payload: result
      })
    })
  })
  return items
}

function clearLegacyResults () {
  SOURCES.forEach(source => window.localStorage.removeItem(source.key))
}

export async function migrateLegacyCzscResults () {
  if (typeof window === 'undefined' || window.localStorage.getItem(MIGRATION_KEY)) return { count: 0 }
  const items = legacyItems()
  if (!items.length) {
    clearLegacyResults()
    window.localStorage.setItem(MIGRATION_KEY, JSON.stringify({ completedAt: new Date().toISOString(), count: 0 }))
    return { count: 0 }
  }
  let count = 0
  for (let offset = 0; offset < items.length; offset += 100) {
    const response = await importLegacyResults(items.slice(offset, offset + 100))
    if (!response || response.code !== 1) throw new Error((response && response.msg) || 'Legacy result migration failed')
    count += Number(response.data && response.data.count) || 0
  }
  clearLegacyResults()
  window.localStorage.setItem(MIGRATION_KEY, JSON.stringify({ completedAt: new Date().toISOString(), count }))
  return { count }
}
