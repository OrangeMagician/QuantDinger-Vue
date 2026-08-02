<template>
  <section class="graph-editor" :class="{ 'graph-editor--dark': isDark }">
    <header class="graph-editor__header">
      <div>
        <h2>{{ isZh ? '图形策略' : 'Graph strategy' }}</h2>
        <p>{{ isZh ? '将指标信号连接为可回测、可审核的策略。' : 'Connect signals into a backtestable, review-first strategy.' }}</p>
      </div>
      <div class="graph-editor__actions">
        <a-button icon="check" :loading="validating" @click="validate">{{ isZh ? '校验' : 'Validate' }}</a-button>
        <a-button icon="code" :loading="compiling" @click="compile">{{ isZh ? '编译预览' : 'Compile' }}</a-button>
        <a-button icon="bar-chart" @click="$emit('backtest')">{{ isZh ? '回测' : 'Backtest' }}</a-button>
        <a-button icon="thunderbolt" @click="$emit('live')">{{ isZh ? '创建运行' : 'Create run' }}</a-button>
        <a-button type="primary" icon="save" :loading="saving" @click="$emit('save')">{{ isZh ? '保存策略' : 'Save strategy' }}</a-button>
      </div>
    </header>

    <div class="graph-editor__toolbar">
      <a-button size="small" icon="plus" @click="addNode('subscription')">{{ isZh ? '订阅' : 'Subscription' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('signal')">{{ isZh ? '信号' : 'Signal' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('condition_group')">{{ isZh ? '条件组' : 'Condition' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('event')">{{ isZh ? '事件' : 'Event' }}</a-button>
      <a-button size="small" icon="plus" @click="addNode('action')">{{ isZh ? '动作' : 'Action' }}</a-button>
      <span class="graph-editor__status" :class="{ 'is-ok': validation && validation.valid }">
        {{ statusText }}
      </span>
    </div>

    <div class="graph-editor__body">
      <div class="graph-editor__nodes">
        <article v-for="node in local.nodes" :key="node.id" class="graph-node">
          <div class="graph-node__head">
            <span class="graph-node__type">{{ node.type }}</span>
            <strong>{{ node.id }}</strong>
            <a-button type="link" icon="delete" size="small" @click="removeNode(node.id)" />
          </div>
          <div class="graph-node__form">
            <a-input v-model="node.id" size="small" :addon-before="isZh ? 'ID' : 'ID'" @change="emitChange" />
            <a-select
              v-if="node.type === 'signal'"
              v-model="node.config.signal_id"
              size="small"
              show-search
              :placeholder="isZh ? '选择统一信号' : 'Select signal'"
              @change="emitChange"
            >
              <a-select-option v-for="item in signalOptions" :key="item.signal_id" :value="item.signal_id">
                {{ signalLabel(item) }}
              </a-select-option>
            </a-select>
            <a-input v-if="node.type === 'subscription'" v-model="node.config.market" size="small" :placeholder="isZh ? '市场，如 Crypto' : 'Market, e.g. Crypto'" @change="emitChange" />
            <a-input v-if="node.type === 'subscription'" v-model="node.config.symbol" size="small" :placeholder="isZh ? '标的，如 BTC/USDT' : 'Symbol, e.g. BTC/USDT'" @change="emitChange" />
            <a-input v-if="node.type === 'subscription'" v-model="node.config.frequency" size="small" placeholder="1d" @change="emitChange" />
            <a-select v-if="node.type === 'condition_group'" v-model="node.config.operator" size="small" @change="emitChange">
              <a-select-option value="AND">AND</a-select-option>
              <a-select-option value="OR">OR</a-select-option>
              <a-select-option value="NOT">NOT</a-select-option>
            </a-select>
            <a-select v-if="node.type === 'event'" v-model="node.config.action" size="small" @change="emitChange">
              <a-select-option v-for="item in eventActions" :key="item" :value="item">{{ item }}</a-select-option>
            </a-select>
            <a-select v-if="node.type === 'action'" v-model="node.config.kind" size="small" @change="emitChange">
              <a-select-option value="target_percent">target_percent</a-select-option>
              <a-select-option value="target_value">target_value</a-select-option>
              <a-select-option value="target_quantity">target_quantity</a-select-option>
              <a-select-option value="emit_signal">emit_signal</a-select-option>
            </a-select>
            <a-input-number v-if="node.type === 'action' && node.config.kind !== 'emit_signal'" v-model="node.config.value" size="small" :step="0.05" @change="emitChange" />
          </div>
        </article>
      </div>

      <aside class="graph-editor__side">
        <h3>{{ isZh ? '连接' : 'Connections' }}</h3>
        <div v-for="(edge, index) in local.edges" :key="`${edge.from}-${edge.to}-${index}`" class="graph-edge">
          <a-select v-model="edge.from" size="small" @change="emitChange">
            <a-select-option v-for="node in local.nodes" :key="`from-${node.id}`" :value="node.id">{{ node.id }}</a-select-option>
          </a-select>
          <span>→</span>
          <a-select v-model="edge.to" size="small" @change="emitChange">
            <a-select-option v-for="node in local.nodes" :key="`to-${node.id}`" :value="node.id">{{ node.id }}</a-select-option>
          </a-select>
          <a-button type="link" icon="delete" size="small" @click="local.edges.splice(index, 1); emitChange()" />
        </div>
        <a-button block size="small" icon="plus" @click="addEdge">{{ isZh ? '添加连接' : 'Add connection' }}</a-button>
        <h3>{{ isZh ? 'GraphSpec 预览' : 'GraphSpec preview' }}</h3>
        <a-textarea :value="prettySpec" :rows="12" readonly />
        <a-alert v-if="validationError" type="error" show-icon :message="validationError" />
        <a-alert v-if="compiled" type="success" show-icon :message="isZh ? '编译器已生成 Strategy V2 计划' : 'Strategy V2 plan compiled'" />
      </aside>
    </div>
  </section>
</template>

<script>
import { compileSignalGraph, getSignalCatalog, validateSignalGraph } from '@/api/domain'

const ACTIONS = ['open_long', 'close_long', 'open_short', 'close_short', 'reverse', 'emit_signal']

function clone (value) {
  return JSON.parse(JSON.stringify(value || {}))
}

export default {
  name: 'GraphStrategyEditor',
  props: {
    value: { type: Object, default: () => ({}) },
    isDark: { type: Boolean, default: false },
    saving: { type: Boolean, default: false }
  },
  data () {
    return {
      local: clone(this.value),
      signals: [],
      validation: null,
      validationError: '',
      compiled: null,
      validating: false,
      compiling: false,
      idSeed: 1,
      eventActions: ACTIONS
    }
  },
  computed: {
    isZh () {
      return String((this.$i18n && this.$i18n.locale) || '').toLowerCase().startsWith('zh')
    },
    signalOptions () {
      return this.signals.filter(item => item && item.signal_id)
    },
    prettySpec () {
      return JSON.stringify(this.local, null, 2)
    },
    statusText () {
      if (this.validation && this.validation.valid) return this.isZh ? '校验通过' : 'Valid'
      if (this.validationError) return this.isZh ? '需要修正' : 'Needs fixes'
      return this.isZh ? '未校验' : 'Not validated'
    }
  },
  watch: {
    value: {
      deep: true,
      handler (value) {
        this.local = clone(value)
      }
    }
  },
  mounted () {
    this.loadCatalog()
  },
  methods: {
    async loadCatalog () {
      try {
        const response = await getSignalCatalog()
        const payload = (response && response.data) || response || {}
        this.signals = Array.isArray(payload.signals) ? payload.signals : []
      } catch (_) {
        this.signals = []
      }
    },
    signalLabel (item) {
      return `${this.isZh ? (item.name_zh || item.name_en) : (item.name_en || item.name_zh)} · ${item.signal_id}`
    },
    emitChange () {
      this.validation = null
      this.validationError = ''
      this.$emit('input', clone(this.local))
      this.$emit('change', clone(this.local))
    },
    addNode (type) {
      const id = `${type}_${this.idSeed++}`
      const config = type === 'subscription'
        ? { market: 'Crypto', symbol: 'BTC/USDT', frequency: '1d' }
        : type === 'signal'
          ? { signal_id: this.signalOptions[0] ? this.signalOptions[0].signal_id : 'qd.technical.close_above_sma.v1' }
          : type === 'condition_group'
            ? { operator: 'AND' }
            : type === 'event'
              ? { action: 'open_long' }
              : { kind: 'target_percent', value: 1 }
      this.local.nodes = [...(this.local.nodes || []), { id, type, config, position: {} }]
      this.emitChange()
    },
    removeNode (id) {
      this.local.nodes = (this.local.nodes || []).filter(item => item.id !== id)
      this.local.edges = (this.local.edges || []).filter(item => item.from !== id && item.to !== id)
      this.emitChange()
    },
    addEdge () {
      const nodes = this.local.nodes || []
      if (nodes.length < 2) return
      this.local.edges = [...(this.local.edges || []), { from: nodes[nodes.length - 2].id, to: nodes[nodes.length - 1].id }]
      this.emitChange()
    },
    async validate () {
      this.validating = true
      this.validationError = ''
      try {
        const response = await validateSignalGraph({ graph: this.local })
        const data = (response && response.data) || response || {}
        this.validation = data
        if (!data.valid) {
          const errors = Array.isArray(data.errors) ? data.errors : []
          this.validationError = errors.map(item => item && (item.message || item.code)).filter(Boolean).join('; ') || (this.isZh ? '图形策略校验失败' : 'Graph validation failed')
        }
        this.$emit('validated', !!data.valid)
        return !!data.valid
      } catch (error) {
        this.validationError = error.backendMessage || error.message || (this.isZh ? '图形策略校验失败' : 'Graph validation failed')
        this.validation = { valid: false }
        this.$emit('validated', false)
        return false
      } finally {
        this.validating = false
      }
    },
    async compile () {
      this.compiling = true
      this.validationError = ''
      try {
        const response = await compileSignalGraph({ graph: this.local })
        this.compiled = (response && response.data) || response || {}
        this.$emit('compiled', clone(this.compiled))
      } catch (error) {
        this.validationError = error.backendMessage || error.message || (this.isZh ? '图形策略编译失败' : 'Graph compilation failed')
      } finally {
        this.compiling = false
      }
    }
  }
}
</script>

<style scoped>
.graph-editor { min-height: 640px; padding: 22px; background: #f6f8fb; color: #17202b; }
.graph-editor--dark { background: #141a22; color: #e9eef5; }
.graph-editor__header, .graph-editor__toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.graph-editor__header { margin-bottom: 16px; }
.graph-editor__header h2 { margin: 0 0 4px; font-size: 20px; }
.graph-editor__header p { margin: 0; color: #778392; }
.graph-editor__actions, .graph-editor__toolbar { flex-wrap: wrap; }
.graph-editor__toolbar { justify-content: flex-start; padding: 10px 0; border-top: 1px solid #dfe5ec; border-bottom: 1px solid #dfe5ec; }
.graph-editor__status { margin-left: auto; color: #8b5f00; font-size: 12px; }
.graph-editor__status.is-ok { color: #21824b; }
.graph-editor__body { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .8fr); gap: 18px; margin-top: 18px; }
.graph-editor__nodes { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 12px; align-content: start; }
.graph-node { padding: 12px; border: 1px solid #dfe5ec; border-radius: 6px; background: #fff; }
.graph-editor--dark .graph-node, .graph-editor--dark .graph-editor__side { background: #1d2530; border-color: #354252; }
.graph-node__head { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; }
.graph-node__head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.graph-node__type { padding: 2px 5px; color: #2563a6; background: #e8f1fb; border-radius: 3px; font-size: 11px; }
.graph-node__head .ant-btn { margin-left: auto; }
.graph-node__form { display: grid; gap: 7px; }
.graph-editor__side { padding: 14px; border: 1px solid #dfe5ec; border-radius: 6px; background: #fff; }
.graph-editor__side h3 { margin: 0 0 8px; font-size: 13px; }
.graph-edge { display: grid; grid-template-columns: 1fr auto 1fr auto; align-items: center; gap: 5px; margin-bottom: 7px; }
.graph-editor__side .ant-alert { margin-top: 10px; }
@media (max-width: 900px) { .graph-editor__body { grid-template-columns: 1fr; } .graph-editor__status { margin-left: 0; width: 100%; } }
</style>
