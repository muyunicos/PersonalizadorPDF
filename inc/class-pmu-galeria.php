<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * PMU_Galeria — Motor unico de galerias de TextMuy (Const. VII).
 *
 * UNICO responsable de leer, escribir, listar y persistir
 * uploads/tm/{fonts,img,presets} (catalogos v5.0 tuplas
 * [id,title,cats,file], fisicos y sprite thumbs.webp por ambito).
 * Los handlers sueltos admin_post_personalizador_pdf_textmuy_* NO
 * existen: todo pasa por action=pmu_uploads con op= (Contrato
 * contracts/motor-contract.md de 002).
 *
 * Fuera del motor: pdfs/, datasets y salidas (Const. VII).
 */
class PMU_Galeria
{
    /** Ambitos soportados (orden canonico). */
    public $ambitos = ['fonts', 'img', 'presets'];

    /** Grilla del sprite por ambito (thumbs del catalogo). */
    private $thumbs = [
        'fonts'   => ['w' => 180, 'h' => 30, 'c' => 4],
        'img'     => ['w' => 100, 'h' => 100, 'c' => 8],
        'presets' => ['w' => 200, 'h' => 100, 'c' => 4],
    ];

    private $urls = [
        'fonts'   => 'tm/fonts/',
        'img'     => 'tm/img/',
        'presets' => 'tm/presets/',
    ];

    private $dirs = [
        'fonts'   => 'fonts',
        'img'     => 'img',
        'presets' => 'presets',
    ];

    private $categorias = ['fondos', 'iconos', 'varios'];

    /* ============ Rutas ============ */

    public function dir_pmu_t($crear = false)
    {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . 'pmu/tm';
        if (($crear || !is_dir($dir)) && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    public function subdir_pmu_t($rel, $crear = false)
    {
        $dir = $this->dir_pmu_t($crear) . DIRECTORY_SEPARATOR . $rel;
        if (($crear || !is_dir($dir)) && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    public function dir_ambito($ambito, $crear = false)
    {
        return $this->subdir_pmu_t($this->dirs[$ambito], $crear);
    }

    public function url_ambito($ambito)
    {
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . $this->urls[$ambito];
    }

    public function ruta_catalogo($ambito)
    {
        return $this->dir_ambito($ambito) . DIRECTORY_SEPARATOR . $ambito . '.json';
    }

    public function thumbs_ambito($ambito)
    {
        return $this->thumbs[$ambito];
    }

    public function categorias()
    {
        return $this->categorias;
    }

    /* ============ Catalogo (seed lazy) ============ */

    public function catalogo($ambito)
    {
        $cat = ['thumbs' => $this->thumbs_ambito($ambito), 'items' => []];
        $ruta = $this->ruta_catalogo($ambito);
        if (!is_file($ruta)) {
            @file_put_contents($ruta, wp_json_encode($cat, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
            return $cat;
        }
        $datos = json_decode((string)file_get_contents($ruta), true);
        if (is_array($datos) && isset($datos['thumbs'], $datos['items']) && is_array($datos['items'])) {
            $cat['thumbs'] = $datos['thumbs'];
            $cat['items'] = array_values(array_filter($datos['items'], 'is_array'));
        }
        return $cat;
    }

    public function guardar_catalogo($ambito, $cat)
    {
        return @file_put_contents(
            $this->ruta_catalogo($ambito),
            wp_json_encode($cat, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        ) !== false;
    }

    /* ============ Tuplas v5.0 ============ */

    public function tupla_id_de_file($items, $file)
    {
        foreach ((array)$items as $t) {
            if (is_array($t) && count($t) >= 4 && (string)$t[3] === (string)$file) {
                return (int)$t[0];
            }
        }
        return 0;
    }

    /** Alta: reutiliza el hueco (tombstone) mas bajo o anexa max(id)+1. */
    public function tupla_alta(&$items, $title, $cats, $file)
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
    public function tupla_baja(&$items, $id)
    {
        foreach ($items as $i => $t) {
            if (is_array($t) && (int)$t[0] === (int)$id) {
                $items[$i] = [(int)$id, '', '', ''];
                return true;
            }
        }
        return false;
    }

    /* ============ Utilidades ============ */

    public function nombre_seguro($nombre)
    {
        $limpio = strtolower((string)$nombre);
        $limpio = preg_replace('/[^a-z0-9_-]+/', '-', $limpio);
        $limpio = preg_replace('/^-+|-+$/', '', (string)$limpio);
        return substr($limpio, 0, 64);
    }

    public function firma_imagen_valida($ruta, $ext)
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

    public function firma_fuente_valida($ruta, $ext)
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

    public function ruta_imagen($nombre)
    {
        $ruta = $this->dir_ambito('img') . DIRECTORY_SEPARATOR . $nombre;
        return is_file($ruta) ? $ruta : '';
    }

    /* ============ Listados (motor-generated) ============ */

    /** Listado completo para el puente (presets, imagenes, fuentes). */
    public function listar()
    {
        return [
            'presets'  => $this->listar_presets(),
            'imagenes' => $this->listar_imagenes(),
            'fuentes'  => $this->listar_fuentes(),
        ];
    }

    /** Nombres de presets (para el selector de la pestana PDFs). */
    public function listar_presets()
    {
        $out = [];
        foreach ((array)glob($this->dir_ambito('presets') . DIRECTORY_SEPARATOR . '*.txm') as $ruta) {
            $nombre = basename($ruta, '.txm');
            if ($this->nombre_seguro($nombre) === $nombre) {
                $out[] = $nombre;
            }
        }
        sort($out, SORT_NATURAL | SORT_FLAG_CASE);
        return $out;
    }

    /** Imagenes desde img.json + fisicos presentes (higiene: sin 404). */
    public function listar_imagenes()
    {
        $urlBase = $this->url_ambito('img');
        $out = [];
        foreach ($this->catalogo('img')['items'] as $t) {
            if (!is_array($t) || count($t) < 4 || (string)$t[3] === '') {
                continue; // tombstone/rota: fuera
            }
            $archivo = (string)$t[3];
            if (!is_file($this->ruta_imagen($archivo))) {
                continue; // fisico ausente: cero 404
            }
            $cats = $t[2];
            if (is_array($cats)) {
                $categoria = (string)($cats[0] ?? 'varios');
            } else {
                $categoria = trim((string)$cats);
                if ($categoria === '') {
                    $categoria = 'varios';
                }
            }
            $ruta = $this->ruta_imagen($archivo);
            $out[] = [
                'nombre'    => $archivo,
                'categoria' => $categoria,
                'titulo'    => ((string)$t[1] !== '' ? (string)$t[1] : $archivo),
                'url'       => $urlBase . rawurlencode($archivo) . '?v=' . (int)@filemtime($ruta),
                // R2: el .txm guarda SOLO el id numerico.
                'id'        => (int)$t[0],
                'thumb'     => '',
            ];
        }
        usort($out, function ($a, $b) {
            return strcmp($a['categoria'], $b['categoria']) ?: strcasecmp($a['nombre'], $b['nombre']);
        });
        return $out;
    }

    /** Fuentes fisicas reales desde fonts.json (Google queda fuera: lazy cliente). */
    public function listar_fuentes()
    {
        $urlBase = $this->url_ambito('fonts');
        $dir = $this->dir_ambito('fonts');
        $out = [];
        foreach ($this->catalogo('fonts')['items'] as $t) {
            if (!is_array($t) || count($t) < 4) {
                continue;
            }
            $archivo = (string)$t[3];
            if ($archivo === '' || !preg_match('/\.(ttf|otf|woff|woff2)$/i', $archivo)) {
                continue; // Google (sin extension): el modulo la carga lazy por su cuenta
            }
            if (!is_file($dir . DIRECTORY_SEPARATOR . $archivo)) {
                continue;
            }
            $out[] = [
                'nombre' => $archivo,
                'titulo' => ((string)$t[1] !== '' ? (string)$t[1] : pathinfo($archivo, PATHINFO_FILENAME)),
                'ext'    => pathinfo($archivo, PATHINFO_EXTENSION),
                'url'    => $urlBase . rawurlencode($archivo) . '?v=' . (int)@filemtime($dir . DIRECTORY_SEPARATOR . $archivo),
            ];
        }
        return $out;
    }

    /* ============ Operaciones de escritura (excepciones con causa) ============ */

    /** Sube una imagen (scope img). Devuelve {nombre,categoria,id,url}. */
    public function alta_imagen($file, $categoria, $nombre, $sobrescribir)
    {
        $op = 'alta:img';
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['png', 'jpg', 'jpeg', 'webp', 'svg'], true)) {
            throw new Exception('motor:' . $op . ':formato (usa PNG, JPG, WebP o SVG)');
        }
        if (!$this->firma_imagen_valida($file['tmp_name'], $ext)) {
            throw new Exception('motor:' . $op . ':formato (firma invalida)');
        }
        $categoria = $this->nombre_seguro((string)$categoria);
        if (!in_array($categoria, $this->categorias, true)) {
            $categoria = 'varios';
        }
        $dir = $this->dir_ambito('img', true);
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        $base = $this->nombre_seguro((string)$nombre);
        if ($base === '') {
            $base = $this->nombre_seguro(pathinfo((string)$file['name'], PATHINFO_FILENAME));
        }
        if ($base === '') {
            $base = 'imagen';
        }
        $destino = $base . '.' . $ext;
        if (!$sobrescribir) {
            $i = 2;
            while (is_file($dir . DIRECTORY_SEPARATOR . $destino)) {
                $destino = $base . '-' . $i . '.' . $ext;
                $i++;
            }
        }
        if (!@move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        $cat = $this->catalogo('img');
        $id = $this->tupla_alta(
            $cat['items'],
            pathinfo($destino, PATHINFO_FILENAME),
            ($categoria !== '' ? $categoria : 'varios'),
            $destino
        );
        $this->guardar_catalogo('img', $cat);
        $rutaDestino = $dir . DIRECTORY_SEPARATOR . $destino;
        return [
            'nombre'    => $destino,
            'categoria' => $categoria,
            'id'        => $id,
            'url'       => $this->url_ambito('img') . rawurlencode($destino) . '?v=' . (int)@filemtime($rutaDestino),
        ];
    }

    /** Borra una imagen (tombstone + unlink). Devuelve {nombre,id}. */
    public function baja_imagen($nombre)
    {
        $op = 'baja:img';
        $nombre = $this->nombre_seguro((string)$nombre);
        if ($nombre === '' || !preg_match('/[.](png|jpe?g|webp|svg)$/i', $nombre)) {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $ruta = $this->ruta_imagen($nombre);
        if ($ruta === '') {
            throw new Exception('motor:' . $op . ':recurso:ausente');
        }
        if (!@unlink($ruta)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        $cat = $this->catalogo('img');
        $id = $this->tupla_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            $this->tupla_baja($cat['items'], $id);
            $this->guardar_catalogo('img', $cat);
        }
        return ['nombre' => $nombre, 'id' => $id];
    }

    /** Renombra/mueve categoria una imagen. Devuelve {nombre,categoria,id,url}. */
    public function editar_imagen($nombre, $nombreNuevo, $categoriaNueva)
    {
        $op = 'editar:img';
        $nombre = $this->nombre_seguro((string)$nombre);
        $nombreNuevo = $this->nombre_seguro((string)$nombreNuevo);
        $categoriaNueva = $this->nombre_seguro((string)$categoriaNueva);
        if ($nombre === '' || $nombreNuevo === '' || !in_array($categoriaNueva, $this->categorias, true)) {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $origen = $this->ruta_imagen($nombre);
        if ($origen === '') {
            throw new Exception('motor:' . $op . ':recurso:ausente');
        }
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        $dir = $this->dir_ambito('img', true);
        $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '.' . $ext;
        if ($destino !== $origen) {
            $i = 2;
            while (is_file($destino)) {
                $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '-' . $i . '.' . $ext;
                $i++;
            }
            if (!@rename($origen, $destino)) {
                throw new Exception('motor:' . $op . ':directorio:no_escribible');
            }
        }
        $nombreFinal = basename($destino);
        $cat = $this->catalogo('img');
        $id = $this->tupla_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    $cat['items'][$i] = [$id, ((string)$t[1] !== '' ? $t[1] : pathinfo($nombreFinal, PATHINFO_FILENAME)), $categoriaNueva, $nombreFinal];
                    break;
                }
            }
        } else {
            $id = $this->tupla_alta($cat['items'], pathinfo($nombreFinal, PATHINFO_FILENAME), $categoriaNueva, $nombreFinal);
        }
        $this->guardar_catalogo('img', $cat);
        return [
            'nombre'    => $nombreFinal,
            'categoria' => $categoriaNueva,
            'id'        => $id,
            'url'       => $this->url_ambito('img') . rawurlencode($nombreFinal) . '?v=' . (int)@filemtime($destino),
        ];
    }

    /** Sube una fuente fisica. Devuelve {nombre,titulo,ext,url}. */
    public function alta_fuente($file, $titulo)
    {
        $op = 'alta:fonts';
        $ext = strtolower(pathinfo((string)$file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ['ttf', 'otf', 'woff', 'woff2'], true)) {
            throw new Exception('motor:' . $op . ':formato (usa TTF, OTF, WOFF o WOFF2)');
        }
        if (!$this->firma_fuente_valida($file['tmp_name'], $ext)) {
            throw new Exception('motor:' . $op . ':formato (firma invalida)');
        }
        $dir = $this->dir_ambito('fonts', true);
        $base = $this->nombre_seguro(pathinfo((string)$file['name'], PATHINFO_FILENAME));
        if ($base === '') {
            $base = 'fuente';
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
        $titulo = sanitize_text_field((string)$titulo);
        if ($titulo === '') {
            $titulo = $base;
        }
        $cat = $this->catalogo('fonts');
        $id = $this->tupla_alta($cat['items'], $titulo, 'custom', $destino);
        $this->guardar_catalogo('fonts', $cat);
        return [
            'nombre' => $destino,
            'titulo' => $titulo,
            'ext'    => $ext,
            'url'    => $this->url_ambito('fonts') . rawurlencode($destino) . '?v=' . (int)@filemtime($dir . DIRECTORY_SEPARATOR . $destino),
        ];
    }

    /** Borra una fuente fisica (tombstone). Devuelve {nombre,id}. */
    public function baja_fuente($nombre)
    {
        $op = 'baja:fonts';
        $nombre = $this->nombre_seguro((string)$nombre);
        if ($nombre === '' || !preg_match('/[.](ttf|otf|woff|woff2)$/i', $nombre)) {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $dir = $this->dir_ambito('fonts');
        $ruta = $dir . DIRECTORY_SEPARATOR . $nombre;
        if (is_file($ruta) && !@unlink($ruta)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        $cat = $this->catalogo('fonts');
        $id = $this->tupla_id_de_file($cat['items'], $nombre);
        if ($id > 0) {
            $this->tupla_baja($cat['items'], $id);
            $this->guardar_catalogo('fonts', $cat);
        }
        return ['nombre' => $nombre, 'id' => $id];
    }

    /** Renombra/cambia categoria de una fuente. Devuelve {nombre,titulo,ext,url,id}. */
    public function editar_fuente($nombre, $nombreNuevo, $categoriaNueva)
    {
        $op = 'editar:fonts';
        $nombre = $this->nombre_seguro((string)$nombre);
        $nombreNuevo = $this->nombre_seguro((string)$nombreNuevo);
        if ($nombre === '' || $nombreNuevo === '' || !preg_match('/[.](ttf|otf|woff|woff2)$/i', $nombre)) {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $dir = $this->dir_ambito('fonts');
        $origen = $dir . DIRECTORY_SEPARATOR . $nombre;
        if (!is_file($origen)) {
            throw new Exception('motor:' . $op . ':recurso:ausente');
        }
        $ext = strtolower(pathinfo($nombre, PATHINFO_EXTENSION));
        $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '.' . $ext;
        if ($destino !== $origen) {
            $i = 2;
            while (is_file($destino)) {
                $destino = $dir . DIRECTORY_SEPARATOR . $nombreNuevo . '-' . $i . '.' . $ext;
                $i++;
            }
            if (!@rename($origen, $destino)) {
                throw new Exception('motor:' . $op . ':directorio:no_escribible');
            }
        }
        $archivoFinal = basename($destino);
        $cat = $this->catalogo('fonts');
        $id = $this->tupla_id_de_file($cat['items'], $nombre);
        $titulo = $nombreNuevo;
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    if ((string)$t[1] !== '') {
                        $titulo = (string)$t[1];
                    }
                    $cat['items'][$i] = [$id, $titulo, ($categoriaNueva !== '' ? $categoriaNueva : $t[2]), $archivoFinal];
                    break;
                }
            }
        } else {
            $id = $this->tupla_alta($cat['items'], $titulo, ($categoriaNueva !== '' ? $categoriaNueva : 'custom'), $archivoFinal);
        }
        $this->guardar_catalogo('fonts', $cat);
        return [
            'nombre' => $archivoFinal,
            'titulo' => $titulo,
            'ext'    => $ext,
            'id'     => $id,
            'url'    => $this->url_ambito('fonts') . rawurlencode($archivoFinal) . '?v=' . (int)@filemtime($destino),
        ];
    }

    /** Guarda un preset (.txm + tupla upsert). Devuelve {nombre,id}. */
    public function alta_preset($nombre, $file)
    {
        $op = 'alta:presets';
        $nombre = $this->nombre_seguro((string)$nombre);
        if ($nombre === '') {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $payload = json_decode((string)file_get_contents($file['tmp_name']), true);
        if (!is_array($payload)
            || (isset($payload['format']) ? $payload['format'] : '') !== 'textmuy-project'
            || !is_array($payload['settings'] ?? null)) {
            throw new Exception('motor:' . $op . ':formato (el .txm debe ser textmuy-project con settings)');
        }
        $dir = $this->dir_ambito('presets', true);
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        @unlink($dir . DIRECTORY_SEPARATOR . $nombre . '.webp'); // resto deprecado
        if (!@move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $nombre . '.txm')) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        $cat = $this->catalogo('presets');
        $id = $this->tupla_id_de_file($cat['items'], $nombre . '.txm');
        if ($id > 0) {
            foreach ($cat['items'] as $i => $t) {
                if ((int)$t[0] === $id) {
                    $cat['items'][$i] = [$id, $nombre, $t[2], $nombre . '.txm'];
                    break;
                }
            }
        } else {
            $id = $this->tupla_alta($cat['items'], $nombre, 'custom', $nombre . '.txm');
        }
        $this->guardar_catalogo('presets', $cat);
        return ['nombre' => $nombre, 'id' => $id];
    }

    /** Borra un preset (.txm + tombstone). Devuelve {nombre,id}. */
    public function baja_preset($nombre)
    {
        $op = 'baja:presets';
        $nombre = $this->nombre_seguro((string)$nombre);
        if ($nombre === '') {
            throw new Exception('motor:' . $op . ':nombre:invalido');
        }
        $dir = $this->dir_ambito('presets');
        $ruta = $dir . DIRECTORY_SEPARATOR . $nombre . '.txm';
        if (!is_file($ruta) || !@unlink($ruta)) {
            throw new Exception('motor:' . $op . ':recurso:ausente');
        }
        @unlink($dir . DIRECTORY_SEPARATOR . $nombre . '.webp'); // resto deprecado
        $cat = $this->catalogo('presets');
        $id = $this->tupla_id_de_file($cat['items'], $nombre . '.txm');
        if ($id > 0) {
            $this->tupla_baja($cat['items'], $id);
            $this->guardar_catalogo('presets', $cat);
        }
        return ['nombre' => $nombre, 'id' => $id];
    }

    /** Persiste el sprite unico thumbs.webp del ambito (y limpia restos). */
    public function sprite($scope, $file)
    {
        $op = 'sprite:' . $scope;
        $scope = $this->nombre_seguro((string)$scope);
        if (!in_array($scope, $this->ambitos, true)) {
            throw new Exception('motor:sprite:scope:invalido');
        }
        if ($file['size'] > 4 * 1024 * 1024) {
            throw new Exception('motor:' . $op . ':archivo:tamano');
        }
        if (!$this->firma_imagen_valida($file['tmp_name'], 'webp')) {
            throw new Exception('motor:' . $op . ':archivo:formato');
        }
        $dir = $this->dir_ambito($scope, true);
        $destino = $dir . DIRECTORY_SEPARATOR . 'thumbs.webp';
        if (!@move_uploaded_file($file['tmp_name'], $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'sprite.json'); // resto del formato anterior
        @unlink($dir . DIRECTORY_SEPARATOR . 'sprite.webp'); // resto del formato anterior
        $mtime = (int)@filemtime($destino);
        return ['spriteUrl' => $this->url_ambito($scope) . 'thumbs.webp?v=' . $mtime, 'scope' => $scope];
    }

    /** Persiste una miniatura individual (grupos de PDF) en tm/img/. */
    public function miniatura($nombre, $file)
    {
        $op = 'miniatura:img';
        if ($file['size'] > 500 * 1024) {
            throw new Exception('motor:' . $op . ':archivo:tamano');
        }
        if (!$this->firma_imagen_valida($file['tmp_name'], 'webp')) {
            throw new Exception('motor:' . $op . ':archivo:formato');
        }
        $nombre = $this->nombre_seguro((string)$nombre);
        if ($nombre === '') {
            $nombre = uniqid('thumb_', true);
        }
        $dir = $this->dir_ambito('img', true);
        $destino = $dir . DIRECTORY_SEPARATOR . $nombre . '.webp';
        if (!@move_uploaded_file($file['tmp_name'], $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        return [
            'url'    => $this->url_ambito('img') . rawurlencode($nombre) . '.webp?v=' . (int)@filemtime($destino),
            'nombre' => $nombre,
        ];
    }

    /** Dispatch unificado: procesa la operacion basada en op. */
    public function handle_request()
    {
        if (!isset($_POST['op'])) {
            wp_send_json_error('motor:op:falta');
        }
        $op = (string)$_POST['op'];

        try {
            switch ($op) {
                case 'listar':
                    wp_send_json_success($this->listar());
                    break;
                case 'alta':
                    $ambito = (string)$_POST['ambito'];
                    if (!in_array($ambito, $this->ambitos, true)) {
                        wp_send_json_error('motor:alta:ambito:invalido');
                    }
                    $titulo = isset($_POST['titulo']) ? (string)$_POST['titulo'] : '';
                    $file = $_POST['archivo'] ?? '';
                    if ($file === '' || $titulo === '') {
                        wp_send_json_error('motor:alta:falta:archivo|titulo');
                    }
                    wp_send_json_success($this->alta($ambito, $titulo, $file));
                    break;
                case 'baja':
                    $ambito = (string)$_POST['ambito'];
                    $file = (string)$_POST['archivo'];
                    if ($ambito === '' || $file === '') {
                        wp_send_json_error('motor:baja:falta:ambito|archivo');
                    }
                    wp_send_json_success($this->baja($ambito, $file));
                    break;
                case 'editar':
                    $ambito = (string)$_POST['ambito'];
                    $titulo = (string)$_POST['titulo'];
                    $file = (string)$_POST['archivo'];
                    if ($ambito === '' || $file === '') {
                        wp_send_json_error('motor:editar:falta:ambito|archivo');
                    }
                    wp_send_json_success($this->editar($ambito, $titulo, $file));
                    break;
                case 'sprite':
                    $scope = (string)$_POST['scope'];
                    if (!in_array($scope, $this->ambitos, true)) {
                        wp_send_json_error('motor:sprite:scope:invalido');
                    }
                    if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:sprite:falta:archivo');
                    }
                    wp_send_json_success($this->sprite($scope, $_FILES['archivo']));
                    break;
                case 'miniatura':
                    if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:miniatura:falta:archivo');
                    }
                    $nombre = (string)$_POST['nombre'] ?? '';
                    wp_send_json_success($this->miniatura($nombre, $_FILES['archivo']));
                    break;
                default:
                    wp_send_json_error('motor:op:invalido:' . $op);
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}
