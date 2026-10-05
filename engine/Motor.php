<?php
/**
 * Motor - Motor principal del Extractor Corel.
 *
 * Recibe un PDF, un conjunto de datos (dataset de metadatos) y un conjunto de
 * imagenes reales (una por grupo: id => ruta). Vuelve a detectar los
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
     * @param array|null $datos          dataset (contenido de analisis.json) o null
     * @param array      $rutasImagenes  mapa id => ruta de imagen real
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
        } else {
            // Sin dataset (pedidos tienda): el Motor confia en el mapa id => ruta
            // que ya trae PNGs al tamano exacto de cada grupo (render cliente).
            // Igual exige ids validos y tamanos positivos para fallar rapido.
            foreach ($grupos as $g) {
                if (!isset($g['id'], $g['w'], $g['h'], $g['cont'])
                    || !preg_match('/^[0-9A-F]{6}$/', (string)$g['id'])
                    || (int)$g['w'] < 1 || (int)$g['h'] < 1 || (int)$g['cont'] < 1) {
                    throw new \RuntimeException('Grupo invalido en el analisis (id/w/h/cont).');
                }
            }
        }

        $especificaciones = [];
        $sinImagen = [];
        $parciales = [];   // id => cuantas instancias quedaron sin foto (D17: informe, no error)
        $cuantas = [];     // id => cuantas imagenes se dibujan (multi o `cont`)
        foreach ($grupos as $g) {
            $id = $g['id'];
            $ruta = isset($rutasImagenes[$id]) ? $rutasImagenes[$id] : null;
            if (!$ruta) {
                $sinImagen[] = $id;
                continue;
            }
            // Spec 012 (T025, FR-039): `$rutasImagenes[$id]` puede ser UNA ruta
            // (comportamiento historico: la misma foto en todas las instancias) o
            // una LISTA (una por instancia). Se toma como maximo `cont`: sobran
            // no se dibujan y las instancias que quedan sin foto conservan su
            // transparencia, sin aviso y sin bloqueo (D17/D18/D19). Con `string`
            // el resultado es identico al de antes.
            $cont = max(1, (int) $g['cont']);
            // `string` = una foto replicada en todas las instancias (historico);
            // `array` = una por instancia. Ojo: una spec YA es un array, asi que
            // la distincion se lleva con la bandera `$multi` y nunca sniffando
            // el resultado (eso rompe el caso de una sola imagen por grupo).
            $multi = is_array($ruta);
            $lista = $multi ? array_values($ruta) : [$ruta];
            $specs = [];
            $rotas = 0;   // por grupo: cuantas rutas vinieron rotas o faltantes
            $quedan = $cont;
            foreach ($lista as $una) {
                if ($quedan <= 0) {
                    break;
                }
                if (!$una || !is_file($una)) {
                    $rotas++;
                    continue; // esa instancia queda sin foto: hueco transparente
                }
                $specs[] = Imagen::normalizar($una, (int) $g['w'], (int) $g['h']);
                $quedan--;
            }
            if (!$specs) {
                    $sinImagen[] = $id;
                    continue;
                }
            if ($rotas > 0 || ($multi && count($specs) < $cont)) {
                $parciales[$id] = $cont - count($specs);
            }
            $especificaciones[$id] = $multi ? $specs : $specs[0];
            $cuantas[$id] = $multi ? count($specs) : $cont;
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
            if (isset($especificaciones[$g['id']])) {
                // `$cuantas` ya lo calculo el bucle de specs: con lista, una por
                // instancia servida; con scalar, todas (`cont`).
                $insertadas += (int) $cuantas[$g['id']];
            }
        }
        return [
            'bytes' => $bytes,
            'grupos' => $grupos,
            'resumen' => [
                'grupos_totales' => count($grupos),
                'grupos_aplicados' => array_keys($especificaciones),
                'grupos_sin_imagen' => $sinImagen,
                // Spec 012 (D17/D18/D19): grupos con menos fotos que instancias.
                // Es un INFORME, nunca un error: los huecos sobrantes salen
                // transparentes y la compra no se bloquea.
                'grupos_parciales' => $parciales,
                'imagenes_insertadas' => $insertadas,
                'bytes' => strlen($bytes),
            ],
        ];
    }

    /**
     * Verifica que el dataset guardado siga describiendo el mismo PDF
     * (mismos grupos, ids, tamanos y cantidades de instancias).
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
            $mismo = isset($e['id'], $e['w'], $e['h'], $e['cont'])
                && $e['id'] === $g['id']
                && (int)$e['w'] === (int)$g['w']
                && (int)$e['h'] === (int)$g['h']
                && (int)$e['cont'] === (int)$g['cont'];
            if (!$mismo) {
                $idE = isset($e['id']) ? $e['id'] : '?';
                throw new \RuntimeException(
                    "Los datos guardados no coinciden con el PDF (grupo {$g['id']}, esperado $idE). Re-analiza el PDF."
                );
            }
        }
    }

    /**
     * Motor rapido tienda: PDF + mapa id => ruta PNG (tamano exacto por grupo)
     * -> PDF editado. Sin dataset: no hay paridad que validar (los PNG ya
     * vienen renderizados por el cliente). Devuelve el resumen del Motor.
     */
    /**
     * Procesa el pedido desde el pool del item. `$mapaIdRuta` acepta UNA ruta
     * por grupo (comportamiento historico: se replica en todas las instancias)
     * o una LISTA (una por instancia, spec 012 T027).
     */
    public static function procesar_pedido($rutaPdf, array $mapaIdRuta)
    {
        if (!$mapaIdRuta) {
            throw new \RuntimeException('Sin imagenes para procesar el pedido.');
        }
        $canon = [];
        foreach ($mapaIdRuta as $id => $ruta) {
            $id = strtoupper((string)$id);
            if (!preg_match('/^[0-9A-F]{6}$/', $id)) {
                throw new \RuntimeException('Id de grupo invalido en el pedido: ' . $id);
            }
            $lista = is_array($ruta) ? array_values($ruta) : [$ruta];
            $ok = [];
            foreach ($lista as $una) {
                if (!is_string($una) || !is_file($una)) {
                    throw new \RuntimeException('Falta el PNG del grupo ' . $id . ' en el pedido.');
                }
                $ok[] = $una;
            }
            if (!$ok) {
                throw new \RuntimeException('Falta el PNG del grupo ' . $id . ' en el pedido.');
            }
            // Una sola ruta = replica (historico); varias = una por instancia.
            $canon[$id] = count($ok) === 1 ? $ok[0] : $ok;
        }
        return self::procesar($rutaPdf, null, $canon);
    }
}
