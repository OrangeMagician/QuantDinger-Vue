<template>
  <div class="screener-page" :class="{ 'screener-page--dark': isDarkTheme }">
    <header class="screener-header">
      <div>
        <h1>{{ $t('marketScreener.title') }}</h1>
        <p>{{ $t('marketScreener.subtitle') }}</p>
      </div>
      <div class="header-actions">
        <span class="draft-state" :class="{ 'draft-state--dirty': draftDirty }">
          <a-icon :type="draftDirty ? 'edit' : 'check-circle'" />
          {{ draftStateText }}
        </span>
        <a-select v-model="activePlanKey" allow-clear :placeholder="$t('marketScreener.planSelect')" @change="loadPlan">
          <a-select-option v-for="plan in plans" :key="plan.plan_key" :value="plan.plan_key">{{ plan.name }}</a-select-option>
        </a-select>
        <a-tooltip :title="$t('marketScreener.savePlan')"><a-button icon="save" @click="openSavePlan" /></a-tooltip>
        <a-tooltip :title="$t('marketScreener.history')"><a-button icon="history" @click="historyVisible = true" /></a-tooltip>
        <a-tooltip :title="$t('marketScreener.resetConfiguration')"><a-button icon="undo" @click="confirmResetConfiguration" /></a-tooltip>
        <router-link to="/tasks"><a-button icon="profile">{{ $t('menu.dashboard.taskCenter') }}</a-button></router-link>
        <a-tooltip :title="$t('marketScreener.refresh')"><a-button icon="reload" :loading="loadingCatalog" @click="loadReferenceData" /></a-tooltip>
      </div>
    </header>

    <screening-operating-workspace
      :mode="operatingMode"
      :task="task"
      :rows="displayRows"
      :conditions="conditions"
      @mode-change="operatingMode = $event"
      @apply-goal="applyGoalProfile"
      @move-condition="moveCondition"
    />

    <screening-intelligence-panel
      v-if="operatingMode === 'daily'"
      :task="task"
      :result="result"
      :plan-key="activePlanKey || ''"
      :ranking="ranking"
      :portfolio="portfolio"
      @apply-query="applyCompiledQuery"
      @update-ranking="ranking = $event"
      @update-portfolio="portfolio = $event"
    />

    <div v-if="operatingMode === 'daily'" class="screener-layout">
      <aside class="config-panel">
        <div class="section-title section-title--first"><h2>{{ $t('marketScreener.universe') }}</h2></div>
        <a-radio-group v-model="universeMode" button-style="solid" size="small">
          <a-radio-button value="pool">{{ $t('marketScreener.stockPool') }}</a-radio-button>
          <a-radio-button value="watchlist">{{ $t('marketScreener.watchlist') }}</a-radio-button>
          <a-radio-button value="manual">{{ $t('marketScreener.manual') }}</a-radio-button>
        </a-radio-group>

        <a-alert v-if="universeMode === 'watchlist' && !watchlistSymbols.length" class="config-alert" type="warning" show-icon :message="$t('marketScreener.emptyWatchlist')" />
        <template v-if="universeMode === 'manual'">
          <a-textarea v-model="manualSymbols" class="manual-symbols" :rows="4" :placeholder="$t('marketScreener.symbolPlaceholder')" />
          <div class="manual-symbol-status">
            <span><a-icon type="check-circle" /> {{ $t('marketScreener.validSymbols', { count: manualSymbolList.length }) }}</span>
            <a-tooltip v-if="manualInvalidSymbols.length" :title="manualInvalidSymbols.join(', ')">
              <a-button type="link" size="small" icon="warning" @click="removeInvalidManualSymbols">
                {{ $t('marketScreener.invalidSymbols', { count: manualInvalidSymbols.length }) }}
              </a-button>
            </a-tooltip>
          </div>
        </template>

        <div v-if="universeMode === 'pool'" class="pool-settings">
          <label class="wide-field"><span>{{ $t('screenIntelligence.pointInTimeUniverse') }}</span>
            <a-select v-model="pool.universe_id" allow-clear :placeholder="$t('screenIntelligence.currentMarketUniverse')" @change="clearPoolPreview">
              <a-select-option v-for="item in pointInTimeUniverses" :key="item.id" :value="item.id">{{ item.name }} · {{ item.member_count || 0 }}</a-select-option>
            </a-select>
          </label>
          <label v-if="pool.universe_id" class="wide-field"><span>{{ $t('screenIntelligence.asOfDate') }}</span><a-date-picker v-model="pool.as_of" value-format="YYYY-MM-DD" @change="clearPoolPreview" /></label>
          <label class="wide-field"><span>{{ $t('marketScreener.industries') }}</span>
            <a-select
              v-model="pool.industries"
              mode="multiple"
              allow-clear
              show-search
              :loading="loadingCatalog"
              :max-tag-count="2"
              :placeholder="$t('marketScreener.classificationPlaceholder')"
              :not-found-content="loadingCatalog ? $t('marketScreener.classificationLoading') : undefined"
              :filter-option="filterClassificationOption"
              @change="clearPoolPreview"
            >
              <a-select-opt-group v-for="group in classificationGroups" :key="group.key" :label="group.label">
                <a-select-option v-for="item in group.items" :key="item.value" :value="item.value" :title="classificationSearchText(item)">{{ item.label }}</a-select-option>
              </a-select-opt-group>
            </a-select>
          </label>
          <label><span>{{ $t('marketScreener.exchanges') }}</span>
            <a-select v-model="pool.exchanges" mode="multiple" allow-clear @change="clearPoolPreview">
              <a-select-option value="SH">{{ $t('marketScreener.exchangeSh') }}</a-select-option>
              <a-select-option value="SZ">{{ $t('marketScreener.exchangeSz') }}</a-select-option>
              <a-select-option value="BJ">{{ $t('marketScreener.exchangeBj') }}</a-select-option>
            </a-select>
          </label>
          <label><span>{{ $t('marketScreener.poolLimit') }}</span><a-input-number v-model="pool.pool_limit" :min="1" :max="poolMax" :step="100" @change="clearPoolPreview" /></label>
          <label><span>{{ $t('marketScreener.excludeRecent') }}</span><a-input-number v-model="pool.exclude_recent_days" :min="0" :max="3650" @change="clearPoolPreview" /></label>
          <label class="range-setting"><span>{{ $t('marketScreener.priceRange') }}</span><div><a-input-number v-model="pool.price_min" :min="0" @change="clearPoolPreview" /><i>-</i><a-input-number v-model="pool.price_max" :min="0" @change="clearPoolPreview" /></div></label>
          <label class="range-setting"><span>{{ $t('marketScreener.marketCapRange') }}</span><div><a-input-number v-model="marketCapMinYi" :min="0" @change="setMarketCap" /><i>-</i><a-input-number v-model="marketCapMaxYi" :min="0" @change="setMarketCap" /></div></label>
          <label class="range-setting"><span>{{ $t('marketScreener.peRange') }}</span><div><a-input-number v-model="pool.pe_min" @change="clearPoolPreview" /><i>-</i><a-input-number v-model="pool.pe_max" @change="clearPoolPreview" /></div></label>
          <label class="pool-check"><a-checkbox v-model="pool.exclude_st" @change="clearPoolPreview" />{{ $t('marketScreener.excludeSt') }}</label>
          <a-button class="wide-field" icon="database" :loading="previewingPool" @click="previewPool">{{ $t('marketScreener.previewPool') }}</a-button>
          <a-alert v-if="poolPreview" class="wide-field pool-preview" type="info" show-icon :message="poolPreviewText" />
          <div v-if="snapshotStatus.refreshed_at" class="wide-field snapshot-status"><a-icon type="clock-circle" /> {{ $t('marketScreener.snapshotStatus', { count: snapshotStatus.symbols || 0, time: formatDate(snapshotStatus.refreshed_at) }) }}</div>
        </div>

        <div class="section-title">
          <h2>{{ $t('marketScreener.conditions') }}</h2>
          <a-dropdown :trigger="['click']">
            <a-button type="link" icon="thunderbolt">{{ $t('marketScreener.templates') }}</a-button>
            <a-menu slot="overlay" @click="applyBuiltinTemplate">
              <a-menu-item v-for="template in builtinTemplates" :key="template.key">{{ template.label }}</a-menu-item>
            </a-menu>
          </a-dropdown>
          <a-button type="link" icon="plus" :disabled="conditions.length >= 12" @click="addCondition">{{ $t('marketScreener.addCondition') }}</a-button>
        </div>

        <div
          v-for="(condition, index) in conditions"
          :key="condition.key"
          :ref="`condition-${index}`"
          class="condition-row"
          :class="{ 'condition-row--invalid': !conditionComplete(condition) }"
        >
          <div class="condition-topline">
            <a-radio-group v-model="condition.mode" size="small" button-style="solid">
              <a-radio-button value="must">{{ $t('marketScreener.modeMust') }}</a-radio-button>
              <a-radio-button value="should">{{ $t('marketScreener.modeShould') }}</a-radio-button>
              <a-radio-button value="exclude">{{ $t('marketScreener.modeExclude') }}</a-radio-button>
            </a-radio-group>
            <div class="condition-row-actions">
              <a-tooltip :title="$t('marketScreener.duplicateCondition')"><a-button shape="circle" icon="copy" size="small" :disabled="conditions.length >= 12" @click="duplicateCondition(index)" /></a-tooltip>
              <a-tooltip :title="$t('marketScreener.removeCondition')"><a-button class="condition-delete" shape="circle" icon="delete" size="small" @click="removeCondition(index)" /></a-tooltip>
            </div>
          </div>
          <label class="condition-field condition-field--type"><span>{{ $t('marketScreener.conditionType') }}</span>
            <a-select v-model="condition.catalogKey" show-search option-filter-prop="children" @change="value => chooseCondition(index, value)">
              <a-select-opt-group v-for="group in catalogGroups" :key="group.key" :label="group.label">
                <a-select-option v-for="item in group.items" :key="item.key" :value="item.key" :title="item.label">{{ item.label }}</a-select-option>
              </a-select-opt-group>
            </a-select>
          </label>
          <p v-if="condition.explanation" class="condition-help">{{ condition.explanation }}</p>
          <div v-if="condition.presets && condition.presets.length" class="condition-presets">
            <a-tag v-for="(preset, presetIndex) in condition.presets" :key="presetIndex" @click="applyConditionPreset(index, preset)">{{ presetLabel(preset) }}</a-tag>
          </div>
          <div class="condition-controls" :class="{ 'condition-controls--compact': !condition.needsValue }">
            <label class="condition-field"><span>{{ $t('marketScreener.operator') }}</span>
              <a-select v-model="condition.operator" @change="value => chooseOperator(index, value)"><a-select-option v-for="operator in condition.operators" :key="operator" :value="operator">{{ operatorLabel(operator) }}</a-select-option></a-select>
            </label>
            <label v-if="condition.needsValue" class="condition-field condition-field--value"><span>{{ valueFieldLabel(condition) }}</span>
              <a-select v-if="condition.valueType === 'enum'" v-model="condition.value"><a-select-option v-for="option in condition.options" :key="String(option.value)" :value="option.value">{{ conditionOptionLabel(option) }}</a-select-option></a-select>
              <div v-else-if="condition.operator === 'between'" class="range-inputs"><a-input-number :value="condition.value[0]" :step="conditionValueStep(condition)" @change="value => setRangeValue(index, 0, value)" /><span>-</span><a-input-number :value="condition.value[1]" :step="conditionValueStep(condition)" @change="value => setRangeValue(index, 1, value)" /></div>
              <a-input-number v-else-if="condition.valueType === 'number' || condition.valueType === 'score'" v-model="condition.value" :step="conditionValueStep(condition)" />
              <a-input v-else v-model="condition.value" />
            </label>
            <label class="condition-field condition-field--lookback"><span>{{ $t('marketScreener.lookback') }}</span><a-input-number v-model="condition.lookbackBars" :min="1" :max="20" /></label>
          </div>
        </div>

        <div class="run-settings">
          <label><span>{{ $t('marketScreener.logic') }}</span><a-select v-model="logic"><a-select-option value="and">{{ $t('marketScreener.logicAnd') }}</a-select-option><a-select-option value="or">{{ $t('marketScreener.logicOr') }}</a-select-option></a-select></label>
          <label><span>{{ $t('marketScreener.timeframe') }}</span><a-select v-model="timeframe"><a-select-option value="5m">{{ $t('marketScreener.timeframe5m') }}</a-select-option><a-select-option value="30m">{{ $t('marketScreener.timeframe30m') }}</a-select-option><a-select-option value="1d">{{ $t('marketScreener.timeframe1d') }}</a-select-option></a-select></label>
          <label><span>{{ $t('marketScreener.barLimit') }}</span><a-input-number v-model="limit" :min="200" :max="5000" :step="100" /></label>
        </div>
        <a-alert
          class="run-readiness"
          :type="runIssues.length ? 'warning' : 'success'"
          show-icon
          :message="runReadinessText"
        >
          <template v-if="runIssues.length" slot="action"><a-button size="small" type="link" @click="focusFirstRunIssue">{{ $t('marketScreener.fixIssue') }}</a-button></template>
        </a-alert>
        <a-button
          type="primary"
          block
          size="large"
          icon="filter"
          :loading="running"
          :disabled="runDisabled || running"
          @click="runScreen"
        >{{ $t('marketScreener.run') }}</a-button>
      </aside>

      <main class="result-panel">
        <div class="result-heading">
          <div><h2>{{ $t('marketScreener.results') }}</h2><span v-if="summary">{{ summaryText }}</span></div>
          <div class="result-actions">
            <a-tag v-if="selectedRows.length" color="blue">{{ $t('marketScreener.selectedCount', { count: selectedRows.length }) }}</a-tag>
            <a-button v-if="selectedRows.length" icon="close-circle" @click="clearSelection">{{ $t('marketScreener.clearSelection') }}</a-button>
            <a-tooltip :title="$t('marketScreener.refreshResults')"><a-button icon="reload" :loading="loadingRows" :disabled="!task" @click="loadResultRows" /></a-tooltip>
            <a-dropdown :trigger="['click']" :disabled="!displayRows.length && !selectedRows.length">
              <a-button icon="download" :loading="exportLoading">{{ $t('marketScreener.exportResults') }} <a-icon type="down" /></a-button>
              <a-menu slot="overlay" @click="handleExportMenu">
                <a-menu-item key="page">{{ $t('marketScreener.exportCurrentPage') }}</a-menu-item>
                <a-menu-item key="selected" :disabled="!selectedRows.length">{{ $t('marketScreener.exportSelected', { count: selectedRows.length }) }}</a-menu-item>
              </a-menu>
            </a-dropdown>
            <a-button icon="star" :disabled="!selectedRows.length" @click="addSelectedToWatchlist">{{ $t('marketScreener.batchWatchlist') }}</a-button>
            <a-button icon="table" :disabled="selectedRows.length < 2" @click="compareVisible = true">{{ $t('marketScreener.compareCandidates') }}</a-button>
            <a-button icon="line-chart" :disabled="!selectedRows.length && !displayRows.length" @click="openCandidateReviewQueue">{{ $t('marketScreener.reviewCharts') }}</a-button>
            <a-button icon="fund" :disabled="!task || !selectedRows.length" :loading="validating" @click="validateSelection">{{ $t('marketScreener.validate') }}</a-button>
            <a-button type="primary" icon="audit" :disabled="!task || !selectedRows.length" :loading="submittingReview" @click="submitForReview">{{ $t('marketScreener.sendReview') }}</a-button>
          </div>
        </div>

        <div v-if="running" class="running-state">
          <a-icon type="loading" />
          <strong>{{ progressLabel }}</strong>
          <a-progress :percent="progressPercent" :status="task && task.status === 'FAILED' ? 'exception' : 'active'" />
          <span v-if="task && task.progress">{{ $t('marketScreener.progressDetail', { processed: task.progress.processed || 0, total: task.progress.total || 0, matched: task.progress.matched || 0, failed: task.progress.failed || 0, cached: task.progress.cache_hits || 0 }) }}</span>
          <a-button v-if="task" icon="close" @click="cancelCurrentTask">{{ $t('marketScreener.cancel') }}</a-button>
        </div>
        <a-alert
          v-if="task && terminalFailureStatuses.includes(task.status)"
          class="task-failure-alert"
          type="error"
          show-icon
          :message="$t('marketScreener.taskFailed')"
          :description="task.error_message || task.errorMessage || $t('marketScreener.runFailed')"
        >
          <template slot="action"><a-button size="small" type="primary" :loading="retrying" @click="retryCurrentTask">{{ $t('marketScreener.retry') }}</a-button></template>
        </a-alert>

        <template v-else>
          <div v-if="task && result" class="run-summary">
            <div><b>{{ summary.requested || 0 }}</b><span>{{ $t('marketScreener.scanned') }}</span></div>
            <div><b class="score-high">{{ summary.matched || 0 }}</b><span>{{ $t('marketScreener.matched') }}</span></div>
            <div><b>{{ nearCount }}</b><span>{{ $t('marketScreener.near') }}</span></div>
            <div><b>{{ summary.failed || 0 }}</b><span>{{ $t('marketScreener.failed') }}</span></div>
            <div><b>{{ summary.cache_hits || 0 }}</b><span>{{ $t('marketScreener.cacheHits') }}</span></div>
            <div><b>{{ result.generated_at ? formatDate(result.generated_at) : '-' }}</b><span>{{ $t('marketScreener.generatedAt') }}</span></div>
          </div>

          <a-tabs v-model="resultState" size="small" @change="loadResultRows">
            <a-tab-pane key="matched" :tab="$t('marketScreener.tabMatched', { count: summary ? summary.matched || 0 : 0 })" />
            <a-tab-pane key="near" :tab="$t('marketScreener.tabNear', { count: nearCount })" />
            <a-tab-pane key="failed" :tab="$t('marketScreener.tabFailed', { count: summary ? summary.failed || 0 : 0 })" />
            <a-tab-pane key="all" :tab="$t('marketScreener.tabAll')" />
          </a-tabs>
          <div v-if="task" class="result-toolbar">
            <a-input-search
              v-model="resultQuery"
              size="small"
              allow-clear
              class="result-toolbar-search"
              :placeholder="$t('marketScreener.searchResults')"
              @change="scheduleResultReload"
              @search="applyResultFilters"
            />
            <a-select v-model="resultQuality" size="small" class="result-toolbar-select" @change="loadResultRows">
              <a-select-option value="all">{{ $t('marketScreener.qualityAll') }}</a-select-option>
              <a-select-option value="eligible">{{ $t('marketScreener.qualityEligible') }}</a-select-option>
              <a-select-option value="blocked">{{ $t('marketScreener.qualityBlocked') }}</a-select-option>
            </a-select>
            <a-select v-model="resultSortBy" size="small" class="result-toolbar-select" @change="loadResultRows">
              <a-select-option value="decision_score">{{ $t('marketScreener.sortDecision') }}</a-select-option>
              <a-select-option value="match_score">{{ $t('marketScreener.sortMatch') }}</a-select-option>
              <a-select-option value="technical_score">{{ $t('marketScreener.sortTechnical') }}</a-select-option>
              <a-select-option value="bar_time">{{ $t('marketScreener.sortLatest') }}</a-select-option>
              <a-select-option value="symbol">{{ $t('marketScreener.sortSymbol') }}</a-select-option>
            </a-select>
            <label class="result-score-filter"><span>{{ $t('marketScreener.minDecision') }}</span><a-input-number v-model="resultMinDecisionScore" size="small" :min="0" :max="100" @change="applyResultFilters" /></label>
            <label class="result-score-filter"><span>{{ $t('marketScreener.minMatch') }}</span><a-input-number v-model="resultMinMatchScore" size="small" :min="0" :max="100" @change="applyResultFilters" /></label>
            <a-button size="small" icon="sort-ascending" @click="toggleResultSortOrder">{{ resultSortOrder === 'desc' ? $t('marketScreener.sortDesc') : $t('marketScreener.sortAsc') }}</a-button>
            <a-button v-if="resultFiltersActive" size="small" icon="filter" @click="resetResultFilters">{{ $t('marketScreener.resetFilters') }}</a-button>
            <span class="result-toolbar-hint">{{ $t('marketScreener.filteredCount', { count: resultTotal }) }}</span>
          </div>
          <div v-if="selectedRows.length" class="selection-bar">
            <span><a-icon type="check-square" /> {{ $t('marketScreener.selectionPersists', { count: selectedRows.length }) }}</span>
            <a-button size="small" type="link" @click="selectCurrentPage">{{ $t('marketScreener.selectCurrentPage') }}</a-button>
            <a-button size="small" type="link" @click="selectTopCandidates">{{ $t('marketScreener.selectTopCandidates') }}</a-button>
          </div>
          <a-alert v-if="resultQualitySummary" class="quality-summary-alert" type="info" show-icon :message="resultQualitySummary" />
          <a-empty v-if="!loadingRows && !displayRows.length" :description="$t('marketScreener.noResults')" />
          <a-table
            v-else
            row-key="symbol"
            :columns="columns"
            :data-source="displayRows"
            :loading="loadingRows"
            :row-selection="rowSelection"
            :pagination="paginationConfig"
            :custom-row="resultTableRow"
            size="middle"
            @change="handleTableChange"
          >
            <template slot="symbol" slot-scope="value, row"><a @click="openDetails(row)"><strong>{{ value }}</strong><small>{{ row.name || '' }}</small></a></template>
            <template slot="matchScore" slot-scope="value"><b :class="Number(value) >= 80 ? 'score-high' : ''">{{ Number(value || 0).toFixed(0) }}%</b></template>
            <template slot="decisionScore" slot-scope="value"><b :class="Number(value) >= 75 ? 'score-high' : ''">{{ Number(value || 0).toFixed(1) }}</b></template>
            <template slot="technicalScore" slot-scope="value">{{ Number(value || 0).toFixed(1) }}</template>
            <template slot="conditionResults" slot-scope="value"><div class="condition-matrix"><a-tag v-for="(item, index) in (value || [])" :key="index" :color="conditionTagColor(item)">{{ item.label }}: {{ conditionActual(item) }}</a-tag></div></template>
            <template slot="barTime" slot-scope="value">{{ value ? formatDate(value) : '-' }}</template>
            <template slot="action" slot-scope="value, row"><a-tooltip :title="$t('marketScreener.addWatchlist')"><a-button type="link" icon="star" @click.stop="addResultToWatchlist(row)" /></a-tooltip><a-tooltip :title="$t('marketScreener.openChart')"><a-button type="link" icon="line-chart" @click.stop="openCandidateChart(row)" /></a-tooltip></template>
          </a-table>
        </template>
      </main>
    </div>

    <a-modal v-model="savePlanVisible" :title="$t('marketScreener.savePlan')" :confirm-loading="savingPlan" @ok="saveCurrentPlan"><a-input v-model="planName" :placeholder="$t('marketScreener.planName')" /></a-modal>

    <a-drawer :visible="historyVisible" :title="$t('marketScreener.history')" width="520" @close="historyVisible = false">
      <a-list :data-source="historyItems" item-layout="vertical">
        <a-list-item slot="renderItem" slot-scope="item">
          <a-list-item-meta :description="formatDate(item.created_at)"><span slot="title">{{ historyTitle(item) }}</span></a-list-item-meta>
          <small v-if="item.request && item.request.timeframe" class="history-request">{{ item.request.timeframe }} · {{ item.request.condition_count || 0 }} {{ $t('marketScreener.conditionsCount') }} · {{ item.request.symbol_count || 0 }} {{ $t('marketScreener.symbolCount') }}</small>
          <div class="history-diff"><a-tag v-for="symbol in (item.added || []).slice(0, 8)" :key="`a-${symbol}`" color="green">+ {{ symbol }}</a-tag><a-tag v-for="symbol in (item.removed || []).slice(0, 8)" :key="`r-${symbol}`" color="red">- {{ symbol }}</a-tag></div>
          <a-button type="link" @click="openHistoricalTask(item.task_id)">{{ $t('marketScreener.openRun') }}</a-button>
        </a-list-item>
      </a-list>
    </a-drawer>

    <a-modal v-model="validationVisible" :title="$t('marketScreener.validationResult')" :footer="null" width="760px">
      <a-alert
        v-if="validationResult && validationResult.generalization"
        class="generalization-alert"
        :type="validationResult.generalization.review_ready ? 'success' : 'warning'"
        show-icon
        :message="`${$t('screenIntelligence.generalization')} ${Number(validationResult.generalization.score || 0).toFixed(1)} · ${$t(validationResult.generalization.review_ready ? 'screenIntelligence.reviewReady' : 'screenIntelligence.notReviewReady')}`"
      />
      <a-table
        v-if="validationMetrics.length"
        row-key="horizon"
        :columns="validationColumns"
        :data-source="validationMetrics"
        :pagination="false"
        size="small"
      />
      <a-collapse v-if="validationResult && validationResult.research_diagnostics" class="research-diagnostics">
        <a-collapse-panel key="research" :header="$t('screenIntelligence.researchDiagnostics')">
          <div class="diagnostic-strip">
            <span><b>{{ percent((((researchDiagnostics || {}).deflated_sharpe || {}).probability)) }}</b>{{ $t('screenIntelligence.deflatedSharpeProbability') }}</span>
            <span><b>{{ ((researchDiagnostics.multiple_testing || {}).accepted || []).length }}</b>{{ $t('screenIntelligence.fdrAccepted') }}</span>
            <span><b>{{ (researchDiagnostics.clusters || []).length }}</b>{{ $t('screenIntelligence.factorClusters') }}</span>
            <span><b>{{ purgeSamples }}</b>{{ $t('screenIntelligence.purgedSamples') }}</span>
          </div>
          <div class="weight-tags"><a-tag v-for="(value, key) in (researchDiagnostics.stable_weights || {})" :key="key">{{ key }} {{ Number(value).toFixed(3) }}</a-tag></div>
        </a-collapse-panel>
      </a-collapse>
      <div v-if="validationResult" class="validation-actions">
        <a-button type="primary" icon="sliders" :loading="optimizing" @click="optimizeValidatedPortfolio">{{ $t('screenIntelligence.optimizeRisk') }}</a-button>
        <a-button icon="account-book" :disabled="!optimizationResult" :loading="startingSimulation" @click="startPortfolioSimulation">{{ $t('screenIntelligence.startSimulation') }}</a-button>
      </div>
      <template v-if="optimizationResult">
        <div class="optimization-summary">
          <span><b>{{ percent((optimizationResult.risk || {}).expected_volatility) }}</b>{{ $t('screenIntelligence.expectedVolatility') }}</span>
          <span><b>{{ percent((optimizationResult.costs || {}).turnover) }}</b>{{ $t('screenIntelligence.turnover') }}</span>
          <span><b>{{ percent((optimizationResult.costs || {}).estimated_rate) }}</b>{{ $t('screenIntelligence.estimatedCost') }}</span>
        </div>
        <a-table row-key="name" :columns="stressColumns" :data-source="optimizationResult.stress_tests || []" :pagination="false" size="small" />
      </template>
      <a-empty v-if="!validationMetrics.length" :description="$t('marketScreener.noValidationSamples')" />
    </a-modal>

    <a-drawer :visible="detailVisible" :title="detailRow ? `${detailRow.symbol} ${detailRow.name || ''}` : ''" width="560" @close="detailVisible = false">
      <template v-if="detailRow">
        <div class="detail-navigation">
          <a-button icon="left" size="small" :disabled="detailRowIndex <= 0" @click="moveDetail(-1)">{{ $t('marketScreener.previousCandidate') }}</a-button>
          <span>{{ $t('marketScreener.candidatePosition', { current: detailRowIndex + 1, total: displayRows.length }) }}</span>
          <a-button size="small" :disabled="detailRowIndex < 0 || detailRowIndex >= displayRows.length - 1" @click="moveDetail(1)">{{ $t('marketScreener.nextCandidate') }} <a-icon type="right" /></a-button>
        </div>
        <div class="detail-scores"><span>{{ $t('marketScreener.matchScore') }} <b>{{ Number(detailRow.match_score || 0).toFixed(0) }}%</b></span><span>{{ $t('marketScreener.technicalScore') }} <b>{{ Number(detailRow.technical_score || 0).toFixed(1) }}</b></span></div>
        <div class="feedback-actions">
          <a-button icon="check" @click="saveFeedback(detailRow, 'accepted')">{{ $t('screenIntelligence.feedbackAccepted') }}</a-button>
          <a-button icon="eye" @click="saveFeedback(detailRow, 'watching')">{{ $t('screenIntelligence.feedbackWatching') }}</a-button>
          <a-button icon="close" @click="saveFeedback(detailRow, 'rejected')">{{ $t('screenIntelligence.feedbackRejected') }}</a-button>
        </div>
        <a-alert :type="detailRow.error ? 'error' : detailRow.passed ? 'success' : 'warning'" show-icon :message="detailRow.error || detailRow.explanation || $t('marketScreener.noExplanation')" />
        <h3>{{ $t('marketScreener.conditionDiagnosis') }}</h3>
        <a-list :data-source="detailRow.condition_results || []" size="small"><a-list-item slot="renderItem" slot-scope="item"><a-tag :color="conditionTagColor(item)">{{ item.matched ? $t('marketScreener.yes') : $t('marketScreener.no') }}</a-tag><b>{{ item.label }}</b><span>{{ conditionActual(item) }}</span></a-list-item></a-list>
        <h3>{{ $t('screenIntelligence.candidateTimeline') }}</h3>
        <a-spin :spinning="timelineLoading">
          <a-timeline v-if="candidateTimeline.length"><a-timeline-item v-for="item in candidateTimeline" :key="`${item.kind}-${item.id || item.task_id}-${item.time}`" :color="item.color"><b>{{ item.title }}</b><p>{{ item.detail }}</p><small>{{ formatDate(item.time) }}</small></a-timeline-item></a-timeline>
          <a-empty v-else :description="$t('screenIntelligence.noTimeline')" />
        </a-spin>
        <a-button type="primary" icon="line-chart" @click="openCandidateChart(detailRow)">{{ $t('marketScreener.openChart') }}</a-button>
      </template>
    </a-drawer>

    <a-modal v-model="compareVisible" :title="$t('marketScreener.compareCandidates')" :footer="null" width="920px">
      <a-alert v-if="selectedRows.length > 4" type="info" show-icon :message="$t('marketScreener.compareLimit')" />
      <div class="candidate-comparison">
        <section v-for="row in comparisonRows" :key="row.symbol">
          <header><strong>{{ row.symbol }}</strong><small>{{ row.name || '' }}</small></header>
          <dl>
            <div><dt>{{ $t('screenIntelligence.decisionScore') }}</dt><dd>{{ Number(row.decision_score || 0).toFixed(1) }}</dd></div>
            <div><dt>{{ $t('marketScreener.matchScore') }}</dt><dd>{{ Number(row.match_score || 0).toFixed(0) }}%</dd></div>
            <div><dt>{{ $t('marketScreener.technicalScore') }}</dt><dd>{{ Number(row.technical_score || 0).toFixed(1) }}</dd></div>
          </dl>
          <div class="condition-matrix"><a-tag v-for="(item, index) in (row.condition_results || [])" :key="index" :color="conditionTagColor(item)">{{ item.label }}: {{ conditionActual(item) }}</a-tag></div>
          <a-button block size="small" icon="line-chart" @click="openCandidateChart(row)">{{ $t('marketScreener.openChart') }}</a-button>
        </section>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { mapState } from 'vuex'
import { addWatchlist, getWatchlist } from '@/api/market'
import { getUniverses } from '@/api/universe'
import ScreeningOperatingWorkspace from './ScreeningOperatingWorkspace.vue'
import ScreeningIntelligencePanel from './ScreeningIntelligencePanel.vue'
import { watchResearchTask } from '@/utils/researchTaskStream'
import { buildCandidateContext, saveCandidateContext } from '@/utils/screenerCandidateContext'
import {
  cancelTask,
  createScreen,
  createScreenPortfolioAccount,
  deleteScreenPlan,
  getFactorCatalog,
  getScreenCandidateTimeline,
  getScreenHistory,
  getScreenRows,
  getStockPoolOptions,
  getTask,
  listScreenPlans,
  optimizeScreenPortfolio,
  previewStockPool,
  saveScreenPlan,
  saveScreenFeedback,
  rebalanceScreenPortfolioAccount,
  retryTask,
  submitScreenReviewSignals,
  validateScreen
} from '@/api/domain'

export default {
  name: 'MarketScreener',
  components: { ScreeningOperatingWorkspace, ScreeningIntelligencePanel },
  data () {
    return {
      loadingCatalog: false,
      operatingMode: 'daily',
      previewingPool: false,
      running: false,
      loadingRows: false,
      validating: false,
      submittingReview: false,
      savingPlan: false,
      retrying: false,
      exportLoading: false,
      draftTimer: null,
      draftDirty: false,
      draftSavedAt: null,
      restoringTask: false,
      terminalFailureStatuses: ['FAILED', 'CANCELLED', 'TIMED_OUT'],
      pendingDraft: null,
      catalog: {},
      classifications: [],
      pointInTimeUniverses: [],
      watchlistSymbols: [],
      universeMode: 'pool',
      manualSymbols: '',
      pool: { exclude_st: true, exclude_recent_days: 60, industries: [], exchanges: [], price_min: null, price_max: null, market_cap_min: null, market_cap_max: null, pe_min: null, pe_max: null, pb_min: null, pb_max: null, pool_limit: 500, sort_by: 'sort_order', universe_id: null, as_of: null },
      marketCapMinYi: null,
      marketCapMaxYi: null,
      poolMax: 6000,
      poolPreview: null,
      snapshotStatus: {},
      ranking: { enabled: true, neutralize_industry: true, factors: [] },
      portfolio: { size: 20, max_weight: 0.1, max_industry_weight: 0.3, capital: 1000000, participation_rate: 0.1, weighting: 'score' },
      conditions: [],
      logic: 'and',
      timeframe: '1d',
      limit: 1000,
      task: null,
      result: null,
      resultState: 'matched',
      resultRows: [],
      resultTotal: 0,
      resultPage: 1,
      resultPageSize: 50,
      resultSortBy: 'decision_score',
      resultSortOrder: 'desc',
      resultQuality: 'all',
      resultQuery: '',
      resultMinDecisionScore: null,
      resultMinMatchScore: null,
      resultSearchTimer: null,
      resultLoadGeneration: 0,
      selectedRowKeys: [],
      selectedRows: [],
      selectedRowMap: {},
      plans: [],
      activePlanKey: undefined,
      planName: '',
      savePlanVisible: false,
      historyVisible: false,
      historyItems: [],
      validationVisible: false,
      validationTask: null,
      validationResult: null,
      optimizing: false,
      startingSimulation: false,
      optimizationResult: null,
      detailVisible: false,
      detailRow: null,
      compareVisible: false,
      timelineLoading: false,
      timeline: { runs: [], events: [], signals: [] },
      columns: [
        { title: this.$t('marketScreener.symbol'), dataIndex: 'symbol', width: 145, scopedSlots: { customRender: 'symbol' } },
        { title: this.$t('marketScreener.matchScore'), dataIndex: 'match_score', width: 90, scopedSlots: { customRender: 'matchScore' } },
        { title: this.$t('screenIntelligence.decisionScore'), dataIndex: 'decision_score', width: 90, scopedSlots: { customRender: 'decisionScore' } },
        { title: this.$t('marketScreener.technicalScore'), dataIndex: 'technical_score', width: 90, scopedSlots: { customRender: 'technicalScore' } },
        { title: this.$t('marketScreener.conditionDiagnosis'), dataIndex: 'condition_results', scopedSlots: { customRender: 'conditionResults' } },
        { title: this.$t('marketScreener.dataTime'), dataIndex: 'bar_time', width: 145, scopedSlots: { customRender: 'barTime' } },
        { title: '', key: 'action', width: 90, scopedSlots: { customRender: 'action' } }
      ],
      validationColumns: [
        { title: this.$t('marketScreener.horizon'), dataIndex: 'horizon' },
        { title: this.$t('marketScreener.samples'), dataIndex: 'samples' },
        { title: this.$t('marketScreener.averageReturn'), dataIndex: 'average_return' },
        { title: this.$t('marketScreener.medianReturn'), dataIndex: 'median_return' },
        { title: this.$t('marketScreener.winRate'), dataIndex: 'win_rate' },
        { title: this.$t('marketScreener.worstReturn'), dataIndex: 'worst_return' }
      ],
      stressColumns: [
        { title: this.$t('screenIntelligence.scenario'), dataIndex: 'name' },
        { title: this.$t('screenIntelligence.portfolioLoss'), dataIndex: 'portfolio_loss', customRender: value => this.percent(value) },
        { title: this.$t('screenIntelligence.liquidatableWeight'), dataIndex: 'liquidatable_weight', customRender: value => this.percent(value) },
        { title: this.$t('screenIntelligence.exitDays'), dataIndex: 'estimated_exit_days', customRender: value => value == null ? this.$t('screenIntelligence.cannotExit') : value }
      ]
    }
  },
  computed: {
    ...mapState({ theme: state => state.app.theme }),
    isDarkTheme () { return ['dark', 'realdark'].includes(this.theme) },
    isChinese () { return String(this.$i18n.locale || '').toLowerCase().startsWith('zh') },
    catalogItems () {
      const groups = [['feature_conditions', 'feature'], ['enhanced_signals', 'enhanced_signal'], ['factor_library', 'factor_library'], ['template_signals', 'template_signal']]
      return groups.flatMap(([name, source]) => (this.catalog[name] || []).map((item, index) => ({ ...item, source, key: `${source}:${item.id || item.factor_id || item.signal_type || item.template_id || index}`, label: this.catalogItemLabel(item) })))
    },
    catalogGroups () {
      const definitions = [
        ['feature', this.$t('marketScreener.groupFeature')],
        ['enhanced_signal', this.$t('marketScreener.groupSignal')],
        ['factor_library', this.$t('marketScreener.groupFactor')],
        ['template_signal', this.$t('marketScreener.groupTemplate')]
      ]
      return definitions.map(([key, label]) => ({ key, label, items: this.catalogItems.filter(item => item.source === key) })).filter(group => group.items.length)
    },
    candidateTimeline () {
      const runs = (this.timeline.runs || []).map(item => ({ kind: 'run', task_id: item.task_id, time: item.created_at, color: item.passed ? 'green' : 'gray', title: item.passed ? this.$t('screenIntelligence.selected') : this.$t('screenIntelligence.notSelected'), detail: `${this.$t('screenIntelligence.decisionScore')} ${Number(((item.row_data || {}).decision_score) || 0).toFixed(1)}${item.decision ? ` · ${item.decision}` : ''}` }))
      const events = (this.timeline.events || []).map(item => ({ kind: 'event', id: item.id, time: item.event_time, color: 'blue', title: item.title || item.event_type, detail: item.source || '' }))
      const signals = (this.timeline.signals || []).map(item => ({ kind: 'signal', id: item.signal_id, time: item.created_at, color: item.status === 'PENDING' ? 'orange' : item.status === 'APPROVED' ? 'green' : 'red', title: `${item.action} · ${item.status}`, detail: item.manual_review_required ? this.$t('screenIntelligence.manualReviewRequired') : '' }))
      return [...runs, ...events, ...signals].sort((left, right) => new Date(right.time) - new Date(left.time))
    },
    classificationGroups () {
      const groups = [{ key: 'concept', label: this.$t('marketScreener.concepts'), items: [] }, { key: 'industry', label: this.$t('marketScreener.industryGroup'), items: [] }]
      for (const item of this.classifications) (groups.find(row => row.key === item.group) || groups[1]).items.push(item)
      return groups.filter(group => group.items.length)
    },
    manualSymbolTokens () { return [...new Set(this.manualSymbols.split(/[\s,;]+/).map(item => item.trim().toUpperCase()).filter(Boolean))].slice(0, 6000) },
    manualSymbolList () { return this.manualSymbolTokens.filter(item => /^(?:(?:SH|SZ|BJ)?\d{6}|\d{6}\.(?:SH|SZ|BJ))$/.test(item)).map(this.normalizeSymbol) },
    manualInvalidSymbols () { return this.manualSymbolTokens.filter(item => !/^(?:(?:SH|SZ|BJ)?\d{6}|\d{6}\.(?:SH|SZ|BJ))$/.test(item)) },
    summary () { return this.result && this.result.summary },
    summaryText () { return this.summary ? this.$t('marketScreener.summary', { requested: this.summary.requested || 0, matched: this.summary.matched || 0 }) : '' },
    nearCount () { return this.summary ? Math.max(0, Number(this.summary.evaluated || 0) - Number(this.summary.matched || 0)) : 0 },
    resultQualitySummary () {
      const quality = (this.summary && this.summary.data_quality) || (this.result && this.result.intelligence && this.result.intelligence.data_quality)
      return quality ? this.$t('marketScreener.qualitySummary', { eligible: quality.eligible || 0, blocked: quality.blocked || 0 }) : ''
    },
    runDisabled () {
      return this.runIssues.length > 0
    },
    runIssues () {
      const issues = []
      if (this.universeMode === 'watchlist' && !this.watchlistSymbols.length) issues.push({ key: 'universe', message: this.$t('marketScreener.issueEmptyWatchlist') })
      if (this.universeMode === 'manual' && !this.manualSymbolList.length) issues.push({ key: 'universe', message: this.$t('marketScreener.issueNoValidSymbols') })
      if (this.universeMode === 'manual' && this.manualInvalidSymbols.length) issues.push({ key: 'universe', message: this.$t('marketScreener.issueInvalidSymbols', { count: this.manualInvalidSymbols.length }) })
      if (!this.conditions.length) issues.push({ key: 'conditions', message: this.$t('marketScreener.issueNoConditions') })
      const invalidIndex = this.conditions.findIndex(condition => !this.conditionComplete(condition))
      if (invalidIndex >= 0) issues.push({ key: 'condition', index: invalidIndex, message: this.$t('marketScreener.issueIncompleteCondition', { index: invalidIndex + 1 }) })
      return issues
    },
    estimatedUniverseCount () {
      if (this.universeMode === 'watchlist') return this.watchlistSymbols.length
      if (this.universeMode === 'manual') return this.manualSymbolList.length
      return Number((this.poolPreview && this.poolPreview.selected) || this.pool.pool_limit || 0)
    },
    runReadinessText () {
      return this.runIssues.length
        ? this.runIssues[0].message
        : this.$t('marketScreener.readySummary', { symbols: this.estimatedUniverseCount, conditions: this.conditions.length, timeframe: this.timeframe })
    },
    draftStateText () {
      if (this.draftDirty) return this.$t('marketScreener.draftSaving')
      if (this.draftSavedAt) return this.$t('marketScreener.draftSaved', { time: new Date(this.draftSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
      return this.$t('marketScreener.draftReady')
    },
    progressPercent () { return Number((this.task && this.task.progress && this.task.progress.percent) || 0) },
    progressLabel () { return this.task && this.task.status ? `${this.$t('marketScreener.running')} · ${this.task.status}` : this.$t('marketScreener.running') },
    poolPreviewText () { const value = this.poolPreview || {}; return this.$t('marketScreener.poolPreviewSummary', { selected: value.selected || 0, total: value.total || 0, st: value.excluded_st || 0, industry: value.excluded_industry || 0, fundamental: value.excluded_fundamental || 0, metadata: value.metadata_available || 0 }) },
    displayRows () {
      if (this.task) return this.resultRows
      const rows = (this.result && this.result.results) || []
      if (this.resultState === 'matched') return rows.filter(row => row.passed && !row.error)
      if (this.resultState === 'near') return rows.filter(row => !row.passed && !row.error)
      if (this.resultState === 'failed') return rows.filter(row => row.error)
      return rows
    },
    resultFiltersActive () { return Boolean(String(this.resultQuery || '').trim() || this.resultQuality !== 'all' || this.resultMinDecisionScore != null || this.resultMinMatchScore != null) },
    comparisonRows () { return this.selectedRows.slice(0, 4) },
    detailRowIndex () { return this.detailRow ? this.displayRows.findIndex(row => row.symbol === this.detailRow.symbol) : -1 },
    rowSelection () { return { selectedRowKeys: this.selectedRowKeys, onChange: this.handleRowSelection } },
    paginationConfig () { return { current: this.resultPage, pageSize: this.resultPageSize, total: this.resultTotal || this.displayRows.length, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'] } },
    builtinTemplates () {
      return [
        { key: 'trend', label: this.$t('marketScreener.templateTrend'), items: ['czsc_direction', 'ma_state'] },
        { key: 'breakout', label: this.$t('marketScreener.templateBreakout'), items: ['breakout_high', 'volume_expand'] },
        { key: 'reversal', label: this.$t('marketScreener.templateReversal'), items: ['macd_divergence', 'fractal_bottom'] },
        { key: 'pullback', label: this.$t('marketScreener.templatePullback'), items: ['czsc_direction', 'drawdown_pct'] }
      ]
    },
    validationMetrics () {
      const metrics = (this.validationResult && this.validationResult.metrics) || {}
      return Object.entries(metrics).map(([horizon, value]) => ({ horizon: this.$t('marketScreener.horizonBars', { count: horizon }), samples: value.samples, average_return: this.percent(value.average_return), median_return: this.percent(value.median_return), win_rate: this.percent(value.win_rate), worst_return: this.percent(value.worst_return) }))
    },
    researchDiagnostics () { return (this.validationResult && this.validationResult.research_diagnostics) || {} },
    purgeSamples () { return ((this.validationResult && this.validationResult.walk_forward) || []).reduce((sum, item) => sum + Number(item.purged_samples || 0) + Number(item.embargoed_samples || 0), 0) }
  },
  created () { this.restoreDraft(); this.loadReferenceData().then(() => this.restoreLastTask()) },
  beforeDestroy () { if (this.draftTimer) clearTimeout(this.draftTimer); if (this.resultSearchTimer) clearTimeout(this.resultSearchTimer); this.persistDraft() },
  watch: {
    universeMode: 'scheduleDraftSave',
    manualSymbols: 'scheduleDraftSave',
    logic: 'scheduleDraftSave',
    timeframe: 'scheduleDraftSave',
    limit: 'scheduleDraftSave',
    pool: { deep: true, handler: 'scheduleDraftSave' },
    conditions: { deep: true, handler: 'scheduleDraftSave' },
    ranking: { deep: true, handler: 'scheduleDraftSave' },
    portfolio: { deep: true, handler: 'scheduleDraftSave' }
  },
  methods: {
    draftStorageKey () { return 'qd_market_screener_draft_v1' },
    draftDefinition () { return { universeMode: this.universeMode, manualSymbols: this.manualSymbols, pool: { ...this.pool }, conditions: this.conditions.map(this.conditionPayload), logic: this.logic, timeframe: this.timeframe, limit: this.limit, ranking: { ...this.ranking }, portfolio: { ...this.portfolio }, savedAt: new Date().toISOString() } },
    scheduleDraftSave () { this.draftDirty = true; if (this.draftTimer) clearTimeout(this.draftTimer); this.draftTimer = setTimeout(() => this.persistDraft(), 500) },
    persistDraft () { try { const draft = this.draftDefinition(); window.localStorage.setItem(this.draftStorageKey(), JSON.stringify(draft)); this.draftSavedAt = draft.savedAt; this.draftDirty = false } catch (_) {} },
    restoreDraft () { try { const raw = window.localStorage.getItem(this.draftStorageKey()); if (raw) { this.pendingDraft = JSON.parse(raw); this.draftSavedAt = this.pendingDraft.savedAt || null } } catch (_) { this.pendingDraft = null } },
    applyPendingDraft () { if (!this.pendingDraft || !this.catalogItems.length) return; const draft = this.pendingDraft; this.pendingDraft = null; this.applyDefinition(draft); this.$message.info(this.$t('marketScreener.draftRestored')) },
    clearDraft () { try { window.localStorage.removeItem(this.draftStorageKey()) } catch (_) {} },
    confirmResetConfiguration () {
      this.$confirm({
        title: this.$t('marketScreener.resetConfiguration'),
        content: this.$t('marketScreener.resetConfigurationConfirm'),
        okText: this.$t('marketScreener.confirm'),
        cancelText: this.$t('marketScreener.cancel'),
        onOk: this.resetConfiguration
      })
    },
    resetConfiguration () {
      this.activePlanKey = undefined
      this.universeMode = 'pool'
      this.manualSymbols = ''
      this.pool = { exclude_st: true, exclude_recent_days: 60, industries: [], exchanges: [], price_min: null, price_max: null, market_cap_min: null, market_cap_max: null, pe_min: null, pe_max: null, pb_min: null, pb_max: null, pool_limit: 500, sort_by: 'sort_order', universe_id: null, as_of: null }
      this.marketCapMinYi = null
      this.marketCapMaxYi = null
      this.logic = 'and'
      this.timeframe = '1d'
      this.limit = 1000
      this.ranking = { enabled: true, neutralize_industry: true, factors: [] }
      this.portfolio = { size: 20, max_weight: 0.1, max_industry_weight: 0.3, capital: 1000000, participation_rate: 0.1, weighting: 'score' }
      this.conditions = []
      this.applyBuiltinTemplate({ key: 'trend' })
      this.clearPoolPreview()
      this.clearDraft()
      this.persistDraft()
    },
    taskStorageKey () { return 'qd_market_screener_last_task_v1' },
    persistTaskReference (task) { try { if (task && task.task_id) window.localStorage.setItem(this.taskStorageKey(), String(task.task_id)) } catch (_) {} },
    async restoreLastTask () {
      if (this.task || this.restoringTask) return
      let taskId = String((this.$route && this.$route.query && this.$route.query.task_id) || '').trim()
      if (!taskId) {
        try { taskId = window.localStorage.getItem(this.taskStorageKey()) || '' } catch (_) {}
      }
      if (!taskId) return
      this.restoringTask = true
      const generation = ++this.resultLoadGeneration
      try {
        const response = await getTask(taskId)
        if (generation !== this.resultLoadGeneration || !response || response.code !== 1) return
        this.task = response.data
        this.persistTaskReference(this.task)
        if (['PENDING', 'RUNNING'].includes(this.task.status)) {
          this.running = true
          this.task = await this.waitTask(taskId)
        }
        this.result = this.task.result && this.task.result.payload
        if (this.result) await this.loadResultRows()
      } catch (_) {
        // A deleted or expired task must not block a fresh screening run.
      } finally { this.running = false; this.restoringTask = false }
    },
    async loadReferenceData () {
      this.loadingCatalog = true
      try {
        const [catalog, options, watchlist, plans, history, universes] = await Promise.all([getFactorCatalog(), getStockPoolOptions(), getWatchlist(), listScreenPlans(), getScreenHistory({ limit: 30 }), getUniverses()])
        this.catalog = catalog.data || {}
        const optionData = options.data || {}
        const classifications = Array.isArray(optionData.classifications) ? optionData.classifications : []
        this.classifications = classifications.length ? classifications : (optionData.industries || []).map(item => ({ value: item, label: item, group: 'industry', aliases: [] }))
        this.poolMax = Number((optionData.limits && optionData.limits.max_pool_limit) || 6000)
        this.snapshotStatus = optionData.snapshot || {}
        const rows = Array.isArray(watchlist.data) ? watchlist.data : []
        this.watchlistSymbols = rows.filter(item => item.market === 'CNStock').map(item => this.normalizeSymbol(item.symbol))
        this.plans = plans.data || []
        this.historyItems = (history.data && history.data.items) || []
        this.pointInTimeUniverses = ((universes.data && universes.data.items) || universes.data || []).filter(item => ['CNStock', 'Mixed'].includes(item.market))
        this.applyPendingDraft()
        if (!this.conditions.length && this.catalogItems.length) this.applyBuiltinTemplate({ key: 'trend' })
      } catch (error) { this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.loadFailed')) } finally { this.loadingCatalog = false }
    },
    normalizeSymbol (value) { const raw = String(value || '').toUpperCase(); if (/^\d{6}\.(SH|SZ|BJ)$/.test(raw)) return raw; const code = raw.replace(/\D/g, '').slice(0, 6); if (!code) return raw; return `${code}.${code.startsWith('6') ? 'SH' : code.startsWith('8') || code.startsWith('4') || code.startsWith('9') ? 'BJ' : 'SZ'}` },
    removeInvalidManualSymbols () { this.manualSymbols = this.manualSymbolList.join('\n') },
    classificationSearchText (item) { return [item.label, ...(item.aliases || [])].filter(Boolean).join(' ') },
    filterClassificationOption (input, option) { const props = (option && option.componentOptions && option.componentOptions.propsData) || {}; return String(props.title || props.value || '').toLowerCase().includes(String(input || '').trim().toLowerCase()) },
    clearPoolPreview () { this.poolPreview = null },
    setMarketCap () { this.pool.market_cap_min = this.marketCapMinYi == null ? null : Number(this.marketCapMinYi) * 100000000; this.pool.market_cap_max = this.marketCapMaxYi == null ? null : Number(this.marketCapMaxYi) * 100000000; this.clearPoolPreview() },
    async previewPool () { this.previewingPool = true; try { const response = await previewStockPool({ ...this.pool, enabled: true }); this.poolPreview = response.data.summary || {} } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.previewingPool = false } },
    addCondition (catalogItem) { const item = catalogItem || this.catalogItems[0]; if (!item) return; this.conditions.push({ key: `${Date.now()}-${this.conditions.length}`, catalogKey: item.key, mode: 'must', lookbackBars: 1, ...this.conditionFromCatalog(item) }) },
    duplicateCondition (index) { const current = this.conditions[index]; if (!current || this.conditions.length >= 12) return; const copy = { ...current, key: `${Date.now()}-${this.conditions.length}`, value: Array.isArray(current.value) ? [...current.value] : current.value, options: [...(current.options || [])], presets: [...(current.presets || [])] }; this.conditions.splice(index + 1, 0, copy) },
    removeCondition (index) { this.conditions.splice(index, 1) },
    chooseCondition (index, key) { const item = this.catalogItems.find(row => row.key === key); if (item) this.$set(this.conditions, index, { ...this.conditions[index], catalogKey: key, ...this.conditionFromCatalog(item) }) },
    chooseOperator (index, operator) { const current = this.conditions[index]; if (!current) return; this.$set(this.conditions, index, { ...current, operator, needsValue: this.operatorNeedsValue(operator), value: operator === 'between' ? this.rangeValue(current.value) : (Array.isArray(current.value) ? current.value[0] : current.value) }) },
    conditionFromCatalog (item) { const base = { ...(item.default_condition || {}) }; const operators = item.operators || this.catalog.operators || ['eq']; const operator = base.operator || operators[0]; const options = Array.isArray(item.options) ? item.options : []; const valueType = item.value_type || (options.length ? 'enum' : this.inferValueType(base.value)); const value = operator === 'between' ? this.rangeValue(base.value) : (base.value == null ? '' : base.value); return { definition: base, operator, operators, value, valueType, options, presets: item.presets || [], explanation: (this.isChinese ? item.explanation_zh : item.explanation_en) || item.explanation_zh || item.explanation_en || '', riskTip: (this.isChinese ? item.risk_tip_zh : item.risk_tip_en) || '', needsValue: this.operatorNeedsValue(operator) } },
    conditionPayload (row) { const normalize = value => value === 'true' ? true : value === 'false' ? false : value !== '' && value !== null && Number.isFinite(Number(value)) ? Number(value) : value; return { ...row.definition, operator: row.operator, value: Array.isArray(row.value) ? row.value.map(normalize) : normalize(row.value), mode: row.mode || 'must', lookback_bars: Number(row.lookbackBars || 1), enabled: true } },
    catalogItemLabel (item) { return (this.isChinese ? item.name_zh : item.name_en) || item.name_zh || item.name_en || item.label || item.id || item.factor_id || item.signal_type },
    operatorNeedsValue (operator) { return !['truthy', 'falsy', 'exists', 'not_exists', 'matched'].includes(operator) },
    operatorLabel (operator) { const key = `marketScreener.operator.${operator}`; return this.$te(key) ? this.$t(key) : operator },
    conditionOptionLabel (option) { return (this.isChinese ? option.label_zh : option.label_en) || option.label_zh || option.label_en || option.label || option.value },
    presetLabel (preset) { return (this.isChinese ? preset.label_zh : preset.label_en) || preset.label_zh || preset.label_en || preset.label || preset.value },
    applyConditionPreset (index, preset) { const current = this.conditions[index]; this.$set(this.conditions, index, { ...current, operator: preset.operator || current.operator, value: Array.isArray(preset.value) ? [...preset.value] : preset.value, needsValue: this.operatorNeedsValue(preset.operator || current.operator) }) },
    valueFieldLabel (condition) { return condition.operator === 'between' ? this.$t('marketScreener.valueRange') : condition.valueType === 'enum' ? this.$t('marketScreener.expectedState') : this.$t('marketScreener.value') },
    inferValueType (value) { if (typeof value === 'number' || (Array.isArray(value) && value.every(item => typeof item === 'number'))) return 'number'; if (typeof value === 'boolean') return 'boolean'; return 'text' },
    rangeValue (value) { if (Array.isArray(value) && value.length === 2) return [...value]; const number = Number(value); return [Number.isFinite(number) ? number : 0, Number.isFinite(number) ? number : 0] },
    setRangeValue (conditionIndex, valueIndex, value) { const condition = this.conditions[conditionIndex]; if (!condition) return; const next = this.rangeValue(condition.value); next[valueIndex] = value; this.$set(condition, 'value', next) },
    conditionValueStep (condition) { const values = Array.isArray(condition.value) ? condition.value : [condition.value]; return values.some(value => Math.abs(Number(value)) > 0 && Math.abs(Number(value)) < 1) ? 0.01 : 1 },
    conditionComplete (condition) { if (!condition || !condition.catalogKey || !condition.operator) return false; if (!condition.needsValue) return true; if (condition.operator === 'between') return Array.isArray(condition.value) && condition.value.length === 2 && condition.value.every(value => Number.isFinite(Number(value))); return condition.value !== '' && condition.value !== null && condition.value !== undefined },
    focusFirstRunIssue () { const issue = this.runIssues[0]; if (!issue) return; if (issue.key === 'condition') { const ref = this.$refs[`condition-${issue.index}`]; const element = Array.isArray(ref) ? ref[0] : ref; if (element && element.scrollIntoView) element.scrollIntoView({ behavior: 'smooth', block: 'center' }) } else { const panel = this.$el && this.$el.querySelector('.config-panel'); if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' }) } },
    applyBuiltinTemplate ({ key }) { const template = this.builtinTemplates.find(item => item.key === key); if (!template) return; const found = template.items.map(id => this.catalogItems.find(item => item.id === id || item.factor_id === id || item.signal_type === id)).filter(Boolean); if (!found.length) return; this.conditions = []; found.forEach(item => this.addCondition(item)) },
    applyGoalProfile (goal) {
      const size = Number(goal.size || 20)
      const profiles = {
        quality: { template: 'pullback', weighting: 'score', maxWeight: 0.08 },
        value: { template: 'reversal', weighting: 'score', maxWeight: 0.08 },
        momentum: { template: 'trend', weighting: 'score', maxWeight: 0.1 },
        balanced: { template: 'trend', weighting: 'risk_parity', maxWeight: 0.08 }
      }
      const profile = profiles[goal.style] || profiles.balanced
      this.portfolio = { ...this.portfolio, size, weighting: profile.weighting, max_weight: goal.risk === 'low' ? Math.min(profile.maxWeight, 0.06) : goal.risk === 'high' ? 0.12 : profile.maxWeight }
      this.limit = goal.horizon === 'short' ? 500 : goal.horizon === 'long' ? 2000 : 1000
      this.applyBuiltinTemplate({ key: profile.template })
      this.clearPoolPreview()
    },
    moveCondition ({ from, to }) { if (to < 0 || to >= this.conditions.length) return; const next = [...this.conditions]; const moved = next.splice(from, 1)[0]; next.splice(to, 0, moved); this.conditions = next },
    planDefinition () { return { universeMode: this.universeMode, manualSymbols: this.manualSymbols, pool: { ...this.pool }, conditions: this.conditions.map(this.conditionPayload), logic: this.logic, timeframe: this.timeframe, limit: this.limit, ranking: { ...this.ranking }, portfolio: { ...this.portfolio } } },
    openSavePlan () { const current = this.plans.find(item => item.plan_key === this.activePlanKey); this.planName = current ? current.name : ''; this.savePlanVisible = true },
    async saveCurrentPlan () { this.savingPlan = true; try { const response = await saveScreenPlan({ plan_key: this.activePlanKey, name: this.planName, definition: this.planDefinition() }); this.activePlanKey = response.data.plan_key; this.savePlanVisible = false; await this.loadPlansOnly(); this.clearDraft(); this.$message.success(this.$t('marketScreener.planSaved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.savingPlan = false } },
    async loadPlansOnly () { const response = await listScreenPlans(); this.plans = response.data || [] },
    loadPlan (key) { const plan = this.plans.find(item => item.plan_key === key); if (!plan) return; this.applyDefinition(plan.definition || {}); this.clearDraft() },
    applyDefinition (value) { this.universeMode = value.universeMode || 'pool'; this.manualSymbols = value.manualSymbols || ''; this.pool = { ...this.pool, ...(value.pool || {}) }; this.logic = value.logic || 'and'; this.timeframe = value.timeframe || '1d'; this.limit = value.limit || 1000; this.ranking = { ...this.ranking, ...(value.ranking || {}) }; this.portfolio = { ...this.portfolio, ...(value.portfolio || {}) }; this.conditions = []; for (const saved of value.conditions || []) { const item = this.catalogItems.find(row => (saved.factor && (row.id === saved.factor || row.factor_id === saved.factor)) || (saved.signal_type && row.signal_type === saved.signal_type) || (saved.template_id && row.template_id === saved.template_id)); if (!item) continue; this.addCondition(item); const index = this.conditions.length - 1; this.$set(this.conditions, index, { ...this.conditions[index], operator: saved.operator || this.conditions[index].operator, value: saved.value, mode: saved.mode || 'must', lookbackBars: saved.lookback_bars || 1 }) } },
    applyCompiledQuery (compiled) { const value = compiled || {}; this.universeMode = 'pool'; this.pool = { ...this.pool, ...(value.universe || {}) }; this.ranking = { ...this.ranking, ...(value.ranking || {}) }; this.portfolio = { ...this.portfolio, ...(value.portfolio || {}) }; this.conditions = []; for (const raw of value.conditions || []) { const item = this.catalogItems.find(row => (raw.factor && (row.id === raw.factor || row.factor_id === raw.factor)) || (raw.signal_type && row.signal_type === raw.signal_type) || (raw.template_id && row.template_id === raw.template_id)); if (!item) continue; this.addCondition(item); const index = this.conditions.length - 1; this.$set(this.conditions, index, { ...this.conditions[index], operator: raw.operator || this.conditions[index].operator, value: raw.value, mode: raw.mode || 'must' }) } this.clearPoolPreview() },
    async deleteActivePlan () { if (!this.activePlanKey) return; await deleteScreenPlan(this.activePlanKey); this.activePlanKey = undefined; await this.loadPlansOnly() },
    async runScreen () {
      if (this.runDisabled || this.running) { this.focusFirstRunIssue(); return }
      this.running = true; this.result = null; this.resultRows = []; this.clearSelection(); this.resultLoadGeneration += 1
      try {
        const payload = { operation: 'signal_factor_screener', timeframe: this.timeframe, conditions: this.conditions.map(this.conditionPayload), logic: this.logic, limit: this.limit, result_limit: 100, ranking: this.ranking, portfolio: this.portfolio }
        if (this.universeMode === 'pool') payload.universe = { ...this.pool, enabled: true }
        else payload.symbols = this.universeMode === 'watchlist' ? this.watchlistSymbols : this.manualSymbolList.map(this.normalizeSymbol)
        const response = await createScreen(payload, `screen-${this.screenRequestDigest(payload)}`)
        if (!response || response.code !== 1) throw new Error(response && response.msg)
        this.task = response.data
        this.persistTaskReference(this.task)
        this.task = await this.waitTask(response.data.task_id)
        this.persistTaskReference(this.task)
        this.result = this.task.result && this.task.result.payload
        this.resultState = 'matched'; this.resultPage = 1; await this.loadResultRows(); await this.reloadHistory()
      } catch (error) { this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.runFailed')) } finally { this.running = false }
    },
    async waitTask (taskId, timeout = 3600000, trackCurrent = true) { try { const task = await watchResearchTask(taskId, value => { if (trackCurrent) this.task = value }, timeout); if (task.status === 'SUCCEEDED') return task; throw new Error(task.error_message || task.status) } catch (streamError) { const deadline = Date.now() + timeout; while (Date.now() < deadline) { const response = await getTask(taskId); if (!response || response.code !== 1) throw new Error(response && response.msg); if (trackCurrent) this.task = response.data; if (response.data.status === 'SUCCEEDED') return response.data; if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(response.data.status)) throw new Error(response.data.error_message || response.data.status); await new Promise(resolve => setTimeout(resolve, 3000)) } throw streamError } },
    async cancelCurrentTask () { if (!this.task) return; try { await cancelTask(this.task.task_id); this.$message.info(this.$t('marketScreener.cancelRequested')) } catch (error) { this.$message.error(error.backendMessage || error.message) } },
    async retryCurrentTask () { if (!this.task || this.retrying) return; this.retrying = true; this.running = true; this.clearSelection(); try { const response = await retryTask(this.task.task_id); this.task = response.data || response; this.persistTaskReference(this.task); this.task = await this.waitTask(this.task.task_id); this.persistTaskReference(this.task); this.result = this.task.result && this.task.result.payload; this.resultPage = 1; await this.loadResultRows(); await this.reloadHistory() } catch (error) { this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.runFailed')) } finally { this.retrying = false; this.running = false } },
    async loadResultRows () { if (!this.task) return; const generation = ++this.resultLoadGeneration; this.loadingRows = true; try { const response = await getScreenRows(this.task.task_id, { state: this.resultState, page: this.resultPage, page_size: this.resultPageSize, sort_by: this.resultSortBy, sort_order: this.resultSortOrder, quality: this.resultQuality, query: String(this.resultQuery || '').trim(), min_decision_score: this.resultMinDecisionScore, min_match_score: this.resultMinMatchScore }); if (generation !== this.resultLoadGeneration) return; const data = response.data || {}; this.resultRows = data.items || []; this.resultTotal = Number(data.total || 0); this.reconcileSelection() } catch (error) { if (generation === this.resultLoadGeneration) { this.resultRows = []; this.resultTotal = 0; this.$message.error(error.backendMessage || error.message || this.$t('marketScreener.loadResultsFailed')) } } finally { if (generation === this.resultLoadGeneration) this.loadingRows = false } },
    scheduleResultReload () { if (this.resultSearchTimer) clearTimeout(this.resultSearchTimer); this.resultSearchTimer = setTimeout(this.applyResultFilters, 350) },
    applyResultFilters () { if (this.resultSearchTimer) clearTimeout(this.resultSearchTimer); this.resultPage = 1; this.loadResultRows() },
    resetResultFilters () { this.resultQuery = ''; this.resultQuality = 'all'; this.resultMinDecisionScore = null; this.resultMinMatchScore = null; this.applyResultFilters() },
    handleTableChange (pagination, filters, sorter) { this.resultPage = pagination.current; this.resultPageSize = pagination.pageSize; if (sorter && sorter.field && ['symbol', 'match_score', 'technical_score', 'decision_score', 'bar_time'].includes(sorter.field)) { this.resultSortBy = sorter.field; this.resultSortOrder = sorter.order === 'ascend' ? 'asc' : 'desc' } this.loadResultRows() },
    handleRowSelection (keys, rows) { for (const row of rows || []) this.$set(this.selectedRowMap, row.symbol, row); const currentKeys = new Set((this.resultRows || []).map(row => row.symbol)); for (const key of currentKeys) { if (!keys.includes(key)) this.$delete(this.selectedRowMap, key) } this.reconcileSelection() },
    reconcileSelection () { this.selectedRowKeys = Object.keys(this.selectedRowMap); this.selectedRows = Object.values(this.selectedRowMap) },
    clearSelection () { this.selectedRowKeys = []; this.selectedRows = []; this.selectedRowMap = {} },
    selectCurrentPage () { for (const row of this.displayRows) this.$set(this.selectedRowMap, row.symbol, row); this.reconcileSelection() },
    selectTopCandidates () { const rows = [...this.displayRows].sort((left, right) => Number(right.decision_score || 0) - Number(left.decision_score || 0)).slice(0, Math.min(20, this.displayRows.length)); for (const row of rows) this.$set(this.selectedRowMap, row.symbol, row); this.reconcileSelection() },
    resultTableRow (row) { return { on: { dblclick: () => this.openDetails(row) } } },
    toggleResultSortOrder () { this.resultSortOrder = this.resultSortOrder === 'desc' ? 'asc' : 'desc'; this.loadResultRows() },
    screenRequestDigest (payload) { const source = JSON.stringify({ ...payload, universe: payload.universe || null, symbols: payload.symbols || null }); let hash = 2166136261; for (let index = 0; index < source.length; index += 1) hash = Math.imul(hash ^ source.charCodeAt(index), 16777619); return `${hash >>> 0}` },
    async addResultToWatchlist (row, silent = false) { try { await addWatchlist({ market: 'CNStock', symbol: String(row.symbol).split('.')[0], name: row.name || row.symbol }); if (!silent) this.$message.success(this.$t('marketScreener.addedWatchlist')); return true } catch (error) { if (!silent) this.$message.error(error.backendMessage || error.message); throw error } },
    async addSelectedToWatchlist () { const results = await Promise.allSettled(this.selectedRows.map(row => this.addResultToWatchlist(row, true))); const failed = results.filter(item => item.status === 'rejected').length; this.$message[failed ? 'warning' : 'success'](this.$t('marketScreener.batchAddedWithFailures', { count: results.length - failed, failed })) },
    handleExportMenu ({ key }) { this.exportRows(key === 'selected' ? this.selectedRows : this.displayRows, key) },
    exportRows (rows, scope = 'page') { if (!rows.length || this.exportLoading) return; this.exportLoading = true; try { const columns = [{ key: 'symbol', label: this.$t('marketScreener.symbol') }, { key: 'name', label: this.$t('marketScreener.name') }, { key: 'match_score', label: this.$t('marketScreener.matchScore') }, { key: 'decision_score', label: this.$t('screenIntelligence.decisionScore') }, { key: 'technical_score', label: this.$t('marketScreener.technicalScore') }, { key: 'bar_time', label: this.$t('marketScreener.dataTime') }]; const quote = value => `"${String(value == null ? '' : value).replace(/"/g, '""')}"`; const csv = [columns.map(item => quote(item.label)).join(','), ...rows.map(row => columns.map(item => quote(row[item.key])).join(','))].join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `quantdinger-screen-${scope}-${this.task && this.task.task_id || 'result'}.csv`; anchor.click(); URL.revokeObjectURL(url) } finally { this.exportLoading = false } },
    async validateSelection () { this.validating = true; this.optimizationResult = null; try { const response = await validateScreen(this.task.task_id, { symbols: this.selectedRows.slice(0, 100).map(row => row.symbol), forward_bars: [5, 10, 20], sample_step: 10, split_ratio: [0.6, 0.2, 0.2], walk_forward_folds: 3, embargo_bars: 5 }); this.validationTask = await this.waitTask(response.data.task_id, 3600000, false); this.validationResult = this.validationTask.result && this.validationTask.result.payload; this.validationVisible = true } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.validating = false } },
    async optimizeValidatedPortfolio () {
      this.optimizing = true
      try {
        const returns = {}
        for (const item of (this.validationResult.observations || [])) {
          if (!returns[item.symbol]) returns[item.symbol] = []
          if (item.returns && item.returns['10'] != null) returns[item.symbol].push(Number(item.returns['10']))
        }
        const candidates = this.selectedRows.filter(item => (returns[item.symbol] || []).length >= 2)
        const response = await optimizeScreenPortfolio({ candidates, returns, configuration: { ...this.portfolio, industry_caps: {}, commission_rate: 0.0003, stamp_duty_rate: 0.001, impact_rate: 0.0005 } })
        this.optimizationResult = response.data
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.optimizing = false }
    },
    async startPortfolioSimulation () {
      this.startingSimulation = true
      try {
        const created = await createScreenPortfolioAccount({ name: `${this.$t('screenIntelligence.simulation')} ${new Date().toLocaleDateString()}`, initial_cash: this.portfolio.capital, configuration: this.portfolio })
        const market = {}
        for (const row of this.selectedRows) market[row.symbol] = { price: Number(((row.bar || {}).close) || ((row.pool || {}).price) || 0), volume: Number(((row.bar || {}).volume) || 0), status: { can_buy: (row.data_quality || {}).eligible !== false } }
        const response = await rebalanceScreenPortfolioAccount(created.data.id, { task_id: this.task.task_id, trade_date: new Date().toISOString().slice(0, 10), targets: this.optimizationResult.holdings, market })
        this.$message.success(this.$t('screenIntelligence.simulationStarted', { orders: response.data.orders.length }))
      } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.startingSimulation = false }
    },
    async saveFeedback (row, decision) { try { await saveScreenFeedback(this.task.task_id, { symbol: row.symbol, decision }); this.$set(row, 'feedback', decision); this.$message.success(this.$t('screenIntelligence.feedbackSaved')) } catch (error) { this.$message.error(error.backendMessage || error.message) } },
    submitForReview () { this.$confirm({ title: this.$t('marketScreener.reviewConfirmTitle'), content: this.$t('marketScreener.reviewConfirmBody', { count: Math.min(this.selectedRows.length, 20) }), okText: this.$t('marketScreener.confirm'), cancelText: this.$t('marketScreener.cancel'), onOk: this.doSubmitForReview }) },
    async doSubmitForReview () { this.submittingReview = true; try { const response = await submitScreenReviewSignals(this.task.task_id, { symbols: this.selectedRows.slice(0, 20).map(row => row.symbol), quantity: 100 }); const data = response.data || {}; this.$message.success(this.$t('marketScreener.reviewSubmitted', { count: (data.submitted || []).length })) } catch (error) { this.$message.error(error.backendMessage || error.message) } finally { this.submittingReview = false } },
    async reloadHistory () { const response = await getScreenHistory({ limit: 30 }); this.historyItems = (response.data && response.data.items) || [] },
    historyTitle (item) { const summary = item.summary || {}; return this.$t('marketScreener.historyTitle', { requested: summary.requested || item.progress.total || 0, matched: summary.matched || item.progress.matched || 0 }) },
    async openHistoricalTask (taskId) { this.historyVisible = false; this.clearSelection(); const response = await getTask(taskId); this.task = response.data; this.persistTaskReference(this.task); this.result = this.task.result && this.task.result.payload; this.resultState = 'matched'; this.resultPage = 1; await this.loadResultRows() },
    async openDetails (row) {
      this.detailRow = row; this.detailVisible = true; this.timeline = { runs: [], events: [], signals: [] }; this.timelineLoading = true
      try { const response = await getScreenCandidateTimeline(row.symbol); this.timeline = response.data || this.timeline } catch (error) { this.timeline = { runs: [], events: [], signals: [] } } finally { this.timelineLoading = false }
    },
    moveDetail (offset) { const row = this.displayRows[this.detailRowIndex + offset]; if (row) this.openDetails(row) },
    candidateContext (row) { return buildCandidateContext({ rows: this.displayRows, selectedRows: this.selectedRows, current: row, taskId: this.task && this.task.task_id, timeframe: this.timeframe }) },
    chartRoute (row) { return { path: '/indicator-ide', query: { market: 'CNStock', symbol: row.symbol, timeframe: this.timeframe, builtin: 'czsc', source: 'screener', task_id: this.task && this.task.task_id || '' } } },
    openCandidateChart (row) { saveCandidateContext(this.candidateContext(row)); this.$router.push(this.chartRoute(row)); this.detailVisible = false; this.compareVisible = false },
    openCandidateReviewQueue () { const row = this.selectedRows[0] || this.displayRows[0]; if (row) this.openCandidateChart(row) },
    conditionTagColor (item) { const mode = String((item.condition && item.condition.mode) || 'must'); if (mode === 'exclude') return item.matched ? 'red' : 'green'; return item.matched ? 'green' : 'orange' },
    conditionActual (item) { const actual = item && item.actual; const expected = item && item.expected; const value = typeof actual === 'object' ? JSON.stringify(actual) : String(actual == null ? '-' : actual); const target = typeof expected === 'object' ? JSON.stringify(expected) : String(expected == null ? '-' : expected); return `${value} / ${target}` },
    formatDate (value) { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString() },
    percent (value) { return `${(Number(value || 0) * 100).toFixed(2)}%` }
  }
}
</script>

<style scoped>
.screener-page { min-height: calc(100vh - 64px); padding: 14px 18px; color: #1f2937; background: #f5f7fa; }
.screener-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.screener-header h1 { margin: 0; font-size: 20px; }
.screener-header p { margin: 3px 0 0; color: #6b7280; font-size: 12px; }
.header-actions, .result-actions { display: flex; align-items: center; gap: 8px; }
.result-actions { justify-content: flex-end; min-width: 0; flex-wrap: wrap; }
.header-actions .ant-select { width: 180px; }
.draft-state { display: inline-flex; align-items: center; gap: 5px; min-height: 32px; padding: 0 9px; color: #389e0d; font-size: 11px; white-space: nowrap; border: 1px solid #d9f7be; border-radius: 4px; background: #f6ffed; }
.draft-state--dirty { color: #d46b08; border-color: #ffe7ba; background: #fff7e6; }
.screener-layout { display: grid; grid-template-columns: 400px minmax(0, 1fr); min-height: 760px; border: 1px solid #dfe3e8; background: #fff; }
.config-panel { padding: 14px; border-right: 1px solid #dfe3e8; }
.result-panel { min-width: 0; padding: 14px; }
.section-title, .result-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 18px; }
.section-title--first { margin-top: 0; }
.section-title h2, .result-heading h2 { margin: 0; font-size: 14px; }
.config-alert, .manual-symbols { margin-top: 10px; }
.manual-symbol-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 30px; color: #389e0d; font-size: 11px; }
.manual-symbol-status .ant-btn { padding: 0; color: #d46b08; }
.pool-settings { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
.pool-settings label, .run-settings label, .condition-field { display: grid; min-width: 0; gap: 4px; }
.pool-settings label > span, .run-settings label > span, .condition-field > span { color: #6b7280; font-size: 11px; }
.pool-settings .ant-select, .pool-settings .ant-input-number, .run-settings .ant-select, .run-settings .ant-input-number, .condition-field .ant-select, .condition-field .ant-input-number { width: 100%; }
.wide-field { grid-column: 1 / -1; }
.pool-check { display: flex !important; align-items: center; }
.range-setting { grid-column: 1 / -1; }
.range-setting > div, .range-inputs { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 5px; }
.range-setting i { color: #8c8c8c; font-style: normal; }
.pool-preview { margin-top: 0; }
.snapshot-status { color: #6b7280; font-size: 11px; }
.condition-row { margin-bottom: 9px; padding: 10px; border: 1px solid #e2e6ea; border-radius: 6px; background: #fafbfc; }
.condition-row--invalid { border-color: #faad14; box-shadow: inset 3px 0 0 #faad14; }
.condition-topline { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.condition-row-actions { display: flex; align-items: center; gap: 5px; }
.condition-help { margin: 5px 0; color: #6b7280; font-size: 11px; line-height: 1.4; }
.condition-presets { margin-bottom: 6px; }
.condition-presets .ant-tag { cursor: pointer; }
.condition-controls { display: grid; grid-template-columns: .9fr 1.1fr 72px; gap: 7px; align-items: end; margin-top: 7px; }
.condition-controls--compact { grid-template-columns: minmax(130px, 1fr) 72px; }
.condition-field--lookback { width: 72px; }
.run-settings { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 8px; margin: 14px 0; }
.run-readiness { margin-bottom: 10px; }
.result-heading { min-width: 0; margin: 0 0 10px; }
.result-heading > div:first-child { min-width: 0; }
.result-heading > div:first-child span { color: #6b7280; font-size: 12px; }
.result-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
.result-toolbar-search { width: min(240px, 100%); }
.result-toolbar-select { min-width: 128px; }
.result-score-filter { display: inline-flex; align-items: center; gap: 5px; color: #6b7280; font-size: 11px; white-space: nowrap; }
.result-score-filter .ant-input-number { width: 74px; }
.result-toolbar-hint { color: #8c8c8c; font-size: 11px; }
.selection-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; margin: 0 0 8px; padding: 5px 8px; color: #096dd9; font-size: 11px; border: 1px solid #bae7ff; background: #e6f7ff; }
.selection-bar .ant-btn { padding: 0 5px; }
.quality-summary-alert { margin-bottom: 8px; }
.task-failure-alert { margin-bottom: 10px; }
.running-state { display: flex; align-items: center; justify-content: center; flex-direction: column; min-height: 520px; gap: 12px; }
.running-state .ant-progress { width: min(520px, 90%); }
.running-state > span { color: #6b7280; font-size: 12px; }
.run-summary { display: grid; grid-template-columns: repeat(6, minmax(88px, 1fr)); border: 1px solid #e5e7eb; margin-bottom: 10px; }
.run-summary > div { display: grid; gap: 2px; padding: 9px 12px; border-right: 1px solid #e5e7eb; }
.run-summary > div:last-child { border-right: 0; }
.run-summary b { font-size: 16px; }
.run-summary span { color: #6b7280; font-size: 11px; }
.result-panel small { display: block; color: #6b7280; }
.score-high { color: #cf1322; }
.condition-matrix { display: flex; flex-wrap: wrap; gap: 3px; max-height: 54px; overflow: hidden; }
.condition-matrix .ant-tag { margin: 0; font-size: 11px; }
.history-diff { display: flex; flex-wrap: wrap; gap: 3px; }
.history-request { display: block; margin: 3px 0 5px; color: #8c8c8c; font-size: 11px; }
.detail-scores { display: flex; gap: 24px; margin-bottom: 14px; }
.detail-navigation { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 14px; padding-bottom: 10px; border-bottom: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; }
.detail-scores b { font-size: 18px; }
.detail-scores + .ant-alert { margin-bottom: 18px; }
.feedback-actions { display: flex; gap: 8px; margin-bottom: 12px; }
.generalization-alert { margin-bottom: 12px; }
.validation-actions { display: flex; gap: 8px; margin: 12px 0; }
.research-diagnostics { margin-top: 10px; }
.diagnostic-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: #e5e7eb; }
.diagnostic-strip span { display: flex; padding: 8px; background: #fff; color: #6b7280; font-size: 11px; flex-direction: column; }
.diagnostic-strip b { color: #111827; font-size: 14px; }
.weight-tags { margin-top: 8px; }
.optimization-summary { display: grid; grid-template-columns: repeat(3, 1fr); margin-bottom: 10px; border: 1px solid #e5e7eb; }
.optimization-summary span { display: flex; padding: 9px; color: #6b7280; font-size: 11px; flex-direction: column; }
.optimization-summary b { color: #111827; font-size: 15px; }
.detail-scores ~ h3 { margin-top: 18px; font-size: 13px; }
.candidate-comparison { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border: 1px solid #e5e7eb; }
.candidate-comparison section { display: flex; min-width: 0; padding: 12px; border-right: 1px solid #e5e7eb; flex-direction: column; gap: 10px; }
.candidate-comparison section:last-child { border-right: 0; }
.candidate-comparison header { display: grid; gap: 2px; }
.candidate-comparison header strong { font-size: 14px; }
.candidate-comparison header small { min-height: 18px; color: #6b7280; }
.candidate-comparison dl { display: grid; gap: 5px; margin: 0; }
.candidate-comparison dl > div { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.candidate-comparison dt { color: #6b7280; font-size: 11px; }
.candidate-comparison dd { margin: 0; font-weight: 600; }
.candidate-comparison .condition-matrix { min-height: 54px; flex: 1; }
.screener-page--dark { color: #e5e7eb; background: #111827; }
.screener-page--dark .screener-layout { border-color: #30363d; background: #171b22; }
.screener-page--dark .config-panel { border-color: #30363d; }
.screener-page--dark .condition-row { border-color: #30363d; background: #11151b; }
.screener-page--dark .condition-row--invalid { border-color: #d48806; }
.screener-page--dark .selection-bar { color: #69c0ff; border-color: #164c73; background: #10293b; }
.screener-page--dark .detail-navigation, .screener-page--dark .candidate-comparison, .screener-page--dark .candidate-comparison section { border-color: #30363d; }
.screener-page--dark .candidate-comparison header small, .screener-page--dark .candidate-comparison dt { color: #9ca3af; }
.screener-page--dark .run-summary { border-color: #30363d; }
.screener-page--dark .run-summary > div { border-color: #30363d; }
@media (max-width: 1100px) { .screener-layout { grid-template-columns: 360px minmax(0, 1fr); }.run-summary { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 900px) { .screener-header { align-items: flex-start; flex-direction: column; }.header-actions { width: 100%; flex-wrap: wrap; }.screener-layout { grid-template-columns: 1fr; }.config-panel { border-right: 0; border-bottom: 1px solid #dfe3e8; }.result-heading { align-items: flex-start; flex-direction: column; }.candidate-comparison { grid-template-columns: repeat(2, minmax(0, 1fr)); }.candidate-comparison section:nth-child(2) { border-right: 0; }.candidate-comparison section:nth-child(-n+2) { border-bottom: 1px solid #e5e7eb; } }
@media (max-width: 520px) { .screener-page { padding: 10px; }.pool-settings, .condition-controls, .condition-controls--compact, .run-settings, .run-summary { grid-template-columns: 1fr; }.wide-field, .range-setting { grid-column: auto; }.condition-field--lookback { width: auto; }.run-summary > div { border-right: 0; border-bottom: 1px solid #e5e7eb; }.result-toolbar-search { width: 100%; }.selection-bar { align-items: flex-start; flex-direction: column; }.candidate-comparison { grid-template-columns: 1fr; }.candidate-comparison section, .candidate-comparison section:nth-child(2) { border-right: 0; border-bottom: 1px solid #e5e7eb; }.candidate-comparison section:last-child { border-bottom: 0; }.detail-navigation .ant-btn { padding: 0 7px; }.detail-navigation span { text-align: center; } }
</style>
