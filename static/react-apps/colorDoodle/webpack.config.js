const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const path = require('path');
const baseDir = "./src/";
const BrotliPlugin = require('brotli-webpack-plugin');
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;


// const publicUrl = "/static/react-apps/colorDoodle/color_doodle_dist";  // dev
const publicUrl  = "https://djfdm802jwooz.cloudfront.net/static/react-apps/colorDoodle/color_doodle_dist";

module.exports = {
    entry: {
        colorDoodle: [`${baseDir}App.jsx`, `${baseDir}/scss/doodle.scss`]
    },
    output: {
        path: path.resolve(__dirname, "./color_doodle_dist")
    },
    module: {
        rules: [
            {
                test: /\.(js|jsx)$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader"
                }
            },
            {
                test: /\.(scss|css)$/,
                use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"]
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: "[name].css"
        }),
        new HtmlWebPackPlugin({
            template: `${baseDir}/templates/index.html`,
            publicPath: publicUrl,
            filename: "index.html"
        }),
        new BrotliPlugin({
            asset: '[path].br[query]',
            test: /\.(js|css|html|svg)$/,
            threshold: 10240,
            minRatio: 0.8
        }),
        new CleanWebpackPlugin({
            cleanAfterEveryBuildPatterns: ["static*.*", "!static1.js"],
            verbose: true
        }),
        // new BundleAnalyzerPlugin()
    ]
};