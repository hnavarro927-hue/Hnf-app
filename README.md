# HNF Servicios Integrales

## Arranque desarrollo (rápido)

En la raíz del proyecto:

- **Todo junto:** `npm run start:all` (frontend + backend en paralelo; script `scripts/start-all.mjs`)
- **Solo UI:** `npm run start:frontend`
- **Solo API:** `npm run start:backend`
- **Windows (doble clic):** `start-hnf.cmd` — misma función que `start:all`, mensajes claros en consola

Detalle para iPad, IP, recuperación y fallos: **[OPERACION-LOCAL.md](./OPERACION-LOCAL.md)**.

---

Sistema operativo para la gestión de servicios de:

• Flota
• Climatización

## Administración
Hernan Navarro  
Lyn

## Coordinación
Gery – Flota  
Romina Silva – Clima

## Objetivo del sistema

Controlar digitalmente:

- órdenes de trabajo (OT)
- técnicos en terreno
- tiempos de trabajo
- kilometraje
- gastos operacionales
- fotografías de evidencia
- historial de servicios

## Roles del sistema

Administrador
Control total de la plataforma.

Coordinador
Gestión de operaciones y asignación de OT.

Técnico
Registro de trabajos en terreno.

## Reglas importantes

Los técnicos no deben ver costos internos.  
Cada OT debe registrar tiempo de traslado y tiempo de trabajo.  
Las OT deben incluir evidencia fotográfica.

Sistema diseñado para operación móvil y uso en iPad.
