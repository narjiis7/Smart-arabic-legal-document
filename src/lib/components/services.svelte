<script>
  export let onBookLawyer = () => {};
  export let onGoToContractGenerator = () => {};
  export let onGoToRequests = () => {};
  export let onGoToContracts = () => {};
  export let onGoToConsult = () => {};

  const services = [
    { icon: '👨‍⚖️', label: 'احجز محامي', action: 'book' },
    { icon: '📄', label: 'توليد عقد', action: 'contract' },
    { icon: '💬', label: 'استشارة', action: 'consult' },
  ];

  function handleClick(action) {
    if (action === 'book') {
      onBookLawyer();
    } else if (action === 'contract') {
      onGoToContractGenerator();
    } else if (action === 'consult') {
      onGoToConsult();
    } else {
      alert('قريباً!');
    }
  }
</script>

<div class="services-section">
  <p class="section-title">خدماتنا</p>
  <div class="services">
    {#each services as service}
      <button
        type="button"
        class="service-card"
        class:service-card-span={service.action === 'consult'}
        on:click={() => handleClick(service.action)}
      >
        <div class="icon-ring">
          <span class="icon">{service.icon}</span>
        </div>
        <p>{service.label}</p>
      </button>
    {/each}
  </div>

  <div class="quick-row">
    <button type="button" class="quick-btn" on:click={() => onGoToRequests()}>طلباتي</button>
    <button type="button" class="quick-btn" on:click={() => onGoToContracts()}>عقودي</button>
  </div>
</div>

<style>
  .services-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .section-title {
    font-size: 17px;
    font-weight: 800;
    color: var(--lt-navy-ink);
    text-align: right;
  }
  .services {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .service-card {
    border: none;
    font-family: inherit;
    cursor: pointer;
    border-radius: 18px;
    padding: 18px 12px 16px;
    text-align: center;
    background: #eef1f8;
    border: 1px solid rgba(42, 54, 88, 0.12);
    box-shadow: 0 4px 14px rgba(26, 34, 56, 0.06);
    transition:
      transform 0.15s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }
  .service-card:hover {
    border-color: rgba(42, 54, 88, 0.28);
    box-shadow: 0 6px 18px rgba(26, 34, 56, 0.12);
  }
  .service-card:active {
    transform: scale(0.97);
  }
  .service-card-span {
    grid-column: 1 / -1;
  }
  .icon-ring {
    width: 52px;
    height: 52px;
    margin: 0 auto 10px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #e8eaf4;
    border: 1px solid rgba(42, 54, 88, 0.16);
  }
  .icon {
    font-size: 26px;
    line-height: 1;
  }
  .service-card p {
    font-size: 14px;
    color: var(--lt-navy-ink);
    font-weight: 700;
    margin: 0;
  }
  .quick-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 2px;
  }
  .quick-btn {
    border: none;
    font-family: inherit;
    cursor: pointer;
    border-radius: 16px;
    padding: 15px 14px;
    text-align: center;
    font-size: 15px;
    font-weight: 800;
    color: var(--lt-navy-ink);
    background: #eef1f8;
    border: 1px solid rgba(42, 54, 88, 0.14);
    box-shadow: 0 4px 14px rgba(26, 34, 56, 0.06);
    transition:
      transform 0.15s ease,
      box-shadow 0.2s ease,
      border-color 0.2s ease;
  }
  .quick-btn:hover {
    border-color: rgba(42, 54, 88, 0.26);
    box-shadow: 0 6px 18px rgba(26, 34, 56, 0.1);
  }
  .quick-btn:active {
    transform: scale(0.97);
  }

  /* ليلي: نيلي مثل شريط التنقّل والتصميم الأصلي */
  :global(html[data-theme='dark']) .section-title {
    color: var(--lt-text);
  }

  :global(html[data-theme='dark']) .service-card {
    background: linear-gradient(
      155deg,
      var(--lt-navy-deep) 0%,
      var(--lt-navy-mid) 48%,
      var(--lt-navy-soft) 100%
    );
    border: 1px solid rgba(120, 140, 190, 0.22);
    box-shadow:
      0 6px 22px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.06);
  }

  :global(html[data-theme='dark']) .service-card:hover {
    border-color: rgba(160, 180, 220, 0.28);
  }

  :global(html[data-theme='dark']) .service-card p {
    color: var(--lt-text);
  }

  :global(html[data-theme='dark']) .icon-ring {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(120, 140, 190, 0.28);
  }

  :global(html[data-theme='dark']) .quick-btn {
    background: linear-gradient(180deg, var(--lt-navy-mid) 0%, var(--lt-navy-deep) 100%);
    border: 1px solid rgba(120, 140, 190, 0.22);
    color: var(--lt-text);
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.32);
  }

  :global(html[data-theme='dark']) .quick-btn:hover {
    border-color: rgba(160, 180, 220, 0.3);
  }
</style>
