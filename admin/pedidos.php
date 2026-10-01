<?php
if (!defined('ABSPATH')) {
    exit;
}
/** @var Personalizador_PDF_Plugin $this */

// Inventario de pedidos entregados (`orders/{order_id}/{item_key}/`): estado,
// snapshot declarado (pdfs[] / pdfs_descartados[]), pool, vistas congeladas,
// etiquetas del cliente (solo lectura) y salida. 004/T025 + 005/T010.

$post_url = admin_url('admin-post.php');
$completados = $this->pedidos_completados();
?>
<h2>Pedidos completados</h2>

<div class="card">
    <?php if (!$completados) : ?>
        <p>Todavia no hay pedidos entregados. Los items aparecen aqui cuando el pago queda confirmado.</p>
    <?php else : ?>
        <table class="widefat striped">
            <thead>
                <tr>
                    <th>Pedido</th><th>Item</th><th>Estado</th><th>PDFs aceptados</th><th>PDFs descartados</th><th>Pool</th><th>Vistas</th>
                    <th>Personalizacion</th><th>Salida</th><th>Acciones</th>
                </tr>
            </thead>
            <tbody>
            <?php foreach ($completados as $r) : ?>
                <tr>
                    <td>#<?php echo (int)$r['order_id']; ?></td>
                    <td><code><?php echo esc_html($r['item_key']); ?></code></td>
                    <td><?php echo esc_html($r['estado']); ?></td>
                    <td>
                        <?php if (empty($r['pdfs'])) : ?>—<?php endif; ?>
                        <?php foreach ((array)$r['pdfs'] as $pdfR) : ?>
                            <div><code><?php echo esc_html((string)$pdfR); ?></code></div>
                        <?php endforeach; ?>
                    </td>
                    <td>
                        <?php if (empty($r['descartados'])) : ?>—<?php else : ?>
                            <?php foreach ((array)$r['descartados'] as $pdfD) : ?>
                                <div><code><?php echo esc_html((string)$pdfD); ?></code></div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </td>
                    <td><?php echo (int)$r['archivos']; ?> PNG</td>
                    <td><?php echo (int)$r['webps']; ?> webp</td>
                    <td>
                        <?php if (!$r['valores']) : ?>—<?php endif; ?>
                        <?php foreach ($r['valores'] as $v) : ?>
                            <div><strong><?php echo esc_html($v['titulo']); ?>:</strong> <?php echo esc_html($v['cliente']); ?></div>
                        <?php endforeach; ?>
                    </td>
                    <td><?php echo $r['salida'] !== '' ? esc_html($r['salida']) : '— (se genera al descargar)'; ?></td>
                    <td>
                        <form method="post" action="<?php echo esc_url($post_url); ?>" style="display:inline" class="ec-form-regenerar">
                            <input type="hidden" name="action" value="personalizador_pdf_item_regenerar">
                            <input type="hidden" name="order_id" value="<?php echo (int)$r['order_id']; ?>">
                            <input type="hidden" name="item_key" value="<?php echo esc_attr($r['item_key']); ?>">
                            <?php wp_nonce_field('personalizador_pdf_item_regenerar'); ?>
                            <button type="submit" class="button button-small">Regenerar PDF</button>
                        </form>
                        <a class="button button-small" href="<?php echo esc_url(add_query_arg([
                            'action' => 'personalizador_pdf_item_descargar',
                            'order_id' => $r['order_id'],
                            'item_key' => $r['item_key'],
                        ], $post_url)); ?>">Descargar</a>
                    </td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>
        <p class="description">"Regenerar PDF" rearma la salida desde el pool vigente (idempotente). La descarga sirve el PDF final (lo genera al vuelo si falta).</p>
    <?php endif; ?>
</div>