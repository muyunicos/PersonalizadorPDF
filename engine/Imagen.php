<?php
/**
 * Imagen - Normaliza imagenes reales a datos crudos (RGB + canal alfa) listos
 * para incrustarse como XObject de imagen en el PDF, equivalentes a los marcos
 * transparentes de PngWriter pero con contenido real.
 *
 * Regla de ENCAJADO (contain): la imagen se escala con
 *     escala = min(W / iw, H / ih)
 * y se centra en el lienzo W x H del grupo, sin deformarla ni recortarla.
 * Los margenes que quedan libres son transparentes.
 *
 * Estrategias:
 *  1. GD (si esta disponible): lee JPEG/PNG/GIF/WebP y remuestrea.
 *  2. PHP puro: decodificador PNG propio (8 bits, sin entrelazar: gris, RGB,
 *     paleta, gris+alfa, RGBA) con reescalado por vecino mas cercano.
 *  3. JPEG sin GD: solo si sus dimensiones coinciden exactamente con las del
 *     grupo, se incrusta directo (DCTDecode) sin decodificar pixeles.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Imagen
{
    /** Para pruebas: fuerza el camino PHP puro aunque GD este disponible. */
    public static $sinGD = false;

    /** GD disponible? */
    public static function gd()
    {
        return !self::$sinGD && extension_loaded('gd') && function_exists('imagecreatefromstring');
    }

    /**
     * Normaliza una imagen real al lienzo $anchoPx x $altoPx con encajado.
     *
     * Devuelve una especificacion lista para Overlay::build():
     *   - raster: ['tipo'=>'raster', 'w'=>W, 'h'=>H, 'rgb'=>bytes, 'alpha'=>bytes]
     *     (rgb = W*H*3 bytes; alpha = W*H bytes, 0=transparente, 255=opaco)
     *   - dct:    ['tipo'=>'dct', 'w'=>w, 'h'=>h, 'jpeg'=>bytes]  (JPEG directo)
     */
    public static function normalizar($ruta, $anchoPx, $altoPx)
    {
        $anchoPx = max(1, (int)$anchoPx);
        $altoPx = max(1, (int)$altoPx);
        if (!is_file($ruta)) {
            throw new \RuntimeException("Imagen no encontrada: $ruta");
        }
        $data = (string)file_get_contents($ruta);
        if ($data === '') {
            throw new \RuntimeException("Imagen vacia: $ruta");
        }
        if (self::gd()) {
            return self::viaGD($data, $ruta, $anchoPx, $altoPx);
        }
        $tipo = self::tipo($data, $ruta);
        if ($tipo === 'png') {
            return self::viaPngPuro($data, $ruta, $anchoPx, $altoPx);
        }
        if ($tipo === 'jpeg') {
            $dim = self::tamanoJpeg($data);
            if ($dim && $dim['w'] === $anchoPx && $dim['h'] === $altoPx) {
                return ['tipo' => 'dct', 'w' => $dim['w'], 'h' => $dim['h'], 'jpeg' => $data];
            }
            $dims = $dim ? " (es {$dim['w']}x{$dim['h']})" : '';
            throw new \RuntimeException(
                "La extension GD no esta disponible y el JPEG no coincide con el tamano del grupo "
                . "({$anchoPx}x{$altoPx} px)$dims. Convertila a PNG o activa GD en el servidor."
            );
        }
        throw new \RuntimeException(
            'Formato de imagen no soportado sin GD (' . $tipo . '). Usa PNG o activa GD para JPEG/GIF/WebP.'
        );
    }

    /** Detecta el tipo por firma (magic bytes). */
    public static function tipo($data, $ruta = '')
    {
        if (strncmp($data, "\x89PNG\r\n\x1a\n", 8) === 0) {
            return 'png';
        }
        if (strncmp($data, "\xFF\xD8\xFF", 3) === 0) {
            return 'jpeg';
        }
        if (strncmp($data, 'GIF8', 4) === 0) {
            return 'gif';
        }
        if (strncmp($data, 'RIFF', 4) === 0 && substr($data, 8, 4) === 'WEBP') {
            return 'webp';
        }
        return 'desconocido';
    }
    /**
     * Dimensiones de un JPEG recorriendo los marcadores SOF.
     * Devuelve ['w'=>int,'h'=>int] o null si no se pudo determinar.
     */
    public static function tamanoJpeg($data)
    {
        $n = strlen($data);
        if ($n < 4 || strncmp($data, "\xFF\xD8", 2) !== 0) {
            return null;
        }
        $p = 2;
        while ($p + 4 <= $n) {
            if (ord($data[$p]) !== 0xFF) {
                $p++;
                continue;
            }
            $marcador = ord($data[$p + 1]);
            if ($marcador === 0xD8 || $marcador === 0x01 || ($marcador >= 0xD0 && $marcador <= 0xD7)) {
                $p += 2;
                continue;
            }
            if ($p + 4 > $n) {
                break;
            }
            $len = unpack('n', substr($data, $p + 2, 2))[1];
            if ($len < 2) {
                break;
            }
            if ($marcador >= 0xC0 && $marcador <= 0xCF && $marcador !== 0xC4 && $marcador !== 0xC8 && $marcador !== 0xCC) {
                if ($p + 9 > $n) {
                    break;
                }
                $dims = unpack('nalto/nancho', substr($data, $p + 5, 4));
                return ['w' => (int)$dims['ancho'], 'h' => (int)$dims['alto']];
            }
            $p += 2 + $len;
        }
        return null;
    }

    /** Camino con GD: decodifica cualquier formato y remuestrea al lienzo. */
    private static function viaGD($data, $ruta, $W, $H)
    {
        $img = @imagecreatefromstring($data);
        if (!$img) {
            throw new \RuntimeException("No se pudo leer la imagen: $ruta");
        }
        if (function_exists('imagepalettetotruecolor') && !imageistruecolor($img)) {
            imagepalettetotruecolor($img);
        }
        imagesavealpha($img, true);
        $iw = imagesx($img);
        $ih = imagesy($img);

        $lienzo = imagecreatetruecolor($W, $H);
        imagealphablending($lienzo, false);
        imagesavealpha($lienzo, true);
        imagefill($lienzo, 0, 0, imagecolorallocatealpha($lienzo, 0, 0, 0, 127));

        list($fw, $fh, $ox, $oy) = self::encajado($iw, $ih, $W, $H);
        imagecopyresampled($lienzo, $img, $ox, $oy, 0, 0, $fw, $fh, $iw, $ih);
        imagedestroy($img);

        $rgb = str_repeat("\x00", $W * $H * 3);
        $alpha = str_repeat("\x00", $W * $H);
        for ($y = 0; $y < $fh; $y++) {
            for ($x = 0; $x < $fw; $x++) {
                $c = imagecolorat($lienzo, $ox + $x, $oy + $y);
                $i = ($oy + $y) * $W + ($ox + $x);
                $rgb[$i * 3] = chr(($c >> 16) & 0xFF);
                $rgb[$i * 3 + 1] = chr(($c >> 8) & 0xFF);
                $rgb[$i * 3 + 2] = chr($c & 0xFF);
                $ga = ($c >> 24) & 0x7F; // GD: 0 = opaco, 127 = transparente
                $alpha[$i] = chr(255 - (int)round($ga * 255 / 127));
            }
        }
        imagedestroy($lienzo);
        return ['tipo' => 'raster', 'w' => $W, 'h' => $H, 'rgb' => $rgb, 'alpha' => $alpha];
    }

    /** Geometria del encajado: [anchoFit, altoFit, offsetX, offsetY]. */
    public static function encajado($iw, $ih, $W, $H)
    {
        $esc = min($W / $iw, $H / $ih);
        $fw = max(1, (int)round($iw * $esc));
        $fh = max(1, (int)round($ih * $esc));
        $ox = (int)round(($W - $fw) / 2.0);
        $oy = (int)round(($H - $fh) / 2.0);
        return [$fw, $fh, $ox, $oy];
    }
    /** Decodifica un PNG (8 bits, sin entrelazar) a RGBA crudo. */
    private static function decodificarPng($data, $ruta)
    {
        $p = 8;
        $n = strlen($data);
        $ihdr = null;
        $plte = null;
        $trns = null;
        $idat = '';
        while ($p + 8 <= $n) {
            $len = unpack('N', substr($data, $p, 4))[1];
            $tipo = substr($data, $p + 4, 4);
            $contenido = substr($data, $p + 8, $len);
            $p += 12 + $len;
            if ($tipo === 'IHDR') {
                $ihdr = unpack('Nancho/Nalto/Cbits/Ccolor/Ccomp/Cfiltro/Centrelazado', $contenido);
            } elseif ($tipo === 'PLTE') {
                $plte = $contenido;
            } elseif ($tipo === 'tRNS') {
                $trns = $contenido;
            } elseif ($tipo === 'IDAT') {
                $idat .= $contenido;
            } elseif ($tipo === 'IEND') {
                break;
            }
        }
        if (!$ihdr) {
            throw new \RuntimeException("PNG sin cabecera IHDR: $ruta");
        }
        if ((int)$ihdr['entrelazado'] !== 0) {
            throw new \RuntimeException('PNG entrelazado no soportado sin GD. Guarda la imagen sin entrelazar.');
        }
        if ((int)$ihdr['bits'] !== 8) {
            throw new \RuntimeException('PNG con profundidad distinta de 8 bits no soportado sin GD.');
        }
        $colortipo = (int)$ihdr['color'];
        switch ($colortipo) {
            case 0: $canales = 1; break; // gris
            case 2: $canales = 3; break; // RGB
            case 3: $canales = 1; break; // paleta
            case 4: $canales = 2; break; // gris+alfa
            case 6: $canales = 4; break; // RGBA
            default:
                throw new \RuntimeException("Tipo de color PNG no soportado ($colortipo) sin GD.");
        }
        if ($colortipo === 3 && $plte === null) {
            throw new \RuntimeException("PNG de paleta sin PLTE: $ruta");
        }
        $crudo = @gzuncompress($idat);
        if ($crudo === false) {
            throw new \RuntimeException("PNG corrupto (no se pudo descomprimir): $ruta");
        }
        $w = (int)$ihdr['ancho'];
        $h = (int)$ihdr['alto'];
        $fila = $w * $canales;
        $prev = str_repeat("\x00", $fila);
        $lineas = '';
        $pos = 0;
        $total = strlen($crudo);
        for ($y = 0; $y < $h; $y++) {
            if ($pos + 1 + $fila > $total) {
                throw new \RuntimeException("PNG corrupto (datos insuficientes): $ruta");
            }
            $filtro = ord($crudo[$pos]);
            $linea = substr($crudo, $pos + 1, $fila);
            $pos += 1 + $fila;
            $out = '';
            for ($x = 0; $x < $fila; $x++) {
                $a = $x >= $canales ? ord($out[$x - $canales]) : 0;
                $b = ord($prev[$x]);
                $c = $x >= $canales ? ord($prev[$x - $canales]) : 0;
                $v = ord($linea[$x]);
                if ($filtro === 1) {
                    $v = ($v + $a) & 0xFF;
                } elseif ($filtro === 2) {
                    $v = ($v + $b) & 0xFF;
                } elseif ($filtro === 3) {
                    $v = ($v + (($a + $b) >> 1)) & 0xFF;
                } elseif ($filtro === 4) {
                    $v = ($v + self::paeth($a, $b, $c)) & 0xFF;
                } elseif ($filtro !== 0) {
                    throw new \RuntimeException("Filtro PNG desconocido ($filtro): $ruta");
                }
                $out .= chr($v);
            }
            $lineas .= $out;
            $prev = $out;
        }
        return ['w' => $w, 'h' => $h, 'lineas' => $lineas, 'colortipo' => $colortipo, 'plte' => $plte, 'trns' => $trns];
    }

    /** Filtro Paeth del estandar PNG. */
    private static function paeth($a, $b, $c)
    {
        $p = $a + $b - $c;
        $pa = abs($p - $a);
        $pb = abs($p - $b);
        $pc = abs($p - $c);
        if ($pa <= $pb && $pa <= $pc) {
            return $a;
        }
        if ($pb <= $pc) {
            return $b;
        }
        return $c;
    }
    /** Camino PHP puro: decodificador PNG propio + encajado por vecino. */
    private static function viaPngPuro($data, $ruta, $W, $H)
    {
        $png = self::decodificarPng($data, $ruta);
        $rgba = self::expandirRGBA($png['lineas'], $png['w'], $png['h'], $png['colortipo'], $png['plte'], $png['trns']);
        $rgba = self::encajarNearest($rgba, $png['w'], $png['h'], $W, $H);
        return self::separar($rgba, $W, $H);
    }

    /** Expande las lineas desfiltradas de un PNG a RGBA (w*h*4 bytes). */
    private static function expandirRGBA($lineas, $w, $h, $colortipo, $plte, $trns)
    {
        $px = $w * $h;
        $rgba = str_repeat("\x00", $px * 4);
        for ($i = 0; $i < $px; $i++) {
            if ($colortipo === 6) {
                $rgba[$i * 4] = $lineas[$i * 4];
                $rgba[$i * 4 + 1] = $lineas[$i * 4 + 1];
                $rgba[$i * 4 + 2] = $lineas[$i * 4 + 2];
                $rgba[$i * 4 + 3] = $lineas[$i * 4 + 3];
            } elseif ($colortipo === 2) {
                $rgba[$i * 4] = $lineas[$i * 3];
                $rgba[$i * 4 + 1] = $lineas[$i * 3 + 1];
                $rgba[$i * 4 + 2] = $lineas[$i * 3 + 2];
                $rgba[$i * 4 + 3] = "\xFF";
            } elseif ($colortipo === 4) {
                $g = $lineas[$i * 2];
                $rgba[$i * 4] = $g;
                $rgba[$i * 4 + 1] = $g;
                $rgba[$i * 4 + 2] = $g;
                $rgba[$i * 4 + 3] = $lineas[$i * 2 + 1];
            } elseif ($colortipo === 0) {
                $v = $lineas[$i];
                $rgba[$i * 4] = $v;
                $rgba[$i * 4 + 1] = $v;
                $rgba[$i * 4 + 2] = $v;
                $rgba[$i * 4 + 3] = "\xFF";
            } else { // paleta
                $idx = ord($lineas[$i]);
                $rgba[$i * 4] = $plte[$idx * 3];
                $rgba[$i * 4 + 1] = $plte[$idx * 3 + 1];
                $rgba[$i * 4 + 2] = $plte[$idx * 3 + 2];
                $rgba[$i * 4 + 3] = isset($trns[$idx]) ? $trns[$idx] : "\xFF";
            }
        }
        return $rgba;
    }

    /** Coloca $rgba (iw x ih) encajado y centrado sobre un lienzo W x H transparente. */
    private static function encajarNearest($rgba, $iw, $ih, $W, $H)
    {
        if ($iw === $W && $ih === $H) {
            return $rgba;
        }
        $lienzo = str_repeat("\x00", $W * $H * 4);
        list($fw, $fh, $ox, $oy) = self::encajado($iw, $ih, $W, $H);
        for ($y = 0; $y < $fh; $y++) {
            $sy = min($ih - 1, (int)(($y + 0.5) * $ih / $fh));
            $origen = substr($rgba, $sy * $iw * 4, $iw * 4);
            $base = ($oy + $y) * $W;
            for ($x = 0; $x < $fw; $x++) {
                $sx = min($iw - 1, (int)(($x + 0.5) * $iw / $fw));
                $d = ($base + $ox + $x) * 4;
                $o = $sx * 4;
                $lienzo[$d] = $origen[$o];
                $lienzo[$d + 1] = $origen[$o + 1];
                $lienzo[$d + 2] = $origen[$o + 2];
                $lienzo[$d + 3] = $origen[$o + 3];
            }
        }
        return $lienzo;
    }

    /** Separa RGBA crudo en planos rgb (W*H*3) y alfa (W*H). */
    private static function separar($rgba, $W, $H)
    {
        $px = $W * $H;
        $rgb = str_repeat("\x00", $px * 3);
        $alpha = str_repeat("\x00", $px);
        for ($i = 0; $i < $px; $i++) {
            $rgb[$i * 3] = $rgba[$i * 4];
            $rgb[$i * 3 + 1] = $rgba[$i * 4 + 1];
            $rgb[$i * 3 + 2] = $rgba[$i * 4 + 2];
            $alpha[$i] = $rgba[$i * 4 + 3];
        }
        return ['tipo' => 'raster', 'w' => $W, 'h' => $H, 'rgb' => $rgb, 'alpha' => $alpha];
    }
}