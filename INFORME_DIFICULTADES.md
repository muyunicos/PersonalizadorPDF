# Informe de Dificultades - Extractor Corel

Documenta las dificultades encontradas durante el analisis del proyecto y como resolverlas en futuras interacciones.

---

## 1. Problemas con paths que contienen espacios

**Error**: Los comandos `dir` y `powershell` fallaban con errores como:
- `"El nombre de archivo, el nombre de directorio o la sintaxis de la etiqueta del volumen no son correctos"`
- `"El sistema no puede encontrar el archivo especificado"`

**Causa**: El directorio se llama `Extractor Corel` (con espacio), y aunque lo ponia entre comillas en algunos comandos, otros no las aceptaban bien.

**Solucion**: Usar `search_codebase` y `read_files` directamente; evitar `dir`/`ls` con paths largos. Estas herramientas manejan correctamente los espacios en los paths.

---

## 2. PowerShell con problemas de escaping

**Error**: Multiples intentos con `powershell -Command` fallaron:
- Errores de parser por comillas mal escapadas
- Comandos que devolvian la ayuda en lugar de ejecutarse
- Timeouts

**Causa**: El escaping de comillas y backslashes en comandos anidados de PowerShell es muy problematico en Windows.

**Solucion**: Preferir `cmd /c` comandos simples o evitar shell; usar las tools nativas (`search_codebase`, `read_files`, `editor`).

---

## 3. Fetch de paginas web que requieren autenticacion

**Error**: Intentar fetchear `https://muyunicos.com/wp-admin/admin.php?page=extractor-corel` devolvio `HTTP 404 Not Found`.

**Causa**: Las paginas de admin de WordPress requieren autenticacion (cookie de session). No se puede acceder por web scraping sin las cookies.

**Solucion**: No intentar fetchear paginas de wp-admin. En su lugar, pedir al usuario que describa la pagina o asumir basandose en elcodigo existente.

---

## 4. Limitacion de busqueda a 20 archivos

**Error**: `search_codebase` busco solo 20 archivos y no encontro los archivos PHP principales del plugin (como el archivo principal del plugin con `add_menu_page`, `add_action`, etc.).

**Causa**: La herramienta tiene un limite de 20 archivos por busqueda, y los archivos PHP del plugin no estaban en esos primeros 20.

**Solucion**: Hacer multiples busquedas con patrones especificos; combinar con `read_files` si se conoce la ruta. Si no aparecen, probablemente no estan indexados.

---

## 5. No se encontraron archivos PHP del plugin

**Error**: Patrones como `add_menu_page`, `add_submenu_page`, `admin_menu`, `add_action`, `<?php`, `Plugin Name` dieron 0 resultados.

**Causa**: Los archivos PHP del plugin WordPress (el archivo principal con el header, los controllers, etc.) no estan en los primeros 20 archivos indexados por `search_codebase`.

**Solucion**: Inferir la estructura basandose en `readme.txt`, assets, y archivos de test. Pedir al usuario las rutas exactas si es necesario.

---

## Resumen para Futuras Interacciones

| Dificultad | Solucion |
|------------|----------|
| Paths con espacios (`Extractor Corel`) | Usar `search_codebase` y `read_files` directamente; evitar `dir`/`ls` con paths largos |
| PowerShell en Windows | Preferir `cmd /c` comandos simples o evitar shell; usar las tools nativas |
| Paginas wp-admin sin auth | No intentar fetchear; pedir al user que describa la pagina o asumir basandose en el codigo |
| Limite de 20 archivos en busqueda | Hacer multiples busquedas con patrones especificos; combinar con `read_files` si se sabe la ruta |
| Archivos PHP no encontrados | Si `search_codebase` no los encuentra, probablemente no estan indexados; pedir al user las rutas exactas |
