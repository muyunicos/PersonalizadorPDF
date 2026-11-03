#!/usr/bin/env node
/**
 * Contrato del puente del cotizador (spec 037, T002).
 *
 * Que prueba:
 *  - `--contexto`: el item del cotizador nace con `contexto = 'cotizador'`,
 *    `pdfs = []` y `preview_estado = 'omisible'`, y el filtro `pmu_cotizador_activo`
 *    lo apaga sin tocar disco (contrato C0/C1).
 *  - `--ideas`: customs, estrella, borrado sin huerfanos, adopcion del invitado y
 *    retencion de `orders/{cliente}/customs/` (contrato customs.md C1-C6).
 *  - `--paridad`: `PMU_Sesion::px_cotizador`/`receta_cotizador` (PHP) coinciden con
 *    la tabla de `fixtures/cotizador-paridad.json`, la MISMA que valida el
 *    consumidor con `sizeToPx`/`gidPara` (I1).
 *
 * Las dos primeras re-ejecutan la fase PHP `cotizador` (un solo arnes: los hechos
 * y las causas se verifican DONDE se producen) y comprueban que sus checks esten
 * en verde; la tercera corre un PHP minimo con el fixture.
 *
 * Uso: node tests/cotizador-contrato.test.js [--contexto|--ideas|--paridad]
 */
'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const RAIZ = path.resolve(__dirname, '..');
const FIXTURE = path.join(__dirname, 'fixtures', 'cotizador-paridad.json');

let checks = 0;
let fallos = 0;

function check(nombre, cond, detalle) {
    checks++;
    if (!cond) { fallos++; }
    console.log((cond ? '  OK   ' : '  FAIL ') + nombre
        + ((!cond && detalle) ? '  [' + detalle + ']' : ''));
}

function grupo(nombre) {
    console.log('\n== ' + nombre + ' ==');
}

/** Corre la fase PHP `cotizador` y devuelve los nombres de sus checks en verde. */
function fasePhp() {
    const salida = execFileSync('php', ['tests/texto_puente.php', 'cotizador'], {
        cwd: RAIZ,
        encoding: 'utf8',
    });
    const ok = new Set();
    salida.split(/\r?\n/).forEach(function (linea) {
        if (linea.indexOf('  OK   ') !== 0) { return; }
        let nombre = linea.slice(7).trim();
        const corte = nombre.indexOf('  [');
        if (corte > 0) { nombre = nombre.slice(0, corte).trim(); }
        ok.add(nombre);
    });
    return ok;
}

function contratoContexto(ok) {
    grupo('Contexto declarado (C0/C1)');
    check('manifest.contexto = cotizador', ok.has('manifest.contexto = cotizador'));
    check('manifest.pdfs = [] y preview_estado = omisible',
        ok.has('manifest.pdfs = [] (sin PDF)') && ok.has('preview_estado = omisible'));
    check('subidas[].origen NO inventa un valor del cotizador',
        ok.has('la subida queda como fila original'));
    check('pmu_cotizador_activo=false apaga la fachada sin tocar disco',
        ok.has('pmu_cotizador_activo=false apaga activo()')
        && ok.has('apagada, guardar no toca disco (cotizador:inactivo)'));
    check('assets() no arrastra tienda.js ni campo-montar.js',
        ok.has('assets() NUNCA encola tienda.js ni campo-montar.js'));
}
function contratoIdeas(ok) {
    grupo('Customs, estrella y borrado (C1-C6)');
    check('la idea escribe idea.json + mockup.webp en customs/',
        ok.has('existe customs/{idea}/idea.json')
        && ok.has('existe customs/{idea}/mockup.webp'));
    check('customs/ NO tiene manifest.json (invisible a los escaneos)',
        ok.has('customs/ NO tiene manifest.json'));
    check('re-guardar la misma idea reemplaza (no duplica)',
        ok.has('re-guardar no duplica la idea'));
    check('la estrella ordena primero y escribe favoritos.json',
        ok.has('el favorito va primero') && ok.has('estrella de la tienda escribe favoritos.json'));
    check('desmarcar devuelve el orden original', ok.has('desmarcar la quita de favoritos'));
    check('borrar elimina JSON + snapshot y respeta el original compartido',
        ok.has('borrar elimina JSON + snapshot')
        && ok.has('borrar no deja huerfanos ni toca el original'));
    check('una idea ajena no se toca (cotizador:idea:ajena)',
        ok.has('idea ajena -> cotizador:idea:ajena'));
    check('promocion: mueve item + originales y conserva el contexto',
        ok.has('promover mueve el item del cotizador')
        && ok.has('promover conserva manifest.contexto'));
    check('invitado: adopcion al cliente e idempotencia',
        ok.has('adopcion del invitado mueve sus ideas') && ok.has('re-adoptar es no-op'));
    check('retencion: los customs del cliente NO vencen; los del invitado, si',
        ok.has('retencion: orders/{cliente}/customs/ NO vence')
        && ok.has('retencion: la idea vencida del invitado se poda'));
}

/** Paridad PHP contra el fixture compartido con el consumidor (I1). */
function paridad() {
    grupo('Paridad PHP del lienzo y el gid (I1)');
    const fixture = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
    const casos = fixture.casos || [];
    check('el fixture trae casos', casos.length >= 6, String(casos.length));
    const harness = [
        '<?php',
        'if (!defined("ABSPATH")) { define("ABSPATH", __DIR__); }',
        'define("HOUR_IN_SECONDS", 3600);',
        'define("DAY_IN_SECONDS", 86400);',
        'require ' + JSON.stringify(path.join(RAIZ, 'inc', 'class-pmu-sesion.php').replace(/\\/g, '/')) + ';',
        '$datos = json_decode(file_get_contents($argv[1]), true);',
        '$casos = isset($datos["casos"]) ? $datos["casos"] : [];',
        '$out = [];',
        'foreach ($casos as $c) {',
        '    list($w, $h) = PMU_Sesion::px_cotizador($c["size"]);',
        '    $r = PMU_Sesion::receta_cotizador($c["categoria"], $c["size"], ["iw" => 1600, "ih" => 1200]);',
        '    $out[] = ["categoria" => $c["categoria"], "size" => $c["size"],',
        '        "w" => $w, "h" => $h, "gid" => $r["gid"]];',
        '}',
        'echo json_encode($out);',
        '',
    ].join('\n');
    const tmp = path.join(os.tmpdir(), 'pmu_cot_paridad_' + process.pid + '.php');
    fs.writeFileSync(tmp, harness, 'utf8');
    let medido = [];
    try {
        medido = JSON.parse(execFileSync('php', [tmp, FIXTURE], { cwd: RAIZ, encoding: 'utf8' }));
    } catch (e) {
        check('el harness PHP corre', false, String(e.message || e));
        return;
    } finally {
        try { fs.unlinkSync(tmp); } catch (e) { /* el temporal se va solo */ }
    }
    check('el harness devuelve un caso por tamano', medido.length === casos.length,
        medido.length + '/' + casos.length);
    casos.forEach(function (esperado, i) {
        const real = medido[i] || {};
        check('px ' + esperado.categoria + ' ' + esperado.size + ' -> '
            + esperado.w + 'x' + esperado.h,
            Number(real.w) === esperado.w && Number(real.h) === esperado.h,
            real.w + 'x' + real.h);
        check('gid ' + esperado.categoria + ' ' + esperado.size + ' -> ' + esperado.gid,
            String(real.gid) === esperado.gid, String(real.gid));
    });
}

function main() {
    const modo = process.argv[2] || '--todo';
    if (modo === '--paridad') {
        paridad();
    } else {
        let ok;
        try {
            ok = fasePhp();
        } catch (e) {
            check('la fase PHP `cotizador` corre', false, String(e.message || e));
            ok = new Set();
        }
        if (modo === '--ideas') {
            contratoIdeas(ok);
        } else if (modo === '--contexto') {
            contratoContexto(ok);
        } else {
            contratoContexto(ok);
            contratoIdeas(ok);
            paridad();
        }
    }
    console.log('\n' + (fallos
        ? 'COTIZADOR CONTRATO: ' + fallos + ' fallo(s)'
        : 'COTIZADOR CONTRATO OK (' + checks + ' checks)'));
    process.exit(fallos ? 1 : 0);
}

main();