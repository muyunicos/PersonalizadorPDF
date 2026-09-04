<?php
/**
 * Pdf - Parser minimo de PDF para el motor PHP del Extractor Corel.
 *
 * Soporta tablas xref clasicas, xref streams, ObjStm, streams FlateDecode
 * con predictor PNG/TIFF, arbol de paginas con herencia de /Resources.
 * Todo el analisis es de solo lectura.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class PdfParseException extends \Exception
{
}

/**
 * Lexer de tokens PDF: numeros, nombres, strings, hexstrings, operadores.
 */
class Lexer
{
    const EOF = 'eof';

    public $s;
    public $p;

    public function __construct($s, $p = 0)
    {
        $this->s = (string)$s;
        $this->p = (int)$p;
    }

    public function pos()
    {
        return $this->p;
    }

    public function seek($p)
    {
        $this->p = (int)$p;
    }

    public function eof()
    {
        return $this->p >= strlen($this->s);
    }

    private function isDelim($c)
    {
        return $c === '(' || $c === ')' || $c === '<' || $c === '>' ||
            $c === '[' || $c === ']' || $c === '{' || $c === '}' ||
            $c === '/' || $c === '%';
    }

    /** Salta espacios, saltos de linea y comentarios '%'. */
    public function skipWs()
    {
        $n = strlen($this->s);
        for (;;) {
            while ($this->p < $n) {
                $c = $this->s[$this->p];
                if ($c === ' ' || $c === "\t" || $c === "\r" || $c === "\n" ||
                    $c === "\f" || $c === "\x0B") {
                    $this->p++;
                } else {
                    break;
                }
            }
            if ($this->p < $n && $this->s[$this->p] === '%') {
                while ($this->p < $n && $this->s[$this->p] !== "\n" && $this->s[$this->p] !== "\r") {
                    $this->p++;
                }
                continue;
            }
            break;
        }
    }

    /**
     * Siguiente token: ['num'|'name'|'str'|'hex'|'op'|'<<'|'>>'|'['|']'|'{'|'}'|'eof', valor, pos].
     */
    public function token()
    {
        $this->skipWs();
        if ($this->eof()) {
            return [self::EOF, null, $this->p];
        }
        $c = $this->s[$this->p];
        $n = strlen($this->s);

        if ($c === '+' || $c === '-' || $c === '.' || ctype_digit($c)) {
            $m = preg_match('/[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/A', $this->s, $mm, 0, $this->p);
            if ($m) {
                $this->p += strlen($mm[0]);
                return ['num', (float)$mm[0], $this->p];
            }
        }

        if ($c === '/') {
            $this->p++;
            $name = '';
            while ($this->p < $n && !$this->isDelim($this->s[$this->p]) &&
                !ctype_space($this->s[$this->p])) {
                if ($this->s[$this->p] === '#' && $this->p + 2 < $n &&
                    ctype_xdigit($this->s[$this->p + 1]) && ctype_xdigit($this->s[$this->p + 2])) {
                    $name .= chr(hexdec(substr($this->s, $this->p + 1, 2)));
                    $this->p += 3;
                } else {
                    $name .= $this->s[$this->p];
                    $this->p++;
                }
            }
            return ['name', $name, $this->p];
        }

        if ($c === '(') {
            return ['str', $this->readLiteralString(), $this->p];
        }

        if ($c === '<') {
            if ($this->p + 1 < $n && $this->s[$this->p + 1] === '<') {
                $this->p += 2;
                return ['<<', '<<', $this->p];
            }
            return ['hex', $this->readHexString(), $this->p];
        }

        if ($c === '>') {
            $this->p++;
            if ($this->p < $n && $this->s[$this->p] === '>') {
                $this->p++;
            }
            return ['>>', '>>', $this->p];
        }
        if ($c === '[') {
            $this->p++;
            return ['[', '[', $this->p];
        }
        if ($c === ']') {
            $this->p++;
            return [']', ']', $this->p];
        }
        if ($c === '{') {
            $this->p++;
            return ['{', '{', $this->p];
        }
        if ($c === '}') {
            $this->p++;
            return ['}', '}', $this->p];
        }

        $start = $this->p;
        while ($this->p < $n && !$this->isDelim($this->s[$this->p]) &&
            !ctype_space($this->s[$this->p])) {
            $this->p++;
        }
        return ['op', substr($this->s, $start, $this->p - $start), $this->p];
    }

    private function readLiteralString()
    {
        $n = strlen($this->s);
        $this->p++;
        $out = '';
        $depth = 1;
        while ($this->p < $n && $depth > 0) {
            $c = $this->s[$this->p];
            if ($c === '\\') {
                $this->p++;
                if ($this->p >= $n) {
                    break;
                }
                $e = $this->s[$this->p];
                if ($e === 'n') {
                    $out .= "\n";
                } elseif ($e === 'r') {
                    $out .= "\r";
                } elseif ($e === 't') {
                    $out .= "\t";
                } elseif ($e === 'b') {
                    $out .= "\x08";
                } elseif ($e === 'f') {
                    $out .= "\x0C";
                } elseif ($e === '(' || $e === ')' || $e === '\\') {
                    $out .= $e;
                } elseif ($e >= '0' && $e <= '7') {
                    $oct = $e;
                    $this->p++;
                    for ($i = 0; $i < 2 && $this->p < $n; $i++) {
                        $o = $this->s[$this->p];
                        if ($o >= '0' && $o <= '7') {
                            $oct .= $o;
                            $this->p++;
                        } else {
                            break;
                        }
                    }
                    $out .= chr(octdec($oct) & 0xFF);
                    continue;
                } else {
                    $out .= '\\' . $e;
                }
                $this->p++;
                continue;
            }
            if ($c === '(') {
                $depth++;
            } elseif ($c === ')') {
                $depth--;
                if ($depth === 0) {
                    $this->p++;
                    break;
                }
            }
            $out .= $c;
            $this->p++;
        }
        return $out;
    }

    private function readHexString()
    {
        $n = strlen($this->s);
        $this->p++;
        $hex = '';
        while ($this->p < $n && $this->s[$this->p] !== '>') {
            $c = $this->s[$this->p];
            if (ctype_xdigit($c)) {
                $hex .= $c;
            }
            $this->p++;
        }
        if ($this->p < $n) {
            $this->p++;
        }
        if (strlen($hex) % 2 === 1) {
            $hex .= '0';
        }
        return pack('H*', $hex);
    }
}
/**
 * Pdf: parseo de la estructura de un PDF.
 */
class Pdf
{
    public $data;
    public $dbg = false;
    public $trailer = [];
    private $objmap = [];      // num => ['t'=>'off','off'=>x] | ['t'=>'stm','stm'=>s,'idx'=>i] | ['t'=>'free']
    private $cache = [];       // num => contenedor: ['value'=>..] | ['dict'=>..,'stream'=>..]
    private $objstmCache = []; // num de ObjStm => [idx => contenedor]

    public function __construct($data)
    {
        $this->data = (string)$data;
    }

    public function load()
    {
        if (!preg_match('/startxref\s+(\d+)/s', $this->data, $m)) {
            throw new PdfParseException('startxref no encontrado');
        }
        $seen = [];
        $this->parseXref((int)$m[1], $seen);
        if (!isset($this->trailer['Root'])) {
            throw new PdfParseException('trailer sin /Root');
        }
    }

    private function parseXref($offset, &$seen)
    {
        if (isset($seen[$offset])) {
            return;
        }
        $seen[$offset] = true;
        $head = substr($this->data, $offset, 20);
        if (preg_match('/^\s*(xref)/i', $head)) {
            $this->parseClassicXref($offset, $seen);
        } else {
            $this->parseXrefStream($offset, $seen);
        }
    }

    private function parseClassicXref($offset, &$seen)
    {
        $lex = new Lexer($this->data, $offset);
        $lex->skipWs();
        // token 'xref'
        $lex->token();
        for (;;) {
            $save = $lex->pos();
            $a = $lex->token();
            $b = $lex->token();
            if ($a[0] !== 'num' || $b[0] !== 'num') {
                $lex->seek($save);
                break;
            }
            $start = (int)$a[1];
            $count = (int)$b[1];
            for ($i = 0; $i < $count; $i++) {
                $x = $lex->token();
                $y = $lex->token();
                $z = $lex->token();
                if ($x[0] !== 'num' || $y[0] !== 'num' || $z[0] !== 'op') {
                    break 2;
                }
                if ($z[1] === 'n') {
                    $this->objmap[$start + $i] = ['t' => 'off', 'off' => (int)$x[1]];
                } else {
                    $this->objmap[$start + $i] = ['t' => 'free'];
                }
            }
        }
        // trailer
        for (;;) {
            $t = $lex->token();
            if ($t[0] === Lexer::EOF) {
                break;
            }
            if ($t[0] === 'op' && $t[1] === 'trailer') {
                $dict = $this->parseValue($lex);
                if (is_array($dict)) {
                    foreach ($dict as $k => $v) {
                        $this->trailer[$k] = $v;
                    }
                    if (isset($dict['XRefStm'])) {
                        $this->parseXref((int)$this->deref($dict['XRefStm']), $seen);
                    }
                    if (isset($dict['Prev'])) {
                        $this->parseXref((int)$this->deref($dict['Prev']), $seen);
                    }
                }
                break;
            }
        }
    }

    private function parseXrefStream($offset, &$seen)
    {
        $obj = $this->readObjectAt($offset);
        if (!is_array($obj) || !isset($obj['stream'])) {
            throw new PdfParseException('startxref no apunta a una xref stream');
        }
        $dict = $obj['dict'];
        $raw = $obj['stream'];
        $data = $this->decodeStreamData($dict, $raw);
        $w = array_key_exists('W', $dict) ? array_map('intval', $this->deref($dict['W'])) : [1, 4, 2];
        $idx = array_key_exists('Index', $dict) ? array_map('intval', $this->deref($dict['Index'])) : [];
        if (empty($idx)) {
            $idx = [0, (int)($dict['Size'] ?? 0)];
        }
        $row = ($w[0] ?? 1) + ($w[1] ?? 4) + ($w[2] ?? 2);
        for ($k = 0; $k + 1 < count($idx); $k += 2) {
            $start = $idx[$k];
            $count = $idx[$k + 1];
            for ($i = 0; $i < $count; $i++) {
                $chunk = substr($data, ($i * $row), $row);
                if (strlen($chunk) < $row) {
                    break;
                }
                $fld = $this->xfld($chunk, $w);
                $num = $start + $i;
                if ($fld[0] === 1) {
                    $this->objmap[$num] = ['t' => 'off', 'off' => $fld[1]];
                } elseif ($fld[0] === 2) {
                    $this->objmap[$num] = ['t' => 'stm', 'stm' => $fld[1], 'idx' => $fld[2]];
                } else {
                    $this->objmap[$num] = ['t' => 'free'];
                }
            }
        }
        foreach ($dict as $k => $v) {
            $this->trailer[$k] = $v;
        }
        if (isset($dict['XRefStm'])) {
            $this->parseXref((int)$this->deref($dict['XRefStm']), $seen);
        }
        if (isset($dict['Prev'])) {
            $this->parseXref((int)$this->deref($dict['Prev']), $seen);
        }
    }

    private function xfld($chunk, $w)
    {
        $out = [];
        $p = 0;
        foreach ($w as $len) {
            $len = (int)$len;
            $v = 0;
            for ($j = 0; $j < $len; $j++) {
                $v = ($v << 8) | ord($chunk[$p + $j]);
            }
            $out[] = $v;
            $p += $len;
        }
        return $out;
    }

    /**
     * Lee el objeto en `offset` y devuelve contenedor:
     *   ['obj'=>n,'gen'=>g,'value'=>...]  o  ['obj'=>n,'gen'=>g,'dict'=>...,'stream'=>raw]
     */
    public function readObjectAt($offset)
    {
        $lex = new Lexer($this->data, $offset);
        $lex->skipWs();
        $a = $lex->token();
        $b = $lex->token();
        $c = $lex->token();
        if ($a[0] !== 'num' || $b[0] !== 'num' || $c[0] !== 'op' || $c[1] !== 'obj') {
            throw new PdfParseException("objeto invalido en offset $offset");
        }
        $objnum = (int)$a[1];
        $gen = (int)$b[1];
        $value = $this->parseValue($lex);
        // Si el valor es un dict y viene 'stream', leer los bytes crudos.
        if (is_array($value) && !array_is_list($value)) {
            $save = $lex->pos();
            $st = $lex->token();
            if ($st[0] === 'op' && $st[1] === 'stream') {
                $lex->skipWs();
                // Descarta el EOL que sigue a 'stream'
                if (!$lex->eof() && ($this->data[$lex->pos()] === "\r" || $this->data[$lex->pos()] === "\n")) {
                    $lex->seek($lex->pos() + 1);
                    if (!$lex->eof() && $this->data[$lex->pos() - 1] === "\r" &&
                        $this->data[$lex->pos()] === "\n") {
                        $lex->seek($lex->pos() + 1);
                    }
                }
                $start = $lex->pos();
                $len = null;
                if (array_key_exists('Length', $value)) {
                    $lv = $this->deref($value['Length']);
                    if (is_numeric($lv)) {
                        $len = (int)$lv;
                    }
                }
                if ($len !== null) {
                    $raw = substr($this->data, $start, $len);
                    $lex->seek($start + $len);
                } else {
                    $end = strpos($this->data, 'endstream', $start);
                    if ($end === false) {
                        throw new PdfParseException("stream sin endstream en objeto $objnum");
                    }
                    $raw = substr($this->data, $start, $end - $start);
                    $lex->seek($end);
                }
                return ['obj' => $objnum, 'gen' => $gen, 'dict' => $value, 'stream' => $raw];
            }
            $lex->seek($save);
        }
        return ['obj' => $objnum, 'gen' => $gen, 'value' => $value];
    }

    /**
     * Parsea un valor PDF desde la posicion actual del lexer.
     * Las referencias indirectas se devuelven como ['R'=>true,'n'=>num,'g'=>gen].
     */
    public function parseValue($lex)
    {
        $save = $lex->pos();
        $t = $lex->token();
        switch ($t[0]) {
            case Lexer::EOF:
                return null;
            case 'num':
                // Deteccion de referencia indirecta: num num R
                $pos2 = $lex->pos();
                $t2 = $lex->token();
                if ($t2[0] === 'num') {
                    $pos3 = $lex->pos();
                    $t3 = $lex->token();
                    if ($t3[0] === 'op' && $t3[1] === 'R') {
                        return ['R' => true, 'n' => (int)$t[1], 'g' => (int)$t2[1]];
                    }
                }
                $lex->seek($pos2);
                return $t[1];
            case 'name':
                return $t[1];
            case 'str':
            case 'hex':
                return $t[1];
            case 'op':
                if ($t[1] === 'true') {
                    return true;
                }
                if ($t[1] === 'false') {
                    return false;
                }
                if ($t[1] === 'null') {
                    return null;
                }
                if ($t[1] === '[mojado]') {
                    return null;
                }
                return null;
            case '<<':
                $dict = [];
                for (;;) {
                    $k = $lex->token();
                    if ($k[0] === Lexer::EOF || ($k[0] === 'op' && $k[1] === '>>')) {
                        break;
                    }
                    if ($k[0] === '>>') {
                        break;
                    }
                    if ($k[0] !== 'name') {
                        $lex->seek($k[2]);
                        if ($k[0] === 'op' && $k[1] === '>>') {
                            break;
                        }
                        continue;
                    }
                    $v = $this->parseValue($lex);
                    $dict[$k[1]] = $v;
                }
                return $dict;
            case '>>':
                return null;
            case '[':
                $list = [];
                for (;;) {
                    $save2 = $lex->pos();
                    $t2 = $lex->token();
                    if ($t2[0] === Lexer::EOF || $t2[0] === ']') {
                        break;
                    }
                    $lex->seek($save2);
                    $list[] = $this->parseValue($lex);
                }
                return $list;
            case ']':
                return null;
            case '{': // procedimiento PostScript (en fuentes); se ignora como raw
                $depth = 1;
                $raw = '{';
                for (;;) {
                    $tt = $lex->token();
                    if ($tt[0] === Lexer::EOF) {
                        break;
                    }
                    if ($tt[1] === '{') {
                        $depth++;
                    } elseif ($tt[1] === '}') {
                        $depth--;
                        if ($depth === 0) {
                            break;
                        }
                    }
                    $raw .= ' ' . $tt[1];
                }
                return $raw . '}';
            default:
                return null;
        }
    }

    /** Devuelve el contenedor del objeto num (offset/objstm/cache). */
    public function object($num)
    {
        $num = (int)$num;
        if (isset($this->cache[$num])) {
            return $this->cache[$num];
        }
        if (!isset($this->objmap[$num])) {
            return null;
        }
        $info = $this->objmap[$num];
        if ($info['t'] === 'off') {
            $cont = $this->readObjectAt($info['off']);
        } elseif ($info['t'] === 'stm') {
            $cont = $this->objectFromObjStm($info['stm'], $info['idx']);
        } else {
            return null;
        }
        if (!$cont) {
            return null;
        }
        $this->cache[$num] = $cont;
        return $cont;
    }

    private function objectFromObjStm($stmNum, $idx)
    {
        if (!isset($this->objstmCache[$stmNum])) {
            $cont = $this->object($stmNum);
            if (!$cont || !isset($cont['stream'])) {
                $this->objstmCache[$stmNum] = [];
                return null;
            }
            $dict = $cont['dict'];
            $raw = $this->decodeStreamData($dict, $cont['stream']);
            $n = (int)($dict['N'] ?? 0);
            $first = (int)($dict['First'] ?? 0);
            $lex = new Lexer($raw, 0);
            $pairs = [];
            for ($i = 0; $i < $n; $i++) {
                $a = $lex->token();
                $b = $lex->token();
                if ($a[0] !== 'num' || $b[0] !== 'num') {
                    break;
                }
                $pairs[] = [(int)$a[1], (int)$b[1]];
            }
            $map = [];
            foreach ($pairs as $pp) {
                $ob = new Lexer($raw, $first + $pp[1]);
                $map[$pp[0]] = ['value' => $this->parseValue($ob)];
            }
            $this->objstmCache[$stmNum] = $map;
        }
        return $this->objstmCache[$stmNum][$idx] ?? null;
    }

    /** Resuelve una referencia (o estructura) al nivel superior; no recorre dicts. */
    public function deref($v, $depth = 0)
    {
        if ($depth > 40) {
            return $v;
        }
        if (is_array($v) && isset($v['R']) && isset($v['n'])) {
            $cont = $this->object($v['n']);
            if (!$cont) {
                return $v;
            }
            if (isset($cont['stream'])) {
                return ['stream' => true, 'dict' => $cont['dict'], 'data' => $cont['stream']];
            }
            return $this->deref($cont['value'], $depth + 1);
        }
        return $v;
    }

    /** Devuelve el stream decodificado (contenedor stream de deref()). */
    public function streamData($container)
    {
        if (!is_array($container) || !isset($container['stream'])) {
            return null;
        }
        return $this->decodeStreamData($container['dict'], $container['data']);
    }

    /** Aplica filtros de stream (/FlateDecode, ASCIIHexDecode, ...) y predictor. */
    public function decodeStreamData($dict, $raw)
    {
        $filters = null;
        if (isset($dict['Filter'])) {
            $f = $this->deref($dict['Filter']);
            if (is_array($f)) {
                $filters = array_values($f);
            } elseif (is_string($f)) {
                $filters = [$f];
            }
        }
        $parms = isset($dict['DecodeParms']) ? $this->deref($dict['DecodeParms']) : null;
        if (is_array($parms) && !array_is_list($parms)) {
            $parms = [$parms];
        }
        $data = $raw;
        $idx = 0;
        foreach ((array)$filters as $flt) {
            $p = is_array($parms) && isset($parms[$idx]) ? $parms[$idx] : null;
            if ($flt === 'FlateDecode' || $flt === 'Fl') {
                $dec = @gzuncompress($data);
                if ($dec === false) {
                    $dec = @gzinflate($data);
                }
                if ($dec !== false) {
                    $data = $dec;
                }
                if (is_array($p) && ($p['Predictor'] ?? 1) > 1) {
                    $data = $this->applyPredictor($data, $p);
                }
            } elseif ($flt === 'ASCIIHexDecode' || $flt === 'AHx') {
                $h = preg_replace('/[^0-9A-Fa-f]/', '', $data);
                if (strlen($h) % 2 === 1) {
                    $h .= '0';
                }
                $data = pack('H*', $h);
            }
            // LZW, ASCII85, DCT, JPX... se dejan crudos (no se usan en content streams).
            $idx++;
        }
        return $data;
    }

    private function applyPredictor($data, $parms)
    {
        $predictor = (int)($parms['Predictor'] ?? 1);
        if ($predictor === 1) {
            return $data;
        }
        $colors = max(1, (int)($parms['Colors'] ?? 1));
        $bpc = max(1, (int)($parms['BitsPerComponent'] ?? 8));
        $columns = max(1, (int)($parms['Columns'] ?? 1));
        if ($bpc !== 8 && $predictor >= 10) {
            return $data;
        }
        $rowBytes = (int)ceil($colors * $bpc * $columns / 8);
        if ($rowBytes <= 0) {
            return $data;
        }
        $out = '';
        $n = strlen($data);
        $pos = 0;
        $prevRow = str_repeat("\x00", $rowBytes);
        if ($predictor === 2) {
            while ($pos < $n) {
                $row = substr($data, $pos, $rowBytes);
                $pos += $rowBytes;
                if (strlen($row) < $rowBytes) {
                    $row = str_pad($row, $rowBytes, "\x00");
                }
                $cur = '';
                for ($i = 0; $i < $rowBytes; $i++) {
                    $left = $i > 0 ? ord($cur[$i - 1]) : 0;
                    $cur .= chr((ord($row[$i]) + $left) & 0xFF);
                }
                $out .= $cur;
            }
            return $out;
        }
        while ($pos < $n) {
            $ft = ord($data[$pos]);
            $pos++;
            $row = substr($data, $pos, $rowBytes);
            $pos += $rowBytes;
            if (strlen($row) < $rowBytes) {
                $row = str_pad($row, $rowBytes, "\x00");
            }
            $cur = '';
            for ($i = 0; $i < $rowBytes; $i++) {
                $a = ord($row[$i]);
                $left = $i > 0 ? ord($cur[$i - 1]) : 0;
                $up = ord($prevRow[$i]);
                $ul = $i > 0 ? ord($prevRow[$i - 1]) : 0;
                if ($ft === 1) {
                    $v = $a + $left;
                } elseif ($ft === 2) {
                    $v = $a + $up;
                } elseif ($ft === 3) {
                    $v = $a + (int)(($left + $up) / 2);
                } elseif ($ft === 4) {
                    $pa = abs($up - $ul);
                    $pb = abs($left - $ul);
                    $pc = abs($a - $ul);
                    if ($pa <= $pb && $pa <= $pc) {
                        $v = $a + $left;
                    } elseif ($pb <= $pc) {
                        $v = $a + $up;
                    } else {
                        $v = $a + $ul;
                    }
                } else {
                    $v = $a;
                }
                $cur .= chr($v & 0xFF);
            }
            $out .= $cur;
            $prevRow = $cur;
        }
        return $out;
    }

    /** Diccionario raiz resuelto (catálogo). */
    public function root()
    {
        if (!isset($this->trailer['Root'])) {
            return null;
        }
        return $this->deref($this->trailer['Root']);
    }

    /** Lista de numeros de objeto registrados en el xref. */
    public function objectNumbers()
    {
        return array_keys($this->objmap);
    }

    /** Offset en bytes del objeto (para depuracion). */
    public function offsetOf($num)
    {
        $info = $this->objmap[$num] ?? null;
        return $info && isset($info['off']) ? $info['off'] : -1;
    }

    /** Numeros de pagina (objetos) en orden de documento. */
    public function getPageObjectNumbers()
    {
        $root = $this->root();
        if (!$root || !isset($root['Pages'])) {
            return [];
        }
        $out = [];
        $this->collectPageNums($this->deref($root['Pages']), $out);
        return $out;
    }

    private function collectPageNums($node, &$out)
    {
        if (isset($node['Kids'])) {
            $kids = $this->deref($node['Kids']);
            if (is_array($kids)) {
                foreach ($kids as $k) {
                    $child = $this->deref($k);
                    if (is_array($child) && isset($child['Kids'])) {
                        $this->collectPageNums($child, $out);
                    } else {
                        $num = is_array($k) && isset($k['n']) ? (int)$k['n'] : null;
                        if ($num !== null) {
                            $out[] = $num;
                        }
                    }
                }
            }
            return;
        }
    }

    /** Bytes crudos del objeto (para re-emitir el PDF en el overlay). */
    public function rawObjectBytes($num)
    {
        $info = $this->objmap[$num] ?? null;
        if (!$info || $info['t'] !== 'off') {
            return null;
        }
        $off = $info['off'];
        $s = $this->data;
        $kw = strpos($s, 'obj', $off);
        if ($kw === false) {
            return null;
        }
        $cont = $this->object($num);
        if ($cont && isset($cont['stream'])) {
            $es = strpos($s, 'endstream', $kw);
            if ($es === false) {
                return null;
            }
            $end = strpos($s, 'endobj', $es);
        } else {
            $end = strpos($s, 'endobj', $kw);
        }
        if ($end === false) {
            return null;
        }
        return substr($s, $off, $end + 6 - $off);
    }

    /** Lista de dicts de pagina en orden de documento. */
    public function getPages()
    {
        $root = $this->root();
        if (!$root || !isset($root['Pages'])) {
            throw new PdfParseException('Catálogo sin /Pages');
        }
        $out = [];
        $this->collectPages($this->deref($root['Pages']), $out);
        return $out;
    }

    private function collectPages($node, &$out)
    {
        if (!is_array($node)) {
            return;
        }
        if (isset($node['Kids'])) {
            $kids = $this->deref($node['Kids']);
            if (is_array($kids)) {
                foreach ($kids as $k) {
                    $child = $this->deref($k);
                    if (is_array($child)) {
                        $this->collectPages($child, $out);
                    }
                }
            }
            return;
        }
        $out[] = $node;
    }

    /** Valor de una clave de pagina con herencia por /Parent. */
    public function pageKey($page, $key)
    {
        $node = $page;
        for ($i = 0; $i < 16 && is_array($node); $i++) {
            if (array_key_exists($key, $node)) {
                return $this->deref($node[$key]);
            }
            if (isset($node['Parent'])) {
                $node = $this->deref($node['Parent']);
            } else {
                break;
            }
        }
        return null;
    }

    /** MediaBox resuelto [x0,y0,x1,y1]. */
    public function pageBox($page)
    {
        $box = $this->pageKey($page, 'CropBox');
        if (!is_array($box)) {
            $box = $this->pageKey($page, 'MediaBox');
        }
        if (!is_array($box) || count($box) < 4) {
            return [0.0, 0.0, 595.0, 842.0];
        }
        return array_map('floatval', array_slice($box, 0, 4));
    }

    /** Content streams de una pagina ya decodificados (lista de strings binarios). */
    public function pageContents($page)
    {
        if (!array_key_exists('Contents', $page)) {
            return [];
        }
        $c = $this->deref($page['Contents']);
        if (!$c) {
            return [];
        }
        $list = $c;
        if (isset($c['stream'])) {
            $list = [$c];
        }
        if (!is_array($list)) {
            return [];
        }
        $out = [];
        foreach ($list as $item) {
            $r = $this->deref($item);
            if (is_array($r) && isset($r['stream'])) {
                $dec = $this->decodeStreamData($r['dict'], $r['data']);
                if (is_string($dec) && $dec !== '') {
                    $out[] = $dec;
                }
            }
        }
        return $out;
    }
}