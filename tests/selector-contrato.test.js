/**
 * Puerta Node del contrato del selector visual (spec 016).
 *
 * F0 (vendor + encolado): verifica que Cropper.js 1.6.2 esta vendoreado e
 * integro, que el plugin lo encola con el handle esperado y que selector-pmu
 * lo declara como dependencia. Ademas congela el CONTRATO publico de
 * `selector-pmu.js` (el que consumen cargador-pmu y tienda.js): si una fase
 * futura lo rompe, esta puerta lo atrapa antes del navegador.
 *
 * Las fases F1-F5 agregaran aqui las secciones de su comportamiento.
 */
'use strict';
const fs = require('fs');
const path = require('path');

let fallos = 0;
function check(nombre, ok, extra) {
  if (!ok) { fallos++; }
  console.log((ok ? '  OK   ' : '  FALLA ') + nombre + (extra ? '  [' + extra + ']' : ''));
}

const RAIZ = path.join(__dirname, '..');
const VENDOR = path.join(RAIZ, 'assets', 'vendor', 'cropper');
const plugin = fs.readFileSync(path.join(RAIZ, 'personalizador-pdf.php'), 'utf8');
const selector = fs.readFileSync(path.join(RAIZ, 'assets', 'selector-pmu.js'), 'utf8');
const cargador = fs.readFileSync(path.join(RAIZ, 'assets', 'cargador-pmu.js'), 'utf8');

console.log('== F0: Cropper.js vendoreado (assets/vendor/cropper/) ==');
check('cropper.min.js existe', fs.existsSync(path.join(VENDOR, 'cropper.min.js')));
check('cropper.min.css existe', fs.existsSync(path.join(VENDOR, 'cropper.min.css')));
check('LICENSE existe', fs.existsSync(path.join(VENDOR, 'LICENSE')));
check('ORIGEN.md existe (trazabilidad de version y hash)',
  fs.existsSync(path.join(VENDOR, 'ORIGEN.md')));
check('cropper.min.js tiene el peso exacto de 1.6.2 (37369)',
  fs.existsSync(path.join(VENDOR, 'cropper.min.js'))
  && fs.statSync(path.join(VENDOR, 'cropper.min.js')).size === 37369,
  fs.existsSync(path.join(VENDOR, 'cropper.min.js'))
    ? String(fs.statSync(path.join(VENDOR, 'cropper.min.js')).size) : 'ausente');
check('cropper.min.css tiene el peso exacto de 1.6.2 (3795)',
  fs.existsSync(path.join(VENDOR, 'cropper.min.css'))
  && fs.statSync(path.join(VENDOR, 'cropper.min.css')).size === 3795);

console.log('\n== F0: encolado en el plugin (assets_ficha) ==');
check('encola el JS con handle personalizador-pdf-cropper',
  /'personalizador-pdf-cropper'[\s\S]{0,400}assets\/vendor\/cropper\/cropper\.min\.js/.test(plugin));
check('encola el CSS con handle personalizador-pdf-cropper',
  /wp_enqueue_style\([\s\S]{0,200}'personalizador-pdf-cropper'[\s\S]{0,200}cropper\.min\.css/.test(plugin));
check('selector-pmu declara a cropper como dependencia',
  /'personalizador-pdf-selector'[\s\S]{0,300}\['personalizador-pdf-cropper'\]/.test(plugin));
check('el vendor no se sirve por CDN (sin http en la ruta)',
  /vendor\/cropper\/cropper\.min\.(js|css)/.test(plugin) && !/https?:\/\/[^'"\s]*cropper\.min\.js/.test(plugin));

console.log('\n== Contrato publico de selector-pmu (lo consumen cargador/tienda) ==');
check('expone window.SelectorPMU', /global\.SelectorPMU\s*=\s*SelectorPMU/.test(selector));
check('conserva open()', /SelectorPMU\.prototype\.open\s*=/.test(selector));
check('conserva onSelect(callback)', /SelectorPMU\.prototype\.onSelect\s*=/.test(selector));
check('conserva onError(callback)', /SelectorPMU\.prototype\.onError\s*=/.test(selector));
check('conserva obtenerBlob()', /SelectorPMU\.prototype\.obtenerBlob\s*=/.test(selector));
check('conserva close() y destroy()', /SelectorPMU\.prototype\.close\s*=/.test(selector)
  && /SelectorPMU\.prototype\.destroy\s*=/.test(selector));
check('el constructor sigue exigiendo finalW/finalH (lo define el campo/PDF)',
  /finalW\/finalH son obligatorios/.test(selector));
check('cargador-pmu sigue instanciando por la superficie publica (sin tocar el contrato)',
  /typeof global\.SelectorPMU !== 'function'/.test(cargador)
  && /new global\.SelectorPMU\(null, \{/.test(cargador)
  && /finalW: r\.w/.test(cargador));

console.log('\n== F1: shell del modal (US1) ==');
check('drop zone (soltar el archivo sobre el modal)',
  /dragover/.test(selector) && /dataTransfer\s*&&\s*e\.dataTransfer\.files/.test(selector));
check('camara en movil (input con capture)', /spmu-camara-file/.test(selector)
  && /capture="environment"/.test(selector));
check('full-screen movil con safe-area', /max-width:767px/.test(selector)
  && /env\(safe-area-inset-top\)/.test(selector) && /100dvh/.test(selector));
check('scroll de fondo bloqueado mientras esta abierto', /spmu-bloqueado/.test(selector)
  && /classList\.add\('spmu-bloqueado'\)/.test(selector)
  && /classList\.remove\('spmu-bloqueado'\)/.test(selector));
check('estado de carga con spinner y error con reintento',
  /spmu-cargando/.test(selector) && /spmu-reintentar/.test(selector)
  && /Cargando imagen/.test(selector));
check('focus trap con Tab/Shift+Tab y restauracion del foco',
  /_trampaFoco/.test(selector) && /e\.key === 'Tab'/.test(selector)
  && /_focoPrevio/.test(selector));
check('FR-006: degrada sin window.Cropper (canvas + slider intactos)',
  /typeof global\.Cropper === 'function'/.test(selector)
  && /spmu-zoom/.test(selector) && /spmu-modo/.test(selector));

console.log('\n== F2: Cropper en el modo crop (US2) ==');
check('config de Cropper: viewMode, aspectRatio, tercios, doble tap, rotable',
  /viewMode: 1/.test(selector) && /aspectRatio: this\.config\.aspectRatio \|\| NaN/.test(selector)
  && /guides: true/.test(selector) && /dblclick: true/.test(selector) && /rotatable: true/.test(selector));
check('la salida sale de getCroppedCanvas(finalW, finalH)',
  /getCroppedCanvas\(\{/.test(selector) && /width: this\.config\.finalW/.test(selector)
  && /height: this\.config\.finalH/.test(selector) && /imageSmoothingQuality: 'high'/.test(selector));
check('rotar 90 por boton (FR-010)', /cropper\.rotate\(90\)/.test(selector));
check('rotacion por gesto de 2 dedos (FR-010)', /rotateTo\(/.test(selector)
  && /atan2\(/.test(selector) && /originalEvent\.touches/.test(selector));
check('T012: cropper.destroy() al cerrar (sin fugas)', /cropper\.destroy\(\)/.test(selector)
  && /_destruirCropper/.test(selector));
check('el modo fit conserva el canvas original (D9)',
  /mode === 'fit'/.test(selector) && /Math\.min\(w \/ iw, h \/ ih\)/.test(selector)
  && /spmu-canvas/.test(selector));

console.log('\n== F3: badge en vivo y guias (US3) ==');
check('badge Origen + Salida con zoom en vivo', /spmu-badge/.test(selector)
  && /Origen /.test(selector) && /Salida /.test(selector) && /toFixed\(1\)/.test(selector));
check('el zoom del badge sale de Cropper (getImageData)', /getImageData\(\)/.test(selector)
  && /scaleX/.test(selector));

console.log('\n== F4: tira visual del cargador (US4) ==');
const cargador16 = fs.readFileSync(path.join(RAIZ, 'assets', 'cargador-pmu.js'), 'utf8');
const tienda16 = fs.readFileSync(path.join(RAIZ, 'assets', 'tienda.js'), 'utf8');
check('miniaturas reales: la mini pinta un <img> con la URL resuelta',
  /_pintarMini/.test(cargador16) && /createElement\('img'\)/.test(cargador16)
  && /object-fit:cover/.test(cargador16));
check('el cargador NO conoce el endpoint (urlDe lo resuelve el llamador)',
  /urlDe: typeof config\.urlDe/.test(cargador16) && /config\.urlDe\(id\)/.test(cargador16));
check('FR-016: tocar marca para confirmar y la 2da tocada quita',
  /cpmu-mini-alto/.test(cargador16) && /_miniTocar/.test(cargador16)
  && /this\._quitar\(indice, posicion\)/.test(cargador16));
check('FR-016: "Cambiar" reabre el editor y reemplaza sin sumar',
  /_cambiar/.test(cargador16) && /_reemplazo = \{ indice: indice, posicion: posicion \}/.test(cargador16)
  && /ids\[posicion\] = String\(id\)/.test(cargador16));
check('FR-017: restauracion de ids al montar (acotada por max)',
  /idsIniciales/.test(cargador16) && /slice\(0, this\.config\.ranuras\[i\]\.max\)/.test(cargador16));
check('tienda.js pasa idsIniciales y urlDe (endpoint de la 012)',
  /var idsIniciales = opts\.idsIniciales;/.test(tienda16)
  && /urlDeSubida\(ses\.sid, ses\.item_key, id\)/.test(tienda16));
check('idsDe normaliza array, string unico y JSON de ids', /function idsDe\(v\)/.test(tienda16)
  && /JSON\.parse\(s\)/.test(tienda16));

console.log('\n== F5: envoltura del PDF como guia (spec 016 F6) ==');
check('config.envoltura es opcional y se valida',
  /function envolturaValida\(e\)/.test(selector)
  && /envoltura: envolturaValida\(config\.envoltura\)/.test(selector));
check('sin envoltura no se agrega DOM',
  /if \(!this\.config\.envoltura\) \{ return ''; \}/.test(selector)
  && /if \(!this\.config\.envoltura\) \{ return; \}/.test(selector));
check('la guia es un canvas SEPARADO (pointer-events:none + aria-hidden)',
  /\.spmu-envoltura\{position:absolute;pointer-events:none/.test(selector)
  && /<canvas class="spmu-envoltura" aria-hidden="true"><\/canvas>/.test(selector));
check('reusa la geometria del nucleo (una sola fuente)',
  /core\.comandosEnvoltura\(/.test(selector) && /core\.trazarEnvoltura\(/.test(selector));
check('oscurece SOLO fuera de la forma (destination-out y restaura)',
  /destination-out/.test(selector)
  && /globalCompositeOperation = 'source-over'/.test(selector)
  && /fill\(env\.par \? 'evenodd' : 'nonzero'\)/.test(selector));
check('el PNG de salida NO pasa por el overlay (getCroppedCanvas intacto)',
  /getCroppedCanvas\(/.test(selector)
  && !/getCroppedCanvas[\s\S]{0,200}env(oltura)?/.test(selector)
  && /this\.ctxEnvoltura/.test(selector));
check('crop: caja de preview en vivo via la opcion preview de Cropper',
  /opciones\.preview = prev/.test(selector) && /spmu-preview-caja/.test(selector));
check('fit/degradacion: overlay medido sobre el canvas de salida',
  /_cajaEnvoltura = function/.test(selector)
  && /getBoundingClientRect\(\)/.test(selector));
check('sin PMUMockup degrada sin lanzar',
  /typeof core\.comandosEnvoltura !== 'function'/.test(selector));
check('close() remueve el listener de resize (sin fugas)',
  /removeEventListener\('resize', this\._onResize\)/.test(selector));
check('T027: el cargador pasa la envoltura al selector',
  /envoltura: this\.config\.envoltura \|\| null/.test(cargador));
check('la tira y el modal comparten la misma geometria',
  /_guia = function/.test(cargador) && /comandosEnvoltura/.test(cargador));

console.log('');
if (fallos) {
  console.log('SELECTOR CONTRATO FALLA (' + fallos + ' checks en rojo)');
  process.exit(1);
}
console.log('SELECTOR CONTRATO OK (F0-F5)');
