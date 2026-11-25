# campos-consola Specification

## Purpose

Campos reutilizables v3 (indice + carpeta por campo), consola de administracion,
CSS/JS global del plugin, preview con el mismo montaje que la ficha, ranura adaptativa
y tipo/overrides que declaran intencion sin enrutar.

## Requirements

### Requirement: Formato v3 de campos
El sistema SHALL guardar `uploads/pmu/campos/campos.json` como indice
(`{version:3, items:[{id,tipo,baja}], meta}`) y cada campo en su carpeta
`campos/{id}/` con `datos.json` + `campo.htm` + `campo.css` + `campo.js`, sin reciclar
ids (baja = tombstone).

#### Scenario: Baja de un campo
- **WHEN** se da de baja un campo
- **THEN** queda `baja:true` conservando sus archivos y su id no se reutiliza

### Requirement: Tipo declara intencion
El sistema SHALL permitir elegir y corregir el `tipo` (`texto|imagen|opciones`) del campo,
que declara la intencion y no enruta la salida; la salida la decide el placeholder y el
tipo solo sirve para avisar cuando el cableado no coincide.

#### Scenario: Tipo corregido en edicion
- **WHEN** se corrige el tipo de un campo existente
- **THEN** se guarda el nuevo tipo sin migrar datos ni cambiar el enrutado

### Requirement: Valor dual valor/cliente
El sistema SHALL publicar la pareja `valor`/`cliente` desde el `campo.js`
(`function(ctx, root)`) o, si no hay JS, desde los `[data-rol]` del HTML, y `cliente`
nunca cae a `valor`.

#### Scenario: Campo sin JS
- **WHEN** un campo no trae `campo.js`
- **THEN** `valor` y `cliente` se leen de los `[data-rol]` del HTML

### Requirement: CSS/JS global del plugin
El sistema SHALL proveer `uploads/pmu/campos/global.css` y `global.js`, unicos para todo
el plugin, cargados solo en fichas con >=1 campo; el CSS prefijado con `[data-pmu-panel]`
y el JS inyectado sobre `campo-montar`.

#### Scenario: Ficha sin campos
- **WHEN** una ficha no tiene campos
- **THEN** no se cargan `global.css` ni `global.js`

### Requirement: Consola sin recarga
El sistema SHALL responder a los POST de la consola solo con JSON (`responder()` nunca
redirige) y SHALL pintar errores inline; solo recargan en exito Subir PDF, Re-analizar y
Borrar.

#### Scenario: Error inline
- **WHEN** un POST de la consola falla
- **THEN** el error se pinta inline sin pagina en blanco

### Requirement: Ranura adaptativa phsize
El sistema SHALL resolver `phsize: 0|1|2` por ranura en `PMU_API.montarCargador`
(`PURO.normalizarRanura`), publicando `grupo_w`/`grupo_h`/`grupo_gid`, y SHALL degradar
con aviso si no hay guia deducible.

#### Scenario: phsize 1 usa el grupo
- **WHEN** una ranura declara `phsize: 1` y hay grupo con envoltura
- **THEN** la ranura adopta el tamano del grupo base

#### Scenario: phsize sin guia
- **WHEN** `phsize > 0` pero no hay guia deducible
- **THEN** degrada con aviso y usa el default

### Requirement: Guia de envoltura deducida
El sistema SHALL deducir la guia de envoltura del cableado del hueco
(`campos_envoltura_deducida`), sin `<select>` manual, e informar "automatica: #gid".

#### Scenario: Guia deducida del cableado
- **WHEN** un grupo con envoltura se cablea a un campo imagen
- **THEN** la guia se deduce del cableado y se informa como automatica

### Requirement: Overrides por placeholder
El sistema SHALL fusionar los overrides del campo en orden hacia `items[].overrides`, con
`settings` como lista de referencias.

#### Scenario: Override aplicado
- **WHEN** un campo declara overrides
- **THEN** se fusionan en orden sobre los items del placeholder
