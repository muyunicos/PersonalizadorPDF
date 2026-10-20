/**
 * Puerta Node del contrato del selector visual (spec 016 + spec 021).
 *
 * F0 (Cropper RETIRADO): la spec 021 reemplazo el motor de recorte por el
 * canvas unificado de `selector-pmu.js` (3 modos, margen del 10%, doble guia),
 * asi que Cropper.js 1.6.2 quedo SIN USO y se retiro: el vendor
 * `assets/vendor/cropper/` ya no existe y el plugin no lo encola en ninguna
 * pagina. Esta fase lo congela para que no vuelva por accidente. Ademas
 * congela el CONTRATO publico de `selector-pmu.js` (el que consumen
 * cargador-pmu y tienda.js): si una fase futura lo rompe, esta puerta lo
 * atrapa antes del navegador.
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

console.log('== F0: Cropper.js RETIRADO (spec 021) ==');
check('el vendor assets/vendor/cropper/ ya no existe', !fs.existsSync(VENDOR));
check('el plugin no encola cropper (ni JS ni CSS)',
  !/personalizador-pdf-cropper/.test(plugin) && !/vendor\/cropper/.test(plugin));
check('selector-pmu se encola SIN dependencias',
  /'personalizador-pdf-selector'[\s\S]{0,200}\[\],/.test(plugin));
check('ningun JS del plugin referencia Cropper',
  !/Cropper/.test(selector) && !/Cropper/.test(cargador));
check('el plugin no sirve el vendor por CDN',
  !/https?:\/\/[^'"\s]*cropper\.min\.js/.test(plugin));

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

console.log('\n== F1: shell del modal y controles intuitivos (spec 021) ==');
check('drop zone (soltar el archivo sobre el modal)',
  /dragover/.test(selector) && /dataTransfer\s*&&\s*e\.dataTransfer\.files/.test(selector));
check('al abrir dispara directo la apertura de archivo',
  /opciones\.abrirArchivo !== false/.test(selector) && /\$\('\.spmu-file'\)\.click\(\)/.test(selector));
check('full-screen movil con safe-area', /max-width:767px/.test(selector)
  && /env\(safe-area-inset-top\)/.test(selector) && /100dvh/.test(selector));
check('scroll de fondo bloqueado mientras esta abierto', /spmu-bloqueado/.test(selector)
  && /classList\.add\('spmu-bloqueado'\)/.test(selector)
  && /classList\.remove\('spmu-bloqueado'\)/.test(selector));
check('estado de carga y de subida con spinner (sin boton Reintentar ni Camara)',
  /spmu-cargando/.test(selector) && /Cargando imagen/.test(selector)
  && /Subiendo imagen/.test(selector)
  && !/spmu-reintentar/.test(selector) && !/spmu-camara/.test(selector));
check('boton Cargar imagen que cambia a Cambiar imagen cuando hay imagen',
  /Cargar imagen/.test(selector) && /Cambiar imagen/.test(selector));
check('boton Subir (antes Aceptar) + modal para subir otra imagen si quedan espacios',
  />Subir<\/button>/.test(selector) && /Subiendo\.\.\./.test(selector)
  && /spmu-otra-modal/.test(selector) && /spmu-otra-si/.test(selector));
check('Spec 024 D3: control "Escala" al 100% y SIN boton de reset',
  /<span class="spmu-lb-zoom">Escala<\/span>/.test(selector)
  && /class="spmu-zoom"[^>]*min="-100" max="/.test(selector)
  && selector.indexOf('spmu-zoom-reset') === -1
  && !/Reducir \/ Ampliar/.test(selector));
check('Spec 024 D1/D2: titulo sin medidas y badge solo con `tecnico`',
  /: 'Ajuste la imagen';/.test(selector)
  && /\(this\.config\.tecnico/.test(selector)
  && /spmu-badge/.test(selector));
check('Spec 024 D4/D5/D6/D7: modos resetean Escala, fondo auto, Girar y acciones separadas',
  /self\._setZoom\(1\);/.test(selector)
  && /spmu-fondo-auto/.test(selector)
  && /fondoEsAuto = true/.test(selector)
  && /class="spmu-acciones-izq"/.test(selector)
  && /class="spmu-acciones-der"/.test(selector)
  && selector.indexOf('spmu-fila-extra') < selector.indexOf('spmu-rotar')
  && selector.indexOf('spmu-rotar') < selector.indexOf('class="spmu-acciones"')
  && selector.indexOf('spmu-cancelar') < selector.indexOf('button button-primary spmu-ok'));
check('3 botones de modo: Rellenar, Ajustar, Estirar',
  /data-modo="rellenar">Rellenar/.test(selector)
  && /data-modo="ajustar">Ajustar/.test(selector)
  && /data-modo="estirar">Estirar/.test(selector));
check('focus trap con Tab/Shift+Tab y restauracion del foco',
  /_trampaFoco/.test(selector) && /e\.key === 'Tab'/.test(selector)
  && /_focoPrevio/.test(selector));

console.log('\n== F2: Geometria de escena 10%, 3 modos, regla del 5% y fondo por bordes (spec 021) ==');
const SelectorMod = require(path.join(RAIZ, 'assets', 'selector-pmu.js'));
const puro = SelectorMod.puro || {};
check('expone SelectorPMU.puro con las funciones puras',
  typeof puro.geometriaEscena === 'function'
  && typeof puro.calcularCajaEscena === 'function'
  && typeof puro.superaCincoPorciento === 'function'
  && typeof puro.colorPredominanteBordes === 'function');

const ej1 = puro.geometriaEscena(20, 30, { forma: 'circulo' });
check('Ejemplo 1: placeholder 20x30 -> spmu-canvas 24x36, secundario 20x30, principal circulo 20x20',
  ej1.canvasW === 24 && ej1.canvasH === 36
  && ej1.secundario.w === 20 && ej1.secundario.h === 30 && ej1.secundario.x === 2 && ej1.secundario.y === 3
  && ej1.principal.tipo === 'circulo' && ej1.principal.w === 20 && ej1.principal.h === 20);

const envDummy = { par: 0, subs: [{ m: [0, 0], s: [['l', 1, 0], ['l', 1, 1]], c: 1 }] };
const ej2 = puro.geometriaEscena(500, 500, { forma: 'auto', envoltura: envDummy, size: 0.8, ox: 10, oy: -5 });
check('Ejemplo 2: placeholder 500x500 -> spmu-canvas 600x600, secundario 500x500, principal envoltura posicionado',
  ej2.canvasW === 600 && ej2.canvasH === 600
  && ej2.secundario.w === 500 && ej2.secundario.h === 500 && ej2.secundario.x === 50 && ej2.secundario.y === 50
  && ej2.principal.tipo === 'envoltura' && ej2.principal.w === 400 && ej2.principal.h === 400
  && ej2.principal.ox === 10 && ej2.principal.oy === -5);

const fCuad = puro.geometriaEscena(100, 200, { forma: 'cuadrado' });
const fOvalo = puro.geometriaEscena(100, 200, { forma: 'ovalo' });
const fAutoSin = puro.geometriaEscena(100, 200, { forma: 'auto', envoltura: null });
check('Formas cuadrado (100x100), ovalo (100x200) y auto sin envoltura (-> rectangulo)',
  fCuad.principal.tipo === 'cuadrado' && fCuad.principal.w === 100 && fCuad.principal.h === 100
  && fOvalo.principal.tipo === 'ovalo' && fOvalo.principal.w === 100 && fOvalo.principal.h === 200
  && fAutoSin.principal.tipo === 'rectangulo');

const cajaGrande = puro.calcularCajaEscena(2000, 1000, 1400, 1200);
const cajaMovil = puro.calcularCajaEscena(500, 1000, 320, 600);
check('spmu-escena ocupa hasta 1000x1000 y se achica sin perder relacion de aspecto',
  cajaGrande.w === 1000 && cajaGrande.h === 500
  && cajaMovil.w === 300 && cajaMovil.h === 600);

check('Regla del 5%: hasta 5% devuelve false (solo modo Estirar); >5% devuelve true (3 modos)',
  puro.superaCincoPorciento(1000, 1000, 1000, 1000) === false
  && puro.superaCincoPorciento(1040, 1000, 1000, 1000) === false
  && puro.superaCincoPorciento(1000, 1040, 1000, 1000) === false
  && puro.superaCincoPorciento(1200, 1000, 1000, 1000) === true
  && puro.superaCincoPorciento(1000, 1300, 1000, 1000) === true);

const pxOpacos = new Uint8ClampedArray([
  240, 20, 30, 255,  240, 20, 30, 255,
  240, 20, 30, 255,  240, 20, 30, 255
]);
const pxTransp = new Uint8ClampedArray([
  240, 20, 30, 0,    240, 20, 30, 0,
  240, 20, 30, 255,  240, 20, 30, 255
]);
check('Color de fondo por bordes: detecta color predominante opaco y transparente si hay alfa bajo',
  puro.colorPredominanteBordes(pxOpacos, 2, 2) === '#f0141e'
  && puro.colorPredominanteBordes(pxTransp, 2, 2) === 'transparent');

console.log('\n== F2b: escala sin-ampliar (spec 023) ==');
// Con `ampliar` (default) la foto chica se agranda para encajar (hoy).
const sinCap = puro.escalaBase('ajustar', 300, 300, 1000, 500, false);
check('escala ampliar: foto 300x300 en hueco 1000x500 se agranda a 500x500',
  Math.round(sinCap.dw) === 500 && Math.round(sinCap.dh) === 500,
  sinCap.dw + 'x' + sinCap.dh);
// Con `sin-ampliar` la foto conserva su tamano natural.
const conCap = puro.escalaBase('ajustar', 300, 300, 1000, 500, true);
check('escala sin-ampliar: foto 300x300 en hueco 1000x500 queda 300x300',
  Math.round(conCap.dw) === 300 && Math.round(conCap.dh) === 300,
  conCap.dw + 'x' + conCap.dh);
// Una foto grande REDUCE igual (min(1, ...) no toca una reduccion).
const reduce = puro.escalaBase('ajustar', 2000, 2000, 1000, 500, true);
check('escala sin-ampliar: foto 2000x2000 en hueco 1000x500 reduce a 500x500',
  Math.round(reduce.dw) === 500 && Math.round(reduce.dh) === 500,
  reduce.dw + 'x' + reduce.dh);
// Rellenar/Estirar tampoco pueden agrandar con el cap activo.
const rell = puro.escalaBase('rellenar', 300, 300, 1000, 500, true);
const est = puro.escalaBase('estirar', 300, 300, 1000, 500, true);
check('escala sin-ampliar: Rellenar y Estirar tampoco superan el tamano natural',
  Math.round(rell.dw) === 300 && Math.round(rell.dh) === 300
  && Math.round(est.dw) === 300 && Math.round(est.dh) === 300);
check('modal: con sin-ampliar los modos y Girar se ocultan y el slider capa a 0',
  /if \(sinAmpliar\) \{ modosEl\.hidden = true; \}/.test(selector)
  && /rotarEl\.hidden = sinAmpliar \|\|/.test(selector)
  && /escala === 'sin-ampliar' \? '0' : '100'/.test(selector));
check('el cargador pasa escala al selector (spec 023)', /escala: r\.escala/.test(cargador));

console.log('\n== F3: badge en vivo y guias (US3) ==');
check('badge Origen + Salida con zoom en vivo', /spmu-badge/.test(selector)
  && /Origen /.test(selector) && /Salida /.test(selector) && /toFixed\(/.test(selector));
check('Spec 024 fix 4.15.1: Girar solo con r:1 Y lienzo NO cuadrado (sin el 5%)',
  /sinAmpliar \|\| !\(tieneImg && this\.config\.rotar/.test(selector)
  && /&& this\.config\.finalW !== this\.config\.finalH\)/.test(selector)
  && selector.indexOf('tieneImg && this.supera5 && this.config.rotar') === -1);
check('Spec 024 fix 4.15.1: al girar se recalcula el 5% (no deforma en Estirar)',
  /this\.supera5 = superaCincoPorciento\(dim\.w, dim\.h/.test(selector)
  && /if \(this\.supera5 && this\.config\.mode === 'estirar'\)/.test(selector));

console.log('\n== F4: tira visual y mini galeria del cargador (spec 021 D9) ==');
const cargador16 = fs.readFileSync(path.join(RAIZ, 'assets', 'cargador-pmu.js'), 'utf8');
const tienda16 = fs.readFileSync(path.join(RAIZ, 'assets', 'tienda.js'), 'utf8');
check('miniaturas reales: la mini pinta un <img> con la URL resuelta',
  /_pintarMini/.test(cargador16) && /createElement\('img'\)/.test(cargador16)
  && /object-fit:cover/.test(cargador16));
check('el cargador NO conoce el endpoint (urlDe lo resuelve el llamador)',
  /urlDe: typeof config\.urlDe/.test(cargador16) && /config\.urlDe\(id\)/.test(cargador16));
check('Spec 021 D9: tocar una miniatura abre la mini galeria fullscreen (cpmu-visor)',
  /_miniTocar/.test(cargador16) && /this\._abrirVisor\(indice, posicion\)/.test(cargador16)
  && /cpmu-visor/.test(cargador16) && /cpmu-visor-prev/.test(cargador16)
  && /cpmu-visor-next/.test(cargador16));
check('Spec 021 D9: el visor permite Reemplazar (avisando que imagen reemplaza) y Eliminar',
  /cpmu-visor-reemplazar/.test(cargador16) && /cpmu-visor-eliminar/.test(cargador16)
  && /Reemplazando imagen #/.test(cargador16)
  && /ids\[posicion\] = String\(id\)/.test(cargador16));
check('Spec 021 D9: cancelar el reemplazo vuelve a la galeria con la foto actual',
  /err\.code === 'CROP_ABORTED'/.test(cargador16)
  && /reemp && reemp\.desdeVisor/.test(cargador16)
  && /self\._abrirVisor\(reemp\.indice, reemp\.posicion\)/.test(cargador16));
check('FR-017: restauracion de ids al montar (acotada por max)',
  /idsIniciales/.test(cargador16) && /slice\(0, this\.config\.ranuras\[i\]\.max\)/.test(cargador16));
check('tienda.js pasa idsIniciales y urlDe (endpoint de la 012)',
  /var idsIniciales = opts\.idsIniciales;/.test(tienda16)
  && /urlDeSubida\(ses\.sid, ses\.item_key, id\)/.test(tienda16));
check('idsDe normaliza array, string unico y JSON de ids', /function idsDe\(v\)/.test(tienda16)
  && /JSON\.parse\(s\)/.test(tienda16));
check('Spec 021: la tira de la ficha queda limpia (lo tecnico solo con `tecnico`)',
  /if \(this\.config\.tecnico\) \{/.test(cargador16)
  && cargador16.indexOf('cpmu-guia') === -1
  && cargador16.indexOf('cpmu-listo') === -1);

console.log('\n== F5: doble guia de recorte y envoltura del PDF (spec 016 F6 + spec 021) ==');
check('config.envoltura es opcional y se valida',
  /function envolturaValida\(e\)/.test(selector)
  && /envoltura: envolturaValida\(config\.envoltura\)/.test(selector));
check('la guia es un canvas SEPARADO (pointer-events:none + aria-hidden)',
  /\.spmu-envoltura\{position:absolute;inset:0;width:100%;height:100%;pointer-events:none/.test(selector)
  && /<canvas class="spmu-envoltura"/.test(selector) && /aria-hidden="true"><\/canvas>/.test(selector));
check('reusa la geometria del nucleo (una sola fuente)',
  /core\.comandosEnvoltura\(/.test(selector) && /core\.trazarEnvoltura\(/.test(selector));
check('Spec 024 D8: la guia NO oscurece (sin velos; zona libre transparente)',
  /Spec 024 \(D9\): con la mascara de inspeccion/.test(selector)
  && !/rgba\(0, 0, 0, 0\.35\)/.test(selector)
  && !/rgba\(0, 0, 0, 0\.32\)/.test(selector)
  && !/fill\('evenodd'\)/.test(selector));
check('Spec 024 D9: ojito con mascara blanca pura, solo si la forma recorta',
  /spmu-ojo/.test(selector) && /_mascaraRecorte/.test(selector)
  && /ctx\.fillStyle = '#ffffff'/.test(selector)
  && /ojo\.hidden = !recorta/.test(selector));
check('Spec 024 fix 4.15.1: el ojito decide por TIPO de forma (no por la caja)',
  /var recorta = geo\.principal\.tipo !== 'rectangulo'/.test(selector)
  && /this\.config\.size < 1/.test(selector)
  && /this\.config\.ox !== 0/.test(selector)
  && /this\.config\.oy !== 0/.test(selector)
  && !/prin\.w < sec\.w - 0\.5/.test(selector));
check('Spec 024 fix 4.15.1: `hidden` gana al .button de WordPress',
  /\.spmu-caja \[hidden\]\{display:none !important\}/.test(selector));
check('el PNG de salida sale de _generarLienzoSalida(finalW, finalH) sin tocar el overlay',
  /_generarLienzoSalida = function/.test(selector)
  && /this\._pintarImagenEnContexto\(ctx, false\)/.test(selector)
  && /this\.ctxEnvoltura/.test(selector));
check('sin PMUMockup degrada sin lanzar',
  /typeof core\.comandosEnvoltura === 'function'/.test(selector));
check('close() remueve el listener de resize (sin fugas)',
  /removeEventListener\('resize', this\._onResize\)/.test(selector));
check('T027: el cargador pasa la envoltura, forma, r, size, ox, oy al selector',
  /envoltura: this\.config\.envoltura \|\| null/.test(cargador)
  && /forma: r\.forma/.test(cargador) && /size: r\.size/.test(cargador));
check('Spec 021: la guia de la tira se retiro (la geometria vive en el modal)',
  /_guia = function/.test(cargador) === false
  && /comandosEnvoltura/.test(cargador) === false
  && /comandosEnvoltura\(/.test(selector));

console.log('');
if (fallos) {
  console.log('SELECTOR CONTRATO FALLA (' + fallos + ' checks en rojo)');
  process.exit(1);
}
console.log('SELECTOR CONTRATO OK (F0-F5)');
