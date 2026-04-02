/**
 * Verificación operativa del dominio del wizard Alta OT Clima (sin navegador).
 * Ejecutar: node scripts/hnf-ot-create-flow-verify.mjs
 */
import {
  buildOtCreateWorkspacePayload,
  getOtCreateWorkspaceStageForSubmitErrors,
  OT_CREATE_WORKSPACE_STAGE_COUNT,
  validateOtCreateWorkspaceStage,
  validateOtCreateWorkspaceSubmit,
} from '../frontend/domain/ot-create-workspace.js';

const fail = (msg) => {
  console.error('[FAIL]', msg);
  process.exitCode = 1;
};

const pass = (msg) => console.log('[OK]', msg);

const mkForm = (fields) => {
  const elements = { ...fields };
  for (const k of Object.keys(elements)) {
    if (elements[k] == null || typeof elements[k] !== 'object' || !('value' in elements[k])) {
      elements[k] = { value: elements[k] ?? '' };
    }
  }
  return {
    elements: new Proxy(elements, {
      get(t, p) {
        if (p in t) return t[p];
        return { value: '' };
      },
    }),
  };
};

const minimalValidFields = () => ({
  cliente: { value: 'Cliente Test' },
  direccion: { value: 'Calle 1' },
  comuna: { value: 'Santiago' },
  contactoTerreno: { value: 'Juan' },
  telefonoContacto: { value: '+56900000000' },
  fecha: { value: '2026-04-15' },
  hora: { value: '10:00' },
  tipoServicio: { value: 'clima' },
  subtipoServicio: { value: 'Mantención' },
  origenPedidoWs: { value: 'llamada' },
  canalWs: { value: 'llamada' },
  origenSolicitudCreate: { value: 'cliente_directo' },
  prioridadOperativaCreate: { value: 'media' },
  operationModeWs: { value: 'manual' },
  tecnicoPreset: { value: 'Por asignar' },
});

// --- Caso 4: fallo por paso (0–2); 3–5 sin reglas en Siguiente
for (let s = 0; s <= 2; s++) {
  const v = validateOtCreateWorkspaceStage(mkForm({}), s);
  if (v.ok || Object.keys(v.errors).length === 0) {
    fail(`Paso ${s}: se esperaba fallo con formulario vacío`);
  } else {
    pass(`Paso ${s}: validación vacía → ${Object.keys(v.errors).length} error(es)`);
  }
}
for (let s = 3; s < OT_CREATE_WORKSPACE_STAGE_COUNT; s++) {
  const v = validateOtCreateWorkspaceStage(mkForm(minimalValidFields()), s);
  if (!v.ok) fail(`Paso ${s}: sin validación obligatoria esperada ok`);
  else pass(`Paso ${s}: Siguiente sin bloqueos (dominio)`);
}

// WhatsApp requiere número y nombre
const waBad = mkForm({
  ...minimalValidFields(),
  origenSolicitudCreate: { value: 'whatsapp' },
  whatsappNumeroCreate: { value: '' },
  whatsappNombreCreate: { value: '' },
});
const vWa = validateOtCreateWorkspaceStage(waBad, 2);
if (vWa.ok || !vWa.errors.whatsappNumeroCreate) fail('Paso 2 WhatsApp: faltan errores esperados');
else pass('Paso 2: origen WhatsApp exige número y nombre');

// Submit: incompleto
const subBad = validateOtCreateWorkspaceSubmit(mkForm({ cliente: { value: 'x' } }));
if (subBad.ok) fail('Submit con datos incompletos debería fallar');
else pass(`Submit incompleto → etapa sugerida ${getOtCreateWorkspaceStageForSubmitErrors(subBad.errors)}`);

// Submit + payload completo
const full = mkForm(minimalValidFields());
const subOk = validateOtCreateWorkspaceSubmit(full);
if (!subOk.ok) fail(`Submit válido falló: ${JSON.stringify(subOk.errors)}`);
else pass('Submit: todos los mínimos OK');

const payload = buildOtCreateWorkspacePayload(full, [], () => 'Por asignar');
if (!payload.cliente || !payload.fecha || !payload.tipoServicio) fail('Payload incompleto');
if (!payload.origenPedido || !payload.prioridadOperativa) fail('Payload pedido incompleto');
pass(`Payload: id=${payload.id ?? '(auto)'} cliente=${payload.cliente}`);

console.log('\nResumen dominio: si ves solo [OK], la capa validate/payload es coherente con el contrato.');
console.log('Pruebas UI (1,2,3,6–10) requieren navegador + backend; revisar manualmente o E2E futuro.\n');
