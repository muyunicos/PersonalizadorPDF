<?php
if (!defined('ABSPATH')) {
    exit;
}

/**
 * PMU_Galeria - Ayudante puro de miniaturas y sprites (Const. II / R1 de
 * specs/006-align-textmuy-motor/research.md).
 *
 * SIN rutas propias, SIN catalogos, SIN dispatcher: todo dato (directorio,
 * archivo subido, dimensiones de celda) lo recibe por parametros desde
 * PMU_Uploads, el unico dueno de la verdad de almacenamiento.
 */
class PMU_Galeria
{
    const SPRITE_MAX_BYTES = 4194304;   // 4 MB
    const MINIATURA_MAX_BYTES = 512000; // 500 KB

    /** Celda del recurso id dentro del sprite: x/y/w/h en pixeles.
     *  Disposicion: col=(id-1)%c, fila=floor((id-1)/c). */
    public function celda($id, $dims)
    {
        $w = max(1, (int)($dims['w'] ?? 100));
        $h = max(1, (int)($dims['h'] ?? 100));
        $c = max(1, (int)($dims['c'] ?? 8));
        $i = max(0, (int)$id - 1);
        return [
            'x' => ($i % $c) * $w,
            'y' => (int)floor($i / $c) * $h,
            'w' => $w,
            'h' => $h,
        ];
    }

    /** Firma binaria WEBP (RIFF....WEBP). */
    public function es_webp($ruta)
    {
        $firma = (string)@file_get_contents($ruta, false, null, 0, 12);
        return strlen($firma) >= 12 && substr($firma, 0, 4) === 'RIFF' && substr($firma, 8, 4) === 'WEBP';
    }

    /**
     * Persiste el sprite unico thumbs.webp del ambito y limpia restos del
     * formato anterior (sprite.json / sprite.webp). $dir llega resuelto y
     * saneado por el motor. Devuelve la ruta final.
     */
    public function sprite($dir, $file)
    {
        $op = 'sprite';
        if (!is_dir($dir) || !wp_is_writable($dir)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        if (($file['size'] ?? 0) > self::SPRITE_MAX_BYTES) {
            throw new Exception('motor:' . $op . ':archivo:tamano');
        }
        if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || !$this->es_webp($file['tmp_name'])) {
            throw new Exception('motor:' . $op . ':archivo:formato');
        }
        $destino = $dir . DIRECTORY_SEPARATOR . 'thumbs.webp';
        if (!@move_uploaded_file($file['tmp_name'], $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        @unlink($dir . DIRECTORY_SEPARATOR . 'sprite.json'); // resto del formato anterior
        @unlink($dir . DIRECTORY_SEPARATOR . 'sprite.webp'); // resto del formato anterior
        return $destino;
    }

    /**
     * Persiste una miniatura individual {nombre}.webp dentro de $dir
     * (miniaturas de grupos de PDF en el ambito img). Devuelve el nombre final.
     */
    public function miniatura($dir, $nombre, $file)
    {
        $op = 'miniatura';
        if (($file['size'] ?? 0) > self::MINIATURA_MAX_BYTES) {
            throw new Exception('motor:' . $op . ':archivo:tamano');
        }
        if (($file['error'] ?? 1) !== UPLOAD_ERR_OK || !$this->es_webp($file['tmp_name'])) {
            throw new Exception('motor:' . $op . ':archivo:formato');
        }
        $nombre = preg_replace('/[^a-z0-9_\-]+/', '-', strtolower((string)$nombre));
        $nombre = trim((string)$nombre, '-');
        if ($nombre === '') {
            $nombre = 'thumb-' . uniqid();
        }
        if (!is_dir($dir)) {
            wp_mkdir_p($dir);
        }
        $destino = $dir . DIRECTORY_SEPARATOR . $nombre . '.webp';
        if (!@move_uploaded_file($file['tmp_name'], $destino)) {
            throw new Exception('motor:' . $op . ':directorio:no_escribible');
        }
        return $nombre . '.webp';
    }
}
