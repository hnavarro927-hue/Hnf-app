/**
 * Encabezado ejecutivo ONE CORE — una sola cabina de mando.
 */

import { listChannels } from '../domain/jarvis-channel-memory.js';
import {
  getSelectedIntakeChannelId,
  setSelectedIntakeChannelId,
} from '../domain/jarvis-channel-intelligence.js';

const fmtMoney = (n) =>
  Math.round(Number(n) || 0).toLocaleString('es-CL', { maximumFractionDigits: 0 });

const fmtSync = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return String(iso);
  }
};

export function createJarvisOperativoNucleus({
  alienDecision,
  friction,
  infinity,
  opBrain,
  lastDataRefreshAt,
  criticalAssignee,
  onIntakeChannelChange,
} = {}) {
  const wrap = document.createElement('section');
  wrap.className = 'jarvis-op-nucleus jarvis-one-core-header tarjeta';
  wrap.setAttribute('aria-label', 'JARVIS ONE CORE');

  const cv = infinity?.controlVivo || {};
  const g = alienDecision?.estadoGlobal || 'estable';
  let estadoTxt = 'OPERATIVO';
  let tone = 'ok';
  if (g === 'critico' || cv.semaforo === 'rojo') {
    estadoTxt = 'CRÍTICO';
    tone = 'crit';
  } else if (g === 'tension' || cv.semaforo === 'amarillo') {
    estadoTxt = 'ALERTA';
    tone = 'warn';
  }

  const cr = friction?.capaRealidad || {};
  const dineroDetenido = Math.round(Number(cv.dineroRiesgo) || Number(cr.ingresoBloqueado) || 0);

  const accion =
    (opBrain?.accionesActivas?.principal || '').replace(/^\s*Acción:\s*/i, '').trim() ||
    alienDecision?.top3Acciones?.[0]?.accion ||
    'Revisar datos y prioridades del día.';

  const respCrit =
    String(criticalAssignee || '').trim() ||
    String(infinity?.eventosActivos?.[0]?.assignee || '').trim() ||
    String(alienDecision?.top3Acciones?.[0]?.responsable || '').trim() ||
    '—';

  wrap.classList.add(`jarvis-op-nucleus--${tone}`);
  wrap.innerHTML = `
    <header class="jarvis-one-core-header__brand">
      <h1 class="jarvis-one-core-header__h1">JARVIS ONE CORE</h1>
      <p class="jarvis-one-core-header__sub">Centro operativo unificado de HNF</p>
    </header>
    <div class="jarvis-one-core-header__metrics">
      <div class="jarvis-one-core-header__metric">
        <span class="jarvis-one-core-header__k">Estado</span>
        <span class="jarvis-one-core-header__v jarvis-one-core-header__v--estado jarvis-one-core-header__v--${tone}">${estadoTxt}</span>
      </div>
      <div class="jarvis-one-core-header__metric">
        <span class="jarvis-one-core-header__k">Dinero detenido</span>
        <span class="jarvis-one-core-header__v">$${fmtMoney(dineroDetenido)}</span>
      </div>
      <div class="jarvis-one-core-header__metric jarvis-one-core-header__metric--wide">
        <span class="jarvis-one-core-header__k">Acción obligatoria</span>
        <span class="jarvis-one-core-header__v jarvis-one-core-header__v--action"></span>
      </div>
      <div class="jarvis-one-core-header__metric">
        <span class="jarvis-one-core-header__k">Responsable crítico</span>
        <span class="jarvis-one-core-header__v jarvis-one-core-header__v--resp"></span>
      </div>
      <div class="jarvis-one-core-header__metric">
        <span class="jarvis-one-core-header__k">Última sync</span>
        <span class="jarvis-one-core-header__v jarvis-one-core-header__v--sync"></span>
      </div>
    </div>
  `;

  wrap.querySelector('.jarvis-one-core-header__v--action').textContent = accion.slice(0, 200);
  wrap.querySelector('.jarvis-one-core-header__v--resp').textContent = respCrit;
  wrap.querySelector('.jarvis-one-core-header__v--sync').textContent = fmtSync(lastDataRefreshAt);

  const chRow = document.createElement('div');
  chRow.className = 'jarvis-op-nucleus__intake-channel';
  const chLab = document.createElement('label');
  chLab.className = 'jarvis-op-nucleus__intake-channel-label';
  chLab.setAttribute('for', 'hnf-jarvis-intake-channel-select');
  chLab.textContent = 'Canal de ingreso (interpretación Jarvis)';
  const sel = document.createElement('select');
  sel.id = 'hnf-jarvis-intake-channel-select';
  sel.className = 'jarvis-op-nucleus__intake-channel-select';
  sel.setAttribute('aria-label', 'Seleccionar canal operativo para ingesta');
  for (const c of listChannels()) {
    const o = document.createElement('option');
    o.value = c.id;
    o.textContent = c.channel_name;
    sel.append(o);
  }
  sel.value = getSelectedIntakeChannelId();
  sel.addEventListener('change', () => {
    setSelectedIntakeChannelId(sel.value);
    if (typeof onIntakeChannelChange === 'function') onIntakeChannelChange();
  });
  chRow.append(chLab, sel);
  wrap.append(chRow);

  return wrap;
}
