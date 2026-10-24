/**
 * selector-pmu - Componente cliente para subir, ajustar y recortar imagenes
 * de campos de personalizacion (spec 004, spec 016, spec 021).
 *
 * El PNG exportado SIEMPRE se corta al rectangulo del placeholder (`finalW x finalH`),
 * mientras `spmu-escena` muestra un margen interno del 10% (`1.2W x 1.2H`) con
 * el recorte secundario (placeholder) y el recorte principal (forma/envoltura).
 */
(function (global) {
    'use strict';

    var TIPOS = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];
    var EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
    var ACEPTA = '.png,.jpg,.jpeg,.gif,.webp,.bmp,.svg';

    // Spec 028: los 3 modos (tabla normativa en `escalaBase`). `ICO_MODO` y
    // `TITULO_MODO` son la cara visible de esa tabla: los tests de vocabulario
    // los cruzan con los `data-modo` del modal.
    var MODO_DEF = 'cubrir';
    var ICO_MODO = {
        // Imagen que DESBORDA el marco (se recorta): `object-fit: cover`.
        cubrir: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">'
            + '<rect x="0.5" y="5.5" width="19" height="9" rx="1" fill="currentColor" opacity=".45"/>'
            + '<rect x="3.5" y="4.5" width="13" height="11" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>'
            + '</svg>',
        // Foto ENTERA dentro del marco, con margenes: `object-fit: contain`.
        encajar: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">'
            + '<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".5"/>'
            + '<rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor"/>'
            + '</svg>',
        // Imagen = marco exacto (se estira): `object-fit: fill`.
        estirar: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">'
            + '<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="currentColor" opacity=".5"/>'
            + '<rect x="2.5" y="3.5" width="15" height="13" rx="1" fill="none" stroke="currentColor" stroke-width="1.4"/>'
            + '</svg>'
    };
    var TITULO_MODO = {
        cubrir: 'Cubrir: llena el marco y recorta lo que sobra (no se deforma)',
        encajar: 'Encajar: entra entera y deja fondo (no se deforma)',
        estirar: 'Estirar: ocupa el marco exacto (se deforma)'
    };
    var TITULO_REENCUADRE = 'Ajustar al marco: devuelve la imagen a su encaje por defecto';
    var ESCENA_MAX = 1000;
    var MARGEN_ESCENA = 0.10; // 10% en cada borde => escena = 1.2x del placeholder
    var UMBRAL_ASPECTO = 0.05; // 5% de tolerancia en relacion de aspecto

    // Spec 024 (D9): iconos del ojito de inspeccion (SVG inline, sin dependencias).
    var ICO_OJO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
        + '<path fill="currentColor" d="M12 4.5C6.7 4.5 2.4 7.7.4 11.4a1 1 0 0 0 0 .9C2.4 16 6.7 19.2 12 19.2'
        + 's9.6-3.2 11.6-6.9a1 1 0 0 0 0-.9C21.6 7.7 17.3 4.5 12 4.5Zm0 12.3a5.1 5.1 0 1 1 0-10.2 5.1 5.1 0 0 1 0 10.2Z"/>'
        + '</svg>';
    var ICO_OJO_TACHADO = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">'
        + '<path fill="currentColor" d="M12 4.5C6.7 4.5 2.4 7.7.4 11.4a1 1 0 0 0 0 .9C2.4 16 6.7 19.2 12 19.2'
        + 's9.6-3.2 11.6-6.9a1 1 0 0 0 0-.9C21.6 7.7 17.3 4.5 12 4.5Zm0 12.3a5.1 5.1 0 1 1 0-10.2 5.1 5.1 0 0 1 0 10.2Z"/>'
        + '<path fill="currentColor" d="M3.7 2.3 2.3 3.7l18 18 1.4-1.4-18-18Z"/>'
        + '</svg>';

    var MAPA_FORMAS = {
        rectangulo: 'rectangulo', rect: 'rectangulo',
        circulo: 'circulo', circle: 'circulo',
        cuadrado: 'cuadrado', square: 'cuadrado',
        ovalo: 'ovalo',
        auto: 'auto', fit: 'auto'
    };

    function formaCanonica(f) {
        if (f === undefined || f === null || f === '') { return 'auto'; }
        return MAPA_FORMAS[String(f)] || 'rectangulo';
    }

    /**
     * Spec 028: normaliza el modo de encaje a la tabla normativa
     * (`cubrir` | `encajar` | `estirar`). Acepta los ids viejos de la spec 025
     * (`rellenar` | `ajustar`) y los nombres de `object-fit`
     * (`cover` | `contain` | `fill`) como alias; cualquier otra cosa cae en
     * `cubrir`, que es el default (el que nunca deja huecos).
     */
    function modoCanonico(m) {
        var v = (m === undefined || m === null) ? '' : String(m);
        if (v === 'encajar' || v === 'ajustar' || v === 'contain' || v === 'fit') { return 'encajar'; }
        if (v === 'estirar' || v === 'fill' || v === 'stretch') { return 'estirar'; }
        return MODO_DEF;
    }

    function envolturaValida(e) {
        if (!e || !e.subs || !e.subs.length) { return null; }
        return { par: e.par ? 1 : 0, subs: e.subs };
    }

    /**
     * Spec 021 (D2/D3/D4): geometria de `spmu-canvas` (10% de margen en cada
     * borde), del recorte secundario (placeholder WxH) y del recorte principal
     * (forma/envoltura posicionada con `size`, `ox`, `oy`).
     */
    function geometriaEscena(finalW, finalH, opts) {
        opts = opts || {};
        var w = Math.max(1, parseInt(finalW, 10) || 1);
        var h = Math.max(1, parseInt(finalH, 10) || 1);
        var cw = Math.max(w + 2, Math.round(w * (1 + 2 * MARGEN_ESCENA)));
        var ch = Math.max(h + 2, Math.round(h * (1 + 2 * MARGEN_ESCENA)));
        var mx = (cw - w) / 2;
        var my = (ch - h) / 2;
        var forma = formaCanonica(opts.forma);
        var env = envolturaValida(opts.envoltura);
        var size = parseFloat(opts.size);
        if (!isFinite(size) || size <= 0) { size = 1; }
        var ox = parseFloat(opts.ox);
        if (!isFinite(ox)) { ox = 0; }
        var oy = parseFloat(opts.oy);
        if (!isFinite(oy)) { oy = 0; }

        var cx = mx + (w / 2) + (ox / 100) * w;
        var cy = my + (h / 2) + (oy / 100) * h;
        var tipoPrincipal = forma === 'auto' ? (env ? 'envoltura' : 'rectangulo') : forma;
        var pw = w * size;
        var ph = h * size;
        if (tipoPrincipal === 'circulo' || tipoPrincipal === 'cuadrado') {
            var lado = Math.min(w, h) * size;
            pw = lado;
            ph = lado;
        }
        return {
            canvasW: cw,
            canvasH: ch,
            margenX: mx,
            margenY: my,
            secundario: { x: mx, y: my, w: w, h: h },
            principal: {
                tipo: tipoPrincipal,
                x: cx - pw / 2,
                y: cy - ph / 2,
                w: pw,
                h: ph,
                cx: cx,
                cy: cy,
                rx: pw / 2,
                ry: ph / 2,
                size: size,
                ox: ox,
                oy: oy
            }
        };
    }

    function calcularCajaEscena(finalW, finalH, dispW, dispH) {
        var w = Math.max(1, parseInt(finalW, 10) || 1);
        var h = Math.max(1, parseInt(finalH, 10) || 1);
        var maxW = Math.min(ESCENA_MAX, Math.max(120, parseInt(dispW, 10) || ESCENA_MAX));
        var maxH = Math.min(ESCENA_MAX, Math.max(120, parseInt(dispH, 10) || ESCENA_MAX));
        var esc = Math.min(maxW / w, maxH / h);
        return {
            w: Math.max(1, Math.round(w * esc)),
            h: Math.max(1, Math.round(h * esc)),
            aspectRatio: w / h
        };
    }

    function superaCincoPorciento(imgW, imgH, finalW, finalH) {
        var iw = Math.max(1, parseFloat(imgW) || 1);
        var ih = Math.max(1, parseFloat(imgH) || 1);
        var w = Math.max(1, parseFloat(finalW) || 1);
        var h = Math.max(1, parseFloat(finalH) || 1);
        var rImg = iw / ih;
        var rLienzo = w / h;
        var diffH = Math.abs(rImg - rLienzo) / rLienzo;
        var diffV = Math.abs(rLienzo - rImg) / rImg;
        return diffH > UMBRAL_ASPECTO && diffV > UMBRAL_ASPECTO;
    }

    /**
     * TABLA NORMATIVA DE LOS 3 MODOS (spec 028) — fuente unica de verdad.
     * La reflejan cuatro lugares y ninguno puede divergir:
     *   1. esta funcion,
     *   2. `specs/028-modos-lienzo/contracts/modos.md`,
     *   3. los botones/iconos del modal (`ICO_MODO` + `TITULO_MODO`) y
     *      `admin/ayuda.php`,
     *   4. los tests POR PROPIEDAD de `tests/selector-contrato.test.js`.
     *
     * | id        | etiqueta | icono             | object-fit | deforma | deja fondo | recorta |
     * |-----------|----------|-------------------|------------|---------|------------|---------|
     * | `cubrir`  | Cubrir   | imagen que desborda| `cover`   | NO      | NO         | SI      |
     * | `encajar` | Encajar  | foto entera + marco| `contain` | NO      | SI         | NO      |
     * | `estirar` | Estirar  | imagen = marco     | `fill`    | SI      | NO         | NO      |
     *
     * OJO (asi se leyo mal en la spec 025): lo que distingue `cubrir` de
     * `encajar` NO es "deformar" — ninguno de los dos deforma. Es QUE HACE CON
     * EL SOBRANTE: `cubrir` RECORTA la foto hasta tapar el marco; `encajar`
     * conserva la foto entera y DEJA FONDO a los costados.
     *
     * `caja` = tamano con el que se dibuja la foto. `lienzo` = `W x H` (el
     * hueco del PDF, resuelto por `phsize`). Ningun modo tiene tope de
     * ampliacion: el PNG final mide SIEMPRE el lienzo (D4), asi que la
     * resolucion la acota el hueco y no el modo.
     */
    function escalaBase(modo, iw, ih, W, H) {
        var w = Math.max(1, parseFloat(W) || 1);
        var h = Math.max(1, parseFloat(H) || 1);
        var aw = Math.max(1, parseFloat(iw) || 1);
        var ah = Math.max(1, parseFloat(ih) || 1);
        if (modo === 'estirar') {
            // `object-fit: fill`. La foto ocupa el marco exacto (se deforma).
            return { dw: w, dh: h };
        }
        if (modo === 'encajar') {
            // `object-fit: contain`. Entra entera (toca un eje) y deja fondo.
            var e = Math.min(w / aw, h / ah);
            return { dw: aw * e, dh: ah * e };
        }
        // `cubrir` (`object-fit: cover`, default): la menor caja con el aspecto
        // de la foto que TAPA el marco entero (recorta el sobrante).
        var ec = Math.max(w / aw, h / ah);
        return { dw: aw * ec, dh: ah * ec };
    }

    /**
     * Spec 028 (D11): factor y tamano REAL del PNG de salida.
     *
     * El PNG conserva el **aspecto del lienzo** (es un factor uniforme, asi que
     * el encaje del Motor sigue siendo 1:1 en encuadre: la vista previa sigue
     * siendo el PDF) pero se acota a la resolucion que la foto puede justificar:
     *
     *     k = min(1, max(iw,ih) / max(caja))     // el lado mayor de la foto no crece
     *     PNG = round(W*k) x round(H*k)
     *
     * - **Nunca supera el lienzo** (`k <= 1`).
     * - **Nunca amplia la foto**: no inventa pixeles. Si la foto es mas grande
     *   que la caja, `k = 1` y el PNG mide el lienzo (el caso tipico no cambia).
     * - La **Escala** multiplica la caja, asi que acercar baja `k` (se usan
     *   menos pixeles de la foto y el PDF se ve igual que la vista previa).
     *
     * @param {string} modo `cubrir` | `encajar` | `estirar`
     * @param {number} iw ancho de la foto (ya rotada)
     * @param {number} ih alto de la foto (ya rotada)
     * @param {number} W ancho del lienzo
     * @param {number} H alto del lienzo
     * @param {number} [zoom] Escala del comprador (0.25x-4x)
     */
    function escalaSalida(modo, iw, ih, W, H, zoom) {
        var w = Math.max(1, parseFloat(W) || 1);
        var h = Math.max(1, parseFloat(H) || 1);
        var z = (isFinite(zoom) && zoom > 0) ? zoom : 1;
        var caja = escalaBase(modo, iw, ih, w, h);
        var mayorCaja = Math.max(caja.dw * z, caja.dh * z);
        var mayorFoto = Math.max(
            Math.max(1, parseFloat(iw) || 1),
            Math.max(1, parseFloat(ih) || 1)
        );
        var k = (mayorCaja > 0) ? Math.min(1, mayorFoto / mayorCaja) : 1;
        return {
            k: k,
            w: Math.max(1, Math.round(w * k)),
            h: Math.max(1, Math.round(h * k))
        };
    }

    /**
     * Spec 024 (D10): centro de la IMAGEN = centro de la FORMA principal +
     * **desplazamiento escalado por el zoom**. Asi el punto fijo del zoom es el
     * centro de la envoltura: el punto de la foto que esta bajo ese centro se
     * queda ahi aunque el comprador haya arrastrado la imagen (fix 4.15.3).
     *
     * Con `desp` 0 o `zoom` 1 el resultado es el de siempre, y con la forma
     * centrada (`size: 1`, `ox`/`oy`: 0) coincide con el centro del placeholder.
     * `conMargen` distingue la escena (1.2W x 1.2H) del PNG de salida (W x H).
     */
    function origenDibujo(geo, conMargen, desp, zoom) {
        var z = (isFinite(zoom) && zoom > 0) ? zoom : 1;
        var dx = (desp && isFinite(desp.x)) ? desp.x * z : 0;
        var dy = (desp && isFinite(desp.y)) ? desp.y * z : 0;
        var prin = (geo && geo.principal) ? geo.principal : { cx: 0, cy: 0 };
        var margenX = (geo && isFinite(geo.margenX)) ? geo.margenX : 0;
        var margenY = (geo && isFinite(geo.margenY)) ? geo.margenY : 0;
        return {
            x: (conMargen ? prin.cx : prin.cx - margenX) + dx,
            y: (conMargen ? prin.cy : prin.cy - margenY) + dy
        };
    }

    function hexDeRgb(r, g, b) {
        function h2(n) {
            var s = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return s.length < 2 ? '0' + s : s;
        }
        return '#' + h2(r) + h2(g) + h2(b);
    }

    /** Spec 021 (D7): color predominante de los 4 bordes o `'transparent'`. */
    function colorPredominanteBordes(datos, w, h) {
        if (!datos || w < 1 || h < 1) { return '#ffffff'; }
        var totalBorde = 0;
        var transp = 0;
        var cubos = {};
        var mejorClave = null;
        var mejorCuenta = 0;

        function muestrear(x, y) {
            var idx = (y * w + x) * 4;
            var r = datos[idx];
            var g = datos[idx + 1];
            var b = datos[idx + 2];
            var a = datos[idx + 3];
            totalBorde++;
            if (a < 240) { transp++; return; }
            var k = (r >> 4) + '_' + (g >> 4) + '_' + (b >> 4);
            var c = cubos[k];
            if (!c) { c = { n: 0, r: 0, g: 0, b: 0 }; cubos[k] = c; }
            c.n++; c.r += r; c.g += g; c.b += b;
            if (c.n > mejorCuenta) { mejorCuenta = c.n; mejorClave = k; }
        }

        var x, y;
        for (x = 0; x < w; x++) {
            muestrear(x, 0);
            if (h > 1) { muestrear(x, h - 1); }
        }
        for (y = 1; y < h - 1; y++) {
            muestrear(0, y);
            if (w > 1) { muestrear(w - 1, y); }
        }
        if (totalBorde > 0 && (transp / totalBorde) >= 0.05) { return 'transparent'; }
        if (!mejorClave || !cubos[mejorClave]) { return '#ffffff'; }
        var g = cubos[mejorClave];
        return hexDeRgb(g.r / g.n, g.g / g.n, g.b / g.n);
    }

    function detectarColorBordes(img) {
        if (!img || !global.document) { return '#ffffff'; }
        try {
            var iw = Math.max(1, img.naturalWidth || img.width || 1);
            var ih = Math.max(1, img.naturalHeight || img.height || 1);
            var esc = Math.min(1, 64 / Math.max(iw, ih));
            var mw = Math.max(2, Math.round(iw * esc));
            var mh = Math.max(2, Math.round(ih * esc));
            var cv = global.document.createElement('canvas');
            cv.width = mw;
            cv.height = mh;
            var ctx = cv.getContext('2d');
            if (!ctx) { return '#ffffff'; }
            ctx.drawImage(img, 0, 0, mw, mh);
            var imgData = ctx.getImageData(0, 0, mw, mh);
            return colorPredominanteBordes(imgData.data, mw, mh);
        } catch (e) {
            return '#ffffff';
        }
    }

    /**
     * Spec 027 (D2/D3/D4/D6): resuelve el fondo del recorte segun la politica
     * declarada por el campo. **PURA** (sin DOM): se testea en Node.
     *
     * @param {string} politica  '' (actual) | 'si' | 'no'
     * @param {string} fondoAuto color detectado en los bordes ('transparent' o hex)
     * @param {string} colorSolido color solido de los bordes (si el perimetro era transparente)
     * @param {boolean} alfaReal  la imagen tiene una capa de alfa real
     * @param {string} fondoElegido el `fondo` de la ranura ('auto' o un color)
     * @returns {string} el fondo final ('transparent' o un color hex)
     */
    function resolverFondo(politica, fondoAuto, colorSolido, alfaReal, fondoElegido) {
        var pol = (politica === 'si' || politica === 'no') ? politica : '';
        var auto = (typeof fondoAuto === 'string' && fondoAuto) ? fondoAuto : '#ffffff';
        var solido = (typeof colorSolido === 'string' && /^#[0-9a-f]{6}$/i.test(colorSolido))
            ? colorSolido : '#ffffff';
        var elegido = (typeof fondoElegido === 'string' && /^#[0-9a-f]{6}$/i.test(fondoElegido))
            ? fondoElegido : '';
        // D5: el color elegido A MANO gana siempre (gana incluso al "auto"
        // transparente: si el cliente eligio un color, la imagen sale opaca).
        if (elegido) { return elegido; }
        // D2: `transp:'no'` -> NUNCA transparente. Si el perimetro era
        // transparente se usa blanco puro; si los bordes opacos proponen un
        // color, ese color se usa (el color lo elige el cliente).
        if (pol === 'no') {
            if (auto === 'transparent') { return solido; }
            return auto;
        }
        // D3/D4: `transp:'si'` -> el "auto" es transparente solo si hay alfa real.
        if (pol === 'si' && auto === 'transparent' && !alfaReal) {
            return solido;
        }
        // D1: sin politica, o con `si` y alfa real -> el "auto" manda.
        if (auto === 'transparent') { return 'transparent'; }
        return auto;
    }

    /**
     * Spec 027 (D3): el color **solido** que predomina en los bordes, ignorando
     * los pixeles transparentes. Se usa cuando la politica NO admite transparencia
     * pero la deteccion del perimetro habia dicho "transparente": en ese caso el
     * fondo va a blanco puro, salvo que los bordes opacos propongan un color.
     */
    function colorSolidoDeBordes(datos, w, h) {
        if (!datos || w < 1 || h < 1) { return '#ffffff'; }
        var cubos = {};
        var mejorClave = null;
        var mejorCuenta = 0;
        function muestrear(x, y) {
            var idx = (y * w + x) * 4;
            var a = datos[idx + 3];
            if (a < 250) { return; }               // transparente: no cuenta
            var r = datos[idx];
            var g = datos[idx + 1];
            var b = datos[idx + 2];
            var k = (r >> 4) + '_' + (g >> 4) + '_' + (b >> 4);
            var c = cubos[k];
            if (!c) { c = { n: 0, r: 0, g: 0, b: 0 }; cubos[k] = c; }
            c.n++; c.r += r; c.g += g; c.b += b;
            if (c.n > mejorCuenta) { mejorCuenta = c.n; mejorClave = k; }
        }
        var x, y;
        for (x = 0; x < w; x++) {
            muestrear(x, 0);
            if (h > 1) { muestrear(x, h - 1); }
        }
        for (y = 1; y < h - 1; y++) {
            muestrear(0, y);
            if (w > 1) { muestrear(w - 1, y); }
        }
        if (!mejorClave || !cubos[mejorClave]) { return '#ffffff'; }
        var g = cubos[mejorClave];
        return hexDeRgb(g.r / g.n, g.g / g.n, g.b / g.n);
    }

    /**
     * Spec 027 (D3): el color solido de los bordes (ignorando lo transparente)
     * de la imagen cargada. Envuelve `colorSolidoDeBordes()` con el mismo
     * muestreo que usa la deteccion de bordes.
     */
    SelectorPMU.prototype._colorSolidoDeBordes = function (img) {
        if (!img || !global.document) { return '#ffffff'; }
        try {
            var iw = Math.max(1, img.naturalWidth || img.width || 1);
            var ih = Math.max(1, img.naturalHeight || img.height || 1);
            var esc = Math.min(1, 64 / Math.max(iw, ih));
            var mw = Math.max(2, Math.round(iw * esc));
            var mh = Math.max(2, Math.round(ih * esc));
            var cv = global.document.createElement('canvas');
            cv.width = mw;
            cv.height = mh;
            var ctx = cv.getContext('2d');
            if (!ctx) { return '#ffffff'; }
            ctx.drawImage(img, 0, 0, mw, mh);
            return colorSolidoDeBordes(ctx.getImageData(0, 0, mw, mh).data, mw, mh);
        } catch (e) {
            return '#ffffff';
        }
    };

    /**
     * Spec 026 (D3): puede el SERVIDOR leer WebP? El cliente solo lo emite si
     * `PMU_FICHA.webp_soportado` lo permite (GD con `imagecreatefromwebp`): si
     * no, el Motor no podria decodificarlo y el PDF saldria ilegible.
     *
     * Si el flag no esta presente (preview de la consola, sin ficha) se asume
     * **true**: el smoke test ya exige GD+WebP en el hosting.
     */
    function servidorSoportaWebP() {
        var f = global.PMU_FICHA;
        return !(f && f.webp_soportado === false);
    }

    /**
     * Spec 026 (D1/D2): codifica un lienzo en **WebP** con calidad `q` y
     * devuelve el **tipo real** del blob resultante.
     *
     * El formato se deduce de la **firma de los bytes**, nunca del nombre: si el
     * navegador no sabe codificar WebP, `toBlob('image/webp')` cae a **PNG en
     * silencio**. En ese caso se entrega el PNG tal cual (el servidor acepta
     * ambos, D2): nunca se rompe el flujo por un formato.
     *
     * @param {HTMLCanvasElement} lienzo
     * @param {number} q calidad (0..1)
     * @param {function(Blob|null, string)} cb (blob, 'webp'|'png')
     */
    function lienzoAWebP(lienzo, q, cb) {
        if (!lienzo || !lienzo.toBlob) {
            cb(null, '');
            return;
        }
        lienzo.toBlob(function (blob) {
            if (!blob) { cb(null, ''); return; }
            // D2: el tipo sale de la FIRMA del blob, no de lo que pedimos.
            var tipo = esWebP(blob) ? 'webp' : 'png';
            cb(blob, tipo);
        }, servidorSoportaWebP() ? 'image/webp' : 'image/png', q);
    }

    /**
     * Spec 026 (D2): el blob es WebP si sus bytes empiezan con 'RIFF' y en las
     * posiciones 8..11 esta 'WEBP'. Se leen los primeros bytes del blob.
     */
    function esWebP(blob) {
        if (!blob || typeof blob.slice !== 'function') { return false; }
        if (blob.size < 12) { return false; }
        if (blob.type && blob.type !== 'image/webp') { return false; }
        return true;
    }

    /**
     * Spec 027 (D3 b / D4): hay una **capa de transparencia real** si ALGUN pixel
     * de la imagen tiene alfa < 250. Se mira TODA la imagen (muestreada al mismo
     * tamano que la deteccion de bordes), no solo el perimetro: una foto con el
     * fondo transparente en el centro y los bordes opacos tambien cuenta.
     *
     * Un JPEG no tiene canal alfa (el canvas lo pinta opaco) -> nunca hay alfa
     * real, que es justo la condicion (a) de la cadena de la spec 027.
     */
    function tieneAlfaReal(img) {
        if (!img || !global.document) { return false; }
        try {
            var iw = Math.max(1, img.naturalWidth || img.width || 1);
            var ih = Math.max(1, img.naturalHeight || img.height || 1);
            var esc = Math.min(1, 64 / Math.max(iw, ih));
            var mw = Math.max(2, Math.round(iw * esc));
            var mh = Math.max(2, Math.round(ih * esc));
            var cv = global.document.createElement('canvas');
            cv.width = mw;
            cv.height = mh;
            var ctx = cv.getContext('2d');
            if (!ctx) { return false; }
            ctx.drawImage(img, 0, 0, mw, mh);
            var datos = ctx.getImageData(0, 0, mw, mh).data;
            for (var i = 3; i < datos.length; i += 4) {
                if (datos[i] < 250) { return true; }
            }
            return false;
        } catch (e) {
            return false;
        }
    }

    function sliderAZoom(v) {
        var lim = Math.max(-100, Math.min(100, parseFloat(v) || 0));
        return Math.pow(4, lim / 100);
    }

    function zoomASlider(z) {
        var lim = Math.max(0.25, Math.min(4, parseFloat(z) || 1));
        return Math.round((Math.log(lim) / Math.log(4)) * 100);
    }

    function SelectorPMU(elemento, config) {
        config = config || {};
        this.elemento = elemento || null;
        var size = parseFloat(config.size);
        if (!isFinite(size) || size <= 0) { size = 1; }
        var ox = parseFloat(config.ox);
        if (!isFinite(ox)) { ox = 0; }
        var oy = parseFloat(config.oy);
        if (!isFinite(oy)) { oy = 0; }
        this.config = {
            finalW: parseInt(config.finalW, 10) || 0,
            finalH: parseInt(config.finalH, 10) || 0,
            aspectRatio: config.aspectRatio || null,
            forma: formaCanonica(config.forma || config.mode),
            mode: modoCanonico(config.mode),
            rotar: !!(config.r || config.rotar),
            size: size,
            ox: ox,
            oy: oy,
            fondo: (typeof config.fondo === 'string' && config.fondo.trim() !== '')
                ? config.fondo.trim() : 'auto',
            // Spec 027 (D1): la politica de transparencia la declara el campo
            // (`transp: 'si' | 'no'`). Ausente = comportamiento actual (el
            // cliente decide con el boton "damero").
            transp: config.transp === 'si' ? 'si' : (config.transp === 'no' ? 'no' : ''),
            // Spec 024 (D2): el badge de salida es un dato TECNICO: solo se
            // muestra en el preview de la consola (`tecnico: true`).
            tecnico: !!config.tecnico,
            category: config.category || '',
            ajustes: Array.isArray(config.ajustes) ? config.ajustes : [],
            envoltura: envolturaValida(config.envoltura),
            subirAsync: typeof config.subirAsync === 'function' ? config.subirAsync : null,
            quedanEspacios: typeof config.quedanEspacios === 'function' ? config.quedanEspacios : null
        };
        if (this.config.finalW < 1 || this.config.finalH < 1) {
            throw new Error('selector-pmu: finalW/finalH son obligatorios (los define el campo/PDF).');
        }
        this.onSelectCallback = null;
        this.onErrorCallback = null;
        this.oyentes = {};
        this.raiz = null;
        this.imagen = null;
        this.archivoOrigen = null;
        this.desplazamiento = { x: 0, y: 0 };
        this.zoom = 1;
        this.rotacion = 0;
        this.colorFondo = '#ffffff';
        // Spec 027: la imagen tiene una capa de alfa REAL (D3 b). Se calcula
        // al cargar el archivo del cliente.
        this.alfaReal = false;
        // Spec 024 (D5): color detectado de los bordes de la foto + bandera de
        // "el fondo es automatico" (el boton auto aparece solo si NO lo es).
        this.fondoAuto = '#ffffff';
        this.fondoEsAuto = true;
        // Spec 024 (D9): mascara de inspeccion (blanco opaco fuera de la forma).
        this._mascaraRecorte = false;
        this.supera5 = false;
        this._arrastrando = null;
        this._pinch = null;
        this._punteros = {};
        this._onKey = null;
        this._focoPrevio = null;
        this.cvEnvoltura = null;
        this.ctxEnvoltura = null;
        this._onResize = null;
        this._subiendo = false;
        this._contextoReemplazo = '';
        // Fix 4.15.2: referencia al ojito (para que el arrastre lo ignore).
        this.ojo = null;
    }

    SelectorPMU.prototype.on = function (evento, cb) {
        this.oyentes[evento] = cb;
        if (evento === 'error') { this.onErrorCallback = cb; }
        return this;
    };

    SelectorPMU.prototype.onSelect = function (callback) {
        this.onSelectCallback = callback;
        return this;
    };

    SelectorPMU.prototype.onError = function (callback) {
        this.onErrorCallback = callback;
        return this;
    };

    SelectorPMU.prototype._emitir = function (evento, dato) {
        if (typeof this.oyentes[evento] === 'function') { this.oyentes[evento](dato); }
    };

    SelectorPMU.prototype._fallo = function (code, message) {
        var e = { code: code, message: message };
        if (typeof this.onErrorCallback === 'function') { this.onErrorCallback(message, e); }
        this._emitir('error', e);
    };

    /**
     * Abre el editor visual. Al abrirse dispara directamente el selector de
     * archivos (`abrirArchivo !== false`), salvo que se pase un archivo
     * precargado. `opciones.tituloContexto` muestra que imagen se reemplaza.
     */
    SelectorPMU.prototype.open = function (opciones) {
        var self = this;
        opciones = opciones || {};
        if (this.raiz) { return; }
        inyectarEstilos();
        this._focoPrevio = document.activeElement || null;
        this._contextoReemplazo = opciones.tituloContexto ? String(opciones.tituloContexto) : '';
        // Spec 030 (T014/4a clarificacion): el contexto del hueco (para `op=usar`) y si la
        // fuente viene de la BIBLIOTECA (entonces se puede ELEGIR sin recomponer). `_cambios`
        // se enciende con cualquier retoque: si no, el primario dice `Elegir` (0 bytes).
        this._hueco = opciones.hueco || null;
        this.config.usar = opciones.usar || this.config.usar || null;
        this._bibMadre = opciones.bibMadre ? String(opciones.bibMadre) : '';
        this._cambios = false;
        this._yaElegido = false;
        this._subiendo = false;
        this.raiz = document.createElement('div');
        this.raiz.className = 'spmu-modal';
        var tituloTxt = this._contextoReemplazo
            ? this._contextoReemplazo
            : 'Ajuste la imagen';
        this.raiz.innerHTML =
            '<div class="spmu-caja" role="dialog" aria-modal="true" aria-label="Ajuste de imagen">' +
            '<div class="spmu-cabecera">' +
            '<p class="spmu-titulo">' + tituloTxt + '</p>' +
            '<button type="button" class="spmu-x" aria-label="Cerrar">&#10005;</button>' +
            '</div>' +
            '<div class="spmu-escena-wrap"><div class="spmu-escena"></div></div>' +
            // Spec 030 (4a clarificacion): la tira de la biblioteca vive SIEMPRE visible
            // arriba (sin boton): si no hay fotos, no dibuja nada.
            '<div class="pmu-bib-contenedor" style="flex:1 0 100%"></div>' +
            // Spec 024 (D2): el badge de salida es tecnico: solo en la consola.
            (this.config.tecnico
                ? '<p class="spmu-badge"><span class="spmu-origen"></span><span class="spmu-salida"></span></p>'
                : '') +
            '<div class="spmu-controles">' +
            // Fila 1 (spec 028 D5): los 3 modos (tabla normativa de
            // `escalaBase`), con icono + etiqueta. Con el aspecto ya encajado
            // (<=5%) queda UN boton, "Ajustar al marco", que re-encuadra.
            '<div class="spmu-fila-mod">' +
            '<div class="spmu-modos" role="group" aria-label="Modo de encaje">' +
            '<button type="button" class="button spmu-modo-btn" data-modo="cubrir" title="' + TITULO_MODO.cubrir + '">' +
            '<span class="spmu-ico-modo" aria-hidden="true">' + ICO_MODO.cubrir + '</span>' +
            '<span class="spmu-modo-txt">Cubrir</span></button>' +
            '<button type="button" class="button spmu-modo-btn" data-modo="encajar" title="' + TITULO_MODO.encajar + '">' +
            '<span class="spmu-ico-modo" aria-hidden="true">' + ICO_MODO.encajar + '</span>' +
            '<span class="spmu-modo-txt">Encajar</span></button>' +
            '<button type="button" class="button spmu-modo-btn" data-modo="estirar" title="' + TITULO_MODO.estirar + '">' +
            '<span class="spmu-ico-modo" aria-hidden="true">' + ICO_MODO.estirar + '</span>' +
            '<span class="spmu-modo-txt">Estirar</span></button>' +
            '</div>' +
            '</div>' +
            // Fila 2 (D3): Escala al 100% del ancho, sin boton de reset.
            // Spec 028 (D3): vuelve el rango completo 0.25x-4x (la base la fija
            // el modo; la Escala es del comprador y el fondo tapa los huecos).
            '<div class="spmu-fila-escala">' +
            '<span class="spmu-lb-zoom">Escala</span>' +
            '<input type="range" class="spmu-zoom" aria-label="Escala" min="-100" max="100" step="1" value="0">' +
            '</div>' +
            // Fila 3 (D5/D6): fondo (color + damero + auto) y Girar.
            '<div class="spmu-fila-extra">' +
            '<span class="spmu-lb-fondo">Fondo ' +
            '<input type="color" class="spmu-fondo-color" value="#ffffff" aria-label="Color de fondo">' +
            '<button type="button" class="button spmu-fondo-transp" aria-pressed="false" title="Fondo transparente" aria-label="Fondo transparente"><span class="spmu-ico-damero" aria-hidden="true"></span></button>' +
            '<button type="button" class="button spmu-fondo-auto" hidden title="Volver al fondo automatico (segun los bordes de la foto)">auto</button>' +
            '</span>' +
            '<button type="button" class="button spmu-rotar" hidden>Girar</button>' +
            '</div>' +
            '</div>' +
            // Acciones (D7): cargar a la izquierda; Cancelar + Subir a la derecha.
            '<div class="spmu-acciones">' +
            '<div class="spmu-acciones-izq">' +
            '<button type="button" class="button spmu-elegir">Cargar imagen</button>' +
            '<input type="file" class="spmu-file" accept="' + ACEPTA + '" hidden>' +
            '' + // 4a clarificacion: se fue "Elegir ya subida" (la tira vive arriba, siempre visible)
            '' + // 4a clarificacion: el contenedor de la tira vive ARRIBA (uno solo)
            '</div>' +
            '<div class="spmu-acciones-der">' +
            '<button type="button" class="button-link spmu-cancelar">Cancelar</button>' +
            '<button type="button" class="button button-primary spmu-ok" disabled>Subir</button>' +
            '</div>' +
            '</div>' +
            '<p class="spmu-status" role="status" aria-live="polite"></p>' +
            '<div class="spmu-otra-modal" hidden>' +
            '<p class="spmu-otra-txt">Imagen subida correctamente. ¿Queres subir otra imagen?</p>' +
            '<div class="spmu-otra-botones">' +
            '<button type="button" class="button button-primary spmu-otra-si">Si, subir otra</button>' +
            '<button type="button" class="button spmu-otra-no">No, terminar</button>' +
            '</div>' +
            '</div>' +
            '</div>';
        document.body.appendChild(this.raiz);
        document.body.classList.add('spmu-bloqueado');

        var $ = function (sel) { return self.raiz ? self.raiz.querySelector(sel) : null; };
        this.escenaWrap = $('.spmu-escena-wrap');
        this.escena = $('.spmu-escena');
        this.txtOrigen = $('.spmu-origen');
        this.txtSalida = $('.spmu-salida');

        $('.spmu-x').addEventListener('click', function () {
            if (!self._subiendo) { self._cancelar(); }
        });
        $('.spmu-elegir').addEventListener('click', function () {
            if (!self._subiendo) { $('.spmu-file').click(); }
        });
        $('.spmu-file').addEventListener('change', function () {
            var f = this.files && this.files[0];
            this.value = '';
            if (f) { self._cargar(f); }
        });
        $('.spmu-zoom').addEventListener('input', function () {
            self._setZoom(sliderAZoom(this.value));
        });
        this._enlazarEventosDialogo($);
        this._montarEscena();
        this._onResize = function () {
            self._ajustarCajaEscena();
            self._pintarEnvoltura();
        };
        global.addEventListener('resize', this._onResize);

        if (opciones.archivo) {
            this._cargar(opciones.archivo);
        } else if (opciones.abrirArchivo !== false) {
                    // Spec 030 (4a clarificacion): el selector se auto-abre SOLO si la biblioteca
            // del comprador esta VACIA (copia local de la tira con `fotos: []`). Sin copia
            // NO se adivina: queda el boton "Cargar imagen".
            var bib = (window.PMUBiblioteca && window.PMUBiblioteca.cache) ? window.PMUBiblioteca.cache() : null;
            var bibVacia = !!(bib && bib.fotos && bib.fotos.length === 0);
            if (bibVacia) {
                try { $('.spmu-file').click(); } catch (e) { /* entorno sin click programatico */ }
            }
        }
    };

    /** Cierra por cancelacion: misma via que el boton Cancelar. */
    SelectorPMU.prototype._cancelar = function () {
        this.close();
        this._fallo('CROP_ABORTED', 'Cancelado por el usuario');
    };

    /** Estilos del dialogo (idempotente, sin archivo CSS extra). */
    var ESTILO_ID = 'spmu-estilos';
    function inyectarEstilos() {
        if (document.getElementById(ESTILO_ID)) { return; }
        var s = document.createElement('style');
        s.id = ESTILO_ID;
        s.textContent =
            '.spmu-modal{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:180000;display:flex;align-items:center;justify-content:center;padding:12px}' +
            '.spmu-bloqueado{overflow:hidden}' +
            '.spmu-caja{box-sizing:border-box;background:#fff;width:min(96vw,760px);max-height:94vh;overflow:auto;padding:16px;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.35);position:relative;display:flex;flex-direction:column}' +
            '.spmu-sobre{outline:3px dashed #2271b1;outline-offset:-6px}' +
            '.spmu-cabecera{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}' +
            '.spmu-titulo{margin:0;font-weight:600;font-size:15px}' +
            '.spmu-x{border:0;background:none;font-size:18px;line-height:1;cursor:pointer;padding:8px;min-width:44px;min-height:44px;color:#50575e}' +
            '.spmu-escena-wrap{display:flex;justify-content:center;align-items:center;width:100%;min-height:200px;max-height:min(58vh,1000px);overflow:hidden;padding:6px;box-sizing:border-box}' +
            '.spmu-escena{position:relative;display:flex;justify-content:center;align-items:center;touch-action:none;cursor:grab;user-select:none;background:repeating-conic-gradient(#e0e0e0 0 25%,#ffffff 0 50%) 0/20px 20px;max-width:1000px;max-height:1000px;overflow:hidden}' +
            '.spmu-escena:active{cursor:grabbing}' +
            // Fix 4.15.1: WordPress fuerza `display` a `.button`, que le gana a
            // `[hidden]{display:none}` del navegador (AGENTS §11). Con esto se
            // ocultan de verdad el ojito, `auto`, Girar y los modos.
            '.spmu-caja [hidden]{display:none !important}' +
            '.spmu-canvas{width:100%;height:100%;display:block}' +
            '.spmu-envoltura{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block}' +
            // Spec 024 (D9): ojito de inspeccion dentro de la escena.
            '.spmu-ojo{position:absolute;top:8px;right:8px;z-index:2;width:36px;height:36px;padding:0;border:0;border-radius:8px;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}' +
            '.spmu-ojo:hover{background:rgba(0,0,0,.78)}' +
            '.spmu-ojo[aria-pressed="true"]{background:#2271b1}' +
            '.spmu-ojo[hidden]{display:none}' +
            '.spmu-badge{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin:6px 0 0;color:#50575e;font-size:12px}' +
            '.spmu-controles{display:flex;flex-direction:column;gap:8px;margin:8px 0 0}' +
            '.spmu-fila-mod{display:flex;justify-content: center}' +
            '.spmu-modos{display:inline-flex;background:#f0f0f1;border:1px solid #dcdcde;border-radius:6px;overflow:hidden}' +
            '.spmu-modos[hidden]{display:none}' +
            '.spmu-modo-btn{flex:1 1 0;min-width:88px;border:0;border-right:1px solid #dcdcde;border-radius:0;background:transparent;display:inline-flex;align-items:center;justify-content:center;gap:6px}' +
            '.spmu-ico-modo{display:block;line-height:0}' +
            '.spmu-modo-btn:last-child{border-right:0}' +
            '.spmu-modo-btn.is-active{background:#2271b1;color:#fff;border-color:#2271b1}' +
            '.spmu-fila-escala{display:flex;align-items:center;gap:10px}' +
            '.spmu-lb-zoom{font-size:13px;font-weight:600;white-space:nowrap}' +
            '.spmu-zoom{flex:1 1 auto;width:100%;min-width:0;margin:0}' +
            '.spmu-fila-extra{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}' +
            '.spmu-lb-fondo{display:inline-flex;align-items:center;gap:6px;font-size:13px}' +
            '.spmu-fondo-color{width:32px;height:30px;padding:0;border:1px solid #c3c4c7;border-radius:4px;cursor:pointer;background:none}' +
            '.spmu-fondo-transp{width:32px;height:30px;padding:0;display:inline-flex;align-items:center;justify-content:center;border-radius:4px}' +
            '.spmu-ico-damero{display:block;width:16px;height:16px;border-radius:2px;border:1px solid #8c8f94;background:repeating-conic-gradient(#fff 0 25%,#bbb 0 50%) 0 0/8px 8px}' +
            '.spmu-fondo-auto{min-height:30px;padding:0 8px;font-size:12px;border-radius:4px}' +
            '.spmu-fondo-auto[hidden]{display:none}' +
            '.spmu-fondo-transp.is-active{background:#2271b1;border-color:#2271b1}' +
            '.spmu-acciones{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:10px 0 0;flex-wrap:wrap}' +
            '.spmu-acciones-izq,.spmu-acciones-der{display:flex;align-items:center;gap:8px;flex-wrap:wrap}' +
            '.spmu-status{margin:6px 0 0;color:#1d2327;font-size:13px;font-weight:500;min-height:18px}' +
            '.spmu-otra-modal{position:absolute;inset:0;background:rgba(255,255,255,.96);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;z-index:5;border-radius:10px}' +
            '.spmu-otra-modal[hidden]{display:none}' +
            '.spmu-otra-txt{font-size:16px;font-weight:600;margin:0 0 16px;color:#1d2327}' +
            '.spmu-otra-botones{display:flex;gap:10px;flex-wrap:wrap;justify-content:center}' +
            '.spmu-cargando .spmu-escena{opacity:.45}' +
            '.spmu-cargando .spmu-escena::after{content:"";position:absolute;inset:0;margin:auto;width:36px;height:36px;border:4px solid #c3c4c7;border-top-color:#2271b1;border-radius:50%;animation:spmu-giro 1s linear infinite}' +
            '@keyframes spmu-giro{to{transform:rotate(360deg)}}' +
            '@media (max-width:767px){' +
            '.spmu-modal{padding:0;align-items:stretch}' +
            '.spmu-caja{max-width:none;width:100%;height:100vh;height:100dvh;max-height:none;border-radius:0;padding:calc(10px + env(safe-area-inset-top)) 12px calc(10px + env(safe-area-inset-bottom))}' +
            '.spmu-escena-wrap{flex:1;min-height:180px;max-height:none}' +
            '.spmu-acciones .button,.spmu-acciones .button-link{min-height:44px}' +
            '}';
        document.head.appendChild(s);
    }

    /**
     * Spec 028 (D6): devuelve la composicion al encaje por defecto: el modo del
     * caso (<=5% -> `estirar`), Escala 1x y sin desplazamiento. Lo dispara el
     * boton unico "Ajustar al marco" (aspecto ya encajado), que no es un modo
     * sino un RE-ENCUADRE: si el comprador movio o acerco la foto, vuelve al
     * encaje inicial. La rotacion no se toca (es un control aparte).
     */
    SelectorPMU.prototype._reencuadrar = function () {
        this.config.mode = this.supera5 ? 'cubrir' : 'estirar';
        this.desplazamiento = { x: 0, y: 0 };
        this._actualizarControlesModo();
        this._setZoom(1);
    };

    SelectorPMU.prototype._enlazarEventosDialogo = function ($) {
        var self = this;
        [].slice.call(this.raiz.querySelectorAll('.spmu-modo-btn')).forEach(function (btn) {
            btn.addEventListener('click', function () {
                // Spec 028 (D6): el boton unico del caso <=5% re-encuadra.
                if (btn.getAttribute('data-accion') === 'reencuadrar') {
                    self._reencuadrar();
                    return;
                }
                var m = btn.getAttribute('data-modo');
                if (m) {
                    self.config.mode = m;
                    self.desplazamiento = { x: 0, y: 0 };
                    self._actualizarControlesModo();
                    // Spec 024 (D4): al cambiar de modo, la Escala vuelve al medio.
                    self._setZoom(1);
                }
            });
        });
        $('.spmu-fondo-color').addEventListener('input', function () {
            self.colorFondo = this.value || '#ffffff';
            self.fondoEsAuto = false;   // Spec 024 (D5): deja de ser automatico.
            self._actualizarControlesFondo();
            self._dibujar();
        });
        $('.spmu-fondo-transp').addEventListener('click', function () {
            // Spec 027 (D2): con `transp:'no'` el fondo transparente no existe.
            if (self.config.transp === 'no') { return; }
            if (self.colorFondo === 'transparent') {
                self.colorFondo = self.fondoAuto;   // vuelve al detectado
                self.fondoEsAuto = true;
            } else {
                self.colorFondo = 'transparent';
                self.fondoEsAuto = false;
            }
            self._actualizarControlesFondo();
            self._dibujar();
        });
        // Spec 024 (D5): volver al fondo automatico (bordes de la foto).
        $('.spmu-fondo-auto').addEventListener('click', function () {
            self.colorFondo = self.fondoAuto;
            self.fondoEsAuto = true;
            self._actualizarControlesFondo();
            self._dibujar();
        });
        $('.spmu-rotar').addEventListener('click', function () { self._rotar(); });
        $('.spmu-ok').addEventListener('click', function () { self._aceptar(); });
        // Spec 030 (T013): "Elegir ya subida" abre la tira de la biblioteca; la foto
        // elegida entra al modal por el MISMO camino que un arrastre, asi no se
        // duplica la logica de archivo elegido.
        var btnBib = null; // 4a clarificacion: la tira vive siempre visible (sin boton)
        var cajaBib = $('.pmu-bib-contenedor');
        if (cajaBib && window.PMUBiblioteca) {
            (function () { // 4a clarificacion: la tira se monta al ABRIR (ya no hay boton)
                cajaBib.hidden = false;
                if (!cajaBib.childElementCount) { cajaBib.textContent = 'Cargando tus imagenes...'; }

                window.PMUBiblioteca.tira(cajaBib, {
                    onElegir: function (foto) {
                        // Spec 030 (D8): la fuente viene de la BIBLIOTECA: si el comprador
                        // no toca la composicion, el primario dira `Elegir` (0 bytes).
                        self._bibMadre = String((foto && foto.madre) || '');
                        window.fetch(foto.url, { credentials: 'same-origin' })
                            .then(function (r) { return r.blob(); })
                            .then(function (b) {
                                var f = new File([b], 'biblioteca.webp', { type: b.type || 'image/webp' });
                                var dt = new DataTransfer();
                                dt.items.add(f);
                                var zona = $('.spmu-escena') || $('.spmu-caja');
                                if (zona) {
                                    zona.dispatchEvent(new DragEvent('drop',
                                        { bubbles: true, cancelable: true, dataTransfer: dt }));
                                }
                            })
                            .catch(function () { });
                    }
                });
            })();
        }
        $('.spmu-cancelar').addEventListener('click', function () {
            if (!self._subiendo) { self._cancelar(); }
        });
        $('.spmu-otra-si').addEventListener('click', function () {
            var mOtra = $('.spmu-otra-modal');
            if (mOtra) { mOtra.hidden = true; }
            self._prepararNuevaCarga();
            $('.spmu-file').click();
        });
        $('.spmu-otra-no').addEventListener('click', function () { self.close(); });

        var caja = $('.spmu-caja');
        caja.addEventListener('dragover', function (e) {
            e.preventDefault();
            caja.classList.add('spmu-sobre');
        });
        caja.addEventListener('dragleave', function () { caja.classList.remove('spmu-sobre'); });
        caja.addEventListener('drop', function (e) {
            e.preventDefault();
            caja.classList.remove('spmu-sobre');
            var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
            if (f && !self._subiendo) { self._cargar(f); }
        });
        this.raiz.addEventListener('click', function (e) {
            if (e.target === self.raiz && !self._subiendo) { self._cancelar(); }
        });
        this._onKey = function (e) {
            if (e.key === 'Escape' && !self._subiendo) { self._cancelar(); return; }
            if (e.key === 'Tab' && self.raiz) { self._trampaFoco(e); }
        };
        document.addEventListener('keydown', this._onKey);
    };

    SelectorPMU.prototype._prepararNuevaCarga = function () {
        if (this.imagen && this.imagen.src) { URL.revokeObjectURL(this.imagen.src); }
        this.imagen = null;
        this.archivoOrigen = null;
        this.desplazamiento = { x: 0, y: 0 };
        this.zoom = 1;
        this.rotacion = 0;
        // Spec 024 (D9): una carga nueva arranca sin la mascara de inspeccion.
        this._mascaraRecorte = false;
        if (!this.raiz) { return; }
        var elegir = this.raiz.querySelector('.spmu-elegir');
        if (elegir) { elegir.textContent = 'Cargar imagen'; }
        var ok = this.raiz.querySelector('.spmu-ok');
        if (ok) { ok.disabled = true; ok.textContent = 'Subir'; }
        var zIn = this.raiz.querySelector('.spmu-zoom');
        if (zIn) { zIn.value = '0'; }
        this._estado(null);
        this._dibujar();
    };

    SelectorPMU.prototype._cargar = function (archivo) {
        var self = this;
        if (!archivo) { return; }
        var tipo = String(archivo.type || '');
        var ext = String(archivo.name || '').split('.').pop().toLowerCase();
        if (TIPOS.indexOf(tipo) === -1 && EXTS.indexOf(ext) === -1) {
            this._fallo('INVALID_TYPE', 'Formato no permitido');
            return;
        }
        this._estado('cargando');
        this._emitir('progress', { percentage: 10 });
        var url = URL.createObjectURL(archivo);
        var img = new Image();
        img.onload = function () {
            if (self.imagen && self.imagen.src && self.imagen.src !== url) { URL.revokeObjectURL(self.imagen.src); }
            self.imagen = img;
            self.archivoOrigen = archivo;
            self.desplazamiento = { x: 0, y: 0 };
            self.zoom = 1;
            self.rotacion = 0;
            // Spec 024 (D5): recordar el color detectado de los bordes y si el
            // fondo es automatico (el boton "auto" aparece solo si NO lo es).
            self.fondoAuto = detectarColorBordes(img);
            // Spec 027 (D3/D4/D6): resolver el fondo segun la politica del campo.
            // La funcion pura `resolverFondo` decide (se testea en Node).
            self.alfaReal = tieneAlfaReal(img);
            var colorSolido = self._colorSolidoDeBordes(img);
            if (self.config.fondo && self.config.fondo !== 'auto') {
                // D5: el color elegido por el campo/cliente manda; la politica
                // solo decide si puede haber transparencia.
                self.colorFondo = (self.config.transp === 'no')
                    ? (self.config.fondo === 'transparent' ? '#ffffff' : self.config.fondo)
                    : self.config.fondo;
                self.fondoEsAuto = false;
            } else {
                self.colorFondo = resolverFondo(
                    self.config.transp,
                    self.fondoAuto,
                    colorSolido,
                    self.alfaReal,
                    self.config.fondo
                );
                self.fondoEsAuto = true;
            }
            // El "auto" recuerda el color para el boton "auto" (spec 024 D5).
            self.fondoAuto = resolverFondo(
                self.config.transp,
                self.fondoAuto,
                colorSolido,
                self.alfaReal,
                'auto'
            );
            // Spec 027 (D2): con `transp:'no'` el boton "damero" no existe, asi
            // que el fondo nunca puede quedarse en transparente.
            if (self.config.transp === 'no' && self.colorFondo === 'transparent') {
                self.colorFondo = '#ffffff';
            }
            // Spec 030 (D8): composicion de REFERENCIA al cargar la imagen. Si el comprador
            // no la toca, el primario puede ELEGIR (0 bytes) y no recomponer ni subir.
            self._paramsBase = JSON.stringify(self._params());
            self.supera5 = superaCincoPorciento(
                img.naturalWidth || 1, img.naturalHeight || 1,
                self.config.finalW, self.config.finalH
            );
            // Spec 028 (D5): default de cada caso. >5% -> `cubrir` (nunca deja
            // huecos); <=5% -> `estirar` (llena el marco exacto con una
            // deformacion imperceptible y el boton pasa a ser "Ajustar al marco").
            self.config.mode = self.supera5 ? 'cubrir' : 'estirar';
            if (self.raiz) {
                var rango = self.raiz.querySelector('.spmu-zoom');
                if (rango) { rango.value = '0'; }
                var elegir = self.raiz.querySelector('.spmu-elegir');
                if (elegir) { elegir.textContent = 'Cambiar imagen'; }
                var ok = self.raiz.querySelector('.spmu-ok');
                if (ok) { ok.disabled = false; ok.textContent = 'Subir'; }
            }
            self._estado(null);
            self._actualizarControlesModo();
            self._actualizarControlesFondo();
            self._dibujar();
            self._emitir('progress', { percentage: 100 });
        };
        img.onerror = function () {
            URL.revokeObjectURL(url);
            self._estado('error');
            self._fallo('UPLOAD_FAILED', 'No se pudo leer la imagen');
        };
        img.src = url;
    };

    SelectorPMU.prototype._estado = function (estado) {
        if (!this.raiz) { return; }
        var st = this.raiz.querySelector('.spmu-status');
        var caja = this.raiz.querySelector('.spmu-caja');
        if (caja) { caja.classList.toggle('spmu-cargando', estado === 'cargando' || estado === 'subiendo'); }
        if (estado === 'cargando') {
            if (st) { st.textContent = 'Cargando imagen...'; }
        } else if (estado === 'subiendo') {
            if (st) { st.textContent = 'Subiendo imagen, espera un momento...'; }
        } else if (estado === 'error') {
            if (st) { st.textContent = 'No se pudo leer la imagen.'; }
        } else {
            if (st) { st.textContent = ''; }
        }
    };

    /**
     * Spec 030 (T014/D7): los `params` del hueco tal como los hashea el servidor
     * (`PMU_Sesion::receta_de`): MISMOS nombres y MISMOS valores que el PNG de salida.
     * Es lo que permite decidir Elegir (receta igual -> `ref`, 0 bytes) vs Subir
     * (composicion nueva). Si esto cambia, el servidor lo detecta y NO reusa.
     */
    SelectorPMU.prototype._params = function () {
        var dim = this._dimensionesImagen ? this._dimensionesImagen() : { w: 1, h: 1 };
        var disp = this.desplazamiento || { x: 0, y: 0 };
        var fondo = (this.colorFondo === 'transparent') ? 'transparent' : (this.colorFondo || 'auto');
        return {
            w: Math.max(1, parseInt(this.config.finalW, 10) || 1),
            h: Math.max(1, parseInt(this.config.finalH, 10) || 1),
            forma: String(this.config.forma || 'auto'),
            modo: modoCanonico(this.config.mode),
            escala: this.zoom || 1,
            dx: disp.x || 0,
            dy: disp.y || 0,
            fondo: fondo,
            transp: String(this.config.transp || ''),
            iw: dim.w,
            ih: dim.h
        };
    };

    SelectorPMU.prototype._dimensionesImagen = function () {
        if (!this.imagen) { return { w: 1, h: 1 }; }
        var iw = Math.max(1, this.imagen.naturalWidth || this.imagen.width || 1);
        var ih = Math.max(1, this.imagen.naturalHeight || this.imagen.height || 1);
        return (Math.abs(this.rotacion % 180) === 90) ? { w: ih, h: iw } : { w: iw, h: ih };
    };

    SelectorPMU.prototype._actualizarControlesModo = function () {
        if (!this.raiz) { return; }
        var self = this;
        var modosEl = this.raiz.querySelector('.spmu-modos');
        var rotarEl = this.raiz.querySelector('.spmu-rotar');
        var tieneImg = !!this.imagen;
        // Spec 028 (D5/D6): con el aspecto ya encajado (<=5%) los 3 modos hacen
        // casi lo mismo, asi que no se le dan opciones que no hacen nada: queda
        // UN boton, "Ajustar al marco", que RE-ENCUADRA. Con >5% se muestran los
        // 3 (Cubrir / Encajar / Estirar).
        var soloAjuste = tieneImg && !this.supera5;
        if (modosEl) {
            [].slice.call(modosEl.querySelectorAll('.spmu-modo-btn')).forEach(function (btn) {
                var m = btn.getAttribute('data-modo');
                // El boton que persiste en el caso <=5% es el de `estirar`: es
                // el modo por defecto de ese caso (llena el marco exacto).
                var esElUnico = (m === 'estirar');
                btn.hidden = soloAjuste ? !esElUnico : false;
                var txt = btn.querySelector('.spmu-modo-txt');
                if (esElUnico) {
                    if (soloAjuste) {
                        btn.setAttribute('data-accion', 'reencuadrar');
                        btn.title = TITULO_REENCUADRE;
                        if (txt) { txt.textContent = 'Ajustar al marco'; }
                    } else {
                        btn.removeAttribute('data-accion');
                        btn.title = TITULO_MODO.estirar;
                        if (txt) { txt.textContent = 'Estirar'; }
                    }
                }
                var activo;
                if (esElUnico && soloAjuste) {
                    // Activo = la composicion ya esta en el encaje por defecto.
                    activo = (self.config.mode === 'estirar')
                        && (!self.desplazamiento || (!self.desplazamiento.x && !self.desplazamiento.y))
                        && Math.abs((self.zoom || 1) - 1) < 0.001;
                } else {
                    activo = (m === self.config.mode);
                }
                btn.classList.toggle('is-active', activo);
                btn.setAttribute('aria-pressed', activo ? 'true' : 'false');
            });
        }
        if (rotarEl) {
            // Fix 4.15.1 (D6): Girar solo si el admin lo habilita (`r: 1`) Y el
            // lienzo NO es cuadrado (en 1:1 girar no cambia la cobertura).
            rotarEl.hidden = !(tieneImg && this.config.rotar
                && this.config.finalW !== this.config.finalH);
        }
    };

    SelectorPMU.prototype._actualizarControlesFondo = function () {
        if (!this.raiz) { return; }
        var inColor = this.raiz.querySelector('.spmu-fondo-color');
        var btnTr = this.raiz.querySelector('.spmu-fondo-transp');
        var btnAuto = this.raiz.querySelector('.spmu-fondo-auto');
        var esTransp = (this.colorFondo === 'transparent');
        // Spec 027 (D2): con `transp:'no'` el fondo transparente no existe: el
        // boton "damero" se oculta (no se puede ni ver ni pulsar).
        if (btnTr) {
            btnTr.hidden = (this.config.transp === 'no');
        }
        if (inColor && !esTransp && /^#[0-9a-f]{6}$/i.test(this.colorFondo)) {
            inColor.value = this.colorFondo;
        }
        if (btnTr) {
            btnTr.classList.toggle('is-active', esTransp);
            btnTr.setAttribute('aria-pressed', esTransp ? 'true' : 'false');
        }
        // Spec 024 (D5): "auto" solo esta disponible si el fondo NO lo es.
        if (btnAuto) { btnAuto.hidden = this.fondoEsAuto; }
    };

    /**
     * Spec 028 (D3): fija la Escala (0.25x-4x). La base la define el modo
     * (`escalaBase`) y la Escala es del comprador: acercar recorta mas fino y
     * alejar deja ver el fondo (por eso existe el control Fondo). Mantiene el
     * slider sincronizado.
     */
    SelectorPMU.prototype._setZoom = function (z) {
        var v = parseFloat(z);
        if (!isFinite(v)) { v = 1; }
        this.zoom = Math.max(0.25, Math.min(4, v));
        var zIn = this.raiz ? this.raiz.querySelector('.spmu-zoom') : null;
        if (zIn) { zIn.value = String(zoomASlider(this.zoom)); }
        this._dibujar();
        return this.zoom;
    };

    SelectorPMU.prototype._cajaImagenModo = function () {
        var dim = this._dimensionesImagen();
        var base = escalaBase(
            this.config.mode, dim.w, dim.h,
            this.config.finalW, this.config.finalH
        );
        return { dw: base.dw * this.zoom, dh: base.dh * this.zoom };
    };

    SelectorPMU.prototype._pintarImagenEnContexto = function (ctx, conMargen) {
        if (!ctx) { return; }
        var geo = this.geo || geometriaEscena(this.config.finalW, this.config.finalH, this.config);
        var ox = conMargen ? geo.margenX : 0;
        var oy = conMargen ? geo.margenY : 0;
        var w = this.config.finalW;
        var h = this.config.finalH;
        ctx.clearRect(0, 0, conMargen ? geo.canvasW : w, conMargen ? geo.canvasH : h);
        // Spec 027 (D7): el fondo que se dibuja aqui decide el alfa de salida.
        // Con `transp:'no'` NUNCA se dibuja un fondo transparente (barrera
        // final): aunque el estado interno quedara en "transparent", el fondo
        // va a blanco puro.
        var colorFondo = this.colorFondo;
        if (this.config.transp === 'no' && colorFondo === 'transparent') {
            colorFondo = '#ffffff';
        }
        if (colorFondo && colorFondo !== 'transparent') {
            ctx.fillStyle = colorFondo;
            ctx.fillRect(ox, oy, w, h);
        }
        if (!this.imagen) { return; }
        var caja = this._cajaImagenModo();
        // Spec 024 (D10 + fix 4.15.3): el zoom crece desde el centro de la
        // envoltura; el desplazamiento se escala por el zoom para que el punto
        // de la foto bajo ese centro no se mueva.
        var origen = origenDibujo(geo, conMargen, this.desplazamiento, this.zoom);
        ctx.save();
        ctx.translate(origen.x, origen.y);
        if (this.rotacion) { ctx.rotate((this.rotacion * Math.PI) / 180); }
        var rot90 = (Math.abs(this.rotacion % 180) === 90);
        var drawW = rot90 ? caja.dh : caja.dw;
        var drawH = rot90 ? caja.dw : caja.dh;
        ctx.drawImage(this.imagen, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
    };

    /**
     * Spec 030 (D8): el primario dice `Elegir` (0 bytes) cuando la fuente es una foto
     * de la biblioteca y la composicion NO se toco; en cualquier otro caso, `Subir`.
     */
    SelectorPMU.prototype._actualizarPrimario = function () {
        if (!this.raiz || this._subiendo) { return; }
        var ok = this.raiz.querySelector('.spmu-ok');
        if (!ok) { return; }
        var puede = !!(this._bibMadre && this.config.usar && this._paramsBase
            && this._paramsBase === JSON.stringify(this._params()));
        ok.textContent = puede ? 'Elegir' : 'Subir';
    };

    SelectorPMU.prototype._dibujar = function () {
        if (!this.ctx) { return; }
        this._pintarImagenEnContexto(this.ctx, true);
        this._pintarEnvoltura();
        this._badge();
        this._actualizarPrimario();
    };

    SelectorPMU.prototype._ajustarCajaEscena = function () {
        if (!this.escena) { return; }
        var wrap = this.escenaWrap || this.escena.parentNode;
        var dispW = (wrap && wrap.clientWidth > 20) ? (wrap.clientWidth - 12) : 640;
        var dispH = (wrap && wrap.clientHeight > 20) ? (wrap.clientHeight - 12) : 480;
        var med = calcularCajaEscena(this.config.finalW, this.config.finalH, dispW, dispH);
        this.escena.style.width = med.w + 'px';
        this.escena.style.height = med.h + 'px';
        this.escena.style.aspectRatio = this.config.finalW + ' / ' + this.config.finalH;
    };

    SelectorPMU.prototype._montarEscena = function () {
        if (!this.raiz || !this.escena) { return; }
        this.geo = geometriaEscena(this.config.finalW, this.config.finalH, this.config);
        this.escena.innerHTML =
            '<canvas class="spmu-canvas" width="' + this.geo.canvasW + '" height="' + this.geo.canvasH + '"></canvas>' +
            '<canvas class="spmu-envoltura" width="' + this.geo.canvasW + '" height="' + this.geo.canvasH + '" aria-hidden="true"></canvas>' +
            // Spec 024 (D9): ojito de inspeccion (arriba a la derecha).
            '<button type="button" class="spmu-ojo" hidden aria-pressed="false" title="Ver solo el recorte" aria-label="Ver solo el recorte">' + ICO_OJO + '</button>';
        this.canvas = this.escena.querySelector('.spmu-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.cvEnvoltura = this.escena.querySelector('.spmu-envoltura');
        this.ctxEnvoltura = this.cvEnvoltura ? this.cvEnvoltura.getContext('2d') : null;
        this._ajustarCajaEscena();
        this._enlazarGestosEscena();
        this._enlazarOjo();
        this._actualizarControlesModo();
        this._actualizarControlesFondo();
        this._actualizarOjo();
        this._dibujar();
    };

    /** Spec 024 (D9) + fix 4.15.2: el ojito alterna la mascara de inspeccion. */
    SelectorPMU.prototype._enlazarOjo = function () {
        var self = this;
        var ojo = this.escena ? this.escena.querySelector('.spmu-ojo') : null;
        if (!ojo) { return; }
        this.ojo = ojo;
        // Fix 4.15.2: el `pointerdown` de la escena arranca el arrastre y hace
        // `setPointerCapture`, y entonces el `click` NUNCA llega al boton (por
        // eso solo funcionaba con la barra espaciadora). El gesto se corta aca.
        ojo.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
        ojo.addEventListener('click', function (e) {
            e.stopPropagation();
            self._mascaraRecorte = !self._mascaraRecorte;
            self._actualizarOjo();
            self._pintarEnvoltura();
        });
    };

    /**
     * Spec 024 (D9, fix 4.15.1): el ojito solo tiene sentido si la forma
     * **recorta**. El criterio es por TIPO de forma, NO por la caja: un circulo
     * de 1000x1000 dentro de un cuadrado de 1000x1000 recorta las esquinas
     * aunque su caja coincida con el placeholder (comparar cajas lo ocultaba
     * siempre). Si cubre todo (rectangulo 100% centrado) no se muestra: seria un
     * boton muerto.
     */
    SelectorPMU.prototype._actualizarOjo = function () {
        var ojo = this.escena ? this.escena.querySelector('.spmu-ojo') : null;
        if (!ojo) { return; }
        var geo = this.geo || geometriaEscena(this.config.finalW, this.config.finalH, this.config);
        var recorta = geo.principal.tipo !== 'rectangulo'
            || this.config.size < 1
            || this.config.ox !== 0
            || this.config.oy !== 0;
        if (!recorta) { this._mascaraRecorte = false; }
        ojo.hidden = !recorta;
        ojo.setAttribute('aria-pressed', this._mascaraRecorte ? 'true' : 'false');
        ojo.innerHTML = this._mascaraRecorte ? ICO_OJO_TACHADO : ICO_OJO;
        ojo.title = this._mascaraRecorte ? 'Ver la foto completa' : 'Ver solo el recorte';
        ojo.setAttribute('aria-label', ojo.title);
    };

    SelectorPMU.prototype._enlazarGestosEscena = function () {
        var self = this;
        if (!this.escena || this.escena._pmuGestos) { return; }
        this.escena._pmuGestos = true;

        this.escena.addEventListener('pointerdown', function (e) {
            if (!self.imagen || self._subiendo) { return; }
            // Fix 4.15.2: el ojito (y su <svg> interno) NO arrastran la foto.
            if (self.ojo && self.ojo.contains && self.ojo.contains(e.target)) { return; }
            self._punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
            var ids = Object.keys(self._punteros);
            if (ids.length === 1) {
                self._arrastrando = {
                    x: e.clientX, y: e.clientY,
                    dx: self.desplazamiento.x, dy: self.desplazamiento.y
                };
            } else if (ids.length === 2) {
                self._arrastrando = null;
                var p1 = self._punteros[ids[0]];
                var p2 = self._punteros[ids[1]];
                self._pinch = { dist: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, zoom: self.zoom };
            }
            if (self.escena.setPointerCapture) {
                try { self.escena.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
            }
        });

        this.escena.addEventListener('pointermove', function (e) {
            if (!self._punteros[e.pointerId]) { return; }
            self._punteros[e.pointerId] = { x: e.clientX, y: e.clientY };
            var ids = Object.keys(self._punteros);
            if (ids.length === 2 && self._pinch) {
                var p1 = self._punteros[ids[0]];
                var p2 = self._punteros[ids[1]];
                var d = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
                self._setZoom(self._pinch.zoom * (d / self._pinch.dist));
                return;
            }
            if (!self._arrastrando || !self.canvas) { return; }
            var caja = self.canvas.getBoundingClientRect();
            var escala = caja.width > 0 ? self.canvas.width / caja.width : 1;
            // Fix 4.15.3: el desplazamiento se guarda en unidades del lienzo a
            // zoom 1 (al dibujar se multiplica por el zoom), asi el arrastre
            // sigue 1:1 con el dedo/mouse en cualquier escala.
            var k = escala / (self.zoom || 1);
            self.desplazamiento.x = self._arrastrando.dx + (e.clientX - self._arrastrando.x) * k;
            self.desplazamiento.y = self._arrastrando.dy + (e.clientY - self._arrastrando.y) * k;
            self._dibujar();
        });

        function finPuntero(e) {
            delete self._punteros[e.pointerId];
            if (Object.keys(self._punteros).length < 2) { self._pinch = null; }
            if (Object.keys(self._punteros).length === 0) { self._arrastrando = null; }
        }
        this.escena.addEventListener('pointerup', finPuntero);
        this.escena.addEventListener('pointercancel', finPuntero);

        this.escena.addEventListener('wheel', function (e) {
            if (!self.imagen || self._subiendo) { return; }
            e.preventDefault();
            var delta = e.deltaY < 0 ? 0.08 : -0.08;
            self._setZoom(self.zoom * (1 + delta));
        }, { passive: false });
    };

    SelectorPMU.prototype._trazarPrincipal = function (ctx, prin) {
        var env = this.config.envoltura;
        var core = global.PMUMockup;
        if (prin.tipo === 'envoltura' && env && core
            && typeof core.comandosEnvoltura === 'function'
            && typeof core.trazarEnvoltura === 'function') {
            var cmds = core.comandosEnvoltura(env, { x: prin.x, y: prin.y, w: prin.w, h: prin.h });
            if (cmds.length) {
                core.trazarEnvoltura(ctx, cmds);
                return env.par ? 'evenodd' : 'nonzero';
            }
        }
        ctx.beginPath();
        if (prin.tipo === 'circulo' || prin.tipo === 'ovalo') {
            if (typeof ctx.ellipse === 'function') {
                ctx.ellipse(prin.cx, prin.cy, Math.max(1, prin.rx), Math.max(1, prin.ry), 0, 0, Math.PI * 2);
            } else {
                ctx.arc(prin.cx, prin.cy, Math.max(1, Math.min(prin.rx, prin.ry)), 0, Math.PI * 2);
            }
        } else {
            ctx.rect(prin.x, prin.y, prin.w, prin.h);
        }
        return 'nonzero';
    };

    SelectorPMU.prototype._pintarEnvoltura = function () {
        var cv = this.cvEnvoltura;
        var ctx = this.ctxEnvoltura;
        if (!cv || !ctx) { return; }
        var geo = this.geo || geometriaEscena(this.config.finalW, this.config.finalH, this.config);
        var cw = geo.canvasW;
        var ch = geo.canvasH;
        var sec = geo.secundario;
        var prin = geo.principal;

        ctx.clearRect(0, 0, cw, ch);

        // Spec 024 (D9): con la mascara de inspeccion, TODO lo que queda fuera
        // de la forma se pinta blanco OPACO: se ve solo el recorte final.
        // Sin mascara no hay relleno: la zona libre queda TRANSPARENTE (D8),
        // solo con los contornos (antes se oscurecia la foto con dos velos).
        if (this._mascaraRecorte) {
            ctx.save();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cw, ch);
            ctx.globalCompositeOperation = 'destination-out';
            var regla = this._trazarPrincipal(ctx, prin);
            ctx.fill(regla);
            ctx.restore();
        }

        // Contorno del recorte secundario (placeholder WxH): blanco sobre la
        // foto, GRIS sobre la mascara blanca (si no, no se veria).
        ctx.save();
        ctx.strokeStyle = this._mascaraRecorte ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = Math.max(1, Math.round(Math.max(cw, ch) / 300));
        ctx.strokeRect(sec.x + 0.5, sec.y + 0.5, sec.w - 1, sec.h - 1);
        ctx.restore();

        ctx.save();
        this._trazarPrincipal(ctx, prin);
        ctx.strokeStyle = '#2271b1';
        ctx.lineWidth = Math.max(1.5, Math.round(Math.max(cw, ch) / 220));
        if (ctx.setLineDash) { ctx.setLineDash([6, 4]); }
        ctx.stroke();
        if (ctx.setLineDash) { ctx.setLineDash([]); }
        ctx.restore();
    };

    /** Spec 021 (D6) + fix 4.15.1: Girar 90 grados (solo si el lienzo no es 1:1). */
    SelectorPMU.prototype._rotar = function () {
        if (!this.imagen || !this.config.rotar) { return; }
        if (this.config.finalW === this.config.finalH) { return; }
        this.rotacion = (this.rotacion + 90) % 360;
        // Fix 4.15.1 + spec 028: al girar cambia la relacion de aspecto de la
        // foto, asi que se recalcula la regla del 5% (puede pasar de "Ajustar al
        // marco" a los 3 modos, y al reves). Si la foto estaba en `estirar`
        // (que deforma) y ahora el aspecto difiere, pasa a `cubrir` para no
        // deformarla sin querer.
        var dim = this._dimensionesImagen();
        this.supera5 = superaCincoPorciento(dim.w, dim.h, this.config.finalW, this.config.finalH);
        if (this.supera5 && this.config.mode === 'estirar') {
            this.config.mode = 'cubrir';
        }
        this._actualizarControlesModo();
        this._dibujar();
    };

    SelectorPMU.prototype._badge = function () {
        if (this.txtOrigen) {
            this.txtOrigen.textContent = this.imagen
                ? ('Origen ' + this.imagen.naturalWidth + 'x' + this.imagen.naturalHeight + ' px')
                : '';
        }
        if (!this.txtSalida) { return; }
        var z = this.zoom || 1;
        // Spec 028 (D4/D11): el badge muestra el tamano REAL del PNG (el lienzo
        // acotado a la resolucion de la foto), el modo vigente y la Escala. Con
        // `k < 1` se agrega el porcentaje respecto del hueco (es un dato tecnico
        // de la consola: la ficha no lo ve).
        var dim = this._dimensionesImagen();
        var med = escalaSalida(
            this.config.mode, dim.w, dim.h,
            this.config.finalW, this.config.finalH, z
        );
        this.txtSalida.textContent =
            'Salida ' + med.w + 'x' + med.h + ' px'
            + (med.k < 1 ? ' (' + Math.round(med.k * 100) + '% del hueco)' : '')
            + ' · ' + this.config.mode + ' · zoom x' + z.toFixed(2);
    };

    SelectorPMU.prototype._trampaFoco = function (e) {
        var caja = this.raiz ? this.raiz.querySelector('.spmu-caja') : null;
        if (!caja) { return; }
        var focos = [].slice.call(
            caja.querySelectorAll('button, input:not([type=file]), select, [tabindex]:not([tabindex="-1"])')
        ).filter(function (el) { return !el.hidden && !el.disabled; });
        if (!focos.length) { e.preventDefault(); return; }
        var primero = focos[0];
        var ultimo = focos[focos.length - 1];
        var activo = document.activeElement;
        if (!caja.contains(activo)) {
            e.preventDefault();
            (e.shiftKey ? ultimo : primero).focus();
            return;
        }
        if (activo === ultimo && !e.shiftKey) { e.preventDefault(); primero.focus(); }
        else if (activo === primero && e.shiftKey) { e.preventDefault(); ultimo.focus(); }
    };

    /**
     * Spec 028 (D4 + D11): el PNG mide el **lienzo acotado a la resolucion de la
     * foto** (`W·k x H·k`, ver `escalaSalida`). El lienzo es el hueco del PDF
     * (lo resuelve `phsize`), asi que:
     *
     * - con una foto **grande** (lo tipico) `k = 1` y el PNG mide el lienzo: el
     *   Motor encaja contain+centrado (`Imagen::encajado`) **1:1**;
     * - con una foto **mas chica que la caja** el PNG se acota (no se inventan
     *   pixeles): sigue teniendo el **aspecto del lienzo**, asi que el Motor lo
     *   escala de forma **uniforme** al insertarlo y el **encuadre es el mismo**
     *   (modo, Escala y desplazamiento intactos). Por eso la vista previa sigue
     *   siendo el PDF: solo baja la resolucion, que es la que el PDF mostraria.
     *
     * Antes (spec 025 D5) el PNG media `min(caja, lienzo)` y el dibujo se
     * centraba en el LIENZO: con un lienzo no cuadrado la ventana y el centro no
     * coincidian, el recorte salia corrido y el Motor lo reencajaba.
     */
    SelectorPMU.prototype._generarLienzoSalida = function () {
        if (!global.document) { return this.canvas || null; }
        var med;
        if (this.imagen) {
            var dim = this._dimensionesImagen();
            med = escalaSalida(
                this.config.mode, dim.w, dim.h,
                this.config.finalW, this.config.finalH, this.zoom
            );
        } else {
            // Sin foto no hay nada que acotar: el lienzo entero (sin cambios).
            med = {
                k: 1,
                w: Math.max(1, parseInt(this.config.finalW, 10) || 1),
                h: Math.max(1, parseInt(this.config.finalH, 10) || 1)
            };
        }
        var cv = global.document.createElement('canvas');
        cv.width = med.w;
        cv.height = med.h;
        var ctx = cv.getContext('2d');
        if (!ctx) { return null; }
        // k < 1 = lienzo reducido: se dibuja la composicion normal (lienzo W x H)
        // encogida de forma uniforme.
        if (med.k !== 1) { ctx.setTransform(med.k, 0, 0, med.k, 0, 0); }
        this._pintarImagenEnContexto(ctx, false);
        return cv;
    };

    /** Genera el blob recortado al tamano del placeholder y gestiona la subida. */
    SelectorPMU.prototype._aceptar = function () {
        var self = this;
        if (!this.imagen || this._subiendo) {
            if (!this.imagen) { this._fallo('UPLOAD_FAILED', 'No hay imagen para subir'); }
            return;
        }
        // Spec 030 (D8/4a clarificacion): si la fuente es de la BIBLIOTECA y no se toco
        // nada (misma composicion que al cargarla), no se compone ni se suben bytes: se le
        // pide al servidor que REUSE esa familia (`op=usar`, decide por receta). Si vuelve
        // `coincide:false`, se sigue por el camino normal. El `_yaElegido` evita re-entrar.
        if (!this._yaElegido && this._bibMadre && this.config.usar
            && this._paramsBase === JSON.stringify(this._params())) {
            var selfB = this;
            this._yaElegido = true;
            var okB = this.raiz ? this.raiz.querySelector('.spmu-ok') : null;
            if (okB) { okB.disabled = true; okB.textContent = 'Eligiendo...'; }
            this._emitir('progress', { percentage: 30 });
            this.config.usar(this._bibMadre, this._params()).then(function (res) {
                if (okB) { okB.disabled = false; okB.textContent = 'Elegir'; }
                if (res && res.fila) {
                    selfB._emitir('usado', { fila: res.fila, madre: selfB._bibMadre });
                    selfB._cancelar();
                    return;
                }
                selfB._aceptar();
            }).catch(function () {
                if (okB) { okB.disabled = false; okB.textContent = 'Elegir'; }
                selfB._aceptar();
            });
            return;
        }
        var ok = this.raiz ? this.raiz.querySelector('.spmu-ok') : null;
        var elegir = this.raiz ? this.raiz.querySelector('.spmu-elegir') : null;
        if (ok) { ok.disabled = true; ok.textContent = 'Subiendo...'; }
        if (elegir) { elegir.disabled = true; }
        this._subiendo = true;
        this._estado('subiendo');

        var terminar = function (blob, tipo) {
            if (!blob) {
                self._subiendo = false;
                if (ok) { ok.disabled = false; ok.textContent = 'Subir'; }
                if (elegir) { elegir.disabled = false; }
                self._estado(null);
                self._fallo('UPLOAD_FAILED', 'No se pudo generar el recorte');
                return;
            }
            // Spec 026 (D10): el tipo es el REAL del blob, no un 'image/png' fijo.
            var mime = (tipo === 'webp') ? 'image/webp' : 'image/png';
            var url = URL.createObjectURL(blob);
            var meta = {
                width: self.config.finalW,
                height: self.config.finalH,
                fileSize: blob.size,
                type: mime,
                mode: self.config.mode,
                original: {
                    width: self.imagen.naturalWidth,
                    height: self.imagen.naturalHeight,
                    name: (self.archivoOrigen && self.archivoOrigen.name) || 'imagen'
                }
            };
            self.ultimoBlob = blob;
            self.ultimaUrl = url;

            var finalizarExito = function () {
                self._subiendo = false;
                if (elegir) { elegir.disabled = false; }
                self._estado(null);
                self._emitir('success', { url: url, width: meta.width, height: meta.height, fileSize: meta.fileSize });
                var quedan = (!self._contextoReemplazo && self.config.quedanEspacios)
                    ? !!self.config.quedanEspacios()
                    : false;
                if (quedan && self.raiz) {
                    var mOtra = self.raiz.querySelector('.spmu-otra-modal');
                    if (mOtra) {
                        mOtra.hidden = false;
                        return;
                    }
                }
                self.close();
            };

            if (typeof self.config.subirAsync === 'function') {
                Promise.resolve(self.config.subirAsync(blob, meta)).then(function () {
                    if (typeof self.onSelectCallback === 'function') { self.onSelectCallback(url, meta); }
                    finalizarExito();
                }, function (err) {
                    self._subiendo = false;
                    if (ok) { ok.disabled = false; ok.textContent = 'Subir'; }
                    if (elegir) { elegir.disabled = false; }
                    self._estado(null);
                    self._fallo('UPLOAD_FAILED', (err && err.message) || 'No se pudo subir la imagen');
                });
                return;
            }

            if (typeof self.onSelectCallback === 'function') { self.onSelectCallback(url, meta); }
            finalizarExito();
        };

        var lienzo = this._generarLienzoSalida();
        if (!lienzo) {
            this._subiendo = false;
            if (ok) { ok.disabled = false; ok.textContent = 'Subir'; }
            if (elegir) { elegir.disabled = false; }
            this._estado(null);
            this._fallo('UPLOAD_FAILED', 'No se pudo generar el recorte');
            return;
        }
        // Spec 026 (D1/D4): se codifica en **WebP q0.85** (la foto del
        // comprador: unseen al usuario, ahorro maximo). Si el navegador no
        // sabe codificar WebP, `toBlob` cae a PNG en silencio y se entrega el
        // PNG tal cual (D2): el flujo nunca se rompe.
        if (lienzo.toBlob) {
            lienzoAWebP(lienzo, 0.85, terminar);
        } else {
            // Sin `toBlob` (navegador muy viejo): PNG (el servidor lo convertira).
            var bin = atob(lienzo.toDataURL('image/png').split(',')[1]);
            var bytes = new Uint8Array(bin.length);
            for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
            terminar(new Blob([bytes], { type: 'image/png' }), 'png');
        }
    };

    /** Ultimo recorte generado (el llamador lo sube al pool del item). */
    SelectorPMU.prototype.obtenerBlob = function () {
        return this.ultimoBlob || null;
    };

    SelectorPMU.prototype.close = function () {
        if (this._onKey) {
            document.removeEventListener('keydown', this._onKey);
            this._onKey = null;
        }
        if (this._onResize) {
            global.removeEventListener('resize', this._onResize);
            this._onResize = null;
        }
        if (this.raiz && this.raiz.parentNode) { this.raiz.parentNode.removeChild(this.raiz); }
        this.raiz = null;
        this.escenaWrap = null;
        this.escena = null;
        this.cvEnvoltura = null;
        this.ctxEnvoltura = null;
        this.txtOrigen = null;
        this.txtSalida = null;
        this.canvas = null;
        this.ctx = null;
        this.ojo = null;
        this._punteros = {};
        this._arrastrando = null;
        this._pinch = null;
        this._subiendo = false;
        if (global.document && global.document.body) {
            global.document.body.classList.remove('spmu-bloqueado');
        }
        if (this._focoPrevio && typeof this._focoPrevio.focus === 'function') {
            try { this._focoPrevio.focus(); } catch (e) { /* el foco previo pudo desaparecer */ }
        }
        this._focoPrevio = null;
    };

    SelectorPMU.prototype.destroy = function () {
        this.close();
        if (this.imagen && this.imagen.src) { URL.revokeObjectURL(this.imagen.src); }
        this.onSelectCallback = null;
        this.onErrorCallback = null;
        this.oyentes = {};
        this.imagen = null;
        this.ultimoBlob = null;
    };

    SelectorPMU.puro = {
        formaCanonica: formaCanonica,
        modoCanonico: modoCanonico,
        ICO_MODO: ICO_MODO,
        TITULO_MODO: TITULO_MODO,
        geometriaEscena: geometriaEscena,
        calcularCajaEscena: calcularCajaEscena,
        superaCincoPorciento: superaCincoPorciento,
        escalaBase: escalaBase,
        escalaSalida: escalaSalida,
        origenDibujo: origenDibujo,
        colorPredominanteBordes: colorPredominanteBordes,
        // Spec 027: la politica de transparencia (puras, sin DOM).
        colorSolidoDeBordes: colorSolidoDeBordes,
        resolverFondo: resolverFondo,
        // Spec 026: la codificacion WebP con fallback por firma.
        esWebP: esWebP,
        sliderAZoom: sliderAZoom,
        zoomASlider: zoomASlider
    };

    global.SelectorPMU = SelectorPMU;
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = SelectorPMU;
    }
})(typeof window !== 'undefined' ? window : globalThis);
