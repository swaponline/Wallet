import path from 'path'
import gravatarUsers from './gravatarUsers'


const rootPath = path.resolve(process.cwd())
const basePath = path.resolve(__dirname, '../../../')



const config = {
  propENV: process.env.CONFIG, // from package.json

  paths: {
    root: (file = '') => path.join(rootPath, file),
    base: (file = '') => path.join(basePath, file),
    core: (file = '') => process.env.SWAP_CORE_PATH ? path.join(process.env.SWAP_CORE_PATH, file) : path.join(basePath, 'src', 'core', file),
    common: (file = '') => path.join(basePath, 'src', 'common', file),
    front: (file = '') => path.join(basePath, 'src', 'front', file),
    shared: (file = '') => path.join(basePath, 'src', 'front', 'shared', file),
    client: (file = '') => path.join(basePath, 'src', 'front', 'client', file),
  },

  publicPath: '/',

  http: {
    host: process.env.HOST || 'localhost',
    port: process.env.PORT || 9001,
  },

  gravatarUsers,

  i18nDate: {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  },
  
  
  // Uni V3 - Global configuration
  // ChainId -> Configuration
  // More chains at https://github.com/Uniswap/sdks/blob/main/sdks/sdk-core/src/addresses.ts
  // Multicall - v2
  UNISWAP_V3_CONTRACTS: { 
    1: { // Eth mainnet
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      position_manager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      multicall: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    },
    11155111: { // Eth Sepolia testnet
      factory: '0x0227628f3F023bb0B980b67D528571c95c6DaC1c',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      position_manager: '0x1238536071E1c677A632429e3655c799b22cDA52',
      multicall: '0xD7F33bCdb21b359c8ee6F0251d30E94832baAd07',
    },
    56: { // Binance
      factory: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      position_manager: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
      multicall: '0x963Df249eD09c358A4819E39d9Cd5736c3087184',
    },
    137: { // Polygon
      factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
      router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      position_manager: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
      multicall: '0xed386Fe855C1EFf2f843B910923Dd8846E45C5A4',
    },
  }
}


export default config
