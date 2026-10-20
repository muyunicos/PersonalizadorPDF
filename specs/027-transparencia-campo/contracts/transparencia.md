# Contrato — politica de transparencia (spec 027)

## 1. La ranura

| Clave | Valores | Default | Que hace |
|---|---|---|---|
| `transp` | `'si'` \| `'no'` | *ausente* = actual | La politica de transparencia del campo (D1) |

## 2. `SelectorPMU` (config)

| Clave | Default | Que hace |
|---|---|---|
| `transp` | `''` (actual) | `'si'` \| `'no'` \| `''`. Viene de la ranura (`cargador-pmu.js`). |

## 3. Reglas de resolucion del fondo

Se aplican **al cargar la imagen** (el "auto") y **al subir** (el fondo final):

| `transp` | Boton "damero" | "auto" con bordes transparentes | "auto" con bordes solidos | Fondo final si el cliente elige color |
|---|---|---|---|---|
| `''` (actual) | visible | `transparent` | color solido | el color elegido |
| `'no'` | **oculto** | **`#ffffff`** (blanco puro) | color solido | el color elegido |
| `'si'` | visible | `transparent` **si hay alfa real**; si no, color solido | color solido | el color elegido (deja de ser transparente) |

## 4. "Capa de transparencia real" (D3 b / D4)

Se evalua sobre una version muestreada de la imagen (max 64 px por lado, el mismo
muestreo que usa la deteccion de bordes): hay alfa real si **algun** pixel tiene
`a < 250`. Un JPEG no tiene canal alfa (`a = 255` siempre) -> nunca hay alfa real.
El perimetro **no** es la unica fuente: una foto con el centro transparente y los
bordes opacos **si** cuenta.

## 5. El fondo final manda (D3 d / D5)

En el momento de subir, el alfa viaja solo si el fondo que se va a dibujar es
`transparent`. Con `transp:'no'` eso **nunca** ocurre (el boton no existe y el auto
resuelve a blanco/color). Con `transp:'si'` ocurre salvo que el cliente elija un
color a mano.

## 6. Lo que NO cambia

- El PNG/WebP resultante **mide lo mismo** que hoy (`min(recorte, hueco)`, spec 025).
- La foto original del cliente (`subidas/`) conserva su alfa **tal cual subio**
  (el recorte a color plano ocurre solo en el pool).
- El PDF final: el Motor arma el **SMask** desde el alfa, igual que hoy.
