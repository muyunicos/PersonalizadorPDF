<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * PMU_Uploads - Motor unico de cargas y gestion de recursos (Const. II/VII,
 * R1-R2 de specs/006-align-textmuy-motor/research.md).
 *
 * UNICO responsable de la verdad de almacenamiento: rutas, catalogos,
 * altas/bajas/ediciones, listados y el unico handle_request() del endpoint
 * admin_post_pmu_uploads. Delega SOLO el trabajo fisico de sprites y
 * miniaturas a PMU_Galeria (ayudante puro, todo por parametros).
 *
 * Raiz unica: uploads/pmu/ con ambitos fonts/ (fonts.json), img/ (img.json)
 * y tm-presets/ (presets.json + {nombre}.txm). pdfs/, orders/ y tmp/ son
 * ambitos de datos del motor, sin catalogo ni sprite. Prohibidas las raices
 * heredadas: una carpeta tm suelta en uploads o dentro de pmu, distinta de
 * la vigente tm-presets.
 */
class PMU_Uploads
{
    private static $AMBITOS = ['fonts', 'img', 'mockups', 'pdfs', 'orders', 'tmp', 'tm-presets', 'bonus'];
    private static $AMBITOS_GALERIA = ['fonts', 'img', 'mockups', 'tm-presets'];

    /** Nombre explicito del catalogo por ambito: NUNCA derivado del directorio. */
    private static $CATALOGOS = [
        'fonts' => 'fonts.json',
        'img' => 'img.json',
        // Spec 011 (T032): catalogo EXCLUSIVO del editor de mockups. Sustituye
        // a 'img' en las capas (namespace 'mock:{id}'): imagenes que solo se
        // usan como foto o fondo de un mockup, no como recurso de texto.
        'mockups' => 'mockups.json',
        'tm-presets' => 'presets.json',
    ];

    /** Subambitos de trabajo bajo tmp/ (contrato rutas-pmu.md v2, spec 007). */
    private static $SUBAMBITOS_TMP = ['muestras', 'cart', 'orders'];

    /** Grilla del sprite por ambito (defaults; el catalogo vigente manda). */
    private static $THUMBS = [
        'fonts' => ['w' => 180, 'h' => 30, 'c' => 4],
        'img' => ['w' => 100, 'h' => 100, 'c' => 8],
        'mockups' => ['w' => 40, 'h' => 40, 'c' => 12],
        'tm-presets' => ['w' => 200, 'h' => 100, 'c' => 4],
    ];

    private $galeria;
    /** Migracion one-shot de la libreria bonus (4.7.0) ya ejecutada en este request. */
    private $bonus_migrado = false; // (spec 020 B5: sin migracion)

    private function get_galeria()
    {
        if ($this->galeria === null) {
            if (!class_exists('PMU_Galeria')) {
                require_once PERSONALIZADOR_PDF_PATH . 'inc' . DIRECTORY_SEPARATOR . 'class-pmu-galeria.php';
            }
            $this->galeria = new PMU_Galeria();
        }
        return $this->galeria;
    }

    /* ==================== Rutas ==================== */

    /**
     * Sanea un nombre de dato (PDF, linea de carrito): minusculas [a-z0-9_-],
     * sin extension, no vacio. Lanza motor:<op>:nombre:invalido si no valida.
     */
    public function nombre_seguro($nombre, $op = 'ruta')
    {
        $nombre = strtolower(trim((string)$nombre));
        $nombre = preg_replace('/\.pdf$/i', '', $nombre);
        $nombre = preg_replace('/[^a-z0-9_\-]+/', '-', $nombre);
        $nombre = trim((string)$nombre, '-');
        if ($nombre === '') {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        return $nombre;
    }

    public function dir_pmu($crear = false)
    {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . 'pmu';
        if ($crear && !is_dir($dir)) {
            // Crear el arbol completo, no solo el ultimo nivel.
            // RC47: solo si se pide. Antes era incondicional y cualquier
            // lectura (el puente se arma en el FRENTE) dejaba uploads/pmu en
            // disco aunque no hubiera ni un catalogo.
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    public function dir_ambito($ambito, $crear = false)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:dir_ambito:ambito:invalido');
        }
        $dir = $this->dir_pmu($crear) . DIRECTORY_SEPARATOR . $ambito;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    public function url_ambito($ambito)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:url_ambito:ambito:invalido');
        }
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . 'pmu/' . $ambito . '/';
    }

    /* ============ Rutas de producto PDF (contrato rutas-pmu.md v2, T003) ============ */

    /** Carpeta del producto: uploads/pmu/pdfs/{nombre}/ */
    public function dir_pdf($nombre, $crear = false)
    {
        $nombre = $this->nombre_seguro($nombre, 'dir_pdf');
        $dir = $this->dir_ambito('pdfs', $crear) . DIRECTORY_SEPARATOR . $nombre;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:dir_pdf:directorio:no_escribible');
        }
        return $dir;
    }

    /** Archivo del producto: uploads/pmu/pdfs/{nombre}/{nombre}.pdf */
    public function ruta_pdf($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_pdf');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . $nombre . '.pdf';
    }

    /**
     * Geometria de los placeholders de una pagina, bajo demanda para importar
     * esa pagina como fondo del editor de mockups.
     */
    public function geometria_mockup_pagina($nombre, $pagina)
    {
        $nombre = $this->nombre_seguro($nombre, 'mockup_pagina');
        $pagina = (int)$pagina;
        if ($pagina < 1) {
            throw new Exception('motor:mockup_pagina:pagina:invalida');
        }
        $ruta = $this->ruta_pdf($nombre);
        if (!is_file($ruta) || !is_readable($ruta)) {
            throw new Exception('motor:mockup_pagina:pdf:ausente');
        }
        $bytes = @file_get_contents($ruta);
        if (!is_string($bytes) || $bytes === '') {
            throw new Exception('motor:mockup_pagina:pdf:ilegible');
        }
        $pdf = new \ExtractCorel\Engine\Pdf($bytes);
        $pdf->load();
        $paginas = $pdf->getPages();
        if ($pagina > count($paginas)) {
            throw new Exception('motor:mockup_pagina:pagina:fuera_de_rango');
        }
        $box = $pdf->pageBox($paginas[$pagina - 1]);
        $gruposDetectados = (new \ExtractCorel\Engine\Detector($pdf))->analizarPdf()['grupos'];
        $grupos = [];
        foreach ($gruposDetectados as $grupo) {
            $instancias = [];
            foreach ((array)($grupo['instancias'] ?? []) as $indice => $instancia) {
                if ((int)($instancia['page'] ?? -1) !== $pagina - 1) {
                    continue;
                }
                $fila = [
                    'n' => $indice + 1,
                    'bbox' => array_map('floatval', (array)($instancia['bbox'] ?? [])),
                    'w' => (float)($instancia['w'] ?? 0),
                    'h' => (float)($instancia['h'] ?? 0),
                ];
                if (isset($instancia['dev_quad']) && is_array($instancia['dev_quad'])) {
                    $fila['quad'] = array_map(function ($punto) {
                        return array_map('floatval', (array)$punto);
                    }, $instancia['dev_quad']);
                }
                $instancias[] = $fila;
            }
            if ($instancias) {
                $grupos[] = ['id' => (string)$grupo['id'], 'instancias' => $instancias];
            }
        }
        return [
            'pagina' => $pagina,
            'total_paginas' => count($paginas),
            'box' => array_map('floatval', $box),
            'grupos' => $grupos,
        ];
    }


    /** Analisis inmutable del Detector: uploads/pmu/pdfs/{nombre}/analisis.json (plan 008). */
    public function ruta_analisis($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_analisis');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . 'analisis.json';
    }

    /**
     * Envolturas (PowerClip) del producto: pdfs/{nombre}/envolturas.json.
     * Archivo DERIVADO del analisis (no vive en analisis.json): se regenera
     * al Subir/Re-analizar y se lee bajo demanda (editor via op=envoltura;
     * ficha: solo las usadas, embebidas por datos_pdf_render). Ausente =
     * PDF analizado con una version sin este soporte (Re-analizar).
     */
    public function ruta_envolturas($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_envolturas');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . 'envolturas.json';
    }

    /**
     * Lectura tolerante de `envolturas.json` (formas deduplicadas): el array
     * normalizado, o null si no existe / no es legible / **no es utilizable**
     * (asi la consola puede guiar a Re-analizar en vez de mostrar un "sin
     * envolturas" mudo).
     */
    public function leer_envolturas($pdf)
    {
        $ruta = $this->ruta_envolturas($pdf);
        if (!is_file($ruta)) {
            return null;
        }
        $raw = @file_get_contents($ruta);
        $dec = $raw === false ? null : json_decode($raw, true);
        return $this->envolturas_v2($dec);
    }

    /** Sanea el contenido de `envolturas.json` a la vista normalizada. */
    private function envolturas_v2($datos)
    {
        if (!is_array($datos) || !isset($datos['grupos']) || !is_array($datos['grupos'])) {
            return null;
        }
        $grupos = [];
        foreach ($datos['grupos'] as $gid => $valor) {
            $gid = strtoupper((string)$gid);
            if (preg_match('/^[0-9A-F]{6}$/', $gid) !== 1 || !is_array($valor)) {
                continue;
            }
            if (isset($valor['formas']) && is_array($valor['formas'])) {
                // v2: saneo minimo (formas + mapa + defecto en rango).
                $formas = [];
                foreach ($valor['formas'] as $f) {
                    if (is_array($f) && !empty($f['subs']) && is_array($f['subs'])) {
                        $formas[] = [
                            'par' => !empty($f['par']) ? 1 : 0,
                            'subs' => $f['subs'],
                            'usos' => isset($f['usos']) ? (int)$f['usos'] : 0,
                        ];
                    }
                }
                if (!$formas) {
                    continue;
                }
                $mapa = [];
                foreach ((array)(isset($valor['mapa']) ? $valor['mapa'] : []) as $n => $k) {
                    $mapa[(string)(int)$n] = (int)$k;
                }
                $defecto = (int)(isset($valor['defecto']) ? $valor['defecto'] : 1);
                if ($defecto < 1 || $defecto > count($formas)) {
                    $defecto = 1;
                }
                $grupos[$gid] = ['formas' => $formas, 'defecto' => $defecto, 'mapa' => $mapa];
                continue;
            }
            // Un grupo sin `formas` utilizables se descarta (no se inventa
            // geometria).
        }
        if ($datos['grupos'] && !$grupos) {
            // El archivo DECLARA grupos pero ninguno es utilizable. Eso NO es
            // "analizado sin envolturas" (ese caso es `grupos` vacio), asi que
            // se informa como no disponible para que la consola guie a
            // Re-analizar en vez de mostrar un "sin envolturas" mudo.
            return null;
        }
        return [
            'version' => 2,
            'pdf' => isset($datos['pdf']) ? (string)$datos['pdf'] : '',
            'grupos' => $grupos,
        ];
    }

    /** Override del admin para un grupo desde un config YA leido (0 = ninguno). */
    private function forma_override(array $cfg, $gid)
    {
        $env = isset($cfg['envolturas'][(string)$gid]) ? $cfg['envolturas'][(string)$gid] : null;
        return is_array($env) ? (int)(isset($env['forma']) ? $env['forma'] : 0) : 0;
    }

    /**
     * Claves/formas de envoltura por grupo (consola + editor):
     * `{disponible, formas:{gid:N}, defecto:{gid:k}, usos:{gid:[...]},
     * excepciones:{gid:{n:k}}}`. `defecto` es el EFECTIVO (override del admin
     * aplicado) y `excepciones` lista solo lo que difiere de el (k=0 = sin
     * envoltura). Solo CLAVES y contadores: la geometria viaja bajo demanda.
     */
    public function envoltura_claves($pdf)
    {
        $datos = $this->leer_envolturas($pdf);
        $formas = [];
        $defectos = [];
        $usos = [];
        $excepciones = [];
        if ($datos !== null && $datos['grupos']) {
            $cfg = $this->leer_config($pdf);
            foreach ($datos['grupos'] as $gid => $grupo) {
                $n = count($grupo['formas']);
                $def = $this->forma_override($cfg, $gid);
                if ($def < 1 || $def > $n) {
                    $def = (int)$grupo['defecto'];
                }
                $formas[$gid] = $n;
                $defectos[$gid] = $def;
                $usos[$gid] = array_map(function ($f) {
                    return (int)(isset($f['usos']) ? $f['usos'] : 0);
                }, $grupo['formas']);
                $exc = [];
                foreach ((array)$grupo['mapa'] as $nn => $k) {
                    if ((int)$k !== $def) {
                        $exc[(string)$nn] = (int)$k;
                    }
                }
                if ($exc) {
                    $excepciones[$gid] = $exc;
                }
            }
        }
        return [
            'disponible' => $datos !== null,
            'formas' => $formas,
            'defecto' => $defectos,
            'usos' => $usos,
            'excepciones' => $excepciones,
        ];
    }

    /**
     * Envoltura de `gid#n`: `{archivado, forma, envoltura}`.
     * `archivado` = hay envolturas utilizables; `forma` = indice resuelto (0 = sin
     * envoltura); `envoltura` = `{par, subs}` o null.
     */
    public function envoltura_datos($pdf, $gid, $n)
    {
        $datos = $this->leer_envolturas($pdf);
        if ($datos === null) {
            return ['archivado' => false, 'forma' => 0, 'envoltura' => null];
        }
        $grupo = isset($datos['grupos'][(string)$gid]) ? $datos['grupos'][(string)$gid] : null;
        if (!is_array($grupo)) {
            return ['archivado' => true, 'forma' => 0, 'envoltura' => null];
        }
        $k = $this->forma_de($pdf, $grupo, $gid, (int)$n);
        $env = $this->geometria_forma($grupo, $k);
        return ['archivado' => true, 'forma' => $env === null ? 0 : $k, 'envoltura' => $env];
    }

    /**
     * Forma por DEFECTO efectiva de un grupo (la que usan la guia del cargador
     * y el relleno del mockup): `{forma, envoltura}`.
     */
    public function envoltura_defecto($pdf, $gid)
    {
        $datos = $this->leer_envolturas($pdf);
        if ($datos === null || !isset($datos['grupos'][(string)$gid])) {
            return ['forma' => 0, 'envoltura' => null];
        }
        $grupo = $datos['grupos'][(string)$gid];
        $n = count($grupo['formas']);
        $def = $this->forma_override($this->leer_config($pdf), $gid);
        if ($def < 1 || $def > $n) {
            $def = (int)$grupo['defecto'];
        }
        return ['forma' => $def, 'envoltura' => $this->geometria_forma($grupo, $def)];
    }

    /** Indice de forma de una instancia (mapa > override > defecto). */
    private function forma_de($pdf, array $grupo, $gid, $n)
    {
        return \ExtractCorel\Engine\Metadata::formaIndice(
            $grupo,
            (int)$n,
            $this->forma_override($this->leer_config($pdf), $gid)
        );
    }

    /** Geometria `{par, subs}` de la forma `k` (sin `usos`) o null. */
    private function geometria_forma(array $grupo, $k)
    {
        if (!class_exists('\\ExtractCorel\\Engine\\Metadata')) {
            require_once dirname(__DIR__) . '/engine/Metadata.php';
        }
        return \ExtractCorel\Engine\Metadata::forma($grupo, (int)$k);
    }

    /**
     * Carpeta de fotos de mockup del admin: uploads/pmu/pdfs/{nombre}/mockups/
     * (spec 004, T004). Ambito de datos del producto, SIN catalogo ni sprite
     * (a diferencia de fonts/img/tm-presets): las fotos reutilizables viven en
     * el catalogo img/.
     */
    public function dir_mockups($pdf, $crear = false)
    {
        $pdf = $this->nombre_seguro($pdf, 'dir_mockups');
        $dir = $this->dir_pdf($pdf, $crear) . DIRECTORY_SEPARATOR . 'mockups';
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    /** Archivo de una foto de mockup: pdfs/{nombre}/mockups/{archivo} (nombre ya saneado por el llamador). */
    public function ruta_mockup($pdf, $archivo)
    {
        $pdf = $this->nombre_seguro($pdf, 'ruta_mockup');
        $archivo = basename((string)$archivo); // sin subrutas
        if ($archivo === '' || $archivo === '.' || $archivo === '..') {
            throw new Exception('motor:ruta_mockup:nombre:invalido');
        }
        return $this->dir_mockups($pdf) . DIRECTORY_SEPARATOR . $archivo;
    }
    /**
     * Carpeta GLOBAL de archivos bonus: uploads/pmu/bonus/ (4.7.0).
     *
     * Libreria compartida por TODOS los PDFs: un archivo puede referenciarse
     * desde N config.json. Lleva su catalogo `bonus.json`
     * ({version, items:[{archivo, titulo}]}): el titulo por defecto vive ahi
     * y es dinamico (cambiarlo actualiza a todos los PDFs que lo usan).
     * Al crear/leer se dispara una unica vez la migracion one-shot desde el
     * layout viejo `pdfs/{pdf}/bonus/` (4.6.18-4.6.20).
     */
    public function dir_bonus($crear = false)
    {
        $dir = $this->dir_ambito('bonus', $crear);
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    /** Archivo bonus global: uploads/pmu/bonus/{archivo} (sin subrutas). */
    public function ruta_bonus($archivo)
    {
        $archivo = basename((string)$archivo); // sin subrutas
        if ($archivo === '' || $archivo === '.' || $archivo === '..') {
            throw new Exception('motor:ruta_bonus:nombre:invalido');
        }
        return $this->dir_bonus() . DIRECTORY_SEPARATOR . $archivo;
    }

    /** Catalogo de la libreria bonus: uploads/pmu/bonus/bonus.json */
    public function ruta_bonus_catalogo()
    {
        return $this->dir_bonus() . DIRECTORY_SEPARATOR . 'bonus.json';
    }

    /** Allowlist de documentos bonus: pdf/zip + imagenes. */
    public function bonus_ext_valida($archivo)
    {
        $ext = strtolower(pathinfo((string)$archivo, PATHINFO_EXTENSION));
        return in_array($ext, ['pdf', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp'], true);
    }

    /**
     * Catalogo de la libreria bonus: [archivo => titulo]. Lectura tolerante:
     * un JSON roto o ausente devuelve [] (los archivos siguen listables con su
     * titulo por defecto).
     */
    public function bonus_catalogo_leer()
    {
        $datos = $this->leer_json($this->ruta_bonus_catalogo());
        $out = [];
        if (!is_array($datos)) {
            return $out;
        }
        foreach ((array)($datos['items'] ?? []) as $it) {
            if (!is_array($it)) {
                continue;
            }
            $file = basename((string)($it['archivo'] ?? ''));
            if ($file === '' || $file === '.' || $file === '..') {
                continue;
            }
            $out[$file] = substr(trim((string)($it['titulo'] ?? '')), 0, 80);
        }
        return $out;
    }

    /** Guarda el catalogo [archivo => titulo] (solo entradas validas, orden estable). */
    public function bonus_catalogo_guardar(array $mapa)
    {
        $dir = $this->dir_bonus();
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:bonus:catalogo:no_escribible');
        }
        $items = [];
        foreach ($mapa as $file => $titulo) {
            $file = basename((string)$file);
            if ($file === '' || $file === '.' || $file === '..') {
                continue;
            }
            $items[] = ['archivo' => $file, 'titulo' => substr(trim((string)$titulo), 0, 80)];
        }
        usort($items, function ($a, $b) {
            return strcmp($a['archivo'], $b['archivo']);
        });
        $ok = @file_put_contents(
            $this->ruta_bonus_catalogo(),
            wp_json_encode(['version' => 1, 'items' => $items], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
        );
        if ($ok === false) {
            throw new Exception('motor:bonus:catalogo:no_escribible');
        }
        return true;
    }

    /** Titulo por defecto de un archivo de la libreria: nombre sin extension. */
    public function bonus_titulo_defecto($archivo)
    {
        $nom = basename(str_replace('\\', '/', (string)$archivo));
        $sinExt = (string)pathinfo($nom, PATHINFO_FILENAME);
        return $sinExt === '' ? substr($nom, 0, 80) : substr($sinExt, 0, 80);
    }

    /**
     * Libreria bonus: [archivo => ['url' => URL publica, 'titulo' => titulo
     * efectivo]]. El titulo efectivo es el del catalogo (dinamico) o, si no
     * hay entrada, el por defecto (nombre sin extension). Solo archivos
     * fisicos con extension valida; orden alfabetico.
     */
    public function bonus_lista()
    {
        $cat = $this->bonus_catalogo_leer();
        $out = [];
        $dir = $this->dir_bonus();
        if (is_dir($dir)) {
            $base = $this->url_ambito('bonus');
            foreach ((array)glob($dir . DIRECTORY_SEPARATOR . '*.*') as $ruta) {
                $file = basename($ruta);
                if ($file === 'bonus.json' || !$this->bonus_ext_valida($file)) {
                    continue;
                }
                $titulo = isset($cat[$file]) && $cat[$file] !== '' ? $cat[$file] : $this->bonus_titulo_defecto($file);
                $out[$file] = ['url' => $base . rawurlencode($file), 'titulo' => $titulo];
            }
        }
        ksort($out);
        return $out;
    }

    /**
     * Escaneo de uso: [pdf => true] de los PDFs cuyo config.json bonus[]
     * referencia $archivo (por `archivo` o por url relativa legada).
     * Base del borrado inteligente: el modal avisa "en uso por N PDFs".
     */
    public function bonus_en_uso($archivo)
    {
        $archivo = basename(str_replace('\\', '/', (string)$archivo));
        $usos = [];
        if ($archivo === '' || $archivo === '.' || $archivo === '..') {
            return $usos;
        }
        foreach ((array)glob($this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . '*' . DIRECTORY_SEPARATOR . 'config.json') as $cfg) {
            $pdf = basename(dirname($cfg));
            $datos = $this->leer_json($cfg);
            if (!is_array($datos) || !isset($datos['bonus']) || !is_array($datos['bonus'])) {
                continue;
            }
            foreach ($datos['bonus'] as $b) {
                if (!is_array($b)) {
                    continue;
                }
                $ref = (string)($b['archivo'] ?? '');
                if ($ref === '') {
                    // Legado 4.6.18-4.6.20: url relativa o absoluta vieja
                    // (pdfs/{pdf}/bonus/...) a la carpeta bonus del PDF.
                    $u = (string)($b['url'] ?? '');
                    if ($u !== '' && !preg_match('#^https?://#i', $u)) {
                        $ref = basename(str_replace('\\', '/', $u));
                    } elseif ($u !== '' && preg_match('~[^/]/bonus/([^/?#]+)$~i', $u, $mmU)) {
                        $ref = rawurldecode($mmU[1]);
                    }
                }
                if ($ref === $archivo) {
                    $usos[$pdf] = true;
                    break;
                }
            }
        }
        return $usos;
    }

    /**
     * Borra un archivo de la libreria. Si $limpiar_en trae nombres de PDF,
     * tambien quita las filas que lo referenciaban de esos configs (solo
     * despues de la confirmacion del admin). Devuelve ['pdfs' => [...]].
     */
    public function bonus_borrar($archivo, array $limpiar_en = [])
    {
        $ruta = $this->ruta_bonus($archivo);
        if (!is_file($ruta) || !@unlink($ruta)) {
            throw new Exception('motor:bonus:borrar:fallo');
        }
        $base = basename($archivo);
        $cat = $this->bonus_catalogo_leer();
        if (array_key_exists($base, $cat)) {
            unset($cat[$base]);
            try {
                $this->bonus_catalogo_guardar($cat);
            } catch (\Throwable $e) {
                // Catalogo no escribible: bonus_lista() ignora los huecos.
            }
        }
        $limpios = [];
        foreach ($limpiar_en as $pdf) {
            $pdf = $this->nombre_seguro((string)$pdf, 'bonus_borrar');
            try {
                $cfg = $this->leer_config($pdf);
            } catch (\Throwable $e) {
                continue;
            }
            $filas = [];
            foreach ((array)$cfg['bonus'] as $b) {
                $ref = is_array($b) ? (string)($b['archivo'] ?? '') : '';
                if ($ref === '' && is_array($b)) {
                    $u = (string)($b['url'] ?? '');
                    if ($u !== '' && !preg_match('#^https?://#i', $u)) {
                        $ref = basename(str_replace('\\', '/', $u));
                    } elseif ($u !== '' && preg_match('~[^/]/bonus/([^/?#]+)$~i', $u, $mmB)) {
                        $ref = rawurldecode($mmB[1]);
                    }
                }
                if ($ref !== $base) {
                    $filas[] = $b;
                }
            }
            if (count($filas) !== count((array)$cfg['bonus'])) {
                $this->guardar_config($pdf, ['bonus' => $filas]);
                $limpios[] = $pdf;
            }
        }
        return ['pdfs' => $limpios];
    }

    /**
     * Carpeta del codigo de los campos: uploads/pmu/campos/ (spec 012, T002).
     * Aqui viven las carpetas {id}/ de cada campo, los dos globales y, desde
     * RC4.6.11, tambien el INDICE (campos.json) del catalogo de campos.
     */
    public function dir_campos($crear = false)
    {
        $dir = $this->dir_pmu($crear) . DIRECTORY_SEPARATOR . 'campos';
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_campos:directorio:no_escribible');
        }
        return $dir;
    }

    /**
     * Indice del catalogo global de campos: uploads/pmu/campos/campos.json
     * (spec 012; desde RC4.6.11 vive junto al codigo de los campos, no en la
     * raiz de pmu/).
     */
    public function ruta_campos()
    {
        return $this->dir_campos() . DIRECTORY_SEPARATOR . 'campos.json';
    }

    // (spec 020 B5) `ruta_campos_legado()` y `migrar_indice_campos()` se
    // eliminaron: el indice vive SOLO en `uploads/pmu/campos/campos.json`.

    /**
     * Id de campo saneado: entero >= 1 (nunca 0; los dados de baja conservan
     * el id, asi que no se reutiliza). Lanza motor:<op>:id:invalido.
     */
    public function campo_id_seguro($id, $op = 'campo')
    {
        $id = (int)$id;
        if ($id < 1) {
            throw new Exception('motor:' . $op . ':id:invalido');
        }
        return $id;
    }

    /** Carpeta de un campo: uploads/pmu/campos/{id}/ (spec 012, T002). */
    public function dir_campo($id, $crear = false)
    {
        $id = $this->campo_id_seguro($id, 'dir_campo');
        $dir = $this->dir_campos($crear) . DIRECTORY_SEPARATOR . $id;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    /**
     * Archivo de un campo (datos.json|campo.htm|campo.css|campo.js):
     * uploads/pmu/campos/{id}/{archivo}. Sin subrutas (spec 012, T002).
     */
    public function ruta_campo($id, $archivo)
    {
        $archivo = basename((string)$archivo); // sin subrutas
        if ($archivo === '' || $archivo === '.' || $archivo === '..') {
            throw new Exception('motor:ruta_campo:archivo:invalido');
        }
        return $this->dir_campo($id) . DIRECTORY_SEPARATOR . $archivo;
    }

    /**
     * Ruta de un archivo global del plugin: solo global.css|global.js
     * (spec 012, T018; el global es UNO del plugin, D6).
     */
    public function ruta_campo_global($archivo)
    {
        $archivo = basename((string)$archivo);
        if (!in_array($archivo, ['global.css', 'global.js'], true)) {
            throw new Exception('motor:ruta_campo_global:archivo:invalido');
        }
        return $this->dir_campos() . DIRECTORY_SEPARATOR . $archivo;
    }

    /** CSS global del plugin: uploads/pmu/campos/global.css (spec 012, T018). */
    public function ruta_global_css()
    {
        return $this->ruta_campo_global('global.css');
    }

    /** JS global del plugin: uploads/pmu/campos/global.js (spec 012, T018). */
    public function ruta_global_js()
    {
        return $this->ruta_campo_global('global.js');
    }

    /** Limite por archivo, igual que el de los campos (spec 012, data-model). */
    const LIMITE_CAMPO_CARACTERES = 20000;

    /**
     * Lee el CSS/JS global del plugin (spec 012, T018, D6). Los dos archivos
     * se crean vacios si no existen, para que (a) el admin siempre edite sobre
     * algo real y (b) un problema de permisos aparezca al ABRIR la pestana y
     * no al guardar. Causa `motor:campos:global:no_escribible` si
     * uploads/pmu/campos/ no existe o no se puede escribir.
     */
    public function leer_global()
    {
        try {
            $this->dir_campos(true);
        } catch (\Throwable $e) {
            throw new Exception('motor:campos:global:no_escribible');
        }
        $css = is_file($this->ruta_global_css())
            ? (string) @file_get_contents($this->ruta_global_css()) : '';
        $js = is_file($this->ruta_global_js())
            ? (string) @file_get_contents($this->ruta_global_js()) : '';
        $this->escribir_texto($this->ruta_global_css(), $css);
        $this->escribir_texto($this->ruta_global_js(), $js);
        return ['css' => $css, 'js' => $js];
    }

    /**
     * Guarda el CSS/JS global (spec 012, T018). **No** valida el JS con el
     * sandbox de `campo.js`: el global es codigo libre del admin (D21) que
     * corre en la pagina del comprador, no una funcion `function(ctx, root)`.
     * Solo se aplica el limite de tamano, como en el resto de los archivos.
     */
    public function guardar_global($css = '', $js = '')
    {
        $css = (string) $css;
        $js = (string) $js;
        if (strlen($css) > self::LIMITE_CAMPO_CARACTERES) {
            throw new Exception('motor:campos:global.css:tamano');
        }
        if (strlen($js) > self::LIMITE_CAMPO_CARACTERES) {
            throw new Exception('motor:campos:global.js:tamano');
        }
        try {
            $this->dir_campos(true);
        } catch (\Throwable $e) {
            throw new Exception('motor:campos:global:no_escribible');
        }
        $ok = $this->escribir_texto($this->ruta_global_css(), $css);
        $ok = $this->escribir_texto($this->ruta_global_js(), $js) && $ok;
        if (!$ok) {
            throw new Exception('motor:campos:global:no_escribible');
        }
        return true;
    }

    /** Config editable del admin: uploads/pmu/pdfs/{nombre}/config.json (plan 008). */
    public function ruta_config($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_config');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . 'config.json';
    }

    /** Asegura un subdirectorio bajo tmp/ (muestras|cart|orders). */
    /**
     * Raiz de un subambito de tmp/: uploads/pmu/tmp/{sub}/ (lectura de rutas
     * para PMU_Sesion::limpiar_ttl; escritura pasa por metodos especificos).
     */
    public function dir_tmp_sub($sub, $crear = false)
    {
        if (!in_array($sub, self::$SUBAMBITOS_TMP, true)) {
            throw new Exception('motor:dir_tmp:subambito:invalido:' . $sub);
        }
        $dir = $this->dir_ambito('tmp', $crear) . DIRECTORY_SEPARATOR . $sub;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    /** Temporales de muestras del panel: uploads/pmu/tmp/muestras/{pdf}/ */
    public function dir_tmp_muestras($pdf, $crear = false)
    {
        $pdf = $this->nombre_seguro($pdf, 'dir_tmp_muestras');
        $dir = $this->dir_tmp_sub('muestras', $crear) . DIRECTORY_SEPARATOR . $pdf;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_tmp_muestras:directorio:no_escribible');
        }
        return $dir;
    }

    /** Imagen aplicada de un grupo (muestra): tmp/muestras/{pdf}/{id}.{ext} */
    public function ruta_aplicado($pdf, $id, $ext)
    {
        $pdf = $this->nombre_seguro($pdf, 'ruta_aplicado');
        $id = strtoupper(preg_replace('/[^0-9A-Fa-f]/', '', (string)$id));
        if (!preg_match('/^[0-9A-F]{6}$/', $id)) {
            throw new Exception('motor:ruta_aplicado:id:invalido');
        }
        $ext = strtolower(ltrim((string)$ext, '.'));
        $validas = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
        if (!in_array($ext, $validas, true)) {
            throw new Exception('motor:ruta_aplicado:extension:invalida');
        }
        return $this->dir_tmp_sub('muestras') . DIRECTORY_SEPARATOR . $pdf
            . DIRECTORY_SEPARATOR . $id . '.' . $ext;
    }

    /** PDF procesado de muestra: tmp/muestras/{pdf}/{nombre}_procesado.pdf */
    public function ruta_salida_tmp($pdf)
    {
        $pdf = $this->nombre_seguro($pdf, 'ruta_salida_tmp');
        return $this->dir_tmp_sub('muestras') . DIRECTORY_SEPARATOR . $pdf
            . DIRECTORY_SEPARATOR . $pdf . '_procesado.pdf';
    }

    /** Borrador/linea del carrito: uploads/pmu/tmp/cart/{linea}/ (spec 007).
     *  El plan 008 mueve la unidad bajo sesion: dir_sesion_item() es el acceso
     *  nuevo; dir_tmp_cart()/manifest_cart() quedan como legado (lectura). */
    public function dir_tmp_cart($linea, $crear = false)
    {
        $linea = $this->nombre_seguro($linea, 'dir_tmp_cart');
        $dir = $this->dir_tmp_sub('cart', $crear) . DIRECTORY_SEPARATOR . $linea;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_tmp_cart:directorio:no_escribible');
        }
        return $dir;
    }

    /** Manifiesto de la linea: uploads/pmu/tmp/cart/{linea}/manifest.json */
    public function manifest_cart($linea)
    {
        $linea = $this->nombre_seguro($linea, 'manifest_cart');
        return $this->dir_tmp_sub('cart') . DIRECTORY_SEPARATOR . $linea
            . DIRECTORY_SEPARATOR . 'manifest.json';
    }

    /* ============ Unidad sesion (plan 008: tmp/sesion-{sid}/{item_key}/) ============ */

    /**
     * Sanea un sid de sesion (cookie pmu_sid o user_id): minusculas [a-z0-9_-],
     * sin extension, no vacio. Lanza motor:<op>:sesion:invalida si no valida.
     */
    public function sesion_segura($sid, $op = 'sesion')
    {
        $sid = strtolower(trim((string)$sid));
        $sid = preg_replace('/[^a-z0-9_\-]+/', '-', $sid);
        $sid = trim((string)$sid, '-');
        if ($sid === '' || strlen($sid) > 64) {
            throw new Exception('motor:' . $op . ':sesion:invalida');
        }
        return $sid;
    }

    /**
     * Sanea un item_key (draft-{uuid} pre-carrito o cart_item_key post-carrito):
     * [A-Za-z0-9_-], no vacio, max 64. Lanza motor:<op>:item:invalido si no valida.
     */
    public function item_seguro($item, $op = 'sesion')
    {
        $item = trim((string)$item);
        $item = preg_replace('/[^A-Za-z0-9_\-]+/', '-', $item);
        $item = trim($item, '-');
        if ($item === '' || strlen($item) > 64) {
            throw new Exception('motor:' . $op . ':item:invalido');
        }
        return $item;
    }

    /** Carpeta de la sesion: uploads/pmu/tmp/sesion-{sid}/ (plan 008, crea si falta). */
    public function dir_sesion($sid, $crear = false)
    {
        $sid = $this->sesion_segura($sid, 'dir_sesion');
        $dir = $this->dir_ambito('tmp', $crear) . DIRECTORY_SEPARATOR . 'sesion-' . $sid;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_sesion:directorio:no_escribible');
        }
        return $dir;
    }

    /** Carpeta del item: uploads/pmu/tmp/sesion-{sid}/{item_key}/ (plan 008, crea si falta). */
    public function dir_sesion_item($sid, $item, $crear = false)
    {
        $sid = $this->sesion_segura($sid, 'dir_sesion_item');
        $item = $this->item_seguro($item, 'dir_sesion_item');
        $dir = $this->dir_sesion($sid, $crear) . DIRECTORY_SEPARATOR . $item;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_sesion_item:directorio:no_escribible');
        }
        return $dir;
    }

    /** Manifiesto del item: uploads/pmu/tmp/sesion-{sid}/{item_key}/manifest.json (plan 008). */
    public function manifest_sesion_item($sid, $item)
    {
        $sid = $this->sesion_segura($sid, 'manifest_sesion_item');
        $item = $this->item_seguro($item, 'manifest_sesion_item');
        return $this->dir_ambito('tmp') . DIRECTORY_SEPARATOR . 'sesion-' . $sid
            . DIRECTORY_SEPARATOR . $item . DIRECTORY_SEPARATOR . 'manifest.json';
    }

    /**
     * URL publica del item de sesion: uploads/pmu/tmp/sesion-{sid}/{item_key}/
     * (el cliente la usa para recomponer los mockups ya renderizados sin volver
     * a subirlos: render parcial por hash, T016).
     */
    public function url_sesion_item($sid, $item)
    {
        $sid = $this->sesion_segura($sid, 'url_sesion_item');
        $item = $this->item_seguro($item, 'url_sesion_item');
        return $this->url_ambito('tmp') . 'sesion-' . rawurlencode($sid) . '/' . rawurlencode($item) . '/';
    }

    /** Pool de imagenes del item: uploads/pmu/tmp/sesion-{sid}/{item_key}/img/ (plan 008). */
    public function dir_sesion_item_img($sid, $item, $crear = false)
    {
        $dir = $this->dir_sesion_item($sid, $item, $crear) . DIRECTORY_SEPARATOR . 'img';
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_sesion_item_img:directorio:no_escribible');
        }
        return $dir;
    }

    /** Staging del pedido: uploads/pmu/tmp/orders/{order_id}/ */
    public function dir_tmp_order($order_id, $crear = false)
    {
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new Exception('motor:dir_tmp_order:pedido:invalido');
        }
        $dir = $this->dir_tmp_sub('orders', $crear) . DIRECTORY_SEPARATOR . $order_id;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_tmp_order:directorio:no_escribible');
        }
        return $dir;
    }

    /** Carpeta del pedido confirmado: uploads/pmu/orders/{order_id}/ */
    public function dir_order($order_id, $crear = false)
    {
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new Exception('motor:dir_order:pedido:invalido');
        }
        $dir = $this->dir_ambito('orders', $crear) . DIRECTORY_SEPARATOR . $order_id;
        if ($crear && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if ($crear && (!is_dir($dir) || !wp_is_writable($dir))) {
            throw new Exception('motor:dir_order:directorio:no_escribible');
        }
        return $dir;
    }


    /** Salida final de una linea: orders/{order_id}/{pdf}/{pdf}_procesado.pdf */
    public function ruta_order_pdf($order_id, $pdf)
    {
        $order_id = (int)$order_id;
        if ($order_id < 1) {
            throw new Exception('motor:ruta_order_pdf:pedido:invalido');
        }
        $pdf = $this->nombre_seguro($pdf, 'ruta_order_pdf');
        return $this->dir_ambito('orders') . DIRECTORY_SEPARATOR . $order_id
            . DIRECTORY_SEPARATOR . $pdf . DIRECTORY_SEPARATOR . $pdf . '_procesado.pdf';
    }

    public function tiene_catalogo($ambito)
    {
        return in_array($ambito, self::$AMBITOS_GALERIA, true);
    }

    public function ruta_catalogo($ambito)
    {
        if (!isset(self::$CATALOGOS[$ambito])) {
            throw new Exception('motor:catalogo:ambito:sin_catalogo:' . $ambito);
        }
        return $this->dir_ambito($ambito) . DIRECTORY_SEPARATOR . self::$CATALOGOS[$ambito];
    }

    public function thumbs_defecto($ambito)
    {
        return self::$THUMBS[$ambito] ?? ['w' => 100, 'h' => 100, 'c' => 8];
    }

    /* ==================== Catalogo (semilla diferida + rechazo sin sustitutos) ==================== */

    /** Lee el catalogo. Devuelve ['cat'=>..., 'aviso'=>string|null].
     *  Ausente: semilla vacia + aviso no bloqueante.
     *  Ilegible (0 bytes, JSON invalido, estructura ajena): catalogo vacio
     *  + aviso no bloqueante (T005: la consola nunca da 500 por esto).
     *  Solo lanza si el directorio no es escribible y no se puede sembrar. */
    public function catalogo($ambito, $op = 'catalogo')
    {
        $cat = ['thumbs' => $this->thumbs_defecto($ambito), 'items' => []];
        if (!$this->tiene_catalogo($ambito)) {
            throw new Exception('motor:' . $op . ':catalogo:ambito:sin_catalogo:' . $ambito);
        }
        $ruta = $this->ruta_catalogo($ambito);
        if (!is_file($ruta)) {
            // RC47: LEER ya no escribe. Antes este camino sembraba el catalogo
            // vacio en disco, y como `assets_ficha_condicional()` ->
            // `puente_textmuy()` -> `listar_todo()` -> `catalogo()` corre en
            // `wp_enqueue_scripts` del FRENTE (con solo `is_product()`), CADA
            // visita a una pagina de producto -incluidas las de un bot-
            // resucitaba uploads/pmu con 3 archivos vacios. Un `GET` no
            // muta datos: la siembra queda en los caminos de escritura
            // (alta/baja/editar), que crean el archivo cuando hace falta.
            // Se sigue devolviendo el aviso para que la UI distinga
            // "catalogo vacio" de "catalogo con contenido".
            return ['cat' => $cat, 'aviso' => 'motor:listar:catalogo:ausente:' . $ambito];
        }
        $crudo = (string)@file_get_contents($ruta);
        $datos = $crudo === '' ? null : json_decode($crudo, true);
        if (!is_array($datos) || !isset($datos['thumbs'], $datos['items']) || !is_array($datos['items'])) {
            return ['cat' => $cat, 'aviso' => 'motor:listar:catalogo:invalido:' . $ambito];
        }
        $cat['thumbs'] = $datos['thumbs'];
        $cat['items'] = array_values(array_filter($datos['items'], 'is_array'));
        return ['cat' => $cat, 'aviso' => null];
    }

    /**
     * Escribe el catalogo de forma atomica (T004): vuelca a {catalogo}.tmp
     * en la misma carpeta y renombra sobre el destino. Ningun lector ve
     * un catalogo truncado. Devuelve true/false (no lanza).
     *
     * RC46 / spec 009 (T005): la certificacion de la hoja se invalida en
     * TODOS los ambitos catalogados, no solo en `img`. Antes solo `img`
     * borraba `thumbs.sprite_firma`, de modo que un alta/baja/editar en
     * `fonts` o `tm-presets` dejaba la hoja con thumbs viejos en disco. La
     * lectura canonica (TextMuyAPI.ensureSpriteCanonico) compara la firma
     * contra el inventario vigente y al no coincidir rechaza la hoja, pero
     * el motor la seguia marcando como vigente.
     *
     * Solo para ambitos CON catalogo ($CATALOGOS): los demas de
     * AMBITOS_GALERIA (mockups) no manejan `thumbs.sprite_firma` y deben
     * conservar su `thumbs` intacto (contrato motor-sprite.md: un ambito
     * certifica solo si el cliente manda firma no vacia).
     */
    public function guardar_catalogo($ambito, $cat)
    {
        $ruta = $this->ruta_catalogo($ambito);
        if (isset(self::$CATALOGOS[$ambito]) && isset($cat['thumbs'])
            && is_array($cat['thumbs'])) {
            unset($cat['thumbs']['sprite_firma']);
        }
        return $this->escribir_json($ruta, $cat);
    }

    /** Escribe un array como JSON de forma atomica (.tmp + rename). */
    public function escribir_json($ruta, array $datos)
    {
        $dir = dirname($ruta);
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        $tmp = $ruta . '.tmp';
        $json = wp_json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        if ($json === false || @file_put_contents($tmp, $json) === false) {
            @unlink($tmp);
            return false;
        }
        if (!@rename($tmp, $ruta)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    /** Lee un JSON de datos. Devuelve null si no existe o es invalido. */
    public function leer_json($ruta)
    {
        if (!is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        return is_array($datos) ? $datos : null;
    }

    /**
     * Reglas de sandbox del `script` de un campo (contract campos.md):
     * `function(ctx, root)` con salida unica via ctx.set. Prohibidos
     * document.getElementById / document.querySelector (usar root) y
     * DOMContentLoaded. Lanza motor:campos:script:invalido si rompe una regla.
     */
    public function validar_script_campo($script)
    {
        $script = (string)$script;
        if (trim($script) !== '' && stripos(trim($script), 'function') !== 0) {
            throw new Exception('motor:campos:script:invalido');
        }
        if (preg_match('/document\\.\\s*(getElementById|querySelector)/i', $script)) {
            throw new Exception('motor:campos:script:invalido');
        }
        if (stripos($script, 'DOMContentLoaded') !== false) {
            throw new Exception('motor:campos:script:invalido');
        }
        if (preg_match('/\\bid\\s*=\\s*["\']/', $script)) {
            throw new Exception('motor:campos:script:invalido');
        }
    }

    /* ============ Campos v2 (spec 012, T004): datos y archivos ============ */

    // (spec 020 D4) `validar_cargador()` y `cargador_desde_texto()` se eliminaron:
    // el cargador vive en el `campo.js` del campo (spec 018) y no pasa por el
    // servidor (PHP no evalua JS).

    /* (spec 020 D4) `cargador_desde_texto()` eliminado: sin atajos de texto. */


    /**
     * Lee un campo v2 completo desde uploads/pmu/campos/{id}/ (spec 012, T002).
     * Devuelve ['datos'=>[],'htm'=>'','css'=>'','js'=>''] o null si no existe
     * la carpeta. Tolerante: un archivo ausente se lee como cadena vacia.
     */
    public function leer_campo($id)
    {
        $id = $this->campo_id_seguro($id, 'leer_campo');
        if (!is_dir($this->dir_campo($id))) {
            return null;
        }
        $leer = function ($archivo) use ($id) {
            $ruta = $this->ruta_campo($id, $archivo);
            return is_file($ruta) ? (string)@file_get_contents($ruta) : '';
        };
        $datos = $this->leer_json($this->ruta_campo($id, 'datos.json'));
        return [
            'id' => $id,
            'datos' => is_array($datos) ? $datos : [],
            'htm' => $leer('campo.htm'),
            'css' => $leer('campo.css'),
            'js' => $leer('campo.js'),
        ];
    }

    /**
     * Escribe un campo v2: valida y deja los 4 archivos en
     * uploads/pmu/campos/{id}/ (spec 012, T002/T004). Cada archivo se escribe
     * de forma atomica (.tmp + rename); el indice (campos.json) se actualiza
     * aparte y es el punto de commit. Devuelve true/false (no lanza por E/S).
     */
    public function escribir_campo($id, array $datos, $htm = '', $css = '', $js = '')
    {
        $id = $this->campo_id_seguro($id, 'escribir_campo');
        $this->dir_campo($id, true);

        // Validacion del HTML (mismas reglas que campo_desde_post v1).
        if (preg_match('/<\s*(script|iframe|object|embed|form)\b/i', $htm)) {
            throw new Exception('motor:campos:contenido:prohibido');
        }
        if (preg_match('/\bid\s*=\s*["\']/', $htm)) {
            throw new Exception('motor:campos:contenido:sin_id');
        }
        // Sandbox del JS (siempre en el servidor; el navegador no reemplaza esto).
        $this->validar_script_campo($js);

        // Limites por archivo (20 000 caracteres, como en la v1).
        foreach (['campo.htm' => $htm, 'campo.css' => $css, 'campo.js' => $js] as $archivo => $contenido) {
            if (strlen((string)$contenido) > self::LIMITE_CAMPO_CARACTERES) {
                throw new Exception('motor:campos:' . $archivo . ':tamano');
            }
        }

        $ok = true;
        foreach ([
            ['datos.json', wp_json_encode($datos, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)],
            ['campo.htm', (string)$htm],
            ['campo.css', (string)$css],
            ['campo.js', (string)$js],
        ] as $par) {
            $ok = $this->escribir_texto($this->ruta_campo($id, $par[0]), $par[1]) && $ok;
        }
        return $ok;
    }

    /** Escribe un archivo de texto de forma atomica (.tmp + rename). */
    private function escribir_texto($ruta, $contenido)
    {
        $dir = dirname($ruta);
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        $tmp = $ruta . '.tmp';
        if (@file_put_contents($tmp, (string)$contenido) === false) {
            @unlink($tmp);
            return false;
        }
        if (!@rename($tmp, $ruta)) {
            @unlink($tmp);
            return false;
        }
        return true;
    }

    /**
        /* ============ CRUD de campos v2 (spec 012, T003) ============ */

    /**
     * Indice v2 completo: {version, items, meta}. Tolera la ausencia del
     * archivo (devuelve vacio) y normaliza a la forma v2 para poder listar.
     */
    public function indice_campos()
    {
        $ruta = $this->ruta_campos();
        $vacio = ['version' => 3, 'items' => [], 'meta' => []];
        if (!is_file($ruta)) {
            return $vacio;
        }
        $crudo = (string) @file_get_contents($ruta);
        $datos = $crudo === '' ? null : json_decode($crudo, true);
        if (!is_array($datos) || !isset($datos['items']) || !is_array($datos['items'])) {
            return $vacio;
        }
        if (isset($datos['version']) && (int) $datos['version'] >= 2) {
            return [
                'version' => (int) $datos['version'],
                'items' => array_values($datos['items']),
                'meta' => isset($datos['meta']) && is_array($datos['meta']) ? $datos['meta'] : [],
            ];
        }
        return $vacio; // indice sin version: se lee como vacio (la v1 nunca se publico)
    }

    /**
     * Guarda el indice (atomico). Devuelve true/false.
     * v3 (spec 015): `items[].tipo` en vez de `plantilla`, y `meta` sin
     * categorias. El LECTOR acepta `>= 2` a proposito: un indice v2 que quedara
     * por ahi se lee normal y sus campos salen sin tipo ('') en vez de fallar.
     */
    public function guardar_indice_campos(array $indice)
    {
        return $this->escribir_json($this->ruta_campos(), [
            'version' => 3,
            'items' => array_values($indice['items']),
            'meta' => isset($indice['meta']) && is_array($indice['meta']) ? $indice['meta'] : [],
        ]);
    }

    /** Fila del indice de un campo (null si no existe). */
    private function fila_indice($indice, $id)
    {
        $id = (int)$id;
        foreach ($indice['items'] as $f) {
            if (isset($f['id']) && (int) $f['id'] === $id) {
                return $f;
            }
        }
        return null;
    }

    /**
     * Actualiza meta.{id} (creado una vez; modificado = time(), el `?v=`).
     * Spec 015 D9: `meta` ya no lleva categorias (el filtro por chips desaparece).
     */
    private function tocar_meta(array $indice, $id)
    {
        $k = (string)$id;
        $indice['meta'][$k] = [
            'creado' => isset($indice['meta'][$k]['creado'])
                ? $indice['meta'][$k]['creado']
                : gmdate('Y-m-d\TH:i:s\Z'),
            'modificado' => time(),
        ];
        return $indice;
    }

    /**
     * Tipo valido (spec 015 D10): `texto|imagen|opciones` (cualquier otra -> '').
     * Antes esta funcion se llamaba `plantilla_valida` y aceptaba `select`, que
     * es el mismo concepto con otro nombre: describia de donde salio el campo, no
     * que es. Los tres son estructuralmente iguales (HTML + JS/CSS opcional y las
     * mismas opciones); el tipo solo DECLARA para que se usa el `valor`.
     */
    private function tipo_valida($tipo)
    {
        $t = strtolower(trim((string)$tipo));
        return in_array($t, ['texto', 'imagen', 'opciones'], true) ? $t : '';
    }

    /** Normaliza y acota los slots de `datos.json` (spec 015 D9: sin categorias). */
    private function normalizar_datos_campo(array $datos, $tipo = '')
    {
        $corta = function ($v, $n) {
            $v = trim(strip_tags((string)$v));
            return function_exists('mb_substr') ? mb_substr($v, 0, $n, 'UTF-8') : substr($v, 0, $n);
        };
        return [
            'nombre' => $corta(isset($datos['nombre']) ? $datos['nombre'] : '', 200),
            'descripcion' => $corta(isset($datos['descripcion']) ? $datos['descripcion'] : '', 500),
            'titulo_cliente' => $corta(isset($datos['titulo_cliente']) ? $datos['titulo_cliente'] : '', 200),
            'tipo' => $this->tipo_valida($tipo),
        ];
    }

    /**
     * Alta de campo v3. `$datos` son los slots de `datos.json` (opcionales):
     * nombre, descripcion, titulo_cliente y tipo (spec 020: sin `texto_ayuda`,
     * `array`, `protegido` ni `cargador`). `$tipo` declara para que se usa el
     * `valor` (texto|imagen|opciones).
     * El **id es el hueco mas bajo libre** y los ids dados de baja NUNCA se
     * reutilizan (quedan en el indice con baja:true). Devuelve el id.
     */
    public function campo_alta($tipo = '', array $datos = [], $htm = '', $css = '', $js = '')
    {
        $indice = $this->indice_campos();
        $usados = [];
        foreach ($indice['items'] as $f) {
            if (isset($f['id'])) {
                $usados[(int) $f['id']] = true;
            }
        }
        $id = 1;
        while (isset($usados[$id])) {
            $id++;
        }
        $datos = $this->normalizar_datos_campo($datos, $tipo);
        $indice['items'][] = ['id' => $id, 'tipo' => $datos['tipo'], 'baja' => false];
        $indice = $this->tocar_meta($indice, $id);
        if (!$this->guardar_indice_campos($indice) || !$this->escribir_campo($id, $datos, $htm, $css, $js)) {
            throw new Exception('motor:alta:directorio:no_escribible');
        }
        return $id;
    }

    /**
     * Baja de campo v2: marca `baja:true` en el indice y **CONSERVA** los
     * archivos (a diferencia de la v1, que los destruia con el tombstone), de
     * modo que `campo_restaurar()` los recupere integros. El id queda ocupado
     * para siempre.
     */
    public function campo_baja($id)
    {
        $id = $this->campo_id_seguro($id, 'baja');
        $indice = $this->indice_campos();
        $hubo = false;
        foreach ($indice['items'] as &$f) {
            if (isset($f['id']) && (int) $f['id'] === $id) {
                $f['baja'] = true;
                $hubo = true;
            }
        }
        unset($f);
        if (!$hubo) {
            $indice['items'][] = ['id' => $id, 'tipo' => '', 'baja' => true];
            $indice = $this->tocar_meta($indice, $id);
        }
        if (!$this->guardar_indice_campos($indice)) {
            throw new Exception('motor:baja:directorio:no_escribible');
        }
        return true;
    }

    /**
     * Edicion de campo v2: reescribe `datos.json` + los 3 archivos de codigo y
     * refresca `meta.{id}.modificado` (el `?v=`). **No toca** el flag `baja`.
     * Lanza motor:editar:campo:inexistente:N si el id no esta en el indice.
     */
    public function campo_editar($id, array $datos, $htm = '', $css = '', $js = '', $tipo = null)
    {
        $id = $this->campo_id_seguro($id, 'editar');
        $indice = $this->indice_campos();
        $fila = $this->fila_indice($indice, $id);
        if ($fila === null) {
            throw new Exception('motor:editar:campo:inexistente:' . $id);
        }
        // Spec 018 (D4/FR-007): el tipo se puede CORREGIR en edicion. Declara,
        // no enruta (015 D11): se actualiza el indice y `datos.json`, sin
        // reescribir el HTML/CSS/JS del campo. `null` = no se toca.
        $tipoActual = isset($fila['tipo']) ? (string) $fila['tipo'] : '';
        if ($tipo !== null) {
            $tipoNuevo = $this->tipo_valida($tipo);
            if ($tipoNuevo !== '' && $tipoNuevo !== $tipoActual) {
                foreach ($indice['items'] as $i => $f) {
                    if (isset($f['id']) && (int) $f['id'] === $id) {
                        $indice['items'][$i]['tipo'] = $tipoNuevo;
                    }
                }
                $tipoActual = $tipoNuevo;
            }
        }
        $datos = $this->normalizar_datos_campo($datos, $tipoActual);
        $indice = $this->tocar_meta($indice, $id);
        if (!$this->guardar_indice_campos($indice) || !$this->escribir_campo($id, $datos, $htm, $css, $js)) {
            throw new Exception('motor:editar:directorio:no_escribible');
        }
        return true;
    }

    /**
     * Restaura un campo dado de baja: vuelve a `baja:false` y conserva nombre,
     * HTML, CSS y JS intactos. Lanza motor:restaurar:campo:inexistente:N si el
     * id no existe o no estaba dado de baja.
     */
    public function campo_restaurar($id)
    {
        $id = $this->campo_id_seguro($id, 'restaurar');
        $indice = $this->indice_campos();
        $hubo = false;
        foreach ($indice['items'] as &$f) {
            if (isset($f['id']) && (int) $f['id'] === $id) {
                if (empty($f['baja'])) {
                    throw new Exception('motor:restaurar:campo:inexistente:' . $id);
                }
                $f['baja'] = false;
                $hubo = true;
            }
        }
        unset($f);
        if (!$hubo) {
            throw new Exception('motor:restaurar:campo:inexistente:' . $id);
        }
        $indice = $this->tocar_meta($indice, $id);
        if (!$this->guardar_indice_campos($indice)) {
            throw new Exception('motor:restaurar:directorio:no_escribible');
        }
        return true;
    }

    /** Duplica un campo: copia sus archivos a un id NUEVO. */
    public function campo_duplicar($id)
    {
        $id = $this->campo_id_seguro($id, 'duplicar');
        $origen = $this->leer_campo($id);
        if ($origen === null) {
            throw new Exception('motor:duplicar:campo:inexistente:' . $id);
        }
        $datos = $origen['datos'];
        if (!empty($datos['nombre'])) {
            $datos['nombre'] .= ' (copia)';
        }
        return $this->campo_alta(
            isset($datos['tipo']) ? $datos['tipo'] : '',
            $datos,
            $origen['htm'],
            $origen['css'],
            $origen['js']
        );
    }

    /**
     * Lista los campos con su codigo. Por defecto solo los activos; con
     * `$incluir_bajas = true` tambien los dados de baja (panel "Dados de baja"
     * con su boton Restaurar).
     */
    public function campo_listar($incluir_bajas = false)
    {
        $indice = $this->indice_campos();
        $salida = [];
        foreach ($indice['items'] as $f) {
            $id = (int) $f['id'];
            $baja = !empty($f['baja']);
            if ($baja && !$incluir_bajas) {
                continue;
            }
            $campo = $this->leer_campo($id);
            $datos = $campo !== null ? $campo['datos'] : [];
            $meta = isset($indice['meta'][(string)$id]) ? $indice['meta'][(string)$id] : [];
            $salida[$id] = [
                'id' => $id,
                // Un indice v2Trayendo `plantilla` cae en '' (campo sin tipo), no
                // rompe: se lee normal, solo queda sin declarar (arranque limpio).
                'tipo' => isset($f['tipo']) ? $f['tipo'] : '',
                'baja' => $baja,
                'datos' => $datos,
                'htm' => $campo !== null ? $campo['htm'] : '',
                'css' => $campo !== null ? $campo['css'] : '',
                'js' => $campo !== null ? $campo['js'] : '',
                'creado' => isset($meta['creado']) ? $meta['creado'] : '',
                'modificado' => isset($meta['modificado']) ? (int) $meta['modificado'] : 0,
            ];
        }
        ksort($salida);
        return $salida;
    }

    /**
     * Bool tolerante para valores de formulario (spec 005): acepta bool,
     * string, numero o lista. El patron hidden(0) + checkbox(1) manda una
     * lista donde gana el ultimo valor enviado (el checkbox real).
     */
    private function bool_form($v)
    {
        if (is_array($v)) {
            $v = end($v);
        }
        return !empty($v);
    }

    /**
     * Normaliza la seccion tienda{pid} de un config (spec 005 T002).
     * La validez se valida SOLO si es nueva o cambio respecto de `$previo`:
     * un valor guardado viejo que hoy no compila se conserva tal cual (el
     * spec lo tolera: la ficha lo trata como true) y jamas bloquea al resto
     * de la consola; lo nuevo o alterado se rechaza con causa.
     */
    private function config_tienda($valor, $previo = [])
    {
        $out = [];
        foreach ((array)$valor as $pid => $t) {
            if (!preg_match('/^[0-9]+$/', (string)$pid) || (int)$pid < 1 || !is_array($t)) {
                continue;
            }
            $k = (string)(int)$pid;
            $validez = isset($t['validez']) ? substr(trim((string)$t['validez']), 0, 2000) : '';
            if ($validez !== '') {
                $vieja = isset($previo[$k]['validez']) && is_scalar($previo[$k]['validez'])
                    ? substr(trim((string)$previo[$k]['validez']), 0, 2000) : null;
                if ($validez !== $vieja) {
                    $this->validar_script_campo('function(){' . $validez . '}');
                }
            }
            $mensaje = isset($t['mensaje_html']) ? substr(trim((string)$t['mensaje_html']), 0, 2000) : '';
            if ($mensaje !== '' && function_exists('wp_kses')) {
                $mensaje = wp_kses($mensaje, [
                    'p' => [], 'b' => [], 'i' => [], 'strong' => [], 'em' => [],
                    'br' => [], 'ul' => [], 'li' => [],
                ]);
            }
            $out[$k] = [
                'activo' => !array_key_exists('activo', $t) ? true : $this->bool_form($t['activo']),
                'validez' => $validez,
                'mensaje_html' => $mensaje,
                // `bloquear` solo tiene efecto con validez (data-model 005).
                'bloquear' => $validez !== '' && $this->bool_form(isset($t['bloquear']) ? $t['bloquear'] : false),
            ];
        }
        return $out;
    }

    /** Normaliza la seccion productos de un config (int[] unico, max 100). */
    private function config_productos($valor)
    {
        $ids = [];
        foreach ((array)$valor as $p) {
            $p = (int)$p;
            if ($p > 0) {
                $ids[] = $p;
            }
        }
        return array_values(array_slice(array_unique($ids), 0, 100));
    }

    /** Conserva posiciones parciales fuera del lienzo con un limite seguro. */
    private function mockup_posicion($valor)
    {
        return max(-3000, min(3000, (int)$valor));
    }

    private function mockup_perspectiva($valor)
    {
        if (!is_array($valor) || !isset($valor['puntos']) || !is_array($valor['puntos'])
            || count($valor['puntos']) !== 4) {
            return null;
        }
        $puntos = [];
        foreach (array_values($valor['puntos']) as $punto) {
            if (!is_array($punto) || !is_numeric($punto['x'] ?? null) || !is_numeric($punto['y'] ?? null)) {
                return null;
            }
            $puntos[] = [
                'x' => $this->clamp_float((float)$punto['x'], 0, 1),
                'y' => $this->clamp_float((float)$punto['y'], 0, 1),
            ];
        }
        $signo = 0;
        for ($i = 0; $i < 4; $i++) {
            $a = $puntos[$i];
            $b = $puntos[($i + 1) % 4];
            $c = $puntos[($i + 2) % 4];
            $cruz = ($b['x'] - $a['x']) * ($c['y'] - $b['y'])
                - ($b['y'] - $a['y']) * ($c['x'] - $b['x']);
            if (abs($cruz) < 0.0001) {
                return null;
            }
            $actual = $cruz > 0 ? 1 : -1;
            if ($signo !== 0 && $actual !== $signo) {
                return null;
            }
            $signo = $actual;
        }
        $neutros = [[0, 0], [1, 0], [1, 1], [0, 1]];
        foreach ($puntos as $i => $punto) {
            if (abs($punto['x'] - $neutros[$i][0]) > 0.0001
                || abs($punto['y'] - $neutros[$i][1]) > 0.0001) {
                return ['puntos' => $puntos];
            }
        }
        return null;
    }

    /**
     * Normaliza mockups de salida 300x300; x/y admiten desborde limitado.
     *
     * Spec 011: el contrato de capa se amplia de forma retrocompatible.
     * - `ref` con namespace `{ambito}:{valor}` (`pdf:` = foto del PDF,
     *   `img:` = id numerico del catalogo `img.json`). Un `ref` plano se lee
     *   como `pdf:` (compatibilidad con los mockups previos), porque antes el
     *   validador rechazaba cualquier `ref` con `/` y hacia imposible el
     *   formato del contrato 004.
     * - `filtros` acepta brillo/gama/contraste/saturacion 0..200, opacidad
     *   0..100, desenfoque 0..20 y tono -180..180. El valor igual al default
     *   se borra (no se persiste lo neutro).
     * - Campos nuevos opcionales: `modo` (normal|multiply), `nombre`,
     *   `oculta`, `bloqueada`.
     * Un mockup puede guardarse sin capas (se crea vacio y se completa
     * despues); lo que no se permite es una capa invalida.
     */
    private function config_mockups($valor)
    {
        $out = [];
        foreach ((array)$valor as $m) {
            if (!is_array($m)) {
                continue;
            }
            $id = isset($m['id']) ? $this->nombre_seguro((string)$m['id'], 'config_mockups') : '';
            $capas = [];
            foreach ((array)($m['capas'] ?? []) as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $tipo = isset($c['tipo']) ? (string)$c['tipo'] : '';
                if ($tipo !== 'img' && $tipo !== 'placeholder') {
                    continue;
                }
                $ref = $this->mockup_ref_capa($tipo, trim((string)($c['ref'] ?? '')));
                if ($ref === '') {
                    continue;
                }
                $capa = [
                    'tipo' => $tipo,
                    'ref' => $ref,
                    'x' => $this->mockup_posicion($c['x'] ?? 0),
                    'y' => $this->mockup_posicion($c['y'] ?? 0),
                    'w' => max(1, min(1200, (int)($c['w'] ?? 0))),
                    'h' => max(1, min(1200, (int)($c['h'] ?? 0))),
                    'rot' => $this->clamp_float((float)($c['rot'] ?? 0), -360, 360),
                    'grupo_rot' => $this->clamp_float((float)($c['grupo_rot'] ?? 0), -360, 360),
                    'sesgo' => $this->clamp_float((float)($c['sesgo'] ?? 0), -1, 1),
                    'filtros' => $this->mockup_filtros($c['filtros'] ?? []),
                    'modo' => $this->mockup_modo($c['modo'] ?? 'normal'),
                    'nombre' => substr(trim((string)($c['nombre'] ?? '')), 0, 60),
                    'oculta' => !empty($c['oculta']),
                    'bloqueada' => !empty($c['bloqueada']),
                    'grupo' => preg_match('/^g-[a-z0-9_-]{1,36}$/', (string)($c['grupo'] ?? ''))
                        ? (string)$c['grupo'] : '',
                    // Envoltura (PowerClip del PDF): solo tiene sentido en capas
                    // placeholder; en `img` se fuerza a false.
                    'envoltura' => $tipo === 'placeholder' && !empty($c['envoltura']),
                ];
                $perspectiva = $this->mockup_perspectiva($c['perspectiva'] ?? null);
                if ($perspectiva !== null) {
                    $capa['perspectiva'] = $perspectiva;
                }
                $capas[] = $capa;
            }
            if ($id === '' || isset($out[$id])) {
                continue;
            }
            $out[$id] = [
                'id' => $id,
                'titulo' => isset($m['titulo']) ? substr(trim((string)$m['titulo']), 0, 200) : '',
                'creado' => isset($m['creado']) ? substr((string)$m['creado'], 0, 32) : '',
                'capas' => $capas,
            ];
        }
        return array_values($out);
    }

    /**
     * Publica la normalizacion de mockups para que el handler que guarda el
     * editor use EXACTAMENTE la misma regla (una sola implementacion: si el
     * handler sanea distinto, se pierde lo que el motor no acepta).
     */
    public function normalizar_mockups($valor)
    {
        return $this->config_mockups($valor);
    }

    /**
     * `ref` de capa normalizado. Vacio = ref invalida.
     * - tipo `img`: namespace `{ambito}:{valor}`; `pdf:` = nombre de archivo
     *   del ambito del PDF, `img:` = id numerico del catalogo `img.json`. Un
     *   `ref` plano se lee como `pdf:` (compatibilidad con mockups previos).
     * - tipo `placeholder`: NO lleva namespace; es `{grupo_id}` o
     *   `{grupo_id}#{indice}` (id de color hex de `analisis.json`).
     */
    private function mockup_ref_capa($tipo, $ref)
    {
        $ref = trim((string)$ref);
        if ($ref === '') {
            return '';
        }
        if ($tipo === 'placeholder') {
            // Grupo = id hex de 6 digitos, con indice de instancia opcional.
            // Se aceptan indices 0-based (`#0`, historico) y 1-based (`#1`,
            // los que genera el editor): el validador no debe rechazar un
            // mockup previo por el formato del indice.
            if (!preg_match('/^([0-9A-F]{6})(?:#([0-9]{1,3}))?$/', $ref, $mm)) {
                return '';
            }
            return isset($mm[2]) ? $mm[1] . '#' . $mm[2] : $mm[1];
        }
        $ambito = 'pdf';
        $valor = $ref;
        $corte = strpos($ref, ':');
        if ($corte !== false && $corte > 0) {
            $ambito = substr($ref, 0, $corte);
            $valor = substr($ref, $corte + 1);
        }
        $ambito = strtolower(trim($ambito));
        // Spec 011 (T032): 'mock:' es el catalogo EXCLUSIVO de mockups.
        // 'img:' ya no se usa en capas (no hay mockups previos que migrar).
        if ($ambito === 'mock') {
            $id = (int)$valor;
            return $id > 0 ? 'mock:' . $id : '';
        }
        if ($ambito !== 'pdf') {
            return '';
        }
        // Nombre de archivo plano: sin rutas ni traversal.
        $valor = trim($valor);
        if ($valor === '' || $valor === '.' || $valor === '..'
            || strpos($valor, '/') !== false || strpos($valor, '\\') !== false) {
            return '';
        }
        return 'pdf:' . substr($valor, 0, 128);
    }

    /**
     * Ajustes por capa: allowlist cerrada y clamp por clave. El valor igual al
     * default NO se persiste, para que la ausencia signifique "neutro".
     */
    private function mockup_filtros($valor)
    {
        // clave => [min, max, default, admite decimales]
        $rangos = [
            'brillo' => [0, 200, 100, false],
            'gama' => [0, 200, 100, false],
            'contraste' => [0, 200, 100, false],
            'saturacion' => [0, 200, 100, false],
            'opacidad' => [0, 100, 100, false],
            'desenfoque' => [0, 20, 0, true],
            'tono' => [-180, 180, 0, true],
        ];
        $filtros = [];
        foreach ((array)$valor as $k => $v) {
            $k = (string)$k;
            if (!isset($rangos[$k])) {
                continue;
            }
            $rango = $rangos[$k];
            $num = $this->clamp_float((float)$v, $rango[0], $rango[1]);
            if ($rango[3]) {
                $num = round($num, 2);
            } else {
                $num = (int)round($num);
            }
            if (abs($num - $rango[2]) < 0.001) {
                continue; // neutro: no se persiste
            }
            $filtros[$k] = $num;
        }
        return $filtros;
    }

    /** Modo de fusion de la capa (allowlist corta, extensible). */
    private function mockup_modo($valor)
    {
        $modo = strtolower(trim((string)$valor));
        return in_array($modo, ['normal', 'multiply'], true) ? $modo : 'normal';
    }

    /** Clamp de float con limites inclusivos. */
    private function clamp_float($valor, $min, $max)
    {
        $valor = (float)$valor;
        if ($valor < $min) {
            return (float)$min;
        }
        if ($valor > $max) {
            return (float)$max;
        }
        return $valor;
    }



    /** Normaliza el mapeo placeholders (id hex => tipo/preset/value/settings/repetir). */
    private function config_placeholders($valor)
    {
        $ph = [];
        foreach ((array)$valor as $gid => $m) {
            $gid = strtoupper((string)$gid);
            if (!preg_match('/^[0-9A-F]{6}$/', $gid) || !is_array($m)) {
                continue;
            }
            $tipo = isset($m['tipo']) ? (string)$m['tipo'] : 'texto';
            if ($tipo !== 'texto' && $tipo !== 'imagen') {
                continue;
            }
            $ph[$gid] = [
                'tipo' => $tipo,
                'preset' => isset($m['preset']) && $m['preset'] !== '' ? (string)$m['preset'] : null,
                'value' => isset($m['value']) ? (string)$m['value'] : '',
                'settings' => isset($m['settings']) ? (string)$m['settings'] : '',
                'repetir' => !empty($m['repetir']),
            ];
        }
        return $ph;
    }

    /**
     * Envoltura representativa por grupo (editable en la consola):
     * `{gid: {forma: k}}` con k = indice 1-based dentro de `formas` de
     * envolturas.json. 0/ausente = la detectada (la mas usada). Mismo saneo
     * al leer y al guardar (una sola implementacion).
     */
    private function config_envolturas($valor)
    {
        $out = [];
        foreach ((array)$valor as $gid => $m) {
            $gid = strtoupper((string)$gid);
            if (preg_match('/^[0-9A-F]{6}$/', $gid) !== 1 || !is_array($m)) {
                continue;
            }
            $k = (int)(isset($m['forma']) ? $m['forma'] : 0);
            if ($k > 0) {
                $out[$gid] = ['forma' => $k];
            }
        }
        return $out;
    }

    /**
     * Envoltura del CARGADOR por campo en ESTE PDF (`{campo_id: gid}`): la
     * guia visual que ve el comprador al subir/cortar su foto (opcion b: la
     * asociacion es por PDF, porque un campo se reutiliza en N PDFs). Vacio =
     * sin guia. Mismo saneo al leer y al guardar.
     */
    private function config_campos_envoltura($valor)
    {
        $out = [];
        foreach ((array)$valor as $cid => $gid) {
            $cid = (int)$cid;
            $gid = strtoupper(trim((string)$gid));
            if ($cid < 1 || preg_match('/^[0-9A-F]{6}$/', $gid) !== 1) {
                continue;
            }
            $out[(string)$cid] = $gid;
        }
        return $out;
    }

    /**
     * Publica la normalizacion de bonus para que el handler que guarda la
     * consola use EXACTAMENTE la misma regla (una sola implementacion: si el
     * handler sanea distinto, se pierde lo que el motor no acepta).
     */
    public function normalizar_bonus($valor)
    {
        return $this->config_bonus($valor);
    }

    /**
     * Normaliza la lista de bonus del PDF (0..N). Filas v2 (4.7.0):
     * - {archivo, titulo}  -> archivo de la libreria global (compartido);
     *   `titulo` PUEDE ser vacio = usar el titulo por defecto DINAMICO del
     *   catalogo (bonus.json).
     * - {url, titulo}       -> URL externa (http/https); con titulo vacio el
     *   congelado usa el nombre del archivo de la URL.
     * Las filas invalidas se descartan en silencio (lectura tolerante).
     */
    private function config_bonus($valor)
    {
        $out = [];
        foreach ((array)$valor as $b) {
            if (!is_array($b)) {
                continue;
            }
            $titulo = substr(trim((string)($b['titulo'] ?? '')), 0, 80);
            $archivo = basename(str_replace('\\', '/', (string)($b['archivo'] ?? '')));
            $url = trim((string)($b['url'] ?? ''));
            if ($archivo !== '' && $archivo !== '.' && $archivo !== '..' && $this->bonus_ext_valida($archivo)) {
                $out[] = ['archivo' => $archivo, 'titulo' => $titulo];
                continue;
            }
            if ($url === '') {
                continue; // sin archivo ni url: fila inutil, se descarta
            }
            if (preg_match('#^https?://#i', $url)) {
                $out[] = ['url' => substr($url, 0, 500), 'titulo' => $titulo];
            }
            // Spec 020 (B5): una url relativa (layout viejo 4.6.18-4.6.20) se
            // descarta; la libreria global se referencia con `archivo`.
        }
        return array_values($out);
    }



    /**
     * Normaliza la seccion preview_omisible de un config (bool, solo persiste
     * cuando el PDF ya tiene mockups creados; ver T011 y fase mockups).
     */
    private function config_omisible($valor, $tiene_mockups)
    {
        return $tiene_mockups ? !empty($valor) : false;
    }

    /** Lee el config.json editable de un PDF (o defaults si no existe). */
    public function leer_config($pdf)
    {
        $pdf = $this->nombre_seguro($pdf, 'leer_config');
        $ruta = $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $pdf
            . DIRECTORY_SEPARATOR . 'config.json';
        $base = ['activo' => false, 'productos' => [], 'campos_ids' => [], 'preview_omisible' => false, 'mockups' => [], 'placeholders' => [], 'tienda' => [], 'bonus' => [], 'envolturas' => [], 'campos_envoltura' => []];
        $datos = $this->leer_json($ruta);
        if (!is_array($datos)) {
            return $base;
        }
        if (array_key_exists('activo', $datos)) {
            $base['activo'] = (bool)$datos['activo'];
        }
        if (isset($datos['productos'])) {
            $base['productos'] = $this->config_productos($datos['productos']);
        }
        if (isset($datos['campos_ids']) && is_array($datos['campos_ids'])) {
            $ids = [];
            foreach ($datos['campos_ids'] as $c) {
                $c = (int)$c;
                if ($c > 0) {
                    $ids[] = $c;
                }
            }
            $base['campos_ids'] = array_values(array_unique($ids));
        }
        if (isset($datos['mockups'])) {
            $base['mockups'] = $this->config_mockups($datos['mockups']);
        }
        $base['preview_omisible'] = $this->config_omisible(
            isset($datos['preview_omisible']) ? $datos['preview_omisible'] : false,
            count($base['mockups']) > 0
        );
        if (isset($datos['placeholders'])) {
            $base['placeholders'] = $this->config_placeholders($datos['placeholders']);
        }
        if (isset($datos['bonus'])) {
            $base['bonus'] = $this->config_bonus($datos['bonus']);
        }
        if (isset($datos['envolturas'])) {
            $base['envolturas'] = $this->config_envolturas($datos['envolturas']);
        }
        if (isset($datos['campos_envoltura'])) {
            $base['campos_envoltura'] = $this->config_campos_envoltura($datos['campos_envoltura']);
        }
        if (isset($datos['tienda'])) {
            // Lectura tolerante: `previo` = el mismo valor crudo del disco, asi
            // una validez vieja que hoy no compila se conserva (no rompe leer).
            $base['tienda'] = $this->config_tienda($datos['tienda'], $datos['tienda']);
        }
        return $base;
    }

    /**
     * Guarda el config.json editable de un PDF de forma atomica.
     * Nunca toca el dataset: solo activo, productos, campos, mockups,
     * preview_omisible, mapeos y tienda (spec 005).
     * Devuelve true/false (no lanza salvo nombre invalido).
     */
    public function guardar_config($pdf, array $config)
    {
        $pdf = $this->nombre_seguro($pdf, 'guardar_config');
        $dir = $this->dir_pdf($pdf, true);
        $canon = $this->leer_config($pdf);
        if (array_key_exists('activo', $config)) {
            $canon['activo'] = (bool)$config['activo'];
        }
        if (isset($config['productos'])) {
            $canon['productos'] = $this->config_productos($config['productos']);
        }
        if (isset($config['campos_ids'])) {
            $ids = [];
            foreach ((array)$config['campos_ids'] as $c) {
                $c = (int)$c;
                if ($c > 0) {
                    $ids[] = $c;
                }
            }
            $canon['campos_ids'] = array_values(array_unique($ids));
        }
        if (isset($config['mockups'])) {
            $canon['mockups'] = $this->config_mockups($config['mockups']);
        }
        $canon['preview_omisible'] = $this->config_omisible(
            isset($config['preview_omisible']) ? $config['preview_omisible'] : $canon['preview_omisible'],
            count($canon['mockups']) > 0
        );
        if (isset($config['placeholders'])) {
            $canon['placeholders'] = $this->config_placeholders($config['placeholders']);
        }
        if (isset($config['bonus'])) {
            $canon['bonus'] = $this->config_bonus($config['bonus']);
        }
        if (isset($config['envolturas'])) {
            $canon['envolturas'] = $this->config_envolturas($config['envolturas']);
        }
        if (isset($config['campos_envoltura'])) {
            $canon['campos_envoltura'] = $this->config_campos_envoltura($config['campos_envoltura']);
        }
        if (isset($config['tienda'])) {
            // Validacion por cambio: compara contra lo ya guardado (`$canon`).
            $canon['tienda'] = $this->config_tienda($config['tienda'], $canon['tienda']);
        }
        return $this->escribir_json($dir . DIRECTORY_SEPARATOR . 'config.json', $canon);
    }

    /* ==================== Tuplas v5.0 ==================== */

    /** Alta: reutiliza el hueco (tombstone) mas bajo o anexa max(id)+1. */
    private function tupla_alta(&$items, $title, $cats, $file)
    {
        $maxId = 0;
        $hueco = 0;
        foreach ((array)$items as $t) {
            if (!is_array($t) || count($t) < 4) {
                continue;
            }
            $id = (int)$t[0];
            if ($id > $maxId) {
                $maxId = $id;
            }
            if ((string)$t[1] === '' && (string)$t[2] === '' && (string)$t[3] === ''
                && ($hueco === 0 || $id < $hueco)) {
                $hueco = $id;
            }
        }
        if ($hueco > 0) {
            foreach ($items as $i => $t) {
                if (is_array($t) && (int)$t[0] === $hueco) {
                    $items[$i] = [$hueco, $title, $cats, $file];
                    return $hueco;
                }
            }
        }
        $items[] = [$maxId + 1, $title, $cats, $file];
        return $maxId + 1;
    }

    /** Baja: tombstone sin reindexar. */
    private function tupla_baja(&$items, $id)
    {
        foreach ($items as $i => $t) {
            if (is_array($t) && (int)$t[0] === (int)$id) {
                $items[$i] = [(int)$id, '', '', ''];
                return true;
            }
        }
        return false;
    }

    /** Id de la tupla cuyo file coincide. 0 si no esta. */
    private function tupla_id_de_file($items, $file)
    {
        foreach ((array)$items as $t) {
            if (is_array($t) && count($t) >= 4 && (string)$t[3] === (string)$file) {
                return (int)$t[0];
            }
        }
        return 0;
    }


    /* ==================== Utilidades ==================== */

    /** Verifica la firma (magic bytes) de una imagen segun su extension. */
    private function firma_imagen_valida($ruta, $ext)
    {
        // 8 bytes bastan para la firma PNG; leer 12 y comparar contra 8
        // hacia que NINGUN png pasara nunca la validacion (bug real:
        // `motor:alta:<ambito>:tipo:invalido` al subir imagenes al catalogo).
        $firma = (string)@file_get_contents($ruta, false, null, 0, 12);
        $corta = substr($firma, 0, 8);
        if ($ext === 'png') {
            return $corta === "\x89PNG\r\n\x1a\n";
        }
        if ($ext === 'jpg' || $ext === 'jpeg') {
            return substr($firma, 0, 3) === "\xFF\xD8\xFF";
        }
        if ($ext === 'webp') {
            return strlen($firma) >= 12 && substr($firma, 0, 4) === 'RIFF' && substr($firma, 8, 4) === 'WEBP';
        }
        if ($ext === 'svg') {
            return strpos($firma, '<') !== false || substr($firma, 0, 5) === '<?xml';
        }
        // Spec 011 (T032): GIF. La lista de extensiones de los ambitos de imagen
        // ya lo aceptaba, pero la firma no lo contemplaba y cualquier alta de
        // un GIF fallaba con `motor:alta:<ambito>:tipo:invalido`.
        if ($ext === 'gif') {
            return strpos($firma, 'GIF') !== false;
        }
        return false;
    }

    /** Valida firma binaria (magic bytes) de fuentes TTF/OTF/WOFF/WOFF2. */
    private function firma_fuente_valida($ruta, $ext)
    {
        $f = @fopen($ruta, 'rb');
        if (!$f) {
            return false;
        }
        $bytes = (string)@fread($f, 4);
        @fclose($f);
        if (strlen($bytes) < 4) {
            return false;
        }
        switch ($ext) {
            case 'ttf':
                return $bytes === "\x00\x01\x00\x00" || $bytes === 'true';
            case 'otf':
                return $bytes === 'OTTO';
            case 'woff':
                return $bytes === 'wOFF';
            case 'woff2':
                return $bytes === 'wOF2';
        }
        return false;
    }

    /** Mueve un upload validado a $dir con nombre unico. Devuelve el filename. */
    private function mover_upload($file, $dir, $exts, $op, $base)
    {
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, $exts, true)) {
            throw new Exception('motor:' . $op . ':tipo:invalido');
        }
        if (in_array($ext, ['ttf', 'otf', 'woff', 'woff2'], true)) {
            $ok = $this->firma_fuente_valida($file['tmp_name'], $ext);
        } else {
            $ok = $this->firma_imagen_valida($file['tmp_name'], $ext);
        }
        if (!$ok) {
            throw new Exception('motor:' . $op . ':tipo:invalido');
        }
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        if ($base === '') {
            $base = 'recurso';
        }
        $destino = $base . '.' . $ext;
        $i = 2;
        while (is_file($dir . DIRECTORY_SEPARATOR . $destino)) {
            $destino = $base . '-' . $i . '.' . $ext;
            $i++;
        }
        // `move_uploaded_file()` solo acepta ficheros subidos por HTTP: en CLI (los
// tests) siempre falla, y el mensaje de "no_escribible" era falso. Se usa el
// metodo nativo cuando viene de una subida real y `rename`/`copy` si no.
$destinoFinal = $dir . DIRECTORY_SEPARATOR . $destino;
$movido = false;
if (is_uploaded_file($file['tmp_name'])) {
    $movido = @move_uploaded_file($file['tmp_name'], $destinoFinal);
} else {
    $movido = @rename($file['tmp_name'], $destinoFinal);
    if (!$movido) {
        $movido = @copy($file['tmp_name'], $destinoFinal);
    }
}
if (!$movido) {
    throw new Exception('motor:' . $op . ':subida:fallo');
}
return $destino;
    }

    private function url_de($ambito, $archivo)
    {
        $ruta = $this->dir_ambito($ambito) . DIRECTORY_SEPARATOR . $archivo;
        return $this->url_ambito($ambito) . rawurlencode($archivo) . '?v=' . (int)@filemtime($ruta);
    }

    /** Categorias: string o lista; vacio => custom (el parser normaliza a lista). */
    private function normalizar_cats($cats)
    {
        if (is_array($cats)) {
            $cats = implode(',', $cats);
        }
        $cats = trim((string)$cats);
        return $cats === '' ? 'custom' : $cats;
    }


    /* ==================== Listados (motor-generated) ==================== */

    /** op=listar: inventario del ambito con fisicos verificados (cero 404).
     *  Excluye fisicos ausentes con contador 'ausentes' (la purga se hace por baja). */
    public function listar($ambito)
    {
        if (!in_array($ambito, self::$AMBITOS_GALERIA, true)) {
            throw new Exception('motor:listar:ambito:invalido:' . $ambito);
        }
        $res = $this->catalogo($ambito, 'listar');
        $cat = $res['cat'];
        $dir = $this->dir_ambito($ambito);
        $items = [];
        $ausentes = 0;
        foreach ($cat['items'] as $t) {
            if (!is_array($t) || count($t) < 4) {
                continue; // forma invalida: fuera del listado
            }
            $id = (int)$t[0];
            $title = (string)$t[1];
            $cats = $this->normalizar_cats($t[2] ?? '');
            $file = (string)$t[3];
            if ($id < 1 || $file === '') {
                continue; // hueco/entrada libre: no se muestra
            }
            $esFamiliaRemota = ($ambito === 'fonts' && strpos($file, '.') === false);
            if (!$esFamiliaRemota && !is_file($dir . DIRECTORY_SEPARATOR . $file)) {
                $ausentes++;
                continue; // fisico ausente: cero 404
            }
            $items[] = [
                'id' => $id,
                'title' => ($title !== '' ? $title : $file),
                'cats' => $cats,
                'file' => $file,
                'url' => ($esFamiliaRemota ? '' : $this->url_de($ambito, $file)),
            ];
        }
        $out = ['catalogo' => ['thumbs' => $cat['thumbs']], 'items' => $items, 'ausentes' => $ausentes];
        if ($res['aviso']) {
            $out['aviso'] = $res['aviso'];
        }
        return $out;
    }

    /** Nombres (slugs) de presets vigentes: fisicos .txm presentes en el catalogo. */
    public function presets_nombres()
    {
        $res = $this->catalogo('tm-presets', 'listar');
        // US1: un catalogo ilegible se avisa con causa, nunca se silencia.
        if (!empty($res['aviso'])) {
            throw new Exception($res['aviso']);
        }
        $dir = $this->dir_ambito('tm-presets');
        $out = [];
        foreach ($res['cat']['items'] as $t) {
            if (!is_array($t) || count($t) < 4) {
                continue;
            }
            $file = (string)$t[3];
            if ($file === '' || !preg_match('/[.]txm$/i', $file)) {
                continue;
            }
            if (!is_file($dir . DIRECTORY_SEPARATOR . $file)) {
                continue;
            }
            $out[] = basename($file, '.txm');
        }
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);
        return $out;
    }

    /** Listado agregado para el puente (presets, imagenes, fuentes).
     *
     *  Sin cache a proposito: se construye en el FRENTE (`wp_enqueue_scripts`,
     *  con solo `is_product()`), asi que corre en cada visita a una pagina de
     *  producto, bots incluidos. Cachearlo se considero y se descarto: releer 3
     *  JSON de 5-8 KB y normalizar ~200 items cuesta fracciones de ms, mientras
     *  que el transient anade un estado que puede quedar viejo si se escapa una
     *  invalidacion (subir un recurso y no verse durante el TTL). El problema
     *  real era la ESCRITURA en lectura, y se resuelve en `catalogo()`: ahora
     *  listar no toca disco. */
    public function listar_todo()
    {
        $presets = [];
        foreach ($this->listar('tm-presets')['items'] as $it) {
            $presets[] = ['nombre' => basename($it['file'], '.txm'), 'titulo' => $it['title'], 'id' => $it['id']];
        }
        $imagenes = [];
        foreach ($this->listar('img')['items'] as $it) {
            $imagenes[] = [
                'nombre' => $it['file'],
                'categoria' => $it['cats'],
                'titulo' => $it['title'],
                'url' => $it['url'],
                'id' => $it['id'],
                'thumb' => '',
            ];
        }
        usort($imagenes, function ($a, $b) {
            return strcmp($a['categoria'], $b['categoria']) ?: strcasecmp($a['nombre'], $b['nombre']);
        });
        $fuentes = [];
        foreach ($this->listar('fonts')['items'] as $it) {
            if ($it['url'] === '') {
                continue; // familia Google: el modulo la carga lazy por su cuenta
            }
            $fuentes[] = [
                'nombre' => $it['file'],
                'titulo' => $it['title'],
                'ext' => pathinfo($it['file'], PATHINFO_EXTENSION),
                'url' => $it['url'],
                'id' => $it['id'],
            ];
        }
        return ['presets' => $presets, 'imagenes' => $imagenes, 'fuentes' => $fuentes];
    }


    /* ==================== Escritura (excepciones con causa) ==================== */

    private function exigir_galeria($ambito, $op)
    {
        if (!in_array($ambito, self::$AMBITOS_GALERIA, true)) {
            throw new Exception('motor:' . $op . ':ambito:invalido:' . $ambito);
        }
    }

    /** op=alta: img (archivo), fonts (archivo) o tm-presets (contenido del .txm). */
    public function alta($ambito, $title, $cats, $file, $contenido)
    {
        $op = 'alta';
        $this->exigir_galeria($ambito, $op);
        $title = trim((string)$title);
        if ($title === '') {
            throw new Exception('motor:' . $op . ':falta:title');
        }
        $dir = $this->dir_ambito($ambito, true);
        $cats = $this->normalizar_cats($cats);

        if ($ambito === 'tm-presets') {
            $nombre = $this->nombre_seguro($title);
            if ($nombre === '') {
                throw new Exception('motor:' . $op . ':nombre:invalido');
            }
            // wp_unslash: WordPress aplica magic quotes a $_POST y el JSON del
            // .txm llega con comillas escapadas (rompia json_decode con
            // "motor:alta:contenido:invalido" en todo guardado de presets).
            $datos = json_decode(wp_unslash((string)$contenido), true);
            if (!is_array($datos)
                || (isset($datos['format']) ? $datos['format'] : '') !== 'textmuy-project'
                // RC58 del modulo: PROJECT_VERSION=2. Lista cerrada [1,2]: un modulo
                // viejo en cache sigue pudiendo guardar v1; un v3 no se cuela.
                || !in_array((int)($datos['version'] ?? 0), [1, 2], true)) {
                throw new Exception('motor:' . $op . ':contenido:invalido');
            }
            $file = $nombre . '.txm';
            if (!@file_put_contents($dir . DIRECTORY_SEPARATOR . $file, wp_json_encode($datos, JSON_UNESCAPED_UNICODE))) {
                throw new Exception('motor:' . $op . ':directorio:no_escribible');
            }
        } else {
            if (empty($file) || !is_array($file) || ($file['error'] ?? 1) !== UPLOAD_ERR_OK) {
                throw new Exception('motor:' . $op . ':falta:archivo');
            }
            $base = $this->nombre_seguro($title);
            if ($base === '') {
                $base = $this->nombre_seguro(pathinfo((string)$file['name'], PATHINFO_FILENAME));
            }
            // Spec 011 (T032): 'img' y 'mockups' son ambitos de IMAGEN; el resto, de fuentes.
            $esImagen = in_array($ambito, ['img', 'mockups'], true);
            $exts = $esImagen ? ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] : ['ttf', 'otf', 'woff', 'woff2'];
            $file = $this->mover_upload($file, $dir, $exts, $op . ':' . $ambito, $base);
        }

        $res = $this->catalogo($ambito, $op);
        $cat = $res['cat'];
        $id = $this->tupla_alta($cat['items'], $title, $cats, $file);
        $this->guardar_catalogo($ambito, $cat);
        return ['id' => $id, 'nombre' => $file, 'url' => $this->url_de($ambito, $file)];
    }

    /** op=baja: por id o por file; tombstone sin reindexar + unlink fisico. */
    public function baja($ambito, $id, $file)
    {
        $op = 'baja';
        $this->exigir_galeria($ambito, $op);
        $res = $this->catalogo($ambito, $op);
        $cat = $res['cat'];
        $dir = $this->dir_ambito($ambito);
        $id = (int)$id;
        $file = (string)$file;
        if ($id < 1 && $file === '') {
            throw new Exception('motor:' . $op . ':falta:id|file');
        }
        if ($id < 1) {
            $id = $this->tupla_id_de_file($cat['items'], $file);
            if ($id < 1) {
                throw new Exception('motor:' . $op . ':recurso:ausente');
            }
        }
        foreach ($cat['items'] as $t) {
            if (is_array($t) && (int)$t[0] === $id) {
                $file = ($file !== '') ? $file : (string)$t[3];
                break;
            }
        }
        if ($file !== '') {
            $ruta = $dir . DIRECTORY_SEPARATOR . $file;
            if (is_file($ruta) && !@unlink($ruta)) {
                throw new Exception('motor:' . $op . ':directorio:no_escribible');
            }
            if ($ambito === 'tm-presets') {
                @unlink($dir . DIRECTORY_SEPARATOR . $this->nombre_seguro(pathinfo($file, PATHINFO_FILENAME)) . '.webp'); // resto deprecado
            }
        }
        $this->tupla_baja($cat['items'], $id);
        $this->guardar_catalogo($ambito, $cat);
        return ['id' => $id, 'nombre' => $file];
    }


    /** op=editar: title/cats siempre; file renombra el fisico conservando extension. */
    public function editar($ambito, $id, $nuevo)
    {
        $op = 'editar';
        $this->exigir_galeria($ambito, $op);
        $id = (int)$id;
        if ($id < 1) {
            throw new Exception('motor:' . $op . ':falta:id');
        }
        $res = $this->catalogo($ambito, $op);
        $cat = $res['cat'];
        $dir = $this->dir_ambito($ambito);
        $encontrado = false;
        $fileFinal = '';
        foreach ($cat['items'] as $i => $t) {
            if (!is_array($t) || (int)$t[0] !== $id) {
                continue;
            }
            $encontrado = true;
            $fileFinal = (string)$t[3];
            if (isset($nuevo['title']) && trim((string)$nuevo['title']) !== '') {
                $cat['items'][$i][1] = trim((string)$nuevo['title']);
            }
            if (isset($nuevo['cats'])) {
                $cat['items'][$i][2] = $this->normalizar_cats($nuevo['cats']);
            }
            if (isset($nuevo['file']) && (string)$nuevo['file'] !== '') {
                $fileAntiguo = (string)$t[3];
                $ext = strtolower(pathinfo($fileAntiguo, PATHINFO_EXTENSION));
                $base = $this->nombre_seguro(pathinfo((string)$nuevo['file'], PATHINFO_FILENAME));
                if ($base === '') {
                    throw new Exception('motor:' . $op . ':nombre:invalido');
                }
                $nuevoFile = $base . ($ext !== '' ? '.' . $ext : '');
                if ($nuevoFile !== $fileAntiguo && $fileAntiguo !== '') {
                    $origen = $dir . DIRECTORY_SEPARATOR . $fileAntiguo;
                    if (!is_file($origen)) {
                        throw new Exception('motor:' . $op . ':recurso:ausente');
                    }
                    $destino = $dir . DIRECTORY_SEPARATOR . $nuevoFile;
                    $k = 2;
                    while (is_file($destino)) {
                        $destino = $dir . DIRECTORY_SEPARATOR . $base . '-' . $k . ($ext !== '' ? '.' . $ext : '');
                        $k++;
                    }
                    if (!@rename($origen, $destino)) {
                        throw new Exception('motor:' . $op . ':directorio:no_escribible');
                    }
                    $nuevoFile = basename($destino);
                }
                $cat['items'][$i][3] = $nuevoFile;
                $fileFinal = $nuevoFile;
            }
        }
        if (!$encontrado) {
            throw new Exception('motor:' . $op . ':recurso:ausente');
        }
        $this->guardar_catalogo($ambito, $cat);
        $out = ['id' => $id, 'nombre' => $fileFinal];
        if ($fileFinal !== '') {
            $out['url'] = $this->url_de($ambito, $fileFinal);
        }
        return $out;
    }

    /**
     * op=sprite: persiste thumbs.webp del ambito (delega fisica a PMU_Galeria).
     *
     * RC46 / spec 009 (T004): la validacion de firma y dimensiones y la
     * escritura de `thumbs.sprite_firma` ya no son exclusivas de `img`. Antes
     * solo `img` certificaba, por lo que las hojas de `fonts` y `tm-presets`
     * se persistian SIN certificar y la lectura canonica del cliente
     * (TextMuyAPI.ensureSpriteCanonico) las rechazaba siempre: las galerias de
     * tipografias y de estilos guardados mostraban el nombre del elemento en
     * cada recarga y la hoja generada se perdia.
     *
     * Alcance (contrato contracts/motor-sprite.md): un ambito CERTIFICA solo si
     *   (a) tiene catalogo (self::$CATALOGOS), y
     *   (b) el cliente mando una `firma` NO vacia.
     * `mockups` no cumple (b): assets/mockups.js no usa ThumbEngine ni la ruta
     * canonica, asi que sigue por la rama simple (persistir sin tocar el
     * catalogo). Por eso la condicion NO es `AMBITOS_GALERIA` sino la de arriba
     * (esa era la ambiguedad de T004 en el tasks.md original).
     *
     * Orden de validacion (se conserva): firma -> dimensiones -> formato/tamano
     * (los dos ultimos dentro de PMU_Galeria). Un fallo nunca deja certificada
     * una hoja vieja: la firma se borra antes de reemplazar el archivo y solo
     * se escribe al final, con exito.
     */
    public function sprite($ambito, $file, $firma = '')
    {
        $op = 'sprite';
        $this->exigir_galeria($ambito, $op);
        $dir = $this->dir_ambito($ambito, true);
        $certifica = isset(self::$CATALOGOS[$ambito]) && (string)$firma !== '';

        if ($certifica) {
            $res = $this->catalogo($ambito, $op);
            $cat = $res['cat'];
            $dims = $cat['thumbs'];
            $esperado = [(int)$dims['w'], (int)$dims['h'], (int)$dims['c'], $cat['items']];
            if ($res['aviso'] || json_decode((string)$firma, true) !== $esperado) {
                throw new Exception('motor:sprite:catalogo:desactualizado');
            }
            $max = 0;
            foreach ($cat['items'] as $t) { $max = max($max, (int)$t[0]); }
            $tam = @getimagesize($file['tmp_name']);
            if (!$tam || $dims['c'] < 1 || $tam[0] !== $dims['w'] * $dims['c']
                || $tam[1] !== (int)ceil(max(1, $max) / $dims['c']) * $dims['h']) {
                throw new Exception('motor:sprite:dimensiones:invalidas');
            }
            // Invalidar antes de reemplazar: un fallo nunca certifica una hoja vieja.
            if (!$this->guardar_catalogo($ambito, $cat)) {
                throw new Exception('motor:sprite:catalogo:no_escribible');
            }
            $this->get_galeria()->sprite($dir, $file);
            $actual = $this->catalogo($ambito, $op)['cat'];
            if ($actual['items'] !== $cat['items']) {
                throw new Exception('motor:sprite:catalogo:desactualizado');
            }
            $cat['thumbs']['sprite_firma'] = (string)$firma;
            // escribir_json (NO guardar_catalogo): esta es la escritura que
            // CERTIFICA, y guardar_catalogo borraria la firma recien validada.
            if (!$this->escribir_json($this->ruta_catalogo($ambito), $cat)) {
                throw new Exception('motor:sprite:catalogo:no_escribible');
            }
        } else {
            $this->get_galeria()->sprite($dir, $file);
        }
        return ['spriteUrl' => $this->url_de($ambito, 'thumbs.webp'), 'scope' => $ambito];
    }

    /** op=miniatura: persiste {nombre}.webp en img (miniaturas de grupos de PDF). */
    public function miniatura($nombre, $file)
    {
        $dir = $this->dir_ambito('img', true);
        $archivo = $this->get_galeria()->miniatura($dir, $nombre, $file);
        return ['url' => $this->url_de('img', $archivo), 'nombre' => $archivo];
    }


    /* ==================== Endpoint unico ==================== */

    /** Parametro con alias canonicos: scope/ambito, title/titulo, file/archivo. */
    private function param($nombres, $def = null)
    {
        foreach ((array)$nombres as $n) {
            if (isset($_POST[$n])) {
                return $_POST[$n];
            }
        }
        return $def;
    }

    /**
     * Archivo subido, leyendo `$_FILES` con los alias indicados. Un archivo de
     * FormData NUNCA viaja en `$_POST` (va en `$_FILES`): leerlo con `param()`
     * devolvia la cadena vacia y el alta del catalogo fallaba con
     * `motor:alta:falta:archivo` (bug en vivo al arrastrar una imagen al
     * lienzo). Acepta ademas un `$_POST` con la ruta de un archivo ya existente
     * (lo usa `editar`/`baja` para renombrar sin volver a subir).
     *
     * @param array $nombres alias del campo (file/archivo/imagen).
     * @return array|string Cadena vacia si no hay archivo.
     */
    private function archivo_subido($nombres)
    {
        foreach ((array)$nombres as $n) {
            if (!empty($_FILES[$n]) && is_array($_FILES[$n])
                && ($_FILES[$n]['error'] ?? 1) === UPLOAD_ERR_OK) {
                return $_FILES[$n];
            }
        }
        // Sin subida: puede venir la ruta/nombre de un archivo ya existente.
        return $this->param($nombres, '');
    }

    public function handle_request()
    {
        // Orden de rechazo: capacidad (en handle_pmu_uploads) -> nonce -> op -> ambito -> payload.
        $nonce = (string)($_POST['_wpnonce'] ?? '');
        if (!wp_verify_nonce($nonce, 'pmu_uploads')) {
            wp_send_json_error('motor:nonce:invalido');
        }
        if (!isset($_POST['op'])) {
            wp_send_json_error('motor:op:falta');
        }
        $op = (string)$_POST['op'];
        if (!in_array($op, ['listar', 'alta', 'baja', 'editar', 'sprite', 'miniatura', 'envoltura', 'mockup_pagina'], true)) {
            wp_send_json_error('motor:op:invalido:' . $op);
        }
        try {
            switch ($op) {
                case 'listar':
                    $scope = (string)$this->param(['scope', 'ambito'], '');
                    if ($scope === '') {
                        wp_send_json_error('motor:listar:falta:scope');
                    }
                    wp_send_json_success($this->listar($scope));
                    break;
                case 'alta':
                    $scope = (string)$this->param(['scope', 'ambito'], '');
                    $title = (string)$this->param(['title', 'titulo'], '');
                    $cats = $this->param(['cats', 'categorias'], '');
                    $file = $this->archivo_subido(['file', 'archivo', 'imagen']);
                    $contenido = (string)$this->param(['contenido'], '');
                    if ($scope === '' || $title === '') {
                        wp_send_json_error('motor:alta:falta:scope|title');
                    }
                    wp_send_json_success($this->alta($scope, $title, $cats, $file, $contenido));
                    break;
                case 'baja':
                    $scope = (string)$this->param(['scope', 'ambito'], '');
                    $id = (int)$this->param(['id'], 0);
                    $file = (string)$this->param(['file', 'archivo'], '');
                    if ($scope === '' || ($id < 1 && $file === '')) {
                        wp_send_json_error('motor:baja:falta:scope|id|file');
                    }
                    wp_send_json_success($this->baja($scope, $id, $file));
                    break;
                case 'editar':
                    $scope = (string)$this->param(['scope', 'ambito'], '');
                    $id = (int)$this->param(['id'], 0);
                    if ($scope === '' || $id < 1) {
                        wp_send_json_error('motor:editar:falta:scope|id');
                    }
                    $nuevo = [];
                    $title = $this->param(['title', 'titulo']);
                    if ($title !== null) {
                        $nuevo['title'] = (string)$title;
                    }
                    $cats = $this->param(['cats', 'categorias']);
                    if ($cats !== null) {
                        $nuevo['cats'] = $cats;
                    }
                    $file = $this->param(['file', 'archivo']);
                    if ($file !== null) {
                        $nuevo['file'] = (string)$file;
                    }
                    wp_send_json_success($this->editar($scope, $id, $nuevo));
                    break;
                case 'sprite':
                    $scope = (string)$this->param(['scope', 'ambito'], '');
                    if ($scope === '') {
                        wp_send_json_error('motor:sprite:falta:scope');
                    }
                    $subida = $this->archivo_subido(['archivo', 'file']);
                    if (!is_array($subida)) {
                        wp_send_json_error('motor:sprite:falta:archivo');
                    }
                    wp_send_json_success($this->sprite($scope, $subida, wp_unslash((string)$this->param(['firma'], ''))));
                    break;
                case 'miniatura':
                    $nombre = (string)$this->param(['nombre'], '');
                    $subida = $this->archivo_subido(['archivo', 'file']);
                    if (!is_array($subida)) {
                        wp_send_json_error('motor:miniatura:falta:archivo');
                    }
                    wp_send_json_success($this->miniatura($nombre, $subida));
                    break;
                case 'envoltura':
                    // Lectura ON-DEMAND de la geometria de UNA envoltura
                    // (PowerClip) para el editor de mockups. Solo lectura.
                    $pdf = (string)$this->param(['pdf', 'nombre'], '');
                    $gid = strtoupper(trim((string)$this->param(['gid', 'grupo'], '')));
                    $n = (int)$this->param(['n'], 0);
                    if ($pdf === '' || preg_match('/^[0-9A-F]{6}$/', $gid) !== 1 || $n < 1) {
                        wp_send_json_error('motor:envoltura:falta:pdf|gid|n');
                    }
                    wp_send_json_success($this->envoltura_datos($pdf, $gid, $n));
                    break;
                case 'mockup_pagina':
                    $pdf = (string)$this->param(['pdf', 'nombre'], '');
                    $pagina = (int)$this->param(['pagina'], 0);
                    wp_send_json_success($this->geometria_mockup_pagina($pdf, $pagina));
                    break;
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}
