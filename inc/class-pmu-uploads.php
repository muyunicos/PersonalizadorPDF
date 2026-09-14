<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * PMU_Uploads - Motor unico de cargas y gestion de recursos.
 * Delega operaciones de miniatura/sprite a PMU_Galeria.
 */
class PMU_Uploads
{
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
    private static $AMBITOS = ['fonts', 'img', 'pdfs', 'orders', 'tmp', 'tm-presets'];

    private $thumbs = [
        'fonts' => ['w' => 180, 'h' => 30, 'c' => 4],
        'img' => ['w' => 100, 'h' => 100, 'c' => 8],
        'tm-presets' => ['w' => 200, 'h' => 100, 'c' => 4],
    ];

    private $urls = [
        'fonts' => 'fonts/',
        'img' => 'img/',
        'pdfs' => 'pdfs/',
        'orders' => 'orders/',
        'tmp' => 'tmp/',
        'tm-presets' => 'tm-presets/',
    ];

    private $dirs = [
        'fonts' => 'fonts',
        'img' => 'img',
        'pdfs' => 'pdfs',
        'orders' => 'orders',
        'tmp' => 'tmp',
        'tm-presets' => 'tm-presets',
    ];

    public function dir_pmu($crear = false)
    {
        $upload_dir = wp_upload_dir();
        $dir = trailingslashit($upload_dir['basedir']) . 'pmu';
        if (($crear || !is_dir($dir)) && !is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        return $dir;
    }

    public function dir_ambito($ambito, $crear = false)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:dir_ambito:ambito:invalido');
        }
        return $this->dir_pmu($crear) . DIRECTORY_SEPARATOR . $this->dirs[$ambito];
    }

    public function url_ambito($ambito)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:url_ambito:ambito:invalido');
        }
        $upload_dir = wp_upload_dir();
        return trailingslashit($upload_dir['baseurl']) . 'pmu/' . $this->urls[$ambito];
    }

    public function ruta_catalogo($ambito)
    {
        return $this->dir_ambito($ambito) . DIRECTORY_SEPARATOR . $ambito . '.json';
    }

    public function catalogo($ambito)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:catalogo:ambito:invalido');
        }
        $thumbs = $this->thumbs[$ambito] ?? ['w' => 100, 'h' => 100, 'c' => 8];
        $cat = ['thumbs' => $thumbs, 'items' => []];
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
        );
    }

    public function tupla_alta($ambito)
    {
        $cat = $this->catalogo($ambito);
        $max_id = 0;
        foreach ($cat['items'] as $item) {
            if (is_array($item) && isset($item[0]) && is_int($item[0]) && $item[0] > $max_id) {
                $max_id = $item[0];
            }
        }
        return $max_id + 1;
    }

    public function tupla_baja($ambito, $id)
    {
        $cat = $this->catalogo($ambito);
        foreach ($cat['items'] as &$item) {
            if (is_array($item) && isset($item[0]) && $item[0] == $id) {
                $item = [$id, '', ''];
                break;
            }
        }
        $this->guardar_catalogo($ambito, $cat);
    }

    public function listar($ambito)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:listar:ambito:invalido');
        }
        $cat = $this->catalogo($ambito);
        $items = [];
        $dir = $this->dir_ambito($ambito);
        foreach ($cat['items'] as $item) {
            if (!is_array($item) || !isset($item[0]) || !is_int($item[0])) continue;
            $id = $item[0];
            $title = $item[1] ?? '';
            $cats = $item[2] ?? '';
            $file = $item[3] ?? '';
            $url = '';
            if ($file !== '') {
                $ruta_fisica = $dir . DIRECTORY_SEPARATOR . $file;
                if (is_file($ruta_fisica)) {
                    $url = $this->url_ambito($ambito) . rawurlencode($file);
                }
            }
            $items[] = ['id' => $id, 'title' => $title, 'cats' => $cats, 'file' => $file, 'url' => $url, 'thumb' => '', 'enUso' => false];
        }
        return ['catalogo' => $cat, 'items' => $items];
    }

    public function alta($ambito, $title, $cats, $file)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:alta:ambito:invalido');
        }
        if ($title === '' || $file === '') {
            throw new Exception('motor:alta:falta:title|file');
        }
        $id = $this->tupla_alta($ambito);
        $cat = $this->catalogo($ambito);
        $cat['items'][] = [$id, $title, $cats, $file];
        $this->guardar_catalogo($ambito, $cat);
        return ['id' => $id, 'nombre' => $file];
    }

    public function baja($ambito, $id)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:baja:ambito:invalido');
        }
        $this->tupla_baja($ambito, $id);
        return ['id' => $id];
    }

    public function editar($ambito, $id, $nuevo)
    {
        if (!in_array($ambito, self::$AMBITOS, true)) {
            throw new Exception('motor:editar:ambito:invalido');
        }
        $cat = $this->catalogo($ambito);
        foreach ($cat['items'] as &$item) {
            if (is_array($item) && isset($item[0]) && $item[0] == $id) {
                if (isset($nuevo['title'])) $item[1] = $nuevo['title'];
                if (isset($nuevo['cats'])) $item[2] = $nuevo['cats'];
                if (isset($nuevo['file'])) {
                    $dir = $this->dir_ambito($ambito);
                    $file_antiguo = $item[3] ?? '';
                    if ($file_antiguo !== '' && $file_antiguo !== $nuevo['file']) {
                        $ruta_antigua = $dir . DIRECTORY_SEPARATOR . $file_antiguo;
                        $ruta_nueva = $dir . DIRECTORY_SEPARATOR . $nuevo['file'];
                        if (is_file($ruta_antigua)) rename($ruta_antigua, $ruta_nueva);
                    }
                    $item[3] = $nuevo['file'];
                }
                break;
            }
        }
        $this->guardar_catalogo($ambito, $cat);
        return ['id' => $id, 'nombre' => $item[3] ?? ''];
    }

    public function handle_request()
    {
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
                    if (!isset($_POST['ambito'])) wp_send_json_error('motor:listar:falta:ambito');
                    wp_send_json_success($this->listar($_POST['ambito']));
                    break;
                case 'alta':
                    if (!isset($_POST['ambito'], $_POST['title'])) wp_send_json_error('motor:alta:falta:ambito|title');
                    wp_send_json_success($this->alta($_POST['ambito'], (string)$_POST['title'], (string)($_POST['cats'] ?? ''), (string)($_POST['file'] ?? '')));
                    break;
                case 'baja':
                    if (!isset($_POST['ambito'], $_POST['id'])) wp_send_json_error('motor:baja:falta:ambito|id');
                    wp_send_json_success($this->baja($_POST['ambito'], (int)$_POST['id']));
                    break;
                case 'editar':
                    if (!isset($_POST['ambito'], $_POST['id'])) wp_send_json_error('motor:editar:falta:ambito|id');
                    $nuevo = [];
                    if (isset($_POST['title'])) $nuevo['title'] = (string)$_POST['title'];
                    if (isset($_POST['cats'])) $nuevo['cats'] = (string)$_POST['cats'];
                    if (isset($_POST['file'])) $nuevo['file'] = (string)$_POST['file'];
                    wp_send_json_success($this->editar($_POST['ambito'], (int)$_POST['id'], $nuevo));
                    break;
                case 'sprite':
                    if (!isset($_POST['scope'])) {
                        wp_send_json_error('motor:sprite:falta:scope');
                    }
                    if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:sprite:falta:archivo');
                    }
                    wp_send_json_success($this->get_galeria()->sprite($_POST['scope'], $_FILES['archivo']));
                    break;
                case 'miniatura':
                    if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
                        wp_send_json_error('motor:miniatura:falta:archivo');
                    }
                    $nombre = (string)$_POST['nombre'] ?? '';
                    wp_send_json_success($this->get_galeria()->miniatura($nombre, $_FILES['archivo']));
                    break;
            }
        } catch (Exception $e) {
            wp_send_json_error($e->getMessage());
        }
    }
}
