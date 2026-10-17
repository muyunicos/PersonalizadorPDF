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
    /** Tope de envolturas por grupo en envolturas.json (limite de peso). */
    const ENV_MAX = 100;
    /** Tope de segmentos por envoltura: una forma patologicamente densa no se
     *  publica (el archivo sigue liviano; el editor informa sin envoltura). */
    const ENV_SEG_MAX = 5000;

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

    /**
     * Envolturas (PowerClip de Corel) por grupo/instancia para el archivo
     * DERIVADO `pdfs/{nombre}/envolturas.json` (no vive en analisis.json: el
     * dataset vuelve a su formato original y la geo se pide bajo demanda).
     *
     * Estructura: {version, pdf, creado, grupos: {gid: {n: {par, subs}}}}.
     * `grupos` vacio = "analizado sin envolturas" (se distingue de "sin
     * analizar": no existe el archivo). Clave n = indice 1-based de la
     * instancia (el `{grupo}#n` del editor).
     */
    public static function generarEnvolturas($pdf, $grupos)
    {
        $salida = [];
        foreach ((array)$grupos as $g) {
            $gid = isset($g['id']) ? (string)$g['id'] : '';
            if (!self::idValido($gid)) {
                continue;
            }
            $envs = [];
            $n = 0;
            foreach ((array)(isset($g['instancias']) ? $g['instancias'] : []) as $in) {
                $n++;
                if (count($envs) >= self::ENV_MAX) {
                    break;
                }
                if (empty($in['env']) || !is_array($in['env'])) {
                    continue;
                }
                $e = self::envNormalizado($in['env'], $in);
                if ($e !== null) {
                    $envs[(string)$n] = $e;
                }
            }
            if ($envs) {
                $salida[$gid] = $envs;
            }
        }
        return [
            'version' => 1,
            'pdf' => (string)$pdf,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'grupos' => $salida,
        ];
    }


    /**
     * Envoltura de una instancia -> formato de envolturas.json. Los puntos
     * (device space, y arriba) se proyectan sobre el marco del rect de la
     * instancia: `u` a lo ancho y `v` ya invertida (el lienzo del mockup tiene
     * el origen arriba-izquierda). Coordendas con 4 decimales. Devuelve null
     * si el marco es degenerado o la forma supera ENV_SEG_MAX segmentos: ahi
     * no se publica envoltura.
     */
    private static function envNormalizado($env, $inst)
    {
        $subs = isset($env['subs']) && is_array($env['subs']) ? $env['subs'] : [];
        if (!$subs) {
            return null;
        }
        $map = self::envMapa($inst);
        if ($map === null) {
            return null;
        }
        $out = [];
        $total = 0;
        foreach ($subs as $sub) {
            if (!is_array($sub) || empty($sub['m']) || !is_array($sub['m'])) {
                continue;
            }
            $m = $map($sub['m']);
            if ($m === null) {
                return null;
            }
            $segs = [];
            foreach ((array)(isset($sub['s']) ? $sub['s'] : []) as $seg) {
                if (!is_array($seg) || !isset($seg[0])) {
                    continue;
                }
                // Segmentos planos (mismo formato que los publica el analisis
                // y traza el cliente): ['c',x1,y1,x2,y2,x3,y3] / ['l',x,y].
                if ($seg[0] === 'c' && count($seg) >= 7) {
                    $a = $map([(float)$seg[1], (float)$seg[2]]);
                    $b = $map([(float)$seg[3], (float)$seg[4]]);
                    $z = $map([(float)$seg[5], (float)$seg[6]]);
                    if ($a === null || $b === null || $z === null) {
                        return null;
                    }
                    $segs[] = ['c', $a[0], $a[1], $b[0], $b[1], $z[0], $z[1]];
                } elseif ($seg[0] === 'l' && count($seg) >= 3) {
                    $a = $map([(float)$seg[1], (float)$seg[2]]);
                    if ($a === null) {
                        return null;
                    }
                    $segs[] = ['l', $a[0], $a[1]];
                }
            }
            $total += count($segs);
            if ($total > self::ENV_SEG_MAX) {
                return null;
            }
            $out[] = ['m' => $m, 's' => $segs, 'c' => !empty($sub['c']) ? 1 : 0];
        }
        if (!$out) {
            return null;
        }
        return ['par' => !empty($env['par']) ? 1 : 0, 'subs' => $out];
    }

    /**
     * Cierre [x,y] (device space, y arriba) -> [u,v] en el marco del rect de
     * la instancia. Con `dev_quad` (rect rotado) se proyecta sobre los ejes
     * del propio rect; si no, sobre el bbox alineado a ejes.
     */
    private static function envMapa(array $inst)
    {
        $quad = isset($inst['dev_quad']) && is_array($inst['dev_quad'])
            && count($inst['dev_quad']) === 4 ? $inst['dev_quad'] : null;
        if ($quad !== null) {
            $p0 = $quad[0];
            $ax = (float)$quad[1][0] - (float)$p0[0];
            $ay = (float)$quad[1][1] - (float)$p0[1];
            $bx = (float)$quad[2][0] - (float)$quad[1][0];
            $by = (float)$quad[2][1] - (float)$quad[1][1];
            $aa = $ax * $ax + $ay * $ay;
            $bb = $bx * $bx + $by * $by;
            if ($aa <= 1e-6 || $bb <= 1e-6) {
                return null;
            }
            return function ($p) use ($p0, $ax, $ay, $bx, $by, $aa, $bb) {
                $wx = (float)$p[0] - (float)$p0[0];
                $wy = (float)$p[1] - (float)$p0[1];
                $u = ($wx * $ax + $wy * $ay) / $aa;
                $v = 1.0 - ($wx * $bx + $wy * $by) / $bb;
                if (!is_finite($u) || !is_finite($v)) {
                    return null;
                }
                return [Round::halfEven($u, 4), Round::halfEven($v, 4)];
            };
        }
        $caja = isset($inst['dev_bbox']) && is_array($inst['dev_bbox'])
            && count($inst['dev_bbox']) >= 4 ? $inst['dev_bbox'] : null;
        if ($caja === null) {
            return null;
        }
        $x0 = (float)$caja[0];
        $y0 = (float)$caja[1];
        $w = (float)$caja[2] - $x0;
        $h = (float)$caja[3] - $y0;
        if ($w <= 1e-6 || $h <= 1e-6) {
            return null;
        }
        return function ($p) use ($x0, $y0, $w, $h) {
            $u = ((float)$p[0] - $x0) / $w;
            $v = 1.0 - ((float)$p[1] - $y0) / $h;
            if (!is_finite($u) || !is_finite($v)) {
                return null;
            }
            return [Round::halfEven($u, 4), Round::halfEven($v, 4)];
        };
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
