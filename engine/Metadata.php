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
     * Lo usa el Detector al generar el archivo (`generarEnvolturas`).
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

    /**
     * Mapa de reasociacion para REEMPLAZAR el PDF (spec 032, T003). PURO.
     *
     * Compara el analisis VIGENTE con el NUEVO (ambos con `instancias`, tal como
     * los devuelve `Detector::analizarPdf()`) y propone el mapa viejo->nuevo:
     * mismo id = reasociacion automatica; el resto, SUGERENCIA por geometria
     * (**filtro**: IoU de las `dev_bbox` normalizadas al box de su pagina >= 0,5)
     * y color (**peso**, no filtro: un rediseno cambia el color a proposito).
     *
     * **1:1** (INV-1): ningun grupo nuevo es destino de dos viejos. Los pares
     * candidatos se ordenan por `score` (0,6*IoU + 0,4*color) y se toman de a uno.
     *
     * @param array $previos grupos del analisis vigente (['id','w','h','cont','pgs','instancias'])
     * @param array $nuevos  idem del PDF nuevo
     * @param array $boxes   box por pagina (0-based) => [x0,y0,x1,y1]; ausente = sin normalizar
     * @param array $config  config previo (solo para marcar `con_personalizacion`)
     * @return array
     */
    public static function mapaDeReemplazo(array $previos, array $nuevos, array $boxes = [], array $config = [])
    {
        $umbralIou = 0.5;

        $idxPrevios = [];
        foreach ($previos as $g) {
            $id = (string)($g['id'] ?? '');
            if (self::idValido($id)) {
                $idxPrevios[$id] = $g;
            }
        }
        $idxNuevos = [];
        foreach ($nuevos as $g) {
            $id = (string)($g['id'] ?? '');
            if (self::idValido($id)) {
                $idxNuevos[$id] = $g;
            }
        }

        $maph = isset($config['placeholders']) && is_array($config['placeholders'])
            ? $config['placeholders'] : [];
        $tienePerson = function ($id) use ($maph) {
            $m = $maph[$id] ?? null;
            if (!is_array($m)) {
                return false;
            }
            return (isset($m['value']) && (string)$m['value'] !== '')
                || (isset($m['preset']) && (string)$m['preset'] !== '')
                || (isset($m['settings']) && (string)$m['settings'] !== '');
        };

        // 1) Ids que sobreviven: reasociacion automatica.
        // OJO: PHP castea a INT las claves de array con forma numerica (un color
        // como `112233` entra como int). Por eso TODO lo que sale de aca es
        // (string): el contrato promete ids string y el JS los usa como claves.
        $iguales = [];
        $usados = [];
        foreach ($idxPrevios as $id => $g) {
            if (isset($idxNuevos[$id])) {
                $iguales[$id] = (string)$id;
                $usados[$id] = true;
            }
        }

        // 2) Candidatos entre los que NO tienen id igual (umbrales R3).
        $pares = [];
        foreach ($idxPrevios as $id => $g) {
            if (isset($iguales[$id])) {
                continue;
            }
            foreach ($idxNuevos as $idN => $gN) {
                if (isset($usados[$idN])) {
                    continue;
                }
                $iou = self::iouGrupos($g, $gN, $boxes);
                if ($iou < $umbralIou) {
                    continue;
                }
                // El color NO filtra: un rediseno cambia el color A PROPOSITO (ese
                // era justo el caso que perdia la personalizacion). Pondera en el
                // score, asi desempata entre huecos geometricamente parecidos.
                $dist = self::distanciaColor($id, $idN);
                $pares[] = [
                    'de' => (string)$id,
                    'a' => (string)$idN,
                    'iou' => round($iou, 4),
                    'color' => round(1 - $dist, 4),
                    'score' => round(0.6 * $iou + 0.4 * (1 - $dist), 4),
                ];
            }
        }
        usort($pares, function ($x, $y) {
            return $y['score'] <=> $x['score'];
        });
        $sugeridos = [];
        $tomados = [];
        foreach ($pares as $p) {
            if (isset($tomados[$p['de']]) || isset($usados[$p['a']])) {
                continue;
            }
            $tomados[$p['de']] = true;
            $usados[$p['a']] = true;
            $sugeridos[] = $p;
        }
        usort($sugeridos, function ($x, $y) {
            return strcmp($x['de'], $y['de']);
        });

        // 3) Perdidos (con o sin personalizacion) y nuevos sin par.
        $perdidos = [];
        foreach ($idxPrevios as $id => $g) {
            if (isset($iguales[$id]) || isset($tomados[$id])) {
                continue;
            }
            $perdidos[] = ['gid' => (string)$id, 'con_personalizacion' => (bool)$tienePerson($id)];
        }
        $libres = [];
        foreach ($idxNuevos as $idN => $gN) {
            if (!isset($usados[$idN])) {
                $libres[] = (string)$idN;
            }
        }
        sort($libres);

        return [
            'grupos_previos' => count($idxPrevios),
            'grupos_nuevos' => count($idxNuevos),
            'iguales' => $iguales,
            'sugeridos' => $sugeridos,
            'perdidos' => $perdidos,
            'nuevos' => $libres,
            'avisos' => [],
        ];
    }

    /** Distancia de color 0..1 (euclidea normalizada en RGB; R2). Publica: testeable. */
    public static function distanciaColor($hexA, $hexB)
    {
        $a = self::rgbDeHex($hexA);
        $b = self::rgbDeHex($hexB);
        if ($a === null || $b === null) {
            return 1.0;
        }
        $dr = $a[0] - $b[0];
        $dg = $a[1] - $b[1];
        $db = $a[2] - $b[2];
        return sqrt(($dr * $dr + $dg * $dg + $db * $db) / 3) / 255;
    }

    private static function rgbDeHex($hex)
    {
        $v = strtoupper(ltrim((string)$hex, '#'));
        if (preg_match('/^[0-9A-F]{6}$/', $v) !== 1) {
            return null;
        }
        return [hexdec(substr($v, 0, 2)), hexdec(substr($v, 2, 2)), hexdec(substr($v, 4, 2))];
    }

    /**
     * IoU de dos grupos: el mejor por par de instancias (misma pagina),
     * CASTIGADO por la diferencia de cantidad (si no, una instancia suelta
     * emparejaria a un grupo de 8). Sin bboxes cae a tamano + cantidad (R1).
     */
    private static function iouGrupos(array $a, array $b, array $boxes)
    {
        $ca = self::cajasNormalizadas($a, $boxes);
        $cb = self::cajasNormalizadas($b, $boxes);
        if ($ca && $cb) {
            $mejor = 0.0;
            foreach ($ca as $u) {
                foreach ($cb as $v) {
                    $iou = self::iou($u, $v);
                    if ($iou > $mejor) {
                        $mejor = $iou;
                    }
                }
            }
            if ($mejor <= 0.0) {
                return 0.0;
            }
            $na = max(1, (int)($a['cont'] ?? count($ca)));
            $nb = max(1, (int)($b['cont'] ?? count($cb)));
            return $mejor * (min($na, $nb) / max($na, $nb));
        }
        $wa = max(1, (int)($a['w'] ?? 1));
        $wb = max(1, (int)($b['w'] ?? 1));
        $ha = max(1, (int)($a['h'] ?? 1));
        $hb = max(1, (int)($b['h'] ?? 1));
        $na = max(1, (int)($a['cont'] ?? 1));
        $nb = max(1, (int)($b['cont'] ?? 1));
        return (min($wa, $wb) / max($wa, $wb)
            + min($ha, $hb) / max($ha, $hb)
            + min($na, $nb) / max($na, $nb)) / 3;
    }

    /** Cajas 0..1 (por pagina) de las instancias con `dev_bbox`. */
    private static function cajasNormalizadas(array $g, array $boxes)
    {
        $out = [];
        foreach ((array)($g['instancias'] ?? []) as $in) {
            $bb = $in['dev_bbox'] ?? null;
            if (!is_array($bb) || count($bb) < 4) {
                continue;
            }
            $pagina = (int)($in['page'] ?? 0);
            $x0 = (float)$bb[0];
            $y0 = (float)$bb[1];
            $x1 = (float)$bb[2];
            $y1 = (float)$bb[3];
            $box = $boxes[$pagina] ?? null;
            if (is_array($box) && count($box) >= 4) {
                $bw = (float)$box[2] - (float)$box[0];
                $bh = (float)$box[3] - (float)$box[1];
                if ($bw > 0 && $bh > 0) {
                    $x0 = ($x0 - (float)$box[0]) / $bw;
                    $x1 = ($x1 - (float)$box[0]) / $bw;
                    $y0 = ($y0 - (float)$box[1]) / $bh;
                    $y1 = ($y1 - (float)$box[1]) / $bh;
                }
            }
            $out[] = ['page' => $pagina, 'x0' => $x0, 'y0' => $y0, 'x1' => $x1, 'y1' => $y1];
        }
        return $out;
    }

    /** IoU de dos cajas normalizadas; 0 si son de paginas distintas. */
    private static function iou(array $a, array $b)
    {
        if ((int)$a['page'] !== (int)$b['page']) {
            return 0.0;
        }
        $ix = max(0.0, min($a['x1'], $b['x1']) - max($a['x0'], $b['x0']));
        $iy = max(0.0, min($a['y1'], $b['y1']) - max($a['y0'], $b['y0']));
        $inter = $ix * $iy;
        $areaA = max(0.0, $a['x1'] - $a['x0']) * max(0.0, $a['y1'] - $a['y0']);
        $areaB = max(0.0, $b['x1'] - $b['x0']) * max(0.0, $b['y1'] - $b['y0']);
        $union = $areaA + $areaB - $inter;
        return $union > 0 ? $inter / $union : 0.0;
    }
}
