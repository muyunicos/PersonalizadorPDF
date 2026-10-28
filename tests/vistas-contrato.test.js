'use strict';
/**
 * tests/vistas-contrato.test.js - Marca de "visto" de la galeria (spec 035,
 * D11 + §3.5), la logica PURA de `assets/tienda.js`:
 * `vistaObligatoria` / `ordenarVistas` / `claveVisto` / `marcarVisto` /
 * `faltanVistas` / `reconciliarVistos`.
 *
 *   node tests/vistas-contrato.test.js   -> debe decir "VISTAS CONTRATO OK (N checks)"
 *
 * Node corre SOLO en desarrollo (nunca en el servidor productivo).
 */
const PURO = require('../assets/tienda.js');

let fallos = 0;
let checks = 0;
function check(nombre, cond, dato) {
    checks++;
    const extra = (dato === undefined || dato === '') ? '' : '  [' + dato + ']';
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre + extra);
    if (!cond) { fallos++; }
}
function grupo(t) {
    console.log('\n== ' + t + ' ==');
}

/** Vista con el shape que arma `generarVista` (pdfDatos + mockup). */
function vista(id, omisible, fallida) {
    return {
        mockup: { id: id },
        pdfDatos: { pdf: 'p' + id, preview_omisible: !!omisible },
        fallida: !!fallida
    };
}

// ---------------------------------------------------------------------------
grupo('1: que vista OBLIGA (D11)');
// ---------------------------------------------------------------------------
check('sin preview_omisible la vista es obligatoria', PURO.vistaObligatoria(vista(1, false)) === true);
check('con preview_omisible NO obliga (el PDF queda eximido)', PURO.vistaObligatoria(vista(2, true)) === false);
check('una vista FALLIDA nunca obliga, aun siendo no omisible',
    PURO.vistaObligatoria(vista(3, false, true)) === false);
check('sin vista no revienta', PURO.vistaObligatoria(null) === false);

// ---------------------------------------------------------------------------
grupo('2: ORDEN — las obligatorias van PRIMERO (§3.5)');
// ---------------------------------------------------------------------------
const mezcla = [vista(1, true), vista(2, false), vista(3, true), vista(4, false), vista(5, true)];
const orden = PURO.ordenarVistas(mezcla);
check('las obligatorias quedan delante', orden.map(function (v) { return v.mockup.id; }).join(',') === '2,4,1,3,5',
    orden.map(function (v) { return v.mockup.id; }).join(','));
check('el orden es ESTABLE dentro de cada grupo (se respeta el del PDF)',
    orden.filter(function (v) { return PURO.vistaObligatoria(v); })
        .map(function (v) { return v.mockup.id; }).join(',') === '2,4');
check('no muta la lista de entrada', mezcla.map(function (v) { return v.mockup.id; }).join(',') === '1,2,3,4,5');
check('lista vacia devuelve lista vacia', PURO.ordenarVistas([]).length === 0);
check('sin argumento no revienta', PURO.ordenarVistas().length === 0);

// ---------------------------------------------------------------------------
grupo('3: clave y marca');
// ---------------------------------------------------------------------------
check('la clave es el mockup_id en texto', PURO.claveVisto(vista(77, false)) === '77');
check('sin mockup_id no hay clave (vista transitoria)', PURO.claveVisto({ pdfDatos: {} }) === '');
check('marcar agrega sin perder lo anterior',
    PURO.marcarVisto({ 1: true }, '2')[1] === true && PURO.marcarVisto({ 1: true }, '2')['2'] === true);
check('marcar NO muta el mapa de entrada',
    Object.keys(PURO.marcarVisto({ 1: true }, '2')).length === 2 && Object.keys({ 1: true }).length === 1);
check('marcar con clave vacia no agrega basura',
    Object.keys(PURO.marcarVisto({}, '')).length === 0);

// ---------------------------------------------------------------------------
grupo('4: faltanVistas — lo unico que bloquea la compra');
// ---------------------------------------------------------------------------
const cinco = [vista(1, false), vista(2, true), vista(3, false), vista(4, true), vista(5, false)];
check('al abrir la galeria faltan las 3 obligatorias', PURO.faltanVistas(cinco, {}) === 3);
check('ver una obligatoria baja a 2', PURO.faltanVistas(cinco, { 1: true }) === 2);
check('las OMISIBLES no cuentan aunque no se hayan visto',
    PURO.faltanVistas([vista(1, true), vista(2, true)], {}) === 0);
check('ver la ULTIMA obligatoria desbloquea del todo',
    PURO.faltanVistas(cinco, { 1: true, 3: true, 5: true }) === 0);
check('una vista FALLIDA no se exige (podada)',
    PURO.faltanVistas([vista(1, false, true)], {}) === 0);
check('una vista sin id se cuenta (no se puede persistir)',
    PURO.faltanVistas([{ pdfDatos: {} }], {}) === 1);
check('sin vistas no falta nada', PURO.faltanVistas([], {}) === 0);

// ---------------------------------------------------------------------------
grupo('5: reconciliacion al montar (draft -> cart_item_key)');
// ---------------------------------------------------------------------------
const rec = PURO.reconciliarVistos({ 1: true }, ['3']);
check('la union gana: lo local + lo que confirmo el servidor',
    rec[1] === true && rec['3'] === true);
check('ignora entradas vacias que publique el servidor',
    Object.keys(PURO.reconciliarVistos({}, ['', null, undefined])).length === 0);
check('sin nada publicado equivale a lo local',
    PURO.reconciliarVistos({ 2: true }, []).length === undefined
    && PURO.reconciliarVistos({ 2: true }, [])['2'] === true);

// ---------------------------------------------------------------------------
console.log('\nVISTAS CONTRATO ' + (fallos ? ('FALLA (' + fallos + ' de ' + checks + ')') : ('OK (' + checks + ' checks)')));
process.exit(fallos ? 1 : 0);