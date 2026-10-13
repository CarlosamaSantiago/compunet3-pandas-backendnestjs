# Despliegue de TaskFlow en Railway

## Arquitectura y configuración

Cliente → HTTPS de Railway → NestJS → PostgreSQL del proyecto Railway.

- API: https://compunet3-pandas-backendnestjs-production.up.railway.app
- Salud: `/api/health`; Swagger: `/api/docs`; OpenAPI: `/api/docs-json`.
- El responsable confirmó el 12 de octubre de 2026 que Source apunta a `main` y tiene **Wait for CI** activado. Railway espera el resultado de GitHub Actions antes del despliegue automático. [Documentación de Railway](https://docs.railway.com/deployments/github-autodeploys).
- `railway.json` compila con `npm run build`, ejecuta `npm run railway:predeploy`, inicia `npm run start:prod` y comprueba `/api/health`.
- El predeploy aplica las migraciones compiladas y luego el seed idempotente. Cualquier error devuelve un código distinto de cero y bloquea el despliegue. Las réplicas de Nest no ejecutan migraciones al arrancar (`migrationsRun: false`, `synchronize: false`).
- PostgreSQL debe tener su volumen persistente asociado. La permanencia del volumen y sus backups se comprueban en Railway; no se pueden inferir de una respuesta HTTP.

## Variables del servicio API

Configurar en Railway, nunca en archivos versionados:

| Variable | Configuración |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Puerto proporcionado por Railway |
| `DB_HOST`, `DB_PORT` | Referencias a `PGHOST`, `PGPORT` del servicio PostgreSQL |
| `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | Referencias a `PGUSER`, `PGPASSWORD`, `PGDATABASE` |
| `JWT_SECRET` | Secreto aleatorio privado |
| `JWT_EXPIRATION` | Duración del token, por ejemplo `1h` |
| `SEED_ADMIN_PASSWORD`, `SEED_USER_PASSWORD` | Contraseñas privadas de al menos ocho caracteres |

La aplicación lee las variables `DB_*`; una `DATABASE_URL` sola no sustituye esta configuración. El seed no cambia las contraseñas de cuentas ya existentes. No publicar tokens, contraseñas ni exportaciones Postman con esos valores.

## Validación y evidencia

Comprobación HTTP de lectura del 12 de octubre de 2026: salud 200, Swagger 200, OpenAPI con 14 operaciones, Tasks y perfil sin token 401. Esta comprobación no acredita todos los flujos autenticados ni revela el commit desplegado.

La validación funcional automatizada se realiza localmente y en CI con PostgreSQL de pruebas: 47 E2E, migraciones sobre esquema vacío, seed y colección Tasks. El healthcheck confirma respuesta del proceso; no es una prueba de disponibilidad de PostgreSQL.

Antes de entregar:

1. Integrar los PR revisados en `develop` y luego en `main`; comprobar Actions aprobado para ese SHA.
2. En Railway, comprobar que el deployment activo corresponde al mismo SHA y que el predeploy terminó correctamente.
3. Guardar evidencia del volumen de PostgreSQL y probar persistencia después de reiniciar el servicio API.
4. Con credenciales privadas, verificar login USER/ADMIN y un CRUD de una tarea propia; eliminar la tarea de prueba.
5. Adjuntar al informe los enlaces de Actions/deployment y las evidencias sin secretos.

En esta rama se conserva la integración nativa Railway–GitHub. No se requiere duplicar el despliegue con un segundo workflow ni guardar un token Railway en GitHub.
