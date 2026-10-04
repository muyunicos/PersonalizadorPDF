<?php
// Arnes CLI: nunca ejecutable por HTTP (tests/ viaja con el plugin al hosting).
if (PHP_SAPI !== 'cli') {
    exit;
}
/**
 * Certificacion de la hoja de miniaturas en los ambitos catalogados
 * (spec 009, T006/T007). Reproduce el contrato `op=sprite`
 * (contracts/motor-sprite.md) contra el motor real, con stubs minimos de
 * WordPress y un arbol aislado en %TEMP%. Verifica:
 *   A. firma valida + dims exactas => escribe thumbs.sprite_firma (certifica).
 *   B. firma rancia                 => motor:sprite:catalogo:desactualizado.
 *   C. dimensiones invalidas        => motor:sprite:dimensiones:invalidas.
 *   D. escritura del catalogo       => invalida la certificacion (T005).
 *   E. mockups (sin firma)          => persiste la hoja y NO toca el catalogo.
 *
 * Uso: php tests/certificacion_hoja.php
 *
 * Genera el thumbs.webp de prueba con GD cuando esta disponible; sin GD
 * construye un WebP-lossless minimo con las dimensiones exigidas (el motor
 * solo valida getimagesize() = ancho/alto + la firma binaria RIFF/WEBP).
 */

$plugin = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'personalizador-pdf.php';

$testBase = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_cert_' . getmypid();
$limpiar = function ($dir) {
    if (!is_dir($dir)) {
        return;
    }
    foreach (new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    ) as $x) {
        $x->isDir() ? @rmdir($x->getPathname()) : @unlink($x->getPathname());
    }
    @rmdir($dir);
};
$limpiar($testBase);
@mkdir($testBase . '/uploads', 0777, true);

$fallos = 0;
function check($nombre, $cond, $detalle = '')
{
    global $fallos;
    echo ($cond ? '  OK   ' : '  FAIL') . ' ' . $nombre . ($detalle !== '' ? '  [' . $detalle . ']' : '') . "\n";
    if (!$cond) {
        $fallos++;
    }
}

define('ABSPATH', __DIR__ . '/');
define('HOUR_IN_SECONDS', 3600);
define('DAY_IN_SECONDS', 86400);
function wp_upload_dir() { global $testBase; return ['basedir' => $testBase . '/uploads', 'baseurl' => 'http://test/uploads']; }
function wp_json_encode($d = null, $f = 0) { return json_encode($d, $f); }
function wp_is_writable($d) { return is_writable($d); }
function wp_mkdir_p($d) { return @mkdir($d, 0777, true); }
function trailingslashit($s) { return rtrim($s, '/\\') . '/'; }
function sanitize_key($k) { return strtolower(preg_replace('/[^a-z0-9_\-]/', '', (string)$k)); }
function wp_kses($t, $allowed = []) { return $t; }

// Las clases del motor se cargan DESPUES de los stubs de WP (el constructor de
// PMU_Galeria no usa WP, pero las clases comprueban ABSPATH al incluirse).
require dirname(__DIR__) . '/inc/class-pmu-galeria.php';
require dirname(__DIR__) . '/inc/class-pmu-uploads.php';
/**
 * thumbs.webp valido de $w x $h en disco. Con GD usa la ruta nativa; sin GD
 * arma un WebP-lossless minimo (el motor valida solo getimagesize() y la firma
 * binaria RIFF/WEBP). El hosting declarado tiene GD con WebP: ahi va la
 * rama nativa y el camino a mano es solo el respaldo de desarrollo local.
 */
function hacer_webp($w, $h)
{
    $ruta = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_spr_' . getmypid() . '_' . $w . 'x' . $h . '.webp';
    $w = max(1, (int)$w);
    $h = max(1, (int)$h);
    if (function_exists('imagecreatetruecolor') && function_exists('imagewebp')) {
        $im = imagecreatetruecolor($w, $h);
        imagefilledrectangle($im, 0, 0, $w, $h, imagecolorallocate($im, 240, 240, 240));
        imagewebp($im, $ruta);
        imagedestroy($im);
        return $ruta;
    }
    // VP8L: cabecera de 5 bytes con el bit de firma + ancho/alto de 14 bits.
    // Todo con chr() enmascarado a 0..255 (chr() fuera de rango esta deprecado
    // en PHP 8.5 y el arnes trata los avisos como fallos).
    $dw = $w - 1;
    $dh = $h - 1;
    $b0 = 0x2f;
    $b1 = $dw & 0xff;
    $b2 = ((($dw >> 8) & 0x3f) | (($dh & 0x3f) << 6)) & 0xff;
    $b3 = ($dh >> 2) & 0xff;
    $cab = chr($b0) . chr($b1) . chr($b2) . chr($b3);
    $pixeles = str_repeat("\x00\x00\x00\x00", $w * $h); // ARGB opaco
    $cuerpo = 'VP8L' . pack('V', strlen($cab) + strlen($pixeles)) . $cab . $pixeles;
    file_put_contents($ruta, 'RIFF' . pack('V', 4 + strlen($cuerpo)) . 'WEBP' . $cuerpo);
    return $ruta;
}

// $_FILES simulado: en CLI no viene de HTTP, el motor cae al rename/copy.
function subir($ruta)
{
    return [
        'name' => 'thumbs.webp',
        'type' => 'image/webp',
        'tmp_name' => $ruta,
        'error' => UPLOAD_ERR_OK,
        'size' => (int)@filesize($ruta),
    ];
}

// Misma forma que catalog.js::firmaCatalogo: [w, h, c, items].
function firma_de($motor, $ambito)
{
    $cat = $motor->catalogo($ambito, 'test')['cat'];
    return (string)json_encode([
        (int)$cat['thumbs']['w'],
        (int)$cat['thumbs']['h'],
        (int)$cat['thumbs']['c'],
        $cat['items'],
    ], JSON_UNESCAPED_UNICODE);
}

// Dimensiones de la hoja que el motor espera: c x w, ceil(maxId/c) x h.
function dims_hoja($motor, $ambito)
{
    $cat = $motor->catalogo($ambito, 'test')['cat'];
    $w = (int)$cat['thumbs']['w'];
    $h = (int)$cat['thumbs']['h'];
    $c = max(1, (int)$cat['thumbs']['c']);
    $max = 0;
    foreach ($cat['items'] as $t) {
        $max = max($max, (int)$t[0]);
    }
    return [$c * $w, (int)ceil(max(1, $max) / $c) * $h];
}

function error_de(callable $fn)
{
    try {
        $fn();
        return '';
    } catch (\Throwable $e) {
        return $e->getMessage();
    }
}

// PNG 1x1 valido: solo sirve para dar de alta un item real en `mockups`, de
// modo que el catalogo tenga items y la hoja tenga un alto que validar.
function escribir_png()
{
    static $ruta = null;
    if ($ruta === null) {
        $ruta = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'pd_mock_' . getmypid() . '.png';
        file_put_contents($ruta, base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        ));
    }
    return $ruta;
}

// ---------------------------------------------------------------------------
// A) fonts: firma valida + dims exactas => CERTIFICA (era el bug de origen:
//    antes el motor persistia la hoja sin escribir sprite_firma y la lectura
//    canonica del cliente la rechazaba siempre).
// ---------------------------------------------------------------------------
$motor = new PMU_Uploads();
[$wF, $hF] = dims_hoja($motor, 'fonts');
$firmaF = firma_de($motor, 'fonts');
$resA = error_de(function () use ($motor, $wF, $hF, $firmaF) {
    $motor->sprite('fonts', subir(hacer_webp($wF, $hF)), $firmaF);
});
check('A fonts: firma + dims validas => sin error', $resA === '', $resA);
$catA = $motor->catalogo('fonts', 'test')['cat'];
check('A fonts: thumbs.sprite_firma escrita y coincidente',
    isset($catA['thumbs']['sprite_firma']) && $catA['thumbs']['sprite_firma'] === $firmaF);
check('A fonts: thumbs.webp persistido',
    is_file($testBase . '/uploads/pmu/fonts/thumbs.webp'));

// ---------------------------------------------------------------------------
// B) firma rancia => desactualizado (no certifica ni pisa la hoja buena)
// ---------------------------------------------------------------------------
$resB = error_de(function () use ($motor, $wF, $hF) {
    $motor->sprite('fonts', subir(hacer_webp($wF, $hF)), '[[999,999,999,[]]]');
});
check('B fonts: firma rancia => motor:sprite:catalogo:desactualizado',
    $resB === 'motor:sprite:catalogo:desactualizado', $resB);
$catB = $motor->catalogo('fonts', 'test')['cat'];
check('B fonts: la certificacion previa no se toco',
    isset($catB['thumbs']['sprite_firma']) && $catB['thumbs']['sprite_firma'] === $firmaF);

// ---------------------------------------------------------------------------
// C) dimensiones fuera de la reticula => dimensiones:invalidas
// ---------------------------------------------------------------------------
$resC = error_de(function () use ($motor, $wF, $hF, $firmaF) {
    $motor->sprite('fonts', subir(hacer_webp($wF + 180, $hF)), $firmaF);
});
check('C fonts: dims invalidas => motor:sprite:dimensiones:invalidas',
    $resC === 'motor:sprite:dimensiones:invalidas', $resC);

// ---------------------------------------------------------------------------
// D) T005: escribir el catalogo (alta/baja/editar) INVALIDA la certificacion,
//    para que la proxima apertura regenere la hoja en vez de leer thumbs viejos.
// ---------------------------------------------------------------------------
$rutaCatF = $testBase . '/uploads/pmu/fonts/fonts.json';
$catLeida = json_decode((string)@file_get_contents($rutaCatF), true);
check('D fonts: antes de escribir esta certificada',
    isset($catLeida['thumbs']['sprite_firma']));
$motor->guardar_catalogo('fonts', $catLeida);
$catD = json_decode((string)@file_get_contents($rutaCatF), true);
check('D fonts: guardar_catalogo deja el catalogo SIN certificar',
    !isset($catD['thumbs']['sprite_firma']));
check('D fonts: thumbs del catalogo intactos',
    isset($catD['thumbs']['w']) && (int)$catD['thumbs']['w'] > 0);
// ---------------------------------------------------------------------------
// E) tm-presets: el segundo ambito que nunca certifico. Mismo contrato que
//    fonts, con la reticula 200x100x4 del catalogo.
// ---------------------------------------------------------------------------
[$wP, $hP] = dims_hoja($motor, 'tm-presets');
$firmaP = firma_de($motor, 'tm-presets');
$resE = error_de(function () use ($motor, $wP, $hP, $firmaP) {
    $motor->sprite('tm-presets', subir(hacer_webp($wP, $hP)), $firmaP);
});
check('E tm-presets: firma + dims validas => sin error', $resE === '', $resE);
$catP = json_decode((string)@file_get_contents($testBase . '/uploads/pmu/tm-presets/presets.json'), true);
check('E tm-presets: thumbs.sprite_firma escrita',
    isset($catP['thumbs']['sprite_firma']) && $catP['thumbs']['sprite_firma'] === $firmaP);
check('E tm-presets: hoja 200x100 segun la reticula', $wP % 200 === 0 && $hP % 100 === 0,
    "hoja={$wP}x{$hP}");

// ---------------------------------------------------------------------------
// F) mockups: NO manda firma (assets/mockups.js no usa la ruta canonica), asi
//    que debe persistir la hoja SIN tocar el catalogo. Si se generalizara la
//    certificacion a AMBITOS_GALERIA sin esta condicion, el motor crearia el
//    catalogo de mockups y rechazaria con `desactualizado` (T004, ambiguedad
//    corregida: la condicion es "tiene catalogo Y firma no vacia").
// ---------------------------------------------------------------------------
$motor->alta('mockups', 'Mock de prueba', 'varios', [
    'name' => 'mock.png', 'type' => 'image/png',
    'tmp_name' => escribir_png(),
    'error' => UPLOAD_ERR_OK,
    'size' => (int)@filesize(escribir_png()),
], '');
$antesMock = (string)@file_get_contents($testBase . '/uploads/pmu/mockups/mockups.json');
[$wMk, $hMk] = dims_hoja($motor, 'mockups');
$resF = error_de(function () use ($motor, $wMk, $hMk) {
    $motor->sprite('mockups', subir(hacer_webp($wMk, $hMk)), '');
});
check('F mockups: sin firma persiste la hoja sin error', $resF === '', $resF);
check('F mockups: thumbs.webp persistido',
    is_file($testBase . '/uploads/pmu/mockups/thumbs.webp'));
$despuesMock = (string)@file_get_contents($testBase . '/uploads/pmu/mockups/mockups.json');
check('F mockups: el catalogo NO gana sprite_firma',
    strpos($despuesMock, 'sprite_firma') === false);
check('F mockups: el catalogo conserva sus items',
    ($antesMock === '' || strpos($despuesMock, 'Mock de prueba') !== false));

// ---------------------------------------------------------------------------
// G) img: el ambito que ya certificaba; no debe regressar.
// ---------------------------------------------------------------------------
[$wI, $hI] = dims_hoja($motor, 'img');
$firmaI = firma_de($motor, 'img');
$resG = error_de(function () use ($motor, $wI, $hI, $firmaI) {
    $motor->sprite('img', subir(hacer_webp($wI, $hI)), $firmaI);
});
check('G img: sigue certificando sin error', $resG === '', $resG);
$catI = $motor->catalogo('img', 'test')['cat'];
check('G img: thumbs.sprite_firma escrita',
    isset($catI['thumbs']['sprite_firma']) && $catI['thumbs']['sprite_firma'] === $firmaI);

$limpiar($testBase);
echo "\n";
if ($fallos) {
    echo "CERTIFICACION HOJA: $fallos fallo(s)\n";
    exit(1);
}
echo "CERTIFICACION HOJA OK\n";