<?php
/**
 * Detector - Deteccion de placeholders (rectangulos 100% transparentes) en un
 * PDF, con la MISMA logica que core/analizador.py:
 *
 *  - fill_opacity (ExtGState /ca) <= 0.001
 *  - forma rectangular (4 lineas cerradas o 're')
 *  - tamano minimo 10 x 5 pt
 *  - agrupacion por color RGB redondeado a 3 decimales
 *  - letras a, b, c... por orden de color; medidas en px (base 200 ppp)
 *  - bbox en coordenadas de pagina con origen ARRIBA-IZQUIERDA (como PyMuPDF)
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

/** Utilidades de redondeo identicas a Python. */
class Round
{
    /** round() de Python: mitad hacia el par. */
    public static function halfEven($v, $prec = 0)
    {
        $mult = $prec > 0 ? pow(10, $prec) : 1;
        $n = $v * $mult;
        $f = floor($n);
        $diff = $n - $f;
        if ($diff < 0.5) {
            $r = $f;
        } elseif ($diff > 0.5) {
            $r = $f + 1;
        } else {
            $r = (fmod($f, 2) == 0) ? $f : $f + 1;
        }
        return $r / $mult;
    }

    /** int(valor_pt * 200/72 + 0.5): conversion de puntos a px (base 200 ppp). */
    public static function ptToPx($pt)
    {
        return (int)($pt * (200 / 72.0) + 0.5);
    }

    /** rgb_a_hex de Python: #RRGGBB con round-half-even por canal. */
    public static function rgbHex(array $rgb)
    {
        $out = '#';
        foreach ($rgb as $c) {
            $v = (int)self::halfEven($c * 255);
            if ($v < 0) {
                $v = 0;
            }
            if ($v > 255) {
                $v = 255;
            }
            $out .= sprintf('%02X', $v);
        }
        return $out;
    }
}

/**
 * Parser de content stream con estado grafico (q/Q, gs/ca, rg/scn, cm,
 * paths, BT/ET, BDC/EMC, inline images, XObjects). Detecta candidatos.
 */
class ContentParser
{
    const TOL_GEO = 0.01;
    const TOL_OPACIDAD = 0.001;
    const MIN_W = 10.0;
    const MIN_H = 5.0;

    /** @var Pdf */
    private $pdf;
    private $pageIdx;
    private $height;
    private $resources;
    private $extgs;

    private $ctm = [1, 0, 0, 1, 0, 0];
    private $fillColor = [0.0, 0.0, 0.0];
    private $fillAlpha = 1.0;
    private $cs = 'rgb';
    private $stack = [];
    private $subs = [];
    private $cur = null;
    private $inText = false;
    private $instancias = [];

    public function __construct(Pdf $pdf, $pageIdx, $height, $resources, $extgs = [], $ctm = null)
    {
        $this->pdf = $pdf;
        $this->pageIdx = (int)$pageIdx;
        $this->height = (float)$height;
        $this->resources = $resources;
        $this->extgs = $extgs;
        if ($ctm !== null) {
            $this->ctm = $ctm;
        }
    }

    public function getInstancias()
    {
        return $this->instancias;
    }

    public function run($data)
    {
        $lex = new Lexer($data, 0);
        $args = [];
        while (!$lex->eof()) {
            $t = $lex->token();
            if ($t[0] === Lexer::EOF) {
                break;
            }
            if ($t[0] === 'num') {
                $args[] = $t[1];
                continue;
            }
            if ($t[0] === 'name') {
                $args[] = (string)$t[1];
                continue;
            }
            if ($t[0] !== 'op') {
                $this->handleNonOpToken($t, $lex, $args);
                continue;
            }
            $op = $t[1];
            if ($this->inText && $op !== 'ET') {
                $args = [];
                continue;
            }
            $this->dispatch($op, $args, $lex);
            $args = [];
        }
    }

    private function handleNonOpToken($t, $lex, &$args)
    {
        if ($t[0] === '<<' || $t[0] === '[' || $t[0] === '{') {
            $this->skipBalanced($lex, $t[0]);
        }
        $args = [];
    }

    private function skipBalanced($lex, $open)
    {
        $close = $open === '<<' ? '>>' : ($open === '[' ? ']' : '}');
        $depth = 1;
        while (!$lex->eof()) {
            $t = $lex->token();
            if ($t[0] === '<<' || $t[0] === '[' || $t[0] === '{') {
                $depth++;
            } elseif ($t[0] === $close) {
                $depth--;
                if ($depth === 0) {
                    return;
                }
            } elseif ($t[0] === Lexer::EOF) {
                return;
            }
        }
    }

    private function dispatch($op, $args, $lex)
    {
        switch ($op) {
            case 'q':
                $this->stack[] = [
                    'ctm' => $this->ctm,
                    'fillColor' => $this->fillColor,
                    'fillAlpha' => $this->fillAlpha,
                    'cs' => $this->cs,
                ];
                break;
            case 'Q':
                $s = array_pop($this->stack);
                if ($s) {
                    $this->ctm = $s['ctm'];
                    $this->fillColor = $s['fillColor'];
                    $this->fillAlpha = $s['fillAlpha'];
                    $this->cs = $s['cs'];
                }
                break;
            case 'cm':
                if (count($args) >= 6) {
                    $this->ctm = $this->multCtm($this->ctm, array_slice($args, 0, 6));
                }
                break;
            case 'gs':
                if (isset($args[0]) && is_string($args[0]) && isset($this->extgs[$args[0]])) {
                    $gs = $this->extgs[$args[0]];
                    if (isset($gs['ca']) && is_numeric($gs['ca'])) {
                        $this->fillAlpha = (float)$gs['ca'];
                    }
                }
                break;
            case 'rg':
                if (count($args) >= 3) {
                    $this->fillColor = [(float)$args[0], (float)$args[1], (float)$args[2]];
                    $this->cs = 'rgb';
                }
                break;
            case 'g':
                if (count($args) >= 1) {
                    $v = (float)$args[0];
                    $this->fillColor = [$v, $v, $v];
                    $this->cs = 'rgb';
                }
                break;
            case 'k':
                if (count($args) >= 4) {
                    $this->fillColor = $this->cmykToRgb(array_slice($args, 0, 4));
                    $this->cs = 'rgb';
                }
                break;
            case 'cs':
                if (isset($args[0]) && is_string($args[0])) {
                    $this->cs = $this->resolveColorSpace($args[0]);
                }
                break;
            case 'scn':
            case 'sc':
                $this->applyColor($args);
                break;
            case 're':
                $this->addRect($args);
                break;
            case 'm':
                $this->moveTo($args);
                break;
            case 'l':
                $this->lineTo($args);
                break;
            case 'c':
            case 'v':
            case 'y':
                $this->curveTo($args);
                break;
            case 'h':
                if ($this->cur) {
                    $this->cur['close'] = true;
                }
                break;
            case 'f':
            case 'F':
            case 'f*':
            case 'B':
            case 'B*':
            case 'b':
            case 'b*':
                $this->fill();
                break;
            case 'S':
            case 's':
            case 'n':
            case 'W':
            case 'W*':
                $this->clearPath();
                break;
            case 'BT':
                $this->inText = true;
                break;
            case 'ET':
                $this->inText = false;
                break;
            case 'BI':
                $this->skipInlineImage($lex);
                break;
            case 'BDC':
            case 'DP':
                $this->skipProps($lex);
                break;
            case 'Do':
                if (isset($args[0]) && is_string($args[0])) {
                    $this->doXObject($args[0]);
                }
                break;
            default:
                break;
        }
    }

    private function multCtm(array $a, array $b)
    {
        return [
            $a[0] * $b[0] + $a[2] * $b[1],
            $a[1] * $b[0] + $a[3] * $b[1],
            $a[0] * $b[2] + $a[2] * $b[3],
            $a[1] * $b[2] + $a[3] * $b[3],
            $a[0] * $b[4] + $a[2] * $b[5] + $a[4],
            $a[1] * $b[4] + $a[3] * $b[5] + $a[5],
        ];
    }

    private function txf($x, $y)
    {
        $c = $this->ctm;
        if ($c[0] === 1.0 && $c[1] === 0.0 && $c[2] === 0.0 && $c[3] === 1.0 &&
            $c[4] === 0.0 && $c[5] === 0.0) {
            return [$x, $y];
        }
        return [$c[0] * $x + $c[2] * $y + $c[4], $c[1] * $x + $c[3] * $y + $c[5]];
    }

    private function moveTo($args)
    {
        if (count($args) < 2) {
            return;
        }
        if ($this->cur) {
            $this->subs[] = $this->cur;
        }
        $p = $this->txf((float)$args[0], (float)$args[1]);
        $this->cur = ['pts' => [$p], 'segs' => [], 'close' => false];
    }

    private function lineTo($args)
    {
        if (count($args) < 2 || !$this->cur) {
            return;
        }
        $p = $this->txf((float)$args[0], (float)$args[1]);
        $this->cur['pts'][] = $p;
        $this->cur['segs'][] = ['l', $p];
    }

    private function curveTo($args)
    {
        if (count($args) < 2 || !$this->cur) {
            return;
        }
        $end = count($args) >= 6 ? 4 : 2;
        $p = $this->txf((float)$args[$end], (float)$args[$end + 1]);
        $this->cur['pts'][] = $p;
        $this->cur['segs'][] = ['c', $p];
    }

    private function addRect($args)
    {
        if (count($args) < 4) {
            return;
        }
        if ($this->cur) {
            $this->subs[] = $this->cur;
        }
        $x = (float)$args[0];
        $y = (float)$args[1];
        $w = (float)$args[2];
        $h = (float)$args[3];
        $p1 = $this->txf($x, $y);
        $p2 = $this->txf($x + $w, $y + $h);
        $this->subs[] = ['type' => 'rect', 'rect' => [$p1[0], $p1[1], $p2[0] - $p1[0], $p2[1] - $p1[1]]];
        $this->cur = null;
    }

    private function clearPath()
    {
        $this->subs = [];
        $this->cur = null;
    }

    private function fill()
    {
        $alpha = $this->fillAlpha;
        foreach ($this->subs as $sub) {
            $this->emitSub($sub, $alpha);
        }
        if ($this->cur) {
            $this->emitSub($this->cur, $alpha);
        }
        $this->subs = [];
        $this->cur = null;
    }

    private function emitSub($sub, $alpha)
    {
        if (isset($sub['type']) && $sub['type'] === 'rect') {
            $r = $sub['rect'];
            $this->maybeInstance([$r[0], $r[1], $r[0] + $r[2], $r[1] + $r[3]], $alpha);
            return;
        }
        $pts = $sub['pts'];
        if (count($pts) < 2) {
            return;
        }
        $lines = 0;
        $curve = false;
        foreach ($sub['segs'] as $s) {
            if ($s[0] === 'c') {
                $curve = true;
                break;
            }
            $lines++;
        }
        if ($sub['close']) {
            $lines++;
        }
        if ($curve || $lines !== 4) {
            return;
        }
        $minX = $pts[0][0];
        $minY = $pts[0][1];
        $maxX = $pts[0][0];
        $maxY = $pts[0][1];
        foreach ($pts as $p) {
            $minX = min($minX, $p[0]);
            $minY = min($minY, $p[1]);
            $maxX = max($maxX, $p[0]);
            $maxY = max($maxY, $p[1]);
        }
        if (!$this->esRectanguloDeLineas($pts, $sub['close'], $minX, $minY, $maxX, $maxY)) {
            return;
        }
        $this->maybeInstance([$minX, $minY, $maxX, $maxY], $alpha);
    }

    private function esRectanguloDeLineas($pts, $close, $minX, $minY, $maxX, $maxY)
    {
        $tol = self::TOL_GEO;
        $usedY0 = false;
        $usedY1 = false;
        $usedX0 = false;
        $usedX1 = false;
        $n = count($pts);
        $pairs = [];
        for ($i = 0; $i < $n - 1; $i++) {
            $pairs[] = [$pts[$i], $pts[$i + 1]];
        }
        if ($close) {
            $pairs[] = [$pts[$n - 1], $pts[0]];
        }
        foreach ($pairs as $pair) {
            $p = $pair[0];
            $q = $pair[1];
            $dx = abs($p[0] - $q[0]);
            $dy = abs($p[1] - $q[1]);
            if ($dy <= $tol && $dx > $tol) {
                if (abs(min($p[0], $q[0]) - $minX) > $tol || abs(max($p[0], $q[0]) - $maxX) > $tol) {
                    return false;
                }
                if (abs($p[1] - $minY) <= $tol) {
                    $usedY0 = true;
                } elseif (abs($p[1] - $maxY) <= $tol) {
                    $usedY1 = true;
                } else {
                    return false;
                }
            } elseif ($dx <= $tol && $dy > $tol) {
                if (abs(min($p[1], $q[1]) - $minY) > $tol || abs(max($p[1], $q[1]) - $maxY) > $tol) {
                    return false;
                }
                if (abs($p[0] - $minX) <= $tol) {
                    $usedX0 = true;
                } elseif (abs($p[0] - $maxX) <= $tol) {
                    $usedX1 = true;
                } else {
                    return false;
                }
            } else {
                return false;
            }
        }
        return $usedY0 && $usedY1 && $usedX0 && $usedX1;
    }

    private function maybeInstance($bbox, $alpha)
    {
        $w = $bbox[2] - $bbox[0];
        $h = $bbox[3] - $bbox[1];
        if ($w < self::MIN_W || $h < self::MIN_H) {
            return;
        }
        if ($alpha > self::TOL_OPACIDAD) {
            return;
        }
        $color = [
            Round::halfEven($this->fillColor[0], 3),
            Round::halfEven($this->fillColor[1], 3),
            Round::halfEven($this->fillColor[2], 3),
        ];
        $this->instancias[] = [
            'page' => $this->pageIdx,
            'bbox' => [
                (float)$bbox[0],
                $this->height - (float)$bbox[3],
                (float)$bbox[2],
                $this->height - (float)$bbox[1],
            ],
            'w' => $w,
            'h' => $h,
            'color' => $color,
            'color_hex' => Round::rgbHex($this->fillColor),
        ];
    }

    private function cmykToRgb(array $cmyk)
    {
        $c = (float)$cmyk[0];
        $m = (float)$cmyk[1];
        $y = (float)$cmyk[2];
        $k = count($cmyk) > 3 ? (float)$cmyk[3] : 0.0;
        return [(1 - $c) * (1 - $k), (1 - $m) * (1 - $k), (1 - $y) * (1 - $k)];
    }

    private function applyColor($args)
    {
        $n = count($args);
        if ($this->cs === 'gray') {
            $v = $n > 0 ? (float)$args[0] : 0.0;
            $this->fillColor = [$v, $v, $v];
            return;
        }
        if ($this->cs === 'cmyk') {
            if ($n >= 4) {
                $this->fillColor = $this->cmykToRgb(array_slice($args, 0, 4));
            }
            return;
        }
        if ($this->cs === 'rgb') {
            if ($n >= 3) {
                $this->fillColor = [(float)$args[0], (float)$args[1], (float)$args[2]];
            }
            return;
        }
        if ($n === 1) {
            $v = (float)$args[0];
            $this->fillColor = [$v, $v, $v];
        } elseif ($n >= 4) {
            $this->fillColor = $this->cmykToRgb(array_slice($args, 0, 4));
        } elseif ($n >= 3) {
            $this->fillColor = [(float)$args[0], (float)$args[1], (float)$args[2]];
        }
    }

    private function resolveColorSpace($name)
    {
        if ($name === 'DeviceRGB' || $name === 'CalRGB') {
            return 'rgb';
        }
        if ($name === 'DeviceGray' || $name === 'CalGray') {
            return 'gray';
        }
        if ($name === 'DeviceCMYK') {
            return 'cmyk';
        }
        if ($name === 'Pattern' || $name === 'Indexed' || $name === 'I') {
            return 'unknown';
        }
        $csMap = null;
        if (is_array($this->resources) && isset($this->resources['ColorSpace'])) {
            $csMap = $this->pdf->deref($this->resources['ColorSpace']);
        }
        if (is_array($csMap) && isset($csMap[$name])) {
            $v = $this->pdf->deref($csMap[$name]);
            if (is_string($v)) {
                return $this->resolveColorSpace($v);
            }
            if (is_array($v) && array_is_list($v) && isset($v[0]) && is_string($v[0])) {
                return $this->resolveColorSpace($v[0]);
            }
        }
        return 'rgb';
    }

    private function skipProps($lex)
    {
        $t = $lex->token();
        if ($t[0] === '<<' || $t[0] === '[' || $t[0] === '{') {
            $this->skipBalanced($lex, $t[0]);
        }
    }

    private function skipInlineImage($lex)
    {
        while (!$lex->eof()) {
            $t = $lex->token();
            if ($t[0] === 'op' && $t[1] === 'ID') {
                break;
            }
        }
        $data = $lex->s;
        $pos = $lex->pos();
        for (;;) {
            $idx = strpos($data, 'EI', $pos);
            if ($idx === false) {
                return;
            }
            if ($idx > 0 && (ctype_space($data[$idx - 1]) || ord($data[$idx - 1]) === 0)) {
                $lex->seek($idx + 2);
                return;
            }
            $pos = $idx + 2;
        }
    }

    private function doXObject($name)
    {
        if (!is_array($this->resources)) {
            return;
        }
        $xobjs = null;
        if (isset($this->resources['XObject'])) {
            $xobjs = $this->pdf->deref($this->resources['XObject']);
        }
        if (!is_array($xobjs) || !isset($xobjs[$name])) {
            return;
        }
        $cont = $this->pdf->deref($xobjs[$name]);
        if (!is_array($cont) || !isset($cont['stream'])) {
            return;
        }
        $dict = $cont['dict'];
        $subtype = $dict['Subtype'] ?? '';
        if ($subtype !== 'Form') {
            return;
        }
        $data = $this->pdf->decodeStreamData($dict, $cont['data']);
        $resForm = isset($dict['Resources']) ? $this->pdf->deref($dict['Resources']) : $this->resources;
        $matrix = isset($dict['Matrix']) ? $this->pdf->deref($dict['Matrix']) : null;
        if (is_array($matrix) && count($matrix) >= 6) {
            $ctm = $this->multCtm($this->ctm, array_map('floatval', array_slice($matrix, 0, 6)));
        } else {
            $ctm = $this->ctm;
        }
        $sub = new ContentParser($this->pdf, $this->pageIdx, $this->height, $resForm, $this->extgs, $ctm);
        $sub->fillColor = $this->fillColor;
        $sub->fillAlpha = $this->fillAlpha;
        $sub->cs = $this->cs;
        $sub->run($data);
        foreach ($sub->instancias as $inst) {
            $this->instancias[] = $inst;
        }
    }
}

/**
 * API publica de deteccion, equivalente a analizador.analizar_pdf().
 */
class Detector
{
    /** @var Pdf */
    private $pdf;

    public function __construct(Pdf $pdf)
    {
        $this->pdf = $pdf;
    }

    /**
     * Devuelve ['total_paginas'=>int, 'grupos'=>[...]] con el mismo
     * formato que el analizador Python.
     */
    public function analizarPdf()
    {
        $pages = $this->pdf->getPages();
        $instancias = [];
        foreach ($pages as $i => $page) {
            $box = $this->pdf->pageBox($page);
            $height = $box[3] - $box[1];
            $resources = $this->pdf->pageKey($page, 'Resources');
            $extgs = $this->extGStateMap($resources);
            foreach ($this->pdf->pageContents($page) as $data) {
                $cp = new ContentParser($this->pdf, $i, $height, $resources, $extgs);
                $cp->run($data);
                foreach ($cp->getInstancias() as $inst) {
                    $instancias[] = $inst;
                }
            }
        }
        return [
            'total_paginas' => count($pages),
            'grupos' => $this->agruparPorColor($instancias),
        ];
    }

    /** Extrae el mapa de ExtGState (ca/CA) de los recursos de la pagina. */
    public function extGStateMap($resources)
    {
        $out = [];
        if (!is_array($resources) || !isset($resources['ExtGState'])) {
            return $out;
        }
        $map = $this->pdf->deref($resources['ExtGState']);
        if (!is_array($map)) {
            return $out;
        }
        foreach ($map as $name => $ref) {
            $v = $this->pdf->deref($ref);
            if (is_array($v)) {
                $row = [];
                foreach (['ca', 'CA'] as $k) {
                    if (isset($v[$k])) {
                        $val = $this->pdf->deref($v[$k]);
                        if (is_numeric($val)) {
                            $row[$k] = (float)$val;
                        }
                    }
                }
                $out[$name] = $row;
            }
        }
        return $out;
    }

    /** Agrupa por color redondeado y genera el JSON del pipeline. */
    private function agruparPorColor($instancias)
    {
        $por = [];
        foreach ($instancias as $i) {
            $key = implode(',', array_map('strval', $i['color']));
            if (!isset($por[$key])) {
                $por[$key] = [];
            }
            $por[$key][] = $i;
        }
        $items = [];
        foreach ($por as $ls) {
            $mayor = null;
            foreach ($ls as $in) {
                if ($mayor === null || $in['w'] * $in['h'] > $mayor['w'] * $mayor['h']) {
                    $mayor = $in;
                }
            }
            $items[] = ['color' => $ls[0]['color'], 'mayor' => $mayor, 'ls' => $ls];
        }
        // Orden lexicografico por tupla RGB (determinista, como Python).
        usort($items, function ($a, $b) {
            for ($k = 0; $k < 3; $k++) {
                if ($a['color'][$k] < $b['color'][$k]) {
                    return -1;
                }
                if ($a['color'][$k] > $b['color'][$k]) {
                    return 1;
                }
            }
            return 0;
        });
        $grupos = [];
        foreach ($items as $idx => $it) {
            $paginas = [];
            foreach ($it['ls'] as $in) {
                if (!in_array($in['page'], $paginas, true)) {
                    $paginas[] = $in['page'];
                }
            }
            sort($paginas);
            $insts = [];
            foreach ($it['ls'] as $in) {
                $insts[] = [
                    'page' => $in['page'],
                    'bbox' => array_map('floatval', $in['bbox']),
                    'w' => Round::halfEven($in['w'], 2),
                    'h' => Round::halfEven($in['h'], 2),
                ];
            }
            $grupos[] = [
                'letra' => self::letraGrupo($idx),
                'color' => Round::rgbHex($it['color']),
                'color_rgb' => $it['color'],
                'ancho_px' => Round::ptToPx($it['mayor']['w']),
                'alto_px' => Round::ptToPx($it['mayor']['h']),
                'ancho_pt' => Round::halfEven($it['mayor']['w'], 2),
                'alto_pt' => Round::halfEven($it['mayor']['h'], 2),
                'num_instancias' => count($it['ls']),
                'paginas' => $paginas,
                'instancias' => $insts,
            ];
        }
        return $grupos;
    }

    /** Equivalente a letra_grupo(): 0=>a, 25=>z, 26=>aa... */
    public static function letraGrupo($indice)
    {
        if ($indice < 26) {
            return chr(97 + $indice);
        }
        return chr(97 + intdiv($indice, 26) - 1) . chr(97 + $indice % 26);
    }
}