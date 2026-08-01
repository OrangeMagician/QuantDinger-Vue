<template>
  <span v-if="currentUser && currentUser.name" class="ant-pro-account-avatar qd-account-trigger">
    <a-dropdown placement="bottomRight" overlayClassName="qd-account-dropdown">
      <span class="account-avatar-button" :title="currentUser.name" :aria-label="currentUser.name">
        <a-avatar :size="28" :src="currentUser.avatar" class="antd-pro-global-header-index-avatar" />
      </span>
      <a-menu slot="overlay" mode="vertical" class="qd-account-menu" :selected-keys="[]">
        <a-menu-item key="identity" disabled class="account-menu-identity">
          <a-avatar :size="28" :src="currentUser.avatar" />
          <span class="account-menu-name">{{ currentUser.name }}</span>
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="credits" @click="handleCredits">
          <a-icon type="wallet" />
          <span>{{ $t('profile.credits.wallet') }}</span>
          <strong class="account-menu-credits">{{ formattedCredits }}</strong>
        </a-menu-item>
        <a-menu-item key="billing" @click="handleBilling">
          <a-icon type="credit-card" />
          {{ $t('profile.credits.rechargeShort') || 'Top Up' }}
        </a-menu-item>
        <a-menu-divider />
        <a-menu-item key="profile" @click="handleProfile">
          <a-icon type="user" />
          {{ $t('menu.myProfile') || $t('menu.profile') || 'Profile' }}
        </a-menu-item>
        <a-menu-item key="logout" @click="handleLogout">
          <a-icon type="logout" />
          {{ $t('menu.account.logout') }}
        </a-menu-item>
      </a-menu>
    </a-dropdown>
  </span>
  <span v-else>
    <a-spin size="small" :style="{ marginLeft: 8, marginRight: 8 }" />
  </span>
</template>

<script>
import { Modal } from 'ant-design-vue'
import { getMembershipPlans } from '@/api/billing'

export default {
  name: 'AvatarDropdown',
  props: {
    currentUser: {
      type: Object,
      default: () => null
    },
    menu: {
      type: Boolean,
      default: true
    }
  },
  data () {
    return {
      credits: null
    }
  },
  computed: {
    formattedCredits () {
      const value = this.credits !== null && typeof this.credits !== 'undefined'
        ? this.credits
        : (this.currentUser.credits || 0)
      return Number(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    }
  },
  mounted () {
    this.loadCredits()
    this.$root.$on('credits-updated', this.handleCreditsUpdated)
  },
  beforeDestroy () {
    this.$root.$off('credits-updated', this.handleCreditsUpdated)
  },
  methods: {
    handleCreditsUpdated (credits) {
      const value = Number(credits)
      if (Number.isFinite(value)) this.credits = value
    },
    async loadCredits () {
      try {
        const res = await getMembershipPlans()
        if (res && res.code === 1 && res.data && res.data.billing) {
          this.credits = res.data.billing.credits || 0
        }
      } catch (_) {}
    },
    handleProfile () {
      this.$router.push({ name: 'Profile' }).catch(() => {})
    },
    handleBilling () {
      this.$router.push({ name: 'Billing' }).catch(() => {})
    },
    handleCredits () {
      this.$router.push({ name: 'Profile', query: { tab: 'credits' } }).catch(() => {})
    },
    handleLogout (e) {
      Modal.confirm({
        title: this.$t('layouts.usermenu.dialog.title'),
        content: this.$t('layouts.usermenu.dialog.content'),
        onOk: () => {
          // return new Promise((resolve, reject) => {
          //   setTimeout(Math.random() > 0.5 ? resolve : reject, 1500)
          // }).catch(() => console.log('Oops errors!'))
          return this.$store.dispatch('Logout').then(() => {
            this.$router.push({ name: 'login' })
          })
        },
        onCancel () {}
      })
    }
  }
}
</script>

<style lang="less">
.qd-account-trigger {
  display: inline-flex !important;
  align-items: center !important;
  min-width: 0;
  height: 64px !important;
  margin: 0;
  padding: 0 !important;
  line-height: normal !important;
  vertical-align: top;

  .account-avatar-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 64px;
    cursor: pointer;
    transition: background 0.16s ease, color 0.16s ease;

    &:hover {
      background: rgba(15, 23, 42, 0.05);
      color: var(--primary-color, #1890ff);
    }
  }

  .antd-pro-global-header-index-avatar {
    flex: 0 0 auto;
    margin: 0 !important;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
  }

}

.qd-account-dropdown {
  width: 208px;
  min-width: 208px;

  .qd-account-menu.ant-menu,
  .qd-account-menu.ant-dropdown-menu {
    display: flex !important;
    flex-direction: column !important;
    width: 208px !important;
    min-width: 208px !important;
    padding: 6px !important;
    border: 0;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .qd-account-menu .ant-menu-item,
  .qd-account-menu .ant-dropdown-menu-item {
    display: flex !important;
    align-items: center;
    flex: 0 0 auto;
    float: none !important;
    clear: both;
    width: 196px !important;
    height: 36px !important;
    min-width: 196px !important;
    margin: 0 !important;
    padding: 0 10px !important;
    border-radius: 6px;
    line-height: 36px !important;
    white-space: nowrap;
    box-sizing: border-box;

    & + .ant-menu-item,
    & + .ant-dropdown-menu-item {
      margin-top: 4px;
    }

    .anticon {
      margin-right: 8px;
      line-height: 1;
    }
  }

  .account-menu-identity.ant-menu-item-disabled {
    height: 48px !important;
    color: rgba(15, 23, 42, 0.88) !important;
    cursor: default;
    opacity: 1;

    .ant-avatar { margin-right: 10px; }
  }

  .account-menu-name {
    min-width: 0;
    overflow: hidden;
    font-weight: 700;
    text-overflow: ellipsis;
  }

  .account-menu-credits {
    margin-left: auto;
    color: var(--primary-color, #1890ff);
    font-size: 12px;
  }
}

body.dark .qd-account-trigger,
body.realdark .qd-account-trigger,
.ant-layout.dark .qd-account-trigger,
.ant-layout.realdark .qd-account-trigger,
.ant-pro-layout.dark .qd-account-trigger,
.ant-pro-layout.realdark .qd-account-trigger {
  .account-avatar-button:hover {
    background: rgba(255, 255, 255, 0.08);
  }
}

body.dark .qd-account-trigger,
body.realdark .qd-account-trigger,
.ant-layout.dark .qd-account-trigger,
.ant-layout.realdark .qd-account-trigger,
.ant-pro-layout.dark .qd-account-trigger,
.ant-pro-layout.realdark .qd-account-trigger {
  background: transparent;
}

.ant-pro-drop-down {
  .action {
    margin-right: 8px;
  }
  .ant-dropdown-menu-item {
    min-width: 160px;
  }
}

body.dark .ant-dropdown-menu,
body.realdark .ant-dropdown-menu,
.ant-layout.dark .ant-dropdown-menu,
.ant-layout.realdark .ant-dropdown-menu,
.ant-pro-layout.dark .ant-dropdown-menu,
.ant-pro-layout.realdark .ant-dropdown-menu,
body.dark .qd-account-menu.ant-menu,
body.realdark .qd-account-menu.ant-menu,
.ant-layout.dark .qd-account-menu.ant-menu,
.ant-layout.realdark .qd-account-menu.ant-menu,
.ant-pro-layout.dark .qd-account-menu.ant-menu,
.ant-pro-layout.realdark .qd-account-menu.ant-menu {
  background-color: #1f1f1f;
  border: 1px solid #303030;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

  .ant-dropdown-menu-item,
  .ant-menu-item {
    color: rgba(255, 255, 255, 0.85);

    &:hover,
    &.ant-dropdown-menu-item-selected,
    &.ant-menu-item-selected {
      background-color: #262626;
      color: var(--primary-color, #1890ff);
    }

    .anticon {
      color: rgba(255, 255, 255, 0.85);
    }
  }

  .account-menu-identity.ant-menu-item-disabled {
    color: rgba(255, 255, 255, 0.9) !important;
  }

  .ant-dropdown-menu-item-divider {
    background-color: #303030;
  }
}
</style>
