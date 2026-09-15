<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

$get = wp_unslash($_GET);
$post_url = admin_url('admin-post.php');
$url_tab = admin_url('admin.php?page=personalizador-pdf&tab=pdfs');

$pdfs = $this->pdfs_subidos();
$seleccionado = isset($get['ec_pdf']) ? sanitize_file_name($get['ec_pdf']) : '';
if ($seleccionado === '' && $pdfs) {
    $seleccionado = $pdfs[0];
}
if ($seleccionado !== '' && !in_array($seleccionado, $pdfs, true)) {
    $seleccionado = '';
}

$vista_pdf = $seleccionado ? $this->vista_grupos($this->nombre_de($seleccionado)) : null;
$datos = $vista_pdf ? $vista_pdf['analisis'] : null;
$imagenes = $seleccionado ? $this->imagenes_de($this->nombre_de($seleccionado)) : [];
$presets = [];
$aviso_presets = '';
if ($seleccionado) {
    try {
        $presets = $this->presets_base();
    } catch (\Throwable $e) {
        $aviso_presets = $e->getMessage(); // aviso no bloqueante (US1/FR-003)
    }
}
$salida_ok = $seleccionado ? is_file($this->ruta_salida($this->nombre_de($seleccionado))) : false;

$link_desc = function ($tipo, array $extra = []) use ($post_url) {
    $params = array_merge(['action' => 'personalizador_pdf_descargar', 'tipo' => $tipo], $extra);
    return wp_nonce_url($post_url . '?' . http_build_query($params), 'personalizador_pdf_descargar');
};
$link_ver = function ($tipo, array $extra = []) use ($post_url) {
    $params = array_merge(['action' => 'personalizador_pdf_ver', 'tipo' => $tipo], $extra);
    return wp_nonce_url($post_url . '?' . http_build_query($params), 'personalizador_pdf_ver');
};

$error = isset($get['ec_error']) ? rawurldecode((string)$get['ec_error']) : '';
$proceso = $get['ec_procesado'] ?? null ? get_transient('personalizador_pdf_proceso') : null;
?>
<?php if ($error) : ?>
    <div class="notice notice-error"><p><strong>Error:</strong> <?php echo esc_html($error); ?></p></div>
<?php endif; ?>
<?php if ($aviso_presets !== '') : ?>
    <div class="notice notice-warning"><p><strong>Aviso de recursos:</strong> <?php echo esc_html($aviso_presets); ?> (el selector de estilos queda vacio; el resto de la consola sigue operativa).</p></div>
<?php endif; ?>

<?php if (isset($get['ec_subido'])) : ?>
    <div class="notice notice-success"><p>
        <strong>PDF analizado:</strong> <?php echo esc_html((string)$get['ec_pdf']); ?>
        — <?php echo (int)$get['grupos']; ?> grupo(s), <?php echo (int)$get['instancias']; ?> instancia(s).
        Carga una imagen para cada grupo y pulsa <em>Procesar</em>.
    </p></div>
<?php elseif (isset($get['ec_reanalizado'])) : ?>
    <div class="notice notice-success"><p><strong>Datos regenerados</strong> para <?php echo esc_html((string)$get['ec_pdf']); ?>.
        La personalizacion de los grupos que siguen existiendo se conserva.</p></div>
        <?php if (!empty($get['ec_perdidos'])) : ?>
            <div class="notice notice-warning"><p><strong>Personalizacion perdida</strong> en grupos que ya no existen en el PDF:
            <?php echo esc_html((string)$get['ec_perdidos']); ?>.</p></div>
        <?php endif; ?>
<?php elseif (isset($get['ec_borrado'])) : ?>
    <div class="notice notice-success"><p><strong>PDF eliminado</strong> con sus datos, imagenes y salida.</p></div>
<?php elseif (isset($get['ec_imagen'])) : ?>
    <div class="notice notice-success"><p><strong>Imagen guardada</strong> para el grupo.</p></div>
<?php elseif (isset($get['ec_imagen_quitada'])) : ?>
    <div class="notice notice-success"><p><strong>Imagen quitada</strong> del grupo.</p></div>
<?php elseif (isset($get['ec_texto'])) : ?>
    <div class="notice notice-success"><p><strong>Texto estilizado guardado</strong> para el grupo. Al procesar, se renderizara como imagen del grupo.</p></div>
<?php elseif (isset($get['ec_texto_quitado'])) : ?>
    <div class="notice notice-success"><p><strong>Texto estilizado quitado</strong> del grupo.</p></div>
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
        <input type="hidden" name="action" value="personalizador_pdf_subir_pdf">
        <input type="hidden" name="modo" value="">
        <?php wp_nonce_field('personalizador_pdf_subir_pdf'); ?>
        <p>
            <input type="file" name="pdf" accept="application/pdf" required>
            <?php submit_button('Subir y analizar', 'primary', 'submit', false); ?>
        </p>
        <p class="description">
            PDF exportado desde Corel con rectangulos 100% transparentes. Al subirlo se detectan los grupos
            de color; los placeholders se previsualizan como marco y se descargan generados al vuelo.
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
            $d = $this->analisis_de($n);
            $cantG = $d ? (int)($d['total_grupos'] ?? 0) : 0;
            $cantI = 0;
            if ($d) {
                foreach (($d['grupos'] ?? []) as $gg) {
                    $cantI += (int)($gg['cont'] ?? 0);
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
                    <input type="hidden" name="action" value="personalizador_pdf_borrar">
                    <input type="hidden" name="archivo" value="<?php echo esc_attr($archivo); ?>">
                    <?php wp_nonce_field('personalizador_pdf_borrar'); ?>
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
    <h2>3. Personalizacion — <?php echo esc_html($seleccionado); ?></h2>

    <?php if (!$datos) : ?>
        <p class="ec-aviso">Este PDF no tiene datos analizados.</p>
        <form class="ec-form-inline" method="post" action="<?php echo esc_url($post_url); ?>">
            <input type="hidden" name="action" value="personalizador_pdf_reanalizar">
            <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
            <?php wp_nonce_field('personalizador_pdf_reanalizar'); ?>
            <button type="submit" class="button">Re-analizar</button>
        </form>
    <?php else : ?>
        <?php
        $grupos = $datos['grupos'] ?? [];
        $perso = []; // id => entrada del grupo (vista analisis+config, plan 008)
        foreach ($grupos as $g) {
            if (isset($g['id'])) {
                $perso[$g['id']] = $g;
            }
        }
        $conImagen = 0;
        foreach ($grupos as $g) {
            // Habilita procesar un grupo con imagen manual O mapeo activo.
            // Vista fusionada (value no vacio). Sin espejos (T018).
            $activo = !empty($perso[$g['id']]['value']);
            if (isset($imagenes[$g['id']]) || $activo) {
                $conImagen++;
            }
        }
        $totalInst = array_sum(array_map(function ($g) {
            return (int)($g['cont'] ?? 0);
        }, $grupos));
        // Configuracion tienda por PDF (plan 008: vista analisis+config fusionada).
        $cfg_pdf = $vista_pdf ? $vista_pdf['config'] : ['activo' => false, 'productos' => [], 'campos_ids' => [], 'placeholders' => []];
        list($todos_campos, $aviso_cfg_campos2) = $this->campos_activos();
        if ($aviso_cfg_campos === '' && $aviso_cfg_campos2 !== null && $aviso_cfg_campos2 !== '') {
            $aviso_cfg_campos = $aviso_cfg_campos2;
        }
        // Campos habilitados para este PDF (config) que siguen en el catalogo.
        $campos_pdf = [];
        foreach ((array)$cfg_pdf['campos_ids'] as $cid) {
            if (isset($todos_campos[(int)$cid])) {
                $campos_pdf[(int)$cid] = $todos_campos[(int)$cid];
            }
        }
        ?>
        <?php if ($aviso_cfg_campos !== null && $aviso_cfg_campos !== '') : ?>
            <div class="notice notice-warning"><p><strong>Aviso de recursos:</strong> <?php echo esc_html($aviso_cfg_campos); ?></p></div>
        <?php endif; ?>

        <div class="ec-cabecera">
            <span class="ec-cabecera-datos">
                <strong><?php echo count($grupos); ?></strong> grupo(s) de color —
                <strong><?php echo (int)$totalInst; ?></strong> instancias —
                <span class="ec-badge <?php echo $conImagen === count($grupos) ? 'ec-badge-verde' : 'ec-badge-amarillo'; ?>" id="ec-badge-cobertura">
                    <?php echo $conImagen; ?>/<?php echo count($grupos); ?> con imagen/texto
                </span>
            </span>
            <a class="button button-small" href="<?php echo esc_url($link_desc('datos', ['archivo' => $seleccionado])); ?>">Descargar JSON</a>
            <form class="ec-form-inline" method="post" action="<?php echo esc_url($post_url); ?>">
                <input type="hidden" name="action" value="personalizador_pdf_reanalizar">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <?php wp_nonce_field('personalizador_pdf_reanalizar'); ?>
                <button type="submit" class="button button-small">Re-analizar</button>
            </form>
        </div>

        <form class="ec-form-config" method="post" action="<?php echo esc_url($post_url); ?>">
            <input type="hidden" name="action" value="personalizador_pdf_config">
            <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
            <?php wp_nonce_field('personalizador_pdf_config'); ?>

            <details class="ec-acordeon ec-acordeon-tienda">
                <summary class="ec-acordeon-cab">Configuracion tienda
                    <label class="ec-switch ec-no-toggle">
                        <input type="checkbox" name="activo" value="1" <?php checked(!empty($cfg_pdf['activo']), true); ?>>
                        <span class="ec-switch-pista"></span>
                    </label>
                    <span class="ec-switch-texto">Activo (se ofrece en los productos)</span>
                </summary>
                <div class="ec-acordeon-cuerpo">
                    <p><label>Productos (IDs Woo, uno por linea, max 100)<br>
                        <textarea name="productos_txt" rows="2" cols="40" class="large-text code"><?php echo esc_textarea(implode("\n", (array)$cfg_pdf['productos'])); ?></textarea></label>
                        <span class="description">Se validan contra el catalogo Woo al guardar. (Buscador: proximamente.)</span></p>
                    <p><label>Campos (en orden de UI)<br>
                        <select name="campos_ids[]" multiple size="6" style="min-width:280px">
                            <?php foreach ($todos_campos as $cid => $t) : ?>
                                <option value="<?php echo (int)$cid; ?>" <?php echo in_array($cid, (array)$cfg_pdf['campos_ids'], true) ? 'selected' : ''; ?>>
                                    <?php echo (int)$cid; ?> — <?php echo esc_html($t[1] !== '' ? $t[1] : '(oculto)'); ?> (<?php echo esc_html($t[2]); ?>)
                                </option>
                            <?php endforeach; ?>
                        </select></label>
                        <span class="description">Los campos elegidos aca alimentan el selector de cada placeholder. (Alta rapida: proximamente.)</span></p>
                </div>
            </details>

            <details class="ec-acordeon ec-acordeon-placeholders" open>
                <summary class="ec-acordeon-cab">Placeholders</summary>
                <div class="ec-acordeon-cuerpo">
                    <?php if (count($grupos) > 1) : ?>
                    <div class="ec-tabs">
                        <?php foreach ($grupos as $gi => $g) : ?>
                        <button type="button" class="button ec-tab<?php echo $gi === 0 ? ' ec-tab-activa' : ''; ?>" data-id="<?php echo esc_attr($g['id']); ?>">
                            <span class="swatch" style="background: #<?php echo esc_attr($g['id']); ?>"></span>
                            <?php echo esc_html(strtoupper($g['id'])); ?>
                        </button>
                        <?php endforeach; ?>
                    </div>
                    <?php endif; ?>

                    <?php foreach ($grupos as $gi => $g) :
                        $gid = $g['id'];
                        $tiene = isset($imagenes[$gid]);
                        $gm = $perso[$gid] ?? [];
                        $valor = (string)($gm['value'] ?? '');
                        $preset_g = (string)($gm['preset'] ?? '');
                        $settings_g = (string)($gm['config'] ?? '');
                        $tipo_g = (string)($gm['default'] ?? '');
                        if ($tipo_g === '') {
                            $tipo_g = 'texto';
                        }
                        // Estado inicial del panel: campo, modo codigo o vacio.
                        $campo_id = 0;
                        if (preg_match('/^\[campo(\d+)\]$/i', trim($valor), $mm)) {
                            $cid0 = (int)$mm[1];
                            if (isset($campos_pdf[$cid0])) {
                                $campo_id = $cid0;
                            }
                        }
                        $modo_codigo = ($valor !== '' && $campo_id === 0);
                        // Marco dibujado (sin archivo): escala el tamano real a la caja.
                        $mnW = max(1, (int)$g['w']); $mnH = max(1, (int)$g['h']);
                        $escala = min(140 / $mnW, 100 / $mnH);
                        $vw = max(8, (int)round($mnW * $escala)); $vh = max(8, (int)round($mnH * $escala));
                    ?>
                    <div class="ec-panel-grupo<?php echo $gi === 0 ? ' ec-panel-activa' : ''; ?>"
                         data-id="<?php echo esc_attr($gid); ?>"
                         data-w="<?php echo (int)$mnW; ?>" data-h="<?php echo (int)$mnH; ?>"
                         data-tiene="<?php echo $tiene ? '1' : '0'; ?>">
                        <div class="ec-grupo-cab">
                            <span class="swatch" style="background: #<?php echo esc_attr($gid); ?>"></span>
                            <h3>Grupo <?php echo esc_html(strtoupper($gid)); ?>
                                <span class="ec-badge" style="background:#<?php echo esc_attr($gid); ?>"><?php echo esc_html('#' . $gid); ?></span>
                            </h3>
                        </div>
                        <p class="ec-datos-grupo">
                            Marco: <strong><?php echo (int)$mnW; ?>x<?php echo (int)$mnH; ?> px</strong> —
                            <?php echo (int)$g['cont']; ?> instancia(s), pag.
                            <?php echo esc_html(implode(', ', array_map(function ($p) {
                                return (int)$p + 1;
                            }, $g['pgs'] ?? []))); ?>
                        </p>
                        <div class="ec-grupo-cols">
                            <div class="ec-col-media">
                                <div class="ec-preview ec-checker ec-marco-btn" data-id="<?php echo esc_attr($gid); ?>"
                                     data-ver="<?php echo esc_url($link_ver('imagen', ['archivo' => $seleccionado, 'id' => $gid])); ?>"
                                     data-vw="<?php echo (int)$vw; ?>" data-vh="<?php echo (int)$vh; ?>"
                                     title="Clic: elegir imagen de la galeria (o arrastrala aca)">
                                    <?php if ($tiene) : ?>
                                        <img src="<?php echo esc_url($link_ver('imagen', ['archivo' => $seleccionado, 'id' => $gid])); ?>"
                                             alt="Imagen del grupo <?php echo esc_attr($gid); ?>">
                                    <?php else : ?>
                                        <div class="ec-marco" style="width:<?php echo (int)$vw; ?>px;height:<?php echo (int)$vh; ?>px"
                                             title="<?php echo (int)$mnW; ?>x<?php echo (int)$mnH; ?> px"></div>
                                    <?php endif; ?>
                                </div>
                                <a class="button button-small ec-btn-placeholder"
                                   href="<?php echo esc_url($link_desc('placeholder', ['archivo' => $seleccionado, 'id' => $gid])); ?>">
                                    Descargar placeholder
                                </a>
                                <button type="button" class="button button-small button-link-delete ec-quitar"
                                        data-id="<?php echo esc_attr($gid); ?>"<?php if (!$tiene) : ?> hidden<?php endif; ?>>
                                    Quitar imagen
                                </button>
                                <span class="ec-subida-status" aria-live="polite"></span>
                            </div>
                            <div class="ec-col-config">
                                <p class="ec-linea">
                                    <label class="ec-label-chica">
                                        <input type="checkbox" class="ec-modo-codigo" data-id="<?php echo esc_attr($gid); ?>" <?php checked($modo_codigo); ?>>
                                        modo codigo
                                    </label>
                                    <label class="ec-label-chica">Tipo
                                        <select class="ec-select-tipo" data-id="<?php echo esc_attr($gid); ?>">
                                            <option value="texto" <?php selected($tipo_g, 'texto'); ?>>texto</option>
                                            <option value="imagen" <?php selected($tipo_g, 'imagen'); ?>>imagen</option>
                                        </select>
                                    </label>
                                </p>
                                <p class="ec-bloque-codigo"<?php if (!$modo_codigo) : ?> hidden<?php endif; ?>>
                                    <input type="text" class="ec-input-codigo" data-id="<?php echo esc_attr($gid); ?>" maxlength="2000"
                                           placeholder="Ej: Hola [campo1]"
                                           value="<?php echo esc_attr($modo_codigo ? $valor : ''); ?>">
                                    <span class="description">Codigo libre; los [campoN] se reemplazan con el valor del cliente.</span>
                                </p>
                                <p class="ec-bloque-campo"<?php if ($modo_codigo) : ?> hidden<?php endif; ?>>
                                    <select class="ec-select-campo" data-id="<?php echo esc_attr($gid); ?>">
                                        <option value="">(sin campo)</option>
                                        <?php foreach ($campos_pdf as $cid => $t) : ?>
                                            <option value="<?php echo (int)$cid; ?>" data-titulo="<?php echo esc_attr($t[1]); ?>" <?php selected($campo_id, (int)$cid); ?>>
                                                <?php echo (int)$cid; ?> — <?php echo esc_html($t[1] !== '' ? $t[1] : '(oculto)'); ?> (<?php echo esc_html($t[2]); ?>)
                                            </option>
                                        <?php endforeach; ?>
                                    </select>
                                </p>
                                <p class="ec-bloque-estilo"<?php if ($tipo_g !== 'texto') : ?> hidden<?php endif; ?>>
                                    <label class="ec-label-chica">Estilo
                                        <?php $primer_preset = $presets ? (string)reset($presets) : ''; ?>
                                        <select class="ec-select-estilo" data-id="<?php echo esc_attr($gid); ?>">
                                            <?php $sel_estilo = $preset_g !== '' ? $preset_g : $primer_preset; ?>
                                            <?php foreach ($presets as $preset) : ?>
                                                <option value="<?php echo esc_attr($preset); ?>" <?php selected($sel_estilo, $preset); ?>>
                                                    <?php echo esc_html($preset); ?>
                                                </option>
                                            <?php endforeach; ?>
                                        </select>
                                    </label>
                                </p>
                                <details class="ec-avanzado">
                                    <summary>Avanzado (settings)</summary>
                                    <input type="text" class="ec-input-settings" data-id="<?php echo esc_attr($gid); ?>" maxlength="4000"
                                           value="<?php echo esc_attr($settings_g); ?>">
                                    <span class="description">Overrides del estilo; admite [campoN].</span>
                                </details>
                                <p class="ec-linea">
                                    <button type="button" class="button button-small ec-probar" data-id="<?php echo esc_attr($gid); ?>">Probar</button>
                                    <span class="ec-texto-status" aria-live="polite"></span>
                                </p>
                                <div class="ec-texto-preview-caja" hidden>
                                    <img alt="Vista previa del grupo <?php echo esc_attr($gid); ?>">
                                    <span class="ec-texto-preview-dims"></span>
                                </div>
                                <?php if ($valor !== '' && $preset_g !== '' && $tiene) : ?>
                                    <p class="ec-aviso">Al procesar, el texto renderizado reemplazara la imagen cargada de este grupo.</p>
                                <?php endif; ?>
                            </div>
                        </div>
                        <?php // Estado canonico que recibe handle_config_guardar (sincronizado por admin.js). ?>
                        <input type="hidden" name="placeholders[<?php echo esc_attr($gid); ?>][tipo]" class="ec-h-tipo" value="<?php echo esc_attr($tipo_g); ?>">
                        <input type="hidden" name="placeholders[<?php echo esc_attr($gid); ?>][preset]" class="ec-h-preset" value="<?php echo esc_attr($preset_g); ?>">
                        <input type="hidden" name="placeholders[<?php echo esc_attr($gid); ?>][value]" class="ec-h-value" value="<?php echo esc_attr($valor); ?>">
                        <input type="hidden" name="placeholders[<?php echo esc_attr($gid); ?>][settings]" class="ec-h-settings" value="<?php echo esc_attr($settings_g); ?>">
                    </div>
                    <?php endforeach; ?>
                </div>
            </details>

            <details class="ec-acordeon ec-acordeon-mockups">
                <summary class="ec-acordeon-cab">Mockups</summary>
                <div class="ec-acordeon-cuerpo">
                    <p class="description">Proximamente: previsualizacion de las paginas del PDF con los placeholders aplicados.</p>
                </div>
            </details>

            <div class="ec-fila-final">
                <button type="submit" class="button button-primary">Guardar</button>
                <span class="ec-guardar-status" aria-live="polite"></span>
                <?php if ($salida_ok) : ?>
                    <a class="button" href="<?php echo esc_url($link_desc('salida', ['archivo' => $seleccionado])); ?>">Descargar PDF Procesado</a>
                <?php else : ?>
                    <button type="button" class="button" disabled>Descargar PDF Procesado</button>
                <?php endif; ?>
                <span class="description">Guarda activo, productos, campos y el mapeo de cada placeholder.</span>
            </div>
        </form>

        <?php // Formularios de imagen por grupo (pool oculto; el marco abre la galeria). ?>
        <div class="ec-forms-imagen" hidden>
            <?php foreach ($grupos as $g) : $gid = $g['id']; $tiene = isset($imagenes[$gid]); ?>
            <form class="ec-form-imagen" method="post" action="<?php echo esc_url($post_url); ?>" enctype="multipart/form-data" data-id="<?php echo esc_attr($gid); ?>">
                <input type="hidden" name="action" value="personalizador_pdf_subir_imagen">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <input type="hidden" name="id" value="<?php echo esc_attr($gid); ?>">
                <input type="hidden" name="attachment_id" value="">
                <?php wp_nonce_field('personalizador_pdf_subir_imagen'); ?>
                <input type="file" name="imagen" accept="image/png,image/jpeg,image/gif,image/webp" class="ec-input-imagen">
                <button type="button" class="button button-small ec-galeria" data-id="<?php echo esc_attr($gid); ?>">Desde galeria</button>
                <button type="submit" class="button button-small">Cargar imagen</button>
            </form>
            <?php if ($tiene) : ?>
            <form class="ec-form-inline ec-form-quitar" method="post" action="<?php echo esc_url($post_url); ?>" data-id="<?php echo esc_attr($gid); ?>">
                <input type="hidden" name="action" value="personalizador_pdf_quitar_imagen">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <input type="hidden" name="id" value="<?php echo esc_attr($gid); ?>">
                <?php wp_nonce_field('personalizador_pdf_quitar_imagen'); ?>
            </form>
            <?php endif; ?>
            <?php endforeach; ?>
        </div>

        <div class="ec-procesar">
            <form class="ec-form-procesar" method="post" action="<?php echo esc_url($post_url); ?>">
                <input type="hidden" name="action" value="personalizador_pdf_procesar">
                <input type="hidden" name="archivo" value="<?php echo esc_attr($seleccionado); ?>">
                <?php wp_nonce_field('personalizador_pdf_procesar'); ?>
                <button type="submit" class="button button-primary button-hero"
                        <?php if ($conImagen === 0) : ?>disabled<?php endif; ?>>
                    Procesar PDF
                </button>
            </form>
            <p class="description">
                <?php if ($conImagen === 0) : ?>
                    Carga una imagen o asigna un texto en al menos un grupo para poder procesar.
                <?php else : ?>
                    Inserta la imagen o el texto de cada grupo en todos sus placeholders (encajado, sin deformar ni recortar).
                    <?php if ($conImagen < count($grupos)) : ?>
                        Ojo: <?php echo count($grupos) - $conImagen; ?> grupo(s) sin imagen ni texto quedaran como estan.
                    <?php endif; ?>
                    <?php if ($salida_ok) : ?>
                        — <a href="<?php echo esc_url($link_desc('salida', ['archivo' => $seleccionado])); ?>">Descargar el ultimo resultado</a>
                    <?php endif; ?>
                <?php endif; ?>
            </p>
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
