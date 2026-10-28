<?php
/**
 * Compositor - compone la FOTO del comprador en el servidor (spec 035, D9).
 *
 * El cliente ya no sube el bitmap compuesto: manda el ORIGINAL (cap 2000 px) + la
 * receta v2, y este compositor lo materializa **bajo demanda** al generar el PDF.
 * El nombre del archivo es deterministico por receta (`foto-{pdf}-{gid}-{receta}.webp`),
 * asi que el nombre ES el cache: si el archivo existe, no se recompone.
 *
 * La matematica de la caja es la MISMA de `assets/selector-pmu.js`
 * (`escalaBase` y `escalaSalida`), que es la referencia: si divergen, la vista
 * previa deja de ser el PDF. La paridad la vigila `tests/compositor-paridad.test.js`.
 *
 * El Motor no se toca: esto solo produce el archivo que `Motor`/`Overlay` ya saben
 * inyectar.
 */

namespace ExtractCorel\Engine;

class Compositor
{
    /** Lienzo maximo (espejo de `PMU_Sesion::PH_MAX` y `assets/tienda.js`). */
    const PH_MAX = 3000;

    /** Calidad WebP de salida: la misma de la 026 (q0.85). */
    const CALIDAD = 85;

    /** GD con WebP es requisito desde la 035: sin ella no hay fotos. */
    public static function gd()
    {
        return extension_loaded('gd') && function_exists('imagecreatefromstring')
            && function_exists('imagewebp');
    }

    /**
     * Caja con la que se dibuja la foto (replica de `escalaBase` del selector).
     *
     * `modo`: `cubrir` (cover: tapa y recorta) | `encajar` (contain: entera + fondo)
     * | `estirar` (fill: ocupa el marco exacto). Ninguno deforma salvo `estirar`.
     *
     * @return array{dw: float, dh: float}
     */
    public static function caja($modo, $iw, $ih, $W, $H)
    {
        $w = max(1.0, (float)$W);
        $h = max(1.0, (float)$H);
        $aw = max(1.0, (float)$iw);
        $ah = max(1.0, (float)$ih);
        if ($modo === 'estirar') {
            return ['dw' => $w, 'dh' => $h];
        }
        if ($modo === 'encajar') {
            $e = min($w / $aw, $h / $ah);
            return ['dw' => $aw * $e, 'dh' => $ah * $e];
        }
        $ec = max($w / $aw, $h / $ah);
        return ['dw' => $aw * $ec, 'dh' => $ah * $ec];
    }

    /**
     * Factor y tamano REAL del PNG (replica de `escalaSalida`, spec 028 D11).
     *
     * `k = min(1, max(iw,ih) / max(caja * escala))`: el PNG nunca supera el lienzo
     * ni amplia la foto, y conserva el aspecto del lienzo (factor uniforme), asi el
     * encaje del Motor sigue siendo 1:1 en encuadre.
     *
     * @return array{k: float, w: int, h: int}
     */
    public static function salida($modo, $iw, $ih, $W, $H, $escala = 1)
    {
        $w = max(1.0, (float)$W);
        $h = max(1.0, (float)$H);
        $z = ((float)$escala > 0) ? (float)$escala : 1.0;
        $caja = self::caja($modo, $iw, $ih, $w, $h);
        $mayorCaja = max($caja['dw'] * $z, $caja['dh'] * $z);
        $mayorFoto = max(max(1.0, (float)$iw), max(1.0, (float)$ih));
        $k = ($mayorCaja > 0) ? min(1.0, $mayorFoto / $mayorCaja) : 1.0;
        return [
            'k' => $k,
            'w' => max(1, (int)round($w * $k)),
            'h' => max(1, (int)round($h * $k)),
        ];
    }

    /**
     * Compone la foto y devuelve los BYTES WebP (q0.85, con alfa).
     *
     * Pasos, en el orden del selector (`_pintarImagenEnContexto`):
     *  1. se rota el original (`rot` en multiplos de 90, exacto);
     *  2. el lienzo mide `salida.w x salida.h`; si hay fondo opaco, se pinta
     *     (con `transp:'no'` el fondo NUNCA queda transparente: blanco puro, 027);
     *  3. la foto rotada se escala a `caja * escala * k` y se centra en `(ox,oy)`.
     *
     * @param string $rutaOriginal archivo del original (`{id}.webp`)
     * @param array  $receta       receta v2 ya validada (`PMU_Sesion::receta_validar`)
     * @return string bytes WebP
     * @throws \RuntimeException `motor:compositor:gd` | `motor:original:ausente` |
     *                           `motor:compositor:origen` | `motor:compositor:webp`
     */
    public static function componer($rutaOriginal, array $receta)
    {
        if (!self::gd()) {
            throw new \RuntimeException('motor:compositor:gd');
        }
        $ruta = (string)$rutaOriginal;
        if ($ruta === '' || !is_file($ruta)) {
            throw new \RuntimeException('motor:original:ausente');
        }
        $bytes = @file_get_contents($ruta);
        $src = ($bytes === false || $bytes === '') ? false : @imagecreatefromstring($bytes);
        if ($src === false) {
            throw new \RuntimeException('motor:compositor:origen');
        }

        $w = (int)$receta['w'];
        $h = (int)$receta['h'];
        $iw = (int)$receta['iw'];
        $ih = (int)$receta['ih'];
        $escala = (float)$receta['escala'];
        $modo = (string)$receta['modo'];
        $rot = ((int)$receta['rot']) % 360;
        if ($rot < 0) {
            $rot += 360;
        }
        $ox = (float)$receta['ox'];
        $oy = (float)$receta['oy'];

        // 1) rotacion (multiplos de 90: transposicion exacta)
        $rotada = ($rot === 0) ? $src : self::rotar($src, $rot);

        // 2) lienzo (el PNG mide el lienzo acotado, spec 028 D11)
        $out = self::salida($modo, $iw, $ih, $w, $h, $escala);
        $ow = (int)$out['w'];
        $oh = (int)$out['h'];
        $lienzo = imagecreatetruecolor($ow, $oh);
        if ($lienzo === false) {
            throw new \RuntimeException('motor:compositor:lienzo');
        }
        imagealphablending($lienzo, false);
        imagesavealpha($lienzo, true);
        $transparente = imagecolorallocatealpha($lienzo, 0, 0, 0, 127);
        imagefilledrectangle($lienzo, 0, 0, $ow - 1, $oh - 1, $transparente);
        $color = self::colorFondo($receta['fondo'] ?? 'transparent', $receta['transp'] ?? '');
        if ($color !== null) {
            $rgb = self::hex2rgb($color);
            $opaco = imagecolorallocate($lienzo, $rgb[0], $rgb[1], $rgb[2]);
            imagefilledrectangle($lienzo, 0, 0, $ow - 1, $oh - 1, $opaco);
        }

        // 3) la foto, escalada a la caja y centrada en (ox,oy) del lienzo de salida
        $caja = self::caja($modo, $iw, $ih, $w, $h);
        $k = (float)$out['k'];
        $dw = max(1, (int)round($caja['dw'] * $escala * $k));
        $dh = max(1, (int)round($caja['dh'] * $escala * $k));
        $dx = (int)round($ox * $ow - $dw / 2);
        $dy = (int)round($oy * $oh - $dh / 2);
        // Alfa: se compone sobre lo que ya hay (fondo o transparencia).
        imagealphablending($lienzo, true);
        imagecopyresampled($lienzo, $rotada, $dx, $dy, 0, 0, $dw, $dh,
            imagesx($rotada), imagesy($rotada));
        imagealphablending($lienzo, false);
        imagesavealpha($lienzo, true);

        ob_start();
        $ok = imagewebp($lienzo, null, self::CALIDAD);
        $salida = ob_get_clean();
        if (!$ok || $salida === false || $salida === '') {
            throw new \RuntimeException('motor:compositor:webp');
        }
        return $salida;
    }

    /**
     * Rota la imagen en sentido HORARIO (el de `ctx.rotate` del selector).
     *
     * `imagerotate` gira ANTIHORARIO, de ahi el signo. Con multiplos de 90 sobre
     * una rejilla alineada la rotacion es exacta (los centros de pixel coinciden);
     * NO se intenta transponer a mano con `imagecopy`, que no transpone y deja
     * columnas vacias.
     *
     * @return resource|\GdImage
     */
    private static function rotar($im, $grados)
    {
        $g = ((int)$grados) % 360;
        if ($g < 0) {
            $g += 360;
        }
        if ($g === 0) {
            return $im;
        }
        $girada = @imagerotate($im, -$g, 0);
        return ($girada === false) ? $im : $girada;
    }

    /** Color de fondo opaco (`#rrggbb`) o null si el lienzo queda transparente. */
    private static function colorFondo($fondo, $transp)
    {
        $f = strtolower(trim((string)$fondo));
        $esNada = ($f === '' || $f === 'transparent' || $f === 'auto');
        // Spec 027: `transp:'no'` NUNCA deja el fondo transparente (barrera final).
        if ($transp === 'no' && $esNada) {
            return '#ffffff';
        }
        if ($esNada) {
            return null;
        }
        return preg_match('/^#[0-9a-f]{6}$/', $f) ? $f : null;
    }

    /** `#rrggbb` -> [r, g, b]. */
    private static function hex2rgb($hex)
    {
        $h = ltrim((string)$hex, '#');
        return [
            (int)hexdec(substr($h, 0, 2)),
            (int)hexdec(substr($h, 2, 2)),
            (int)hexdec(substr($h, 4, 2)),
        ];
    }
}
