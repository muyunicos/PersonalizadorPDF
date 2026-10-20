/**
 * Puerta Node del cableado de campos (spec 012, T012).
 *
 * Comprueba que el admin y la ficha usan EXACTAMENTE el mismo montaje y que ese
 * montaje cumple las reglas de salida del valor dual (contracts/campos.md).
 * Corre sin DOM: se inyecta un `document` minimo en un contexto `vm`.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let fallos = 0;
function check(nombre, ok, extra) {
  if (!ok) { fallos++; }
  console.log((ok ? '  OK   ' : '  FALLA ') + nombre + (extra ? '  [' + extra + ']' : ''));
}

// --- mini-DOM suficiente para el montaje ---
class FakeEl {
  constructor(tag) {
    this.tagName = tag || 'div';
    this.className = '';
    this.children = [];
    this.attrs = {};
    this._html = '';
    this.value = '';
    this.textContent = '';
    this.listeners = {};
  }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  appendChild(el) { this.children.push(el); return el; }
  addEventListener(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  set innerHTML(v) { this._html = v; }
  get innerHTML() { return this._html; }
}

const sandbox = { console, module: { exports: {} }, document: { createElement: (t) => new FakeEl(t) } };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const RAIZ = path.join(__dirname, '..', 'assets', 'campo-montar.js');
vm.runInContext(fs.readFileSync(RAIZ, 'utf8'), sandbox, { filename: 'campo-montar.js' });
const PMUCampo = sandbox.module.exports;

console.log('== export del modulo ==');
check('campo-montar.js exporta PMUCampo', !!PMUCampo);
check('expone montar/montarUno/contextoRaiz', typeof PMUCampo.montar === 'function'
  && typeof PMUCampo.montarUno === 'function' && typeof PMUCampo.contextoRaiz === 'function');

console.log('\n== contextoRaiz (canal de salida) ==');
const est = {};
const ctx = PMUCampo.contextoRaiz(est);
ctx.set(55, { valor: '0000FF', cliente: 'Azul' });
check('ctx.set publica valor y cliente', est[55] && est[55].valor === '0000FF' && est[55].cliente === 'Azul');
check('ctx.get devuelve lo publicado', ctx.get(55) && ctx.get(55).cliente === 'Azul');
ctx.set(0, { valor: 'x' });
check('ctx.set ignora id 0', !est[0]);
ctx.set(55, {});
check('ctx.set sin valor deja null/vacio', est[55].valor === null && est[55].cliente === '');

console.log('\n== valorDe (input vs texto) ==');
const input = new FakeEl('input'); input.value = 'hola';
check('un input devuelve su value', PMUCampo.valorDe(input) === 'hola');
const parrafo = new FakeEl('p'); parrafo.textContent = 'Azul';
check('un no-control devuelve textContent', PMUCampo.valorDe(parrafo) === 'Azul');
check('un elemento null devuelve vacio', PMUCampo.valorDe(null) === '');

console.log('\n== montarUno (reglas de salida) ==');
function raiz() { return new FakeEl('div'); }

{
  const r = raiz(); const estado = {};
  PMUCampo.montarUno(r, {
    id: 1, htm: '<input data-rol="valor">',
    js: 'function(ctx, root){ ctx.set(1, {valor: "del-js", cliente: "Del JS"}); }'
  }, estado);
  check('regla 1: el campo.js publica', estado[1] && estado[1].valor === 'del-js' && estado[1].cliente === 'Del JS');
}
{
  const r = raiz(); const estado = {};
  PMUCampo.montarUno(r, { id: 2, htm: '<input>', js: 'function(ctx){ estoNoExiste(); }' }, estado);
  check('regla 1b: un js que lanza deja el campo vacio', estado[2] && estado[2].valor === null && estado[2].cliente === '');
}
{
  const r = raiz(); const estado = {};
  PMUCampo.montarUno(r, { id: 3, htm: '<input>' }, estado);
  check('sin js ni data-rol no publica nada', estado[3] === undefined);
  check('el wrapper lleva la clase .pmu-campo-{id}', r.children[0].className.indexOf('pmu-campo-3') !== -1, r.children[0].className);
  check('el wrapper marca data-campo', r.children[0].getAttribute('data-campo') === 3,
    'value=' + r.children[0].getAttribute('data-campo'));
}

console.log('\n== reglas y prohibiciones por codigo ==');
const src = fs.readFileSync(RAIZ, 'utf8');
check('busca [data-rol="valor"]', src.indexOf('[data-rol="valor"]') !== -1);
check('busca [data-rol="cliente"]', src.indexOf('[data-rol="cliente"]') !== -1);
check('el cliente NUNCA cae a valor (D21)', src.indexOf('cliente: elCliente ? valorDe(elCliente)') !== -1);
check('NO inyecta titulo (D20)', src.indexOf('pmu-campo-titulo') === -1);
check('NO usa traducir() (D21)', src.indexOf('traducir') === -1);
check('acepta htm y el legacy contenido', src.indexOf('campo.htm || campo.contenido') !== -1);
check('acepta js y el legacy script', src.indexOf('campo.js || campo.script') !== -1);

console.log('\n== montar() varios campos ==');
{
  const r = raiz();
  const estado = PMUCampo.montar(r, [
    { id: 1, js: 'function(ctx){ ctx.set(1, {valor:"a", cliente:"A"}); }' },
    { id: 2, js: 'function(ctx){ ctx.set(2, {valor:"b", cliente:"B"}); }' }
  ]);
  check('monta varios campos', estado[1] && estado[2]);
  check('cada campo va en su wrapper', r.children.length === 2, r.children.length + ' hijos');
}

console.log('\n== inicial (edicion del item) ==');
{
  // `inicial` lo carga `montar()` (antes de montarUno); montarUno solo lo usa para prellenar.
  const estado = PMUCampo.montar(raiz(), [{ id: 7, htm: '<input>' }], { 7: { valor: 'Ana', cliente: 'Ana Lopez' } });
  check('el valor previo queda disponible', estado[7] && estado[7].valor === 'Ana', JSON.stringify(estado[7]));
  check('el cliente previo tambien queda', estado[7] && estado[7].cliente === 'Ana Lopez');
}

console.log('\n== cableado de la ficha ==');
const tienda = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tienda.js'), 'utf8');
check('tienda.js delega en PMUCampo.montar', tienda.indexOf('PMUCampo.montar(raizEl, campos, inicial)') !== -1);
check('tienda.js ya no define contextoRaiz', tienda.indexOf('function contextoRaiz') === -1);
check('tienda.js avisa si falta el modulo', tienda.indexOf('falta campo-montar.js') !== -1);
// Spec 018 (T006): API publica PMU_API. El ORDEN es el contrato: el `campo.js`
// corre DENTRO de `montarCampos`, asi que la API COMPLETA (con montarCargador)
// tiene que estar publicada antes. (Antes el check comparaba `var api = {` y no
// `global.PMU_API = api;`: falso positivo que dejo pasar el bug real.)
check('tienda.js publica PMU_API completa ANTES de montarCampos',
  tienda.indexOf('api.montarCargador = function') !== -1
  && tienda.indexOf('api.montarCargador = function') < tienda.indexOf('global.PMU_API = api;')
  && tienda.indexOf('global.PMU_API = api;') !== -1
  && tienda.indexOf('global.PMU_API = api;') < tienda.indexOf('api.estado = montarCampos('));
check('PMU_API expone subirFoto', tienda.indexOf('api.subirFoto = function') !== -1);
check('PMU_API expone urlDeSubida', tienda.indexOf('api.urlDeSubida = function') !== -1);
check('PMU_API expone montarCargador', tienda.indexOf('api.montarCargador = function') !== -1);
// Spec 020 (D4): el cargador LEGACY ya no existe: cada campo lo monta en su
// `campo.js` con `PMU_API.montarCargador`.
check('el cargador legacy se elimino (spec 020 D4)',
  tienda.indexOf('function montarCargadores') === -1
  && tienda.indexOf('if (campo.js) { return; }') === -1);
// `montar()` se llama UNA sola vez (el `campo.js` no debe volver a montarlo).
check('montarCargador monta una sola vez',
  tienda.indexOf('var montado = cargador.montar();') !== -1
  && tienda.indexOf('return montado ? cargador : null;') !== -1);
// La guia de envoltura (spec 016 F6) se resuelve desde PMU_FICHA.campos: el
// `campo.js` solo conoce `ctx` (id + set), no el objeto del campo.
check('montarCargador resuelve la envoltura desde PMU_FICHA.campos',
  tienda.indexOf('(ficha.campos || []).forEach(function (c)') !== -1
  && tienda.indexOf('defCampo && defCampo.envoltura') !== -1);
// El cargador no pisa lo que publico el campo.js al montar (bug historico).
check('montarCargador no pisa el valor del campo.js al montar',
  tienda.indexOf('var mio = false;') !== -1
  && tienda.indexOf('} else if (mio || (est.ids && est.ids.length > 0)) {') !== -1);

console.log('\n== spec 018: la plantilla de imagen y el preview ==');
{
  const plugin = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const uploads = fs.readFileSync(path.join(__dirname, '..', 'inc', 'class-pmu-uploads.php'), 'utf8');
  // La plantilla declara el cargador EN EL CAMPO (D1).
  check('la plantilla imagen trae el contenedor [data-pmu-cargador]',
    plugin.indexOf('<div data-pmu-cargador></div>') !== -1);
  check('la plantilla imagen monta con PMU_API.montarCargador',
    plugin.indexOf('window.PMU_API.montarCargador(cont, {') !== -1);
  check('la plantilla imagen declara RANURAS por defecto (no monta en vacio)',
    plugin.indexOf('var RANURAS = [') !== -1
    && plugin.indexOf("{ w: 1000, h: 1000, forma: 'auto', min: 1, max: 1, phsize: 0, r: 0 }") !== -1);
  check('la plantilla NO vuelve a llamar montar() (montarCargador ya monta)',
    plugin.indexOf('cargador && cargador.montar()') === -1);
  // El preview del admin corre el mismo campo.js con un stub de PMU_API (D9).
  check('el preview define el stub PMU_API en la pagina del admin (realm del campo.js)',
    adminJs.indexOf('function apiPreview()') !== -1
    && adminJs.indexOf('activarApiPreview();') !== -1
    && adminJs.indexOf('desactivarApiPreview();') !== -1);
  check('el stub del preview NO inyecta PMU_API en el srcdoc',
    adminJs.indexOf("'<script>window.PMU_API") === -1);
  check('el preview no llama al endpoint de subida real',
    adminJs.indexOf("'personalizador_pdf_subida'") === -1);
  check('el preview no monta un cargador legacy (solo el del campo.js)',
    adminJs.indexOf('campo.cargador') === -1
    && adminJs.indexOf('&& !campo.js && window.CargadorPMU') === -1);
  // La consola ya no declara el cargador en el formulario (D1/D5).
  check('el form del campo NO postea `cargador`', plugin.indexOf('name="cargador"') === -1);
  check('el form del campo NO postea `array` ni `protegido`',
    plugin.indexOf('name="array"') === -1 && plugin.indexOf('name="protegido"') === -1);
  check('el editor expone el tipo como <select> (D4)',
    plugin.indexOf('<select name="tipo" class="regular-text">') !== -1);
  // Spec 020 (D5): sin write-through: las claves muertas no existen.
  check('el motor no arrastra claves muertas al editar (spec 020 D5)',
    uploads.indexOf('datos_con_legacy') === -1);
  check('campo_editar acepta el tipo (D4)',
    uploads.indexOf('public function campo_editar($id, array $datos, $htm = \'\', $css = \'\', $js = \'\', $tipo = null)') !== -1);
}

console.log('\n== spec 019: ranura adaptativa (phsize + aviso) ==');
{
  // La funcion pura vive en tienda.js: se carga en un sandbox minimo (sin DOM
  // real) para ejecutarla de verdad, no solo leer su fuente.
  const doc019 = {
    readyState: 'loading',
    addEventListener: () => {},
    createElement: (t) => new FakeEl(t),
    querySelector: () => null,
    querySelectorAll: () => []
  };
  const sb019 = { console, document: doc019, setTimeout, Promise, Date };
  sb019.window = sb019;
  sb019.globalThis = sb019;
  vm.createContext(sb019);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'assets', 'tienda.js'), 'utf8'),
    sb019, { filename: 'tienda.js' });
  const puro019 = (sb019.PMU_Tienda && sb019.PMU_Tienda.puro) || {};
  const nr = puro019.normalizarRanura;
  check('tienda.js expone PURO.normalizarRanura', typeof nr === 'function');
  if (typeof nr === 'function') {
    const grupo = { grupo_w: 1000, grupo_h: 500 };
    const r0 = nr({ w: 800, h: 600, forma: 'fit', min: 1, max: 1 }, grupo);
    check('phsize 0 (default) usa lo declarado', r0.w === 800 && r0.h === 600 && r0.aviso === '',
      r0.w + 'x' + r0.h);
    const r1 = nr({ w: 1, h: 1, phsize: 1 }, grupo);
    check('phsize 1 toma el tamano del grupo', r1.w === 1000 && r1.h === 500, r1.w + 'x' + r1.h);
    const r2 = nr({ w: 1, h: 1, phsize: 2 }, grupo);
    check('phsize 2 duplica el grupo', r2.w === 2000 && r2.h === 1000, r2.w + 'x' + r2.h);
    const rsin = nr({ w: 300, h: 200, phsize: 1 }, null);
    check('phsize sin grupo degrada a lo declarado y avisa',
      rsin.w === 300 && rsin.h === 200 && rsin.aviso.indexOf('sin grupo asociado') !== -1, rsin.aviso);
    const rcap = nr({ w: 1, h: 1, phsize: 2 }, { grupo_w: 2000, grupo_h: 1600 });
    check('PH_MAX acota y avisa', rcap.w <= 3000 && rcap.h <= 3000
      && rcap.aviso.indexOf('PH_MAX') !== -1, rcap.w + 'x' + rcap.h);
    const rform = nr({ w: 10, h: 10, forma: 'circulo', phsize: 1 }, grupo);
    check('circulo explicito gana sobre el aspecto del grupo',
      rform.forma === 'circulo' && rform.w === 1000, rform.forma);
    const rauto = nr({ w: 10, h: 10, forma: 'auto', phsize: 1, r: 1, size: 0.9, ox: 5, oy: -5 }, grupo);
    check('auto + r + size + ox + oy se normalizan con phsize',
      rauto.forma === 'auto' && rauto.w === 1000 && rauto.r === 1 && rauto.size === 0.9 && rauto.ox === 5 && rauto.oy === -5);
    const rmin = nr({ w: 10, h: 10, min: 0, max: 0 }, null);
    check('min/max se normalizan a >= 1', rmin.min === 1 && rmin.max === 1);
  }
  const tienda019 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tienda.js'), 'utf8');
  check('montarCargador normaliza las ranuras antes de montar',
    tienda019.indexOf('PURO.normalizarRanura(r, defCampo)') !== -1);
  const selector019 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'selector-pmu.js'), 'utf8');
  check('el selector avisa la ampliacion (informativo)',
    selector019.indexOf('_factorAmpliacion = function') !== -1
    && selector019.indexOf("' · se amplia '") !== -1
    && selector019.indexOf('_factorAmpliacion()') !== -1);
  const cargador019 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cargador-pmu.js'), 'utf8');
  check('la tira muestra el aviso de la ranura', cargador019.indexOf('cpmu-aviso') !== -1);
}

console.log('\n== spec 018: el cargador NUNCA es mudo + plantilla recargable ==');
{
  const tienda18 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tienda.js'), 'utf8');
  const admin18 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const plugin18 = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  // Avisos CON LA CAUSA (antes: silencio total si faltaba el contenedor o las ranuras).
  check('avisa si el campo no tiene contenedor',
    tienda18.indexOf('el campo no tiene contenedor') !== -1);
  check('avisa si el campo declara 0 ranuras',
    tienda18.indexOf('el campo declaro 0 ranuras') !== -1);
  check('avisa si CargadorPMU no dibujo la ranura',
    tienda18.indexOf('no dibujo la ranura') !== -1);
  check('la plantilla avisa si falta el contenedor en el HTML',
    plugin18.indexOf('no tiene <div data-pmu-cargador></div> en su HTML') !== -1);
  check('la plantilla avisa si falta PMU_API/CargadorPMU',
    plugin18.indexOf('falta PMU_API o CargadorPMU en la ficha') !== -1);
  // Boton "Cargar la plantilla de este tipo" (T010): plantillas servidas por PHP.
  check('el drawer tiene el boton de plantilla',
    plugin18.indexOf('class="button ec-c-plantilla"') !== -1);
  check('las 3 plantillas viajan al navegador (una sola fuente)',
    plugin18.indexOf("'plantillas' => [") !== -1
    && plugin18.indexOf("$this->plantilla_campo('imagen')") !== -1);
  check('el admin rellena HTML/CSS/JS con la plantilla elegida',
    admin18.indexOf("$(document).on('click', '.ec-c-plantilla'") !== -1
    && admin18.indexOf("textarea[name=js]').val(pl.js") !== -1);
}
check('idsDe ya no filtra el fantasma "Array" (spec 020 B5)',
  tienda.indexOf("x !== 'Array'") === -1);
check('omisible muestra la vista previa igual (solo no bloquea el carrito)',
  tienda.indexOf('bloquearCarrito(!ficha.preview_omisible)') !== -1
  && tienda.indexOf('omisible = sin boton de vistas') === -1);

console.log('\n== CSS/JS global (spec 012, T020) ==');
{
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const camposPhp = fs.readFileSync(path.join(__dirname, '..', 'admin', 'campos.php'), 'utf8');
  const plugin = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  check('la consola imprime el portador del CSS global prefijado',
    camposPhp.indexOf('id="pmu-campo-global-css"') !== -1);
  check('el portador es type="text/css" (no se aplica en la consola)',
    camposPhp.indexOf('<script type="text/css" id="pmu-campo-global-css">') !== -1);
  // FR-024 se conserva: el global se edita desde la pestana Campos, sin navegar.
  // Spec 013 (T006) cambia WHERE, no el hecho: ahora va al pie y plegado, porque
  // es lo mas tecnico y lo de uso mas raro, y antes tapaba la lista de campos.
  const iGlobales = camposPhp.indexOf('Estilos globales / Script global');
  const iFormGlobal = camposPhp.indexOf('ec-form-campo-global');
  const iTabla = camposPhp.indexOf('ec-campos-tabla');
  check('el global se edita desde la pestana Campos (FR-024)',
    iFormGlobal !== -1 && iGlobales !== -1);
  check('el global esta al pie, despues de la lista de campos (T006)',
    iTabla !== -1 && iFormGlobal > iTabla);
  check('el global viene plegado, no ocupa la pantalla',
    camposPhp.indexOf('<details class="ec-c-globales">') !== -1);
  check('el form del global usa su propia action',
    camposPhp.indexOf('personalizador_pdf_campo_global') !== -1
    && adminJs.indexOf("pmuForm($('form.ec-form-campo-global'), 'personalizador_pdf_campo_global'") !== -1);
  // pmuForm REGISTRA el handler: si se llama desde dentro de otro submit, el
  // POST nunca sale (bug real, 2026-10-04). El global no debe enlazarse asi.
  check('el global NO se enlaza desde dentro de un submit',
    !/ec-form-campo-global'?\)\.on\('submit'/.test(adminJs));
  check('el preview lee el portador del global', adminJs.indexOf("getElementById('pmu-campo-global-css')") !== -1);
  check('el preview inyecta el global en el srcdoc', adminJs.indexOf("'<style>' + globalCss + '</style>'") !== -1);
  check('el preview marca el contenedor con data-pmu-panel (FR-006)',
    adminJs.indexOf('<div id="pmu-preview" data-pmu-panel>') !== -1);
  check('el global se carga solo si la pagina tiene >=1 campo (FR-025)',
    plugin.indexOf('if ($n_campos !== null && (int) $n_campos >= 1)') !== -1);
  check('el JS global se engancha ANTES de campo-montar (D21)',
    plugin.indexOf("wp_add_inline_script('personalizador-pdf-campo-montar', $js, 'before')") !== -1);
  check('el CSS global se inyecta con wp_add_inline_style',
    plugin.indexOf("wp_add_inline_style('personalizador-pdf-panel-global', $css)") !== -1);
  check('el prefijo del CSS global es [data-pmu-panel]',
    plugin.indexOf("public function css_global_prefijo($css, $prefijo = '[data-pmu-panel]')") !== -1);
}

console.log('\n== baja de campos: confirmacion antes del POST ==');
{
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const inicio = adminJs.indexOf('function enlazarBaja($forms)');
  const fin = adminJs.indexOf("enlazarBaja($('form.ec-form-campo-baja'))", inicio);
  const baja = inicio >= 0 && fin > inicio ? adminJs.slice(inicio, fin) : '';
  check('Cancelar la baja detiene pmuForm antes del POST',
    baja.indexOf('submit.pmu-confirma') >= 0
    && baja.indexOf('submit.pmu-confirma') < baja.indexOf("pmuForm($f, 'personalizador_pdf_campo_baja'"));
}

console.log('\n== cargador de imagenes (spec 012, T023/T024) ==');
{
  const Carg = require(path.join(__dirname, '..', 'assets', 'cargador-pmu.js'));

  // normalizarRanuras: descarta lo invalido y no inventa medidas (T023).
  check('cargador: descarta la ranura sin w/h',
    Carg.normalizarRanuras([{ w: 0, h: 10, min: 1, max: 1 }]).length === 0);
  check('cargador: sin ranuras validas no monta nada',
    new Carg.CargadorPMU(null, { ranuras: [{ h: 10 }] }).montar() === false);
  check('cargador: normaliza min/max', (() => {
    const r = Carg.normalizarRanuras([{ w: 10, h: 10, min: 3, max: 1 }])[0];
    return r.min === 3 && r.max === 3;   // max nunca queda por debajo de min
  })());
  check('cargador: forma desconocida cae en rectangulo',
    Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'triangulo' }])[0].forma === 'rectangulo');
  check('cargador: formas nuevas (circulo, cuadrado, ovalo, auto, rectangulo) y alias se respetan',
    Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'circulo' }])[0].forma === 'circulo'
    && Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'ovalo' }])[0].forma === 'ovalo'
    && Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'cuadrado' }])[0].forma === 'cuadrado'
    && Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'auto', r: 1, size: 0.75, ox: 12, oy: -8 }])[0].r === 1);

  // D16/T023b: `min` es la validacion real.
  const ranuras = Carg.normalizarRanuras([
    { w: 100, h: 100, min: 2, max: 4 },
    { w: 50, h: 50, min: 1, max: 1 }
  ]);
  const st = Carg.estadoInicial(ranuras);
  check('cargador: nace incompleto (min=2 en la 1era ranura)',
    Carg.completo(ranuras, st).listo === false && Carg.completo(ranuras, st).faltan === 3);
  st[0].ids = ['a1'];
  check('cargador: con 1 de 2 sigue incompleto y falta 2',
    Carg.completo(ranuras, st).listo === false && Carg.completo(ranuras, st).faltan === 2);
  st[0].ids = ['a1', 'a2']; st[1].ids = ['b1'];
  check('cargador: con los minimos queda completo',
    Carg.completo(ranuras, st).listo === true && Carg.completo(ranuras, st).faltan === 0);
  st[0].ids = ['a1'];
  check('cargador: quitar vuelve a bloquear', Carg.completo(ranuras, st).listo === false);

  // FR-033/FR-034: ids aplanados y `array`.
  check('cargador: publica los ids aplanados por ranura',
    JSON.stringify(Carg.idsPlanos(st)) === JSON.stringify(['a1', 'b1']));
  check('cargador: `array` si alguna ranura admite mas de una',
    Carg.esArray(ranuras) === true);
  check('cargador: `array` false si todas son de una sola',
    Carg.esArray(Carg.normalizarRanuras([{ w: 10, h: 10, max: 1 }])) === false);

  // Cableado: el cargador viaja a la ficha antes que tienda.js.
  const plugin2 = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  const tienda2 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'tienda.js'), 'utf8');
  check('cargador-pmu.js se encola', plugin2.indexOf("assets/cargador-pmu.js") !== -1);
  check('tienda.js depende del cargador', plugin2.indexOf("'personalizador-pdf-cargador'") !== -1);
  check('el montaje NO tiene camino legacy (spec 020 D4)',
    tienda2.indexOf('montarCargadores(raizEl, campos, estado)') === -1);
  check('tienda.js sube al endpoint de subida',
    tienda2.indexOf("'personalizador_pdf_subida'") !== -1);
  check('el cargador NO pisa el valor del campo.js al montar',
    /var mio = false;/.test(tienda2)
    && /} else if \(mio \|\| \(est\.ids && est\.ids\.length > 0\)\) \{/.test(tienda2));

  // Spec 016 (correccion 4.6.1): la plantilla "Imagen (cargador)" no debe
  // llevar el boton placeholder con PMUCargador (nombre que nunca existio):
  // el cargador lo monta el sistema (montarCargadores / preview del admin).
  check('la plantilla imagen ya no referencia PMUCargador',
    plugin2.indexOf('PMUCargador') === -1);
  check('la plantilla imagen ya no trae el boton placeholder',
    plugin2.indexOf('data-pmu-subir') === -1
    && plugin2.indexOf('todavia no esta disponible') === -1);
  check('la plantilla imagen ya no declara cargador legacy (spec 020 D4)',
    plugin2.indexOf("'cargador' => 'size:1000 max:6'") === -1
    && plugin2.indexOf("'cargador' => null") === -1);
  // T011b/FR-009: "Probar" dibuja las ranuras sin subir nada.
  const cargadorJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'cargador-pmu.js'), 'utf8');
  const adm = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const plug = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  // Spec 021: el selector viaja a la consola para el preview del cargador.
  // Cropper se retiro (el recorte lo hace el canvas unificado del selector).
  check('la consola encola el selector (preview del cargador) y ya no cropper',
    (plug.match(/assets\/selector-pmu\.js/g) || []).length >= 2
    && plug.indexOf('personalizador-pdf-cropper') === -1);
  check('el plugin ya no emite el aviso de migracion v1',
    plug.indexOf('motor:campos:migrar:pendiente') === -1);
  // Spec 016 (4.6.3): la v1 se retiro; el aviso de migracion NO debe volver.
  const camposPhp = fs.readFileSync(path.join(__dirname, '..', 'admin', 'campos.php'), 'utf8');
  const uploadsJs = fs.readFileSync(path.join(__dirname, '..', 'inc', 'class-pmu-uploads.php'), 'utf8');
  check('sin migracion v1 en la consola (retirada en 4.6.3)',
    camposPhp.indexOf('personalizador_pdf_campo_migrar') === -1
    && adm.indexOf('personalizador_pdf_campo_migrar') === -1
    && uploadsJs.indexOf('migrar_campos') === -1);
  check('la fila ya NO emite data-cargador (spec 020 D4)', plug.indexOf('data-cargador=') === -1);
  check('cargador-pmu.js se encola tambien en la consola',
    (plug.match(/assets\/cargador-pmu\.js/g) || []).length >= 2);
  check('admin.js ya no lee data-cargador (spec 020 D4)',
    adm.indexOf("attr('data-cargador')") === -1);
  check('el preview simula la subida (stub apiPreview, sin endpoint)',
    adm.indexOf('function apiPreview()') !== -1
    && adm.indexOf('URL.createObjectURL(blob)') !== -1
    && adm.indexOf('urlDe: function (id)') !== -1);
  check('el preview no pinta un boton de agregar muerto',
    /if \(!this\.config\.preview\) \{\s*zona\.appendChild\(boton\)/.test(cargadorJs));
  // Spec 021 (limpieza de la tira): la ficha queda limpia y lo tecnico va a la consola.
  check('la tira dice "Cargar imagen" (no "Agregar imagen")',
    cargadorJs.indexOf("boton.textContent = 'Cargar imagen'") !== -1
    && cargadorJs.indexOf("'Agregar imagen'") === -1);
  check('sin boton "Listo" ni texto de estado (era decorativo)',
    cargadorJs.indexOf('cpmu-listo') === -1 && cargadorJs.indexOf('cpmu-estado') === -1
    && cargadorJs.indexOf("'Listo'") === -1);
  check('sin guia de la tira (cpmu-guia)',
    cargadorJs.indexOf('cpmu-guia') === -1 && cargadorJs.indexOf('_guia') === -1);
  check('el aviso de faltantes solo aparece si falta algo (cpmu-falta)',
    cargadorJs.indexOf('cpmu-falta') !== -1
    && cargadorJs.indexOf('por cargar.') !== -1);
  check('los datos tecnicos van SOLO con `tecnico` (preview de la consola)',
    /if \(this\.config\.tecnico\) \{/.test(cargadorJs)
    && adm.indexOf('tecnico: true') !== -1);
}

console.log('\n' + (fallos === 0 ? 'CAMPOS CONTRATO OK' : 'CAMPOS CONTRATO FALLA: ' + fallos));
process.exit(fallos === 0 ? 0 : 1);
