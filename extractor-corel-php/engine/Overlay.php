<?php
/**
 * Overlay - Superpone los marcos (imagenes 100% transparentes) sobre los
 * placeholders de un PDF, equivalente a core/reemplazador.py + guardador.py.
 *
 * Estrategia (PHP puro, sin librerias externas):
 *  1. Parsea el PDF original con Pdf.
 *  2. Crea nuevos objetos: imagen XObject + SMask por grupo, y un content
 *     stream por pagina que dibuja las imagenes sobre cada bbox.
 *  3. Reescribe cada objeto de pagina re-serializando su dict con
 *     /Contents ampliado y /Resources con el /XObject nuevo.
 *  4. (Opcional) optimiza: el PDF se re-construye completo, con deduplicacion
 *     de objetos libres.
 *  5. Emite header + objetos + xref + trailer.
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

    public function __construct($pdfData)
    {
        $this->pdf = new Pdf($pdfData);
        $this->pdf->load();
    }

    /** Devuelve los bytes del PDF procesado. */
    public function build($grupos)
    {
        $this->grupos = $grupos;
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

        // 1) XObjects de imagen (RGB zeros) + SMask (alpha zeros) por grupo.
        foreach ($grupos as $g) {
            $im = $nextNum++;
            $sm = $nextNum++;
            $this->imgObj[$g['letra']] = $im;
            $wPx = max(1, (int)$g['ancho_px']);
            $hPx = max(1, (int)$g['alto_px']);
            $rgb = gzcompress(str_repeat("\x00", $wPx * $hPx * 3), 6);
            $alpha = gzcompress(str_repeat("\x00", $wPx * $hPx), 6);
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
        }

        // 2) Content stream por pagina.
        $this->agruparInstancias();
        $contentObj = [];
        foreach ($pages as $i => $page) {
            $ops = 'q';
            foreach ($this->perPage[$i] ?? [] as $d) {
                $name = 'ECIm' . $this->imgObj[$d['img']];
                $ops .= "\r\n" . $this->fmt($d['w']) . ' 0 0 ' . $this->fmt($d['h']) . ' '
                    . $this->fmt($d['x']) . ' ' . $this->fmt($d['y']) . " cm /$name Do";
            }
            $ops .= "\r\nQ";
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
            foreach ($g['instancias'] as $inst) {
                $p = $inst['page'];
                $bbox = $inst['bbox'];
                $H = $this->heights[$p];
                $w = $bbox[2] - $bbox[0];
                $h = $bbox[3] - $bbox[1];
                $this->perPage[$p][] = [
                    'x' => $bbox[0],
                    'y' => $H - $bbox[3],
                    'w' => $w,
                    'h' => $h,
                    'img' => $g['letra'],
                ];
            }
        }
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