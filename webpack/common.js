import child_process from 'child_process'
import webpack from 'webpack'
import ProgressBarPlugin from 'progress-bar-webpack-plugin'
import FaviconsWebpackPlugin from 'favicons-webpack-plugin'
import HtmlWebpackPlugin from 'html-webpack-plugin'
import AppConfigPlugin from 'app-config/webpack'
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin'
import config from 'app-config'
import rulesMap from './rules'

// NOTE: Should be removed for webpack debugging, updating, or refactoring
process.noDeprecation = true

const versionBuffer = child_process.execSync('git rev-parse HEAD')
const version = versionBuffer.toString('utf8')

const globals = {
  'process.env': {
    'NODE_ENV': JSON.stringify(config.env),
    'ENTRY': JSON.stringify(config.entry),
    'LOCAL': JSON.stringify(config.local),
    'TESTNET': config.entry === 'testnet',
    'MAINNET': config.entry === 'mainnet',
    'EXTENSION': config.dir === 'chrome-extension/application',
    'VERSION': JSON.stringify(version),
  },
  __CONFIG__: JSON.stringify(config),
}


const rules = Object.keys(rulesMap)
  .map((k) => rulesMap[k])
  .map((rule) => Array.isArray(rule) ? rule : (rule.default || rule[config.env]))
  .reduce((result, rule) => result.concat(rule), [])

const webpackConfig = {

  entry: {
    'app': config.paths.client('index.tsx'),
  },

  module: {
    rules,
  },

  experiments: {
    asyncWebAssembly: true
  },

  resolve: {
    alias: {
      'shared': config.paths.front('shared'),
      'local_modules': config.paths.front('local_modules'),
      'domain': config.paths.common('domain'),
      'swap.auth': config.paths.core('swap.auth'),
      'swap.orders': config.paths.core('swap.orders'),
      'swap.room': config.paths.core('swap.room'),
      'swap.app': config.paths.core('swap.app'),
      'swap.flows': config.paths.core('swap.flows'),
      'swap.swap': config.paths.core('swap.swap'),
      'swap.swaps': config.paths.core('swap.swaps'),
      'simple.swap.core': config.paths.core('simple/src'),
      'common': config.paths.common(),
    },
    modules: [
      config.paths.front('client'),
      config.paths.front('shared'),
      config.paths.front('local_modules'),
      config.paths.common('domain'),
      'node_modules',
      config.paths.core(''),
    ],
    extensions: [ '.js', '.jsx', '.tsx', '.ts', '.scss' ],
    fallback: {
      fs: false,
      os: false,
      url: false,
      http: require.resolve('http-browserify'),
      https: require.resolve('https-browserify'),
      stream: require.resolve('stream-browserify'),
      assert: require.resolve('assert/'),
      path: require.resolve('path-browserify'),
      crypto: require.resolve('crypto-browserify'),
      buffer: require.resolve('buffer/')
    }
  },

  plugins: [
    new AppConfigPlugin(),
    new webpack.DefinePlugin(globals),
    new webpack.ProvidePlugin({
      'swap.auth': 'swap.auth',
      'swap.orders': 'swap.orders',
      'swap.room': 'swap.room',
      'swap.app': 'swap.app',
      'swap.flows': 'swap.flows',
      'swap.swap': 'swap.swap',
      'swap.swaps': 'swap.swaps',
      'Buffer': ['buffer', 'Buffer'],
      'process': 'process/browser',

    }),
    new ProgressBarPlugin({ clear: false }),
    new FaviconsWebpackPlugin({
      logo: config.paths.client('favicon.png'),
      path: config.base,
      favicons: {
        appName: 'Wallet',
        appDescription: 'Hot wallet',
      },
    }),
    new HtmlWebpackPlugin({
      title: 'Hot Wallet with p2p exchange',
      isWidget: config.isWidget,
      isBinanceBuild: config.binance,
      template: config.paths.client('index.html'),
      hash: false,
      filename: 'index.html',
      inject: 'body',
      ... (config.firebug) ? {
        firebugMark: 'debug="true"',
        firebugScript: '<script type="text/javascript" src="./firebug/firebug.js"></script>',
      } : {},
    }),
    new webpack.ContextReplacementPlugin(
      /\.\/locale$/,
      'empty-module',
      false,
      /js$/
    ),
    new webpack.NormalModuleReplacementPlugin(/^leveldown$/, (result) => {
      result.request = result.request.replace(/(leveldown)/,  config.paths.shared('helpers/leveldown'))
    }),
    new ForkTsCheckerWebpackPlugin(),
  ],
}


export default webpackConfig
