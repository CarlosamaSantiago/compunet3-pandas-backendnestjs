const fs = require('node:fs');
const path = require('node:path');

const specifications = [
  [
    'auth',
    ['Auth', 'Session'],
    [
      'POST /api/auth/register',
      'POST /api/auth/login',
      'POST /api/auth/logout',
    ],
  ],
  [
    'users',
    ['Users'],
    [
      'GET /api/users/me',
      'PATCH /api/users/me',
      'GET /api/users',
      'PATCH /api/users/{{userId}}/role',
    ],
  ],
  [
    'tasks',
    ['Tasks', 'Health'],
    [
      'POST /api/tasks',
      'GET /api/tasks',
      'GET /api/tasks/{{taskId}}',
      'PATCH /api/tasks/{{taskId}}',
      'DELETE /api/tasks/{{taskId}}',
      'GET /api/admin/tasks',
      'GET /api/health',
    ],
  ],
];

function requests(items) {
  return items.flatMap((item) =>
    item.request ? [item] : requests(item.item ?? []),
  );
}

const folders = new Map();
let requestCount = 0;
for (const [file, expectedFolders, requiredRoutes] of specifications) {
  const collection = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, `${file}.postman_collection.json`),
      'utf8',
    ),
  );
  // Shared scripts belong to folders/requests so they survive composition.
  if (
    collection.event?.length ||
    collection.auth ||
    collection.variable?.length
  ) {
    throw new Error(
      `${file}: use folder/request scripts and the shared environment`,
    );
  }
  if (collection.item.length !== expectedFolders.length) {
    throw new Error(
      `${file}: preserve the top-level folders ${expectedFolders.join(', ')}`,
    );
  }
  for (const folder of collection.item) {
    if (!expectedFolders.includes(folder.name) || folders.has(folder.name)) {
      throw new Error(
        `${file}: unexpected or duplicated folder ${folder.name}`,
      );
    }
    folders.set(folder.name, folder);
  }
  const routes = new Set();
  for (const item of requests(collection.item)) {
    const url =
      typeof item.request.url === 'string'
        ? item.request.url
        : item.request.url.raw;
    if (!url?.startsWith('{{baseUrl}}/api/')) {
      throw new Error(`${file}: ${item.name} must use {{baseUrl}}/api/...`);
    }
    routes.add(
      `${item.request.method} ${url.replace('{{baseUrl}}', '').split('?')[0]}`,
    );
    requestCount += 1;
  }
  for (const route of requiredRoutes) {
    if (!routes.has(route))
      throw new Error(`${file}: missing endpoint ${route}`);
  }
}

const result = {
  info: {
    _postman_id: '4a903570-8b1e-4dad-92a9-1bfeb19869d8',
    name: 'TaskFlow - Colección integrada',
    description:
      'Generada con npm run postman:build a partir de Auth, Users y Tasks. Preparar accessToken y adminToken usando el entorno compartido; ejecutar logout al final. Ver postman/README.md.',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: ['Health', 'Auth', 'Users', 'Tasks', 'Session'].map((name) =>
    folders.get(name),
  ),
};
fs.writeFileSync(
  path.join(__dirname, 'backend-api.postman_collection.json'),
  JSON.stringify(result, null, 2) + '\n',
);
console.log(
  `Colección integrada: ${requestCount} peticiones; los 14 endpoints requeridos están presentes.`,
);
