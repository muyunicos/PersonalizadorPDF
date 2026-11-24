# Contrato UI: Vista previa del placeholder (admin)

## Alcance
Describe el comportamiento observable del recuadro `.ec-preview.ec-checker.ec-marco-btn` del acordeón Placeholders y su espejo en el editor de mockups. No define API HTTP.

## Datos expuestos por el panel (PHP → DOM)
- `.ec-panel-grupo[data-id][data-w][data-h][data-tiene]` + **nuevo** `data-cont` (instancias), `data-campo` (id de campo asociado, 0 si ninguno).
- `.ec-preview[data-id][data-ver][data-vw][data-vh]` (vigente) + contenedor para el cargador y las flechas.

## Comportamiento
1. Al abrir, por grupo:
   - `tipo=imagen` con campo → monta `CargadorPMU` (recorte real) en `.ec-col-media`; `tecnico:true`.
   - `tipo=texto` con render → muestra `cfg.previews[gid]`.
   - sin campo imagen / tipo clásico → comportamiento actual (marco/imagen subida).
   - tipo futuro → fallback genérico (sin romper).
2. `cont>1` → flechas ‹ › (patrón visor) visibles; `cont<=1` → ocultas.
3. `onRecorte(id,url,receta)` → pinta el recorte en `.ec-preview` y publica `pmu:preview-listo` con `{id, url, w, h, instancia}`.
4. "Probar" (texto) → publica `pmu:preview-listo` (vigente).
5. Fallo → `.ec-subida-status`/`.ec-texto-status` con causa; nunca pantalla en blanco.

## Espejo en el editor (mockups.js)
- Escucha `pmu:preview-listo` y repinta las capas placeholder del grupo/instancia.
- Interruptor "Alternar PH" (`estado.verTexto`): activo → contenido real; inactivo → caja neutra.
- `resolverCapa` placeholder usa la MISMA fuente que la vista previa (recorte local o render), no solo `cfg.previews`.

## Salida de muestra (Procesar PDF)
- El recorte/receta por instancia se compone en navegador y el Motor inyecta los PNGs resultantes en la muestra.
- La muestra NO se entrega al comprador.

## Compatibilidad
- Sin `data-campo` o sin campo imagen → flujo clásico intacto.
- Clase `ec-acordeon-mockups` conservada (ancla de inyección y test de navegador).