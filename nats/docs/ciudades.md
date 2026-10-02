# Ciudades

## Qué es

NATS manda el id numérico del mercado, no el nombre. Redis y el API usan el nombre. Esta tabla es la misma que usa el servidor del Data Project para los mercados que vamos a mostrar.

| Id | Ciudad en la celda |
|---|---|
| 7 | Thetford |
| 1002 | Lymhurst |
| 2004 | Bridgewatch |
| 3003 | Black Market |
| 3005 | Caerleon |
| 3008 | Martlock |
| 4002 | Fort Sterling |
| 5003 | Brecilien |

Los portales ya suelen venir fusionados a la ciudad en el topic deduplicado. Se aceptan igual, por si llega uno sin fusionar:

| Portal | Pasa a |
|---|---|
| 301 | 7 Thetford |
| 1301 | 1002 Lymhurst |
| 2301 | 2004 Bridgewatch |
| 3301 | 3008 Martlock |
| 4301 | 4002 Fort Sterling |

Cualquier otro id (cruces, islas, rest, red de contrabandistas) se descarta. Esos lugares no entran en el filtro del bot y llenarían Redis con celdas que nadie va a pedir.

## Cómo hacerlo

`location.City(id int) (string, bool)` con un mapa estático. Primero portal, después mercado. `ok == false` significa «no escribir».

Los nombres salen escritos exactamente así, con espacio en `Black Market` y en `Fort Sterling`. Son los que acepta `locations=` del API y los que `api/` va a buscar.

## Resultado esperado

`City(3005)` devuelve `Caerleon, true`. `City(301)` devuelve `Thetford, true`. `City(4)` (Swamp Cross) devuelve `false`. `City(0)` devuelve `false`.

## Pruebas

Un caso de tabla por cada fila de las dos tablas, más un id desconocido y el cero. El test no lee `world.json` ni la red: el mapa es código, y el test fija el contrato.
