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

## Notas importantes (v4.1)

- **Esta carpeta NO se versiona**: `modules/textmuy/` esta en `.gitignore`.
   El modulo tiene su propio repositorio/proyecto fuente.
- **El modulo es solo codigo (v4.1)**: NO trae datos. Los presets (`.txm`/`.webp`),
   imagenes y fuentes del administrador viven en
   `wp-content/uploads/personalizador-pdf/textmuy/{presets,imagenes,fonts}`.
   Al actualizar el modulo (reemplazar `modules/textmuy/`) NO hay nada que preservar.