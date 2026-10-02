# Configuración

## Qué es

Todo lo que cambia entre máquinas entra por el entorno. Si falta una variable obligatoria, el proceso termina al arrancar con un error concreto. No hay defaults silenciosos para Redis ni para NATS.

## Cómo hacerlo

`internal/config.Load()` lee el entorno y devuelve un struct. `main` llama a `Load` antes de conectar.

| Variable | Obligatorio | Ejemplo |
|---|---|---|
| `NATS_URL` | sí | `nats://public:thenewalbiondata@nats.albion-online-data.com:4222` |
| `NATS_SUBJECT` | no | `marketorders.deduped` |
| `ALBION_API_BASE` | sí | `https://west.albion-online-data.com` |
| `REDIS_URL` | sí | `redis://:clave@host.docker.internal:6379/0` |
| `CELL_TTL` | no | `2h` |
| `STALE_AFTER` | no | `30m` |
| `AVG_ALPHA` | no | `0.2` |
| `WATCH_ITEMS` | no | `T4_BAG,T5_BAG` |
| `API_RATE_PER_MIN` | no | `150` |

Defaults de código, cubiertos por test: subject `marketorders.deduped`, TTL `2h`, stale `30m`, alpha `0.2`, rate `150`. `WATCH_ITEMS` vacío significa que no hay barrido de arranque.

`API_RATE_PER_MIN` se rechaza si es mayor a 180. El tope público del proyecto es 180 por minuto y 300 cada 5 minutos. 150 deja margen.

La URL de NATS de Américas es pública, publicada por el Data Project. Aun así entra por entorno, para poder apuntar los tests a un servidor local.

`REDIS_URL` apunta al Redis 8 que ya está en el VPS. Trae usuario y clave si la instancia los pide (`redis://usuario:clave@host:6379/0`). Vive en el entorno o en un `.env` que no se commitea. El código no tiene una URL de respaldo.

## Resultado esperado

```go
cfg, err := config.Load(env)
```

Con el set mínimo (`NATS_URL`, `ALBION_API_BASE`, `REDIS_URL`) `err` es nil y los defaults están puestos. Sin `REDIS_URL`, `err` menciona `REDIS_URL` y no hay struct a medio llenar.

## Pruebas

Tabla en `config_test.go`. Casos: mínimo válido, falta cada obligatorio, `CELL_TTL=nope` falla, `API_RATE_PER_MIN=181` falla, `WATCH_ITEMS` con espacios queda `[]string{"T4_BAG","T5_BAG"}`, `AVG_ALPHA=0` y `AVG_ALPHA=1.5` fallan. `Load` recibe un `map[string]string` o una función `getenv`, no `os.Environ`, para no depender de la máquina.
