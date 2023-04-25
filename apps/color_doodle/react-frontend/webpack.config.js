const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebPackPlugin = require("html-webpack-plugin");
const baseDir = "./src/";

module.exports = {
    entry: {
      bundle: [`${baseDir}App.js`, `${baseDir}/scss/doodle.scss`]
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
            publicPath: "/static/dist/"
        })
    ]
};