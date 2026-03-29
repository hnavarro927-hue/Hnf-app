/**
 * Banners de identidad operativa HNF (solo presentación, sin datos de negocio).
 */

const icon = (paths, attrs = '') =>
  `<svg class="hnf-ops-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${attrs}>${paths}</svg>`;

export function createHnfClimaOpsIdentityCard() {
  const el = document.createElement('div');
  el.className = 'hnf-ops-module-card hnf-ops-module-card--clima';
  el.setAttribute('aria-label', 'Módulo Clima, operación Romina');
  el.innerHTML = `
    <div class="hnf-ops-module-card__head">
      <span class="hnf-ops-module-card__badge">Clima · HVAC</span>
      <h3 class="hnf-ops-module-card__title">Operación <strong>Romina</strong></h3>
      <p class="hnf-ops-module-card__sub">Servicios técnicos de climatización en campo.</p>
    </div>
    <ul class="hnf-ops-module-card__services" role="list">
      <li>${icon('<path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/>')}<span>Limpieza de filtros</span></li>
      <li>${icon('<path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>')}<span>Medición de temperatura</span></li>
      <li>${icon('<rect x="4" y="8" width="16" height="11" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/><circle cx="12" cy="14" r="2"/>')}<span>Limpieza de unidades exteriores</span></li>
    </ul>
  `;
  return el;
}

export function createHnfFlotaOpsIdentityCard() {
  const el = document.createElement('div');
  el.className = 'hnf-ops-module-card hnf-ops-module-card--flota';
  el.setAttribute('aria-label', 'Módulo Flota, operación Gery');
  el.innerHTML = `
    <div class="hnf-ops-module-card__head">
      <span class="hnf-ops-module-card__badge">Flota · logística</span>
      <h3 class="hnf-ops-module-card__title">Operación <strong>Gery</strong></h3>
      <p class="hnf-ops-module-card__sub"><strong>Trazabilidad 360°</strong> en cada solicitud.</p>
    </div>
    <div class="hnf-ops-module-card__pill-row" role="list">
      <span class="hnf-ops-pill hnf-ops-pill--flota" role="listitem">Logística</span>
      <span class="hnf-ops-pill hnf-ops-pill--flota" role="listitem">Legal</span>
      <span class="hnf-ops-pill hnf-ops-pill--flota" role="listitem">Tracking</span>
    </div>
  `;
  return el;
}

export function createHnfGerenciaOpsIdentityCard() {
  const el = document.createElement('div');
  el.className = 'hnf-ops-module-card hnf-ops-module-card--gerencia';
  el.setAttribute('aria-label', 'Módulo Gerencia y control');
  el.innerHTML = `
    <div class="hnf-ops-module-card__head">
      <span class="hnf-ops-module-card__badge">Gerencia · Control</span>
      <h3 class="hnf-ops-module-card__title">Visión <strong>omnicanal</strong></h3>
      <p class="hnf-ops-module-card__sub">Correo, WhatsApp, terreno y flota en un solo tablero de KPIs.</p>
    </div>
    <ul class="hnf-ops-module-card__kpi-hint" role="list">
      <li>Canales unificados</li>
      <li>Indicadores ejecutivos</li>
      <li>Alertas y riesgo</li>
    </ul>
  `;
  return el;
}
