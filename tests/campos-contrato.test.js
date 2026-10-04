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

console.log('\n== CSS/JS global (spec 012, T020) ==');
{
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'assets', 'admin.js'), 'utf8');
  const camposPhp = fs.readFileSync(path.join(__dirname, '..', 'admin', 'campos.php'), 'utf8');
  const plugin = fs.readFileSync(path.join(__dirname, '..', 'personalizador-pdf.php'), 'utf8');
  check('la consola imprime el portador del CSS global prefijado',
    camposPhp.indexOf('id="pmu-campo-global-css"') !== -1);
  check('el portador es type="text/css" (no se aplica en la consola)',
    camposPhp.indexOf('<script type="text/css" id="pmu-campo-global-css">') !== -1);
  check('la tarjeta del global esta siempre arriba (FR-024)',
    camposPhp.indexOf('Estilos globales / Script global') !== -1
    && camposPhp.indexOf('Estilos globales / Script global') < camposPhp.indexOf('<h2>Nuevo campo</h2>'));
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
  check('cargador: forma desconocida cae en rect',
    Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'triangulo' }])[0].forma === 'rect');
  check('cargador: forma conocida se respeta',
    Carg.normalizarRanuras([{ w: 10, h: 10, forma: 'circle' }])[0].forma === 'circle');

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
  check('tienda.js monta los cargadores al montar los campos',
    tienda2.indexOf('montarCargadores(raizEl, campos, estado)') !== -1);
  check('tienda.js sube al endpoint de subida',
    tienda2.indexOf("'personalizador_pdf_subida'") !== -1);
  check('el cargador NO pisa el valor del campo.js al montar',
    /if \(mio \|\| est\.ids\.length > 0\)/.test(tienda2));
}

console.log('\n' + (fallos === 0 ? 'CAMPOS CONTRATO OK' : 'CAMPOS CONTRATO FALLA: ' + fallos));
process.exit(fallos === 0 ? 0 : 1);