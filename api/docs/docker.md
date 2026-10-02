# Docker

## Qué es

La imagen del API. En Compose se llama `api`. Publica el puerto solo hacia el proxy del VPS, que termina TLS. Redis no va en el Compose: es la instancia 8 que ya está en el VPS.

## Cómo hacerlo

Build de varias etapas desde `api/`:

1. `node:22-alpine` instala, compila con `nest build` y deja solo las dependencias de producción.
2. La imagen final usa el mismo `node:22-alpine`, usuario no root, `node dist/main.js`.

```yaml
api:
  build: ./api
  extra_hosts:
    - "host.docker.internal:host-gateway"
  environment:
    PORT: "3000"
    REDIS_URL: ${REDIS_URL}
    ITEMS_URL: https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json
    FRESH_WITHIN: 30m
    CATALOG_REFRESH: 1h
    DISCORD_PUBLIC_KEY: ${DISCORD_PUBLIC_KEY}
  ports:
    - "3000:3000"
  deploy:
    resources:
      limits:
        memory: 192M
        cpus: "0.2"
  restart: unless-stopped
```

`REDIS_URL` y `DISCORD_PUBLIC_KEY` salen del `.env` del VPS. El token del bot no hace falta en este contenedor: solo lo usa `npm run register:commands`, que se ejecuta aparte.

El límite de 192 MB cubre el proceso y el catálogo en memoria. Se puede levantar más de una réplica de `api` porque no escribe Redis. Discord tiene que apuntar a una sola URL pública. El proxy reparte si hay varias réplicas.

`GET /health` es el healthcheck. No toca Redis. Si Redis no conecta, `/prices` falla y `/items/suggest` sigue respondiendo: el catálogo ya está en memoria.

## Resultado esperado

`docker compose up api` carga el catálogo, conecta al Redis del VPS y acepta `POST /discord/interactions` detrás del proxy. Reiniciar el contenedor no borra celdas. Una firma de Discord inválida sigue siendo 401 dentro del contenedor.

## Pruebas

La imagen no entra en `npm test`. Antes de construirla, `npm test` y `npm run build` tienen que pasar. El smoke en el VPS es `GET /health` y un `GET /items/suggest?q=bolsa%20t4` sin abrir NATS.
