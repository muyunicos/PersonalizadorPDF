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

console.log('');
if (fallos) {
  console.log('SELECTOR CONTRATO FALLA (' + fallos + ' checks en rojo)');
  process.exit(1);
}
console.log('SELECTOR CONTRATO OK (F0)');
