<template>
  <div class="strategy-center" :class="{ 'theme-dark': isDarkTheme }">
    <header class="sc-header">
      <div>
        <div class="sc-title-row">
          <h1>{{ $t('strategyCenter.console.title') }}</h1>
          <span class="system-health" :class="{ 'is-warning': loadError }">
            <i></i>{{ loadError ? $t('strategyCenter.console.systemDegraded') : $t('strategyCenter.console.systemHealthy') }}
          </span>
        </div>
        <p>{{ $t('strategyCenter.console.subtitle') }}</p>
      </div>
      <div class="sc-refresh">
        <span v-if="refreshedAt">{{ $t('systemOverview.colUpdatedAt') }} · {{ formatTime(refreshedAt) }}</span>
        <a-button v-if="activeTab === 'assets'" type="primary" icon="plus" @click="openCreateAsset">{{ $t('strategyCenter.assets.create') }}</a-button>
        <a-button v-else type="primary" icon="plus" @click="openCreateLive">{{ $t('strategyCenter.stats.createLive') }}</a-button>
        <a-button icon="reload" :loading="loading" @click="loadStrategies">{{ $t('common.refresh') }}</a-button>
      </div>
    </header>

    <a-tabs v-model="activeTab" class="strategy-tabs">
      <a-tab-pane key="assets" :tab="$t('strategyCenter.assets.tab')">
        <section class="asset-library">
          <div class="asset-library__summary">
            <div><strong>{{ assets.length }}</strong><span>{{ $t('strategyCenter.assets.total') }}</span></div>
            <p>{{ $t('strategyCenter.assets.hint') }}</p>
          </div>
          <a-table
            row-key="strategy_version_id"
            size="middle"
            :loading="assetsLoading"
            :columns="assetColumns"
            :data-source="assets"
            :pagination="{ pageSize: 12 }"
            :scroll="{ x: 900 }">
            <template slot="assetName" slot-scope="value, row">
              <div class="asset-name"><strong>{{ row.name }}</strong><span>{{ row.description || row.template_key || '-' }}</span></div>
            </template>
            <template slot="kind" slot-scope="value"><a-tag>{{ value === 'portfolio' ? $t('strategyV2.portfolio') : $t('strategyV2.cta') }}</a-tag></template>
            <template slot="engine" slot-scope="value"><a-tag :color="value === 'czsc' ? 'green' : 'blue'">{{ value === 'czsc' ? 'CZSC' : 'Native' }}</a-tag></template>
            <template slot="version" slot-scope="value, row"><span class="version-cell">v{{ row.version_no }}<small>{{ row.checksum ? row.checksum.slice(0, 8) : '-' }}</small></span></template>
            <template slot="status" slot-scope="value, row"><a-badge :status="row.published_at ? 'success' : 'default'" :text="row.published_at ? $t('strategyCenter.assets.published') : $t('strategyCenter.assets.draft')" /></template>
            <template slot="assetActions" slot-scope="value, row">
              <div class="asset-actions">
                <a-tooltip :title="$t('strategyCenter.assets.backtest')"><a-button shape="circle" icon="bar-chart" @click="openAssetBacktest(row)" /></a-tooltip>
                <a-tooltip :title="$t('strategyCenter.assets.review')"><a-button shape="circle" icon="audit" @click="openAssetReviews(row)" /></a-tooltip>
                <a-tooltip v-if="row.engine === 'native'" :title="$t('strategyCenter.assets.edit')"><a-button shape="circle" icon="code" @click="openAssetEditor(row)" /></a-tooltip>
              </div>
            </template>
          </a-table>
        </section>
      </a-tab-pane>
      <a-tab-pane key="instances" :tab="$t('strategyCenter.assets.instances')">
        <live-operations-table
          :strategies="strategies"
          :loading="loading"
          :load-error="loadError"
          :dark="isDarkTheme"
          :initial-strategy-id="initialStrategyId"
          :control-loading-id="controlLoadingId"
          @start="handleStart"
          @stop="handleStop"
          @edit="openEditLive"
          @delete="handleDelete"
          @open-workspace="openStrategyWorkspace"
        />
      </a-tab-pane>
    </a-tabs>

    <live-strategy-editor
      v-if="editorOpen"
      :visible="editorOpen"
      :mode="editorMode"
      :strategy-id="editorStrategyId"
      :initial-config="$route.query"
      @close="closeLiveEditor"
      @saved="handleEditorSaved"
    />
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { deleteStrategy, getStrategyList, startStrategy, stopStrategy } from '@/api/strategy'
import { listUnifiedStrategies, registerCzscStrategies } from '@/api/domain'
import LiveOperationsTable from './components/LiveOperationsTable.vue'
import LiveStrategyEditor from './components/LiveStrategyEditor.vue'

export default {
  name: 'StrategyCenter',
  components: { LiveOperationsTable, LiveStrategyEditor },
  data () {
    return {
      strategies: [],
      assets: [],
      assetsLoading: false,
      activeTab: String(this.$route.query.view || 'assets') === 'instances' ? 'instances' : 'assets',
      loading: false,
      loadError: false,
      refreshedAt: '',
      refreshTimer: null,
      controlLoadingId: null,
      editorOpen: false,
      editorMode: '',
      editorStrategyId: null
    }
  },
  computed: {
    ...mapState({ navTheme: state => state.app.theme }),
    isDarkTheme () {
      return this.navTheme === 'dark' || this.navTheme === 'realdark'
    },
    initialStrategyId () {
      const value = Number(this.$route.query.strategyId || 0)
      return Number.isFinite(value) ? value : 0
    },
    assetColumns () {
      return [
        { title: this.$t('strategyCenter.assets.name'), key: 'name', scopedSlots: { customRender: 'assetName' } },
        { title: this.$t('strategyCenter.assets.kind'), dataIndex: 'kind', width: 110, scopedSlots: { customRender: 'kind' } },
        { title: this.$t('strategyCenter.assets.engine'), dataIndex: 'engine', width: 110, scopedSlots: { customRender: 'engine' } },
        { title: this.$t('strategyCenter.assets.version'), key: 'version', width: 120, scopedSlots: { customRender: 'version' } },
        { title: this.$t('strategyCenter.assets.status'), key: 'status', width: 120, scopedSlots: { customRender: 'status' } },
        { title: this.$t('strategyCenter.assets.updated'), dataIndex: 'updated_at', width: 175, customRender: this.formatTime },
        { title: '', key: 'actions', width: 150, scopedSlots: { customRender: 'assetActions' } }
      ]
    }
  },
  mounted () {
    this.loadStrategies()
    this.startRefreshTimer()
    this.openEditorFromRoute()
  },
  activated () {
    this.startRefreshTimer()
  },
  deactivated () {
    this.stopRefreshTimer()
  },
  beforeDestroy () {
    this.stopRefreshTimer()
  },
  methods: {
    parseList (res) {
      if (!res || res.code !== 1 || !res.data) return []
      if (Array.isArray(res.data)) return res.data
      return []
    },
    async loadStrategies () {
      if (this.loading) return
      this.loading = true
      this.assetsLoading = true
      this.loadError = false
      try {
        await registerCzscStrategies().catch(() => null)
        const [res, assetResponse] = await Promise.all([getStrategyList(), listUnifiedStrategies()])
        if (!res || res.code !== 1) throw new Error('STRATEGY_LIST_LOAD_FAILED')
        this.strategies = this.parseList(res)
        this.assets = Array.isArray(assetResponse.data) ? assetResponse.data : []
        this.refreshedAt = new Date()
      } catch (error) {
        this.loadError = true
      } finally {
        this.loading = false
        this.assetsLoading = false
      }
    },
    openCreateAsset () {
      this.$router.push({ path: '/strategy-ide', query: { mode: 'create' } })
    },
    openAssetBacktest (asset) {
      const sourceId = asset.engine === 'czsc' ? `czsc:${asset.strategy_version_id}` : asset.id
      this.$router.push({ path: '/backtest-center', query: { sourceId } })
    },
    openAssetReviews (asset) {
      this.$router.push({
        path: '/signal-reviews',
        query: {
          strategyId: asset.id,
          strategyVersionId: asset.strategy_version_id,
          strategyName: asset.name,
          engine: asset.engine
        }
      })
    },
    openAssetEditor (asset) {
      this.$router.push({ path: '/strategy-ide', query: { sourceId: asset.id } })
    },
    async handleStart (strategy) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = await startStrategy(strategy.id)
        if (res && res.code === 1) {
          const status = String((res.data && res.data.status) || '')
          if (status === 'starting') {
            this.$message.info(this.$t('strategyV2.startQueued'))
          } else {
            this.$message.success(this.$t('trading-assistant.messages.startSuccess'))
          }
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.startFailed'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('trading-assistant.messages.startFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    async handleStop (strategy, options = {}) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const closePositions = Boolean(options && options.closePositions)
        const res = await stopStrategy(strategy.id, closePositions)
        if (res && res.code === 1) {
          this.$message.success(this.$t(closePositions
            ? 'strategyCenter.console.stopAndCloseQueued'
            : 'strategyCenter.console.pauseSuccess'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.stopFailed'))
        }
      } catch (error) {
        this.$message.error(error.backendMessage || error.message || this.$t('trading-assistant.messages.stopFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    openCreateLive () {
      this.editorMode = 'create'
      this.editorStrategyId = null
      this.editorOpen = true
    },
    openEditLive (strategy) {
      if (!strategy || !strategy.id) return
      this.editorMode = 'edit'
      this.editorStrategyId = Number(strategy.id)
      this.editorOpen = true
    },
    openEditorFromRoute () {
      const mode = String(this.$route.query.mode || '')
      if (mode === 'create') {
        this.openCreateLive()
        return
      }
      if (mode === 'edit' && this.$route.query.strategyId) {
        this.editorMode = 'edit'
        this.editorStrategyId = Number(this.$route.query.strategyId)
        this.editorOpen = true
      }
    },
    closeLiveEditor () {
      this.editorOpen = false
      this.editorMode = ''
      this.editorStrategyId = null
      this.clearEditorRouteState()
    },
    async handleEditorSaved () {
      this.closeLiveEditor()
      await this.loadStrategies()
    },
    clearEditorRouteState () {
      if (!this.$route.query.mode) return
      const query = { ...this.$route.query }
      delete query.mode
      delete query.sourceId
      delete query.strategyId
      delete query.leverage
      this.$router.replace({ path: '/strategy-center', query }).catch(() => {})
    },
    async handleDelete (strategy) {
      if (!strategy || !strategy.id || this.controlLoadingId) return
      this.controlLoadingId = strategy.id
      try {
        const res = await deleteStrategy(strategy.id)
        if (res && res.code === 1) {
          this.$message.success(this.$t('trading-assistant.messages.deleteSuccess'))
          await this.loadStrategies()
        } else {
          this.$message.error((res && res.msg) || this.$t('trading-assistant.messages.deleteFailed'))
        }
      } catch (error) {
        this.$message.error((error && (error.backendMessage || error.message)) || this.$t('trading-assistant.messages.deleteFailed'))
      } finally {
        this.controlLoadingId = null
      }
    },
    openStrategyWorkspace () {
      this.openCreateLive()
    },
    startRefreshTimer () {
      if (this.refreshTimer) return
      this.refreshTimer = window.setInterval(() => {
        if (!document.hidden) this.loadStrategies()
      }, 30000)
    },
    stopRefreshTimer () {
      if (this.refreshTimer) window.clearInterval(this.refreshTimer)
      this.refreshTimer = null
    },
    formatTime (value) {
      if (!value) return '-'
      const date = value instanceof Date ? value : new Date(value)
      return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString()
    }
  }
}
</script>

<style lang="less" scoped>
.strategy-center {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 64px);
  min-height: 0;
  overflow: hidden;
  padding: 18px 20px 24px !important;
  background: #f6f7f9;
  color: #18202c;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.strategy-center > .operations-workspace { flex: 1 1 auto; min-height: 0; }
.strategy-tabs { flex: 1 1 auto; min-height: 0; }
.strategy-tabs /deep/ .ant-tabs-content, .strategy-tabs /deep/ .ant-tabs-tabpane { height: 100%; }
.asset-library { min-height: 560px; padding: 14px; border: 1px solid #e4e8ee; border-radius: 7px; background: #fff; }
.asset-library__summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.asset-library__summary div { display: flex; align-items: baseline; gap: 7px; }
.asset-library__summary strong { color: #111827; font-size: 24px; }.asset-library__summary span, .asset-library__summary p { color: #667085; font-size: 12px; }.asset-library__summary p { margin: 0; }
.asset-name { display: flex; min-width: 180px; flex-direction: column; }.asset-name strong { color: #202938; }.asset-name span { overflow: hidden; max-width: 460px; color: #7b8492; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.version-cell { display: flex; flex-direction: column; font-weight: 600; }.version-cell small { color: #9299a5; font-family: monospace; font-weight: 400; }
.asset-actions { display: flex; gap: 7px; }
.sc-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
  h1 { margin: 0; font-size: 27px; font-weight: 700; line-height: 1.25; letter-spacing: -.02em; color: #111827; }
  p { margin: 7px 0 0; color: #667085; font-size: 14px; line-height: 1.55; }
}
.sc-title-row { display: flex; align-items: center; gap: 14px; }
.system-health {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #3f7c57;
  font-size: 13px;
  font-weight: 500;
  i { width: 7px; height: 7px; border-radius: 50%; background: #22a95a; box-shadow: 0 0 0 4px rgba(34, 169, 90, 0.12); }
  &.is-warning { color: #b06b18; i { background: #d68a24; box-shadow: 0 0 0 4px rgba(214, 138, 36, 0.12); } }
}
.sc-refresh { display: flex; align-items: center; gap: 12px; color: #667085; font-size: 13px; font-variant-numeric: tabular-nums; }
.theme-dark {
  background: #080808;
  color: #e7e9ed;
  .sc-header h1 { color: #f3f4f6; }
  .sc-header p, .sc-refresh { color: #7f8793; }
  .system-health { color: #61c885; }
  .asset-library { border-color: #2c2c2c; background: #101010; }
  .asset-library__summary strong, .asset-name strong { color: #e7e9ed; }
}
@media (max-width: 720px) {
  .strategy-center { height: auto; min-height: calc(100vh - 64px); overflow: visible; padding: 12px !important; }
  .sc-header { flex-direction: column; }
  .sc-refresh { width: 100%; justify-content: space-between; }
}
</style>
