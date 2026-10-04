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
    private static $AMBITOS = ['fonts', 'img', 'mockups', 'pdfs', 'orders', 'tmp', 'tm-presets'];
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
     * Carpeta del codigo de los campos: uploads/pmu/campos/ (spec 012, T002).
     * OJO: el INDICE (campos.json) sigue en la RAIZ de uploads/pmu/; aqui
     * viven las carpetas {id}/ de cada campo y los dos globales.
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
     * Indice del catalogo global de campos: uploads/pmu/campos.json
     * (spec 004, sin thumbs; formato v2 en la spec 012, T002).
     */
    public function ruta_campos()
    {
        return $this->dir_pmu() . DIRECTORY_SEPARATOR . 'campos.json';
    }

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

    /** Lee el catalogo global de campos (uploads/pmu/campos.json, sin thumbs). */
    public function campos_catalogo($op = 'campos')
    {
        $ruta = $this->ruta_campos();
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

    /* ============ Campos v2 (spec 012, T004): datos, cargador y archivos ============ */

    /**
     * Valida y normaliza el `cargador` de un campo (ranuras del cargador de
     * imagenes). Acepta la forma estructurada (array de ranuras) y tambien el
     * atajo de texto que ideo el admin: `size:2000 max:6`,
     * `canvas:circle size:1000`, `1_size:1000 1_canvas:circle 2_size:1024x768 2_min:2 2_max:2`.
     * Devuelve null si el campo no tiene cargador; o el array de ranuras
     * normalizado. Lanza motor:campos:cargador:invalido si algo no cuadra.
     */
    public function validar_cargador($cargador)
    {
        if ($cargador === null || $cargador === '' || $cargador === []) {
            return null;
        }
        // Atajo de texto -> estructura.
        if (!is_array($cargador)) {
            $cargador = $this->cargador_desde_texto((string)$cargador);
        }
        if (isset($cargador['ranuras']) && is_array($cargador['ranuras'])) {
            $cargador = $cargador['ranuras'];
        }
        if (!is_array($cargador) || !$cargador) {
            throw new Exception('motor:campos:cargador:invalido');
        }
        $formas = ['circle', 'square', 'rect', 'fit'];
        $ranuras = [];
        foreach ($cargador as $n => $r) {
            if (!is_array($r)) {
                throw new Exception('motor:campos:cargador:invalido');
            }
            $w = isset($r['w']) ? (int)$r['w'] : 0;
            $h = isset($r['h']) ? (int)$r['h'] : 0;
            $forma = isset($r['forma']) ? (string)$r['forma'] : 'rect';
            $min = isset($r['min']) ? (int)$r['min'] : 1;
            $max = isset($r['max']) ? (int)$r['max'] : 1;
            if ($w < 1 || $h < 1 || !in_array($forma, $formas, true)) {
                throw new Exception('motor:campos:cargador:invalido');
            }
            if ($min < 1) {
                $min = 1;
            }
            if ($max < $min) {
                $max = $min;
            }
            $ranuras[] = [
                'etiqueta' => isset($r['etiqueta']) ? substr(strip_tags((string)$r['etiqueta']), 0, 100) : ('Foto ' . ((int)$n + 1)),
                'w' => $w,
                'h' => $h,
                'forma' => $forma,
                'min' => $min,
                'max' => $max,
            ];
        }
        return $ranuras;
    }

    /**
     * Parsea el atajo de texto del cargador a la estructura de ranuras
     * (spec 012, data-model.md §3). Sintaxis:
     *   size:2000 max:6                                -> 1 ranura 2000x2000, max 6
     *   canvas:circle size:1000                        -> 1 ranura circular 1000x1000
     *   1_size:1000 1_canvas:circle 2_size:1024x768 2_min:2 2_max:2 -> 2 ranuras
     * `W:H` (o `size:WxH`) define el alto; por defecto `size:N` es cuadrado.
     */
    private function cargador_desde_texto($texto)
    {
        $texto = strtolower(trim((string)$texto));
        if ($texto === '') {
            return null;
        }
        $formas = ['circle', 'square', 'rect', 'fit'];
        $mapa = ['canvas' => 'forma', 'forma' => 'forma', 'size' => 'size',
            'w' => 'w', 'h' => 'h', 'min' => 'min', 'max' => 'max'];
        $out = [];
        if (!preg_match_all('/(\d*)_?(canvas|forma|size|w|h|min|max)\s*[:=]\s*([a-z0-9x]+)/', $texto, $m, PREG_SET_ORDER)) {
            throw new Exception('motor:campos:cargador:invalido');
        }
        foreach ($m as $tok) {
            $idx = $tok[1] === '' ? 1 : (int)$tok[1];
            $clave = $mapa[$tok[2]];
            $valor = $tok[3];
            if (!isset($out[$idx])) {
                $out[$idx] = ['forma' => 'rect', 'min' => 1, 'max' => 1];
            }
            if ($clave === 'forma') {
                if (!in_array($valor, $formas, true)) {
                    throw new Exception('motor:campos:cargador:invalido');
                }
                $out[$idx]['forma'] = $valor;
            } elseif ($clave === 'size') {
                if (strpos($valor, 'x') !== false) {
                    list($w, $h) = array_pad(explode('x', $valor, 2), 2, $valor);
                    $out[$idx]['w'] = (int)$w;
                    $out[$idx]['h'] = (int)$h;
                } else {
                    $out[$idx]['w'] = (int)$valor;
                    $out[$idx]['h'] = (int)$valor;
                }
            } else {
                $out[$idx][$clave] = (int)$valor;
            }
        }
        ksort($out);
        $ranuras = [];
        foreach ($out as $r) {
            if (!isset($r['w']) || !isset($r['h'])) {
                throw new Exception('motor:campos:cargador:invalido');
            }
            $ranuras[] = $r;
        }
        return $ranuras;
    }

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
            if (strlen((string)$contenido) > 20000) {
                throw new Exception('motor:campos:' . $archivo . ':tamano');
            }
        }
        if (is_array($datos) && !empty($datos['cargador'])) {
            $datos['cargador'] = ['ranuras' => $this->validar_cargador($datos['cargador'])];
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
     * Migracion one-shot del catalogo de campos v1 -> v2 (spec 012, D10/T001).
     *
     * La v1 guarda tuplas de 10 slots en campos.json:
     *   [id, titulo, tipo, etiquetas[], ayuda, visible, contenido, css, script, array]
     * La v2 deja campos.json como indice (items + meta) y el codigo en
     * uploads/pmu/campos/{id}/.
     *
     * MAPEO (el admin debe revisarlo tras migrar):
     *   titulo     -> nombre AND titulo_cliente (se conserva en los dos para que
     *                 ni la tabla del admin ni el carrito queden vacios)
     *   tipo       -> se descarta (ya no existe; el tipo vive en el placeholder)
     *   etiquetas  -> meta.{id}.categorias
     *   ayuda      -> datos.json.texto_ayuda
     *   visible    -> se pierde (ya no se inyecta titulo; el HTML lo trae el admin)
     *   contenido  -> campo.htm ; css -> campo.css ; script -> campo.js
     *   array      -> datos.json.array
     *   [id,"",""] -> items[id].baja = true (tombstone; NO se crea carpeta y el
     *                 id queda ocupado para siempre: nunca se reutiliza)
     *
     * `creado` no es recuperable (v1 no lo guardaba): se pone la fecha de la
     * migracion. `modificado` es time() y es el `?v=` del campo.
     *
     * IDEMPOTENTE (si version==2 no hace nada) y REVERSIBLE a mano: guarda
     * campos.json.bak antes de escribir y, si algo falla, lo restaura (las
     * carpetas {id}/ que hubieran quedado son inertes: el indice manda).
     *
     * @return array ['hecho'=>bool,'campos'=>int,'bajas'=>int,'motivo'=>string]
     */
    public function migrar_campos_v2()
    {
        $ruta = $this->ruta_campos();
        if (!is_file($ruta)) {
            return ['hecho' => true, 'campos' => 0, 'bajas' => 0, 'motivo' => 'sin catalogo'];
        }
        $crudo = (string)@file_get_contents($ruta);
        $datos = $crudo === '' ? null : json_decode($crudo, true);
        if (!is_array($datos) || !isset($datos['items']) || !is_array($datos['items'])) {
            return ['hecho' => false, 'campos' => 0, 'bajas' => 0, 'motivo' => 'catalogo ilegible'];
        }
        if (isset($datos['version']) && (int)$datos['version'] >= 2) {
            return ['hecho' => true, 'campos' => 0, 'bajas' => 0, 'motivo' => 'ya migrado'];
        }

        // 1) Backup antes de escribir cualquier cosa.
        if (!$this->escribir_texto($ruta . '.bak', $crudo)) {
            return ['hecho' => false, 'campos' => 0, 'bajas' => 0, 'motivo' => 'backup fallido'];
        }

        $items = [];
        $meta = [];
        $nCampos = 0;
        $nBajas = 0;
        $ahora = time();
        try {
            foreach ($datos['items'] as $t) {
                if (!is_array($t) || !isset($t[0]) || (int)$t[0] < 1) {
                    continue;
                }
                $id = (int)$t[0];
                $titulo = isset($t[1]) ? (string)$t[1] : '';
                $tipo = isset($t[2]) ? (string)$t[2] : '';

                // Tombstone v1: [id, "", ""]. Se marca dado de baja, NO se crea
                // carpeta y el id queda ocupado para siempre (nunca se reutiliza).
                if (trim($titulo) === '' || trim($tipo) === '') {
                    $items[] = ['id' => $id, 'plantilla' => '', 'baja' => true];
                    $meta[(string)$id] = $this->meta_campo_migrado($ahora, []);
                    $nBajas++;
                    continue;
                }

                $etiquetas = [];
                if (isset($t[3]) && is_array($t[3])) {
                    foreach ($t[3] as $e) {
                        $e = strtolower(trim(preg_replace('/[^a-z0-9_\-]+/i', '-', (string)$e), '-'));
                        if ($e !== '') {
                            $etiquetas[] = substr($e, 0, 32);
                        }
                    }
                }
                $tituloLimpio = substr(strip_tags($titulo), 0, 200);
                $this->escribir_campo(
                    $id,
                    [
                        'nombre' => $tituloLimpio,
                        'descripcion' => '',
                        'titulo_cliente' => $tituloLimpio,
                        'texto_ayuda' => substr(strip_tags(isset($t[4]) ? (string)$t[4] : ''), 0, 500),
                        'array' => isset($t[9]) && !empty($t[9]),
                        'protegido' => false,
                        'cargador' => null,
                    ],
                    isset($t[6]) ? (string)$t[6] : '',
                    isset($t[7]) ? (string)$t[7] : '',
                    isset($t[8]) ? (string)$t[8] : ''
                );
                $items[] = ['id' => $id, 'plantilla' => '', 'baja' => false];
                $meta[(string)$id] = $this->meta_campo_migrado($ahora, $etiquetas);
                $nCampos++;
            }
        } catch (\Throwable $e) {
            $this->escribir_texto($ruta, $crudo); // reversion: vuelve a la v1
            return ['hecho' => false, 'campos' => 0, 'bajas' => 0,
                'motivo' => 'migracion:fallo:' . $e->getMessage()];
        }

        $indice = ['version' => 2, 'items' => $items, 'meta' => $meta, 'v1_migrado' => $ahora];
        if (!$this->escribir_json($ruta, $indice)) {
            $this->escribir_texto($ruta, $crudo); // reversion
            return ['hecho' => false, 'campos' => 0, 'bajas' => 0, 'motivo' => 'indice no escribible'];
        }
        return ['hecho' => true, 'campos' => $nCampos, 'bajas' => $nBajas, 'motivo' => ''];
    }

    /** Bloque meta de un campo migrado (creado/modificado/categorias). */
    private function meta_campo_migrado($ahora, array $categorias)
    {
        return [
            'creado' => gmdate('Y-m-d\TH:i:s\Z', $ahora),
            'modificado' => (int)$ahora,
            'categorias' => array_values(array_unique($categorias)),
        ];
    }

    /* ============ CRUD de campos v2 (spec 012, T003) ============ */

    /**
     * Indice v2 completo: {version, items, meta}. Tolera la ausencia del
     * archivo (devuelve vacio) y normaliza a la forma v2 para poder listar.
     */
    public function indice_campos()
    {
        $ruta = $this->ruta_campos();
        $vacio = ['version' => 2, 'items' => [], 'meta' => []];
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
        return $vacio; // v1 sin migrar: lo convierte la migracion one-shot
    }

    /** Guarda el indice v2 (atomico). Devuelve true/false. */
    public function guardar_indice_campos(array $indice)
    {
        return $this->escribir_json($this->ruta_campos(), [
            'version' => 2,
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

    /** Actualiza meta.{id} (creado una vez; modificado = time(), el `?v=`). */
    private function tocar_meta(array $indice, $id, ?array $categorias = null)
    {
        $k = (string)$id;
        $indice['meta'][$k] = [
            'creado' => isset($indice['meta'][$k]['creado'])
                ? $indice['meta'][$k]['creado']
                : gmdate('Y-m-d\TH:i:s\Z'),
            'modificado' => time(),
            'categorias' => $categorias !== null
                ? array_values(array_unique($categorias))
                : (isset($indice['meta'][$k]['categorias']) ? $indice['meta'][$k]['categorias'] : []),
        ];
        return $indice;
    }

    /** Plantilla valida: imagen|select|texto|'' (cualquier otra -> ''). */
    private function plantilla_valida($plantilla)
    {
        $p = strtolower(trim((string)$plantilla));
        return in_array($p, ['imagen', 'select', 'texto'], true) ? $p : '';
    }

    /** Categorias saneadas (minusculas, `-`, max 32) desde datos.json. */
    private function categorias_de(array $datos)
    {
        $crudas = isset($datos['categorias'])
            ? (is_array($datos['categorias']) ? $datos['categorias'] : explode(',', (string)$datos['categorias']))
            : [];
        $out = [];
        foreach ($crudas as $c) {
            $c = strtolower(trim(preg_replace('/[^a-z0-9_\-]+/i', '-', (string)$c), '-'));
            if ($c !== '') {
                $out[] = substr($c, 0, 32);
            }
        }
        return array_values(array_unique($out));
    }

    /** Normaliza y acota los slots de `datos.json`. */
    private function normalizar_datos_campo(array $datos, $plantilla = '')
    {
        $corta = function ($v, $n) {
            $v = trim(strip_tags((string)$v));
            return function_exists('mb_substr') ? mb_substr($v, 0, $n, 'UTF-8') : substr($v, 0, $n);
        };
        return [
            'nombre' => $corta(isset($datos['nombre']) ? $datos['nombre'] : '', 200),
            'descripcion' => $corta(isset($datos['descripcion']) ? $datos['descripcion'] : '', 500),
            'titulo_cliente' => $corta(isset($datos['titulo_cliente']) ? $datos['titulo_cliente'] : '', 200),
            'texto_ayuda' => $corta(isset($datos['texto_ayuda']) ? $datos['texto_ayuda'] : '', 500),
            'array' => !empty($datos['array']),
            'protegido' => !empty($datos['protegido']),
            'plantilla' => $this->plantilla_valida($plantilla),
            'categorias' => $this->categorias_de($datos),
            'cargador' => !empty($datos['cargador']) ? $datos['cargador'] : null,
        ];
    }

    /**
     * Alta de campo v2. `$datos` son los slots de `datos.json` (opcionales):
     * nombre, descripcion, titulo_cliente, texto_ayuda, array, protegido,
     * categorias, cargador. `$plantilla` marca el origen (imagen|select|texto|'').
     * El **id es el hueco mas bajo libre** y los ids dados de baja NUNCA se
     * reutilizan (quedan en el indice con baja:true). Devuelve el id.
     */
    public function campo_alta($plantilla = '', array $datos = [], $htm = '', $css = '', $js = '')
    {
        // Puente v1 (spec 012, T005): los llamadores legacy pasan la tupla de 10
        // slots como primer argumento. Se traduce aqui y se retira con el arnés
        // en F1/F2. Firma v2 = ($plantilla, $datos, $htm, $css, $js).
        if (is_array($plantilla)) {
            $t = $plantilla;
            $plantilla = '';
            $datos = [
                'nombre' => isset($t[1]) ? (string)$t[1] : '',
                'titulo_cliente' => isset($t[1]) ? (string)$t[1] : '',
                'texto_ayuda' => isset($t[4]) ? (string)$t[4] : '',
                'categorias' => isset($t[3]) ? (array)$t[3] : [],
                'array' => !empty($t[9]),
            ];
            $htm = isset($t[6]) ? (string)$t[6] : '';
            $css = isset($t[7]) ? (string)$t[7] : '';
            $js = isset($t[8]) ? (string)$t[8] : '';
        }
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
        $datos = $this->normalizar_datos_campo($datos, $plantilla);
        $indice['items'][] = ['id' => $id, 'plantilla' => $datos['plantilla'], 'baja' => false];
        $indice = $this->tocar_meta($indice, $id, $datos['categorias']);
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
            $indice['items'][] = ['id' => $id, 'plantilla' => '', 'baja' => true];
            $indice = $this->tocar_meta($indice, $id, []);
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
    public function campo_editar($id, array $datos, $htm = '', $css = '', $js = '')
    {
        // Puente v1 (spec 012, T005): la tupla de 10 slots como 2do argumento.
        if (isset($datos[1]) && !isset($datos['nombre']) && count($datos) > 3) {
            $t = $datos;
            $datos = [
                'nombre' => isset($t[1]) ? (string)$t[1] : '',
                'titulo_cliente' => isset($t[1]) ? (string)$t[1] : '',
                'texto_ayuda' => isset($t[4]) ? (string)$t[4] : '',
                'categorias' => isset($t[3]) ? (array)$t[3] : [],
                'array' => !empty($t[9]),
            ];
            $htm = isset($t[6]) ? (string)$t[6] : '';
            $css = isset($t[7]) ? (string)$t[7] : '';
            $js = isset($t[8]) ? (string)$t[8] : '';
        }
        $id = $this->campo_id_seguro($id, 'editar');
        $indice = $this->indice_campos();
        $fila = $this->fila_indice($indice, $id);
        if ($fila === null) {
            throw new Exception('motor:editar:campo:inexistente:' . $id);
        }
        $datos = $this->normalizar_datos_campo($datos, isset($fila['plantilla']) ? $fila['plantilla'] : '');
        $indice = $this->tocar_meta($indice, $id, $datos['categorias']);
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
            isset($datos['plantilla']) ? $datos['plantilla'] : '',
            $datos,
            $origen['htm'],
            $origen['css'],
            $origen['js']
        );
    }

    /** Marca (o desmarca con '') un campo como plantilla reutilizable. */
    public function campo_plantilla($id, $plantilla)
    {
        $id = $this->campo_id_seguro($id, 'plantilla');
        $indice = $this->indice_campos();
        $hubo = false;
        foreach ($indice['items'] as &$f) {
            if (isset($f['id']) && (int) $f['id'] === $id) {
                $f['plantilla'] = $this->plantilla_valida($plantilla);
                $hubo = true;
            }
        }
        unset($f);
        if (!$hubo) {
            throw new Exception('motor:plantilla:campo:inexistente:' . $id);
        }
        if (!$this->guardar_indice_campos($indice)) {
            throw new Exception('motor:plantilla:directorio:no_escribible');
        }
        return true;
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
                'plantilla' => isset($f['plantilla']) ? $f['plantilla'] : '',
                'baja' => $baja,
                'datos' => $datos,
                'htm' => $campo !== null ? $campo['htm'] : '',
                'css' => $campo !== null ? $campo['css'] : '',
                'js' => $campo !== null ? $campo['js'] : '',
                'categorias' => isset($meta['categorias']) ? $meta['categorias'] : [],
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

    /**
     * Normaliza la seccion mockups de un config (composicion de capas 300x300).
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
                $capas[] = [
                    'tipo' => $tipo,
                    'ref' => $ref,
                    'x' => (int)($c['x'] ?? 0),
                    'y' => (int)($c['y'] ?? 0),
                    'w' => max(1, (int)($c['w'] ?? 0)),
                    'h' => max(1, (int)($c['h'] ?? 0)),
                    'rot' => $this->clamp_float((float)($c['rot'] ?? 0), -360, 360),
                    'sesgo' => $this->clamp_float((float)($c['sesgo'] ?? 0), -1, 1),
                    'filtros' => $this->mockup_filtros($c['filtros'] ?? []),
                    'modo' => $this->mockup_modo($c['modo'] ?? 'normal'),
                    'nombre' => substr(trim((string)($c['nombre'] ?? '')), 0, 60),
                    'oculta' => !empty($c['oculta']),
                    'bloqueada' => !empty($c['bloqueada']),
                ];
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
            return isset($mm[2]) && $mm[2] !== '' ? $mm[1] . '#' . $mm[2] : $mm[1];
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
        $base = ['activo' => false, 'productos' => [], 'campos_ids' => [], 'preview_omisible' => false, 'mockups' => [], 'placeholders' => [], 'tienda' => []];
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
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}

