<?php
if (!defined('ABSPATH')) {
    exit;
}

if (!class_exists('PMU_Lectura')) {
    require_once __DIR__ . '/class-pmu-lectura.php';
}

/**
 * PMU_Media - configuracion, credencial de lectura y URLs del camino liviano (spec 042).
 *
 * No sirve bytes: solo emite la configuracion que usa media.php y las cookies que
 * identifican al comprador. Las escrituras siguen en PMU_Uploads/admin-post.
 */
class PMU_Media
{
    const COOKIE_UID = 'pmu_uid';
    const DIAS_UID = 7;

    private $uploads;
    private $config = null;

    public function __construct($uploads)
    {
        $this->uploads = $uploads;
    }

    private function config_dir()
    {
        $base = rtrim((string)$this->uploads->dir_pmu(false), '/\\');
        return $base . DIRECTORY_SEPARATOR . '.media';
    }

    private function config_ruta()
    {
        return $this->config_dir() . DIRECTORY_SEPARATOR . 'config.json';
    }

    /** Config vigente (sin crear). Devuelve null si falta o es invalida. */
    public function config()
    {
        if (is_array($this->config)) {
            return $this->config;
        }
        $ruta = $this->config_ruta();
        if ($ruta === '' || !is_file($ruta)) {
            return null;
        }
        $datos = json_decode((string)@file_get_contents($ruta), true);
        if (!is_array($datos)
            || (int)($datos['version'] ?? 0) !== 1
            || empty($datos['base'])
            || empty($datos['secret'])
            || !is_dir($datos['base'])
            || preg_match('/^[a-f0-9]{64}$/', (string)$datos['secret']) !== 1) {
            return null;
        }
        $this->config = $datos;
        return $this->config;
    }

    /**
     * Crea (una sola vez) `uploads/pmu/.media/config.json` con base + secreto.
     * Devuelve null si no puede garantizar el `.htaccess` de privacidad.
     */
    public function config_crear()
    {
        $base = rtrim((string)$this->uploads->dir_pmu(true), '/\\');
        $dir = $base . DIRECTORY_SEPARATOR . '.media';
        if (!is_dir($dir) && !wp_mkdir_p($dir)) {
            return null;
        }
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            return null;
        }
        $htaccess = $dir . DIRECTORY_SEPARATOR . '.htaccess';
        if (!is_file($htaccess)) {
            $regla = "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n"
                . "<IfModule !mod_authz_core.c>\nOrder allow,deny\nDeny from all\n</IfModule>\n";
            if (@file_put_contents($htaccess, $regla) === false) {
                return null;
            }
        }
        $baseReal = realpath($base);
        if ($baseReal === false) {
            return null;
        }
        $prev = $this->config();
        if (is_array($prev) && (string)$prev['base'] === $baseReal) {
            return $prev;
        }
        $secret = is_array($prev) && preg_match('/^[a-f0-9]{64}$/', (string)$prev['secret']) === 1
            ? (string)$prev['secret']
            : bin2hex(random_bytes(32));
        $datos = ['version' => 1, 'base' => $baseReal, 'secret' => $secret, 'creado' => time()];
        $json = json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            return null;
        }
        $ruta = $dir . DIRECTORY_SEPARATOR . 'config.json';
        $tmp = $ruta . '.tmp';
        if (@file_put_contents($tmp, $json) === false) {
            return null;
        }
        if (!@rename($tmp, $ruta)) {
            @unlink($tmp);
            return null;
        }
        @chmod($ruta, 0600);
        $this->config = $datos;
        return $this->config;
    }

    /** uid de la credencial `pmu_uid`, o 0. */
    public function cookie_uid_valida()
    {
        if (empty($_COOKIE[self::COOKIE_UID])) {
            return 0;
        }
        $config = $this->config();
        if (!is_array($config) || empty($config['secret'])) {
            return 0;
        }
        return (int)PMU_Lectura::uid_de_cookie((string)$_COOKIE[self::COOKIE_UID], (string)$config['secret']);
    }

    /** Emite/renueva `pmu_uid` para un cliente. Devuelve el uid o 0. */
    public function cookie_uid_emitir($uid = 0)
    {
        $uid = (int)$uid;
        if ($uid <= 0 && function_exists('get_current_user_id')) {
            $uid = (int)get_current_user_id();
        }
        if ($uid <= 0) {
            return 0;
        }
        $config = $this->config_crear();
        if (!is_array($config) || empty($config['secret'])) {
            return 0;
        }
        $seg = defined('DAY_IN_SECONDS') ? DAY_IN_SECONDS : 86400;
        $exp = time() + self::DIAS_UID * $seg;
        $valor = PMU_Lectura::firmar_uid($uid, $exp, (string)$config['secret']);
        $secure = function_exists('is_ssl')
            ? is_ssl()
            : (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        if (!headers_sent()) {
            setcookie(self::COOKIE_UID, $valor, [
                'expires' => $exp,
                'path' => '/',
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => $secure,
            ]);
        }
        $_COOKIE[self::COOKIE_UID] = $valor;
        return $uid;
    }

    /** Borra `pmu_uid` (logout). */
    public function cookie_uid_borrar()
    {
        $secure = function_exists('is_ssl')
            ? is_ssl()
            : (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
        if (!headers_sent()) {
            setcookie(self::COOKIE_UID, '', [
                'expires' => time() - 3600,
                'path' => '/',
                'httponly' => true,
                'samesite' => 'Lax',
                'secure' => $secure,
            ]);
        }
        unset($_COOKIE[self::COOKIE_UID]);
    }

    /** Identidad de cache (`u{uid}` / `s{sha8}`). */
    public function identidad($uid = 0, $sid = '')
    {
        return PMU_Lectura::identidad($uid, $sid);
    }

    /** Revision de la biblioteca de la identidad (mtime + ids), o ''. */
    public function revision($uid = 0, $sid = '')
    {
        $uid = (int)$uid;
        if ($uid <= 0 && (string)$sid === '') {
            return '';
        }
        $dir = $uid > 0
            ? $this->uploads->dir_order_uploads((string)$uid, false)
            : $this->uploads->dir_sesion_uploads($sid, false);
        $cat = PMU_Lectura::catalogo_leer($dir);
        if (!is_array($cat) || !isset($cat['items']) || !is_array($cat['items'])) {
            return '';
        }
        return PMU_Lectura::revision(PMU_Lectura::ruta_catalogo($dir), $cat['items']);
    }

    /** URL del endpoint liviano `media.php`. */
    public function url_lista()
    {
        if (!function_exists('plugins_url')) {
            return '';
        }
        $plugin = defined('PERSONALIZADOR_PDF_PATH')
            ? PERSONALIZADOR_PDF_PATH . 'personalizador-pdf.php'
            : __DIR__ . '/../personalizador-pdf.php';
        return plugins_url('media.php', $plugin);
    }

    /** URL de una imagen del camino liviano (sin nonce; la cookie autoriza). */
    public function url_imagen($id, $identidad)
    {
        return add_query_arg([
            'op' => 'imagen',
            'u' => (string)$identidad,
            'id' => (string)$id,
        ], $this->url_lista());
    }

    /** true si el camino liviano esta configurado y protegido. */
    public function habilitado()
    {
        $config = $this->config();
        if (!is_array($config) || empty($config['base']) || empty($config['secret'])) {
            return false;
        }
        $dir = rtrim((string)$config['base'], '/\\') . DIRECTORY_SEPARATOR . '.media';
        return is_dir($dir) && is_file($dir . DIRECTORY_SEPARATOR . '.htaccess');
    }
}