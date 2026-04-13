<script>
  export let title = 'الخدمات القانونية';
</script>

<div class="header">
  <div class="header-top">
    <div class="logo" aria-hidden="true">⚖️</div>
    <div class="header-text">
      <p class="greeting">مرحباً</p>
      <h2>{title}</h2>
    </div>
  </div>
</div>

<style>
  .header {
    margin: 12px 14px 0;
    padding: 18px 18px 22px;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: linear-gradient(
      145deg,
      var(--lt-navy-deep) 0%,
      var(--lt-navy-mid) 55%,
      var(--lt-navy-soft) 100%
    );
    box-shadow: 0 10px 28px rgba(26, 34, 56, 0.38);
  }
  .header-top {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    font-size: 1.6rem;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.14);
    border: 1px solid rgba(255, 255, 255, 0.22);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
  .greeting {
    color: rgba(255, 255, 255, 0.78);
    font-size: 13px;
    margin-bottom: 2px;
  }
  .header-text h2 {
    color: #ffffff;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
</style>