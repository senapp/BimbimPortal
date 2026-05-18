const path = require('path');
const loaderUtils = require('loader-utils');
const { merge } = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const commonConfig = (env) => ({
    entry: {
        app: path.join(__dirname, 'src', 'index.tsx')
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: '/node_modules/'
            },
            {
                test: /\.(png|mp3)$/i,
                type: 'asset/resource',
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    {
                        loader: 'css-loader',
                        options: {
                            sourceMap: true,
                            modules: {
                                mode: "local",
                                auto: true,
                                exportLocalsConvention: "camelCase",
                                getLocalIdent: (context, localIdentName, localName, options) => {
                                    const hash = loaderUtils.getHashDigest(
                                        path.relative(context.rootContext, context.resourcePath) + localName,
                                        'md5',
                                        'base64',
                                        5
                                    );

                                    const moduleName = path.basename(context.resourcePath).match(/(.*)\.module.css/)[1] ?? '';

                                    return loaderUtils.interpolateName(
                                        context,
                                        `${moduleName}--${localName}_${hash}`,
                                        options
                                    );
                                },
                            }
                        }
                    }
                ]
            }
        ]
    },
    optimization: {
        chunkIds: 'named',
        splitChunks: {
            chunks: 'all'
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/index.html',
            favicon: './resources/favicon.ico'
        }),
    ],
    resolve: {
        extensions: ['.tsx', '.ts', '.js']
    },
    output: {
        filename: '[name].[contenthash].js',
        path: env.outputPath ?? path.resolve(__dirname, 'dist'),
        clean: true,
    },
});

module.exports = (env, argv) => {
    switch (argv.mode) {
        case 'production':
            return merge(commonConfig(env), {
                optimization: {
                    minimize: true,
                },
                performance: {
                    hints: false,
                }
            });
            case 'development':
                return merge(commonConfig(env), {
                    devtool: 'eval-source-map',
                });
            default:
                throw new Error('No matching configuration was found!');
    }
}