# 024 — Ajustes del modal del selector (controles y guia de recorte)

> Estado: **en implementacion (2026-10-20)** — pulido de UX del modal que definieron las specs
> 016 (editor visual) y 021 (cargador intuitivo). **100% cliente**: el Motor, los datos y el PNG
> de salida no cambian.

## Problema (lo que se vio en la ficha real)

Con una ranura `1000x1000` el comprador veia:

```
Ajusta la imagen (1000x1000 px)          <- medidas tecnicas en el titulo
Salida 1000x1000 px · zoom x1.00         <- dato tecnico al cliente
Reducir / Ampliar --------*--------[↺]   <- etiqueta larga, slider corto, reset que nadie usa
            Rellenar | Ajustar | Estirar <- centrados, sin reset de escala
Fondo [■] Transparente                   <- texto en vez de icono
[Girar] en otra fila que el fondo
[Cargar imagen] [Girar] [Subir] [Cancelar] <- acciones mezcladas, Subir antes de Cancelar
```

Y en la escena, la guia `spmu-envoltura` **oscurecia la foto**: dos velos negros (35% sobre todo +
32% extra en el anillo del 10%) que tapaban lo que el comprador estaba ajustando.

## Decisiones

| # | Decision |
|---|---|
| **D1** | Titulo **`Ajuste la imagen`**, **sin medidas**. Con reemplazo: `Reemplazando imagen #k` (tambien sin medidas). |
| **D2** | El badge de salida (`Salida WxH px · zoom xN`) **no se muestra al cliente**: solo con `tecnico: true` (el preview de la consola). `CargadorPMU` pasa su propio `tecnico` al `SelectorPMU`. |
| **D3** | El control pasa a llamarse **`Escala`**, ocupa **una sola fila al 100%** del ancho y **pierde el boton de reset** (`↺`), que nadie usaba (los modos ya resetean). |
| **D4** | Los **3 modos** (`Rellenar`/`Ajustar`/`Estirar`) van **a la izquierda**, los tres **del mismo ancho**, y al tocarlos **resetean `Escala`** (vuelve a `1x`) y centran la imagen. |
| **D5** | **Fondo** con **icono damero** (transparente) en vez de texto, y **icono `auto`** que **aparece solo si el fondo no es automatico**: vuelve al **color detectado de los bordes** de la foto. Para eso se recuerda `fondoAuto` (detectado) y `fondoEsAuto` (bool). |
| **D6** | **Girar** se mueve a la fila del fondo. Conserva sus dos condiciones (ranura `{ r: 1 }` **y** >5% de diferencia de aspecto) y sigue oculto con `escala: 'sin-ampliar'`. |
| **D7** | **Acciones separadas**: `Cargar imagen` **abajo a la izquierda**; `Cancelar` (secundario) + `Subir` (`button-primary`) **abajo a la derecha**. Se invierte el orden previo (Subir iba antes de Cancelar). |
| **D8** | **`spmu-envoltura` sin velo**: se eliminan los dos rellenos negros. La zona libre queda **totalmente transparente**; solo se dibujan los **contornos** (blanco punteado = placeholder `W x H`; azul punteado = forma/envoltura). |
| **D9** | **Ojito de inspeccion** dentro de `spmu-escena` (arriba a la derecha, `aria-pressed`, ojo abierto/tachado en SVG inline): alterna una **mascara blanca pura `#fff`** fuera de la forma principal para ver **solo el recorte**. El contorno del placeholder pasa a **gris** con la mascara activa (sobre blanco no se veria). **El ojito se muestra solo si la forma recorta** (si cubre todo el placeholder, no hay nada que ocultar y no se pinta un boton muerto). La mascara vive **solo** en el canvas guia: **el PNG de salida y el PDF no cambian**. |

El estado del ojito **arranca siempre apagado** (una apertura nueva no hereda el modo inspeccion).

## Alcance

| Archivo | Cambio |
|---|---|
| `assets/selector-pmu.js` | HTML del modal (`open()`), CSS inyectado, `_pintarEnvoltura()` (2 estados), ojito, `fondoAuto`/`fondoEsAuto`, quitar reset de zoom, `_setZoom(1)` al cambiar de modo, `_badge()` condicionado a `tecnico`, `config.tecnico` |
| `assets/cargador-pmu.js` | pasa `tecnico: this.config.tecnico` al `SelectorPMU` |
| `tests/selector-contrato.test.js` | actualiza los checks de titulo/badge/slider/reset y agrega los nuevos (Escala 100%, sin reset, modos con reset, ojito/mascara, fondo auto, badge solo tecnico) |
| `specs/016.../contracts/selector-visual.md` | enmienda **v4** (controles y guia) |
| `AGENTS.md` §7, `specs/INDICE.md`, `readme.txt` | changelog **4.15.0** |

## Verificacion

- Node: `node tests/selector-contrato.test.js` (todos los checks nuevos), `node tests/campos-contrato.test.js`,
  `node tests/mockup-contrato.test.js`, `node tests/conciliacion.js` (regresion).
- PHP: `php -l`, `php tests/texto_puente.php ficha` / `campo_subida` / `pedido` (el Motor **no** se
  toca), `php tests/motor_smoke.php`, `php tests/parity.php`.
- WP real: abrir el modal en movil -> Escala al 100%, sin reset; tocar un modo y ver que la escala
  vuelve al medio; el fondo con damero y `auto`; el ojito mostrando solo el recorte; y que la zona
  fuera de la forma **ya no se oscurezca**.

## Fuera de alcance

- **Persistir el ojito** entre aperturas (arranca apagado).
- **Ocultar controles por ranura** (p. ej. esconder `Fondo` si la ranura nunca deja huecos).
- **Temas/colores del modal** (sigue el estilo del tema + `.button` de WordPress).
- **Tocar el Motor, los datos o `modules/textmuy/`**.
