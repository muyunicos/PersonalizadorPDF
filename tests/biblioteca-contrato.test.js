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
const tienda = lee('assets/tienda.js');

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
check('el modal monta la tira SIEMPRE visible (sin boton de biblioteca)',
    !/spmu-biblioteca/.test(sel) && /pmu-bib-contenedor/.test(sel));
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

console.log('== Params de receta en el selector (T014/D7) ==');
check('el selector sabe sus params con los 11 campos del servidor',
    /prototype\._params = function/.test(sel) && /modo: modoCanonico\(this\.config\.mode\)/.test(sel)
    && /dx: disp\.x \|\| 0/.test(sel) && /iw: dim\.w/.test(sel));

console.log('== Elegir en el selector (T014/D8) ==');
check('el selector tiene el guard de Elegir, la etiqueta y la fuente de biblioteca',
    /prototype\._actualizarPrimario = function/.test(sel) && /self\._bibMadre = String\(\(foto && foto\.madre\)/.test(sel)
    && /selfB\._emitir\('usado'/.test(sel) && /_paramsBase === JSON\.stringify\(this\._params\(\)\)/.test(sel));
check('el guard cae al camino normal cuando el servidor no reusa (coincide:false)',
    /selfB\._aceptar\(\);\s*\n\s*\}\)\.catch/.test(sel) && /selfB\._aceptar\(\);/.test(sel));

console.log('== Cargador: reuso y receta (T014) ==');
check('el cargador pasa params al subir y una funcion usar al selector',
    /params: \(this\.selectores\[indice\] && this\.selectores\[indice\]\._params\)/.test(carg)
    && /usar: self\.config\.usar \? function \(madre, params\)/.test(carg));
check('el cargador escucha el evento usado y anota el id de la fila',
    /sel\.on\('usado', function \(dato\)/.test(carg) && /dato\.fila && dato\.fila\.id/.test(carg));

console.log('== Tienda provee Elegir (T015) ==');
check('tienda.js da usar al cargador y usa PMUBiblioteca.usar (T015/D8)',
    /usar: function \(madre, params, ctxUsar\)/.test(tienda) && /api\.usarBiblioteca = function/.test(tienda)
    && /PMUBiblioteca\.usar\(String\(madre \|\| ''\)/.test(tienda));

console.log('== US5: vinculo invitado -> cuenta (D3) ==');
check('D3: el vinculo solo se consulta con cuenta (uid > 0)',
    /if \(\$uid > 0 && function_exists\('get_user_meta'\)\)/.test(plugin));
check('T035: los hooks del vinculo estan registrados (wp_login + Woo 8.8+)',
    /add_action\('wp_login', \[\$this, 'vinculo_sid_usuario'\], 10, 2\)/.test(plugin)
    && /add_filter\('woocommerce_guest_session_to_user_id', \[\$this, 'vinculo_sid_filtro'\], 10, 1\)/.test(plugin));

console.log('== Endpoint de la biblioteca (fix 4.22.0) ==');
check('el endpoint viaja en PMU_FICHA.biblioteca (no depende del orden de carga)',
    /'biblioteca' => \[\s*'endpoint' => admin_url\('admin-post\.php'\)/.test(plugin));
check('config() no cachea endpoint vacio y el calentado va en load',
    /if \(cfg && cfg\.url\) \{ return cfg; \}/.test(bib)
    && /addEventListener\('load', function \(\) \{ calentar\(\); \}\)/.test(bib));

console.log('== Copia envenenada: auto-sanado (2026-10-23) ==');
check('la copia local es v2 y pedir() se auto-sana de una copia vacia',
    /var CLAVE = 'pmu_bib_v2';/.test(bib) && /function pedir\(sinDesde\)/.test(bib)
    && /if \(\(!previa\.fotos \|\| !previa\.fotos\.length\) && !sinDesde\) \{ return pedir\(true\); \}/.test(bib));

console.log('== Fix 4.22.2: montaje y receta de la subida ==');
check('el montaje de la tira INVOCA su bloque (})();) y los params viajan con la subida',
    /\(function \(\) \{ \/\/ 4a[\s\S]{0,1500}\}\)\(\);/.test(sel)
    && /fd\.append\('params', JSON\.stringify\(\(ctx && ctx\.params\)/.test(tienda)
    && /subir: function \(blob, ctx\) \{ return api\.subirFoto\(blob, cid, ctx\); \}/.test(tienda));

console.log('');
if (fallos === 0) { console.log('BIBLIOTECA CONTRATO OK (' + ok + ' checks)'); process.exit(0); }
console.log('BIBLIOTECA CONTRATO FALLA (' + fallos + ' de ' + (ok + fallos) + ')');
process.exit(1);
