const path = require('path');

module.exports = {
  entry: './industry-switcher.ts',
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
    minimize: false,
  },
  output: {
    filename: 'industry-switcher.js',
    path: path.resolve(__dirname, 'dist')
  },
};
