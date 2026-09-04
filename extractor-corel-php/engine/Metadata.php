<?php
/**
 * Metadata - Convenciones de nombres e ids identicas a core/metadatos.py.
 *
 * Identificador de grupo:  {pdf}-{letra}-{ancho_px}x{alto_px}
 * Marco:                   {dir}/marcos/{pdf}/{letra}-{w}x{h}.png
 * Metadata:                {dir}/marcos/{pdf}/metadata.json
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Metadata
{
    const ARCHIVO = 'metadata.json';

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

    public static function idGrupo($pdf, $letra, $wPx, $hPx)
    {
        return "{$pdf}-{$letra}-{$wPx}x{$hPx}";
    }

    public static function rutaMarco($pdf, $letra, $wPx, $hPx)
    {
        return "marcos/{$pdf}/{$letra}-{$wPx}x{$hPx}.png";
    }

    public static function rutaMetadata($pdf, $dirMarcos = 'marcos')
    {
        return rtrim((string)$dirMarcos, '/\\') . DIRECTORY_SEPARATOR . $pdf . DIRECTORY_SEPARATOR . self::ARCHIVO;
    }

    /** Igual que metadatos.generar(). Devuelve array (json-serializable). */
    public static function generar($pdf, $grupos, $dpi = 200)
    {
        $registros = [];
        foreach ($grupos as $g) {
            $registros[] = [
                'id' => self::idGrupo($pdf, $g['letra'], $g['ancho_px'], $g['alto_px']),
                'letra' => $g['letra'],
                'color' => $g['color'],
                'color_rgb' => $g['color_rgb'],
                'ancho_px' => $g['ancho_px'],
                'alto_px' => $g['alto_px'],
                'ancho_pt' => $g['ancho_pt'],
                'alto_pt' => $g['alto_pt'],
                'num_instancias' => $g['num_instancias'],
                'paginas' => $g['paginas'],
                'ruta_marco' => self::rutaMarco($pdf, $g['letra'], $g['ancho_px'], $g['alto_px']),
            ];
        }
        return [
            'pdf' => $pdf,
            'dpi_conversion' => (int)$dpi,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'total_grupos' => count($registros),
            'grupos' => $registros,
        ];
    }

    public static function guardar(array $datos, $ruta)
    {
        $dir = dirname($ruta);
        if ($dir && !is_dir($dir)) {
            mkdir($dir, 0775, true);
        }
        file_put_contents($ruta, json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
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