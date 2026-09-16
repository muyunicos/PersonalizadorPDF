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
    private static $AMBITOS = ['fonts', 'img', 'pdfs', 'orders', 'tmp', 'tm-presets'];
    private static $AMBITOS_GALERIA = ['fonts', 'img', 'tm-presets'];

    /** Nombre explicito del catalogo por ambito: NUNCA derivado del directorio. */
    private static $CATALOGOS = [
        'fonts' => 'fonts.json',
        'img' => 'img.json',
        'tm-presets' => 'presets.json',
    ];

    /** Subambitos de trabajo bajo tmp/ (contrato rutas-pmu.md v2, spec 007;
     *  plan 008: se suma 'sesion' para tmp/sesion-{sid}/). */
    private static $SUBAMBITOS_TMP = ['muestras', 'cart', 'orders', 'sesion'];

    /** Grilla del sprite por ambito (defaults; el catalogo vigente manda). */
    private static $THUMBS = [
        'fonts' => ['w' => 180, 'h' => 30, 'c' => 4],
        'img' => ['w' => 100, 'h' => 100, 'c' => 8],
        'tm-presets' => ['w' => 200, 'h' => 100, 'c' => 4],
    ];

    private $galeria;

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
        if (!is_dir($dir)) {
            // Crear el arbol completo, no solo el ultimo nivel.
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


    /** Analisis inmutable del Detector: uploads/pmu/pdfs/{nombre}/analisis.json (plan 008). */
    public function ruta_analisis($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_analisis');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . 'analisis.json';
    }

    /** Config editable del admin: uploads/pmu/pdfs/{nombre}/config.json (plan 008). */
    public function ruta_config($nombre)
    {
        $nombre = $this->nombre_seguro($nombre, 'ruta_config');
        return $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $nombre
            . DIRECTORY_SEPARATOR . 'config.json';
    }

    /** Asegura un subdirectorio bajo tmp/ (muestras|cart|orders). */
    private function dir_tmp_sub($sub, $crear = false)
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
        $dir = $this->dir_tmp_sub('sesion', $crear) . DIRECTORY_SEPARATOR . 'sesion-' . $sid;
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
        return $this->dir_tmp_sub('sesion') . DIRECTORY_SEPARATOR . 'sesion-' . $sid
            . DIRECTORY_SEPARATOR . $item . DIRECTORY_SEPARATOR . 'manifest.json';
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
            if (!is_dir(dirname($ruta))) {
                wp_mkdir_p(dirname($ruta));
            }
            if (!$this->guardar_catalogo($ambito, $cat)) {
                throw new Exception('motor:' . $op . ':directorio:no_escribible');
            }
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
     */
    public function guardar_catalogo($ambito, $cat)
    {
        $ruta = $this->ruta_catalogo($ambito);
        if ($ambito === 'img') {
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

    /** Lee el catalogo global de campos (uploads/pmu/campos.json). */
    public function campos_catalogo($op = 'campos')
    {
        $ruta = $this->dir_pmu() . DIRECTORY_SEPARATOR . 'campos.json';
        if (!is_file($ruta)) {
            return ['cat' => ['items' => []], 'aviso' => null];
        }
        $crudo = (string)@file_get_contents($ruta);
        $datos = $crudo === '' ? null : json_decode($crudo, true);
        if (!is_array($datos) || !isset($datos['items']) || !is_array($datos['items'])) {
            return ['cat' => ['items' => []], 'aviso' => 'motor:listar:catalogo:invalido:campos'];
        }
        $items = [];
        foreach ($datos['items'] as $t) {
            if (is_array($t) && isset($t[0]) && (int)$t[0] >= 1) {
                $items[] = $t;
            }
        }
        return ['cat' => ['items' => $items], 'aviso' => null];
    }

    /** Guarda el catalogo global de campos (atomico). Devuelve true/false. */
    public function guardar_campos($items)
    {
        return $this->escribir_json(
            $this->dir_pmu(true) . DIRECTORY_SEPARATOR . 'campos.json',
            ['items' => array_values($items)]
        );
    }

    /** Alta de campo: id = hueco mas bajo o max+1. Devuelve el id. */
    public function campo_alta(array $tupla)
    {
        $res = $this->campos_catalogo('alta');
        $items = $res['cat']['items'];
        $usados = [];
        foreach ($items as $t) {
            $usados[(int)$t[0]] = true;
        }
        $id = 1;
        while (isset($usados[$id])) {
            $id++;
        }
        $tupla[0] = $id;
        $items[] = array_values($tupla);
        if (!$this->guardar_campos($items)) {
            throw new Exception('motor:alta:directorio:no_escribible');
        }
        return $id;
    }

    /** Baja de campo: tombstone [id, "", ""]. */
    public function campo_baja($id)
    {
        $id = (int)$id;
        if ($id < 1) {
            throw new Exception('motor:baja:campo:invalido');
        }
        $res = $this->campos_catalogo('baja');
        $items = $res['cat']['items'];
        $hubo = false;
        foreach ($items as &$t) {
            if ((int)$t[0] === $id) {
                $t = [$id, '', ''];
                $hubo = true;
            }
        }
        unset($t);
        if (!$hubo) {
            $items[] = [$id, '', ''];
        }
        if (!$this->guardar_campos($items)) {
            throw new Exception('motor:baja:directorio:no_escribible');
        }
        return true;
    }

    /** Edicion de campo por id. Lanza si el id no existe. */
    public function campo_editar($id, array $tupla)
    {
        $id = (int)$id;
        if ($id < 1) {
            throw new Exception('motor:editar:campo:invalido');
        }
        $res = $this->campos_catalogo('editar');
        $items = $res['cat']['items'];
        $hubo = false;
        foreach ($items as &$t) {
            if ((int)$t[0] === $id) {
                $tupla[0] = $id;
                $t = array_values($tupla);
                $hubo = true;
            }
        }
        unset($t);
        if (!$hubo) {
            throw new Exception('motor:editar:campo:inexistente:' . $id);
        }
        if (!$this->guardar_campos($items)) {
            throw new Exception('motor:editar:directorio:no_escribible');
        }
        return true;
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

    /** Normaliza el mapeo placeholders (id hex => tipo/preset/value/settings). */
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
            ];
        }
        return $ph;
    }

    /** Lee el config.json editable de un PDF (o defaults si no existe). */
    public function leer_config($pdf)
    {
        $pdf = $this->nombre_seguro($pdf, 'leer_config');
        $ruta = $this->dir_ambito('pdfs') . DIRECTORY_SEPARATOR . $pdf
            . DIRECTORY_SEPARATOR . 'config.json';
        $base = ['activo' => false, 'productos' => [], 'campos_ids' => [], 'placeholders' => []];
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
        if (isset($datos['placeholders'])) {
            $base['placeholders'] = $this->config_placeholders($datos['placeholders']);
        }
        return $base;
    }

    /**
     * Guarda el config.json editable de un PDF de forma atomica.
     * Nunca toca el dataset: solo activo, productos, campos y mapeos.
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
        if (isset($config['placeholders'])) {
            $canon['placeholders'] = $this->config_placeholders($config['placeholders']);
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

    /**
     * Sanea un nombre de archivo de recurso del editor (fuentes/imagenes).
     * Minusculas [a-z0-9_-], max 64. Devuelve '' si no queda nada.
     */
    private function nombre_recurso_seguro($nombre)
    {
        $limpio = strtolower((string)$nombre);
        $limpio = preg_replace('/[^a-z0-9_-]+/', '-', $limpio);
        $limpio = preg_replace('/^-+|-+$/', '', (string)$limpio);
        return substr($limpio, 0, 64);
    }

    /** Verifica la firma (magic bytes) de una imagen segun su extension. */
    private function firma_imagen_valida($ruta, $ext)
    {
        $firma = (string)@file_get_contents($ruta, false, null, 0, 12);
        if ($ext === 'png') {
            return $firma === "\x89PNG\r\n\x1a\n";
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
        if (!@move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
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

    /** Listado agregado para el puente (presets, imagenes, fuentes). */
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
                || (isset($datos['version']) ? (int)$datos['version'] : 0) !== 1) {
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
            $exts = ($ambito === 'img') ? ['png', 'jpg', 'jpeg', 'webp', 'svg'] : ['ttf', 'otf', 'woff', 'woff2'];
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

    /** op=sprite: persiste thumbs.webp del ambito (delega fisica a PMU_Galeria). */
    public function sprite($ambito, $file, $firma = '')
    {
        $op = 'sprite';
        $this->exigir_galeria($ambito, $op);
        $dir = $this->dir_ambito($ambito, true);
        if ($ambito === 'img') {
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
        if (!in_array($op, ['listar', 'alta', 'baja', 'editar', 'sprite', 'miniatura'], true)) {
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
                    $file = $this->param(['file', 'archivo'], '');
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
                    if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? 1) !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:sprite:falta:archivo');
                    }
                    wp_send_json_success($this->sprite($scope, $_FILES['archivo'], wp_unslash((string)$this->param(['firma'], ''))));
                    break;
                case 'miniatura':
                    $nombre = (string)$this->param(['nombre'], '');
                    if (empty($_FILES['archivo']) || ($_FILES['archivo']['error'] ?? 1) !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:miniatura:falta:archivo');
                    }
                    wp_send_json_success($this->miniatura($nombre, $_FILES['archivo']));
                    break;
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}

