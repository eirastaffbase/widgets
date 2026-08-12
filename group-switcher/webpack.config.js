const path = require('path');

module.exports = {
  entry: './group-switcher.ts',
  mode: 'production',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  optimization: {
    minimize: true,
  },
  output: {
    filename: 'group-switcher.js',
    path: path.resolve(__dirname, 'dist')
  },
};
