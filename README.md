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
- En Windows x64, instalar [Microsoft Visual C++ Redistributable x64](https://learn.microsoft.com/es-es/cpp/windows/latest-supported-vc-redist). El resolvedor nativo de Jest necesita este runtime. Si Node encuentra `ts-jest` pero Jest informa que falta y `unrs-resolver` devuelve `Cannot find native binding`, comprobar el runtime antes de reinstalar dependencias. Se puede instalar con `winget install --id Microsoft.VCRedist.2015+.x64 --exact --source winget`.

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

El script `npm run seed` crea `admin@taskflow.com` (ADMIN), `user1@taskflow.com` y `user2@taskflow.com` (USER), y seis tareas. Configura `SEED_ADMIN_PASSWORD` y `SEED_USER_PASSWORD` en `.env` antes de ejecutarlo; ambas requieren al menos ocho caracteres. Las contraseñas se guardan con bcrypt. Tras aplicar las migraciones, puedes repetir el seed: conserva los usuarios existentes y no duplica las tareas iniciales por propietario y título.

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

Cada integrante edita su colección: Auth (1), Users (2), Tasks y Health (3). Ejecuta `npm run postman:build` para generar `postman/backend-api.postman_collection.json`: 97 peticiones que cubren los 14 endpoints, incluyendo casos positivos y negativos. Importa también `postman/local.postman_environment.json` y configura las credenciales ADMIN localmente.

`npm run postman:tasks` ejecuta Tasks con Newman contra la API local. Usa una base de pruebas: crea dos cuentas y limpia las tareas al terminar. Preparación, variables y reparto en [postman/README.md](postman/README.md).

## Despliegue

- [API pública](https://compunet3-pandas-backendnestjs-production.up.railway.app/api/health).
- [Swagger](https://compunet3-pandas-backendnestjs-production.up.railway.app/api/docs).

Railway despliega desde main con Wait for CI activado, según confirmación del responsable. El predeploy aplica migrations y seed; cualquier error impide continuar. La API arranca con el esquema ya migrado. Variables, arquitectura y verificaciones pendientes en [DEPLOYMENT.md](DEPLOYMENT.md).

## Pruebas y calidad

```bash
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand
npm run lint
npm run build
```

Las pruebas unitarias Jest cubren Auth, Users/roles y Tasks. Los E2E de Auth usan PostgreSQL real y cargan las credenciales desde `.env` o el entorno del proceso. La base de pruebas se selecciona mediante `DB_DATABASE_TEST` (por defecto `nest_backend_test`), independientemente de `DB_DATABASE`.

Prepara la base de pruebas después de levantar Compose:

```bash
docker compose exec -T postgres createdb -U postgres nest_backend_test
npm run test:e2e -- --runInBand
```

El comando `createdb` se ejecuta una sola vez; si la base ya existe, no hace falta repetirlo. Si cambiaste `DB_USERNAME` o `DB_DATABASE_TEST`, ajusta el usuario y el nombre del comando. La suite E2E exige un nombre terminado en `_test`, limpia el esquema de esa base y aplica las migraciones antes de probar. No uses una base con datos que debas conservar.

Verificación local del 12 de octubre de 2026: 87 pruebas unitarias y 47 E2E aprobados (18 de Auth y 29 de Tasks); lint y build correctos. Tasks cubre CRUD, propiedad, filtros, paginación, entradas inválidas, ADMIN, persistencia al reiniciar Nest y clave foránea con eliminación en cascada. Las suites se ejecutan en serie porque comparten la base de pruebas. Cada suite recrea el esquema mediante migraciones y comprueba que una segunda ejecución no tenga migraciones pendientes.

La cobertura unitaria fue 95.93% statements, 87.82% branches, 89.28% functions y 96.82% lines. Jest exige un mínimo global de 80% en las cuatro métricas; los comandos fallan si no encuentran pruebas. Se conservan las exclusiones de módulos, arranque, configuración y scripts de base de datos: el montaje de Nest y las migraciones se verifican mediante E2E; el seed se validó por ejecución repetida en PostgreSQL. Estas cifras corresponden a la cobertura unitaria, no a una combinación con E2E.

CI ejecuta instalación, lint, unitarias, migraciones, E2E, cobertura, build, validación de la colección integrada y escenarios Tasks con Newman. La validación de GitHub Actions quedará pendiente hasta publicar la rama; los resultados anteriores son de ejecución local.

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
