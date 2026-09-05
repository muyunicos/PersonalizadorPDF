<?php
/**
 * Overlay - Superpone los marcos (imagenes 100% transparentes) sobre los
 * placeholders de un PDF, equivalente a core/reemplazador.py + guardador.py.
 *
 * Estrategia (PHP puro, sin librerias externas):
 *  1. Parsea el PDF original con Pdf.
 *  2. Crea nuevos objetos: imagen XObject + SMask por grupo.
 *  3. Inserta (splice) cada imagen en el content stream ORIGINAL justo antes
 *     del relleno de su placeholder (z-order fiel al diseno: respeta clips W*
 *     y ornamentos que se pintan encima). Instancias sin offset usan un
 *     content stream nuevo al final (fallback).
 *  4. Reescribe cada objeto de pagina re-serializando su dict con
 *     /Contents ampliado y /Resources con el /XObject nuevo.
 *  5. (Opcional) optimiza: el PDF se re-construye completo, con deduplicacion
 *     de objetos libres.
 *  6. Emite header + objetos + xref + trailer.
 *
 * Devuelve los bytes del PDF final.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Overlay
{
    /** @var Pdf */
    private $pdf;
    private $grupos = [];
    private $pageNums = [];   // pageIdx => objnum pagina
    private $heights = [];    // pageIdx => alto en pt
    private $perPage = [];    // pageIdx => [{x,y,w,h,img}]
    private $imgObj = [];     // letra => objnum imagen
    private $newObjs = [];    // objnum => texto del objeto nuevo
    private $firstNew;
    private $activas = [];    // letra => true (grupos con imagen a insertar)
    private $splices = [];    // pageIdx => [ streamIdx => [ ['offset'=>int,'ops'=>str] ] ]
    private $rwObjs = [];     // objnum => texto del objeto reescrito (streams con splice)

    public function __construct($pdfData)
    {
        $this->pdf = new Pdf($pdfData);
        $this->pdf->load();
    }

    /**
     * Devuelve los bytes del PDF procesado.
     *
     * $imagenes (opcional): mapa letra => especificacion de Imagen::normalizar():
     *   - ['tipo'=>'raster', 'w','h','rgb','alpha']  imagen real RGBA
     *   - ['tipo'=>'dct', 'w','h','jpeg']            JPEG incrustado directo
     * Si $imagenes es null se usa el comportamiento original: marcos
     * transparentes para TODOS los grupos. Si se pasa, los grupos sin imagen
     * se omiten por completo (el PDF conserva sus rectangulos originales).
     */
    public function build($grupos, $imagenes = null)
    {
        $this->grupos = $grupos;
        $this->activas = [];
        $this->perPage = [];
        $this->splices = [];
        $this->rwObjs = [];
        $pages = $this->pdf->getPages();
        $this->pageNums = $this->pdf->getPageObjectNumbers();
        foreach ($pages as $i => $page) {
            $box = $this->pdf->pageBox($page);
            $this->heights[$i] = $box[3] - $box[1];
        }

        $maxNum = 0;
        foreach ($this->pdf->objectNumbers() as $n) {
            if ($n > $maxNum) {
                $maxNum = $n;
            }
        }
        $this->firstNew = $maxNum + 1;
        $nextNum = $this->firstNew;

        // 1) XObjects de imagen por grupo (reales si hay especificacion).
        foreach ($grupos as $g) {
            $letra = $g['letra'];
            $spec = null;
            if ($imagenes !== null) {
                $spec = isset($imagenes[$letra]) ? $imagenes[$letra] : null;
                if (!$spec) {
                    continue; // grupo sin imagen: no se toca
                }
            }
            $im = $nextNum++;
            $wPx = max(1, (int)$g['ancho_px']);
            $hPx = max(1, (int)$g['alto_px']);
            if ($spec && $spec['tipo'] === 'dct') {
                // JPEG directo (DCTDecode), opaco, sin SMask.
                $this->newObjs[$im] = $im . " 0 obj\r\n"
                    . "<< /Type /XObject /Subtype /Image /Width " . (int)$spec['w']
                    . " /Height " . (int)$spec['h']
                    . " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode "
                    . '/Length ' . strlen($spec['jpeg']) . " >>\r\n"
                    . "stream\r\n" . $spec['jpeg'] . "\r\nendstream\r\nendobj";
                $this->imgObj[$letra] = $im;
                $this->activas[$letra] = true;
                continue;
            }
            $sm = $nextNum++;
            $this->imgObj[$letra] = $im;
            if ($spec && $spec['tipo'] === 'raster') {
                $rgb = gzcompress($spec['rgb'], 6);
                $alpha = gzcompress($spec['alpha'], 6);
            } else {
                // Comportamiento original: imagen totalmente transparente.
                $rgb = gzcompress(str_repeat("\x00", $wPx * $hPx * 3), 6);
                $alpha = gzcompress(str_repeat("\x00", $wPx * $hPx), 6);
            }
            $this->newObjs[$im] = $im . " 0 obj\r\n"
                . "<< /Type /XObject /Subtype /Image /Width $wPx /Height $hPx "
                . "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode "
                . '/Length ' . strlen($rgb) . " /SMask $sm 0 R >>\r\n"
                . "stream\r\n" . $rgb . "\r\nendstream\r\nendobj";
            $this->newObjs[$sm] = $sm . " 0 obj\r\n"
                . "<< /Type /XObject /Subtype /Image /Width $wPx /Height $hPx "
                . "/ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode "
                . '/Length ' . strlen($alpha) . " >>\r\n"
                . "stream\r\n" . $alpha . "\r\nendstream\r\nendobj";
            $this->activas[$letra] = true;
        }

        // 2) Content streams.
        // z-order fiel al diseno: cada imagen se inserta (splice) en el content
        // stream ORIGINAL justo antes del operador de relleno de su placeholder.
        // Asi respeta los clips activos (W*, p.ej. placeholders enmarcados dentro
        // de circulos) y los ornamentos que se dibujan DESPUES (anillos) quedan
        // por encima de la foto. Cada draw va en su propio par q...Q (si no, el
        // cm CONCATENA el CTM y el 2do draw hereda la escala acumulada del 1ro).
        $this->agruparInstancias();
        $this->splicearStreams();
        $contentObj = [];
        foreach ($pages as $i => $page) {
            $ops = '';
            foreach ($this->perPage[$i] ?? [] as $d) {
                if (!empty($d['spliced'])) {
                    continue; // ya insertada en el stream original
                }
                $name = 'ECIm' . $this->imgObj[$d['img']];
                $ops .= "\r\nq\r\n" . $this->fmt($d['w']) . ' 0 0 ' . $this->fmt($d['h']) . ' '
                    . $this->fmt($d['x']) . ' ' . $this->fmt($d['y']) . " cm /$name Do\r\nQ";
            }
            $n = $nextNum++;
            $contentObj[$i] = $n;
            $this->newObjs[$n] = $n . " 0 obj\r\n"
                . '<< /Length ' . strlen($ops) . " >>\r\n"
                . "stream\r\n" . $ops . "\r\nendstream\r\nendobj";
        }

        // 3) Ensamblar: header + objetos originales (paginas re-serializadas) + nuevos.
        $nums = $this->pdf->objectNumbers();
        sort($nums, SORT_NUMERIC);
        $out = "%PDF-1.7\r\n%\xF0\xF1\xF2\xF3\r\n";
        $offsets = [];
        $pageNumByIdx = [];
        foreach ($this->pageNums as $i => $num) {
            $pageNumByIdx[$num] = $i;
        }
        foreach ($nums as $num) {
            if ($num <= 0 || $num >= $this->firstNew) {
                continue;
            }
            $offsets[$num] = strlen($out);
            if (isset($pageNumByIdx[$num])) {
                $out .= $this->paginaProcesada($pageNumByIdx[$num], $contentObj[$pageNumByIdx[$num]]) . "\r\n";
            } elseif (isset($this->rwObjs[$num])) {
                $out .= $this->rwObjs[$num] . "\r\n";
            } else {
                $raw = $this->pdf->rawObjectBytes($num);
                if ($raw === null) {
                    throw new \RuntimeException("Sin bytes para el objeto $num (PDF no soportado para overlay).");
                }
                $out .= $raw . "\r\n";
            }
        }
        foreach ($this->newObjs as $num => $txt) {
            $offsets[$num] = strlen($out);
            $out .= $txt . "\r\n";
        }
        $size = $this->firstNew + count($this->newObjs);
        return $this->finalizar($out, $size, $offsets);
    }

    /** Convierte las instancias de cada grupo a coordenadas PDF por pagina. */
    private function agruparInstancias()
    {
        foreach ($this->grupos as $g) {
            if (empty($this->activas[$g['letra']])) {
                continue; // grupo sin imagen: sin dibujos
            }
            foreach ($g['instancias'] as $inst) {
                $p = (int)$inst['page'];
                $bbox = $inst['bbox'];
                $H = $this->heights[$p];
                $w = $bbox[2] - $bbox[0];
                $h = $bbox[3] - $bbox[1];
                $entry = [
                    'x' => $bbox[0],
                    'y' => $H - $bbox[3],
                    'w' => $w,
                    'h' => $h,
                    'img' => $g['letra'],
                    'spliced' => false,
                ];
                $ops = $this->spliceOps($inst, $g['letra']);
                if ($ops !== null && isset($inst['stream'], $inst['offset'])) {
                    $stm = (int)$inst['stream'];
                    $this->splices[$p][$stm][] = [
                        'offset' => (int)$inst['offset'],
                        'ops' => $ops,
                    ];
                    $entry['spliced'] = true;
                }
                $this->perPage[$p][] = $entry;
            }
        }
    }

    /**
     * Numeros de objeto de los content streams de una pagina (en orden, solo los
     * que se pueden decodificar y no estan vacios, igual que Pdf::pageContents).
     */
    private function pageContentRefs($page)
    {
        $refs = [];
        if (!is_array($page) || !array_key_exists('Contents', $page)) {
            return $refs;
        }
        $cands = [];
        $raw = $page['Contents'];
        if (is_array($raw) && isset($raw['R'])) {
            $cands[] = $raw; // referencia unica
        } elseif (is_array($raw)) {
            foreach ($raw as $item) {
                if (is_array($item) && isset($item['R'])) {
                    $cands[] = $item;
                }
            }
        }
        foreach ($cands as $ref) {
            $num = (int)$ref['n'];
            $cont = $this->pdf->object($num);
            if (!$cont || !isset($cont['stream'])) {
                continue;
            }
            $dec = $this->pdf->decodeStreamData($cont['dict'], $cont['stream']);
            if (!is_string($dec) || $dec === '') {
                continue;
            }
            $refs[] = $num;
        }
        return $refs;
    }

    /**
     * Re-escribe los content streams originales insertando cada imagen en el
     * z-order de su placeholder (splice justo antes del operador de relleno).
     * Re-emite el objeto con el MISMO numero para no tocar /Contents.
     */
    private function splicearStreams()
    {
        if (!$this->splices) {
            return;
        }
        $spliceByNum = [];
        $pages = $this->pdf->getPages();
        foreach ($this->splices as $pageIdx => $byStream) {
            $page = isset($pages[$pageIdx]) ? $pages[$pageIdx] : null;
            $refs = $this->pageContentRefs($page);
            foreach ($byStream as $stmIdx => $items) {
                $num = isset($refs[$stmIdx]) ? $refs[$stmIdx] : null;
                if ($num === null) {
                    continue; // sin numero de objeto: queda el fallback
                }
                $cont = $this->pdf->object($num);
                if (!$cont || !isset($cont['stream'])) {
                    continue;
                }
                $dec = $this->pdf->decodeStreamData($cont['dict'], $cont['stream']);
                if (!is_string($dec)) {
                    continue;
                }
                if (!isset($spliceByNum[$num])) {
                    $spliceByNum[$num] = ['dec' => $dec, 'items' => []];
                }
                foreach ($items as $it) {
                    $spliceByNum[$num]['items'][] = $it;
                }
            }
        }
        foreach ($spliceByNum as $num => $sp) {
            $data = $sp['dec'];
            // Insertar de mayor a menor offset para no invalidar posiciones.
            usort($sp['items'], function ($a, $b) {
                return (int)$b['offset'] <=> (int)$a['offset'];
            });
            foreach ($sp['items'] as $it) {
                $off = (int)$it['offset'];
                if ($off < 0 || $off > strlen($data)) {
                    continue;
                }
                $data = substr($data, 0, $off) . $it['ops'] . substr($data, $off);
            }
            $comp = gzcompress($data, 6);
            $cont = $this->pdf->object($num);
            $dict = is_array($cont['dict']) ? $cont['dict'] : [];
            unset($dict['Length'], $dict['DecodeParms'], $dict['DP']);
            $dict['Filter'] = 'FlateDecode';
            $dict['Length'] = strlen($comp);
            $this->rwObjs[$num] = $num . " 0 obj\r\n" . $this->serDict($dict) . "\r\n"
                . "stream\r\n" . $comp . "\r\nendstream\r\nendobj";
        }
    }

    /**
     * Matriz cm para dibujar la imagen sobre DEV_bbox en el punto del stream
     * donde el CTM era CTM: M = inv(CTM) * D, con D el rect en device space.
     */
    private function spliceOps(array $inst, $letra)
    {
        if (!isset($inst['ctm'], $inst['dev_bbox'])) {
            return null;
        }
        $c = array_values($inst['ctm']);
        if (count($c) < 6) {
            return null;
        }
        $db = array_values($inst['dev_bbox']);
        if (count($db) < 4) {
            return null;
        }
        $w = (float)$db[2] - (float)$db[0];
        $h = (float)$db[3] - (float)$db[1];
        if ($w <= 0.001 || $h <= 0.001) {
            return null;
        }
        $det = $c[0] * $c[3] - $c[1] * $c[2];
        if (abs($det) < 1e-9) {
            return null;
        }
        $ai =  $c[3] / $det;
        $bi = -$c[1] / $det;
        $ci = -$c[2] / $det;
        $di =  $c[0] / $det;
        $ei = ($c[2] * $c[5] - $c[3] * $c[4]) / $det;
        $fi = ($c[1] * $c[4] - $c[0] * $c[5]) / $det;
        $m0 = $ai * $w;
        $m1 = $bi * $h;
        $m2 = $ci * $w;
        $m3 = $di * $h;
        $m4 = $ai * $db[0] + $bi * $db[1] + $ei;
        $m5 = $ci * $db[0] + $di * $db[1] + $fi;
        $name = 'ECIm' . $this->imgObj[$letra];
        return "\r\nq " . $this->fmt($m0) . ' ' . $this->fmt($m1) . ' ' . $this->fmt($m2) . ' '
            . $this->fmt($m3) . ' ' . $this->fmt($m4) . ' ' . $this->fmt($m5) . " cm /$name Do Q\r\n";
    }

    /** Serializa un dict PDF (para re-emitir objetos reescritos). */
    private function serDict(array $dict)
    {
        $s = '<<';
        foreach ($dict as $k => $v) {
            $s .= ' /' . $k . ' ' . $this->serValue($v);
        }
        return $s . ' >>';
    }

    /** Re-serializa el objeto de pagina con Contents ampliado y XObject nuevo. */
    private function paginaProcesada($pageIdx, $contentObjNum)
    {
        $page = $this->pdf->getPages()[$pageIdx];
        $num = $this->pageNums[$pageIdx];

        $refs = [];
        if (array_key_exists('Contents', $page)) {
            $c = $page['Contents'];
            if (is_array($c) && isset($c['R'])) {
                $refs[] = $c['n'] . ' 0 R';
            } elseif (is_array($c)) {
                foreach ($c as $item) {
                    if (is_array($item) && isset($item['R'])) {
                        $refs[] = $item['n'] . ' 0 R';
                    }
                }
            }
        }
        $refs[] = $contentObjNum . ' 0 R';

        $base = array_key_exists('Resources', $page) ? $this->pdf->deref($page['Resources']) : null;
        if (!is_array($base)) {
            $base = [];
        }
        $usedImgs = [];
        foreach ($this->perPage[$pageIdx] ?? [] as $d) {
            $usedImgs[$d['img']] = $this->imgObj[$d['img']];
        }
        $resStr = $this->serResourceDict($base, $usedImgs);

        $pairs = '';
        foreach ($page as $k => $v) {
            if ($k === 'Contents') {
                $pairs .= '/Contents [' . implode(' ', $refs) . '] ';
            } elseif ($k === 'Resources') {
                $pairs .= '/Resources ' . $resStr . ' ';
            } else {
                $pairs .= '/' . $k . ' ' . $this->serValue($v) . ' ';
            }
        }
        if (!array_key_exists('Resources', $page)) {
            $pairs .= '/Resources ' . $resStr . ' ';
        }
        return "$num 0 obj\r\n<< " . $pairs . ">>\r\nendobj";
    }

    /** Serializa el dict de Resources con /XObject incrementado. */
    private function serResourceDict($res, array $usedImgs)
    {
        $pairs = '';
        if (is_array($res) && isset($res['XObject'])) {
            foreach ($res as $k => $v) {
                if ($k === 'XObject') {
                    $xo = $this->pdf->deref($v);
                    $inner = '';
                    if (is_array($xo)) {
                        foreach ($xo as $xk => $xv) {
                            $inner .= '/' . $xk . ' ' . $this->serValue($xv);
                        }
                    }
                    foreach ($usedImgs as $letra => $objnum) {
                        $inner .= ' /ECIm' . $objnum . ' ' . $objnum . ' 0 R';
                    }
                    $pairs .= '/XObject << ' . $inner . ' >> ';
                } else {
                    $pairs .= '/' . $k . ' ' . $this->serValue($v) . ' ';
                }
            }
        } elseif (is_array($res)) {
            foreach ($res as $k => $v) {
                $pairs .= '/' . $k . ' ' . $this->serValue($v) . ' ';
            }
            if ($usedImgs) {
                $inner = '';
                foreach ($usedImgs as $letra => $objnum) {
                    $inner .= '/ECIm' . $objnum . ' ' . $objnum . ' 0 R';
                }
                $pairs .= '/XObject << ' . $inner . ' >> ';
            }
        } elseif ($usedImgs) {
            $inner = '';
            foreach ($usedImgs as $letra => $objnum) {
                $inner .= '/ECIm' . $objnum . ' ' . $objnum . ' 0 R';
            }
            $pairs .= '/XObject << ' . $inner . ' >> ';
        }
        return '<< ' . $pairs . '>>';
    }

    /** Serializa cualquier valor PDF. */
    private function serValue($v)
    {
        if (is_array($v)) {
            if (isset($v['R']) && isset($v['n'])) {
                return $v['n'] . ' ' . ($v['g'] ?? 0) . ' R';
            }
            if (array_is_list($v)) {
                $parts = [];
                foreach ($v as $item) {
                    $parts[] = $this->serValue($item);
                }
                return '[' . implode(' ', $parts) . ']';
            }
            $parts = [];
            foreach ($v as $k => $item) {
                $parts[] = '/' . $k . ' ' . $this->serValue($item);
            }
            return '<< ' . implode(' ', $parts) . ' >>';
        }
        if (is_bool($v)) {
            return $v ? 'true' : 'false';
        }
        if ($v === null) {
            return 'null';
        }
        if (is_int($v)) {
            return (string)$v;
        }
        if (is_float($v)) {
            return $this->fmt($v);
        }
        return '/' . $v;
    }

    /** Formato corto de numero (sin ceros finales). */
    private function fmt($v)
    {
        if ($v == 0.0) {
            return '0';
        }
        $s = rtrim(rtrim(sprintf('%.12F', (float)$v), '0'), '.');
        return $s === '' || $s === '-' ? '0' : $s;
    }

    /** Emite xref + trailer + startxref. */
    private function finalizar($out, $size, array $offsets)
    {
        $startxref = strlen($out);
        $xref = "xref\r\n0 $size\r\n0000000000 65535 f \r\n";
        for ($num = 1; $num < $size; $num++) {
            if (isset($offsets[$num])) {
                $xref .= sprintf('%010d 00000 n ', $offsets[$num]) . "\r\n";
            } else {
                $xref .= '0000000000 65535 f ' . "\r\n";
            }
        }
        $trailer = "trailer\r\n<< /Size $size /Root " .
            $this->serValue($this->pdf->trailer['Root']);
        if (isset($this->pdf->trailer['Info'])) {
            $trailer .= ' /Info ' . $this->serValue($this->pdf->trailer['Info']);
        }
        $trailer .= " >>\r\n";
        $out .= $xref . $trailer . "startxref\r\n$startxref\r\n%%EOF\r\n";
        return $out;
    }
}