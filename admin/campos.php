<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

/**
 * Campos reutilizables (spec 012, F1). El formato es v2: cada campo es una
 * carpeta uploads/pmu/campos/{id}/ con datos.json + campo.htm|css|js, y el
 * catalogo `campos.json` es solo el indice con los metadatos.
 *
 * El editor se abre DENTRO de la fila (`data-editando`), sin navegar: por eso
 * ya no existe el GET `ec_campo_editar` (FR-001).
 */
$campos = $this->cargar_campos();
$bajas = $this->cargar_campos(true);
$nuevos = array_diff_key($bajas, $campos); // dados de baja, para el panel de abajo
$aviso_campos = '';
list(, $aviso_campos) = $this->campos_activos();
$post_url = admin_url('admin-post.php');
$plantillas = ['texto' => 'Texto', 'select' => 'Opciones', 'imagen' => 'Imagenes (cargador)'];
?>
<noscript>
    <div class="notice notice-warning">
        <p><strong>Esta pestana necesita JavaScript.</strong>
        El alta, la edicion y la baja de campos se envian por AJAX.</p>
    </div>
</noscript>
<?php if ($aviso_campos !== null && $aviso_campos !== '') : ?>
    <div class="notice notice-warning"><p><strong>Aviso de recursos:</strong> <?php echo esc_html($aviso_campos); ?></p></div>
<?php endif; ?>

<div class="card">
    <h2>Nuevo campo</h2>
    <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo-importar">
        <input type="hidden" name="action" value="personalizador_pdf_campo_importar">
        <?php wp_nonce_field('personalizador_pdf_campo'); ?>
        <input type="file" name="archivo" accept=".json,application/json">
        <button type="submit" class="button">Importar campos</button>
        <span class="ec-campo-status" aria-live="polite"></span>
    </form>
    <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo-exportar">
        <input type="hidden" name="action" value="personalizador_pdf_campo_exportar">
        <?php wp_nonce_field('personalizador_pdf_campo'); ?>
        <button type="submit" class="button">Exportar campos (.json)</button>
        <span class="ec-campo-status" aria-live="polite"></span>
    </form>
    <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo">
        <input type="hidden" name="action" value="personalizador_pdf_campo">
        <?php wp_nonce_field('personalizador_pdf_campo'); ?>
        <p class="description">Se crea sin recargar. La <strong>plantilla</strong> solo deja el formulario
            prepared; despues editas el HTML, el CSS y el JS a tu medida. El mismo <code>id</code> se
            puede usar en N PDFs.</p>
        <p><label>Nombre (para vos)<br>
            <input name="nombre" class="regular-text" placeholder="Fotos polaroid cuadradas x6"></label></p>
        <p><label>Plantilla<br>
            <select name="plantilla">
                <?php foreach ($plantillas as $valor => $texto) : ?>
                    <option value="<?php echo esc_attr($valor); ?>"><?php echo esc_html($texto); ?></option>
                <?php endforeach; ?>
            </select></label></p>
        <p><label>Titulo para el comprador<br>
            <input name="titulo_cliente" class="regular-text" placeholder="Fotos"></label>
            <span class="description">Es la etiqueta que aparece en el carrito y el pedido (ej.: "Seleccion: sal, oregano...").</span></p>
        <?php submit_button('Crear campo', 'primary', 'submit', false); ?>
        <span class="ec-campo-status" aria-live="polite"></span>
    </form>
</div>

<div class="card">
    <h2>Campos reutilizables (<?php echo count($campos); ?>)</h2>
    <p class="description">Mismo <code>id</code> usable en N PDFs. El <code>campo.js</code> corre solo en el
        navegador con firma <code>function(ctx, root)</code>; <code>V(N)</code> lee otros campos.</p>
    <?php if (!$campos) : ?>
        <p class="ec-campos-vacio">Todavia no hay campos. Crea el primero con el formulario de arriba.</p>
    <?php endif; ?>
    <div class="ec-c-filtros">
            <p class="ec-buscador">
                <input type="search" class="ec-c-buscar" placeholder="Buscar por nombre, descripcion, titulo o categoria"
                       autocomplete="off">
            </p>
            <?php
            // Chips de categoria: todas las que usan los campos activos.
            $cats = [];
            foreach ($campos as $c) {
                foreach ($c['categorias'] as $cat) {
                    $cats[$cat] = isset($cats[$cat]) ? $cats[$cat] + 1 : 1;
                }
            }
            ksort($cats);
            ?>
            <?php if ($cats) : ?>
                <p class="ec-chips">
                    <span class="description">Categorias:</span>
                    <?php foreach ($cats as $cat => $n) : ?>
                        <button type="button" class="button button-small ec-chip-cat"
                                data-cat="<?php echo esc_attr($cat); ?>"><?php echo esc_html($cat); ?>
                            <span class="ec-chip-n"><?php echo (int)$n; ?></span></button>
                    <?php endforeach; ?>
                    <button type="button" class="button button-small ec-chip-cat ec-chip-todas"
                            data-cat="" hidden>Quitar filtros</button>
                </p>
            <?php endif; ?>
            <p class="ec-orden">
                <label class="description" for="ec-c-orden">Orden:</label>
                <select id="ec-c-orden" class="ec-c-orden-sel">
                    <option value="id">Por id</option>
                    <option value="modificado">Ultima modificacion</option>
                    <option value="creado">Mas recientes (creado)</option>
                    <option value="nombre">Por nombre</option>
                </select>
                <span class="ec-c-conteo" aria-live="polite"></span>
            </p>
        </div>
        <table class="widefat striped ec-campos-tabla">
            <thead><tr><th>id</th><th>Nombre</th><th>Titulo comprador</th><th>Categorias</th>
                <th>Plantilla</th><th>Uso</th><th>Acciones</th></tr></thead>
            <tbody class="ec-campos-cuerpo">
            <?php foreach ($campos as $cid => $c) : echo $this->fila_campo_html($cid, $c); endforeach; ?>
            </tbody>
        </table>
</div>

<?php if ($nuevos) : ?>
<div class="card">
    <h2>Dados de baja (<?php echo count($nuevos); ?>)</h2>
    <p class="description">Conservan su HTML, CSS y JS: restaurarlos no pierde nada.</p>
    <table class="widefat striped">
        <thead><tr><th>id</th><th>Nombre</th><th>Acciones</th></tr></thead>
        <tbody>
        <?php foreach ($nuevos as $cid => $c) : ?>
            <tr data-id="<?php echo (int)$cid; ?>">
                <td><strong><?php echo (int)$cid; ?></strong></td>
                <td><?php echo esc_html($c['datos']['nombre'] !== '' ? $c['datos']['nombre'] : '(sin nombre)'); ?></td>
                <td>
                    <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo-restaurar">
                        <input type="hidden" name="action" value="personalizador_pdf_campo_restaurar">
                        <input type="hidden" name="id" value="<?php echo (int)$cid; ?>">
                        <?php wp_nonce_field('personalizador_pdf_campo'); ?>
                        <button type="submit" class="button button-small">Restaurar</button>
                    </form>
                </td>
            </tr>
        <?php endforeach; ?>
        </tbody>
    </table>
</div>
<?php endif; ?>
