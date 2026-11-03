<?php
/**
 * PMU_Cotizador - fachada del cotizador de stickers (spec 037).
 *
 * El cotizador (repo hermano `calculadora`) es un CONSUMIDOR DECLARADO del
 * plugin: monta su paso de diseno en `[data-pmu-panel]`, sube el ORIGINAL del
 * comprador y pide un mockup 300x300. Esta clase es la superficie UNICA que
 * conoce y **delega** en `PMU_Sesion` (datos y manifest) y `PMU_Uploads`
 * (rutas): siguen siendo los duenos por dato (constitution §II).
 *
 * Que NO hace (y es a proposito):
 *  - no compone bitmaps: el cliente compone la VISTA PREVIA con el nucleo
 *    compartido (`assets/mockup-render.js`) y el servidor compone el arte que se
 *    imprime con `engine/Compositor.php` (original + receta, §III);
 *  - no toca el Motor: el cotizador no tiene PDF (`manifest.pdfs = []` y
 *    `preview_estado = 'omisible'`), y `promover_linea()` no entrega PDFs ni
 *    congela bonus;
 *  - no acepta rutas del cliente: `idea_id`, `ref` e `item_key` se validan por
 *    regex y el archivo se resuelve con `is_file()`.
 *
 * Contratos: `specs/037-cotizador-diseno-mockups/contracts/`. Se apaga sin
 * deploy con el filtro `pmu_cotizador_activo`.
 */

if (!defined('ABSPATH')) {
    exit;
}

class PMU_Cotizador
{
    /** Nonce de los endpoints del comprador (el mismo de la vista previa). */
    const NONCE = 'personalizador_pdf_vista_previa';

    /** Contexto que viaja en `manifest.contexto` (NO en `subidas[].origen`). */
    const CONTEXTO = 'cotizador';

    /** Idea (custom): `idea-{epoch}-{4 alfanum}`. */
    const RE_IDEA = '/^idea-\d{10}-[a-z0-9]{4}$/';

    /** Id de 12 hex de una subida (regla de la 035). */
    const RE_ID12 = '/^[a-f0-9]{12}$/';

    /** Item del cotizador (`crear_draft(..., 'cotizador')`). */
    const RE_ITEM = '/^cot-[a-z0-9]{8}$/';

    /** Sid de sesion (misma regla que `PMU_Uploads::sesion_segura`). */
    const RE_SID = '/^[a-z0-9_-]{6,64}$/';

    /** Topes operativos: ideas por identidad y tarjetas por respuesta. */
    const TOPE_IDEAS = 60;
    const TOPE_LISTA = 30;

    /** Version del `idea.json` (permite evolucionar sin migrar). */
    const IDEA_VERSION = 1;

    /** Filtro de apagado sin deploy. */
    const FILTRO_ACTIVO = 'pmu_cotizador_activo';

    /** @var PMU_Uploads|null */
    private $motor = null;

    /** @var PMU_Sesion|null */
    private $sesion = null;

    public function __construct(?PMU_Uploads $motor = null, ?PMU_Sesion $sesion = null)
    {
        $this->motor = $motor;
        $this->sesion = $sesion;
    }

    /** Dependencia perezosa: `class-pmu-sesion.php` no se carga en toda peticion. */
    private function motor()
    {
        if ($this->motor === null) {
            if (!class_exists('PMU_Uploads')) {
                require_once dirname(__FILE__) . '/class-pmu-galeria.php';
                require_once dirname(__FILE__) . '/class-pmu-uploads.php';
            }
            $this->motor = new PMU_Uploads();
        }
        return $this->motor;
    }

    /** Sesion del comprador sobre el motor unico (mismo objeto que el resto del plugin). */
    private function sesion()
    {
        if ($this->sesion === null) {
            if (!class_exists('PMU_Sesion')) {
                require_once dirname(__FILE__) . '/class-pmu-sesion.php';
            }
            $this->sesion = new PMU_Sesion($this->motor());
        }
        return $this->sesion;
    }

    /* ==================== Contexto ==================== */

    /** La fachada esta encendida (y por lo tanto escribe disco). */
    public function activo()
    {
        $activo = true;
        if (function_exists('apply_filters')) {
            $activo = apply_filters(self::FILTRO_ACTIVO, true);
        }
        return (bool)$activo;
    }

    /**
     * Lo que el consumidor necesita para montar el paso de diseno (contrato C1).
     * `contexto` es INFORMATIVO: no otorga permisos ni cambia validaciones (§III).
     */
    public function contexto()
    {
        $activo = $this->activo();
        return [
            'activo' => $activo,
            'contexto' => self::CONTEXTO,
            'postUrl' => function_exists('admin_url') ? admin_url('admin-post.php') : '',
            'ajaxUrl' => function_exists('admin_url') ? admin_url('admin-ajax.php') : '',
            'nonce' => function_exists('wp_create_nonce') ? wp_create_nonce(self::NONCE) : '',
            'prefijoItem' => 'cot-',
            'topeIdeas' => self::TOPE_IDEAS,
        ];
    }

    /**
     * Encola SOLO los modulos del paso de diseno (D10/R9): `mockup-render`,
     * `selector`, `visor`, `biblioteca`, `cargador` y `fotos`. **Nunca**
     * `tienda.js` (107 KB) ni `campo-montar.js`: no hay campos que montar.
     */
    public function assets()
    {
        $version = defined('PERSONALIZADOR_PDF_VERSION') ? PERSONALIZADOR_PDF_VERSION : '0';
        $url = defined('PERSONALIZADOR_PDF_URL') ? PERSONALIZADOR_PDF_URL : '';
        $modulos = [
            'personalizador-pdf-mockup-render' => ['archivo' => 'assets/mockup-render.js', 'deps' => []],
            'personalizador-pdf-selector' => ['archivo' => 'assets/selector-pmu.js', 'deps' => []],
            'personalizador-pdf-visor' => ['archivo' => 'assets/visor-pmu.js', 'deps' => []],
            'personalizador-pdf-biblioteca' => ['archivo' => 'assets/biblioteca-pmu.js', 'deps' => ['personalizador-pdf-visor']],
            'personalizador-pdf-cargador' => ['archivo' => 'assets/cargador-pmu.js', 'deps' => ['personalizador-pdf-visor']],
            'personalizador-pdf-fotos' => ['archivo' => 'assets/fotos-pmu.js', 'deps' => []],
        ];
        foreach ($modulos as $handle => $modulo) {
            wp_enqueue_script($handle, $url . $modulo['archivo'], $modulo['deps'], $version, true);
        }
        $ctx = $this->contexto();
        // El objeto que YA leen los modulos: solo se le suma la clave `contexto`.
        wp_localize_script('personalizador-pdf-mockup-render', 'PMU_TIENDA', [
            'version' => $version,
            'ajaxUrl' => $ctx['ajaxUrl'],
            'postUrl' => $ctx['postUrl'],
            'nonceVistaPrevia' => $ctx['nonce'],
            'contexto' => self::CONTEXTO,
        ]);
        wp_localize_script('personalizador-pdf-mockup-render', 'PMU_COTIZADOR', $ctx);
    }

    /* ==================== Identidad y rutas ==================== */

    /**
     * Identidad del comprador (R12): la MISMA de la biblioteca.
     *
     * Invitado: cookie `pmu_sid` (30 dias). Registrado: cuenta + sesiones ligadas
     * (`_pmu_sids`). Devuelve `uid`, el `sid` vigente y la lista de `sids`.
     */
    public function identidad()
    {
        $sid = $this->sesion()->sid_actual();
        $uid = function_exists('get_current_user_id') ? (int)get_current_user_id() : 0;
        $sids = $sid !== '' ? [$sid] : [];
        if ($uid > 0 && function_exists('get_user_meta')) {
            foreach ((array)get_user_meta($uid, '_pmu_sids', true) as $s) {
                $s = (string)$s;
                if ($s !== '' && !in_array($s, $sids, true) && count($sids) < 20) {
                    $sids[] = $s;
                }
            }
        }
        return ['uid' => $uid, 'sid' => $sid, 'sids' => $sids];
    }

    /**
     * Carpeta donde SE ESCRIBE (una sola): `orders/{uid}/customs/` si hay cuenta,
     * `tmp/sesion-{sid}/customs/` si es invitado (`clave_valida` exige `> 0`).
     */
    private function dir_escritura(array $identidad, $crear = true)
    {
        if ((int)$identidad['uid'] > 0) {
            return $this->motor()->dir_order_customs((string)(int)$identidad['uid'], $crear);
        }
        return $this->motor()->dir_sesion_customs((string)$identidad['sid'], $crear);
    }

    /**
     * Carpetas que SE LEEN, en orden de precedencia (contrato C3): primero las del
     * cliente y despues las temporales de sus sesiones (compra a medias).
     *
     * @return string[]
     */
    private function dirs_lectura(array $identidad)
    {
        $dirs = [];
        if ((int)$identidad['uid'] > 0) {
            $dirs[] = $this->motor()->dir_order_customs((string)(int)$identidad['uid']);
        }
        foreach ((array)$identidad['sids'] as $sid) {
            $dir = $this->motor()->dir_sesion_customs($sid);
            if (!in_array($dir, $dirs, true)) {
                $dirs[] = $dir;
            }
        }
        return $dirs;
    }

    /** `favoritos.json` de la identidad (estrella de items de tienda/historial). */
    private function ruta_favoritos(array $identidad, $crear = false)
    {
        return $this->dir_escritura($identidad, $crear) . DIRECTORY_SEPARATOR . 'favoritos.json';
    }

    /**
     * Sello de vigencia del listado: `id|mtime|size` de cada `idea.json`. Permite
     * responder `sin_cambios` (mismo patron que la biblioteca, D23 de la 030).
     */
    private function revision(array $ideas)
    {
        $partes = [];
        foreach ($ideas as $idea) {
            $partes[] = (string)($idea['id'] ?? '') . '|' . (int)($idea['_mtime'] ?? 0)
                . '|' . (int)($idea['_size'] ?? 0);
        }
        sort($partes, SORT_STRING);
        return substr(sha1(implode("\n", $partes)), 0, 12);
    }

    /* ==================== Validacion ==================== */

    /** Texto plano y acotado (sin HTML): titulo/descripcion no se renderizan como HTML. */
    private static function texto($v, $max)
    {
        $s = trim((string)preg_replace('/\s+/u', ' ', (string)$v));
        $s = strip_tags($s);
        return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
    }

    /** Numero canonico >= 0 (los precios no llevan signo ni exponente). */
    private static function numero($v, $def = 0)
    {
        if (!is_numeric($v)) {
            return $def;
        }
        return max(0, (float)$v);
    }

    /**
     * Valida una idea (contrato C2) y devuelve el array CANONIZADO.
     *
     * Rechaza con causa en vez de reparar en silencio, salvo `$tolerante` (lectura
     * de disco: una idea rota se saltea con aviso, no tumba el listado).
     *
     * @throws Exception `cotizador:idea:<campo>`
     */
    public function validar_idea(array $idea, $tolerante = false)
    {
        $fallo = function ($campo) use ($tolerante) {
            if ($tolerante) {
                return null;
            }
            throw new Exception('cotizador:idea:' . $campo);
        };
        $id = strtolower(trim((string)($idea['id'] ?? '')));
        if (!preg_match(self::RE_IDEA, $id)) {
            return $fallo('id');
        }
        $version = (int)($idea['version'] ?? self::IDEA_VERSION);
        if ($version !== self::IDEA_VERSION) {
            return $fallo('version');
        }
        $order = trim((string)($idea['order'] ?? ''));
        if (!preg_match('/^[a-z0-9][a-z0-9.]{5,119}$/', $order)) {
            return $fallo('order');
        }
        $diseno = is_array($idea['diseno'] ?? null) ? $idea['diseno'] : null;
        if ($diseno === null) {
            return $fallo('diseno');
        }
        $disId = strtolower((string)($diseno['id'] ?? ''));
        $disItem = strtolower((string)($diseno['itemKey'] ?? ''));
        $disSid = strtolower((string)($diseno['sid'] ?? ''));
        $disW = (int)($diseno['w'] ?? 0);
        $disH = (int)($diseno['h'] ?? 0);
        $disReceta = strtolower((string)($diseno['receta'] ?? ''));
        if (!preg_match(self::RE_ID12, $disId)) {
            return $fallo('diseno');
        }
        if (!preg_match(self::RE_ITEM, $disItem)) {
            return $fallo('item');
        }
        if (!preg_match(self::RE_SID, $disSid)) {
            return $fallo('sid');
        }
        if ($disW < 1 || $disH < 1 || $disW > PMU_Sesion::PH_MAX || $disH > PMU_Sesion::PH_MAX) {
            return $fallo('medidas');
        }
        if (!preg_match(self::RE_ID12, $disReceta)) {
            return $fallo('receta');
        }
        $limpia = [
            'version' => self::IDEA_VERSION,
            'id' => $id,
            'creado' => (int)($idea['creado'] ?? time()),
            'favorito' => !empty($idea['favorito']),
            'orden' => max(0, min(999, (int)($idea['orden'] ?? 0))),
            'titulo' => self::texto($idea['titulo'] ?? '', 80),
            'descripcion' => self::texto($idea['descripcion'] ?? '', 240),
            'order' => $order,
            'diseno' => [
                'id' => $disId, 'itemKey' => $disItem, 'sid' => $disSid,
                'w' => $disW, 'h' => $disH, 'receta' => $disReceta,
            ],
            'mockup' => [
                'id' => strtolower((string)($idea['mockup']['id'] ?? '')),
                'w' => max(1, (int)($idea['mockup']['w'] ?? 300)),
                'h' => max(1, (int)($idea['mockup']['h'] ?? 300)),
                'mockupId' => self::texto($idea['mockup']['mockupId'] ?? '', 40),
            ],
        ];
        // El precio es una FOTO del momento (D7/R8): si no se puede leer, la
        // tarjeta se muestra sin precio; nunca invalida la idea.
        if (is_array($idea['precio'] ?? null)) {
            $p = $idea['precio'];
            $limpia['precio'] = [
                'final' => self::numero($p['final'] ?? 0),
                'perUnit' => self::numero($p['perUnit'] ?? 0),
                'total' => self::numero($p['total'] ?? 0),
                'sheets' => (int)self::numero($p['sheets'] ?? 0),
                'stickers' => (int)self::numero($p['stickers'] ?? 0),
                'savingsPct' => (int)self::numero($p['savingsPct'] ?? 0),
                'ts' => (int)self::numero($p['ts'] ?? 0),
            ];
        }
        return $limpia;
    }

    /** Lee el `idea.json` de una carpeta de idea (tolerante) con mtime/size para la revision. */
    private function leer_idea($dirIdea)
    {
        $ruta = rtrim((string)$dirIdea, '/\\') . DIRECTORY_SEPARATOR . 'idea.json';
        if (!is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        if (!is_array($datos)) {
            return null;
        }
        $idea = $this->validar_idea($datos, true);
        if (!is_array($idea)) {
            return null;
        }
        $idea['_dir'] = rtrim((string)$dirIdea, '/\\');
        $idea['_mtime'] = (int)@filemtime($ruta);
        $idea['_size'] = (int)@filesize($ruta);
        // El snapshot es OBLIGATORIO para pintar la tarjeta: si falta, la idea se
        // lista igual (con su causa) para que el cliente pueda borrarla.
        $snap = $idea['_dir'] . DIRECTORY_SEPARATOR . 'mockup.webp';
        $idea['_mockup'] = is_file($snap);
        if (!$idea['_mockup']) {
            $idea['_causa'] = 'cotizador:mockup:ausente';
        }
        return $idea;
    }

    /* ==================== Listado ==================== */

    /**
     * Ideas + favoritos de la identidad (contrato C3).
     *
     * Orden: `favorito` desc, `orden` asc, `creado` desc. Dedupe por `id` con
     * precedencia de `orders/` (si la misma idea esta en `tmp/`, gana la del
     * cliente). Tope de respuesta: `TOPE_LISTA`.
     *
     * @param string $desde revision conocida por el cliente (para `sin_cambios`)
     */
    public function listar_ideas($desde = '')
    {
        if (!$this->activo()) {
            return ['activo' => false, 'ideas' => [], 'favoritos' => [], 'revision' => '', 'total' => 0];
        }
        $ident = $this->identidad();
        $porId = [];
        foreach ($this->dirs_lectura($ident) as $dir) {
            if (!is_dir($dir)) {
                continue;
            }
            foreach ((array)glob($dir . DIRECTORY_SEPARATOR . 'idea-*', GLOB_ONLYDIR) as $dirIdea) {
                $idea = $this->leer_idea($dirIdea);
                if (!is_array($idea) || isset($porId[$idea['id']])) {
                    continue; // rota o ya vista en una carpeta de mas precedencia
                }
                $porId[$idea['id']] = $idea;
            }
        }
        $ideas = array_values($porId);
        $orden = function ($a, $b) {
            $fa = !empty($a['favorito']) ? 1 : 0;
            $fb = !empty($b['favorito']) ? 1 : 0;
            if ($fa !== $fb) {
                return $fb - $fa;
            }
            if ((int)$a['orden'] !== (int)$b['orden']) {
                return (int)$a['orden'] - (int)$b['orden'];
            }
            return (int)$b['creado'] - (int)$a['creado'];
        };
        usort($ideas, $orden);
        $revision = $this->revision($ideas);
        $total = count($ideas);
        if ($desde !== '' && hash_equals($revision, (string)$desde)) {
            return ['activo' => true, 'ideas' => [], 'favoritos' => [],
                'revision' => $revision, 'sin_cambios' => true, 'total' => $total];
        }
        $ideas = array_slice($ideas, 0, self::TOPE_LISTA);
        $base = function_exists('admin_url') ? admin_url('admin-post.php') : '';
        $nonce = function_exists('wp_create_nonce') ? wp_create_nonce(self::NONCE) : '';
        foreach ($ideas as $i => $idea) {
            $ideas[$i]['url'] = $base . '?action=pmu_cotizador&op=imagen&tipo=mockup&idea_id='
                . rawurlencode((string)$idea['id']) . '&_wpnonce=' . rawurlencode($nonce);
            unset($ideas[$i]['_dir'], $ideas[$i]['_mtime'], $ideas[$i]['_size'], $ideas[$i]['_mockup']);
        }
        return ['activo' => true, 'ideas' => $ideas, 'favoritos' => $this->leer_favoritos($ident),
            'revision' => $revision, 'sin_cambios' => false, 'total' => $total];
    }

    /** Favoritos de items que NO son customs (tienda/historial): `favoritos.json`. */
    private function leer_favoritos(array $ident)
    {
        $datos = $this->motor()->leer_json($this->ruta_favoritos($ident));
        $items = is_array($datos) && isset($datos['items']) && is_array($datos['items'])
            ? $datos['items'] : [];
        $limpios = [];
        foreach ($items as $item) {
            if (!is_array($item)) {
                continue;
            }
            $tipo = strtolower((string)($item['tipo'] ?? ''));
            $ref = (string)($item['ref'] ?? '');
            if (!in_array($tipo, ['tienda', 'historial'], true) || $ref === '') {
                continue;
            }
            $limpios[] = ['tipo' => $tipo, 'ref' => $ref, 'creado' => (int)($item['creado'] ?? 0)];
        }
        return $limpios;
    }

    /**
     * Resuelve el `item_key` del cotizador a la sesion que lo tiene.
     *
     * NUNCA se confia en el `sid` que manda el cliente: se busca el manifest en las
     * sesiones de la identidad y se exige `contexto = 'cotizador'`. Devuelve `''`
     * si no resuelve (`cotizador:idea:ajena`).
     */
    private function resolver_item(array $ident, $itemKey)
    {
        $itemKey = strtolower(trim((string)$itemKey));
        if (!preg_match(self::RE_ITEM, $itemKey)) {
            return '';
        }
        foreach ((array)$ident['sids'] as $sid) {
            $manifest = $this->sesion()->leer_manifest($sid, $itemKey);
            if (is_array($manifest) && (string)($manifest['contexto'] ?? '') === self::CONTEXTO) {
                return (string)$sid;
            }
        }
        return '';
    }

    /* ==================== Escritura ==================== */

    /**
     * Guarda/actualiza una idea y su snapshot (contrato C4).
     *
     * - El `item_key` se resuelve contra la IDENTIDAD (nunca contra el `sid` del
     *   POST): si no resuelve, `cotizador:idea:ajena`.
     * - El snapshot entra con el mismo camino que un original (firma + WebP); el
     *   `id` resultante va a `mockup.id` (dedupe por contenido).
     * - Re-guardar la misma `idea_id` REEMPLAZA: una carpeta, un `idea.json`.
     *
     * @param array  $idea          idea cruda del cliente (se valida aca)
     * @param string $snapshotBytes bytes de la imagen 300x300 (opcional al re-guardar)
     * @return array idea canonizada
     * @throws Exception `cotizador:inactivo` | `cotizador:idea:*` | `cotizador:ideas:tope`
     */
    public function guardar_idea(array $idea, $snapshotBytes = '')
    {
        if (!$this->activo()) {
            throw new Exception('cotizador:inactivo');
        }
        $idea = $this->validar_idea($idea);
        if (!is_array($idea)) {
            throw new Exception('cotizador:idea:id');
        }
        $ident = $this->identidad();
        if ($this->resolver_item($ident, (string)$idea['diseno']['itemKey']) === '') {
            throw new Exception('cotizador:idea:ajena');
        }
        $dir = $this->dir_escritura($ident, true);
        $dirIdea = $dir . DIRECTORY_SEPARATOR . $idea['id'];
        $previo = $this->leer_idea($dirIdea);
        $otras = 0;
        foreach ((array)glob($dir . DIRECTORY_SEPARATOR . 'idea-*', GLOB_ONLYDIR) as $carpeta) {
            if (basename($carpeta) !== $idea['id']) {
                $otras++;
            }
        }
        if ($otras >= self::TOPE_IDEAS) {
            throw new Exception('cotizador:ideas:tope');
        }
        if (!is_dir($dirIdea)) {
            wp_mkdir_p($dirIdea);
        }
        $snap = $dirIdea . DIRECTORY_SEPARATOR . 'mockup.webp';
        $bytes = (string)$snapshotBytes;
        if ($bytes !== '') {
            if (strlen($bytes) > PMU_Sesion::TOPE_SUBIDA_BYTES) {
                throw new Exception('cotizador:mockup:tamano');
            }
            if (PMU_Sesion::firma_imagen($bytes) === null) {
                throw new Exception('cotizador:mockup:formato');
            }
            $img = PMU_Sesion::convertir_webp($bytes, 85);
            if (@file_put_contents($snap, $img['bytes']) === false) {
                throw new Exception('cotizador:mockup:escritura');
            }
            $med = @getimagesize($snap);
            $idea['mockup'] = [
                'id' => substr(sha1($bytes), 0, 12),
                'w' => is_array($med) ? (int)$med[0] : 300,
                'h' => is_array($med) ? (int)$med[1] : 300,
                'mockupId' => (string)$idea['mockup']['mockupId'],
            ];
        } elseif (!is_file($snap)) {
            throw new Exception('cotizador:mockup:ausente');
        }
        if (is_array($previo)) {
            // Re-guardar no cambia el alta ni borra el precio ya fotografiado.
            $idea['creado'] = (int)$previo['creado'];
            if (!isset($idea['precio']) && isset($previo['precio'])) {
                $idea['precio'] = $previo['precio'];
            }
        }
        if (!$this->motor()->escribir_json($dirIdea . DIRECTORY_SEPARATOR . 'idea.json', $idea)) {
            throw new Exception('cotizador:idea:escritura');
        }
        return $idea;
    }

    /**
     * Estrella sobre CUALQUIER item (contrato C2/C5): un custom escribe su
     * `idea.json`; un item de la tienda o del historial, `favoritos.json`.
     *
     * @return array{tipo:string, ref:string, favorito:bool}
     * @throws Exception `cotizador:favorito:tipo` | `cotizador:idea:ajena`
     */
    public function favorito($tipo, $ref, $valor)
    {
        if (!$this->activo()) {
            throw new Exception('cotizador:inactivo');
        }
        $tipo = strtolower(trim((string)$tipo));
        $ref = trim((string)$ref);
        $valor = (bool)$valor;
        if (!in_array($tipo, ['custom', 'tienda', 'historial'], true)) {
            throw new Exception('cotizador:favorito:tipo');
        }
        $ident = $this->identidad();
        if ($tipo === 'custom') {
            if (!preg_match(self::RE_IDEA, $ref)) {
                throw new Exception('cotizador:idea:id');
            }
            foreach ($this->dirs_lectura($ident) as $dir) {
                $ruta = $dir . DIRECTORY_SEPARATOR . $ref . DIRECTORY_SEPARATOR . 'idea.json';
                if (!is_file($ruta)) {
                    continue;
                }
                $idea = $this->leer_idea(dirname($ruta));
                if (!is_array($idea)) {
                    throw new Exception('cotizador:idea:ausente');
                }
                $idea['favorito'] = $valor;
                unset($idea['_dir'], $idea['_mtime'], $idea['_size'], $idea['_mockup'], $idea['_causa']);
                if (!$this->motor()->escribir_json($ruta, $idea)) {
                    throw new Exception('cotizador:idea:escritura');
                }
                return ['tipo' => $tipo, 'ref' => $ref, 'favorito' => $valor];
            }
            throw new Exception('cotizador:idea:ajena');
        }
        if ($ref === '' || strlen($ref) > 80 || !preg_match('/^[A-Za-z0-9_.:-]+$/', $ref)) {
            throw new Exception('cotizador:favorito:ref');
        }
        $rutaFav = $this->ruta_favoritos($ident, true);
        $datos = $this->motor()->leer_json($rutaFav);
        $items = is_array($datos) && isset($datos['items']) && is_array($datos['items'])
            ? $datos['items'] : [];
        $items = array_values(array_filter($items, function ($item) use ($tipo, $ref) {
            return !(is_array($item) && (string)($item['tipo'] ?? '') === $tipo
                && (string)($item['ref'] ?? '') === $ref);
        }));
        if ($valor) {
            $items[] = ['tipo' => $tipo, 'ref' => $ref, 'creado' => time()];
        }
        if (!$this->motor()->escribir_json($rutaFav, ['version' => 1, 'items' => $items])) {
            throw new Exception('cotizador:favorito:escritura');
        }
        return ['tipo' => $tipo, 'ref' => $ref, 'favorito' => $valor];
    }

    /**
     * Borra un custom (contrato C5): su `idea.json` y su `mockup.webp`.
     *
     * El ORIGINAL compartido NO se borra (puede estar en otro custom o en un
     * pedido: misma regla que `podar_subidas` de la 035). Una idea de otra
     * identidad no se toca (`cotizador:idea:ajena`).
     */
    public function borrar_idea($idea_id)
    {
        if (!$this->activo()) {
            throw new Exception('cotizador:inactivo');
        }
        $idea_id = strtolower(trim((string)$idea_id));
        if (!preg_match(self::RE_IDEA, $idea_id)) {
            throw new Exception('cotizador:idea:id');
        }
        $ident = $this->identidad();
        $dirIdea = '';
        foreach ($this->dirs_lectura($ident) as $dir) {
            if (is_dir($dir . DIRECTORY_SEPARATOR . $idea_id)) {
                $dirIdea = $dir . DIRECTORY_SEPARATOR . $idea_id;
                break;
            }
        }
        if ($dirIdea === '') {
            throw new Exception('cotizador:idea:ausente');
        }
        $archivos = 0;
        foreach (['idea.json', 'mockup.webp'] as $archivo) {
            $ruta = $dirIdea . DIRECTORY_SEPARATOR . $archivo;
            if (is_file($ruta) && @unlink($ruta)) {
                $archivos++;
            }
        }
        @rmdir($dirIdea);
        return ['borrado' => true, 'id' => $idea_id, 'archivos' => $archivos];
    }

    /* ==================== Historial y promocion ==================== */

    /**
     * Historial del comprador (FR-023): pedidos con diseno del cotizador.
     *
     * Se DERIVA de Woo en cada listado (`customer_id` + `_mu_diseno_id`): no se
     * persiste una copia, asi el historial no se desactualiza ni se puede borrar
     * desde la tira (contrato C2: el historial no se borra).
     */
    public function historial()
    {
        if (!$this->activo()) {
            return ['pedidos' => []];
        }
        $uid = (int)$this->identidad()['uid'];
        if ($uid < 1 || !function_exists('wc_get_orders')) {
            return ['pedidos' => []];
        }
        $pedidos = [];
        $orders = wc_get_orders([
            'customer' => $uid,
            'limit' => 20,
            'orderby' => 'date',
            'order' => 'DESC',
            'status' => ['processing', 'completed', 'on-hold'],
        ]);
        foreach ((array)$orders as $order) {
            if (!is_object($order) || !method_exists($order, 'get_items')) {
                continue;
            }
            $diseno = null;
            $codigo = '';
            foreach ($order->get_items() as $item) {
                if (!method_exists($item, 'get_meta')) {
                    continue;
                }
                $id = (string)$item->get_meta('_mu_diseno_id', true);
                if ($id === '') {
                    continue;
                }
                $codigo = (string)$item->get_meta('_calculator_order_code', true);
                $diseno = [
                    'id' => $id,
                    'itemKey' => (string)$item->get_meta('_pmu_item_key', true),
                    'w' => 0,
                    'h' => 0,
                    'receta' => '',
                    'order' => $codigo,
                ];
                break;
            }
            if ($diseno === null) {
                continue;
            }
            $fecha = '';
            if (method_exists($order, 'get_date_created')) {
                $creada = $order->get_date_created();
                if (is_object($creada) && method_exists($creada, 'date')) {
                    $fecha = $creada->date('Y-m-d');
                }
            }
            $pedidos[] = [
                'order_id' => (int)$order->get_id(),
                'order_code' => $codigo !== '' ? $codigo : (string)(int)$order->get_id(),
                'fecha' => $fecha,
                'diseno' => $diseno,
            ];
        }
        return ['pedidos' => $pedidos];
    }

    /**
     * Promueve UNA linea del cotizador (contrato C3) sin el ciclo de PDF.
     *
     * Reusa `PMU_Sesion::promover_order()` (escribe `manifest.cliente`, mueve los
     * originales a `orders/{clave}/uploads/` y renombra el item) y adopta los
     * customs del invitado. **NO** llama a `entregar_por_tema()` ni a
     * `congelar_bonus_item()`: el cotizador no entrega PDF ni bonus.
     *
     * @return string ruta del item promovido ('' si no se pudo)
     */
    public function promover_linea($order_id, $item_key)
    {
        $order_id = (int)$order_id;
        $item_key = strtolower(trim((string)$item_key));
        if (!$this->activo() || $order_id < 1 || !preg_match(self::RE_ITEM, $item_key)) {
            return '';
        }
        if (!function_exists('wc_get_order')) {
            return '';
        }
        $order = wc_get_order($order_id);
        if (!$order || !method_exists($order, 'get_items')) {
            return '';
        }
        $clave = method_exists($order, 'get_customer_id')
            ? (string)(int)$order->get_customer_id() : '';
        if (!$this->motor()->clave_valida($clave)) {
            // 035 D5: sin cliente no hay carpeta; la causa queda visible en el log.
            $this->log('promover_linea:sin-cliente order=' . $order_id);
            return '';
        }
        $sid = '';
        foreach ($order->get_items() as $item) {
            if (!method_exists($item, 'get_meta')) {
                continue;
            }
            if ((string)$item->get_meta('_pmu_item_key', true) === $item_key) {
                $sid = (string)$item->get_meta('_pmu_sid', true);
                break;
            }
        }
        if ($sid === '') {
            $this->log('promover_linea:sin:sid order=' . $order_id . ' item=' . $item_key);
            return '';
        }
        $destino = $this->sesion()->promover_order($order_id, $clave, $sid, $item_key);
        $this->adoptar_customs($sid, (int)$clave);
        return (string)$destino;
    }

    /**
     * Adopta los customs del invitado al cliente (R4, contrato C6): MUEVE
     * `tmp/sesion-{sid}/customs/` a `orders/{uid}/customs/` y fusiona sus
     * favoritos. Idempotente: si el destino ya existe, el origen se descarta.
     *
     * @return int ideas adoptadas
     */
    public function adoptar_customs($sid, $uid)
    {
        $uid = (int)$uid;
        if ($uid < 1 || !$this->motor()->clave_valida((string)$uid)) {
            return 0;
        }
        $origen = $this->motor()->dir_sesion_customs($sid);
        if (!is_dir($origen)) {
            return 0;
        }
        $destinoBase = $this->motor()->dir_order_customs((string)$uid, true);
        $movidos = 0;
        foreach ((array)glob($origen . DIRECTORY_SEPARATOR . 'idea-*', GLOB_ONLYDIR) as $dirIdea) {
            $destino = $destinoBase . DIRECTORY_SEPARATOR . basename($dirIdea);
            if (is_dir($destino)) {
                // Ya adoptada (reintento del pedido): el origen sobra.
                $this->borrar_arbol($dirIdea);
                continue;
            }
            if (@rename($dirIdea, $destino)) {
                $movidos++;
                continue;
            }
            // Distinto disco: copiar + borrar (misma semantica que `rename`).
            if ($this->copiar_arbol($dirIdea, $destino)) {
                $this->borrar_arbol($dirIdea);
                $movidos++;
            }
        }
        $favOrigen = $origen . DIRECTORY_SEPARATOR . 'favoritos.json';
        if (is_file($favOrigen)) {
            $destinoFav = $destinoBase . DIRECTORY_SEPARATOR . 'favoritos.json';
            $previos = $this->motor()->leer_json($destinoFav);
            $items = is_array($previos) && isset($previos['items']) && is_array($previos['items'])
                ? $previos['items'] : [];
            $nuevos = $this->motor()->leer_json($favOrigen);
            foreach ((array)(is_array($nuevos) ? ($nuevos['items'] ?? []) : []) as $item) {
                $items[] = $item;
            }
            $vistos = [];
            $fusion = [];
            foreach ($items as $item) {
                if (!is_array($item)) {
                    continue;
                }
                $claveFav = (string)($item['tipo'] ?? '') . '|' . (string)($item['ref'] ?? '');
                if (isset($vistos[$claveFav])) {
                    continue;
                }
                $vistos[$claveFav] = true;
                $fusion[] = $item;
            }
            $this->motor()->escribir_json($destinoFav, ['version' => 1, 'items' => $fusion]);
            @unlink($favOrigen);
        }
        return $movidos;
    }

    /** Copia recursiva (fallback de `rename` entre discos). */
    private function copiar_arbol($origen, $destino)
    {
        if (!is_dir($origen)) {
            return false;
        }
        if (!is_dir($destino) && !wp_mkdir_p($destino)) {
            return false;
        }
        $ok = true;
        foreach ((array)glob(rtrim($origen, '/\\') . DIRECTORY_SEPARATOR . '*') as $ruta) {
            $fin = $destino . DIRECTORY_SEPARATOR . basename($ruta);
            $ok = is_dir($ruta)
                ? ($ok && $this->copiar_arbol($ruta, $fin))
                : ($ok && @copy($ruta, $fin));
        }
        return $ok;
    }

    /** Borrado recursivo (solo dentro de `uploads/pmu/`). */
    private function borrar_arbol($dir)
    {
        if (!is_dir($dir)) {
            return;
        }
        foreach ((array)glob(rtrim($dir, '/\\') . DIRECTORY_SEPARATOR . '*') as $ruta) {
            is_dir($ruta) ? $this->borrar_arbol($ruta) : @unlink($ruta);
        }
        @rmdir($dir);
    }

    /** Causa VISIBLE en el log (nunca un fallback silencioso). */
    private function log($mensaje)
    {
        if (defined('WP_DEBUG') && WP_DEBUG) {
            error_log('[pmu-cotizador] ' . $mensaje);
        }
    }

    /* ==================== Endpoint unico ==================== */

    /** Parametro de texto del request (POST o GET), des-escapado. */
    private static function param($clave, $def = '')
    {
        $valor = $_REQUEST[$clave] ?? ($_POST[$clave] ?? $def);
        if (!is_scalar($valor)) {
            return $def;
        }
        $valor = function_exists('wp_unslash') ? wp_unslash((string)$valor) : (string)$valor;
        return function_exists('sanitize_text_field') ? sanitize_text_field($valor) : trim($valor);
    }

    /**
     * Endpoint UNICO del cotizador (contrato C2): `admin_post_pmu_cotizador`.
     *
     * Nonce: `personalizador_pdf_vista_previa`. Identidad: COOKIE (nunca el `sid`
     * del POST). Respuestas JSON; la causa viaja como `cotizador:<motivo>`.
     */
    public function handle()
    {
        $nonce = (string)($_REQUEST['_wpnonce'] ?? '');
        if (!function_exists('wp_verify_nonce') || !wp_verify_nonce($nonce, self::NONCE)) {
            wp_send_json_error('motor:nonce:invalido');
        }
        $op = function_exists('sanitize_key')
            ? sanitize_key(self::param('op')) : strtolower(self::param('op'));
        try {
            if (!$this->activo()) {
                throw new Exception('cotizador:inactivo');
            }
            if ($op === 'listar') {
                wp_send_json_success($this->listar_ideas(self::param('desde')));
                return;
            }
            if ($op === 'guardar') {
                $crudo = json_decode((string)self::param('idea'), true);
                if (!is_array($crudo)) {
                    throw new Exception('cotizador:idea:json');
                }
                wp_send_json_success(['ok' => true, 'idea' => $this->guardar_idea($crudo, $this->bytes_mockup())]);
                return;
            }
            if ($op === 'favorito') {
                $valor = !empty($_POST['valor']) || self::param('valor') === '1'
                    || strtolower(self::param('valor')) === 'true';
                $r = $this->favorito(self::param('tipo'), self::param('ref'), $valor);
                wp_send_json_success(array_merge(['ok' => true], $r));
                return;
            }
            if ($op === 'borrar') {
                $r = $this->borrar_idea(self::param('idea_id'));
                wp_send_json_success(array_merge(['ok' => true], $r));
                return;
            }
            if ($op === 'historial') {
                wp_send_json_success($this->historial());
                return;
            }
            // Enmienda v2 (contrato C5): mockups del Editor, catalogo de plantillas
            // y descarga de la imagen procesada.
            if ($op === 'mockups') {
                wp_send_json_success($this->mockups_de_pdf(self::param('pdf')));
                return;
            }
            if ($op === 'pdfs') {
                wp_send_json_success(['ok' => true, 'pdfs' => $this->catalogo_pdfs()]);
                return;
            }
            if ($op === 'descargar') {
                $this->descargar();
                return;
            }
            if ($op === 'imagen') {
                $this->servir_imagen();
                return;
            }
            throw new Exception('op:invalido');
        } catch (\Throwable $e) {
            wp_send_json_error($e->getMessage());
        }
    }

    /** Bytes del snapshot: archivo (`mockup`) o dataURL (`mockup_data`). */
    private function bytes_mockup()
    {
        if (isset($_FILES['mockup']['tmp_name']) && is_uploaded_file((string)$_FILES['mockup']['tmp_name'])) {
            return (string)@file_get_contents((string)$_FILES['mockup']['tmp_name']);
        }
        $dataurl = (string)($_POST['mockup_data'] ?? '');
        if ($dataurl !== '') {
            $coma = strpos($dataurl, ',');
            if ($coma === false) {
                throw new Exception('cotizador:mockup:formato');
            }
            $bytes = base64_decode(substr($dataurl, $coma + 1), true);
            if ($bytes === false) {
                throw new Exception('cotizador:mockup:formato');
            }
            return (string)$bytes;
        }
        return '';
    }

    /**
     * Sirve los bytes de un snapshot (o del original) de la IDENTIDAD.
     *
     * Nunca se arma una ruta con texto del cliente: `idea_id` se valida por regex
     * y el archivo se resuelve dentro de las carpetas de la identidad. Se cachea
     * como `private` (no pasa por CDN ni por la cache publica del hosting).
     */
    private function servir_imagen()
    {
        $idea_id = strtolower(self::param('idea_id'));
        $order_id = (int)self::param('order_id');
        if ($order_id > 0) {
            // Camino del PEDIDO (T027): el bloque "Diseno" del pedido sirve el
            // original del item, autorizado por pedido (duenio o admin).
            $rutaOrden = $this->ruta_diseno_pedido($order_id, self::param('item_key'));
            $this->emitir($rutaOrden);
            return;
        }
        if (!preg_match(self::RE_IDEA, $idea_id)) {
            throw new Exception('cotizador:idea:id');
        }
        $ident = $this->identidad();
        $ruta = '';
        foreach ($this->dirs_lectura($ident) as $dir) {
            $candidato = $dir . DIRECTORY_SEPARATOR . $idea_id . DIRECTORY_SEPARATOR . 'mockup.webp';
            if (is_file($candidato)) {
                $ruta = $candidato;
                break;
            }
        }
        if ($ruta === '') {
            throw new Exception('cotizador:mockup:ausente');
        }
        if (strtolower(self::param('tipo')) === 'original') {
            $idea = $this->leer_idea(dirname($ruta));
            if (is_array($idea)) {
                $original = $this->sesion()->resolver_original(
                    (string)$idea['diseno']['id'],
                    (string)$ident['uid'],
                    (string)$ident['sid']
                );
                if ($original !== '' && is_file($original)) {
                    $ruta = $original;
                }
            }
        }
        $this->emitir($ruta);
    }

    /**
     * Resuelve el ORIGINAL de un item de pedido (T027, bloque "Diseno").
     *
     * Autoriza por pedido: el duenio de la cuenta o quien puede editar el pedido.
     * El archivo se resuelve por `_mu_diseno_id` (nunca por una ruta del request).
     *
     * @return string ruta absoluta del original
     * @throws Exception `cotizador:idea:ausente` | `cotizador:idea:ajena`
     */
    private function ruta_diseno_pedido($order_id, $item_key)
    {
        if (!function_exists('wc_get_order')) {
            throw new Exception('cotizador:idea:ausente');
        }
        $order = wc_get_order($order_id);
        if (!$order || !method_exists($order, 'get_items')) {
            throw new Exception('cotizador:idea:ausente');
        }
        $uid = function_exists('get_current_user_id') ? (int)get_current_user_id() : 0;
        $duenio = method_exists($order, 'get_customer_id') ? (int)$order->get_customer_id() : 0;
        $puede = ($uid > 0 && $uid === $duenio)
            || (function_exists('current_user_can') && current_user_can('edit_shop_order', $order_id));
        if (!$puede) {
            throw new Exception('cotizador:idea:ajena');
        }
        $item_key = strtolower(trim((string)$item_key));
        foreach ($order->get_items() as $item) {
            if (!method_exists($item, 'get_meta')) {
                continue;
            }
            if ((string)$item->get_meta('_pmu_item_key', true) !== $item_key) {
                continue;
            }
            $id = (string)$item->get_meta('_mu_diseno_id', true);
            $sid = (string)$item->get_meta('_pmu_sid', true);
            $ruta = $id !== '' ? $this->sesion()->resolver_original($id, (string)$duenio, $sid) : '';
            if ($ruta !== '' && is_file($ruta)) {
                return $ruta;
            }
            break;
        }
        throw new Exception('cotizador:idea:ausente');
    }

    /**
     * Descarga la IMAGEN PROCESADA del item (contrato C5.4, FR-038).
     *
     * Reusa la autorizacion por pedido de `ruta_diseno_pedido()` y sirve el
     * original como adjunto. El PDF no pasa por aca: el resumen enlaza directo a
     * `admin_post_personalizador_pdf_item_descargar`, que ya lo genera y sirve.
     */
    private function descargar()
    {
        $order_id = (int)self::param('order_id');
        $item_key = strtolower(trim((string)self::param('item_key')));
        if ($order_id < 1 || $item_key === '') {
            throw new Exception('cotizador:idea:ausente');
        }
        $this->emitir($this->ruta_diseno_pedido($order_id, $item_key), true);
    }

    /**
     * Mockups del Editor del PDF (contrato C5.2, FR-039).
     *
     * Devuelve el MISMO subconjunto que `datos_pdf_render()` (`mockups`, `grupos`,
     * `imagenes`, `envolturas`): el comprador compone con `PMUMockup.componer`
     * exactamente como la ficha, con los placeholders y las envolturas del PDF.
     *
     * @throws Exception `cotizador:pdf:ausente`
     */
    public function mockups_de_pdf($pdf)
    {
        $vacio = ['activo' => $this->activo(), 'pdf' => '', 'mockups' => [], 'grupos' => [],
            'imagenes' => [], 'envolturas' => [], 'revision' => ''];
        if (!$this->activo()) {
            return $vacio;
        }
        $slug = '';
        try {
            $slug = $this->motor()->nombre_seguro((string)$pdf, 'cotizador:mockups');
        } catch (\Throwable $e) {
            $slug = '';
        }
        // `dir_pdf()` LANZA si la carpeta no existe (no es un getter): la
        // existencia se comprueba aca y cualquier fallo es `pdf:ausente`.
        $existe = false;
        if ($slug !== '') {
            try {
                $existe = is_dir($this->motor()->dir_pdf($slug));
            } catch (\Throwable $e) {
                $existe = false;
            }
        }
        if (!$existe) {
            throw new Exception('cotizador:pdf:ausente');
        }
        $plugin = class_exists('Personalizador_PDF_Plugin') ? \Personalizador_PDF_Plugin::instance() : null;
        if (!$plugin || !method_exists($plugin, 'datos_pdf_render')) {
            throw new Exception('cotizador:pdf:ausente');
        }
        $datos = (array)$plugin->datos_pdf_render($slug);
        $mockups = (array)($datos['mockups'] ?? []);
        return [
            'activo' => true,
            'pdf' => $slug,
            'mockups' => $mockups,
            'grupos' => (array)($datos['grupos'] ?? []),
            'imagenes' => (array)($datos['imagenes'] ?? []),
            'envolturas' => (array)($datos['envolturas'] ?? []),
            'revision' => substr(sha1((string)wp_json_encode($mockups)), 0, 12),
        ];
    }

    /**
     * Catalogo de plantillas del cotizador (contrato C5.3): PDFs importados que
     * tienen mockups. Solo admin (es el `select` del panel).
     *
     * @throws Exception `cotizador:permiso`
     */
    private function catalogo_pdfs()
    {
        if (!function_exists('current_user_can') || !current_user_can('manage_options')) {
            throw new Exception('cotizador:permiso');
        }
        $raiz = $this->motor()->dir_ambito('pdfs');
        if (!is_dir($raiz)) {
            return [];
        }
        $out = [];
        foreach ((array)glob($raiz . DIRECTORY_SEPARATOR . '*', GLOB_ONLYDIR) as $dir) {
            $slug = basename($dir);
            try {
                $cfg = $this->motor()->leer_config($slug);
            } catch (\Throwable $e) {
                continue;
            }
            $mockups = is_array($cfg) ? (array)($cfg['mockups'] ?? []) : [];
            if (!$mockups) {
                continue; // sin mockups no sirve como plantilla del cotizador
            }
            $ids = [];
            foreach ($mockups as $mockup) {
                $id = is_array($mockup) ? (string)($mockup['id'] ?? '') : '';
                if ($id !== '') {
                    $ids[] = $id;
                }
            }
            $out[] = ['slug' => $slug, 'titulo' => $slug, 'mockups' => $ids, 'tiene_mockups' => true];
        }
        usort($out, function ($a, $b) {
            return strcmp($a['slug'], $b['slug']);
        });
        return $out;
    }

    /** Respuesta binaria con cache privada (no pasa por CDN ni cache publica). */
    private function emitir($ruta, $descarga = false)
    {
        $mime = 'image/webp';
        $info = @getimagesize($ruta);
        if (is_array($info) && !empty($info['mime'])) {
            $mime = (string)$info['mime'];
        }
        if (!headers_sent()) {
            header('Content-Type: ' . $mime);
            header('Cache-Control: private, max-age=604800');
            header('Content-Length: ' . (string)@filesize($ruta));
            if ($descarga) {
                header('Content-Disposition: attachment; filename="diseno-' . basename($ruta) . '"');
            }
        }
        readfile($ruta);
        exit;
    }
}