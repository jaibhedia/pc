const webpack = require('webpack');

module.exports = function override(config) {
  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify'),
    url: require.resolve('url'),
    buffer: require.resolve('buffer'),
    vm: require.resolve('vm-browserify'),
    process: require.resolve('process/browser.js'),
  });
  config.resolve.fallback = fallback;
  
  // Allow ESM modules to resolve without .js extension
  config.resolve.fullySpecified = false;
  
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: 'process/browser.js',
      Buffer: ['buffer', 'Buffer'],
    }),
  ]);
  
  // Ignore source map warnings and SVG attribute warnings from node_modules
  config.ignoreWarnings = [
    /Failed to parse source map/,
    /attribute width: Expected length/,
    /attribute height: Expected length/,
  ];
  
  return config;
};
