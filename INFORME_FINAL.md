# Informe final del proyecto TaskFlow

**Asignatura:** Computación en Internet III
**Institución:** Universidad Icesi
**Equipo:** `[Completar nombres de los tres integrantes]`
**Fecha de entrega:** `[Completar]`

> Este informe reúne las secciones de Users/roles y Tasks, junto con la verificación local de integración. La sección de Auth y los datos completos del equipo siguen pendientes de validación por sus responsables.

## 1. Resumen del proyecto

TaskFlow es una API REST construida con NestJS, TypeScript, PostgreSQL y TypeORM. La API permite registrar e identificar usuarios mediante JWT, consultar y actualizar perfiles, administrar roles, y crear y administrar tareas asociadas a un usuario. La documentación HTTP se publica con Swagger/OpenAPI y la colección compartida de solicitudes se entrega en Postman.

La arquitectura organiza las rutas en módulos. Los controladores reciben solicitudes HTTP y delegan lógica a servicios; los servicios acceden a PostgreSQL mediante repositorios de TypeORM. DTOs describen y validan los datos de entrada. Guards separan autenticación (verificar quién realiza la solicitud) de autorización (verificar qué acciones permite su rol).

## 2. Arquitectura funcional

El flujo general de una solicitud protegida es:

```text
Cliente
  → JwtAuthGuard y estrategia JWT
  → usuario vigente cargado desde PostgreSQL en request.user
  → RolesGuard, si la ruta requiere ADMIN
  → ValidationPipe y DTO
  → Controller
  → Service
  → Repository de TypeORM
  → PostgreSQL
  → respuesta HTTP
```

La entidad `User` contiene UUID, nombre, correo único, hash de contraseña, rol, versión de token y fechas de auditoría. La entidad `Task` pertenece a un `User` mediante una relación muchos-a-uno; la eliminación del usuario elimina sus tareas por cascada según la relación y la clave foránea de la migración.

La configuración de TypeORM mantiene desactivados `synchronize` y la ejecución automática de migraciones. Los cambios de esquema se aplican mediante migraciones versionadas.

## 3. Aporte del Integrante 1: autenticación

**Responsable:** `[Nombre y usuario GitHub del Integrante 1]`

**Estado de esta sección:** pendiente de completar o validar por el integrante responsable.

### 3.1 Sección por completar

`[Describir decisiones e implementación de registro, login, logout, hashing de contraseñas, firma/verificación JWT, estrategia Passport, validación de tokenVersion y pruebas de Auth. Incluir resultados de pruebas ejecutadas por el Integrante 1.]`

### 3.2 Contrato observado con Users

El código de Auth utiliza `UsersService.create` para registrar, `findByEmail` para buscar el usuario durante login, `findById` para cargar el usuario de la base al validar el token e `incrementTokenVersion` para invalidar tokens durante logout. La estrategia JWT retorna el usuario cargado, de modo que `request.user.role` refleja el rol actual persistido y no un rol antiguo copiado al emitir el token.

> `[El Integrante 1 debe confirmar que este resumen coincide con la versión final integrada de Auth.]`

## 4. Aporte del Integrante 2: usuarios, roles, documentación y pruebas

**Responsable:** `[Nombre y usuario GitHub del Integrante 2]`

### 4.1 Modelo de usuario

La entidad `User` de TypeORM representa la tabla `users` y define:

- `id`: UUID generado y llave primaria.
- `name`: texto entre 2 y 100 caracteres.
- `email`: texto único para identificar cuentas.
- `passwordHash`: almacenamiento interno del hash; no se implementa hashing en Users y la columna no se selecciona por defecto.
- `role`: enum limitado a `USER` y `ADMIN`, con `USER` predeterminado.
- `tokenVersion`: entero que Auth usa para invalidar tokens.
- `createdAt` y `updatedAt`: marcas de tiempo administradas por TypeORM.

Las respuestas HTTP de Users se construyen como objetos públicos con id, nombre, correo, rol y fechas. No devuelven `passwordHash` ni `tokenVersion`.

### 4.2 Servicios de Users

`UsersService` contiene las operaciones compartidas con Auth y las operaciones HTTP de usuarios:

- `findByEmail(email)` consulta por correo y selecciona expresamente `passwordHash` para el login.
- `findById(id)` carga el usuario actual; el hash se excluye salvo que se solicite explícitamente.
- `create(input)` guarda el usuario y aplica rol `USER` cuando no se proporciona rol.
- `incrementTokenVersion(userId)` incrementa en PostgreSQL la versión del token.
- `getProfile(userId)` obtiene perfil propio y devuelve una proyección pública.
- `updateProfile(userId, input)` actualiza solamente nombre/correo; un correo duplicado se transforma en HTTP 409.
- `listUsers(page, limit)` devuelve resultados paginados con campos públicos.
- `updateRole(userId, role)` busca y actualiza el rol dentro de una transacción. Usa bloqueo para serializar cambios y rechaza retirar el rol del último ADMIN con HTTP 409.

### 4.3 Autorización y rutas

`@Roles(Role.ADMIN)` declara los roles requeridos. `RolesGuard` compara esos roles con el usuario autenticado presente en `request.user`; una cuenta USER en una ruta exclusiva de ADMIN recibe HTTP 403. La autenticación continúa siendo responsabilidad del guard JWT de Auth.

| Método y ruta               | Acceso      | Función                         |
| --------------------------- | ----------- | ------------------------------- |
| `GET /api/users/me`         | Autenticado | Consultar perfil propio.        |
| `PATCH /api/users/me`       | Autenticado | Actualizar nombre y/o correo.   |
| `GET /api/users`            | ADMIN       | Listar usuarios con paginación. |
| `PATCH /api/users/:id/role` | ADMIN       | Cambiar el rol de una cuenta.   |

Los DTOs de Users validan y transforman el perfil, parámetros de paginación y rol. Los campos adicionales son rechazados por el `ValidationPipe` global. El rol no forma parte del DTO de perfil. El UUID de cambio de rol debe ser válido; un usuario inexistente da 404.

### 4.4 Swagger

Los endpoints de Users se documentan con Bearer auth, operaciones, parámetros, cuerpos, modelos de respuestas públicas y errores HTTP esperados. `UserResponseDto` describe campos públicos; `PaginatedUsersResponseDto` describe `items`, `total`, `page` y `limit`.

### 4.5 Colección Postman

La colección compartida contiene 14 solicitudes para Health, Auth, Users, Tasks y cierre de sesión. El environment declara `baseUrl`, `accessToken`, `adminToken`, `userId` y `taskId`, además de variables auxiliares para inicio de sesión. Los scripts comprueban respuestas exitosas, guardan token e identificadores devueltos y limpian `accessToken` tras logout.

El registro público solo crea USER. Para probar solicitudes ADMIN se necesita una cuenta ADMIN existente y cargar sus credenciales localmente en las variables del environment; no se guardan credenciales reales en el repositorio.

### 4.6 Pruebas y resultados

Las pruebas unitarias específicas de Users/roles se encuentran en:

- `src/modules/users/users.service.spec.ts`
- `src/modules/users/users.controller.spec.ts`
- `src/modules/users/dto/users-dtos.spec.ts`
- `src/common/guards/roles.guard.spec.ts`

Cubren búsqueda y creación, perfil, duplicidad de correo, exclusión de campos sensibles, paginación, cambio de roles, último ADMIN, DTOs inválidos y acceso denegado por rol.

Resultados observados en la rama final de pruebas/documentación al 11 de octubre de 2026:

| Verificación             | Resultado                                                           |
| ------------------------ | ------------------------------------------------------------------- |
| ESLint                   | Correcto.                                                           |
| Unit tests               | 72 pruebas en 7 suites aprobadas (39 de Users/roles y 33 de Tasks). |
| E2E                      | No hay suites E2E actualmente; el comando indica “No tests found”.  |
| Build                    | Correcto.                                                           |
| Coverage UsersService    | 100% statements, branches, functions y lines.                       |
| Coverage UsersController | 100% statements, branches, functions y lines.                       |
| Coverage RolesGuard      | 100% statements, branches, functions y lines.                       |
| Coverage global          | 72.9% statements, 73.91% branches, 72.28% functions y 74.33% lines. |

Estos resultados corresponden a la revisión del 11 de octubre. La verificación integrada del 12 de octubre, después de incorporar las pruebas de Auth y Tasks, se presenta en la sección 5.3 y supera el umbral del 80%.

## 5. Aporte del Integrante 3: tareas

**Responsable:** Integrante 3, autor Git `sCarlosama`. Nombre completo pendiente de incorporar a la tabla del equipo.

### 5.1 Modelo y propiedad

`Task` contiene UUID, título (1 a 120 caracteres tras recortar espacios), descripción opcional (máximo 1.000), estado (`PENDING`, `IN_PROGRESS`, `COMPLETED`), prioridad (`LOW`, `MEDIUM`, `HIGH`), fecha límite ISO 8601 opcional, `userId` y fechas de auditoría. Los valores iniciales son `PENDING` y `MEDIUM`.

La migración crea los enums, índices y una clave foránea hacia `users` con `ON DELETE CASCADE`. El servidor toma el propietario del usuario autenticado. El ValidationPipe rechaza `userId` enviado por el cliente tanto al crear como al actualizar. Las consultas y modificaciones filtran simultáneamente por id de tarea y propietario; una tarea ajena o inexistente devuelve 404, incluso para un ADMIN.

### 5.2 Endpoints y validación

| Método y ruta | Parámetros/cuerpo | Respuesta |
| --- | --- | --- |
| `POST /api/tasks` | Título obligatorio; descripción, estado, prioridad y fecha opcionales | 201, tarea creada |
| `GET /api/tasks` | `status`, `priority`, `page`, `limit` opcionales | 200, `items`, `total`, `page`, `limit` |
| `GET /api/tasks/:id` | UUID de tarea propia | 200, tarea; 404 si es ajena o inexistente |
| `PATCH /api/tasks/:id` | UUID y al menos un campo editable | 200, tarea actualizada |
| `DELETE /api/tasks/:id` | UUID de tarea propia | 204 sin cuerpo |
| `GET /api/admin/tasks` | ADMIN; `page`, `limit` opcionales | 200, página de tareas con id, nombre y correo del propietario |

Los listados usan `page=1`, `limit=10` y un máximo de 100. El orden es fecha de creación descendente y UUID descendente para desempatar. Todas las rutas exigen JWT (401); el listado global exige ADMIN (403). UUID, filtros, paginación y cuerpos inválidos producen 400. En PATCH, `null` permite borrar descripción y fecha límite.

Los E2E detectaron que `{}` recibía 200 porque el DTO transformado tenía propiedades con valor `undefined`. La corrección exige al menos un valor definido. La prueba de regresión falló antes del cambio y pasó después con 400.

### 5.3 Pruebas y CI

`test/tasks.e2e-spec.ts` incorpora 29 casos con PostgreSQL real: CRUD, propiedad frente a otro USER y ADMIN, filtros individuales y combinados, paginación, rechazo de `userId`, JWT ausente, listado administrativo, validación, reinicio de Nest y restricciones de clave foránea/cascada. La preparación compartida exige una base terminada en `_test`, reconstruye el esquema usando las dos migraciones y verifica su repetición sin cambios. Las suites se ejecutan en serie.

Verificación local del 12 de octubre de 2026:

| Verificación | Resultado |
| --- | --- |
| Unitarias | 87 pruebas, 11 suites aprobadas |
| E2E | 47 pruebas: 18 Auth y 29 Tasks aprobadas |
| Lint y build | Correctos |
| Cobertura statements | 95.93% |
| Cobertura branches | 87.82% |
| Cobertura functions | 89.28% |
| Cobertura lines | 96.82% |

Jest exige 80% global en las cuatro métricas y falla si no encuentra pruebas. La cobertura es unitaria y conserva las exclusiones existentes de arranque, módulos, configuración y scripts de base de datos; estos se verifican mediante integración y ejecución del seed. CI aplica migraciones antes de E2E y ejecuta lint, unitarias, E2E, cobertura y build. La ejecución remota de Actions sigue pendiente hasta publicar la rama.

## 6. Persistencia y despliegue local

El repositorio contiene migraciones para `users` y `tasks`; la tabla de tareas referencia `users` con eliminación en cascada. PostgreSQL 17 se levanta con Docker Compose y volumen persistente. La configuración se obtiene de `.env`, que no se versiona. Se verificaron las migraciones sobre una base vacía y la creación de la extensión `uuid-ossp` por TypeORM.

El seed del Integrante 1 se ejecuta con `npm run seed`, usando `SEED_ADMIN_PASSWORD` y `SEED_USER_PASSWORD`. En la verificación local creó un ADMIN, dos USER y seis tareas. Una segunda ejecución agregó cero registros; se validaron los hashes con bcrypt y los tres usuarios/seis tareas sobrevivieron al reinicio del contenedor PostgreSQL.

No se documenta un despliegue cloud porque no hay proveedor configurado en el proyecto actual.

## 7. Pendientes antes de entregar

- Reemplazar los marcadores del equipo por nombres y perfiles reales.
- Completar y revisar la sección de Auth con su responsable.
- Implementar y documentar el despliegue en nube, HTTPS, migrations y pipeline posterior a CI.
- Publicar las URL de API y Swagger y comprobar CI en GitHub.
- Hacer una revisión final del informe contra la rúbrica y la versión exacta integrada en `develop`.
