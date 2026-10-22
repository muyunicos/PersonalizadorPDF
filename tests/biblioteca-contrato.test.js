/**
 * biblioteca-contrato - Puerta de la biblioteca del comprador (spec 030, T010).
 *
 * Verifica el CABLEADO entre las piezas (sin navegador): el modulo cliente, el
 * boton/tira del modal, el visor compartido y el encolado del plugin. El
 * comportamiento con datos lo cubre la fase `biblioteca` del arnes PHP.
 *
 *   node tests/biblioteca-contrato.test.js  ->  BIBLIOTECA CONTRATO OK (N checks)
 */
'use strict';

const fs = require('fs');
const path = require('path');

const RAIZ = path.dirname(__dirname);
const lee = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

const bib = lee('assets/biblioteca-pmu.js');
const visor = lee('assets/visor-pmu.js');
const sel = lee('assets/selector-pmu.js');
const carg = lee('assets/cargador-pmu.js');
const plugin = lee('personalizador-pdf.php');

let ok = 0;
let fallos = 0;
function check(nombre, cond) {
    if (cond) { ok++; console.log('  OK   ' + nombre); }
    else { fallos++; console.log('  FAIL ' + nombre); }
}

console.log('== Modulo cliente (T011/T012) ==');
check('expone window.PMUBiblioteca y exporta en Node',
    /global\.PMUBiblioteca = api;/.test(bib) && /module\.exports = api;/.test(bib));
check('usa localStorage (por cliente, en toda la tienda) y NO sessionStorage',
    /global\.localStorage/.test(bib) && !/sessionStorage/.test(bib));
check('tiene TTL (las URLs llevan nonce de WP)',
    /TTL_MS/.test(bib) && /Date\.now\(\) - \(v\.ts/.test(bib));
check('revalida por revision: manda desde y respeta sin_cambios',
    /fd\.append\(.desde., previa\.revision\)/.test(bib) && /d\.sin_cambios && previa/.test(bib));
check('la tira pinta hasta 10 fotos y no dibuja si esta vacia',
    /var TOPE_TIRA = 10;/.test(bib) && /if \(!fotos \|\| !fotos\.length\)/.test(bib));
check('guarda solo metadatos: usa la url del endpoint y no la resuelve por POST',
    /img\.src = String\(f\.thumb \|\| f\.url/.test(bib) && !/urlDeSubida/.test(bib));
check('el visor es el COMPARTIDO y la accion es Elegir',
    /global\.PMUVisor\.abrir\(\{/.test(bib) && /etiqueta: .Elegir./.test(bib));

console.log('== Modal de recorte (T013) ==');
check('el modal trae el boton "Elegir ya subida" y el contenedor de la tira',
    /class="button spmu-biblioteca">Elegir ya subida</.test(sel) && /pmu-bib-contenedor/.test(sel));
check('engancha la tira pasando onElegir', /PMUBiblioteca\.tira\(cajaBib, \{/.test(sel));
check('la foto elegida entra por el MISMO camino que un arrastre (drop)',
    /new DragEvent\(.drop./.test(sel) && /dataTransfer: dt/.test(sel));

console.log('== Visor compartido y ranura (D28) ==');
check('visor-pmu.js expone abrir/cerrar y precarga vecinos',
    /global\.PMUVisor = api;/.test(visor) && /function preCargar/.test(visor));
check('la ranura usa el visor compartido (no uno propio)',
    /_abrirVisorCompartido/.test(carg) && /global\.PMUVisor\.abrir\(\{/.test(carg));

console.log('== Encolado (T011) ==');
check('la ficha encola el visor y la biblioteca, con el visor como dependencia',
    plugin.indexOf("'personalizador-pdf-visor'") !== -1
    && plugin.indexOf("'personalizador-pdf-biblioteca'") !== -1
    && /'personalizador-pdf-biblioteca',[\s\S]{0,220}\[.personalizador-pdf-visor.\]/.test(plugin));

console.log('== Tira adaptativa y tap (2026-10-21) ==');
check('la tira se adapta al ANCHO (sin scroll) y reserva el tile N+',
    /var ANCHO_MINI = 64;/.test(bib) && /function caben\(el\)/.test(bib)
    && /overflow:hidden/.test(bib) && /Math\.max\(1, cabe - 1\)/.test(bib));
check('el tap de una miniatura abre el visor (no elige directo)',
    /addEventListener\('click', function \(\) \{ visor\(i\); \}\)/.test(bib)
    && !/if \(onElegir\) \{ onElegir\(f\); \}/.test(bib));
check('se repinta al cambiar el tamaño sin volver a pedir',
    /'resize'/.test(bib) && /pintarTira\(ultimoEl, ultimas\)/.test(bib));

console.log('== Borrado multiple y aviso (2026-10-21) ==');
check('borrar NO cierra la galeria: refresca la lista y sigue en la misma posicion',
    /invalidar\(\);\s*return pedir\(\);/.test(bib) && /visor\(Math\.min\(i, restantes\.length - 1\)\)/.test(bib));
check('el aviso excluye el item que se esta editando (D17)',
    /fd\.append\('item_key', String\(c\.item \|\| ''\)\)/.test(bib) && /item: s\.item_key \|\| ''/.test(bib));

console.log('== Elegir sin recomponer (D8) ==');
check('usar() postea op=usar con item/pdf/grupo/indice/params e invalida la copia',
    /fd\.append\('op', 'usar'\)/.test(bib) && /fd\.append\('params', JSON\.stringify\(datos\.params \|\| \{\}\)\)/.test(bib)
    && /if \(json\.data && json\.data\.fila\) \{ invalidar\(\); \}/.test(bib) && /usar: usar/.test(bib));

console.log('== Auto-open condicionado (4a clarificacion) ==');
check('el selector de archivos se auto-abre SOLO si la biblioteca esta vacia',
    /bibVacia/.test(sel) && /PMUBiblioteca\.cache/.test(sel));
check('la copia de la tira se calienta al cargar la ficha (una por pagina)',
    /if \(config\(\)\.url && typeof global\.fetch === 'function'\)/.test(bib));

console.log('== Elegir: la receta la decide el servidor (D8) ==');
check('op=usar no escribe si la receta no coincide y avisa coincide:false',
    /coincide' => false/.test(plugin)
    && /in_array\(\$recetaUsar, \(array\)\(\$fam\['recetas'\] \?\? \[\]\), true\)/.test(plugin));
check('usar() solo invalida la copia cuando hay fila escrita',
    /if \(json\.data && json\.data\.fila\) \{ invalidar\(\); \}/.test(bib));

console.log('');
if (fallos === 0) { console.log('BIBLIOTECA CONTRATO OK (' + ok + ' checks)'); process.exit(0); }
console.log('BIBLIOTECA CONTRATO FALLA (' + fallos + ' de ' + (ok + fallos) + ')');
process.exit(1);
