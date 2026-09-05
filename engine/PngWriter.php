<?php
/**
 * PngWriter - Genera un PNG totalmente transparente en PHP puro
 * (zlib/gzdeflate), sin depender de la extension GD.
 *
 * Formato: RGBA de 8 bits por canal, scanlines con filtro 0.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class PngWriter
{
    /** Escribe un PNG WxH transparente en $ruta. Devuelve los bytes. */
    public static function write($ruta, $w, $h, $rgba = null)
    {
        $w = max(1, (int)$w);
        $h = max(1, (int)$h);
        $bytes = self::bytes($w, $h, $rgba);
        file_put_contents($ruta, $bytes);
        return $bytes;
    }

    /** Construye los bytes del PNG transparente WxH (o con datos RGBA crudos). */
    public static function bytes($w, $h, $rgba = null)
    {
        $w = max(1, (int)$w);
        $h = max(1, (int)$h);
        $row = $w * 4;
        if ($rgba === null || strlen($rgba) < $row * $h) {
            $rgba = str_repeat("\x00", $row * $h);
        }
        $idat = '';
        for ($y = 0; $y < $h; $y++) {
            $idat .= "\x00" . substr($rgba, $y * $row, $row);
        }
        $idat = gzcompress($idat, 6);
        $out = "\x89PNG\r\n\x1a\n";
        $out .= self::chunk('IHDR', pack('NNCCCCC', $w, $h, 8, 6, 0, 0, 0));
        $out .= self::chunk('IDAT', $idat);
        $out .= self::chunk('IEND', '');
        return $out;
    }

    private static function chunk($tipo, $datos)
    {
        return pack('N', strlen($datos)) . $tipo . $datos . pack('N', crc32($tipo . $datos));
    }
}