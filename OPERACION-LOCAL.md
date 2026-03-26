# Operación local — HNF / Jarvis

Guía corta para **Windows + notebook + iPad** (misma Wi‑Fi). Objetivo: arrancar todos los días con poca fricción y saber qué hacer si algo falla.

---

## 1. Cómo iniciar el sistema

Desde la **raíz del repo** (`Hnf-app`), en terminal:

| Comando | Qué hace |
|--------|-----------|
| `npm run start:all` | **Frontend + backend juntos** (recomendado día a día) |
| `npm run start:frontend` | Solo interfaz (Vite; típico `http://127.0.0.1:5173`) |
| `npm run start:backend` | Solo API (típico `http://127.0.0.1:4000`) |

### Windows — doble clic

- **`start-hnf.cmd`** (en la raíz del repo): abre una ventana que ejecuta `npm run start:all`.
- Requisitos: **Node.js** instalado y `npm` en el PATH.
- Dejá la ventana **abierta** mientras operás. **Ctrl+C** detiene ambos servicios.

El script **`scripts/start-all.mjs`** comprueba que existan `frontend/package.json` y `backend/package.json` antes de arrancar.

---

## 2. Flujo diario sugerido

1. Prender el notebook.  
2. Ejecutar **`start-hnf.cmd`** o **`npm run start:all`**.  
3. En el iPad, abrir la URL de la app (ver abajo).  
4. En **Jarvis Command Core**, revisar el bloque **Continuidad del sistema** (frontend/backend, URL, recuperación rápida).

---

## 3. Cómo abrir en iPad

1. Notebook e iPad en la **misma red Wi‑Fi**.  
2. En el notebook: `ipconfig` → anotá **IPv4** (ej. `192.168.4.109`).  
3. En el iPad: navegador → `http://<IPv4>:5173` (o el puerto que muestre la consola de Vite si no es 5173).  
4. Si la interfaz carga pero **no hay datos**: configurá `frontend/public/env.js` con `API_BASE_URL` apuntando al notebook, por ejemplo `http://192.168.4.109:4000`, **antes** de recargar la app.

En desarrollo, Vite hace **proxy** de la API hacia `127.0.0.1:4000` en la máquina donde corre Vite (ver `frontend/vite.config.js`). Desde el iPad el navegador habla con el **notebook**, no con `localhost` del iPad.

---

## 4. Si cambió la IP del notebook

- Volvé a ejecutar `ipconfig` y actualizá el favorito / URL en el iPad.  
- Si usás IP fija en `env.js`, actualizá **`API_BASE_URL`** a la nueva IP (puerto **4000** para la API).  
- Revisá **Firewall de Windows** → reglas entrantes para el puerto de Vite y **4000** en red **privada**.

---

## 5. “Sin conexión al servidor”

1. **Servicio afectado:** API backend. **Impacto:** la app no obtiene datos del servidor.  
2. Acción: en la raíz del repo → `npm run start:backend` o `npm run start:all` (o `start-hnf.cmd`).  
3. Probar en el notebook: `http://127.0.0.1:4000/health` → debe responder JSON con `status: ok`.  
4. Desde iPad: si solo fallan los datos, revisá **`env.js`** y firewall.

---

## 6. Recuperación rápida (resumen)

| Síntoma | Qué revisar |
|--------|----------------|
| Sin conexión | Backend arriba · `start:all` · `/health` |
| iPad no abre | IP correcta, no `localhost`, misma Wi‑Fi |
| IP cambió | URL en iPad + `env.js` si aplica |
| Puerto distinto | Usar la URL exacta que muestra Vite en consola |

En la app, desplegable **RECUPERACIÓN RÁPIDA** dentro de **Continuidad del sistema** repite estas pistas.

---

## 7. Autoarranque futuro (Windows)

Plantilla **solo comentada**, sin automatización agresiva:

- `scripts/future-windows-autostart.example.ps1`

Ahí podés copiar ideas para Programador de tareas o abrir navegador cuando estabilicés el flujo.

---

## 8. Documentación en el repo

- Este archivo: **`OPERACION-LOCAL.md`**  
- Arranque resumido en **`README.md`**
