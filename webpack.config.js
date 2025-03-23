const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserWebpackPlugin = require('terser-webpack-plugin');
const CssMinimizerWebpackPlugin = require('css-minimizer-webpack-plugin');

const CustomConsolePlugin = require('./plugin/customize-plugin');


const port = process.env.PORT || 9000;


module.exports = {
    entry: [path.resolve(__dirname, 'src/index.js')],
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'reactive.js',
        assetModuleFilename: 'static/[name]-[hash:8][ext]',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: [path.resolve(__dirname, 'node_modules'), path.resolve(__dirname, 'dist')],
                include: path.resolve(__dirname, 'src'),
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    },
                },
            },
            {
                test: /\.(css|scss)$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader',
                    'sass-loader',
                ],
            },
            {
                test: /\.(png|jpg|jpeg|gif)$/,
                type: 'asset',
                generator: {
                    filename: 'static/[name]-[hash:8][ext]',
                },
                parser: {
                    dataUrlCondition: {
                        maxSize: 1024 * 10,
                    }
                }
            },
        ],
    },
    devServer: {
        hot: true,
        port,
        open: true,
        historyApiFallback: true,
        compress: true,
    },
    devtool: 'eval-cheap-module-source-map',
    performance: {
        hints: 'warning',
        maxEntrypointSize: 1024 * 1024,
        maxAssetSize: 1024 * 1024 * 2,
        assetFilter: function (assetFilename) {
            return assetFilename.endsWith('.js');
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src'),
        },
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'index.html'),
        }),
        new CleanWebpackPlugin(),
        // 提取css
        new MiniCssExtractPlugin({
            filename: 'css/[name]-[hash:8].css',
            chunkFilename: 'css/[id].css',
        }),
        // 自定义插件
        new CustomConsolePlugin({
            port,
            host: 'localhost:'
        }),
    ],
    optimization: {
        minimize: true,
        minimizer: [
            // js 压缩
            new TerserWebpackPlugin(),
            // css 压缩
            new CssMinimizerWebpackPlugin(),
        ]
    },
    mode: process.env.NODE_ENV || 'development',
}