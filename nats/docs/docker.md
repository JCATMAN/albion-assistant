# Docker

## Qué es

La imagen del writer. En Compose se llama `writer` y no publica puertos. Redis no va en ese Compose: es la instancia 8 que ya corre en el VPS. El contenedor solo necesita `REDIS_URL` con las credenciales.

## Cómo hacerlo

Build de dos etapas desde `nats/`:

1. `golang:1.23-alpine` compila `cmd/writer` con `CGO_ENABLED=0`.
2. La imagen final es `gcr.io/distroless/static` o `scratch`. El binario es el entrypoint.

En el compose del repo, el servicio queda así de límite: 64 MB de RAM y 0.1 de CPU. Una sola réplica.

```yaml
writer:
  build: ./nats
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    NATS_URL: nats://public:thenewalbiondata@nats.albion-online-data.com:4222
    NATS_SUBJECT: marketorders.deduped
    ALBION_API_BASE: https://west.albion-online-data.com
    REDIS_URL: ${REDIS_URL}
    CELL_TTL: 2h
    STALE_AFTER: 30m
    AVG_ALPHA: "0.2"
    API_RATE_PER_MIN: "150"
  deploy:
    resources:
      limits:
        memory: 64M
        cpus: "0.1"
  restart: unless-stopped
```

`REDIS_URL` sale del `.env` del VPS, por ejemplo `redis://:clave@host.docker.internal:6379/0` si Redis escucha en localhost del host. `WATCH_ITEMS` se agrega cuando se quiera el relleno de arranque.

El writer necesita salida hacia el puerto 4222 de NATS, hacia `west.albion-online-data.com` y hacia el Redis del VPS. No necesita un puerto de entrada.

## Resultado esperado

`docker compose up writer` conecta al Redis del VPS, se suscribe y permanece en ejecución aunque NATS tarde en contestar. `docker compose stop writer` dispara `SIGTERM` y el proceso sale sin dejar el cliente NATS a medias. Una segunda copia del servicio no debe levantarse: la media móvil contaría dos veces.

## Pruebas

La imagen no se prueba en `go test`. El contrato del binario es que `main` respete las señales, y eso lo cubre [proceso.md](proceso.md). Antes de construir la imagen, `go test ./...` dentro de `nats/` tiene que pasar. Un smoke manual, contra el Redis del VPS, es suscribirse y ver una clave `west:*` después de que circule una orden real. El resto de las claves de esa instancia no se toca.
