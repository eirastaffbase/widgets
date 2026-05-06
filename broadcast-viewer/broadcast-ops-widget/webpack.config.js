const path = require('path');

const shared = {
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
    modules: [path.resolve(__dirname, 'node_modules'), 'node_modules'],
  },
  optimization: { minimize: false },
};

module.exports = [
  {
    ...shared,
    entry: './broadcast-ops-widget.tsx',
    output: {
      filename: 'broadcast-ops-widget.js',
      path: path.resolve(__dirname, 'dist'),
    },
  },
  {
    ...shared,
    entry: './preview-entry.jsx',
    output: {
      filename: 'preview.js',
      path: path.resolve(__dirname, 'dist'),
    },
  },
];
