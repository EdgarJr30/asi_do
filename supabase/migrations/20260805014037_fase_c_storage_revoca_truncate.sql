-- Fase C, extensión al esquema `storage`: retira los privilegios que no pasan
-- por RLS.
--
-- Contexto. La Fase C (commit `70587d6`) redujo la superficie de tabla de `anon`
-- de 363 grants a 5, pero solo cubrió el esquema `public`. En `storage`, `anon` y
-- `authenticated` conservan `GRANT ALL` sobre `objects` y `buckets`, mientras que
-- **las 17 políticas RLS del esquema apuntan todas a `authenticated`, ninguna a
-- `anon`**. Es el mismo peso muerto que la Fase C retiró de las 52 tablas de
-- `public`, en un esquema que no se revisó.
--
-- Alcance deliberadamente parcial. Esta migración retira **solo** `TRUNCATE`,
-- `TRIGGER` y `REFERENCES`, que son los privilegios que RLS no filtra: `TRUNCATE`
-- vacía la tabla entera sin evaluar una sola política. Ninguna operación de
-- `storage-api` los usa —sube, lee, actualiza y borra fila a fila—, así que
-- retirarlos no puede romper una subida ni un borrado.
--
-- Lo que NO hace y por qué. No revoca `SELECT/INSERT/UPDATE/DELETE` de `anon`
-- sobre `storage.objects`, aunque no haya ninguna política que los respalde.
-- `storage-api` conmuta de rol para evaluar RLS, y sin Docker no hay dónde
-- comprobar que revocarlos no rompe subidas y borrados antes de tocar el remoto.
-- Eso exige una sesión de verificación con una cuenta real: subida y borrado de
-- avatar, logo de empresa, CV y recibo de membresía. Queda anotado en TASK-255.
--
-- Por qué no es un agujero activo hoy: `storage` no está expuesto por PostgREST
-- y `storage-api` no ofrece SQL arbitrario, así que ningún portador de la anon
-- key puede emitir un `TRUNCATE`. Esto cierra la puerta antes de que una
-- configuración futura la abra, no un incidente en curso.

revoke truncate, trigger, references on storage.objects from anon, authenticated;
revoke truncate, trigger, references on storage.buckets from anon, authenticated;
revoke truncate, trigger, references on storage.buckets_analytics from anon, authenticated;
