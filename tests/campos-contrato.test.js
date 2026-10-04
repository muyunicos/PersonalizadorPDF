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

console.log('\n' + (fallos === 0 ? 'CAMPOS CONTRATO OK' : 'CAMPOS CONTRATO FALLA: ' + fallos));
process.exit(fallos === 0 ? 0 : 1);