<?php
/**
 * Simbolos que PHPStan no descubre por si solo. SOLO para scanFiles de
 * phpstan.neon: este archivo NUNCA se ejecuta en runtime (esta en tests/).
 *
 * - Constantes del plugin: personalizador-pdf.php las define con define()
 *   en runtime, pero los archivos de admin/ las usan desde include y PHPStan
 *   las reporta como "not found".
 * - Constantes de fecha de WordPress: los wordpress-stubs v7.x no las traen.
 */

define('PERSONALIZADOR_PDF_PATH', __DIR__);
define('PERSONALIZADOR_PDF_URL', 'http://example.test/wp-content/plugins/personalizador-pdf');

define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
define('DAY_IN_SECONDS', 86400);
define('WEEK_IN_SECONDS', 604800);
define('MONTH_IN_SECONDS', 2592000);
define('YEAR_IN_SECONDS', 31536000);
