const path = require('node:path');

module.exports = (request, options) => {
  try {
    return options.defaultResolver(request, options);
  } catch (error) {
    if (process.platform !== 'win32') throw error;

    // Node can resolve installed modules when the native Windows resolver fails.
    const candidates = [request];
    if (path.isAbsolute(request) || request.startsWith('.')) {
      const absolute = path.resolve(options.basedir, request);
      for (const extension of options.extensions || []) {
        candidates.push(absolute + extension);
        candidates.push(path.join(absolute, 'index' + extension));
      }
    }
    for (const candidate of candidates) {
      try {
        return require.resolve(candidate, { paths: [options.basedir] });
      } catch {
        // Preserve Jest's original diagnostic if Node cannot resolve it either.
      }
    }
    throw error;
  }
};
