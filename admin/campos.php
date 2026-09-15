<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

/** [id, titulo_cliente, tipo, etiquetas, texto_ayuda, visible, contenido, css, script] */
$get = wp_unslash($_GET);
list($todos, $aviso_campos) = $this->campos_activos();
$editando = isset($get['ec_campo_editar']) ? (int)$get['ec_campo_editar'] : 0;
$tupla_ed = ($editando > 0 && isset($todos[$editando])) ? $todos[$editando] : null;
$post_url = admin_url('admin-post.php');
?>
<?php if (!empty($get['ec_campo'])) : ?>
    <div class="notice notice-success"><p><strong>Campo guardado:</strong> id <?php echo (int)$get['ec_campo']; ?>.</p></div>
<?php elseif (!empty($get['ec_campo_baja'])) : ?>
    <div class="notice notice-success"><p><strong>Campo dado de baja:</strong> id <?php echo (int)$get['ec_campo_baja']; ?> (tombstone, el id no se reutiliza).</p></div>
<?php endif; ?>
<?php if (!empty($get['ec_error'])) : ?>
    <div class="notice notice-error"><p><strong>Error:</strong> <?php echo esc_html(rawurldecode((string)$get['ec_error'])); ?></p></div>
<?php endif; ?>
<?php if ($aviso_campos !== null && $aviso_campos !== '') : ?>
    <div class="notice notice-warning"><p><strong>Aviso de recursos:</strong> <?php echo esc_html($aviso_campos); ?></p></div>
<?php endif; ?>

<div class="card">
    <h2>Campos reutilizables (<?php echo count($todos); ?>)</h2>
    <p class="description">Mismo <code>id</code> usable en N PDFs. El <code>script</code> corre solo en el
        navegador con firma <code>function(ctx, root)</code>; <code>V(N)</code> lee otros campos.</p>
    <?php if (!$todos) : ?>
        <p>Todavia no hay campos. Crea el primero abajo.</p>
    <?php else : ?>
        <table class="widefat striped">
            <thead><tr><th>id</th><th>Titulo cliente</th><th>Tipo</th><th>Etiquetas</th><th>Visible</th><th></th><th></th></tr></thead>
            <tbody>
                <?php foreach ($todos as $cid => $t) : ?>
                    <tr>
                        <td><strong><?php echo (int)$cid; ?></strong></td>
                        <td><?php echo esc_html($t[1] !== '' ? $t[1] : '(oculto)'); ?></td>
                        <td><code><?php echo esc_html($t[2]); ?></code></td>
                        <td><?php echo esc_html(implode(', ', (array)$t[3])); ?></td>
                        <td><?php echo !empty($t[5]) ? 'si' : 'no'; ?></td>
                        <td><a class="button button-small" href="<?php echo esc_url(add_query_arg('ec_campo_editar', $cid, admin_url('admin.php?page=personalizador-pdf&tab=campos'))); ?>">Editar</a></td>
                        <td>
                            <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo-baja">
                                <input type="hidden" name="action" value="personalizador_pdf_campo_baja">
                                <input type="hidden" name="id" value="<?php echo (int)$cid; ?>">
                                <?php wp_nonce_field('personalizador_pdf_campo'); ?>
                                <button type="submit" class="button button-small button-link-delete">Baja</button>
                            </form>
                        </td>
                    </tr>
                <?php endforeach; ?>
            </tbody>
        </table>
    <?php endif; ?>
</div>


<div class="card">
    <h2><?php echo $tupla_ed ? ('Editar campo ' . (int)$tupla_ed[0]) : 'Nuevo campo'; ?></h2>
    <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo">
        <input type="hidden" name="action" value="personalizador_pdf_campo">
        <?php if ($tupla_ed) : ?><input type="hidden" name="id" value="<?php echo (int)$tupla_ed[0]; ?>"><?php endif; ?>
        <?php wp_nonce_field('personalizador_pdf_campo'); ?>
        <table class="form-table">
            <tr><th><label for="ec-titulo">Titulo cliente</label></th>
                <td><input id="ec-titulo" name="titulo_cliente" class="regular-text" value="<?php echo esc_attr($tupla_ed ? $tupla_ed[1] : ''); ?>">
                <p class="description">Vacio = campo invisible (igual evalua su script).</p></td></tr>
            <tr><th><label for="ec-tipo">Tipo</label></th>
                <td><select id="ec-tipo" name="tipo">
                    <?php foreach (['text', 'textarea', 'select', 'img', 'override'] as $tipo) : ?>
                        <option value="<?php echo esc_attr($tipo); ?>" <?php selected($tupla_ed ? $tupla_ed[2] : 'text', $tipo); ?>><?php echo esc_html($tipo); ?></option>
                    <?php endforeach; ?>
                </select></td></tr>
            <tr><th><label for="ec-etiquetas">Etiquetas</label></th>
                <td><input id="ec-etiquetas" name="etiquetas" class="regular-text" value="<?php echo esc_attr($tupla_ed ? implode(',', (array)$tupla_ed[3]) : ''); ?>">
                <p class="description">Separadas por coma.</p></td></tr>
            <tr><th><label for="ec-ayuda">Texto de ayuda</label></th>
                <td><input id="ec-ayuda" name="texto_ayuda" class="regular-text" value="<?php echo esc_attr($tupla_ed ? $tupla_ed[4] : ''); ?>"></td></tr>
            <tr><th>Visible</th>
                <td><label><input type="checkbox" name="visible" value="1" <?php checked($tupla_ed ? !empty($tupla_ed[5]) : true, true); ?>> Se pinta en ficha/carrito</label></td></tr>
            <tr><th><label for="ec-contenido">Contenido (HTML)</label></th>
                <td><textarea id="ec-contenido" name="contenido" rows="6" cols="80" class="large-text code"><?php echo esc_textarea($tupla_ed ? $tupla_ed[6] : ''); ?></textarea>
                <p class="description">Fragmento con scope <code>.pmu-campo-{id}</code>. Prohibidos <code>id=""</code>, script, iframe, form.</p></td></tr>
            <tr><th><label for="ec-css">CSS</label></th>
                <td><textarea id="ec-css" name="css" rows="4" cols="80" class="large-text code"><?php echo esc_textarea($tupla_ed ? $tupla_ed[7] : ''); ?></textarea></td></tr>
            <tr><th><label for="ec-script">Script</label></th>
                <td><textarea id="ec-script" name="script" rows="6" cols="80" class="large-text code"><?php echo esc_textarea($tupla_ed ? $tupla_ed[8] : ''); ?></textarea>
                <p class="description"><code>function(ctx, root){ ... return {valor, cliente}; }</code>. <code>ctx.set(id)</code> publica, <code>V(N)</code> lee.</p></td></tr>
        </table>
        <?php submit_button($tupla_ed ? 'Guardar cambios' : 'Crear campo', 'primary', 'submit', false); ?>
    </form>
</div>
