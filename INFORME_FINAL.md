# TaskFlow — Informe final

Oct 13, 2026 · https://github.com/CarlosamaSantiago/compunet3-pandas-backendnestjs

## 1. Resumen y alcance

TaskFlow es una API REST en NestJS que gestiona usuarios, autenticación con JWT, roles (USER y ADMIN) y tareas personales, con persistencia en PostgreSQL mediante TypeORM. Expone 14 endpoints bajo el prefijo `/api`, documentados en Swagger, y está desplegada en Railway con HTTPS.

| Elemento | Detalle |
| --- | --- |
| Curso | Computación en Internet III, Universidad Icesi |
| Stack | Node.js 24 LTS (mínimo 22), TypeScript, NestJS 11, PostgreSQL 17, TypeORM 0.3 |
| Seguridad | JWT con Passport, hash bcrypt (10 rondas), validación con class-validator |
| Calidad | Jest, Supertest, ESLint, Prettier, Husky, GitHub Actions |
| API desplegada | [/api/health](https://compunet3-pandas-backendnestjs-production.up.railway.app/api/health) |
| Swagger | [/api/docs](https://compunet3-pandas-backendnestjs-production.up.railway.app/api/docs) |

**Equipo y responsabilidades**

| Integrante | Responsabilidad | Nombre | Usuario de GitHub |
| --- | --- | --- | --- |
| 1 | Autenticación, JWT, logout y pruebas de Auth | Joshua Sayur | joshsg9 |
| 2 | Usuarios, roles, entidad User y pruebas de autorización | Maria Jose | Mariajj07 |
| 3 | Tareas, entidad Task, propiedad, filtros y pruebas de Tasks | Santiago Carlosama | CarlosamaSantiago |

Fuera de alcance, según el enunciado: frontend, equipos, proyectos, comentarios, adjuntos, notificaciones, correo, chat, inteligencia artificial y microservicios.

## 2. Arquitectura y decisiones técnicas

La API se organiza en cuatro módulos de NestJS (`auth`, `users`, `tasks`, `health`) con controladores, servicios, DTO y entidades separados; los guards y decoradores compartidos viven en `common`.

```text
src/
├── common/      decoradores (@Public, @Roles, @CurrentUser), guards (JwtAuthGuard, RolesGuard), enums
├── config/      configuración tipada y validación del entorno con Joi
├── database/    DataSource, migrations y seed
└── modules/
    ├── auth/    registro, login, logout y estrategia JWT
    ├── users/   perfil, listado y cambio de rol (ADMIN)
    ├── tasks/   CRUD propio y listado global (ADMIN)
    └── health/  comprobación de disponibilidad
```

| Decisión | Cómo se implementó | Por qué |
| --- | --- | --- |
| Rutas protegidas por defecto | `JwtAuthGuard` registrado como `APP_GUARD`; las rutas públicas usan `@Public()` | Una ruta nueva nace protegida; olvidar un decorador no abre un endpoint |
| Roles en el servidor | `@Roles(Role.ADMIN)` más `RolesGuard`, que compara con el usuario cargado de la base | El rol no se toma del JWT, así un cambio aplica de inmediato (RN-07) |
| Validación global | `ValidationPipe` con `whitelist`, `transform` y `forbidNonWhitelisted` | Rechaza campos extra (por ejemplo `role` o `userId`) con 400 |
| Entradas normalizadas | `@Transform` recorta espacios y pasa el correo a minúsculas | Evita duplicados por mayúsculas o espacios |
| Esquema versionado | Migrations; `synchronize` y `migrationsRun` desactivados | La base se construye igual en local, CI y producción |
| Configuración por entorno | Variables validadas al iniciar (`DB_*`, `JWT_SECRET` de mínimo 8 caracteres, `JWT_EXPIRATION`) | La API no arranca con un entorno incompleto |
| Respuestas públicas | `passwordHash` con `select: false` y mapeo explícito a un tipo público | No se exponen `passwordHash` ni `tokenVersion` (RN-08) |

## 3. Autenticación y autorización

Cada petición autenticada se valida contra la base de datos, no solo contra el JWT: el servidor comprueba la firma, el vencimiento, la versión de sesión y el rol vigente del usuario.

**Autenticación**

- **Registro.** La contraseña se guarda con bcrypt (10 rondas). El servicio nunca recibe un rol del cliente, así que toda cuenta pública queda como USER. Un correo repetido viola la restricción única de PostgreSQL (código 23505) y se responde 409.
- **Login.** Compara la contraseña con bcrypt; si el correo no existe compara contra un hash falso para que el tiempo de respuesta no revele qué cuentas existen. El mismo mensaje, "Credenciales incorrectas" (401), cubre correo inexistente y contraseña errónea. Devuelve `accessToken`, `tokenType: Bearer` y `expiresIn` en segundos.
- **JWT.** Lleva `sub` (id del usuario) y `tokenVersion`. La estrategia de Passport rechaza tokens vencidos, con firma inválida, de un usuario inexistente o con una `tokenVersion` distinta a la guardada (401, "Token inválido o revocado").
- **Logout.** Incrementa `tokenVersion` del usuario y responde 204. Todos los tokens emitidos antes quedan inválidos en la siguiente petición.

**Autorización**

| Regla | Mecanismo | Resultado |
| --- | --- | --- |
| Rutas de ADMIN (`GET /users`, `PATCH /users/:id/role`, `GET /admin/tasks`) | `@Roles(Role.ADMIN)` y `RolesGuard` | USER recibe 403 |
| El rol se lee de la base en cada petición | `JwtStrategy.validate` devuelve el usuario cargado de PostgreSQL | Un cambio de rol aplica con el mismo token, sin volver a iniciar sesión |
| El último ADMIN no pierde el rol | Transacción con bloqueo consultivo (`pg_advisory_xact_lock`) y bloqueo de fila; si solo hay un ADMIN, la degradación se rechaza | 409 "No se puede quitar el rol al último ADMIN"; el bloqueo evita que dos peticiones simultáneas lo eludan |
| Propiedad de las tareas | Toda consulta filtra por `id` y `userId` del usuario autenticado | Una tarea ajena o inexistente devuelve 404; un ADMIN la ve en su listado general, pero no puede editarla ni eliminarla |
| `userId` y `role` no vienen del cliente | `forbidNonWhitelisted` y DTO sin esos campos | 400 si se envían |

## 4. Endpoints

Los 14 endpoints usan el prefijo `/api`. Las rutas autenticadas exigen `Authorization: Bearer <accessToken>`; Swagger los documenta con ejemplos en `/api/docs`.

| Endpoint | Acceso | Entrada | Éxito | Errores |
| --- | --- | --- | --- | --- |
| `GET /health` | Público | — | 200 `{"status":"ok"}` | — |
| `POST /auth/register` | Público | `name`, `email`, `password` | 201 usuario público con rol USER | 400, 409 |
| `POST /auth/login` | Público | `email`, `password` | 200 `accessToken`, `tokenType`, `expiresIn` | 400, 401 |
| `POST /auth/logout` | Autenticado | — | 204 sin cuerpo | 401 |
| `GET /users/me` | Autenticado | — | 200 perfil | 401, 404 |
| `PATCH /users/me` | Autenticado | `name` y/o `email` (al menos uno) | 200 perfil actualizado | 400, 401, 409 |
| `GET /users` | ADMIN | query `page`, `limit` | 200 página de usuarios | 400, 401, 403 |
| `PATCH /users/:id/role` | ADMIN | `id` UUID; cuerpo `role` | 200 usuario con el nuevo rol | 400, 401, 403, 404, 409 |
| `POST /tasks` | Autenticado | `title`; opcionales `description`, `status`, `priority`, `dueDate` | 201 tarea propia | 400, 401 |
| `GET /tasks` | Autenticado | query `status`, `priority`, `page`, `limit` | 200 página de tareas propias | 400, 401 |
| `GET /tasks/:id` | Propietario | `id` UUID | 200 detalle | 400, 401, 404 |
| `PATCH /tasks/:id` | Propietario | `id` UUID; al menos un campo de la tarea | 200 tarea actualizada | 400, 401, 404 |
| `DELETE /tasks/:id` | Propietario | `id` UUID | 204 sin cuerpo | 400, 401, 404 |
| `GET /admin/tasks` | ADMIN | query `page`, `limit` | 200 todas las tareas con `user` (`id`, `name`, `email`) | 400, 401, 403 |

**Reglas de validación de las entradas**

| Campo | Regla |
| --- | --- |
| `name` | 2 a 100 caracteres, sin espacios externos |
| `email` | Formato válido, en minúsculas y sin espacios externos |
| `password` | 8 a 128 caracteres; nunca se almacena ni se devuelve |
| `title` | 1 a 120 caracteres después de recortar espacios |
| `description` | Máximo 1.000 caracteres; acepta `null` para borrarla |
| `status` | `PENDING` (por defecto), `IN_PROGRESS` o `COMPLETED` |
| `priority` | `LOW`, `MEDIUM` (por defecto) o `HIGH` |
| `dueDate` | Fecha ISO 8601 válida; acepta `null` |
| `role` | `USER` o `ADMIN` |
| `page`, `limit` | Enteros positivos; `page=1` y `limit=10` por defecto; `limit` máximo 100 |
| Cualquier otro campo | Rechazado con 400 (`forbidNonWhitelisted`), incluidos `userId` y `role` en tareas y perfil |

**Formato de las respuestas**

- Los listados devuelven `{ items, total, page, limit }`, ordenados del más reciente al más antiguo.
- Una tarea incluye `id`, `title`, `description`, `status`, `priority`, `dueDate`, `userId`, `createdAt` y `updatedAt`.
- Un usuario público incluye `id`, `name`, `email`, `role`, `createdAt` y `updatedAt`.

**Errores.** Todas las respuestas de error usan la estructura estándar de NestJS, con `statusCode` y `message`, sin trazas ni SQL.

| Código | Cuándo se devuelve |
| --- | --- |
| 400 | Cuerpo o parámetros inválidos, campos adicionales, UUID mal formado, `PATCH` vacío |
| 401 | Token ausente, mal formado, vencido o revocado; credenciales incorrectas |
| 403 | Rol insuficiente (USER en una ruta de ADMIN) |
| 404 | Usuario o tarea inexistente, o tarea de otro usuario |
| 409 | Correo duplicado; intento de quitar el rol al último ADMIN |

## 5. Persistencia

El modelo tiene dos tablas con una relación 1:N: un usuario puede tener varias tareas y cada tarea pertenece a un solo usuario. El esquema se crea con dos migrations, `CreateUsers` y `CreateTasks`; `synchronize` y `migrationsRun` están desactivados.

| Tabla | Campos | Restricciones |
| --- | --- | --- |
| `users` | `id` (UUID), `name`, `email`, `passwordHash`, `role`, `tokenVersion`, `createdAt`, `updatedAt` | `email` único; `name` de 2 a 100 caracteres (CHECK); `role` enum USER/ADMIN con valor inicial USER; `tokenVersion` entero con valor inicial 0 |
| `tasks` | `id` (UUID), `title`, `description`, `status`, `priority`, `dueDate`, `userId`, `createdAt`, `updatedAt` | Clave foránea `userId` hacia `users` con `ON DELETE CASCADE`; `title` de 1 a 120 caracteres tras recortar (CHECK); enums de estado y prioridad con valores iniciales PENDING y MEDIUM; índices en `userId`, `status` y `priority` |

- **Fechas.** Todas las marcas de tiempo son `timestamptz`.
- **Extensión requerida.** Los identificadores usan `uuid_generate_v4()`, así que una base nueva necesita la extensión `uuid-ossp`.
- **Conexión.** TypeORM reintenta la conexión 5 veces, con 2 segundos entre intentos.

**Seed (`npm run seed`).** Crea el administrador `admin@taskflow.com`, dos usuarios (`user1@taskflow.com` y `user2@taskflow.com`) y seis tareas repartidas entre los tres. Las contraseñas llegan por `SEED_ADMIN_PASSWORD` y `SEED_USER_PASSWORD` (mínimo 8 caracteres) y se guardan como hash bcrypt. Es repetible: busca cada usuario por correo y cada tarea por propietario y título, y solo inserta lo que falta, todo dentro de una transacción. En Railway, el comando previo al despliegue ejecuta las migrations y luego el seed.

## 6. Pruebas y cobertura

En la verificación local del 12 de octubre de 2026 pasaron las 87 pruebas unitarias y las 47 E2E, con una cobertura unitaria por encima del umbral de 80% en las cuatro métricas; lint y build también terminaron sin errores.

| Métrica de cobertura unitaria | Resultado | Umbral exigido |
| --- | --- | --- |
| Statements | 95,93% | 80% |
| Branches | 87,82% | 80% |
| Functions | 89,28% | 80% |
| Lines | 96,82% | 80% |

Jest falla si alguna métrica global baja de 80%. Se excluyen del cálculo los módulos, el arranque, la configuración y los scripts de base de datos: el montaje de Nest y las migrations se verifican con las pruebas E2E y el seed por ejecución repetida sobre PostgreSQL. La cifra corresponde solo a cobertura unitaria, no a una combinación con E2E.

**Tipos de prueba**

| Tipo | Herramienta | Alcance | Resultado |
| --- | --- | --- | --- |
| Unitarias | Jest | Servicios, controladores, guards, estrategia JWT y DTO de Auth, Users y Tasks | 87 aprobadas |
| E2E de Auth | Jest y Supertest, PostgreSQL real | Registro, login, rutas protegidas, logout y cambio de rol | 18 aprobadas |
| E2E de Tasks | Jest y Supertest, PostgreSQL real | CRUD, propiedad, filtros, paginación, validación, ADMIN, persistencia y clave foránea | 29 aprobadas |
| Colección Tasks | Newman | Escenarios positivos y negativos de Tasks y Health | 44 peticiones, 76 aserciones, sin fallos |
| Colección integrada | Postman y Newman | Auth, Users, Tasks y Health sobre los 14 endpoints | 122 peticiones tras ampliar Auth; la ejecución completa de esta versión está pendiente (la última ejecución registrada, de 97 elementos, 112 solicitudes HTTP y 201 aserciones sin fallos, es anterior a esa ampliación) |

Las pruebas E2E usan una base separada, `nest_backend_test` por defecto, cuyo nombre debe terminar en `_test`; la suite limpia el esquema y aplica las migrations antes de empezar, y se ejecutan en serie porque comparten esa base.

**Casos de aceptación del enunciado y dónde se prueban**

| Área | Caso | Evidencia |
| --- | --- | --- |
| Autenticación | Registro y correo duplicado; login válido e inválido; JWT ausente, vencido y revocado; logout impide reutilizar el token | E2E de Auth |
| Autorización | USER recibe 403 en rutas ADMIN; ADMIN cambia un rol; el cambio aplica sin nuevo login | Pruebas unitarias, E2E de Auth (cambio de rol con token ya emitido) y colección de Users |
| Autorización | Proteger al último ADMIN | Pruebas unitarias y colección de Users, que ejecuta el caso solo si existe un único ADMIN |
| Tareas | CRUD completo, acceso ajeno con 404, filtros, paginación, entradas inválidas y `userId` rechazado | E2E de Tasks y colección de Tasks |
| Persistencia | Migrations sobre base vacía; datos que sobreviven al reinicio; restricción única y clave foránea | E2E de Auth y Tasks (migrations al iniciar la suite, reinicio de Nest, 409 por correo duplicado, borrado en cascada) |
| Persistencia | Seed repetible | Ejecución repetida del seed sobre PostgreSQL |

**Cómo reproducir**

```bash
npm run lint
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:cov -- --runInBand
npm run build
npm run postman:build
npm run postman:tasks
```

## 7. Despliegue, CI y organización del equipo

### 7.1 Despliegue

La API se despliega en Railway desde la rama `main`, con la opción *Wait for CI* activa. Antes de arrancar, `railway.json` ejecuta `railway:predeploy`, que aplica las migraciones (`migration:run:prod`) y el seed (`seed:prod`). Luego inicia `start:prod` y Railway comprueba la salud en `/api/health`. El servicio se expone por HTTPS.

- API: https://compunet3-pandas-backendnestjs-production.up.railway.app
- Salud: `/api/health`
- Swagger: `/api/docs`

### 7.2 Control de versiones e integración continua

- Ramas: `main` (estable), `develop` (integración) y ramas `feature/*`, `fix/*` y `docs/*` que se fusionan por pull request.
- Husky ejecuta verificaciones locales antes de confirmar cambios.
- GitHub Actions está configurado para ejecutar lint, pruebas unitarias, E2E, cobertura, build y Newman.
- **Estado de la validación:** la ejecución de GitHub Actions estaba pendiente de confirmarse al cerrar este informe, porque dependía de publicar la rama. Los resultados de la sección 6 provienen de una ejecución local del 2026-10-12.

### 7.3 Organización del equipo

| Integrante | Responsabilidad |
| --- | --- |
| Integrante 1 | Autenticación (registro, login, logout, `/me`) |
| Integrante 2 | Usuarios y roles (listado, detalle, cambio de rol) |
| Integrante 3 | Tareas (CRUD propio y listado administrativo) |

Los nombres y usuarios de GitHub se detallan en la sección 1.

### 7.4 Limitaciones

- El caso de Postman del último ADMIN solo se ejecuta cuando existe exactamente un ADMIN; en otro caso se marca como «Omitido».
- No hay archivo E2E para el módulo de Usuarios; su cobertura proviene de pruebas unitarias y de Postman.
- No existe endpoint para eliminar cuentas de usuario.
- Los resultados de Newman no están respaldados por un reporte almacenado en el repositorio.

### 7.5 Trabajo futuro

- Publicar el reporte de Newman y de cobertura como artefacto de CI.
- Añadir pruebas E2E para Usuarios, incluida la protección del último ADMIN.
- Separar el entorno de Postman local del de producción para no ejecutar escenarios que modifican roles contra datos reales.
