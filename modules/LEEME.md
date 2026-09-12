# Carpeta de modulos del plugin

Aqui se importan manualmente los modulos autocontenidos del plugin (hoy: **TextMuy**).

## Como importar TextMuy

1. Copia (o clona) el proyecto **textmuy** dentro de esta carpeta de modo que quede
   `modules/textmuy/` con su `index.html` en la raiz:
   ```
   personalizador-pdf/
   └── modules/
       └── textmuy/
           ├── index.html
           ├── render-core.html
           ├── css/  js/  tests/ ...
   ```
2. Verifica que `modules/textmuy/index.html` exista: la pestana "Estilos de Texto"
   del admin lo detecta y monta el iframe; si falta, muestra un aviso con estas
   instrucciones en su lugar.

## Notas importantes

- **Esta carpeta NO se versiona**: `modules/textmuy/` esta en `.gitignore`.
   El modulo tiene su propio repositorio/proyecto fuente.
- **El modulo es solo codigo**: NO trae datos. Los presets (`.txm`), imagenes
   y fuentes del administrador viven en la ubicacion unica
   `wp-content/uploads/tm/{fonts,img,presets}/`.
   Al actualizar el modulo (reemplazar `modules/textmuy/`) NO hay nada que preservar.
- **Ruta historica abandonada**: los datos que hubieran quedado en la ruta vieja
   `wp-content/uploads/personalizador-pdf/textmuy/` NO se migran (decision R007,
   2026-09): se crean desde cero en `uploads/tm/` (el plugin seedea los catalogos
   vacios en la primera visita a "Estilos de Texto"). Si existieran datos viejos
   que quieras conservar, moverlos a mano: `presets/*` -> `tm/presets/`,
   `imagenes/*` -> `tm/img/` (+ regenerar `img.json`) y `fonts/*` -> `tm/fonts/`.