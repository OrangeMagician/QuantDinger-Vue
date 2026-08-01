<template>
  <section class="signal-factor-selector">
    <div class="selector-head">
      <div>
        <h3>{{ $t('czsc.signalFactorSelector') }}</h3>
        <p>{{ $t('czsc.signalFactorSelectorDesc') }}</p>
      </div>
      <div class="selector-tools">
        <a-input-search v-model="keyword" :placeholder="$t('czsc.searchSignalFactor')" allow-clear />
        <a-select :value="logic" class="logic-select" @change="updateLogic">
          <a-select-option value="and">AND</a-select-option>
          <a-select-option value="or">OR</a-select-option>
        </a-select>
      </div>
    </div>

    <a-spin :spinning="loading">
      <div class="catalog-groups">
        <section v-for="group in visibleGroups" :key="group.key" class="catalog-group">
          <header>
            <strong>{{ group.title }}</strong>
            <a-tag>{{ group.items.length }}</a-tag>
          </header>
          <div class="catalog-items">
            <article v-for="item in group.items" :key="item.uid" class="catalog-item" @click="addCondition(item)">
              <div>
                <strong>{{ itemName(item) }}</strong>
                <small>{{ item.category || item.source }}</small>
              </div>
              <a-button size="small" icon="plus" />
              <div v-if="item.presets && item.presets.length" class="preset-row" @click.stop>
                <a-tag v-for="preset in item.presets.slice(0, 3)" :key="preset.label_zh || preset.label_en" @click="addCondition(item, preset)">
                  {{ presetName(preset) }}
                </a-tag>
              </div>
            </article>
          </div>
        </section>
      </div>
    </a-spin>

    <div class="selected-region">
      <div class="selected-head">
        <strong>{{ $t('czsc.selectedConditions') }}</strong>
        <a-button size="small" icon="delete" :disabled="!localConditions.length" @click="clearConditions">{{ $t('czsc.clearConditions') }}</a-button>
      </div>
      <div v-if="localConditions.length" class="condition-list">
        <article v-for="(condition, index) in localConditions" :key="index" class="condition-row">
          <a-tag :color="conditionColor(condition)">{{ condition.source || 'feature' }}</a-tag>
          <strong>{{ conditionLabel(condition) }}</strong>
          <a-select :value="condition.operator" class="operator-select" @change="value => setCondition(index, { operator: value })">
            <a-select-option v-for="operator in operatorsFor(condition)" :key="operator" :value="operator">{{ operator }}</a-select-option>
          </a-select>
          <template v-if="isBetween(condition)">
            <a-input-number :value="betweenValue(condition, 0)" :step="numberStep(condition)" @change="value => setBetweenValue(index, 0, value)" />
            <a-input-number :value="betweenValue(condition, 1)" :step="numberStep(condition)" @change="value => setBetweenValue(index, 1, value)" />
          </template>
          <a-select v-else-if="valueOptions(condition).length" :value="condition.value" class="value-select" @change="value => setCondition(index, { value })">
            <a-select-option v-for="option in valueOptions(condition)" :key="String(option.value)" :value="option.value">
              {{ optionName(option) }}
            </a-select-option>
          </a-select>
          <a-select v-else-if="isBoolean(condition)" :value="String(Boolean(condition.value))" class="value-select" @change="value => setCondition(index, { value: value === 'true' })">
            <a-select-option value="true">{{ $t('czsc.yes') }}</a-select-option>
            <a-select-option value="false">{{ $t('czsc.no') }}</a-select-option>
          </a-select>
          <a-input-number v-else-if="isNumber(condition)" :value="Number(condition.value || 0)" :step="numberStep(condition)" @change="value => setCondition(index, { value })" />
          <a-input v-else :value="String(condition.value == null ? '' : condition.value)" @change="event => setCondition(index, { value: event.target.value })" />
          <a-button size="small" icon="close" @click="removeCondition(index)" />
        </article>
      </div>
      <a-empty v-else :description="$t('czsc.noSelectedConditions')" />
    </div>
  </section>
</template>

<script>
import { getCzscSignalFactorCatalog } from '@/api/czsc'

export default {
  name: 'SignalFactorSelector',
  props: {
    value: { type: Array, default: () => [] },
    logic: { type: String, default: 'and' }
  },
  data () {
    return {
      loading: false,
      keyword: '',
      catalog: { feature_conditions: [], enhanced_signals: [], factor_library: [], template_signals: [] },
      localConditions: []
    }
  },
  computed: {
    isChinese () {
      return String(this.$i18n.locale || '').toLowerCase().startsWith('zh')
    },
    catalogItems () {
      return [
        this.group('feature', this.$t('czsc.featureConditions'), this.catalog.feature_conditions || []),
        this.group('enhanced_signal', this.$t('czsc.enhancedSignals'), this.catalog.enhanced_signals || []),
        this.group('factor_library', this.$t('czsc.factorCatalog'), this.catalog.factor_library || []),
        this.group('template_signal', this.$t('czsc.templateSignals'), this.catalog.template_signals || [])
      ]
    },
    visibleGroups () {
      const keyword = String(this.keyword || '').trim().toLowerCase()
      return this.catalogItems
        .map(group => ({
          ...group,
          items: group.items.filter(item => !keyword || this.itemSearchText(item).includes(keyword))
        }))
        .filter(group => group.items.length)
    },
    catalogIndex () {
      const index = {}
      this.catalogItems.forEach(group => {
        group.items.forEach(item => { index[item.uid] = item })
      })
      return index
    }
  },
  watch: {
    value: {
      immediate: true,
      deep: true,
      handler (value) {
        this.localConditions = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : []
      }
    }
  },
  created () {
    this.loadCatalog()
  },
  methods: {
    async loadCatalog () {
      this.loading = true
      try {
        const response = await getCzscSignalFactorCatalog()
        this.catalog = response && response.data ? response.data : this.catalog
      } catch (error) {
        this.catalog = { feature_conditions: [], enhanced_signals: [], factor_library: [], template_signals: [] }
      } finally {
        this.loading = false
      }
    },
    group (source, title, items) {
      return {
        key: source,
        title,
        items: (items || []).map(item => ({ ...item, source, uid: this.itemUid(source, item) }))
      }
    },
    itemUid (source, item) {
      return [source, item.id || item.factor_id || item.signal_type || item.template_id, item.action || '', item.name_zh || ''].join(':')
    },
    itemName (item) {
      return this.isChinese ? (item.name_zh || item.label_zh || item.id) : (item.name_en || item.label_en || item.id)
    },
    presetName (preset) {
      return this.isChinese ? (preset.label_zh || preset.label_en) : (preset.label_en || preset.label_zh)
    },
    optionName (option) {
      return this.isChinese ? (option.label_zh || option.label_en || option.value) : (option.label_en || option.label_zh || option.value)
    },
    itemSearchText (item) {
      return [item.id, item.factor_id, item.signal_type, item.template_id, item.name_zh, item.name_en, item.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
    },
    addCondition (item, preset) {
      const base = JSON.parse(JSON.stringify(item.default_condition || {}))
      const condition = { ...base, source: item.source }
      if (preset) {
        condition.operator = preset.operator
        condition.value = preset.value
      }
      condition.label = this.itemName(item)
      this.localConditions = [...this.localConditions, condition]
      this.emitChange()
    },
    emitChange () {
      const out = JSON.parse(JSON.stringify(this.localConditions))
      this.$emit('input', out)
      this.$emit('change', out)
    },
    updateLogic (value) {
      this.$emit('update:logic', value)
    },
    setCondition (index, patch) {
      const next = [...this.localConditions]
      next[index] = { ...next[index], ...patch }
      this.localConditions = next
      this.emitChange()
    },
    setBetweenValue (index, position, value) {
      const current = this.localConditions[index] || {}
      const pair = Array.isArray(current.value) ? [...current.value] : [0, 0]
      pair[position] = value
      this.setCondition(index, { value: pair })
    },
    removeCondition (index) {
      this.localConditions = this.localConditions.filter((_, itemIndex) => itemIndex !== index)
      this.emitChange()
    },
    clearConditions () {
      this.localConditions = []
      this.emitChange()
    },
    matchingItem (condition) {
      const source = condition.source || 'feature'
      return this.catalogItems.flatMap(group => group.items).find(item => {
        if (source !== item.source) return false
        if (source === 'feature') return item.id === condition.factor
        if (source === 'enhanced_signal') return item.signal_type === condition.signal_type
        if (source === 'factor_library') return item.factor_id === condition.factor_id
        if (source === 'template_signal') return item.template_id === condition.template_id && (!condition.action || item.action === condition.action)
        return false
      })
    },
    conditionLabel (condition) {
      const item = this.matchingItem(condition)
      return condition.label || (item ? this.itemName(item) : (condition.factor || condition.factor_id || condition.signal_type || condition.template_id || condition.source))
    },
    operatorsFor (condition) {
      const item = this.matchingItem(condition)
      return (item && item.operators && item.operators.length ? item.operators : ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'between', 'truthy', 'falsy', 'exists'])
    },
    valueOptions (condition) {
      const item = this.matchingItem(condition)
      return (item && item.options) || []
    },
    isBetween (condition) {
      return condition.operator === 'between'
    },
    isBoolean (condition) {
      const item = this.matchingItem(condition)
      return (item && item.value_type === 'boolean') || ['truthy', 'falsy', 'exists', 'not_exists', 'matched'].includes(condition.operator)
    },
    isNumber (condition) {
      const item = this.matchingItem(condition)
      return item && ['number', 'score'].includes(item.value_type)
    },
    betweenValue (condition, index) {
      return Array.isArray(condition.value) ? Number(condition.value[index] || 0) : 0
    },
    numberStep (condition) {
      const item = this.matchingItem(condition)
      return item && item.value_type === 'score' ? 1 : 0.01
    },
    conditionColor (condition) {
      return { feature: 'blue', enhanced_signal: 'green', factor_library: 'purple', template_signal: 'orange' }[condition.source] || ''
    }
  }
}
</script>

<style scoped>
.signal-factor-selector { display: flex; flex-direction: column; gap: 14px; }
.selector-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(250px, 360px); align-items: start; gap: 14px; }
.selector-head > div:first-child { min-width: 0; }
.selector-head h3 { margin: 0 0 4px; font-size: 15px; }
.selector-head p { margin: 0; color: #8c8c8c; font-size: 12px; }
.selector-tools { display: grid; grid-template-columns: minmax(0, 1fr) 86px; min-width: 0; gap: 8px; align-items: start; }
.logic-select { width: 86px; }
.catalog-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.catalog-group { min-width: 0; padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.catalog-group header, .selected-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.catalog-items { display: grid; grid-template-columns: 1fr; gap: 7px; max-height: 260px; overflow: auto; }
.catalog-item { display: grid; grid-template-columns: minmax(0, 1fr) 28px; gap: 8px; align-items: start; padding: 8px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; cursor: pointer; }
.catalog-item strong, .catalog-item small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.catalog-item small { color: #8c8c8c; font-size: 10px; }
.preset-row { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 4px; }
.preset-row .ant-tag { margin-right: 0; cursor: pointer; }
.selected-region { padding: 10px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fbfbfc; }
.condition-list { display: flex; flex-direction: column; gap: 8px; }
.condition-row { display: grid; grid-template-columns: 112px minmax(160px, 1fr) 100px 120px 120px 32px; gap: 8px; align-items: center; padding: 8px; border: 1px solid #eceef1; border-radius: 7px; background: #fff; }
.condition-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.operator-select, .value-select { width: 100%; }
.theme-dark .catalog-group, .theme-dark .selected-region { border-color: #30343b; background: #1c2027; }
.theme-dark .catalog-item, .theme-dark .condition-row { border-color: #30343b; background: #171a20; }
.theme-dark .selector-head p, .theme-dark .catalog-item small { color: #c5cad3; }
@media (max-width: 900px) {
  .selector-head { grid-template-columns: 1fr; }
  .selector-tools { grid-template-columns: minmax(0, 1fr) 86px; }
  .condition-row { grid-template-columns: 1fr; }
}
@media (max-width: 420px) {
  .selector-tools { grid-template-columns: 1fr; }
  .logic-select { width: 100%; }
}
</style>
