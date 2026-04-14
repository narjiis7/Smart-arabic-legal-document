<script>
  /** رمز من المسار /signing/{token} — يطابق توثيق الباكند */
  export let token = '';
  export let onGoHome = () => {};
</script>

<div class="page">
  <div class="header">
    <h1>توقيع العقد</h1>
  </div>
  <div class="content">
    {#if token}
      <div class="card">
        <span class="label">رمز التوقيع</span>
        <code class="token">{token}</code>
      </div>
    {:else}
      <p class="muted">لا يوجد رابط توقيع صالح.</p>
    {/if}
    <button class="btn" type="button" on:click={onGoHome}>العودة للرئيسية</button>
  </div>
</div>

<style>
  .page {
    min-height: 100vh;
    background: transparent;
    display: flex;
    flex-direction: column;
  }
  .header {
    margin: 12px 14px 0;
    padding: 16px;
    color: #f8fafc;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.06);
    -webkit-backdrop-filter: blur(20px);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.3);
  }
  .header h1 {
    margin: 0;
    text-align: center;
    font-size: 22px;
    font-weight: 900;
  }
  .content {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 520px;
    margin: 0 auto;
    width: 100%;
    box-sizing: border-box;
  }
  .muted {
    margin: 0;
    font-size: 14px;
    line-height: 1.55;
    color: rgba(226, 232, 240, 0.55);
    text-align: center;
  }
  .card {
    background: rgba(255, 255, 255, 0.07);
    -webkit-backdrop-filter: blur(16px);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 18px;
    padding: 14px;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
  }
  .label {
    display: block;
    font-size: 12px;
    color: rgba(226, 232, 240, 0.45);
    font-weight: 700;
    margin-bottom: 8px;
  }
  .token {
    display: block;
    font-size: 13px;
    word-break: break-all;
    background: rgba(15, 23, 42, 0.45);
    color: #e2e8f0;
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }
  .btn {
    border: none;
    background: linear-gradient(135deg, rgba(251, 146, 60, 0.35), rgba(249, 115, 22, 0.25));
    border: 1px solid rgba(251, 191, 36, 0.45);
    color: #fff8f0;
    border-radius: 999px;
    padding: 14px;
    font-size: 16px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 8px 28px rgba(249, 115, 22, 0.18);
  }
</style>
