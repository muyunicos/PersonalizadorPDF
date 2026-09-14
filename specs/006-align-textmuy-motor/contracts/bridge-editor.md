# Contrato: Puente sistema ↔ editor (align-textmuy-motor)

**Fecha**: 2026-09-14 | **Feature**: 006-align-textmuy-motor

Canal único por el que el sistema entrega al editor sus bases de lectura, su credencial y sus inventarios iniciales, y por el que el editor solicita operaciones.

## Mensaje

```text
postMessage({
  type: 'textmuy-bridge',
  bridge: {
    urls: {
      motor:         '<endpoint único del motor>',
      miniaturas:    '<script del motor de miniaturas del cliente>',
      presetsBase:   '<uploads/pmu/tm-presets/>',
      fuentesBase:   '<uploads/pmu/fonts/>',
      imagenesBase:  '<uploads/pmu/img/>'
    },
    nonces: { motor: '<credencial de operaciones>' },
    presets:  [ ... ],
    imagenes: [ ... ],
    fuentes:  [ ... ]
  }
})
```

## Momentos de envío

1. Carga del iframe del editor.
2. Aviso de disponibilidad del editor (`textmuy-ready`).
3. Envío inmediato (por si el iframe terminó de cargar antes que el emisor).

## Reglas del lado del sistema

- Las cinco claves de `urls` son obligatorias y apuntan a la **raíz única**.
- Los inventarios iniciales salen del motor de recursos (mismo contrato que `op=listar`).
- Una sola credencial `nonces.motor` para la acción `pmu_uploads`; el endpoint verifica además la capacidad. Prohibidas las credenciales por operación.
- Prohibido: emitir claves por operación (guardar/borrar/subir/cambiar por recurso), emitir bases de una raíz alternativa o emitir rutas locales del módulo.

## Reglas del lado del editor

| Regla | Detalle |
|---|---|
| Único acceso | Toda lectura usa `urls.*Base`; toda escritura usa `POST urls.motor` con `op` |
| Sin base de respaldo | No existen rutas relativas de respaldo, ni lectura de archivos locales del módulo |
| Sin datos embebidos | Prohibido guardar imágenes como data-URL o descargar archivos cuando no hay puente |
| Ámbitos | El editor envía el `scope` vigente (`fonts`, `img`, `tm-presets`); mapea su ámbito interno de estilos a `tm-presets` |
| Sin puente | Estado de error visible y accionable; cero peticiones locales |
| Versión de caché | Al cambiar JS del módulo se sube el número `?v=RCn` en ambos HTML |

## Purga asociada (misma entrega)

- Claves por operación del puente y su código cliente.
- Bases de respaldo (`presets/`, `fonts/`, `img/`) en el cliente.
- Descarga de estilos guardados sin puente, migración de estilos locales y carga local embebida.
- Lectura de formatos anteriores en el parser de catálogo.

## Trazabilidad

Cubre FR-002, FR-003, FR-004 y FR-016; habilita US1 (galerías visibles), US2 (raíz única) y US3 (fallos visibles).
