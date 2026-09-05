<?php
/**
 * Motor - Motor principal del Extractor Corel.
 *
 * Recibe un PDF, un conjunto de datos (dataset de metadatos) y un conjunto de
 * imagenes reales (una por grupo: letra => ruta). Vuelve a detectar los
 * placeholders para garantizar consistencia, valida que el dataset coincida
 * con el PDF, encaja cada imagen (contain) en el tamano del grupo y superpone
 * los resultados. Devuelve los bytes del PDF editado.
 *
 * Los grupos SIN imagen se dejan intactos: el PDF conserva sus rectangulos
 * originales en esas zonas y el resumen lo informa.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Motor
{
    /**
     * Procesa el PDF y devuelve el PDF editado.
     *
     * @param string     $rutaPdf        ruta del PDF de entrada
     * @param array|null $datos          dataset (contenido de metadata.json) o null
     * @param array      $rutasImagenes  mapa letra => ruta de imagen real
     * @return array ['bytes'=>string, 'grupos'=>array, 'resumen'=>array]
     */
    public static function procesar($rutaPdf, $datos, array $rutasImagenes)
    {
        if (!is_file($rutaPdf)) {
            throw new \RuntimeException("PDF no encontrado: $rutaPdf");
        }
        if (!$rutasImagenes) {
            throw new \RuntimeException('No hay imagenes cargadas: carga al menos una imagen de grupo antes de procesar.');
        }
        $data = (string)file_get_contents($rutaPdf);
        $pdf = new Pdf($data);
        $pdf->load();
        $detector = new Detector($pdf);
        $resultado = $detector->analizarPdf();
        $grupos = $resultado['grupos'];
        if (!$grupos) {
            throw new \RuntimeException(
                'No se detectaron placeholders. Asegurate de exportar desde Corel con rectangulos 100% transparentes.'
            );
        }
        if ($datos !== null) {
            self::validarDataset($datos, $grupos);
        }

        $especificaciones = [];
        $sinImagen = [];
        foreach ($grupos as $g) {
            $letra = $g['letra'];
            $ruta = isset($rutasImagenes[$letra]) ? $rutasImagenes[$letra] : null;
            if (!$ruta || !is_file($ruta)) {
                $sinImagen[] = $letra;
                continue;
            }
            $especificaciones[$letra] = Imagen::normalizar($ruta, (int)$g['ancho_px'], (int)$g['alto_px']);
        }
        if (!$especificaciones) {
            throw new \RuntimeException(
                'Ninguno de los grupos tiene imagen cargada (' . implode(', ', $sinImagen) . ').'
            );
        }

        $overlay = new Overlay($data);
        $bytes = $overlay->build($grupos, $especificaciones);

        $insertadas = 0;
        foreach ($grupos as $g) {
            if (isset($especificaciones[$g['letra']])) {
                $insertadas += (int)$g['num_instancias'];
            }
        }
        return [
            'bytes' => $bytes,
            'grupos' => $grupos,
            'resumen' => [
                'grupos_totales' => count($grupos),
                'grupos_aplicados' => array_keys($especificaciones),
                'grupos_sin_imagen' => $sinImagen,
                'imagenes_insertadas' => $insertadas,
                'bytes' => strlen($bytes),
            ],
        ];
    }

    /**
     * Verifica que el dataset guardado siga describiendo el mismo PDF
     * (mismos grupos, letras, tamanos y cantidades de instancias).
     */
    public static function validarDataset($datos, array $grupos)
    {
        $esperados = isset($datos['grupos']) && is_array($datos['grupos']) ? $datos['grupos'] : null;
        if ($esperados === null || count($esperados) !== count($grupos)) {
            throw new \RuntimeException(
                'Los datos guardados no coinciden con el PDF (cantidad de grupos distinta). Re-analiza el PDF.'
            );
        }
        foreach ($grupos as $i => $g) {
            $e = isset($esperados[$i]) && is_array($esperados[$i]) ? $esperados[$i] : [];
            $mismo = isset($e['letra'], $e['ancho_px'], $e['alto_px'], $e['num_instancias'])
                && $e['letra'] === $g['letra']
                && (int)$e['ancho_px'] === (int)$g['ancho_px']
                && (int)$e['alto_px'] === (int)$g['alto_px']
                && (int)$e['num_instancias'] === (int)$g['num_instancias'];
            if (!$mismo) {
                $letraE = isset($e['letra']) ? $e['letra'] : '?';
                throw new \RuntimeException(
                    "Los datos guardados no coinciden con el PDF (grupo {$g['letra']}, esperado $letraE). Re-analiza el PDF."
                );
            }
        }
    }
}