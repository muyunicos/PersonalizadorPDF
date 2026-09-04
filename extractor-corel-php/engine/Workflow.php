<?php
/**
 * Workflow - Orquesta el pipeline completo del Extractor Corel en PHP:
 *
 *   1. analizar   -> Pdf + Detector + guardar metadata.json
 *   2. crearMarcos -> PNG transparentes por grupo (PngWriter)
 *   3. reemplazar  -> Overlay (superpone marcos) y guarda el PDF final
 *
 * Uso desde CLI o desde el plugin de WordPress.
 *
 * @package  ExtractCorel\Engine
 */

namespace ExtractCorel\Engine;

class Workflow
{
    private $dirMarcos;

    public function __construct($dirMarcos = 'marcos')
    {
        $this->dirMarcos = rtrim((string)$dirMarcos, '/\\');
    }

    public function getDirMarcos()
    {
        return $this->dirMarcos;
    }

    /** Paso 1: detecta grupos, guarda metadatos, devuelve el resumen. */
    public function analizar($rutaPdf)
    {
        if (!is_file($rutaPdf)) {
            throw new \RuntimeException("PDF no encontrado: $rutaPdf");
        }
        $nombre = Metadata::nombreDesdeArchivo($rutaPdf);
        $pdf = new Pdf((string)file_get_contents($rutaPdf));
        $pdf->load();
        $detector = new Detector($pdf);
        $resultado = $detector->analizarPdf();
        $grupos = $resultado['grupos'];
        if (!$grupos) {
            throw new \RuntimeException(
                'No se detectaron placeholders. Asegurate de exportar desde Corel con rectangulos 100% transparentes en las posiciones de los nombres.'
            );
        }
        $datos = Metadata::generar($nombre, $grupos);
        Metadata::guardar($datos, Metadata::rutaMetadata($nombre, $this->dirMarcos));
        $totalInstancias = 0;
        foreach ($grupos as $g) {
            $totalInstancias += $g['num_instancias'];
        }
        return [
            'nombre_pdf' => $nombre,
            'total_paginas' => $resultado['total_paginas'],
            'total_grupos' => count($grupos),
            'total_instancias' => $totalInstancias,
            'grupos' => $grupos,
        ];
    }

    /** Paso 2: genera (o reutiliza) los PNG transparentes por grupo. */
    public function crearMarcos($nombrePdf)
    {
        $rutaMeta = Metadata::rutaMetadata($nombrePdf, $this->dirMarcos);
        if (!is_file($rutaMeta)) {
            throw new \RuntimeException("Metadatos no encontrados: $rutaMeta");
        }
        $datos = Metadata::cargar($rutaMeta);
        $rutas = [];
        foreach ($datos['grupos'] as $g) {
            $dir = $this->dirMarcos . DIRECTORY_SEPARATOR . $nombrePdf;
            $ruta = $dir . DIRECTORY_SEPARATOR . $g['letra'] . '-' . $g['ancho_px'] . 'x' . $g['alto_px'] . '.png';
            $valido = false;
            if (is_file($ruta)) {
                $info = @getimagesize($ruta);
                $valido = $info && $info[0] === (int)$g['ancho_px'] && $info[1] === (int)$g['alto_px'];
            }
            if (!$valido) {
                if (!is_dir($dir)) {
                    mkdir($dir, 0775, true);
                }
                PngWriter::write($ruta, $g['ancho_px'], $g['alto_px']);
            }
            $rutas[] = $ruta;
        }
        return $rutas;
    }

    /** Paso 3: superpone los marcos y guarda el PDF final. */
    public function reemplazar($rutaPdf, $salida = null)
    {
        if (!is_file($rutaPdf)) {
            throw new \RuntimeException("PDF no encontrado: $rutaPdf");
        }
        $nombre = Metadata::nombreDesdeArchivo($rutaPdf);
        $data = (string)file_get_contents($rutaPdf);
        $overlay = new Overlay($data);
        $pdf = new Pdf($data);
        $pdf->load();
        $detector = new Detector($pdf);
        $resultado = $detector->analizarPdf();
        if (!$resultado['grupos']) {
            throw new \RuntimeException('No se detectaron placeholders. Asegurate de exportar desde Corel con rectangulos 100% transparentes.');
        }
        $out = $overlay->build($resultado['grupos']);
        $salida = $salida ?: $nombre . '_procesado.pdf';
        $dirSalida = dirname($salida);
        if ($dirSalida && !is_dir($dirSalida)) {
            mkdir($dirSalida, 0775, true);
        }
        file_put_contents($salida, $out);
        $resumen = [
            'grupos_totales' => count($resultado['grupos']),
            'grupos_aplicados' => array_map(function ($g) {
                return $g['letra'];
            }, $resultado['grupos']),
            'grupos_sin_marco' => [],
            'marcos_insertados' => $resultado['total_instancias'] ?? 0,
        ];
        return ['archivo' => $salida, 'bytes' => strlen($out), 'resumen' => $resumen];
    }

    /** Pipeline completo: analizar + marcos + reemplazar. */
    public function proceso($rutaPdf, $salida = null)
    {
        $res = $this->analizar($rutaPdf);
        $this->crearMarcos($res['nombre_pdf']);
        return $this->reemplazar($rutaPdf, $salida);
    }
}