# Postman por integrante

Los archivos separados son las fuentes de trabajo. Auth y Users conservan los escenarios aportados por sus responsables; Tasks añade escenarios ejecutables del Integrante 3. La colección integrada se genera a partir de los tres archivos.

| Responsable | Archivo editable | Carpetas | Endpoints base |
| --- | --- | --- | --- |
| Integrante 1 | `auth.postman_collection.json` | Auth y Session | Register, login y logout (3) |
| Integrante 2 | `users.postman_collection.json` | Users | Perfil, actualización, listado y cambio de rol (4) |
| Integrante 3 | `tasks.postman_collection.json` | Tasks y Health | CRUD de tareas, listado ADMIN y health (7) |

## Preparación compartida

1. Importar la colección propia y `local.postman_environment.json`. Users usa la colección Auth para obtener los tokens. Tasks prepara sus propios usuarios y tokens.
2. Seleccionar el mismo environment en las colecciones. `baseUrl` debe ser el origen, sin `/api` final: `http://localhost:3000` o el dominio de Railway.
3. En Auth, ejecutar Register y luego Login con `tokenTarget=user`. Los scripts guardan `userId` y `accessToken`.
4. Para probar ADMIN, cargar localmente `adminEmail=admin@taskflow.com` y la contraseña configurada en `SEED_ADMIN_PASSWORD`. Cambiar `tokenTarget=admin` y ejecutar Login; se guarda `adminToken`. Devolver `tokenTarget` a `user` después.
5. Ejecutar las peticiones propias. Tasks guarda `taskId` al crear una tarea. Logout se ejecuta al final: revoca el token USER y lo elimina del environment.

La colección integrada usa el orden Health, Auth, Users, Tasks y Session; el logout compartido se ejecuta al final. Configura las credenciales ADMIN en el environment antes de usar el Collection Runner. Los escenarios de Users modifican roles: usa una base de pruebas controlada.

## Escenarios por responsable

- **Auth:** correo duplicado (409), login inválido (401), JWT ausente/vencido/revocado (401), logout y rechazo del token anterior. Para demostrar revocación, conservar el token temporalmente en una variable local del escenario antes del logout. No se incluye 2FA.
- **Users:** perfil actualizado, normalización y duplicidad de correo (409), USER en rutas ADMIN (403), paginación, UUID/DTO inválidos (400), usuario inexistente (404), protección del último ADMIN (409) y cambio de rol vigente con el mismo token.
- **Tasks:** CRUD, filtros por estado/prioridad, paginación, tarea ajena/inexistente (404), rechazo de `userId` y PATCH vacío (400), USER en listado ADMIN (403) y listado ADMIN con propietario sin campos sensibles. Para propiedad ajena, usar una segunda sesión USER y mantener su token en una variable diferente.

Para casos negativos, duplicar una petición en una subcarpeta de escenarios y cambiar su expectativa al código específico (400, 401, 403, 404 o 409). Las peticiones base tienen verificaciones de estado por petición; no hay una regla global que exija 2xx e impida probar errores. Añadir también aserciones sobre el contenido, no solo el estado.

Las pruebas que cambian roles o necesitan dos usuarios deben preparar sus datos y restaurar el estado que modifican, o usar cuentas desechables. El caso del último ADMIN debe hacerse en una base controlada de pruebas. La prueba base de cambio de rol promueve `userId`; al encadenar escenarios, restaurar USER antes de probar permisos denegados.

## Integración (coordina el Integrante 2)

Cada integrante exporta su colección en formato Postman Collection v2.1 al mismo archivo que le corresponde y abre su PR. Se conservan las carpetas superiores; dentro de ellas pueden añadirse subcarpetas y peticiones. Mantener los endpoints base y los placeholders `{{userId}}`/`{{taskId}}` para que se puedan validar al integrar.

Los scripts compartidos se colocan en carpetas o peticiones; las variables compartidas, en el environment. El generador rechaza scripts, auth o variables definidos a nivel raíz de una colección parcial para evitar perderlos al unirla.

Después de integrar los tres aportes:

```bash
npm run postman:build
```

El comando valida que estén los 14 endpoints y genera `backend-api.postman_collection.json`. Ese archivo es el entregable conjunto; no se edita a mano. Si se añaden escenarios negativos, habrá más de 14 peticiones, pero seguirán siendo 14 endpoints distintos requeridos.

El environment se coordina mediante el Integrante 2 para evitar cambios simultáneos. Las variables mínimas son `baseUrl`, `accessToken`, `adminToken`, `userId` y `taskId`; las variables de login auxiliares ya están incluidas. Tokens, contraseñas reales y respuestas guardadas con información sensible se eliminan antes de exportar o hacer commit. El tipo `secret` de Postman no impide que un valor exportado llegue al repositorio.

Consultar `../PENDIENTES_EQUIPO.md` para el resto del reparto.

## Ejecutar Tasks con Newman

Con la API local conectada a una base de pruebas migrada y con seed:

```bash
npm run postman:build
npm run postman:tasks
```

El runner toma las credenciales desde POSTMAN_ADMIN_PASSWORD o SEED_ADMIN_PASSWORD; POSTMAN_ADMIN_EMAIL vale admin@taskflow.com por defecto. POSTMAN_BASE_URL vale http://localhost:3000 y admite solamente loopback. No exporta tokens ni credenciales. Finaliza con error si falla una petición, un script o una aserción.

Tasks crea dos usuarios exclusivos por ejecución, inicia sesión como ADMIN y verifica CRUD, filtros individuales/combinados, páginas distintas, campos anulables, errores 400/401/403/404, propiedad incluso frente a ADMIN y proyección pública del propietario. Al final elimina sus tres tareas y cierra las sesiones USER. Las dos cuentas permanecen porque la API no ofrece borrado de usuarios: usa una base desechable. Ejecuta la carpeta Tasks completa y en orden. El cleanup final requiere que las peticiones de preparación hayan podido completarse.

CI ejecuta esta colección después de E2E, migrations, seed y build sobre su PostgreSQL temporal. La colección integrada de Auth/Users/Tasks se valida estructuralmente; el runner automatizado de esta rama ejecuta Tasks.

Verificación local del 12 de octubre de 2026: Tasks aprobó 44 peticiones y 76 aserciones. La colección integrada también aprobó sus 97 elementos, 112 solicitudes HTTP (incluidas las llamadas auxiliares de scripts) y 201 aserciones, sin fallos, sobre PostgreSQL de pruebas. Esta ejecución no acredita los mismos resultados en Railway.
