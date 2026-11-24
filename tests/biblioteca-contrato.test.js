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
check('guarda solo metadatos: usa thumb_data/thumb y no la resolucion por POST (spec 044)', /img\.src = String\(f\.thumb_data \|+ f\.url \|+ f\.thumb/.test(bib) && !/urlDeSubida/.test(bib)); /*
    /img\.src = String\(f\.thumb_data \|\| urlResuelta \|\| f\.thumb \|\| f\.url/.test(bib) && !/urlDeSubida/.test(bib));
*/
check('spec 043 (US4): la miniatura ELIGE y el visor de la biblioteca existe',
    /function elegir\(indice\)/.test(bib)
    && /function verTodas\(indice\)/.test(bib)
    && /function visor\(indice\) \{ return verTodas\(indice\); \}/.test(bib));

console.log('== Modal de recorte (T013) ==');
check('el modal monta la tira SIEMPRE visible (sin boton de biblioteca)',
    !/spmu-biblioteca/.test(sel) && /pmu-bib-contenedor/.test(sel));
check('engancha la tira pasando onElegir', /PMUBiblioteca\.tira\(cajaBib, \{/.test(sel));
check('la foto elegida entra por cargarDesdeBiblioteca (sin drop sintetico)',
    /self\.cargarDesdeBiblioteca\(foto, 'tira', paramsEleg\)/.test(sel)
    && /prototype\.cargarDesdeBiblioteca = function/.test(sel)
    && !/new DragEvent\('drop'/.test(sel));
// Spec 040 (T012/T015): la tira pinta miniaturas y el selector resuelve la receta por clave.
check('la tira usa la miniatura (thumb) y no la foto completa',
    /f\.thumb\s*\|\|\s*f\.url/.test(bib));
check('el selector resuelve la receta por clave de contexto',
    /prototype\._recetaDeFoto\s*=\s*function/.test(sel));

console.log('== Spec 040 F1/F2: una sola peticion y sin recorrer orders/ ajeno ==');
check('F1: pedir() comparte la promesa en vuelo (un solo POST por apertura)',
    /var enVuelo = null;/.test(bib)
    && /if \(enVuelo && !sinDesde\) \{ return enVuelo; \}/.test(bib)
    && /enVuelo = p;/.test(bib));
check('F1: el calentado no pide nada con copia fresca',
    /Date\.now\(\) - \(fresca\.ts \|\| 0\)\) < FRESCURA_MS/.test(bib));
check('F2: orders/ se mira SOLO en la carpeta del cliente (invitado no lo toca)',
    // Spec 040 T024: `biblioteca_contenedores()` (recorria TODOS los clientes) fue
    // retirado. `listar` lee el catalogo de la carpeta de la identidad. La invariante
    // se verifica sobre la UNICA funcion que arma el listado (`handle_biblioteca`),
    // no sobre todo el archivo (otros metodos SI recorren orders/ y es correcto:
    // `pedidos_completados()` es la consola del admin).
    (function () {
        var i = plugin.indexOf('function handle_biblioteca');
        var j = plugin.indexOf('private function', i + 10);
        var cuerpo = i < 0 ? '' : plugin.slice(i, j < 0 ? plugin.length : j);
        return /dir_uploads_identidad/.test(cuerpo)
            && /catalogo_leer/.test(cuerpo)
            && !/wc_get_orders/.test(cuerpo)
            && !/biblioteca_contenedores/.test(cuerpo);
    })());

console.log('== Spec 042: camino liviano ==');
check('spec 042: cache v3 con identidad y revision',
    /var CLAVE = 'pmu_bib_v3';/.test(bib)
    && /identidad: String\(dato\.identidad/.test(bib)
    && /revision: String\(dato\.revision/.test(bib));
check('spec 042: config publica rapido/revision/identidad',
    /rapido: b\.rapido/.test(bib)
    && /revision: String\(b\.revision/.test(bib)
    && /identidad: String\(b\.identidad/.test(bib));
check('spec 042: pedirRapido usa GET sin nonce',
    /function pedirRapido/.test(bib)
    && /c\.rapido \+ '\?op=listar'/.test(bib)
    && !/fd\.append\('_wpnonce'/.test(bib.slice(bib.indexOf('function pedirRapido'), bib.indexOf('function pedirWp'))));
check('spec 042: respaldo al endpoint actual',
    /function pedirWp/.test(bib) && /modo = 'wp'/.test(bib));
check('spec 042: la copia solo se usa con la identidad de la ficha',
    /var esperada = String\(config\(\)\.identidad/.test(bib)
    && /String\(v\.identidad \|\| ''\) !== esperada/.test(bib));
check('spec 042: tira salta con revision/identidad iguales',
    /previa\.revision === c\.revision/.test(bib));
check('spec 042: miniaturas embebidas en los dos caminos (spec 044)', /f\.thumb_data \|+ f\.url/.test(bib) && /var thumb = String\(f\.thumb_data/.test(bib)); /*
    /f\.thumb_data \|\| urlResuelta/.test(bib)
    && /var thumb = String\(f\.thumb_data/.test(bib));
*/
check('spec 042: urlRespaldo para imagenes',
    /function urlRespaldo/.test(bib) && /urlRespaldo: urlRespaldo/.test(bib));
check('spec 042: la ficha publica rapido/revision/identidad',
    /'rapido' => \$rapido/.test(plugin)
    && /'revision' => \$revision/.test(plugin)
    && /'identidad' => \$identidadHash/.test(plugin));
check('spec 042: media.php existe y no arranca WordPress',
    fs.existsSync(path.join(RAIZ, 'media.php'))
    && !/wp-load\.php/.test(lee('media.php')));

console.log('== Spec 043 (US4): Ver todas (N) y visor de la biblioteca ==');
check('el chip "Ver todas (N)" se pinta SIEMPRE con el total',
    /mas\.textContent = 'Ver todas \(' \+ fotos\.length \+ '\)'/.test(bib));
check('el chip abre el visor (no elige una foto)',
    /function verTodas\(indice\)/.test(bib) && /verTodas\(0\)/.test(bib)
    && /onChip: function \(cuantos, desde\) \{ verTodas/.test(bib));
check('el visor muestra TODAS las fotos con Elegir/Eliminar',
    /global\.PMUVisor\.abrir\(\{/.test(bib)
    && /etiqueta: 'Elegir'/.test(bib) && /etiqueta: 'Eliminar'/.test(bib));
check('borrado en dos pasos: directo sin uso y dialogo con referencias',
    /borrarFoto\(id, confirmar\)/.test(bib) && /err\.referencias/.test(bib)
    && /PMUVisor\.confirmar\(\{/.test(bib));
check('tras borrar se repinta la tira (contador al dia)',
    /pintarTira\(ultimoEl, ultimas\)/.test(bib));
check('spec 043 (US5): el dialogo de uso queda sobre el modal del editor',
    /fondo\.style\.zIndex = '200000'/.test(visor));

console.log('== Visor compartido y ranura (D28) ==');
check('visor-pmu.js expone abrir/cerrar y precarga vecinos',
    /global\.PMUVisor = api;/.test(visor) && /function preCargar/.test(visor));
check('la tira de la biblioteca delega en el MOTOR del tema (D26, blanda)',
    /function delegarTira/.test(bib) && /delegarTira\(el, fotos\)/.test(bib)
    && /tema\.coleccion\(el, \{/.test(bib) && /navegable: false/.test(bib)
    && /onChip: function \(cuantos, desde\) \{ verTodas\(desde \|\| 0\); \}/.test(bib));
    check('el visor delega en el MOTOR DEL TEMA cuando esta (D11, blanda)',
    /function delegarTema/.test(visor) && /global\.MU/.test(visor)
    && /typeof tema\.visor/.test(visor) && /delegado = tema;/.test(visor));
check('el visor delegado se eleva sobre el modal del plugin (z-index)',
    /pmu-visor--sobre/.test(visor) && /z-index:200000 !important/.test(visor));
check('la ranura usa el visor compartido (no uno propio)',
    /_abrirVisorCompartido/.test(carg) && /global\.PMUVisor\.abrir\(\{/.test(carg));

console.log('== Spec 039 D1: mini-dialogo de confirmacion del visor ==');
check('visor-pmu.js expone confirmar()',
    /confirmar: confirmar,/.test(visor) && /function confirmar\(opts\)/.test(visor));
check('el mini-dialogo es propio (no confirm() del navegador)',
    !/window\.confirm\(/.test(visor) && !/\bglobal\.confirm\(/.test(visor)
    && /pmu-visor-confirmar/.test(visor));
check('el panel atrapa el foco y Escape cancela',
    /prevFoco/.test(visor) && /prevFoco\.focus\(\)/.test(visor)
    && /e\.key === 'Escape'/.test(visor) && /terminar\(false\)/.test(visor));
check('las acciones pasan por ejecutarAccion (confirmar antes de onAccion)',
    /function ejecutarAccion/.test(visor)
    && /b\.addEventListener\('click', function \(\) \{ ejecutarAccion\(ac, pos\); \}\);/.test(visor));
check('la ranura declara Eliminar con confirmar: true',
    /etiqueta: 'Eliminar', clase: 'pmu-visor-peligro', confirmar: true/.test(carg)
    && /pregunta: 'Borrar esta imagen\?'/.test(carg));
check('tras borrar el visor NO se reabre sobre la misma posicion (D1/H2)',
    !/onAccion: function \(p\) \{ self\._quitar\(indice, p\); self\._abrirVisorCompartido\(indice, p\); \}/.test(carg));
check('sin DOM (Node) confirmar resuelve false (nunca borra por accidente)',
    /if \(!doc \|\| !base \|\| !doc\.createElement\) \{[\s\S]{0,200}return Promise\.resolve\(false\);/.test(visor));

console.log('== Encolado (T011) ==');
check('la ficha encola el visor y la biblioteca, con el visor como dependencia',
    plugin.indexOf("'personalizador-pdf-visor'") !== -1
    && plugin.indexOf("'personalizador-pdf-biblioteca'") !== -1
    && /'personalizador-pdf-biblioteca',[\s\S]{0,220}\[.personalizador-pdf-visor.\]/.test(plugin));

console.log('== Tira adaptativa y tap (2026-10-21) ==');
check('la tira se adapta al ANCHO (sin scroll) y reserva el tile N+',
    /var ANCHO_MINI = 64;/.test(bib) && /function caben\(el\)/.test(bib)
    && /overflow:hidden/.test(bib) && /Math\.max\(1, cabe - 1\)/.test(bib));
check('el tap de una miniatura ELIGE directo (D4: carga en el modal, sin visor)',
    /addEventListener\('click', function \(\) \{ elegir\(i\); \}\)/.test(bib)
    && !/addEventListener\('click', function \(\) \{ visor\(i\); \}\)/.test(bib));
check('se repinta al cambiar el tamaño sin volver a pedir',
    /'resize'/.test(bib) && /pintarTira\(ultimoEl, ultimas\)/.test(bib));

console.log('== Borrado en el acto (spec 039 D3) ==');
check('spec 043 (US4): la biblioteca borra en dos pasos (sin confirm nativo)',
    /borrarFoto\(id, confirmar\)/.test(bib) && !/global\.confirm\(/.test(bib)
    && /PMUVisor\.confirmar\(\{/.test(bib));
check('el aviso excluye el item que se esta editando (D17)',
    /item: s\.item_key \|\| ''/.test(bib) || /fd\.append\('item_key', String\(c\.item \|\| ''\)\)/.test(bib));

console.log('== Spec 039 D6: se retiro `usar` (Elegir de 0 bytes) ==');
check('PMUBiblioteca ya no expone usar()',
    !/usar: usar/.test(bib) && !/function usar\(madre, datos\)/.test(bib));

console.log('== Auto-open condicionado (4a clarificacion) ==');
check('el selector de archivos se auto-abre SOLO si la biblioteca esta vacia',
    /bibVacia/.test(sel) && /PMUBiblioteca\.cache/.test(sel));
check('calentar() solo corre con URL y fetch (spec 036 D7: con el primer gesto, NO en load)',
    /if \(\(c\.url \|\| c\.rapido\) && typeof global\.fetch === 'function'\)/.test(bib));

console.log('== Spec 039 D6: se retiro `Elegir` del selector ==');
check('el selector ya no tiene `_bibMadre`/`_yaElegido`/`_paramsBase`',
    !/_bibMadre/.test(sel) && !/_yaElegido/.test(sel) && !/_paramsBase/.test(sel));
check('spec 043 (US3): el primario dice SIEMPRE `Guardar` (sin rama de reuso)',
    /prototype\._actualizarPrimario = function/.test(sel)
    && /'Aceptar'/.test(sel) && /'Subir'/.test(sel));
check('el selector expone obtenerBlobFallido() para reintentar (spec 039 D2)',
    /prototype\.obtenerBlobFallido = function/.test(sel) && /_falloSubida/.test(sel));

console.log('== Cargador: receta y reintento (spec 039) ==');
check('el cargador pasa params al subir (sin usar ni madre_origen)',
    /params: paramsSubida/.test(carg)
    && /var paramsSubida = (params \|\| )?this\._paramsDe\(indice\)/.test(carg)
    && /CargadorPMU\.prototype\._paramsDe = function/.test(carg)
    && !/usar: self\.config\.usar \? function \(madre, params\)/.test(carg)
    && !/madre_origen: this\._madreDe\(indice\)/.test(carg));
check('el cargador registra el fallo y reintenta al tocar la miniatura',
    /_anotarFallo\(indice, \{/.test(carg) && /prototype\._reintentar = function/.test(carg)
    && /prototype\._falloEn = function/.test(carg));
check('la miniatura fallida se marca y su toque NO abre el visor',
    /cpmu-mini-fallo/.test(carg) && /data-pmu-fallo/.test(carg));

console.log('== Tienda: sin usarBiblioteca (spec 039 D6) ==');
check('tienda.js ya no expone usarBiblioteca ni cablea usar al cargador',
    !/api\.usarBiblioteca = function/.test(tienda) && !/usar: function \(madre, params, ctxUsar\)/.test(tienda));

console.log('== Params de receta en el selector (T014/D7) ==');
check('el selector sabe sus params con los 15 campos de la receta v2',
    /prototype\._params = function/.test(sel) && /modo: modoCanonico\(this\.config\.mode\)/.test(sel)
    && /v: 2/.test(sel) && /ox: origen\.x \/ w/.test(sel) && /rot: this\.rotacion \|\| 0/.test(sel)
    && /iw: dim\.w/.test(sel));

console.log('== Params de receta en el selector (T014/D7, vigente) ==');
check('el selector sabe sus params con los 15 campos de la receta v2',
    /prototype\._params = function/.test(sel) && /modo: modoCanonico\(this\.config\.mode\)/.test(sel)
    && /v: 2/.test(sel) && /ox: origen\.x \/ w/.test(sel) && /rot: this\.rotacion \|\| 0/.test(sel)
    && /iw: dim\.w/.test(sel));

console.log('== Spec 039 D2: reintento de subida ==');
check('spec 046 (U7): la subida en segundo plano deja el fallo en el cargador',
    /self\._anotarFallo\(indice, \{/.test(carg) && /cpmu-mini-fallo/.test(carg));
check('el cargador reintenta con el MISMO blob (no vuelve a elegir archivo)',
    /this\._subir\(indice, fallo\.blob, null\)/.test(carg));

console.log('== Spec 039 D4: la tira carga directo ==');
check('la tira de "Mis imagenes" NO usa madre ni drop: usa cargarDesdeBiblioteca',
    /self\._bibMadre = String/.test(sel) === false
    && /self\.cargarDesdeBiblioteca\(foto, 'tira', paramsEleg\)/.test(sel)
    && /new DragEvent\('drop'/.test(sel) === false);
check('A4: la receta recordada solo se aplica si la geometria coincide',
    /_aplicarParamsIniciales = function/.test(sel)
    && /parseInt\(params\.w, 10\) !== w \|\| parseInt\(params\.h, 10\) !== h/.test(sel));

console.log('== US5: vinculo invitado -> cuenta (D3) ==');
check('D3: el vinculo solo se consulta con cuenta (uid > 0)',
    /if \(\$uid > 0 && function_exists\('get_user_meta'\)\)/.test(plugin));
check('T035: los hooks del vinculo estan registrados (wp_login + Woo 8.8+)',
    /add_action\('wp_login', \[\$this, 'vinculo_sid_usuario'\], 10, 2\)/.test(plugin)
    && /add_filter\('woocommerce_guest_session_to_user_id', \[\$this, 'vinculo_sid_filtro'\], 10, 1\)/.test(plugin));

console.log('== Endpoint de la biblioteca (fix 4.22.0) ==');
check('el endpoint viaja en PMU_FICHA.biblioteca (no depende del orden de carga)',
    /'biblioteca' => \[\s*'endpoint' => admin_url\('admin-post\.php'\)/.test(plugin));
check('spec 044 (A5): config() caduca y el calentado NO va en load', /cfg && cfg\.url && \(Date\.now\(\) - cfgTs\)/.test(bib) && !/addEventListener\('load', function \(\) \{ calentar\(\); \}\)/.test(bib)); /*
    /if \(cfg && cfg\.url\) \{ return cfg; \}/.test(bib)
    && !/addEventListener\('load', function \(\) \{ calentar\(\); \}\)/.test(bib)
    && /closest\('\[data-pmu-panel\]'\)/.test(bib));
*/

console.log('== Copia envenenada: auto-sanado (2026-10-23, vigente) ==');
/* Histórico (pre-042): la assertion vieja se reemplazo por la de abajo (el auto-sanado del respaldo usa pedir(true)). */
/*
check('la copia local es v3 y se auto-sana de una copia vacia',
    /var CLAVE = 'pmu_bib_v3';/.test(bib) && /function pedir\(sinDesde\)/.test(bib)
    && /if \(\(!previa\.fotos \|\| !previa\.fotos\.length\) && !sinDesde\) \{ return pedir\(true\); \}/.test(bib));
*/
check('la copia local es v3 y se auto-sana de una copia vacia',
    /var CLAVE = 'pmu_bib_v3';/.test(bib) && /function pedir\(sinDesde\)/.test(bib)
    && /return pedirWp\(true\)/.test(bib));

console.log('== Fix 4.22.2: montaje y receta de la subida (vigente) ==');
check('el montaje de la tira INVOCA su bloque (})();) y los params viajan con la subida',
    /\(function \(\) \{ \/\/ 4a[\s\S]{0,3000}\}\)\(\);/.test(sel)
    && /fd\.append\('params', JSON\.stringify\(\(ctx && ctx\.params\)/.test(tienda)
    && /subir: function \(blob, ctx\) \{ return api\.subirFoto\(blob, cid, ctx\); \}/.test(tienda));

console.log('== Spec 039 D6: se retiro `madre_origen` ==');
check('la subida ya NO manda madre_origen (no hay familia que reusar)',
    !/madre_origen: this\._madreDe\(indice\)/.test(carg)
    && !/CargadorPMU\.prototype\._madreDe = function/.test(carg)
    && !/fd\.append\('madre_origen'/.test(tienda));
check('spec 044 (A6): la tira usa la URL del servidor (sin `f.base`)', /img\.src = String\(f\.thumb_data \|+ f\.url/.test(bib) && !/f\.base/.test(bib)); /*
    /img\.src = String\(f\.thumb_data \|\| urlResuelta \|\| f\.thumb/.test(bib));
*/

console.log('== T046: visor y tira sin POST extra (mapa id -> url) ==');
check('urlDeSubida reusa el mapa PMU_FICHA.urls antes de resolver por POST',
    /var mapa = \(window\.PMU_FICHA && PMU_FICHA\.urls\) \|\| null;/.test(tienda)
    && /if \(mapa && mapa\[String\(id\)\]\) \{ return Promise\.resolve\(String\(mapa\[String\(id\)\]\)\); \}/.test(tienda));
check('la URL resuelta por POST se ANOTA en el mapa (una vez por foto)',
    /window\.PMU_FICHA\.urls\[String\(id\)\] = String\(json\.data\.url\);/.test(tienda));
check('el visor navega con las URLs ya resueltas (config.urlDe memoizado, items[].url)',
    /urlDe: typeof config\.urlDe === 'function' \? config\.urlDe : null/.test(carg)
    && /items\.push\(\{ url: String\(urls\[i\]\), etiqueta: String\(id\) \}\);/.test(carg)
    && /urlDe: api\.urlDeSubida/.test(tienda));

/* --- Delegacion REAL en el motor del tema (sin navegador): un `MU` falso --- */
{
    const doc = {
        getElementById: () => null,
        createElement: () => ({ setAttribute() {}, appendChild() {}, style: {}, textContent: '' }),
        head: { appendChild() {} },
        querySelector: () => null,
        body: {}
    };
    let pedido = null;
    let cerrado = 0;
    let sigueAbierto = true;
    global.MU = {
        visor: (o) => { pedido = o; return true; },
        cerrar: () => { cerrado += 1; sigueAbierto = false; },
        estaAbierto: () => sigueAbierto
    };
    const v = require(path.join(RAIZ, 'assets/visor-pmu.js'));
    const abierto = v.abrir({
        items: [{ url: 'a.png', etiqueta: '1' }, { url: 'b.png' }],
        indice: 1, titulo: 'Tus imagenes', documento: doc
    });
    check('con MU (tema) presente el visor DELEGA en MU.visor', abierto === true && !!pedido);
    check('la delegacion mapea items/indice/titulo/tono del plugin',
        !!pedido && pedido.items.length === 2 && pedido.items[1].thumb === 'b.png'
        && pedido.indice === 1 && pedido.titulo === 'Tus imagenes' && pedido.tono === 'oscuro');
    check('estaAbierto() sigue al visor del tema', v.estaAbierto() === true);
    v.cerrar();
    check('cerrar() cierra el visor del tema y no queda delegado',
        cerrado === 1 && v.estaAbierto() === false);
    delete global.MU;
    const propio = v.abrir({ items: [{ url: 'a.png' }] });
    check('sin MU (tema ausente) no delega: cae al visor propio (D11, blanda)',
        propio === false);
}

    console.log('');

// ---------------------------------------------------------------------------
// Spec 043 (T003): el chip "Ver todas (N)" en RUNTIME, con un DOM minimo.
// T028 lo verificaba por codigo fuente; aca se pinta la tira de verdad (1, 3 y
// 12 fotos) y se comprueba el numero, la posicion del chip y cuantas miniaturas
// entran (tope 10: con 12 se reservan 9 + el chip).
// ---------------------------------------------------------------------------
console.log('== Spec 043 (T003): chip "Ver todas (N)" en runtime ==');

const apiBib = require(path.join(RAIZ, 'assets', 'biblioteca-pmu.js'));

function domMinimo() {
    function nodo(tag) {
        const n = {
            tagName: tag, childNodes: [], style: {}, dataset: {}, _attrs: {}, _listeners: {},
            className: '', id: '', type: '', title: '', textContent: '', src: '', alt: '',
            decoding: '', clientWidth: 0,
            setAttribute(k, v) { this._attrs[k] = v; },
            getAttribute(k) { return this._attrs[k]; },
            appendChild(h) { this.childNodes.push(h); h.parentNode = this; return h; },
            addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
            getBoundingClientRect() { return { width: 0 }; }
        };
        let html = '';
        Object.defineProperty(n, 'innerHTML', {
            get() { return html; },
            set(v) { html = v; if (v === '') { n.childNodes = []; } }
        });
        n.ownerDocument = doc;
        return n;
    }
    const doc = {
        _byId: {},
        createElement(tag) { return nodo(tag); },
        getElementById(id) { return doc._byId[id] || null; }
    };
    doc.head = nodo('head');
    doc.documentElement = nodo('html');
    return doc;
}

function pintar(nFotos) {
    const doc = domMinimo();
    const cont = doc.createElement('div');
    cont.clientWidth = 640; // caben 10 (ANCHO_MINI = 64)
    global.document = doc;
    global.localStorage = {
        _d: {},
        getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
        setItem(k, v) { this._d[k] = String(v); },
        removeItem(k) { delete this._d[k]; }
    };
    global.PMU_FICHA = { biblioteca: { revision: 'r1', identidad: 'idX' } };
    global.PMU_TIENDA = { postUrl: 'x' };
    apiBib.invalidar();
    if (nFotos) {
        const fotos = [];
        for (let i = 0; i < nFotos; i++) { fotos.push({ id: 'f' + i, url: 'u' + i, thumb: 't' + i, recetas: {} }); }
        global.localStorage.setItem(apiBib.clave, JSON.stringify({
            revision: 'r1', identidad: 'idX', ts: Date.now(), fotos: fotos
        }));
    }
    apiBib.tira(cont, {});
    return cont;
}

const tiraDe = (cont) => cont.childNodes[0] || null;
const chipDe = (t) => (t ? t.childNodes.filter(n => String(n.className).indexOf('pmu-bib-mas') !== -1)[0] || null : null);
const minisDe = (t) => (t ? t.childNodes.filter(n => String(n.className).indexOf('pmu-bib-mini') !== -1
    && String(n.className).indexOf('pmu-bib-mas') === -1) : []);

[[1, 1], [3, 3], [12, 9]].forEach(function (par) {
    const n = par[0]; const visibles = par[1];
    const t = tiraDe(pintar(n));
    const chip = chipDe(t);
    check('T003: ' + n + ' fotos -> el chip dice "Ver todas (' + n + ')"',
        !!chip && chip.textContent === 'Ver todas (' + n + ')');
    check('T003: ' + n + ' fotos -> el chip es el ULTIMO item de la tira',
        !!chip && !!t && t.childNodes[t.childNodes.length - 1] === chip);
    check('T003: ' + n + ' fotos -> se pintan ' + visibles + ' miniaturas (+1 chip)',
        minisDe(t).length === visibles);
});

check('T003: biblioteca vacia -> la tira no dibuja nada (sin chip roto)',
    pintar(0).childNodes.length === 0);
delete global.document;
delete global.localStorage;
delete global.PMU_FICHA;
delete global.PMU_TIENDA;

/* ---- Spec 048 (US2, T009-T012): comportamiento de la tira y el visor ---- */
const { crearDocumento } = require('./_util/dom-stub.js');

function montarTira(nFotos, elegidos) {
    const doc = crearDocumento();
    const cont = doc.createElement('div');
    cont.clientWidth = 640; // caben 10
    global.document = doc;
    global.localStorage = {
        _d: {},
        getItem(k) { return Object.prototype.hasOwnProperty.call(this._d, k) ? this._d[k] : null; },
        setItem(k, v) { this._d[k] = String(v); },
        removeItem(k) { delete this._d[k]; }
    };
    global.PMU_FICHA = { biblioteca: { revision: 'r1', identidad: 'idX' } };
    global.PMU_TIENDA = {};
    apiBib.invalidar();
    const fotos = [];
    for (let i = 0; i < nFotos; i++) { fotos.push({ id: 'f' + i, url: 'u' + i, thumb: 't' + i, recetas: {} }); }
    if (nFotos) {
        global.localStorage.setItem(apiBib.clave, JSON.stringify({ revision: 'r1', identidad: 'idX', ts: Date.now(), fotos: fotos }));
    }
    apiBib.tira(cont, { onElegir: function (f) { if (elegidos) { elegidos.push(f); } } });
    const tira = cont.childNodes[0] || null;
    const chip = tira ? tira.childNodes.filter((n) => String(n.className).indexOf('pmu-bib-mas') !== -1)[0] : null;
    return { cont: cont, fotos: fotos, tira: tira, chip: chip };
}

console.log('== Spec 048 (US2): tira y visor en runtime ==');
[1, 3, 12].forEach(function (n) {
    const m = montarTira(n, null);
    const minis = m.tira ? m.tira.childNodes.filter((x) => String(x.className).indexOf('pmu-bib-mini') !== -1
        && String(x.className).indexOf('pmu-bib-mas') === -1) : [];
    const visibles = n > 10 ? 9 : n;
    check('T009: ' + n + ' fotos -> ' + visibles + ' miniaturas', minis.length === visibles, 'minis=' + minis.length);
    check('T009: ' + n + ' fotos -> chip "Ver todas (' + n + ')"', !!m.chip && m.chip.textContent === 'Ver todas (' + n + ')',
        m.chip && m.chip.textContent);
    check('T009: ' + n + ' fotos -> el chip es el ultimo', !!m.chip && m.tira.childNodes[m.tira.childNodes.length - 1] === m.chip);
});

const elegido = [];
const m3 = montarTira(3, elegido);
const primeraMini = m3.tira.childNodes.filter((x) => String(x.className).indexOf('pmu-bib-mini') !== -1)[0];
if (primeraMini) { primeraMini.click(); }
check('T010: tocar una miniatura entrega ESA foto (id f0)', elegido.length === 1 && elegido[0].id === 'f0',
    JSON.stringify(elegido.map((e) => e.id)));

// Visor: PMUVisor stub.
let visorArgs = null;
let confirmArgs = null;
global.PMUVisor = {
    abrir: function (o) { visorArgs = o; return true; },
    cerrar: function () { },
    confirmar: function (o) { confirmArgs = o; return Promise.resolve(true); }
};
const m3b = montarTira(3, elegido);
apiBib.visor(0);
check('T011: verTodas abre el visor con todas las fotos', !!visorArgs && visorArgs.items.length === 3,
    visorArgs ? 'items=' + visorArgs.items.length : 'sin visor');
const accElegir = visorArgs ? visorArgs.acciones.filter((a) => a.etiqueta === 'Elegir')[0] : null;
const antesElegir = elegido.length;
if (accElegir) { accElegir.onAccion(1); }
check('T011: Elegir carga la foto elegida', elegido.length === antesElegir + 1 && elegido[elegido.length - 1].id === 'f1',
    JSON.stringify(elegido.map((e) => e.id)));

// Borrado en dos pasos: la LLAMADA al endpoint es sincronica (el dialogo es async).
var llamadasBorrar = [];
global.PMU_API = {
    borrarFoto: function (id, confirmar) {
        llamadasBorrar.push(!!confirmar);
        if (confirmar) { return Promise.resolve({ success: true }); }
        return Promise.reject({ referencias: [{ tipo: 'item', id: 'x' }] });
    }
};
const m3c = montarTira(2, null);
apiBib.visor(0);
const accBorrar = visorArgs.acciones.filter((a) => /Borrar|Eliminar/.test(a.etiqueta))[0];
if (accBorrar) { accBorrar.onAccion(0); }
check('T012: el borrado va PRIMERO sin confirmar', llamadasBorrar.length >= 1 && llamadasBorrar[0] === false,
    JSON.stringify(llamadasBorrar));
check('T012: el codigo reintenta con confirmar=1 (dialogo)', /PMUVisor\.confirmar/.test(bib),
    'sin confirmar en el fuente');
check('#N3 (fix 2026-11-24): el visor (Ver todas) usa la imagen COMPLETA, no la miniatura 80x80',
    /url: String\(f\.url \|\| f\.thumb_data/.test(bib));

delete global.document;
delete global.localStorage;
delete global.PMU_FICHA;
delete global.PMU_TIENDA;
delete global.PMUVisor;
delete global.PMU_API;

if (fallos === 0) { console.log('BIBLIOTECA CONTRATO OK (' + ok + ' checks)'); process.exit(0); }
console.log('BIBLIOTECA CONTRATO FALLA (' + fallos + ' de ' + (ok + fallos) + ')');
process.exit(1);
