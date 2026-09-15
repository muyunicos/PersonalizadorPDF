<?php
/**
 * Metadata - Analisis del producto PDF (plan 008, spec 008 FR-001).
 *
 * El Detector escribe analisis.json inmutable: id (color hex sin '#'),
 * w/h en px (base 200 ppp), cont (instancias), pgs (paginas 0-based).
 * Raiz con pdf/dpi/total_grupos/creado. Sin personalizacion y sin activo:
 * eso vive en config.json (PMU_Uploads::leer_config/guardar_config).
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Metadata
{
    const ARCHIVO_ANALISIS = 'analisis.json';
    const ARCHIVO_CONFIG = 'config.json';

    /** nombre_desde_archivo de Python: base saneada [A-Za-z0-9_-]. */
    public static function nombreDesdeArchivo($ruta)
    {
        $base = basename(strtr((string)$ruta, '\\', '/'));
        if (preg_match('/\.pdf$/i', $base)) {
            $base = substr($base, 0, -4);
        }
        $saneado = preg_replace('/[^A-Za-z0-9_-]+/', '_', $base);
        $saneado = trim((string)$saneado, '_');
        return $saneado === '' ? 'pdf' : $saneado;
    }

    /** id valido de grupo: hex de 6 sin '#'. */
    public static function idValido($id)
    {
        return is_string($id) && preg_match('/^[0-9A-F]{6}$/', $id) === 1;
    }



    /**
     * Analisis inmutable del Detector (plan 008, spec 008 FR-001): solo
     * geometria (id/w/h/cont/pgs) + raiz pdf/dpi/creado/total_grupos.
     * Sin personalizacion (default/value/preset/config) y sin activo: eso
     * vive en config.json (PMU_Uploads::leer_config/guardar_config).
     * Se escribe en analisis.json y nunca se edita desde la UI.
     */
    public static function generarAnalisis($pdf, $grupos, $dpi = 200)
    {
        $registros = [];
        foreach ((array)$grupos as $g) {
            $gid = isset($g['id']) ? (string)$g['id'] : '';
            if (!self::idValido($gid)) {
                continue;
            }
            $registros[] = [
                'id' => $gid,
                'w' => max(1, (int)($g['w'] ?? 0)),
                'h' => max(1, (int)($g['h'] ?? 0)),
                'cont' => max(1, (int)($g['cont'] ?? 0)),
                'pgs' => array_values(array_map('intval', (array)($g['pgs'] ?? []))),
            ];
        }
        return [
            'pdf' => (string)$pdf,
            'dpi_conversion' => (int)$dpi,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'total_grupos' => count($registros),
            'grupos' => $registros,
        ];
    }


    /** Escritura atomica: tmp + rename en la misma carpeta. */
    public static function guardar(array $datos, $ruta)
    {
        $dir = dirname($ruta);
        if ($dir && !is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        $tmp = $ruta . '.tmp';
        file_put_contents($tmp, json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
        rename($tmp, $ruta);
        return $ruta;
    }

    public static function cargar($ruta)
    {
        $raw = file_get_contents($ruta);
        if ($raw === false) {
            throw new \RuntimeException("No se pudo leer metadatos: $ruta");
        }
        return json_decode($raw, true);
    }
}
