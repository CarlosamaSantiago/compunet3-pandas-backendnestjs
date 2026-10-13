const assert = require('node:assert/strict');
const path = require('node:path');
const { test } = require('node:test');
const resolver = require('./jest-resolver.cjs');

test('preserves successful default resolution', () => {
  assert.equal(
    resolver('example', { defaultResolver: () => 'resolved' }),
    'resolved',
  );
});

test(
  'recovers installed modules and TypeScript paths on Windows',
  {
    skip: process.platform !== 'win32',
  },
  () => {
    const options = {
      basedir: path.resolve(__dirname, '../src'),
      extensions: ['.js', '.json', '.ts'],
      defaultResolver: () => {
        throw new Error('Native resolution failed');
      },
    };
    assert.equal(resolver('ts-jest', options), require.resolve('ts-jest'));
    assert.equal(
      resolver('./app.module', options),
      path.resolve(options.basedir, 'app.module.ts'),
    );
  },
);

test('still rejects nonexistent modules with the original error', () => {
  const original = new Error('Module missing');
  assert.throws(
    () =>
      resolver('taskflow-module-that-does-not-exist', {
        basedir: __dirname,
        defaultResolver: () => {
          throw original;
        },
      }),
    (error) => error === original,
  );
});
