const path = require('node:path');
const newman = require('newman');
require('dotenv').config({ quiet: true });

const baseUrl = process.env.POSTMAN_BASE_URL || 'http://localhost:3000';
const adminPassword =
  process.env.POSTMAN_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD;
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(baseUrl).hostname)) {
  throw new Error(
    'Este runner crea cuentas de prueba: usa una API local con una base de pruebas.',
  );
}
if (!adminPassword)
  throw new Error('Configura POSTMAN_ADMIN_PASSWORD o SEED_ADMIN_PASSWORD.');

newman.run(
  {
    collection: require('./tasks.postman_collection.json'),
    environment: {
      values: [
        { key: 'baseUrl', value: baseUrl },
        {
          key: 'adminEmail',
          value: process.env.POSTMAN_ADMIN_EMAIL || 'admin@taskflow.com',
        },
        { key: 'adminPassword', value: adminPassword },
      ],
    },
    workingDir: path.resolve(__dirname),
    reporters: [],
    timeoutRequest: 10000,
    timeoutScript: 10000,
  },
  (error, summary) => {
    if (error) {
      console.error(
        'No fue posible ejecutar la colección Tasks:',
        error.message,
      );
      process.exitCode = 1;
      return;
    }
    const { requests, assertions } = summary.run.stats;
    console.log(
      `Tasks: ${requests.total} peticiones, ${assertions.total} aserciones, ${summary.run.failures.length} fallos.`,
    );
    for (const failure of summary.run.failures) {
      console.error(
        `${failure.source?.name || 'Tasks'}: ${failure.error?.test || failure.error?.name || 'Error de ejecución'}`,
      );
    }
    if (!requests.total || !assertions.total || summary.run.failures.length)
      process.exitCode = 1;
  },
);
