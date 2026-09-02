const path = require('path');

module.exports = {
  entry: './engagement-leaderboard.ts',
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
    filename: 'engagement-leaderboard.js',
    path: path.resolve(__dirname, 'dist')
  },
};
