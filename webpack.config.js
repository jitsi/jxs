const path = require('path');

module.exports = {
    mode: 'production',
    target: 'node',
    entry: {
        'stress-test': './src/scripts/stress-test.js',
        'muc-join': './src/scripts/muc-join.js',
    },
    module: {
        rules: [
            { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader' }
        ]
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
    },
};
