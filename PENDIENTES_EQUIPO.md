# Reparto de cierre de TaskFlow

Estado revisado el 12 de octubre de 2026. 2FA queda fuera del alcance acordado. El objetivo es completar evidencia y entrega sobre lo ya implementado, conservando commits y revisiones reales de cada integrante.

## Integrante 1: autenticación y seed

Ya existen registro, login, JWT, logout/revocación, pruebas unitarias y 18 E2E de Auth. El seed se verificó localmente con tres usuarios y seis tareas, hashes válidos y ejecución repetida sin duplicados.

Pendientes propios:

- Revisar la ejecución conjunta de los 18 escenarios Auth ya aportados en bcb3a8d e integrados en develop. El token vencido se comprueba en E2E; la firma falsa de Postman no equivale a una prueba de expiración.
- Escribir y validar la sección 3 de `INFORME_FINAL.md`: endpoints, cuerpos, respuestas, bcrypt, expiración/firma JWT, `tokenVersion`, rol vigente y seed por variables de entorno.
- Entregar al Integrante 2 la sección, nombre completo, usuario GitHub y evidencias de Auth.
- Coordinar con el Integrante 3 la ejecución del seed en Railway y comprobar que se puede iniciar sesión como ADMIN y USER. No incluir credenciales reales en el informe ni en Postman exportado.
- Revisar el PR de Users/Postman del Integrante 2.

## Integrante 2: usuarios, roles y entrega documental

Ya existen Users/roles, pruebas unitarias, Swagger de usuarios y estructura del informe. El reparto conserva su papel de coordinador documental.

Pendientes propios:

- Revisar los 35 escenarios Users ya integrados (13231bd). La reducción de escenarios en 0047dab, rama feature/users-postman-tests, todavía no está en develop: decidir e integrar por su PR, conservando cobertura funcional.
- Revisar Swagger contra el contrato final: parámetros, cuerpos, respuestas, Bearer y errores por endpoint.
- Reunir las secciones de los otros integrantes y ensamblar `INFORME_FINAL.md`: nombres reales, fecha, resultados vigentes, arquitectura del despliegue y enlaces. Evitar presentar resultados históricos como actuales.
- Coordinar el environment Postman, integrar los tres archivos con `npm run postman:build` y comprobar la colección resultante.
- Actualizar README con las instrucciones finales, integrantes y URL; preparar el archivo del informe para entregar en Intu según el formato solicitado por el docente.
- Revisar el PR de tareas/despliegue del Integrante 3.

## Integrante 3: tareas, integración y Railway

Ya están integrados en `develop` los 29 E2E de Tasks, la corrección de PATCH vacío, el umbral del 80% y el paso de migraciones en CI. La validación local aprobó 87 unitarias y 47 E2E. Migraciones, seed, clave foránea y persistencia se verificaron con PostgreSQL real.

Aporte preparado en feature/tasks-delivery:

- 44 peticiones Tasks/Health con aserciones, datos propios y limpieza de tareas. Runner Newman y ejecución en CI; 76 aserciones locales aprobadas.
- Generador de la colección integrada: 97 peticiones, 14 endpoints; conserva los scripts de Auth y Users. Ejecución conjunta local: 201 aserciones aprobadas.
- Predeploy que falla ante errores del seed; migraciones ejecutadas una sola vez en predeploy.
- Secciones 5/6 del informe, guía DEPLOYMENT.md y enlaces públicos actualizados.
- API pública revisada: health y Swagger 200, OpenAPI con 14 operaciones, Tasks/perfil sin JWT 401. El responsable confirmó main y Wait for CI.

Pendientes externos:

- Publicar esta rama cuando el responsable lo indique, obtener revisión e integrar develop → main con CI aprobado.
- Guardar evidencia de SHA desplegado, volumen PostgreSQL y persistencia en Railway; probar login y CRUD autenticados con credenciales privadas.
- Registrar una revisión real de PR ajeno; esta revisión local no equivale a aprobarlo en GitHub.

## Orden y criterios de cierre

1. Cada integrante trabaja en su archivo Postman y prepara su sección del informe. No necesita reescribir módulos o pruebas que ya pasan.
2. El Integrante 3 reúne evidencia del despliegue condicionado a CI. El Integrante 1 ayuda a validar Auth/seed en nube.
3. El Integrante 2 reúne las colecciones y documentación. Los tres ejecutan sus escenarios sobre la misma versión desplegada.
4. Confirmar lint, unitarias, E2E, cobertura y build, y guardar evidencia de Actions aprobado para el commit de entrega.
5. Verificar que la entrega tenga código integrado, README, informe completo, JSON Postman y URL pública de API/Swagger.

Cada persona debe conservar su autoría, hacer sus propios commits y revisar al menos un PR ajeno. Las colecciones divididas son una base procedente de la colección existente; cada persona añade y verifica su contribución. No asignar commits artificiales ni modificar la autoría anterior.

La automatización de despliegue, las revisiones de PR y la ejecución remota de Actions se deben comprobar en sus plataformas; la existencia de archivos locales no constituye evidencia de que ya hayan ocurrido.

Mantenimiento de dependencias: npm audit reporta 38 avisos (27 moderados y 11 altos) tras añadir Newman de desarrollo. Se fijó Handlebars 4.7.10 para eliminar el aviso crítico transitivo. Revisar los restantes en una actualización específica; no se aplicó audit fix --force.
