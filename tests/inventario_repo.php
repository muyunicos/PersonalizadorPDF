<?php
/**
 * Inventario de CODIGO del repositorio: archivos, peso, dependencias y
 * candidatos a codigo muerto.
 *
 * Complementa (NO duplica) al mapa manual de AGENTS.md seccion 2 y es el
 * hermano de tests/inventario_pmu.php (que inventaria DATOS de usuario).
 *
 * Salida: docs/inventario-repo.md (GENERADA; no editar a mano).
 *
 * Uso:
 *   php tests/inventario_repo.php             -> genera el .md + resumen
 *   php tests/inventario_repo.php --consola   -> solo resumen en consola
 *
 * Que mira:
 *   - peso (KB), LOC, funciones/clases por archivo de codigo
 *   - require/include cruzados (indice inverso: quien incluye a quien)
 *   - archivos PHP/JS/CSS/HTML nunca referenciados (con sus entry points)
 *   - funciones PHP declaradas y nunca referenciadas (se buscan en codigo SIN
 *     comentarios; un hook WP por string, add_action('x','fn'), SI cuenta
 *     como uso porque el string viaja en el codigo)
 *
 * Limitaciones (revisar a mano antes de borrar):
 *   - un mismo nombre repetido en dos clases enmascara el conteo
 *   - callables dinamicos (variables, concatenados) no se ven
 *   - solo el dominio manda: comentarios, specs y docs NO cuentan como uso
 *   - metodos magicos (__construct, __invoke, ...) se excluyen del listado
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Solo CLI.\n");
    exit(2);
}
error_reporting(E_ALL);

$raiz = str_replace('\\', '/', dirname(__DIR__));
$consola = in_array('--consola', $argv, true);
$salidaMd = $raiz . '/docs/inventario-repo.md';

/** Directorios que nunca forman parte del inventario de codigo. */
$excluirDirs = ['.git', '.specify', '.clinerules', 'node_modules', 'vendor', 'uploads', 'marcos', '.vscode'];

/**
 * Lista los archivos del repo (rutas relativas con /) excluyendo dirs.
 *
 * @return array<string,int> rel => bytes
 */
function listar_archivos($raiz, $excluirDirs)
{
    $out = [];
    $prefijo = rtrim($raiz, '/') . '/';
    $iter = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($raiz, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::LEAVES_ONLY
    );
    foreach ($iter as $f) {
        if (!$f->isFile()) {
            continue;
        }
        $rel = str_replace('\\', '/', substr($f->getPathname(), strlen($prefijo)));
        if ($rel === 'composer.phar') {
            continue; // herramienta de desarrollo, no codigo del proyecto
        }
        $salta = false;
        foreach (explode('/', $rel) as $p) {
            if (in_array($p, $excluirDirs, true)) {
                $salta = true;
                break;
            }
        }
        if ($salta) {
            continue;
        }
        $out[$rel] = $f->getSize();
    }
    ksort($out);
    return $out;
}

/**
 * Clasifica un archivo para las tablas del reporte.
 */
function clasificar($rel, $esMin)
{
    if ($esMin) {
        return 'vendor (.min)';
    }
    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    $pre = explode('/', $rel)[0];
    switch ($ext) {
        case 'php':
            if ($rel === 'personalizador-pdf.php') {
                return 'PHP entry (plugin WP)';
            }
            if ($pre === 'tests') {
                return 'PHP test CLI';
            }
            if ($pre === 'engine') {
                return 'PHP motor';
            }
            if ($pre === 'inc') {
                return 'PHP inc';
            }
            if ($pre === 'admin') {
                return 'PHP admin';
            }
            if (strpos($rel, 'modules/') === 0) {
                return 'PHP modulo';
            }
            return 'PHP otro';
        case 'js':
            if (strpos($rel, 'modules/textmuy/tests/') === 0) {
                return 'JS test modulo';
            }
            if (strpos($rel, 'modules/textmuy/js/utils/') === 0) {
                return 'JS vendor modulo';
            }
            if (strpos($rel, 'modules/textmuy/') === 0) {
                return 'JS modulo textmuy';
            }
            if ($pre === 'tests') {
                return 'JS test';
            }
            if ($pre === 'assets') {
                return 'JS assets';
            }
            return 'JS otro';
        case 'css':
            return 'CSS';
        case 'html':
            return 'HTML';
        case 'md':
        case 'txt':
            return 'doc';
        case 'json':
        case 'neon':
        case 'lock':
            return 'config';
        default:
            return 'otro';
    }
}

/**
 * Quita comentarios preservando saltos de linea (los numeros de linea del
 * reporte siguen cuadrando). html: comentarios <!-- -->.
 */
function quitar_comentarios($t, $ext)
{
    if ($ext === 'html') {
        return preg_replace('/<!--.*?-->/s', '', $t);
    }
    $t = preg_replace_callback('/\/\*.*?\*\//s', function ($m) {
        return str_repeat("\n", substr_count($m[0], "\n"));
    }, $t);
    if ($ext === 'php') {
        // En PHP si cortamos // en cualquier punto: las URLs viajan dentro de
        // strings y un hash de hook rara vez lleva //.
        $t = preg_replace('/\/\/[^\r\n]*/', '', $t);
        $t = preg_replace('/^[ \t]*#[^\r\n]*\r?$/m', '', $t);
    } elseif ($ext === 'js') {
        // En JS solo linea completa: un // minificado a media linea se
        // tragaria el resto del archivo de una sola linea.
        $t = preg_replace('/^[ \t]*\/\/[^\r\n]*\r?$/m', '', $t);
    }
    return $t;
}

// ---------------------------------------------------------------------------
// 1) RECOLECCION
// ---------------------------------------------------------------------------

$archivos = listar_archivos($raiz, $excluirDirs);
unset($archivos['docs/inventario-repo.md']); // nuestra propia salida

$tipo = [];
foreach ($archivos as $rel => $bytes) {
    $esMin = (bool) preg_match('/\.min\.js$/', $rel);
    $tipo[$rel] = clasificar($rel, $esMin);
}

// Textos de codigo con comentarios fuera (php/js/html/css).
$texto = [];
foreach ($archivos as $rel => $bytes) {
    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    if (!in_array($ext, ['php', 'js', 'html', 'css'], true)) {
        continue;
    }
    $crudo = @file_get_contents($raiz . '/' . $rel);
    if ($crudo === false) {
        continue;
    }
    $texto[$rel] = quitar_comentarios($crudo, $ext);
}

/** Fragmentos .php que una sentencia require/include intenta cargar. */
function deps_de($textoLimpio)
{
    $frags = [];
    if (preg_match_all('/(?:require_once|require|include_once|include)\b[^;]*;/', $textoLimpio, $m)) {
        foreach ($m[0] as $sent) {
            if (preg_match_all('/[\'"]([^\'"]+\.php)[\'"]/i', $sent, $q)) {
                $ultima = $q[1][count($q[1]) - 1];
                $frags[] = ltrim(str_replace('\\', '/', $ultima), '/');
            }
        }
    }
    return array_values(array_unique($frags));
}

/** Resuelve un fragmento contra los PHP del repo por sufijo de ruta. */
function resolver_dep($frag, $phpFiles)
{
    // Normaliza rutas relativas tipo __DIR__ . '/../engine/Pdf.php'.
    $frag = preg_replace('#^(\.\./|\./)+#', '', $frag);
    $candidatos = [];
    foreach ($phpFiles as $rel) {
        $n = strlen($rel);
        if ($n >= strlen($frag) && strtolower(substr($rel, $n - strlen($frag))) === strtolower($frag)) {
            $candidatos[] = $rel;
        }
    }
    if (!$candidatos) {
        return null;
    }
    // Si hay varios, el mas corto (la ruta especifica) gana.
    usort($candidatos, function ($a, $b) {
        return strlen($a) <=> strlen($b);
    });
    return $candidatos[0];
}

$phpFiles = [];
foreach (array_keys($archivos) as $rel) {
    if (strtolower(pathinfo($rel, PATHINFO_EXTENSION)) === 'php') {
        $phpFiles[] = $rel;
    }
}

$incluye = [];      // origen => [destino, ...]
$incluidoPor = [];  // destino => [origen, ...]
$depsSinResolver = []; // origen => [fragmento, ...]
foreach ($phpFiles as $rel) {
    if (!isset($texto[$rel])) {
        continue;
    }
    foreach (deps_de($texto[$rel]) as $frag) {
        $dest = resolver_dep($frag, $phpFiles);
        if ($dest === null) {
            $depsSinResolver[$rel][] = $frag;
            continue;
        }
        if ($dest === $rel) {
            continue;
        }
        $incluye[$rel][] = $dest;
        $incluidoPor[$dest][] = $rel;
    }
}

// Referencias por nombre base: cuantos OTROS textos mencionan el archivo
// (rutas como 'assets/admin.js' en el enqueue, <script src="js/editor.js">...).
$refs = [];
$relsTexto = array_keys($texto);
foreach ($archivos as $rel => $bytes) {
    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    if (!in_array($ext, ['php', 'js', 'css', 'html'], true)) {
        $refs[$rel] = null;
        continue;
    }
    $base = basename($rel);
    $n = 0;
    foreach ($relsTexto as $otro) {
        if ($otro === $rel) {
            continue;
        }
        if (strpos($texto[$otro], $base) !== false) {
            $n++;
        }
    }
    $refs[$rel] = $n;
}

// Funciones PHP: definiciones (con linea) + conteo global de identificadores
// en codigo sin comentarios (los strings de hooks WP cuentan como uso).
$defs = [];
$funcsPorArchivo = [];
$totalIdents = [];
foreach ($phpFiles as $rel) {
    if (!isset($texto[$rel])) {
        continue;
    }
    $t = $texto[$rel];
    if (preg_match_all('/function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/', $t, $m, PREG_OFFSET_CAPTURE)) {
        foreach ($m[1] as $par) {
            $nom = $par[0];
            $linea = substr_count(substr($t, 0, $par[1]), "\n") + 1;
            $defs[$nom][] = ['f' => $rel, 'l' => $linea];
            $funcsPorArchivo[$rel] = isset($funcsPorArchivo[$rel]) ? $funcsPorArchivo[$rel] + 1 : 1;
        }
    }
    if (preg_match_all('/[A-Za-z_][A-Za-z0-9_]*/', $t, $ids)) {
        foreach ($ids[0] as $id) {
            $totalIdents[$id] = isset($totalIdents[$id]) ? $totalIdents[$id] + 1 : 1;
        }
    }
}
$huerfanas = [];
foreach ($defs as $nom => $lista) {
    if (strpos($nom, '__') === 0) {
        continue; // magicos: __construct se usa via new, no por nombre
    }
    $usos = isset($totalIdents[$nom]) ? $totalIdents[$nom] : 0;
    if ($usos <= count($lista)) {
        $huerfanas[$nom] = $lista;
    }
}
ksort($huerfanas);

/** Entry points conocidos (no son "sin usar"). */
function es_entry($rel)
{
    if ($rel === 'personalizador-pdf.php') {
        return 'ENTRADA plugin WP';
    }
    if (strpos($rel, 'tests/') === 0 || strpos($rel, 'modules/textmuy/tests/') === 0) {
        return 'ENTRADA CLI test';
    }
    if ($rel === 'modules/textmuy/index.html') {
        return 'ENTRADA editor iframe';
    }
    return null;
}

function kb_form($bytes)
{
    return number_format($bytes / 1024, 1, ',', '.');
}

// ---------------------------------------------------------------------------
// 2) AGREGADOS
// ---------------------------------------------------------------------------

$agg = []; // tipo => [n, bytes]
foreach ($archivos as $rel => $bytes) {
    $t = $tipo[$rel];
    if (!isset($agg[$t])) {
        $agg[$t] = ['n' => 0, 'b' => 0];
    }
    $agg[$t]['n']++;
    $agg[$t]['b'] += $bytes;
}

/** LOC = lineas no vacias del texto sin comentarios. */
function loc_de($texto, $rel)
{
    if (!isset($texto[$rel])) {
        return 0;
    }
    $n = 0;
    foreach (explode("\n", $texto[$rel]) as $ln) {
        if (trim($ln) !== '') {
            $n++;
        }
    }
    return $n;
}

$codigos = [];
$docs = [];
$configs = [];
$otros = [];
foreach ($archivos as $rel => $bytes) {
    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    if (in_array($ext, ['php', 'js', 'css', 'html'], true)) {
        $codigos[] = $rel;
    } elseif ($tipo[$rel] === 'doc') {
        $docs[] = $rel;
    } elseif ($tipo[$rel] === 'config') {
        $configs[] = $rel;
    } else {
        $otros[] = $rel;
    }
}

$bytesCodigo = 0;
foreach ($codigos as $rel) {
    $bytesCodigo += $archivos[$rel];
}
$bytesTotal = array_sum($archivos);

// Candidatos a "sin referencia"
$sinReferencia = [];
foreach ($codigos as $rel) {
    $entry = es_entry($rel);
    if ($entry !== null) {
        continue;
    }
    $nRefs = isset($refs[$rel]) ? $refs[$rel] : 0;
    if ($nRefs === 0 && empty($incluidoPor[$rel])) {
        $sinReferencia[] = $rel;
    }
}

// Top 15 mas pesados (codigo)
$ordenados = $codigos;
usort($ordenados, function ($a, $b) use ($archivos) {
    return $archivos[$b] <=> $archivos[$a];
});
$top = array_slice($ordenados, 0, 15);

// ---------------------------------------------------------------------------
// 3) REPORTE MARKDOWN
// ---------------------------------------------------------------------------

$md = [];
$md[] = '# Inventario de codigo del repositorio';
$md[] = '';
$md[] = '> **GENERADO automaticamente** por `php tests/inventario_repo.php` — NO editar a mano.';
$md[] = '> La semantica (responsabilidad de cada archivo) vive en `AGENTS.md` seccion 2 y en';
$md[] = '> `modules/LEEME.md`; este reporte aporta los NUMEROS: peso, LOC, dependencias';
$md[] = '> cruzadas y candidatos a codigo muerto. Generado: ' . date('Y-m-d H:i') . '.';
$md[] = '';
$md[] = '## 1. Resumen por tipo';
$md[] = '';
$md[] = '| Tipo | Archivos | KB |';
$md[] = '|---|---:|---:|';
ksort($agg);
foreach ($agg as $t => $d) {
    $md[] = '| ' . $t . ' | ' . $d['n'] . ' | ' . kb_form($d['b']) . ' |';
}
$md[] = '| **TOTAL** | **' . count($archivos) . '** | **' . kb_form($bytesTotal) . '** |';
$md[] = '';
$md[] = 'Codigo fuente (php/js/css/html): **' . count($codigos) . ' archivos, '
    . kb_form($bytesCodigo) . ' KB**. Docs (md/txt): ' . count($docs)
    . '. Config: ' . count($configs) . '.';
$md[] = '';
$md[] = '## 2. Archivos de codigo mas pesados (top 15)';
$md[] = '';
$md[] = '| # | KB | Ruta | Tipo |';
$md[] = '|---|---:|---|---|';
$nr = 0;
foreach ($top as $rel) {
    $nr++;
    $md[] = '| ' . $nr . ' | ' . kb_form($archivos[$rel]) . ' | `' . $rel . '` | ' . $tipo[$rel] . ' |';
}
$md[] = '';
$md[] = '## 3. Codigo fuente: archivo -> que requiere / quien lo requiere';
$md[] = '';
$md[] = 'Columnas: **Incluye** = `require`/`include` que emite (PHP). **Incl. por** = quien';
$md[] = 'lo carga. **Refs** = cuantos otros archivos mencionan su nombre base (rutas de';
$md[] = 'enqueue, `<script src>`, etc.).';
$md[] = '';
$md[] = '| Ruta | Tipo | KB | LOC | Funcs | Incluye | Incl. por | Refs | Estado |';
$md[] = '|---|---|---:|---:|---:|---|---|---:|---|';
foreach ($codigos as $rel) {
    $entry = es_entry($rel);
    $nRefs = isset($refs[$rel]) ? $refs[$rel] : 0;
    if ($entry !== null) {
        $estado = $entry;
    } elseif ($nRefs > 0 || !empty($incluidoPor[$rel])) {
        $estado = 'OK';
    } elseif (strpos($tipo[$rel], 'vendor') === 0) {
        $estado = '?? VENDOR SIN USAR';
    } else {
        $estado = '?? SIN REFERENCIA';
    }
    $inc = !empty($incluye[$rel]) ? '<br>' . implode('<br>', $incluye[$rel]) : '-';
    $por = !empty($incluidoPor[$rel]) ? '<br>' . implode('<br>', $incluidoPor[$rel]) : '-';
    $fn = isset($funcsPorArchivo[$rel]) ? (string) $funcsPorArchivo[$rel] : '-';
    $md[] = '| `' . $rel . '` | ' . $tipo[$rel] . ' | ' . kb_form($archivos[$rel])
        . ' | ' . loc_de($texto, $rel) . ' | ' . $fn . ' | ' . $inc . ' | ' . $por
        . ' | ' . $nRefs . ' | ' . $estado . ' |';
}
$md[] = '';

// --- 4) Sin referencia ---
$md[] = '## 4. Archivos de codigo SIN referencia (candidatos a revisar/borrar)';
$md[] = '';
if (!$sinReferencia) {
    $md[] = '_Ninguno: todo el codigo de alguna forma se referencia._';
} else {
    $md[] = '| Ruta | Tipo | KB |';
    $md[] = '|---|---|---:|';
    foreach ($sinReferencia as $rel) {
        $md[] = '| `' . $rel . '` | ' . $tipo[$rel] . ' | ' . kb_form($archivos[$rel]) . ' |';
    }
}
$md[] = '';

// --- 5) Funciones sin referencia ---
$md[] = '## 5. Funciones PHP declaradas y nunca referenciadas';
$md[] = '';
$md[] = 'Buscadas en todo el codigo PHP sin comentarios (los hooks WP por string cuentan';
$md[] = 'como uso). **Revisar a mano**: mismo nombre repetido en dos clases enmascara el';
$md[] = 'conteo y los magicos (`__*`) estan excluidos.';
$md[] = '';
if (!$huerfanas) {
    $md[] = '_Ninguna: todas las funciones tienen al menos una referencia externa._';
} else {
    $md[] = '| Funcion | Definida en | Linea | Defs |';
    $md[] = '|---|---|---:|---:|';
    foreach ($huerfanas as $nom => $lista) {
        $primero = $lista[0];
        $md[] = '| `' . $nom . '()` | `' . $primero['f'] . '` | ' . $primero['l']
            . ' | ' . count($lista) . ' |';
    }
}
$md[] = '';

// --- 6) Includes sin resolver ---
$md[] = '## 6. require/include cuyo destino no se pudo resolver';
$md[] = '';
$md[] = 'Fragmentos `.php` en sentencias de carga que no casaron con ningun archivo del';
$md[] = 'repo (variables, rutas dinamicas o archivos ausentes):';
$md[] = '';
if (!$depsSinResolver) {
    $md[] = '_Ninguno._';
} else {
    foreach ($depsSinResolver as $origen => $frags) {
        $md[] = '- `' . $origen . '`: ' . implode(', ', array_map(function ($f) {
            return '`' . $f . '`';
        }, $frags));
    }
}
$md[] = '';

// --- 7) Documentacion y configuracion ---
$md[] = '## 7. Documentacion y configuracion (fuera de la tabla de codigo)';
$md[] = '';
$md[] = '- Docs (md/txt): **' . count($docs) . '** archivos, '
    . kb_form(array_sum(array_map(function ($r) use ($archivos) {
        return $archivos[$r];
    }, $docs))) . ' KB.';
$md[] = '- Config: **' . count($configs) . '** archivos (json/neon/lock).';
if ($otros) {
    $md[] = '- Otros (' . count($otros) . '): ' . implode(', ', $otros);
}
$md[] = '';
$md[] = '## 8. Limitaciones y como regenerar';
$md[] = '';
$md[] = '- Regenerar: `php tests/inventario_repo.php` (o `--consola` para no escribir).';
$md[] = '- Excluidos por diseño: `uploads/` (datos de usuario), `.specify/`, `.clinerules/`,';
$md[] = '  `node_modules/`, `vendor/`, `.git/`, `.vscode/`.';
$md[] = '- Los comentarios, specs y docs NO cuentan como uso de una funcion o archivo:';
$md[] = '  eso es deliberado (queremos uso real, no menciones).';
$md[] = '- Antes de borrar cualquier candidato: verificar en el sitio real (smoke test).';

$mdTexto = implode("\n", $md) . "\n";
if (!$consola) {
    if (!is_dir($raiz . '/docs')) {
        mkdir($raiz . '/docs', 0775, true);
    }
    file_put_contents($salidaMd, $mdTexto);
}

// ---------------------------------------------------------------------------
// 4) RESUMEN EN CONSOLA
// ---------------------------------------------------------------------------

echo "INVENTARIO REPO OK\n";
echo 'Archivos: ' . count($archivos)
    . ' (codigo ' . count($codigos) . ', docs ' . count($docs)
    . ', config ' . count($configs) . ', otros ' . count($otros) . ")\n";
echo 'Peso: total ' . kb_form($bytesTotal) . ' KB | codigo ' . kb_form($bytesCodigo) . " KB\n";
echo 'Archivos PHP: ' . count($phpFiles)
    . ' | funciones definidas: ' . count($defs) . "\n";
echo 'Archivos SIN referencia: ' . count($sinReferencia);
if ($sinReferencia) {
    echo ' -> ' . implode(', ', $sinReferencia);
}
echo "\n";
echo 'Funciones SIN referencia: ' . count($huerfanas);
if ($huerfanas) {
    $nombres = array_keys($huerfanas);
    if (count($nombres) > 12) {
        $nombres = implode(', ', array_slice($nombres, 0, 12)) . '...'; // ver informe completo
    } else {
        $nombres = implode(', ', $nombres);
    }
    echo ' -> ' . $nombres;
}
echo "\n";
echo 'Includes sin resolver: ' . count($depsSinResolver) . "\n";
if (!$consola) {
    echo 'Generado: docs/inventario-repo.md (' . kb_form(strlen($mdTexto)) . " KB)\n";
} else {
    echo "Modo --consola: no se escribio el .md\n";
}



