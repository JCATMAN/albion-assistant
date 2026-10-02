# API NestJS

Documentación para implementar el proceso que vive en `api/`. Lee el Redis 8 del VPS y responde a Discord. No abre NATS ni llama al API de Albion. Quien escribe las celdas es `nats/`.

El código —archivos, clases, funciones, DTOs, tests y comentarios— va en inglés. Esta documentación está en español. Los identificadores del juego (`T4_BAG`, `Caerleon`, `Black Market`) no se traducen.

## Orden de lectura

| Archivo | Feature |
|---|---|
| [arquitectura.md](arquitectura.md) | Módulos, inglés y regla de tests |
| [configuracion.md](configuracion.md) | Entorno validado al arrancar |
| [catalogo.md](catalogo.md) | `items.json` y el índice de nombres |
| [parser.md](parser.md) | `bolsa t4.1` a filtros |
| [sugerencias.md](sugerencias.md) | `GET /items/suggest` |
| [redis.md](redis.md) | Lectura de celdas |
| [iconos.md](iconos.md) | URL del render |
| [precios.md](precios.md) | `GET /prices` |
| [discord.md](discord.md) | Interactions, autocompletado y embed |
| [docker.md](docker.md) | Imagen y servicio en el VPS |

## Resultado del módulo

Un servicio Nest que:

1. Sugiere ítems en español o inglés sin tocar Redis.
2. Devuelve el precio por ciudad, calidad y encantamiento, con frescura e icono.
3. Recibe el `POST` de Discord, verifica la firma y contesta en menos de 3 segundos.
4. Pasa `npm test` sin red, sin Redis real y sin Discord.

## Fuera de este módulo

Suscripción NATS, respaldo del API de Albion, media móvil y escritura en Redis. Eso es `nats/`.
