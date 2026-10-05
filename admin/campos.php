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

// CSS/JS global del plugin (spec 012, T020). Se lee siempre: si el admin no
// puede escribirlo, el aviso sale al ABRIR la pestana y no al guardar.
$global_css = '';
$global_js = '';
$aviso_global = '';
try {
    $global = $this->pmu_uploads()->leer_global();
    $global_css = $global['css'];
    $global_js = $global['js'];
} catch (\Throwable $e) {
    $aviso_global = $e->getMessage();
}
$global_css_prefijo = $aviso_global === '' ? $this->css_global_prefijo($global_css) : '';
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

<?php if ($aviso_global !== '') : ?>
    <div class="notice notice-error"><p><strong>No se pudo leer el CSS/JS global:</strong>
        <?php echo esc_html($aviso_global); ?></p></div>
<?php endif; ?>

<?php /* Portador del CSS global YA prefijado: el preview (srcdoc) lo lee de
        ahi para mostrar exactamente lo que vera el comprador (FR-006). Va como
        script type="text/css" a proposito: el navegador NO lo aplica en la
        consola, solo lo transporta. */ ?>
<script type="text/css" id="pmu-campo-global-css"><?php
    echo str_replace('</', '<\\/', $global_css_prefijo); // phpcs:ignore WordPress.Security.EscapeOutput
?></script>

<?php /* "Estilos globales / Script global" vive al FINAL de la pestana y plegado
       (spec 013, T006): es lo mas tecnico y lo de uso mas raro, y antes ocupaba
       la pantalla entera antes de que se vieran los campos. */ ?>

<?php /* Drawer (spec 013, T003): una sola superficie para ALTA y EDICION, en vez de
       un card de alta fijo arriba mas el editor pegado a cada fila. Este es el
       formulario de ALTA (plantilla dormida); el de edicion lo aporta el
       servidor en `forms_campos_html()` y el JS mueve dentro el que toque. */ ?>
<div class="ec-c-drawer" id="ec-c-drawer" hidden>
    <div class="ec-c-drawer-fondo" data-cerrar="1"></div>
    <aside class="ec-c-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="ec-c-drawer-titulo">
        <header class="ec-c-drawer-cab">
            <h2 id="ec-c-drawer-titulo">Nuevo campo</h2>
            <button type="button" class="ec-c-drawer-x" data-cerrar="1" aria-label="Cerrar el editor">&times;</button>
        </header>
        <div class="ec-c-drawer-cuerpo" id="ec-c-drawer-cuerpo"></div>
    </aside>
</div>
<?php /* "DORMITORIO" de formularios (spec 013, T002). El <tbody> de la tabla de
       abajo contiene SOLO filas de campo: cada editor vive aca, oculto, y el
       drawer lo mueve dentro al abrirlo (y de vuelta al cerrarlo). Con el
       editor fuera de la tabla, los filtros y el orden dejan de arrastrarlo.
       Primero va la plantilla de ALTA; despues, un div por campo activo. */ ?>
<div class="ec-campo-forms" id="ec-campo-forms" hidden>
<div class="ec-campo-form ec-campo-form-nuevo">
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
<?php echo $this->forms_campos_html($campos, $post_url); ?>
</div>

<div class="card ec-c-card-campos">
    <div class="ec-c-cabecera">
        <h2>Campos reutilizables (<?php echo count($campos); ?>)</h2>
        <button type="button" class="button button-primary ec-abrir-alta">+ Nuevo campo</button>
    </div>
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

<?php /* Al PIE y plegado: es lo mas tecnico y lo de uso mas raro (spec 013, T006).
       Antes ocupaba la pantalla entera arriba, antes de que se vieran los campos. */ ?>
<div class="card">
    <details class="ec-c-globales">
        <summary><strong>Estilos globales / Script global</strong></summary>
        <p class="description">Un solo par de archivos para <strong>todo</strong> el plugin
            (<code>uploads/pmu/campos/global.css</code> y <code>global.js</code>). Se cargan solo en las
            fichas que tienen al menos un campo. El CSS se inyecta <strong>prefijado</strong> con
            <code>[data-pmu-panel]</code>, asi que no puede romper el tema. El <code>global.js</code> es
            codigo libre tuyo y corre <strong>antes</strong> de montar los campos: ahi se resuelve el
            <code>cliente</code> que el campo no publica (el sistema no traduce nada por si solo).</p>
        <form method="post" action="<?php echo esc_url($post_url); ?>" class="ec-form-campo-global">
            <input type="hidden" name="action" value="personalizador_pdf_campo_global">
            <?php wp_nonce_field('personalizador_pdf_campo'); ?>
            <p><label><strong>global.css</strong><br>
                <textarea name="global_css" rows="6" class="large-text code ec-campo-global-css"
                    spellcheck="false" placeholder=".mi-clase { color: #333; }"><?php echo esc_textarea($global_css); ?></textarea></label></p>
            <p><label><strong>global.js</strong><br>
                <textarea name="global_js" rows="6" class="large-text code ec-campo-global-js"
                    spellcheck="false" placeholder="window.PMU_CAMPO = window.PMU_CAMPO || {};"><?php echo esc_textarea($global_js); ?></textarea></label></p>
            <?php submit_button('Guardar estilos globales', 'secondary', 'submit', false); ?>
            <span class="ec-campo-status" aria-live="polite"></span>
        </form>
    </details>
</div>