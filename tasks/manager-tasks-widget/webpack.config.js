const path = require('path');

module.exports = {
  entry: './manager-tasks-widget.ts',
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
    filename: 'manager-tasks-widget.js',
    path: path.resolve(__dirname, 'dist')
  },
};
