# hnf-master-bundle.real.json — notas de carga inicial

## Propósito

Primera carga **real** de referencia para Base maestra (import JSON en **Carga masiva**). No reemplaza contratos legales ni nómina contable; es **estructura operativa** lista para refinar.

## Por qué incluye `serviceCatalog`

El importador exige que cada ítem de `pricingCatalog` tenga un `serviceId` existente en `serviceCatalog` (mismo archivo o bundle previo). Por eso este fixture trae **ambos**, aunque el alcance pedido mencionara solo pricing.

## IDs principales (consistencia)

| Prefijo   | Uso |
|-----------|-----|
| `CLI-*`   | Clientes |
| `BR-*`    | Sucursales / tiendas |
| `CNT-*`   | Contactos externos cliente |
| `CTR-*`   | Contratos marco / referencia |
| `MF-*`    | Frecuencias de mantención HVAC Puma |
| `EMP-*`   | Personal HNF (no van en `clientContacts`) |
| `SRV-*`   | Servicios catálogo |
| `PRC-*`   | Precios / listas |
| `AST-*`   | Activos HVAC (cantidades 0 = pendiente inventario) |
| `PC-*`    | Costo empresa mensual referencial RRHH |

## Placeholders a reemplazar

- Correos `por-definir.*@import.hnf` y teléfonos `—` en contactos **cliente**.
- RUTs vacíos en clientes.
- Direcciones `—` en outlets/stores secundarios y sedes flota.
- `payrollCosts`: cifras **referenciales** (periodo `2026-03`); ajustar con liquidaciones reales.
- `pricingCatalog` CLP: valores orientativos; Granleasing con lista propia.

## Dominion

No se agregó contacto externo en `clientContacts` (no estaba en la lista provista); sede lógica `BR-DOM-SEDE` para contrato y futuras extensiones.

## Gonzalo

Nombre según especificación actual: **Gonzalo Valenzuela** (part time / apoyo).
