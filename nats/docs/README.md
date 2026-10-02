# Writer NATS en Go

Documentación para implementar el proceso que vive en `nats/`. Es el único escritor de precios. `api/` lee Redis y atiende a Discord. Este módulo no registra comandos ni abre el gateway.

Región de esta versión: Américas. El diseño de celdas, el promedio y el respaldo están en `context-idea.md`. Aquí está cómo construirlos y cómo probarlos.

## Orden de lectura

| Archivo | Feature |
|---|---|
| [arquitectura.md](arquitectura.md) | Paquetes, fronteras y regla de tests |
| [configuracion.md](configuracion.md) | Variables y validación al arrancar |
| [conexion.md](conexion.md) | Suscripción a `marketorders.deduped` |
| [orden.md](orden.md) | JSON de una orden a un struct válido |
| [ciudades.md](ciudades.md) | `LocationId` numérico a nombre de ciudad |
| [celda.md](celda.md) | Mejor venta y mejor compra |
| [promedio.md](promedio.md) | Media móvil solo cuando el mejor precio cambia |
| [redis.md](redis.md) | Hash, TTL y lectura atómica |
| [respaldo-api.md](respaldo-api.md) | Arranque en frío y celdas viejas vía API |
| [proceso.md](proceso.md) | Un solo loop, reconexión y apagado |
| [docker.md](docker.md) | Imagen y servicio en Compose |

## Resultado del módulo

Un binario que, con las credenciales del Redis 8 del VPS:

1. Se suscribe a NATS Américas y no termina si la conexión se cae.
2. Por cada orden deduplicada escribe una celda `west:{item}:{ciudad}:q{calidad}:e{encantamiento}`.
3. Mantiene `sell_min` / `buy_max` y su media móvil.
4. Si NATS no trae datos, rellena esas celdas desde el API, por debajo del rate limit.
5. Pasa `go test ./...` sin red.

## Fuera de este módulo

Nombres en español, autocompletado, iconos, slash commands y `GET /prices`. Eso es `api/`. El historial de ventas cerradas (`markethistories.deduped`) no se consume.
