# TaskFlow API

TaskFlow es una API REST para gestionar usuarios, autenticación JWT y tareas. Es el proyecto del taller Backend – NestJS de Computación en Internet III, Universidad Icesi.

## Equipo

Completar los nombres y perfiles antes de la entrega:

| Integrante | Responsabilidad                | Nombre                  | GitHub       |
| ---------- | ------------------------------ | ----------------------- | ------------ |
| 1          | Autenticación                  | `[Nombre integrante 1]` | `[@usuario]` |
| 2          | Usuarios, roles y autorización | `[Nombre integrante 2]` | `[@usuario]` |
| 3          | Tareas                         | `[Nombre integrante 3]` | `[@usuario]` |

## Tecnologías

- Node.js 24 LTS (el paquete admite Node.js 22 o superior), TypeScript y NestJS 11.
- PostgreSQL 17 y TypeORM 0.3.
- JWT con Passport y bcrypt para autenticación.
- Swagger/OpenAPI, Postman, Jest, ESLint y Prettier.

## Requisitos

- Node.js 22 o superior y npm.
- Docker Desktop u otro runtime compatible con Docker Compose.
- PostgreSQL puede ejecutarse mediante el Compose incluido.

## Instalación y ejecución

Desde la raíz del repositorio:

```bash
npm ci
cp .env.example .env
docker compose up -d
npm run migration:run
npm run start:dev
```

En PowerShell, reemplaza `cp .env.example .env` con `Copy-Item .env.example .env`. La API escucha en `http://localhost:3000` de forma predeterminada. Si el puerto local `5432` ya está ocupado, cambia `DB_PORT` en `.env` a un puerto libre, por ejemplo `5433`; Compose y la API leen ese mismo valor.

La ruta de salud es `GET /api/health`. Swagger está disponible en `http://localhost:3000/api/docs`.

## Variables de entorno

`.env.example` contiene las variables soportadas. `src/config/env.validation.ts` valida el entorno al inicio:

| Variable         | Uso                                    | Valor de ejemplo |
| ---------------- | -------------------------------------- | ---------------- |
| `NODE_ENV`       | Entorno de ejecución                   | `development`    |
| `PORT`           | Puerto HTTP de Nest                    | `3000`           |
| `DB_HOST`        | Host PostgreSQL                        | `localhost`      |
| `DB_PORT`        | Puerto PostgreSQL publicado en el host | `5432`           |
| `DB_USERNAME`    | Usuario PostgreSQL                     | `postgres`       |
| `DB_PASSWORD`    | Contraseña PostgreSQL local            | `postgres`       |
| `DB_DATABASE`    | Base de datos                          | `nest_backend`   |
| `JWT_SECRET`     | Clave de firma JWT                     | `change_me`      |
| `JWT_EXPIRATION` | Duración del token                     | `1h`             |

`.env` está ignorado por Git. Los valores del ejemplo son únicamente para desarrollo local: reemplaza `JWT_SECRET` y las credenciales antes de cualquier despliegue y nunca publiques secretos reales.

## Base de datos, migraciones y seed

TypeORM obtiene conexión y entidades desde la configuración de Nest. `synchronize` y `migrationsRun` están desactivados; por lo tanto, arrancar la API **no crea ni actualiza automáticamente las tablas**. Las migraciones disponibles en `src/database/migrations` crean `users` y luego `tasks`; la migración de tareas depende de que exista `users`.

La migración de usuarios usa `uuid_generate_v4()`. En una instancia PostgreSQL nueva, asegúrate de que esté disponible la extensión `uuid-ossp` antes de aplicar migraciones:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

Comandos TypeORM:

```bash
npm run typeorm -- migration:show
npm run migration:run
npm run migration:revert
npm run migration:generate -- src/database/migrations/DescribeChange
```

No hay seed implementado todavía: `src/database/seeds` contiene solo `.gitkeep`. El registro público crea usuarios `USER`; no hay endpoint público para crear el primer `ADMIN`. La provisión inicial de un administrador debe acordarse y realizarse por un mecanismo controlado por el equipo.

## Endpoints

Las rutas autenticadas requieren `Authorization: Bearer <accessToken>`. El rol se obtiene del usuario vigente cargado por Auth desde PostgreSQL.

| Método y ruta               | Acceso      | Función                                                        |
| --------------------------- | ----------- | -------------------------------------------------------------- |
| `POST /api/auth/register`   | Público     | Registrar usuario `USER`.                                      |
| `POST /api/auth/login`      | Público     | Obtener access token JWT.                                      |
| `POST /api/auth/logout`     | Autenticado | Incrementar `tokenVersion` e invalidar el token.               |
| `GET /api/users/me`         | Autenticado | Consultar el perfil propio.                                    |
| `PATCH /api/users/me`       | Autenticado | Cambiar nombre y/o correo propios.                             |
| `GET /api/users`            | `ADMIN`     | Listar usuarios con `page` y `limit` (máximo 100).             |
| `PATCH /api/users/:id/role` | `ADMIN`     | Cambiar el rol; protege al último administrador.               |
| `POST /api/tasks`           | Autenticado | Crear una tarea propia.                                        |
| `GET /api/tasks`            | Autenticado | Listar tareas propias; permite filtrar por estado y prioridad. |
| `GET /api/tasks/:id`        | Autenticado | Consultar una tarea propia.                                    |
| `PATCH /api/tasks/:id`      | Autenticado | Actualizar una tarea propia.                                   |
| `DELETE /api/tasks/:id`     | Autenticado | Eliminar una tarea propia.                                     |
| `GET /api/admin/tasks`      | `ADMIN`     | Listar todas las tareas con propietario.                       |
| `GET /api/health`           | Público     | Comprobar que responde la API.                                 |

Los DTOs validan entradas y el `ValidationPipe` global transforma valores, aplica whitelist y rechaza propiedades adicionales. Las respuestas de Users omiten `passwordHash` y `tokenVersion`. Las tareas pertenecen a un usuario; una tarea inexistente o ajena se responde como no encontrada.

## Postman

Importa `postman/backend-api.postman_collection.json` y `postman/local.postman_environment.json`, y selecciona **Backend API - Local**. La colección tiene 14 requests correspondientes a los endpoints de la tabla. Ejecuta `Register USER` y `Login (USER or ADMIN)` para guardar `userId` y `accessToken`; luego puedes probar perfil y tareas.

Las solicitudes marcadas ADMIN requieren una cuenta `ADMIN` existente. Configura `adminEmail` y `adminPassword`, cambia `tokenTarget` a `admin` y ejecuta Login para guardar `adminToken`. El registro público no crea administradores. Ejecuta Logout al final porque revoca el token usado.

## Pruebas y calidad

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand
npm run lint
npm run build
```

Las pruebas unitarias Jest cubren Users/roles y Tasks. El repositorio todavía no tiene archivos E2E; por `--passWithNoTests`, `npm run test:e2e` informa “No tests found” y termina con código 0, lo cual **no significa que se haya probado E2E**. La cobertura global observada actualmente está por debajo del 80% requerido por la rúbrica; no se configura un umbral que la haga pasar artificialmente. CI ejecuta lint, pruebas unitarias, E2E, cobertura y build en pull requests y en pushes a `main`/`develop`.

## Estructura principal

```text
src/
├── common/       # Decoradores, guards y enums compartidos
├── config/       # Configuración y validación del entorno
├── database/     # DataSource y migraciones
└── modules/
	├── auth/     # Registro, login, logout y estrategia JWT
	├── users/    # User, perfiles, roles y listado ADMIN
	├── tasks/    # CRUD propio y listado global ADMIN
	└── health/   # Endpoint de salud
postman/          # Colección y environment local
```

## Contexto académico y licencia

Proyecto académico para Computación en Internet III de la Universidad Icesi. El paquete conserva la licencia `UNLICENSED`; no se ha elegido una licencia de distribución.
