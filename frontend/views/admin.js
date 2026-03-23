import { createCard } from '../components/card.js';
import {
  exportBackupAdminClientes,
  exportBackupCompleto,
  exportBackupFlota,
  exportBackupOtClima,
  exportBackupPlanClientes,
  exportBackupPlanMantenciones,
  exportBackupPlanificacionBundle,
  exportBackupPlanTiendas,
} from '../services/backup.service.js';

const estadoRed = (s) =>
  ({ conectado: 'Conectado', 'sin conexión': 'Sin conexión', cargando: 'Cargando…', pendiente: '—' }[s] || s || '—');

const formatRefresh = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'medium' });
  } catch {
    return String(iso);
  }
};

export const adminView = ({
  data,
  actions,
  adminFeedback,
  integrationStatus,
  lastDataRefreshAt,
  apiBaseLabel,
} = {}) => {
  const section = document.createElement('section');
  section.className = 'admin-module';

  const header = document.createElement('div');
  header.className = 'module-header';
  header.innerHTML =
    '<h2>Administración</h2><p class="muted"><strong>Qué hacés acá:</strong> ver clientes generales, gastos y descargar respaldos en JSON. Las <strong>mantenciones por cliente</strong> se cargan en <strong>Planificación</strong>, no acá.</p>';

  if (adminFeedback?.message) {
    const notice = document.createElement('div');
    notice.className = `form-feedback form-feedback--${adminFeedback.type} workspace-notice`;
    notice.setAttribute('role', 'status');
    notice.textContent = adminFeedback.message;
    header.append(notice);
  }

  const clients = data?.clients?.data || [];
  const ots = data?.ots?.data || [];
  const expenses = data?.expenses?.data || [];

  const diagMini = document.createElement('article');
  diagMini.className = 'admin-diag-mini';
  diagMini.innerHTML = `
    <h3>Estado rápido</h3>
    <p class="muted"><strong>Backend:</strong> ${estadoRed(integrationStatus)} · <strong>API:</strong> ${apiBaseLabel || '—'}</p>
    <p class="muted"><strong>Última actualización en esta sesión:</strong> ${formatRefresh(lastDataRefreshAt)}</p>
    <p class="muted">Si ves «Sin conexión», los respaldos no se podrán generar hasta restablecer el servidor.</p>
  `;

  const backupCard = document.createElement('article');
  backupCard.className = 'admin-backup-card';
  backupCard.innerHTML = `
    <h3>Respaldo manual (JSON)</h3>
    <p class="muted">Descargá copias de lectura de los datos. No reemplaza un backup del servidor: guardá los archivos en un lugar seguro.</p>
  `;

  const btnRow = (label, title, fn) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'secondary-button admin-backup-btn';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', async () => {
      if (integrationStatus === 'sin conexión') {
        actions?.setAdminFeedback?.({
          type: 'error',
          message: 'Backend desconectado. No se puede generar el respaldo hasta recuperar la conexión.',
        });
        return;
      }
      try {
        await fn();
        actions?.setAdminFeedback?.({
          type: 'success',
          message: 'Respaldo generado correctamente. Revisá la carpeta de descargas del navegador.',
        });
      } catch (e) {
        actions?.setAdminFeedback?.({
          type: 'error',
          message: e?.message || 'No se pudo generar el respaldo. Revisá la conexión e intentá de nuevo.',
        });
      }
    });
    return b;
  };

  const grid = document.createElement('div');
  grid.className = 'admin-backup-grid';

  const groups = [
    {
      title: 'Clima · OT',
      buttons: [
        btnRow('Exportar OT Clima', 'Órdenes de trabajo HVAC (lista completa)', exportBackupOtClima),
      ],
    },
    {
      title: 'Planificación clima',
      buttons: [
        btnRow(
          'Exportar planificación (paquete)',
          'Clientes + tiendas + mantenciones en un solo JSON',
          exportBackupPlanificacionBundle
        ),
        btnRow('Solo clientes plan', 'Clientes de planificación', exportBackupPlanClientes),
        btnRow('Solo tiendas', 'Tiendas / locales', exportBackupPlanTiendas),
        btnRow('Solo mantenciones', 'Visitas programadas', exportBackupPlanMantenciones),
      ],
    },
    {
      title: 'Flota',
      buttons: [btnRow('Exportar solicitudes flota', 'Solicitudes de clientes', exportBackupFlota)],
    },
    {
      title: 'Administración (registro general)',
      buttons: [
        btnRow('Exportar clientes (admin)', 'Clientes del módulo administración', exportBackupAdminClientes),
      ],
    },
    {
      title: 'Completo',
      buttons: [
        btnRow(
          'Exportar respaldo completo',
          'OT + planificación + flota + clientes admin + vehículos + gastos + health',
          exportBackupCompleto
        ),
      ],
    },
  ];

  groups.forEach((g) => {
    const wrap = document.createElement('div');
    wrap.className = 'admin-backup-group';
    const h = document.createElement('h4');
    h.className = 'admin-backup-group__title';
    h.textContent = g.title;
    const row = document.createElement('div');
    row.className = 'admin-backup-row';
    g.buttons.forEach((b) => row.append(b));
    wrap.append(h, row);
    grid.append(wrap);
  });

  backupCard.append(grid);

  const cards = document.createElement('div');
  cards.className = 'cards';
  [
    { title: 'Clientes', description: 'Registro base.', items: [`Clientes: ${clients.length}`, 'Nombre', 'Contacto'] },
    { title: 'OT', description: 'Relación operativa.', items: [`OT: ${ots.length}`, 'Cliente relacionado', 'Estado'] },
    { title: 'Gastos', description: 'Control inicial.', items: [`Gastos: ${expenses.length}`, 'Centro de costo', 'Comprobante'] },
  ].forEach((item) => cards.append(createCard(item)));

  section.append(header, diagMini, backupCard, cards);
  return section;
};
