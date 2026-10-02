# Configuración

## Qué es

El proceso lee el entorno una vez, lo valida y falla el arranque si falta algo obligatorio. No hay URLs de Redis escritas en el código.

## Cómo hacerlo

`config/env.schema.ts` describe las variables. `ConfigModule.forRoot` las carga y un factory las parsea a un objeto tipado `AppConfig`. Quien necesite un valor inyecta `AppConfig`, no `process.env` repartido por los servicios.

| Variable | Obligatoria | Ejemplo |
|---|---|---|
| `PORT` | no | `3000` |
| `REDIS_URL` | sí | `redis://:password@host.docker.internal:6379/0` |
| `ITEMS_URL` | sí | raw de `formatted/items.json` |
| `FRESH_WITHIN` | no | `30m` |
| `DISCORD_PUBLIC_KEY` | sí | public key de la aplicación |
| `DISCORD_TOKEN` | solo el script de registro | token del bot |
| `DISCORD_APP_ID` | solo el script de registro | snowflake de la app |
| `CATALOG_REFRESH` | no | `1h` |

`REDIS_URL` es la instancia Redis 8 del VPS. Misma URL que usa `nats/`, en el `.env` que no se commitea.

`FRESH_WITHIN` decide `fresh` frente a `stale`. Default `30m`, alineado con `STALE_AFTER` del writer. Este proceso no escribe TTL.

## Resultado esperado

Sin `REDIS_URL` o sin `DISCORD_PUBLIC_KEY`, el proceso termina al arrancar y el log nombra la variable. Con el set mínimo, `AppConfig` tiene los defaults de `PORT`, `FRESH_WITHIN` y `CATALOG_REFRESH`.

## Pruebas

Tabla sobre el parser del esquema, pasándole un `Record<string, string | undefined>`. Casos: mínimo válido, falta cada obligatorio, `FRESH_WITHIN=nope` falla, `PORT=0` falla. No se lee `process.env` dentro del test.
