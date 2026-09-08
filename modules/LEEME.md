# Carpeta de módulos del plugin

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
           ├── css/  js/  fonts/  presets/  tests/ ...
   ```
2. Verifica que `modules/textmuy/index.html` exista: la pestana "Estilos de Texto"
   del admin lo detecta y monta el iframe; si falta, muestra un aviso con estas
   instrucciones en su lugar.

## Notas importantes (v4.0.0)

- **Esta carpeta NO se versiona**: `modules/textmuy/` esta en `.gitignore`.
  El modulo tiene su propio repositorio/proyecto fuente.
- **Los presets (.txm/.webp) e imagenes del administrador NO viven aqui** desde la
  v4.0.0: se guardan en `wp-content/uploads/personalizador-pdf/textmuy/{presets,imagenes}`.
  Al actualizar el modulo (reemplazar `modules/textmuy/`) NO hay nada que preservar.
- La carpeta `presets/` que traiga el modulo solo se usa en modo **standalone**
  (fuera de WordPress); dentro del plugin el almacenamiento unico es uploads.
