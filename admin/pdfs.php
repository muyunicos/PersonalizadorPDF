<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Extractor_Corel_Plugin $this */

$get = wp_unslash($_GET);
$post_url = admin_url('admin-post.php');
$url_tab = admin_url('admin.php?page=extractor-corel&tab=pdfs');

$pdfs = $this->pdfs_subidos();
$seleccionado = isset($get['ec_pdf']) ? sanitize_file_name($get['ec_pdf']) : '';
if ($seleccionado === '' && $pdfs) {
    $seleccionado = $pdfs[0];
}
if ($seleccionado !== '' && !in_array($seleccionado, $pdfs, true)) {
    $seleccionado = '';
}

$datos = $seleccionado ? $this->dataset_de($this->nombre_de($seleccionado)) : null;
$imagenes = $seleccionado ? $this->imagenes_de($this->nombre_de($seleccionado)) : [];
$salida_ok = $seleccionado ? is_file($this->ruta_salida($this->nombre_de($seleccionado))) : false;

$link_desc = function ($tipo, array $extra = []) use ($post_url) {
    $params = array_merge(['action' => 'extractor_corel_descargar', 'tipo' => $tipo], $extra);
    return wp_nonce_url($post_url . '?' . http_build_query($params), 'extractor_corel_descargar');
};
$link_ver = function ($tipo, array $extra = []) use ($post_url) {
    $params = array_merge(['action' => 'extractor_corel_ver', 'tipo' => $tipo], $extra);
    return wp_nonce_url($post_url . '?' . http_build_query($params), 'extractor_corel_ver');
};

$error = isset($get['ec_error']) ? rawurldecode((string)$get['ec_error']) : '';
$proceso = $get['ec_procesado'] ?? null ? get_transient('extractor_corel_proceso') : null;
?>
<?php if ($error) : ?>
    <div class="notice notice-error"><p><strong>Error:</strong> <?php echo esc_html($error); ?></p></div>
<?php endif; ?>

<?php if (isset($get['ec_subido'])) : ?>
    <div class="notice notice-success"><p>
        <strong>PDF analizado:</strong> <?php echo esc_html((string)$get['ec_pdf']); ?>
        — <?php echo (int)$get['grupos']; ?> grupo(s), <?php echo (int)$get['instancias']; ?> instancia(s).
        Carga una imagen para cada grupo y pulsa <em>Procesar</em>.
    </p></div>
<?php elseif (isset($get['ec_reanalizado'])) : ?>
    <div class="notice notice-success"><p><strong>Datos regenerados</strong> para <?php echo esc_html((string)$get['ec_pdf']); ?>.</p></div>
<?php elseif (isset($get['ec_borrado'])) : ?>
    <div class="notice notice-success"><p><strong>PDF eliminado</strong> con sus datos, imagenes y salida.</p></div>
<?php elseif (isset($get['ec_imagen'])) : ?>
    <div class="notice notice-success"><p><strong>Imagen guardada</strong> para el grupo.</p></div>
<?php elseif (isset($get['ec_imagen_quitada'])) : ?>
    <div class="notice notice-success"><p><strong>Imagen quitada</strong> del grupo.</p></div>
<?php endif; ?>

<?php if ($proceso) : ?>
    <div class="notice notice-success ec-proceso">
        <p><strong>PDF procesado:</strong> <?php echo esc_html($proceso['archivo'] ?? ''); ?></p>
        <p>
            Grupos aplicados: <strong><?php echo esc_html(implode(', ', $proceso['grupos_aplicados'] ?: ['-'])); ?></strong>
            — Imagenes insertadas: <strong><?php echo (int)($proceso['imagenes_insertadas'] ?? 0); ?></strong>
            <?php if (!empty($proceso['grupos_sin_imagen'])) : ?>
                — <span class="ec-aviso">Sin imagen (quedaron como estaban):
                <strong><?php echo esc_html(implode(', ', $proceso['grupos_sin_imagen'])); ?></strong></span>
            <?php endif; ?>
        </p>
        <?php if (!empty($proceso['archivo'])) : ?>
            <p><a class="button button-primary"
                href="<?php echo esc_url($link_desc('salida', ['archivo' => $proceso['archivo']])); ?>">
                Descargar PDF procesado</a></p>
        <?php endif; ?>
    </div>
<?php endif; ?>

<?php if (isset($get['ec_pregunta']) && $get['ec_pregunta'] === 'nombre') : ?>
    <div class="notice notice-warning ec-pregunta">
        <p>
            <strong>Ya existe un PDF llamado "<?php echo esc_html((string)($get['nombre'] ?? '')); ?>".</strong>
            Volve a seleccionar el archivo y elegi que hacer:
            <button type="button" class="button ec-modo" data-modo="renombrar">Renombrar automaticamente</button>
            <button type="button" class="button ec-modo" data-modo="sobrescribir">Sobrescribir (regenera datos)</button>
        </p>
    </div>
<?php endif; ?>

<div class="card">
    <h2>1. Subir PDF</h2>
    <form class="ec-form-subir" method="post" action="<?php echo esc_url($post_url); ?>" enctype="multipart/form-data">
        <input type="hidden" name="action" value="extractor_corel_subir_pdf">
        <input type="hidden" name="modo" value="">
        <?php wp_nonce_field('extractor_corel_subir_pdf'); ?>
        <p>
            <input type="file" name="pdf" accept="application/pdf" required>
            <?php submit_button('Subir y analizar', 'primary', 'submit', false); ?>
        </p>
        <p class="description">
            PDF exportado desde Corel con rectangulos 100% transparentes. Al subirlo se detectan los grupos
            de color y se generan los datos y los placeholders descargables.
            Limite: <?php echo esc_html(size_format(wp_max_upload_size())); ?>.
        </p>
    </form>
</div>
<?php if ($pdfs) : ?>

<div class="card">
    <h2>2. PDFs subidos</h2>
    <table class="widefat striped ec-tabla">
        <thead>
        <tr>
            <th>Archivo</th>
            <th>Grupos</th>
            <th>Instancias</th>
            <th>Acciones</th>
        </tr>
        </thead>
        <tbody>
        <?php foreach ($pdfs as $archivo) :
            $n = $this->nombre_de($archivo);
            $d = $this->dataset_de($n);
            $cantG = $d ? (int)($d['total_grupos'] ?? 0) : 0;
            $cantI = 0;
            if ($d) {
                foreach (($d['grupos'] ?? []) as $gg) {
                    $cantI += (int)($gg['num_instancias'] ?? 0);
                }
            }
            $esSel = $archivo === $seleccionado;
        ?>
        <tr class="<?php echo $esSel ? 'ec-fila-activa' : ''; ?>">
            <td>
                <a href="<?php echo esc_url(add_query_arg('ec_pdf', $archivo, $url_tab)); ?>">
                    <strong><?php echo esc_html($archivo); ?></strong>
                </a>
                <?php if (!$d) : ?><span class="ec-badge ec-badge-rojo">sin datos</span><?php endif; ?>
            </td>
            <td><?php echo $cantG ? (int)$cantG : '—'; ?></td>
            <td><?php echo $cantI ? (int)$cantI : '—'; ?></td>
            <td>
                <?php if (!$esSel) : ?>
                    <a class="button button-small" href="<?php echo esc_url(add_query_arg('ec_pdf', $archivo, $url_tab)); ?>">Seleccionar</a>
                <?php endif; ?>
                <a class="button button-small" href="<?php echo esc_url($link_desc('pdf', ['archivo' => $archivo])); ?>">Descargar</a>
                <form class="ec-form-inline ec-borrar" method="post" action="<?php echo esc_url($post_url); ?>">
                    <input type="hidden" name="action" value="extractor_corel_borrar">
                    <input type="hidden" name="archivo" value="<?php echo esc_attr($archivo); ?>">
                    <?php wp_nonce_field('extractor_corel_borrar'); ?>
                    <button type="submit" class="button button-small button-link-delete">Borrar</button>
                </form>
            </td>
        </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php if ($seleccionado) : ?>
<div class="card">
    <h2>3. Grupos e imagenes — <?php echo esc_html($seleccionado); ?></h2>

    <?php if (!$datos) : ?>
        <p class="ec-aviso">Este PDF no tiene datos analizados.</p>
        <form class="ec-form-inline" method="post" action="<?php echo esc_url($post_url); ?>">
            <input type="hidden" name="action" value="extractor_corel_reanalizar">
            <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
            <?php wp_nonce_field('extractor_corel_reanalizar'); ?>
            <button type="submit" class="button">Re-analizar</button>
        </form>
    <?php else : ?>
        <?php
        $grupos = $datos['grupos'] ?? [];
        $conImagen = 0;
        foreach ($grupos as $g) {
            if (isset($imagenes[$g['letra']])) {
                $conImagen++;
            }
        }
        ?>
        <p>
            <strong><?php echo count($grupos); ?></strong> grupo(s) de color —
            <strong><?php echo array_sum(array_map(function ($g) {
                return (int)($g['num_instancias'] ?? 0);
            }, $grupos)); ?></strong> instancias —
            <span class="ec-badge <?php echo $conImagen === count($grupos) ? 'ec-badge-verde' : 'ec-badge-amarillo'; ?>">
                <?php echo $conImagen; ?>/<?php echo count($grupos); ?> con imagen
            </span>
        </p>

        <p class="ec-acciones">
            <a class="button" href="<?php echo esc_url($link_desc('datos', ['archivo' => $seleccionado])); ?>">Descargar datos (JSON)</a>
            <form class="ec-form-inline" method="post" action="<?php echo esc_url($post_url); ?>">
                <input type="hidden" name="action" value="extractor_corel_reanalizar">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <?php wp_nonce_field('extractor_corel_reanalizar'); ?>
                <button type="submit" class="button">Re-analizar</button>
            </form>
        </p>

        <div class="ec-grupos">
        <?php foreach ($grupos as $g) :
            $letra = $g['letra'];
            $tiene = isset($imagenes[$letra]);
            $png = $letra . '-' . $g['ancho_px'] . 'x' . $g['alto_px'] . '.png';
        ?>
            <div class="ec-grupo" data-letra="<?php echo esc_attr($letra); ?>">
                <div class="ec-grupo-cab">
                    <span class="swatch" style="background: <?php echo esc_attr($g['color']); ?>"></span>
                    <h3>Grupo <?php echo esc_html(strtoupper($letra)); ?>
                        <span class="ec-badge" style="background:<?php echo esc_attr($g['color']); ?>"><?php echo esc_html($g['color']); ?></span>
                    </h3>
                </div>
                <p class="ec-datos-grupo">
                    Marco: <strong><?php echo (int)$g['ancho_px']; ?>x<?php echo (int)$g['alto_px']; ?> px</strong>
                    (<?php echo esc_html($g['ancho_pt']); ?>x<?php echo esc_html($g['alto_pt']); ?> pt) —
                    <?php echo (int)$g['num_instancias']; ?> instancia(s), pag.
                    <?php echo esc_html(implode(', ', array_map(function ($p) {
                        return (int)$p + 1;
                    }, $g['paginas'] ?? []))); ?>
                </p>

                <div class="ec-media">
                    <div class="ec-preview">
                        <?php if ($tiene) : ?>
                            <img src="<?php echo esc_url($link_ver('imagen', ['archivo' => $seleccionado, 'letra' => $letra])); ?>"
                                 alt="Imagen del grupo <?php echo esc_attr($letra); ?>">
                            <span class="ec-badge ec-badge-verde">Imagen cargada</span>
                        <?php else : ?>
                            <div class="ec-vacio">Sin imagen</div>
                            <span class="ec-badge ec-badge-rojo">Sin imagen</span>
                        <?php endif; ?>
                    </div>
                    <div class="ec-preview ec-checker">
                        <img src="<?php echo esc_url($link_ver('placeholder', ['archivo' => $seleccionado, 'png' => $png])); ?>"
                             alt="Placeholder <?php echo esc_attr($letra); ?>">
                        <a href="<?php echo esc_url($link_desc('placeholder', ['archivo' => $seleccionado, 'png' => $png])); ?>">
                            Descargar placeholder
                        </a>
                    </div>
                </div>

                <form class="ec-form-imagen" method="post" action="<?php echo esc_url($post_url); ?>" enctype="multipart/form-data">
                    <input type="hidden" name="action" value="extractor_corel_subir_imagen">
                    <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                    <input type="hidden" name="letra" value="<?php echo esc_attr($letra); ?>">
                    <input type="hidden" name="attachment_id" value="">
                    <?php wp_nonce_field('extractor_corel_subir_imagen'); ?>
                    <input type="file" name="imagen" accept="image/png,image/jpeg,image/gif,image/webp" class="ec-input-imagen">
                    <button type="submit" class="button button-small">Cargar imagen</button>
                    <button type="button" class="button button-small ec-galeria"
                            data-letra="<?php echo esc_attr($letra); ?>">Desde galeria</button>
                </form>

                <?php if ($tiene) : ?>
                <form class="ec-form-inline" method="post" action="<?php echo esc_url($post_url); ?>">
                    <input type="hidden" name="action" value="extractor_corel_quitar_imagen">
                    <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                    <input type="hidden" name="letra" value="<?php echo esc_attr($letra); ?>">
                    <?php wp_nonce_field('extractor_corel_quitar_imagen'); ?>
                    <button type="submit" class="button button-small button-link-delete">Quitar imagen</button>
                </form>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>

        <div class="ec-procesar">
            <form method="post" action="<?php echo esc_url($post_url); ?>">
                <input type="hidden" name="action" value="extractor_corel_procesar">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <?php wp_nonce_field('extractor_corel_procesar'); ?>
                <button type="submit" class="button button-primary button-hero"
                        <?php if ($conImagen === 0) : ?>disabled<?php endif; ?>>
                    Procesar PDF
                </button>
            </form>
            <p class="description">
                <?php if ($conImagen === 0) : ?>
                    Carga al menos una imagen de grupo para poder procesar.
                <?php else : ?>
                    Inserta la imagen de cada grupo en todos sus placeholders (encajado, sin deformar ni recortar).
                    <?php if ($conImagen < count($grupos)) : ?>
                        Ojo: <?php echo count($grupos) - $conImagen; ?> grupo(s) sin imagen quedaran como estan.
                    <?php endif; ?>
                    <?php if ($salida_ok) : ?>
                        — <a href="<?php echo esc_url($link_desc('salida', ['archivo' => $seleccionado])); ?>">Descargar el ultimo resultado</a>
                    <?php endif; ?>
                <?php endif; ?>
            </p>
        </div>
        </div>
    <?php endif; ?>
</div>
<?php endif; ?>

<?php else : ?>
<div class="card">
    <p>No hay PDFs subidos todavia. Empeza subiendo un PDF en el paso 1.</p>
</div>
<?php endif; ?>

<div class="ec-modal" hidden>
    <div class="ec-modal-caja">
        <p>Ya existe un PDF con ese nombre. ¿Que queres hacer?</p>
        <p>
            <button type="button" class="button ec-modal-btn" data-modo="renombrar">Renombrar automaticamente</button>
            <button type="button" class="button ec-modal-btn" data-modo="sobrescribir">Sobrescribir (regenera datos)</button>
            <button type="button" class="button button-link ec-modal-cancelar">Cancelar</button>
        </p>
    </div>
</div>