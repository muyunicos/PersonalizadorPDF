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
    /** Tope de formas DISTINTAS por grupo en envolturas.json (peso real).
     *  Ya no limita instancias: una forma compartida por 600 instancias cuenta 1. */
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
     * Envolturas (PowerClip de Corel) del producto para el archivo DERIVADO
     * `pdfs/{nombre}/envolturas.json` (nunca vive en analisis.json).
     *
     * v2: las formas se DEDUPLICAN. Antes se guardaba una copia por instancia
     * (un grupo de 600 instancias con el mismo marco escribia 100 copias y
     * truncaba el resto por el tope). Ahora:
     *
     *   {version: 2, pdf, creado, grupos: {gid: {
     *       formas: [{par, subs, usos}, ...],   // formas DISTINTAS
     *       defecto: k,                          // la mas usada (1-based)
     *       mapa: {n: k}                         // TODAS las instancias (0 = sin envoltura)
     *   }}}
     *
     * `mapa` es completo (ints, barato) para que el override del admin no
     * falsee la geometria real de cada instancia; el ahorro esta en `formas`.
     * Un grupo sin ninguna envoltura no aparece. ENV_MAX ahora cuenta formas
     * DISTINTAS (ya no trunca instancias); ENV_SEG_MAX sigue por forma.
     */
    public static function generarEnvolturas($pdf, $grupos)
    {
        $salida = [];
        foreach ((array)$grupos as $g) {
            $gid = isset($g['id']) ? (string)$g['id'] : '';
            if (!self::idValido($gid)) {
                continue;
            }
            $porN = [];
            $n = 0;
            foreach ((array)(isset($g['instancias']) ? $g['instancias'] : []) as $in) {
                $n++;
                $e = null;
                if (!empty($in['env']) && is_array($in['env'])) {
                    $e = self::envNormalizado($in['env'], $in);
                }
                $porN[(string)$n] = $e; // null = sin envoltura (o no extraible)
            }
            $grupo = self::agruparFormas($porN);
            if ($grupo !== null) {
                $salida[$gid] = $grupo;
            }
        }
        return [
            'version' => 2,
            'pdf' => (string)$pdf,
            'creado' => gmdate('Y-m-d\TH:i:s\Z'),
            'grupos' => $salida,
        ];
    }


    /**
     * Deduplica envolturas por forma: `[n => env|null]` ->
     * `{formas, defecto, mapa}`. `formas` = formas DISTINTAS con sus `usos`;
     * `defecto` = la mas usada (empate -> la primera); `mapa` = n -> k para
     * TODAS las instancias (k=0 = sin envoltura). Null si no hay ninguna.
     * Lo usan el Detector (generarEnvolturas) y la lectura de archivos v1.
     */
    public static function agruparFormas(array $porN)
    {
        $formas = [];
        $indice = [];
        $usos = [];
        $mapa = [];
        foreach ($porN as $n => $e) {
            if (!is_array($e) || empty($e['subs'])) {
                $mapa[(string)(int)$n] = 0;
                continue;
            }
            $firma = self::firmaForma($e);
            if (!isset($indice[$firma])) {
                if (count($formas) >= self::ENV_MAX) {
                    // Tope de formas DISTINTAS: esta instancia queda sin
                    // envoltura (el editor lo informa sin culpar al analisis).
                    $mapa[(string)(int)$n] = 0;
                    continue;
                }
                $formas[] = ['par' => !empty($e['par']) ? 1 : 0, 'subs' => $e['subs']];
                $indice[$firma] = count($formas); // 1-based
                $usos[count($formas)] = 0;
            }
            $k = $indice[$firma];
            $usos[$k]++;
            $mapa[(string)(int)$n] = $k;
        }
        if (!$formas) {
            return null;
        }
        $defecto = 0;
        $mejor = -1;
        foreach ($usos as $k => $u) {
            if ($u > $mejor) {
                $mejor = $u;
                $defecto = (int)$k;
            }
        }
        foreach ($formas as $i => $f) {
            $formas[$i]['usos'] = isset($usos[$i + 1]) ? $usos[$i + 1] : 0;
        }
        return ['formas' => $formas, 'defecto' => $defecto, 'mapa' => $mapa];
    }

    /**
     * Firma estable de una forma para deduplicar (tolerante al ruido
     * sub-milesimal entre instancias del mismo PowerClip).
     */
    private static function firmaForma(array $e)
    {
        $partes = [];
        foreach ((array)(isset($e['subs']) ? $e['subs'] : []) as $sub) {
            $segs = [];
            foreach ((array)(isset($sub['s']) ? $sub['s'] : []) as $seg) {
                $vals = [];
                foreach (array_slice((array)$seg, 1) as $v) {
                    $vals[] = round((float)$v, 3);
                }
                $segs[] = $seg[0] . ':' . implode(',', $vals);
            }
            $m = isset($sub['m']) && is_array($sub['m']) ? $sub['m'] : [0, 0];
            $partes[] = round((float)($m[0] ?? 0), 3) . ',' . round((float)($m[1] ?? 0), 3)
                . '|' . implode(';', $segs) . '|' . (!empty($sub['c']) ? 'c' : 'a');
        }
        return (!empty($e['par']) ? '1' : '0') . '#' . implode('/', $partes);
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
     * Indice (1-based) de la forma que usa una instancia en un grupo v2:
     * `mapa[n]` > override del admin > `defecto`. 0 = sin envoltura.
     */
    public static function formaIndice(array $grupo, $n, $override = 0)
    {
        $mapa = isset($grupo['mapa']) && is_array($grupo['mapa']) ? $grupo['mapa'] : [];
        $clave = (string)(int)$n;
        if (array_key_exists($clave, $mapa)) {
            return (int)$mapa[$clave];
        }
        $override = (int)$override;
        if ($override > 0) {
            return $override;
        }
        return (int)(isset($grupo['defecto']) ? $grupo['defecto'] : 0);
    }

    /**
     * Geometria de la forma `k` (sin `usos`) o null. Es lo UNICO que viaja al
     * cliente: `{par, subs}`.
     */
    public static function forma(array $grupo, $k)
    {
        $k = (int)$k;
        $formas = isset($grupo['formas']) && is_array($grupo['formas']) ? $grupo['formas'] : [];
        if ($k < 1 || !isset($formas[$k - 1]) || !is_array($formas[$k - 1])) {
            return null;
        }
        $f = $formas[$k - 1];
        return [
            'par' => !empty($f['par']) ? 1 : 0,
            'subs' => isset($f['subs']) && is_array($f['subs']) ? $f['subs'] : [],
        ];
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
