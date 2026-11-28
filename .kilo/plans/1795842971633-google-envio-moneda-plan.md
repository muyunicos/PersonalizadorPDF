# Plan — Corregir "La moneda de la información de envío no coincide" (Google for WooCommerce)

## Contexto
- 766 productos (15,3%) quedaron **No aprobado** en Google Merchant Center con el error
  *"La moneda de la información de envío no coincide"*.
- Google for WooCommerce auto-generó servicios de envío **0 ARS** para decenas de países
  (DE, AO, SA, DZ, AR, AU, AT…).
- El usuario confirma que los **precios** de los productos están en **ARS**.
- **No es un problema de código del repo `personalizador-pdf`** (único match de "google" es un
  comentario de TextMuy). Es configuración de WooCommerce + Google for WooCommerce en `wp-admin`
  y del feed que recibe Google. No se editan archivos del plugin.

## Objetivo
Que la moneda del envío coincida con la moneda del precio de **cada** producto y los 766 queden
**Aprobado** (o, si se decide, que el feed use la moneda correcta por país).

## Diagnóstico previo (obligatorio antes de "arreglar")
1. **Moneda de la tienda**: WooCommerce → Ajustes → General → Moneda. Anotar (esperado: ARS).
2. **Moneda real de los 766 rechazados**: Google Merchant Center → Productos → filtrar por
   "No aprobado" → abrir uno y mirar el atributo `price` (moneda). Confirmar si es ARS o USD.
   - Si es **ARS** → el desajuste está en la config de envío/Merchant (rama A).
   - Si es **USD u otra** → esos productos se publican en otra moneda (rama B).
3. **País objetivo del feed**: Merchant Center → Configuración → "País de venta"/feed target.
   ARS solo es válido para Argentina (AR); para DE/AU/etc. Google espera moneda local.

## Rama A — Precios ARS, envío mal registrado
1. Merchant Center → **Envíos y devoluciones** → editar los servicios auto-generados
   "Servicio generado por Google for WooCommerce" y fijar la **moneda en ARS** en todos.
2. Alternativa recomendada: **desactivar** el envío auto-generado multimoneda y dejar SOLO el
   envío para Argentina (AR) en ARS, si no se vende físicamente a esos 30+ países.
3. WooCommerce → Google for WooCommerce → sincronizar/forzar re-envío del feed.

## Rama B — Precios en USD (u otra) para esos productos
Elegir **una** y aplicarla de forma consistente:
- **B1 (recomendada si el negocio es Argentina)**: corregir esos productos a **ARS** en
  WooCommerce (precio + moneda), re-sincronizar.
- **B2 (si se vende al exterior)**: configurar el feed/Merchant por país de venta con la moneda
  local (USD para US, EUR para DE…) y que el envío de cada país use esa misma moneda.
- Quitar multi-moneda si un plugin conversor (Currency Switcher / WPML) está mezclando monedas.

## Validación
1. Merchant Center → Productos → el filtro "No aprobado" baja; los 766 pasan a **Aprobado**.
2. Revisar "Diagnóstico" de Merchant: sin incidencias de moneda de envío.
3. Verificar un producto de muestra: `price` y `shipping` con la **misma** moneda.
4. Confirmar que el envío aplicable (AR/ARS) sigue activo y el checkout no se rompe.

## Alcance / notas
- Fuera de alcance: cambios de código del plugin o del tema `muyunicos`.
- Requiere acceso a `wp-admin` (WooCommerce + Google for WooCommerce) y a Google Merchant Center;
  el agente de implementación NO puede operar la config live sin esos accesos.
- Decisión abierta a confirmar en ejecución: ¿se vende solo a Argentina (simplifica a ARS/AR) o a
  múltiples países (exige moneda por país)?