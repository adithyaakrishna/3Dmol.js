/* eslint-disable no-undef*/
const path = require("path");
const webpack = require("webpack");
const pkg = require("./package.json");
const ESLintPlugin = require('eslint-webpack-plugin');

const banner = `${pkg.name} v${pkg.version}
${pkg.description}
Author: ${pkg.author}`;

module.exports =  {
  target: "web",
  entry: {'3Dmol':["./src/index.ts", 
        "./src/SurfaceWorker.js",        
        "./src/exporter.js"
        ],
      '3Dmol.ui': [ "./src/ui/ui.js",
      "./src/ui/state.js",
      "./src/ui/icon.js",
      "./src/ui/form.js",        
      "./src/ui/defaultValues.js"]},
  output: {
    path: path.resolve(__dirname, "build"),
    pathinfo: false,
    globalObject: "this",
    library: '[name]',
    libraryTarget: "umd",
  },

  resolve: {
    extensions: [".ts", ".tsx", ".js", ".json"],
    symlinks: false,
    cacheWithContext: false
  },

  module: {
    rules: [
      { 
        test: /\.tsx?$/,
        loader: "ts-loader", 
        options: {
          // transpile only in happyPack mode
          // type checking is done via fork-ts-checker-webpack-plugin
          happyPackMode: true,
          transpileOnly: true,
          // must override compiler options here, even though we have set
          // the same options in `tsconfig.json`, because they may still
          // be overridden by `tsconfig.json` in node_modules subdirectories.
          compilerOptions: {
            esModuleInterop: false,
            importHelpers: false,
            module: 'esnext',
            target: 'esnext',
          },
        },
      },
      { test: /\.frag/, loader: "raw-loader" },
      { test: /\.vert/, loader: "raw-loader" }
    ],
  },

  plugins: [
    new webpack.ProvidePlugin({
        MMTF: path.resolve(__dirname, "./src/vendor/mmtf.js"),
        $: "jquery"
    }),
    new webpack.BannerPlugin({ banner }), 
    new ESLintPlugin(),
    new ForkTsCheckerWebpackPlugin({
      eslint: {
        files: './{src}/**/*.{ts,tsx,js,jsx}',
        memoryLimit: 4096,
        options: {
          ignorePath: './.eslintignore',
        },
      },
    }),
  ],
  optimization: {
    runtimeChunk: true,
  },
  cache: {
    type: 'filesystem',
    cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
  },

};
