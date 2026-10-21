/**
 * Puerta Node del contrato del selector visual (specs 016 a 028).
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
check('Spec 028: 3 botones de modo con icono + etiqueta: Cubrir, Encajar, Estirar',
  /data-modo="cubrir"/.test(selector) && />Cubrir<\/span><\/button>/.test(selector)
  && /data-modo="encajar"/.test(selector) && />Encajar<\/span><\/button>/.test(selector)
  && /data-modo="estirar"/.test(selector) && />Estirar<\/span><\/button>/.test(selector)
  && /spmu-ico-modo/.test(selector) && !/data-modo="rellenar"/.test(selector)
  && !/data-modo="ajustar"/.test(selector));
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

console.log('\n== F2d: politica de transparencia por campo (spec 027) ==');
check('expone resolverFondo (pura, sin DOM)',
  typeof puro.resolverFondo === 'function'
  && typeof puro.colorSolidoDeBordes === 'function');
// D1: sin politica, el comportamiento es el de hoy (el cliente decide).
check('Spec 027 D1: sin politica, el "auto" transparente se respeta',
  puro.resolverFondo('', 'transparent', '#ffffff', true, 'auto') === 'transparent'
  && puro.resolverFondo('', 'transparent', '#ffffff', false, 'auto') === 'transparent'
  && puro.resolverFondo('', '#f0141e', '#ffffff', true, 'auto') === '#f0141e');
// D2: `transp:'no'` -> NUNCA transparente.
check('Spec 027 D2: con transp:"no" el fondo nunca es transparente',
  puro.resolverFondo('no', 'transparent', '#ffffff', true, 'auto') === '#ffffff'
  && puro.resolverFondo('no', 'transparent', '#ff0000', true, 'auto') === '#ff0000'
  && puro.resolverFondo('no', '#00ff00', '#ffffff', true, 'auto') === '#00ff00');
// D3/D4: `transp:'si'` -> transparente solo si hay alfa real.
check('Spec 027 D3/D4: con transp:"si" hace falta alfa real',
  puro.resolverFondo('si', 'transparent', '#ffffff', true, 'auto') === 'transparent'
  && puro.resolverFondo('si', 'transparent', '#ff0000', false, 'auto') === '#ff0000'
  && puro.resolverFondo('si', '#00ff00', '#ffffff', false, 'auto') === '#00ff00');
// D5: el color elegido a mano siempre gana.
check('Spec 027 D5: el color elegido a mano gana sobre el "auto"',
  puro.resolverFondo('', '#f0141e', '#ffffff', true, '#123456') === '#123456'
  && puro.resolverFondo('si', 'transparent', '#ffffff', true, '#123456') === '#123456');
// El color solido de los bordes ignora los pixeles transparentes.
check('Spec 027: colorSolidoDeBordes ignora lo transparente',
  puro.colorSolidoDeBordes(pxOpacos, 2, 2) === '#f0141e'
  && puro.colorSolidoDeBordes(pxTransp, 2, 2) === '#f0141e');
// El codigo aplica la politica (oculta el damero y pone barrera final).
const selSrc = fs.readFileSync(path.join(RAIZ, 'assets', 'selector-pmu.js'), 'utf8');
check('Spec 027: con transp:"no" el boton "damero" se oculta y el fondo se fuerza opaco',
  /btnTr\.hidden = \(this\.config\.transp === 'no'\)/.test(selSrc)
  && /this\.config\.transp === 'no' && colorFondo === 'transparent'/.test(selSrc)
  && /self\.config\.transp === 'no'\) \{ return; \}/.test(selSrc));

console.log('\n== F2e: imagenes en WebP con fallback por firma (spec 026) ==');
const tiendaSrc = fs.readFileSync(path.join(RAIZ, 'assets', 'tienda.js'), 'utf8');
check('Spec 026: el selector emite WebP con fallback a PNG (solo si el servidor lo soporta)',
  typeof puro.esWebP === 'function'
  && /lienzoAWebP\(lienzo, 0\.85, terminar\)/.test(selSrc)
  && /servidorSoportaWebP\(\) \? 'image\/webp' : 'image\/png', q\);/.test(selSrc)
  && /webp_soportado === false/.test(selSrc)
  && /meta\.type = 'image\/png'/.test(selSrc) === false);
check('Spec 026 D10: el meta.type refleja el tipo REAL del blob (no un png fijo)',
  /var mime = \(tipo === 'webp'\) \? 'image\/webp' : 'image\/png';/.test(selSrc)
  && /type: mime,/.test(selSrc));
// Spec 029 (D1): las fotos ya NO se copian al pool: se REGISTRAN (la fila
// apunta a `subidas/`), asi que el cliente no las descarga ni las rasteriza.
check('Spec 029 D1: la foto se REGISTRA (sin copia ni rasterizado en el cliente)',
  tiendaSrc.indexOf('rasterizar') === -1 && tiendaSrc.indexOf('function subirFotos') === -1
  && /function registrarFotos/.test(tiendaSrc)
  && /fd\.append\('fotos', JSON\.stringify\(ids\)\)/.test(tiendaSrc)
  && /fila_archivo\(/.test(fs.readFileSync(path.join(RAIZ, 'inc', 'class-pmu-sesion.php'), 'utf8')));
// Spec 029 (D2): el texto del grupo se colapsa a UNA entrada cuando todas las
// instancias llevan lo mismo (el Motor la replica).
check('Spec 029 D2: el texto uniforme se renderiza/sube una vez por grupo',
  /function dedupPendientes/.test(tiendaSrc) && /p\.repite/.test(tiendaSrc)
  && /item\.p\.repite > 1\) \? 0 : item\.p\.i/.test(tiendaSrc));
// Spec 026 (D4) sigue vigente en el SERVIDOR: el texto del pool se convierte a
// WebP q0.92 al guardarlo.
check('Spec 026 D4/029: el texto del pool lo convierte el servidor a WebP q0.92',
  /convertir_webp\(\(string\)\$bytes, 92\)/.test(
    fs.readFileSync(path.join(RAIZ, 'inc', 'class-pmu-sesion.php'), 'utf8')
  ));
check('Spec 026 D2/D9: subirPool nombre + flag salen del tipo real; subirFoto no fuerza .png',
  /fd\.append\('webp', ext === 'webp' \? '1' : '0'\)/.test(tiendaSrc)
  && /gid \+ '\.' \+ ext/.test(tiendaSrc)
  && /'campo-' \+ campo \+ '\.' \+ extSubida/.test(tiendaSrc)
  && /'campo-' \+ campo \+ '\.png'/.test(tiendaSrc) === false);
check('Spec 026 D9: siguiente_n y limpiar cuentan TODOS los formatos (no solo png)',
  (() => {
    const fs2 = require('fs');
    const p2 = fs2.readFileSync(path.join(RAIZ, 'inc', 'class-pmu-sesion.php'), 'utf8');
    return /glob\(\$imgDir \. DIRECTORY_SEPARATOR \. \$prefijo \. '\*'\)/.test(p2)
      && /-\(\\d\+\)\\.\[a-z0-9\]\+\$\/i/.test(p2)
      && /glob\(\$imgDir \. DIRECTORY_SEPARATOR \. \$pdf \. '-' \. \$grupo \. '-\*'\)/.test(p2);
  })()
);

console.log('\n== F2b: los 3 modos y el lienzo (spec 028) ==');
// La tabla normativa vive en el docblock de `escalaBase` (fuente unica de
// verdad). Estas son PROPIEDADES, no ejemplos: la spec 025 se valido con
// ejemplos (E1-E6) que CODIFICABAN una lectura equivocada de las palabras
// ("Rellenar" leido como "recortar al aspecto sin ampliar"), asi que pasarlos
// no probaba nada. Si alguien vuelve a leer mal un modo, falla la propiedad.
// Anclaje al estandar: cubrir = `object-fit: cover`, encajar = `contain`,
// estirar = `fill`.
const CASOS = [
  [300, 200, 1000, 1000], [200, 300, 1000, 500], [1100, 901, 463, 463],
  [3000, 3000, 200, 200], [4000, 2000, 1000, 500], [600, 400, 600, 300],
  [900, 1000, 1100, 1100], [463, 463, 463, 463]
];
const casi = (a, b) => Math.abs(a - b) <= 0.01;
const tocaEje = (caja, W, H) => casi(caja.dw, W) || casi(caja.dh, H);

// Cubrir (cover): NO deja huecos (nunca mas chica que el marco), NO deforma y
// es la MENOR que cubre (toca un eje).
let cubrirOk = true;
CASOS.forEach(function (c) {
  const caja = puro.escalaBase('cubrir', c[0], c[1], c[2], c[3]);
  const sinHuecos = caja.dw >= c[2] - 0.01 && caja.dh >= c[3] - 0.01;
  const sinDeformar = casi(caja.dw / caja.dh, c[0] / c[1]);
  if (!(sinHuecos && sinDeformar && tocaEje(caja, c[2], c[3]))) { cubrirOk = false; }
});
check('Cubrir (cover): nunca deja huecos, no deforma y es la menor que cubre', cubrirOk);

// Encajar (contain): entra SIEMPRE (nunca mas grande que el marco), no deforma
// y toca un eje (no queda flotando en el medio).
let encajarOk = true;
CASOS.forEach(function (c) {
  const caja = puro.escalaBase('encajar', c[0], c[1], c[2], c[3]);
  const entra = caja.dw <= c[2] + 0.01 && caja.dh <= c[3] + 0.01;
  const sinDeformar = casi(caja.dw / caja.dh, c[0] / c[1]);
  if (!(entra && sinDeformar && tocaEje(caja, c[2], c[3]))) { encajarOk = false; }
});
check('Encajar (contain): siempre entra, no deforma y toca un eje', encajarOk);

// Estirar (fill): la caja ES el marco (deforma).
let estirarOk = true;
CASOS.forEach(function (c) {
  const caja = puro.escalaBase('estirar', c[0], c[1], c[2], c[3]);
  if (!(casi(caja.dw, c[2]) && casi(caja.dh, c[3]))) { estirarOk = false; }
});
check('Estirar (fill): la caja es el marco exacto (se deforma)', estirarOk);

// EL INVARIANTE que se leyo mal en la 025: lo que distingue Cubrir de Encajar
// NO es "deformar" (ninguno de los dos deforma): es QUE HACE CON EL SOBRANTE.
const cCubrirPr = puro.escalaBase('cubrir', 300, 200, 500, 500);
const cEncajarPr = puro.escalaBase('encajar', 300, 200, 500, 500);
check('el invariante: Cubrir RECORTA (desborda el marco), Encajar DEJA FONDO',
  cCubrirPr.dw >= 500 && cCubrirPr.dh >= 500
  && (cCubrirPr.dw > 500 || cCubrirPr.dh > 500)
  && casi(cEncajarPr.dw, 500) && cEncajarPr.dh < 500,
  'cubrir ' + cCubrirPr.dw + 'x' + cCubrirPr.dh
  + ' / encajar ' + cEncajarPr.dw + 'x' + cEncajarPr.dh);

// Casos del negocio (el hueco lo fija `phsize`, no el `w`/`h` declarado).
const casoCubrir = puro.escalaBase('cubrir', 300, 200, 463, 463);
const casoEncajar = puro.escalaBase('encajar', 300, 200, 463, 463);
const casoEstirar = puro.escalaBase('estirar', 300, 200, 463, 463);
check('E1: 300x200 en 463x463 -> Cubrir 694x463 / Encajar 463x309 / Estirar 463x463',
  casi(casoCubrir.dw, 694.5) && casi(casoCubrir.dh, 463)
  && casi(casoEncajar.dw, 463) && casi(casoEncajar.dh, 308.67)
  && casi(casoEstirar.dw, 463) && casi(casoEstirar.dh, 463),
  [casoCubrir.dw, casoCubrir.dh, casoEncajar.dw, casoEncajar.dh].join(' '));
const casoReal = puro.escalaBase('cubrir', 1100, 901, 463, 463);
check('E2: 1100x901 en el hueco real de 463 -> Cubrir 565.26x463 (tapa el marco)',
  casi(casoReal.dw, 565.26) && casi(casoReal.dh, 463),
  casoReal.dw + 'x' + casoReal.dh);
// Encajar NO tiene tope de ampliacion: si la foto es mas chica que el marco,
// amplia hasta tocar un eje (es el `contain` puro del estandar).
const casoChica = puro.escalaBase('encajar', 100, 100, 1000, 500);
check('Encajar amplia si hace falta (contain sin tope): 100x100 en 1000x500 -> 500x500',
  casi(casoChica.dw, 500) && casi(casoChica.dh, 500),
  casoChica.dw + 'x' + casoChica.dh);
// El PNG mide el LIENZO **acotado a la resolucion de la foto** (D4 + D11): el
// Motor encaja contain 1:1 en encuadre y la vista previa es el PDF. La ventana
// `min(caja, lienzo)` de la 025 se retiro (con un lienzo no cuadrado el recorte
// salia corrido) y el PNG ya no inventa pixeles.
check('Spec 028 D11: el PNG sale de escalaSalida (lienzo acotado), sin la ventana de la 025',
  typeof puro.escalaSalida === 'function'
  && /cv\.width = med\.w/.test(selector) && /cv\.height = med\.h/.test(selector)
  && /setTransform\(med\.k, 0, 0, med\.k, 0, 0\)/.test(selector)
  && selector.indexOf('var ow = Math.max(1, Math.min(Math.round(caja.dw)') === -1);

// PROPIEDADES del tope (D11), sobre los mismos casos: nunca mas grande que el
// lienzo, nunca amplia la foto y conserva el ASPECTO del lienzo (por eso el
// encuadre del Motor es el mismo: su escalado es uniforme).
let salidaOk = true;
CASOS.forEach(function (c) {
  ['cubrir', 'encajar', 'estirar'].forEach(function (m) {
    const r = puro.escalaSalida(m, c[0], c[1], c[2], c[3]);
    const cabeEnLienzo = r.w <= c[2] && r.h <= c[3];
    const noInventa = r.k <= 1;
    const mismoAspecto = Math.abs((r.w / r.h) / (c[2] / c[3]) - 1) <= 0.02;
    if (!(cabeEnLienzo && noInventa && mismoAspecto)) { salidaOk = false; }
  });
});
check('D11: el PNG nunca supera el lienzo, nunca amplia la foto y conserva su aspecto', salidaOk);

// Casos del negocio del tope (foto 400x300 en un lienzo de 1000x1000).
const salCubrir = puro.escalaSalida('cubrir', 400, 300, 1000, 1000);
const salEncajar = puro.escalaSalida('encajar', 400, 300, 1000, 1000);
const salEstirar = puro.escalaSalida('estirar', 400, 300, 1000, 1000);
check('E3: 400x300 en 1000x1000 -> PNG Cubrir 300x300 / Encajar 400x400 / Estirar 400x400',
  salCubrir.w === 300 && salCubrir.h === 300
  && salEncajar.w === 400 && salEncajar.h === 400
  && salEstirar.w === 400 && salEstirar.h === 400,
  [salCubrir.w + 'x' + salCubrir.h, salEncajar.w + 'x' + salEncajar.h,
    salEstirar.w + 'x' + salEstirar.h].join(' / '));
// La Escala multiplica la caja: acercar baja k (menos pixeles, mismo encuadre).
const salZoom = puro.escalaSalida('cubrir', 400, 300, 1000, 1000, 4);
check('D11: la Escala acota el PNG (400x300 en 1000x1000 con Cubrir a 4x -> 75x75)',
  salZoom.w === 75 && salZoom.h === 75, salZoom.w + 'x' + salZoom.h);
// Foto mas grande que el hueco: k = 1 y el PNG mide el lienzo (lo tipico no cambia).
const salGrande = puro.escalaSalida('cubrir', 4000, 3000, 1000, 1000);
check('D11: foto grande -> k=1 y el PNG mide el lienzo (el caso tipico no cambia)',
  salGrande.k === 1 && salGrande.w === 1000 && salGrande.h === 1000,
  salGrande.w + 'x' + salGrande.h);
check('Spec 028 D3: la Escala vuelve al rango completo 0.25x-4x (no solo reduce)',
  /min="-100" max="100"/.test(selector)
  && /this\.zoom = Math\.max\(0\.25, Math\.min\(4, v\)\)/.test(selector));
check('Spec 028: `escala` sigue fuera del contrato de ranura',
  selector.indexOf('config.escala') === -1 && cargador.indexOf('escala: r.escala') === -1);
const tienda028 = fs.readFileSync(path.join(RAIZ, 'assets', 'tienda.js'), 'utf8');
check('Spec 028 D7: la ficha avisa si el lienzo declarado no es el hueco del grupo',
  /la composicion se reencajara \(usa phsize: 1\)/.test(tienda028));
check('Spec 027 (fix 028): normalizarRanura NO puede perder `transp` (politica del campo)',
  /var transp = \(r\.transp === 'si'\)/.test(tienda028) && /transp: transp,/.test(tienda028));

console.log('\n== F2f: vocabulario de los 3 modos (spec 028) ==');
check('modoCanonico: ids canonicos + alias (los de la 025 y los de object-fit)',
  puro.modoCanonico('cubrir') === 'cubrir' && puro.modoCanonico('encajar') === 'encajar'
  && puro.modoCanonico('estirar') === 'estirar'
  && puro.modoCanonico('rellenar') === 'cubrir' && puro.modoCanonico('ajustar') === 'encajar'
  && puro.modoCanonico('cover') === 'cubrir' && puro.modoCanonico('contain') === 'encajar'
  && puro.modoCanonico('fill') === 'estirar'
  && puro.modoCanonico(undefined) === 'cubrir' && puro.modoCanonico('otra') === 'cubrir');
check('la UI usa los 3 ids canonicos con etiqueta, icono y tooltip',
  ['cubrir', 'encajar', 'estirar'].every(function (m) {
    return selector.indexOf('data-modo="' + m + '"') !== -1
      && selector.indexOf('ICO_MODO.' + m) !== -1
      && selector.indexOf('TITULO_MODO.' + m) !== -1
      && selector.indexOf('>' + m.charAt(0).toUpperCase() + m.slice(1) + '</span></button>') !== -1;
  }));
check('Spec 028 D5: el default es por caso (>5% Cubrir; <=5% Estirar)',
  (selector.match(/\? 'cubrir' : 'estirar'/g) || []).length >= 2);
check('Spec 028 D6: con el aspecto encajado (<=5%) queda UN boton "Ajustar al marco"',
  /var soloAjuste = tieneImg && !this\.supera5/.test(selector)
  && /txt\.textContent = 'Ajustar al marco'/.test(selector)
  && /SelectorPMU\.prototype\._reencuadrar = function/.test(selector)
  && /btn\.getAttribute\('data-accion'\) === 'reencuadrar'/.test(selector));

console.log('\n== F2c: zoom desde la envoltura y click del ojito (spec 024, 4.15.2/4.15.3) ==');
// Forma centrada (size 1, ox/oy 0): el origen es EXACTAMENTE el de antes.
const gCentrada = puro.geometriaEscena(1000, 500, { forma: 'rectangulo', size: 1 });
const oCentro = puro.origenDibujo(gCentrada, true, { x: 0, y: 0 }, 1);
check('origen: forma centrada -> centro del placeholder (comportamiento intacto)',
  oCentro.x === gCentrada.margenX + 500 && oCentro.y === gCentrada.margenY + 250,
  oCentro.x + ',' + oCentro.y);
// En el PNG de salida (sin margen) cae en W/2, H/2.
const oPng = puro.origenDibujo(gCentrada, false, { x: 0, y: 0 }, 1);
check('origen: en el PNG de salida (sin margen) cae en W/2, H/2',
  oPng.x === 500 && oPng.y === 250, oPng.x + ',' + oPng.y);
// Forma desplazada: el origen se corre con ella (zoom desde la envoltura).
const gDesp = puro.geometriaEscena(1000, 500, { forma: 'rectangulo', size: 1, ox: 20 });
const oDesp = puro.origenDibujo(gDesp, true, { x: 0, y: 0 }, 1);
check('origen: con ox=20 el centro se corre 20% de W (crece desde la forma)',
  Math.round(oDesp.x - oCentro.x) === 200, String(Math.round(oDesp.x - oCentro.x)));
// Con zoom 1 el arrastre se respeta tal cual.
const oDrag = puro.origenDibujo(gCentrada, true, { x: 30, y: -10 }, 1);
check('origen: con zoom 1 el arrastre se suma sin escalar',
  oDrag.x === oCentro.x + 30 && oDrag.y === oCentro.y - 10);
// Fix 4.15.3: con zoom 2 el desplazamiento se DUPLICA (anclaje en la forma).
const oZ2 = puro.origenDibujo(gCentrada, true, { x: 30, y: -10 }, 2);
check('origen: con zoom 2 el desplazamiento se escala (30 -> 60)',
  oZ2.x === oCentro.x + 60 && oZ2.y === oCentro.y - 20,
  String(Math.round(oZ2.x - oCentro.x)));
// LA PRUEBA DEL BUG: el punto de la imagen bajo el centro de la forma NO cambia
// al cambiar el zoom (u = (centro - centroImagen) / zoom).
const centro = oCentro.x;
const u1 = (centro - puro.origenDibujo(gCentrada, true, { x: 50, y: 0 }, 1).x) / 1;
const u2 = (centro - puro.origenDibujo(gCentrada, true, { x: 50, y: 0 }, 2).x) / 2;
const u4 = (centro - puro.origenDibujo(gCentrada, true, { x: 50, y: 0 }, 4).x) / 4;
check('el punto de la foto bajo el centro de la forma es INVARIANTE al zoom',
  u1 === u2 && u2 === u4, u1 + ' / ' + u2 + ' / ' + u4);
check('el modal dibuja con origenDibujo y le pasa el zoom (fix 4.15.3)',
  /var origen = origenDibujo\(geo, conMargen, this\.desplazamiento, this\.zoom\)/.test(selector)
  && !/var cx = ox \+ \(w \/ 2\)/.test(selector));
check('fix 4.15.3: el arrastre se compensa con el zoom (sigue 1:1 con el dedo)',
  /var k = escala \/ \(self\.zoom \|\| 1\)/.test(selector));
check('fix 4.15.2: el pointerdown del ojito no arranca el arrastre',
  /ojo\.addEventListener\('pointerdown', function \(e\) \{ e\.stopPropagation\(\); \}\)/.test(selector)
  && /self\.ojo && self\.ojo\.contains/.test(selector)
  && /self\.ojo\.contains\(e\.target\)/.test(selector));

console.log('\n== F3: badge en vivo y guias (US3) ==');
check('badge Origen + Salida con zoom en vivo', /spmu-badge/.test(selector)
  && /Origen /.test(selector) && /Salida /.test(selector) && /toFixed\(/.test(selector));
check('Spec 024 fix 4.15.1: Girar solo con r:1 Y lienzo NO cuadrado (sin el 5%)',
  /rotarEl\.hidden = !\(tieneImg && this\.config\.rotar/.test(selector)
  && /this\.config\.finalW !== this\.config\.finalH\)/.test(selector)
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
