const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const path = require('path');
const baseDir = "./src/";

//const publicUrl = "/static/dist";  // dev
const publicUrl  = "https://djfdm802jwooz.cloudfront.net/static/color_doodle_dist";

module.exports = {
    entry: {
      bundle: [`${baseDir}App.js`, `${baseDir}/scss/doodle.scss`]
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
            template: `${baseDir}/templates/doodle_index.html`,
            publicPath: publicUrl
        })
    ]
};