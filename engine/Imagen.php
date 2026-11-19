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
 *  GD + WebP es REQUISITO del plugin (no hay camino alternativo): `normalizar()`
 *  falla con `motor:imagen:gd` si falta. Sobre esa base hay dos salidas:
 *  1. JPEG cuyas dimensiones coinciden EXACTO con el lienzo: se incrusta
 *     directo (DCTDecode), sin decodificar ni recomprimir pixeles.
 *  2. El resto: GD lo decodifica (JPEG/PNG/GIF/WebP) y lo remuestrea.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Imagen
{
    /** GD disponible? (requisito del plugin: sin GD `normalizar()` falla) */
    public static function gd()
    {
        return extension_loaded('gd') && function_exists('imagecreatefromstring');
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
        if (!self::gd()) {
            throw new \RuntimeException('motor:imagen:gd');
        }
        if (!is_file($ruta)) {
            throw new \RuntimeException("Imagen no encontrada: $ruta");
        }
        $data = (string)file_get_contents($ruta);
        if ($data === '') {
            throw new \RuntimeException("Imagen vacia: $ruta");
        }
        // JPEG que ya mide EXACTO el lienzo: se incrusta tal cual (DCTDecode).
        // Con encaje exacto los margenes son 0, asi que el resultado es identico
        // al de rasterizar, pero el PDF pesa una fraccion y no se recomprime.
        $dim = self::tamanoJpeg($data);
        if ($dim !== null && $dim['w'] === $anchoPx && $dim['h'] === $altoPx) {
            return ['tipo' => 'dct', 'w' => $dim['w'], 'h' => $dim['h'], 'jpeg' => $data];
        }
        return self::viaGD($data, $ruta, $anchoPx, $altoPx);
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
        // imagedestroy() no tiene ningun efecto desde PHP 8.0 y esta deprecado en 8.5.
// El plugin exige PHP 7.4+, donde si liberaba memoria: se llama solo ahi.
if (PHP_VERSION_ID < 80000) {
            imagedestroy($img);
        }

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
        // Ver nota de la linea anterior: solo en PHP < 8.0.
        if (PHP_VERSION_ID < 80000) {
            imagedestroy($lienzo);
        }
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

    

    

    
}