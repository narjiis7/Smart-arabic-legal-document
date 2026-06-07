<script>
  import { notificationUnread } from '../notificationUnread.js';

  /** home | contracts | notifications | profile */
  export let active = 'home';
  /** شريط فاتح (الصفحات الرمادية) أو داكن (حجز / توليد عقد) */
  export let variant = 'light';
  export let onNavHome = () => {};
  export let onNavServices = () => {};
  export let onNavContracts = () => {};
  export let onNavNotifications = () => {};
  export let onNavProfile = () => {};

  const items = [
    { id: 'home', icon: '🏠', label: 'الرئيسية', action: () => onNavHome() },
    { id: 'notifications', icon: '🔔', label: 'إشعارات', action: () => onNavNotifications(), badge: true },
    { id: 'profile', icon: '👤', label: 'حسابي', action: () => onNavProfile() },
  ];
</script>

<div class="bottom-nav" class:dark={variant === 'dark'} dir="rtl">
  {#each items as item}
    <button
      type="button"
      class="nav-item {active === item.id ? 'active' : ''}"
      on:click={item.action}
    >
      <span class="nav-icon-wrap">
        <span class="nav-icon" aria-hidden="true">{item.icon}</span>
        {#if item.badge && $notificationUnread > 0}
          <span class="nav-badge" aria-label="غير مقروء: {$notificationUnread}">
            {$notificationUnread > 99 ? '99+' : $notificationUnread}
          </span>
        {/if}
      </span>
      <span class="nav-label">{item.label}</span>
    </button>
  {/each}
</div>

<style>
  .bottom-nav {
    display: flex;
    justify-content: space-around;
    align-items: stretch;
    padding: 10px 8px 16px;
    gap: 4px;
    margin: 0 10px 10px;
    border-radius: 24px;
    background: var(--nav-bar-bg);
    -webkit-backdrop-filter: var(--nav-bar-blur);
    backdrop-filter: var(--nav-bar-blur);
    border: 1px solid var(--nav-bar-border);
    box-shadow: var(--nav-bar-shadow);
  }
  .nav-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 5px;
    padding: 8px 4px;
    border: none;
    background: transparent;
    font-size: 10px;
    color: var(--nav-item-color);
    cursor: pointer;
    font-family: inherit;
    border-radius: 16px;
    transition:
      color 0.2s ease,
      background 0.2s ease,
      transform 0.12s ease;
  }
  .nav-item:active {
    transform: scale(0.96);
  }
  .nav-item.active {
    color: var(--nav-item-active-color);
    font-weight: 800;
    background: var(--nav-item-active-bg);
    box-shadow: var(--nav-item-active-shadow);
  }
  .nav-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    transition:
      background 0.2s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
    border: 1px solid transparent;
  }
  .nav-item.active .nav-icon-wrap {
    background: var(--nav-icon-active-bg);
    border-color: var(--nav-icon-active-border);
    box-shadow: var(--nav-icon-active-shadow);
  }
  .nav-icon {
    font-size: 20px;
    line-height: 1;
  }
  .nav-badge {
    position: absolute;
    top: -2px;
    inset-inline-start: 50%;
    margin-inline-start: 8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    background: linear-gradient(135deg, #f87171, #dc2626);
    color: #fff;
    font-size: 10px;
    font-weight: 800;
    line-height: 18px;
    text-align: center;
    box-shadow: 0 2px 10px rgba(220, 38, 38, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.25);
  }
  .nav-label {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .bottom-nav.dark {
    background: rgba(22, 28, 48, 0.88);
    border-color: rgba(130, 150, 200, 0.2);
    box-shadow:
      0 -8px 36px rgba(0, 0, 0, 0.45),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }
  .bottom-nav.dark .nav-item {
    color: rgba(190, 200, 230, 0.52);
  }
  .bottom-nav.dark .nav-item.active {
    color: #fbbf24;
    background: rgba(255, 255, 255, 0.08);
  }
  .bottom-nav.dark .nav-item.active .nav-icon-wrap {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.18);
    box-shadow:
      0 0 22px rgba(34, 211, 238, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }
</style>
