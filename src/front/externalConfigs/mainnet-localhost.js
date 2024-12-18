/* window.widgetERC20Comisions = {
  bnb: {
    fee: '2',
    address: '',
    min: '0,0001',
  },
  matic: {
    fee: '5',
    address: '',
    min: '0,001',
  },
  bep20: {
    address: '',
  },
  erc20matic: {
    address: '',
  },
  erc20xdai: {
    address: '',
  },
  erc20ftm: {
    address: '',
  },
  erc20avax: {
    address: '',
  },
  erc20movr: {
    address: '',
  },
  erc20one: {
    address: '',
  },
  erc20ame: {
    address: '',
  },
  erc20aurora: {
    address: '',
  },
} */

window.widgetEvmLikeTokens = [
  {
    name: 'usdt',
    symbol: 'usdt',
    standard: 'erc20',
    address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    decimals: 6,
    fullName: 'Tether',
  },
  {
    name: 'share',
    symbol: 'share',
    standard: 'erc20',
    // Address of ERC20 contract
    address: '0xc787a019ea4e0700e997c8e7d26ba2efa2e6862a',
    // Count of decimals after dot
    decimals: 0,
    // Display name in wallet (By default - its symbol of ERC20, but can be other userfriendy text)
    fullName: 'Mining.Taxi',
    // Icon of currency (image)
    icon: 'https://wallet.miningtaxi.com/images/1_4.svg',
    // Background color of icon
    iconBgColor: '#7158e8',
  },
  {
    name: 'uni',
    symbol: 'uni',
    standard: 'erc20',
    // Address of ERC20 contract
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
    // Count of decimals after dot
    decimals: 18,
    // Display name in wallet (By default - its symbol of ERC20, but can be other userfriendy text)
    fullName: 'Uniswap',
    // Icon of currency (image)
    icon: 'https://wallet.miningtaxi.com/images/uniswap.svg',
    // Background color of icon
    iconBgColor: '#ff007a',
    howToDeposit: 'Just do it!',
    howToWithdraw: 'Do not do it!',
    customExchangeRate: '123454321',
  },
  {
    name: 'weth',
    symbol: 'weth',
    standard: 'erc20matic',
    address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
    decimals: 18,
    fullName: 'Wrapped Ether',
    customExchangeRate: '2',
  },
]

//window.SO_defaultQuickSell = `BNB`
//window.SO_defaultQuickBuy = `{BNB}SUBX`
//window.SO_fiatBuySupperted = [`bnb`]
window.buildOptions = {
  ownTokens: false, // Will be inited from window.widgetEvmLikeTokens
  addCustomTokens: true, // Allow user add custom evm like tokens
  // Or 'false' if enabled all
  curEnabled: {
    btc: true,
    eth: true,
    bnb: true,
    matic: true,
    arbeth: false,
    aureth: false,
    xdai: false,
    ftm: false,
    avax: false,
    movr: false,
    one: false,
    ame: false,
    ghost: false,
    next: false,
    phi_v1: false,
    phi: false,
    fkw: false,
    phpx: false,
  },
  blockchainSwapEnabled: {
    btc: true,
    eth: true,
    bnb: true,
    matic: false,
    arbeth: false,
    aureth: false,
    xdai: false,
    ftm: true,
    avax: true,
    movr: true,
    one: true,
    ame: true,
    ghost: false,
    next: false,
    phi_v1: false,
    phi: false,
    fkw: false,
    phpx: false,
  },
  defaultExchangePair: {
    buy: '{eth}wbtc',
    sell: 'btc',
  },
  /*
    Порядок валют на странице создания кошелька
    CUSTOM_ERC20, CUSTOM_BEP20, CUSTOM_ERC20MATIC - Добавление пользовательского токена (при условии addCustomERC20 = true)
    {ERC20}UNI - Токен в сети Эфира
    {BEP20}TOKENSYMBOL - Токен в сети бинанс
    {ERC20MATIC}TOKENSYMBOL - Токен в сети матик
    Все остальные коины, которые не указаны, будут помещены в конец списка в произвольном порядке
  */
  createWalletCoinsOrder: [
    '{ETH}UNI',
    'CUSTOM_ERC20',
    '{ETH}SHARE',
    'BTC',
    'CUSTOM_ERC20MATIC',
    'MATIC',
    'BNB',
    'CUSTOM_BEP20',
    'XDAI',
    'CUSTOM_ERC20XDAI',
    'FTM',
    'CUSTOM_ERC20FTM',
    'AVAX',
    'CUSTOM_ERC20AVAX',
    'MOVR',
    'CUSTOM_ERC20MOVR',
    'ONE',
    'CUSTOM_ERC20ONE',
    'AME',
    'CUSTOM_ERC20AME',
    'AURETH',
    'CUSTOM_ERC20AURORA',
    'PHI_V1',
    'CUSTOM_PHI20_V1',
    'PHI',
    'CUSTOM_PHI20',
    'FKW',
    'CUSTOM_FKW20',
  ],
  invoiceEnabled: true, // Allow create invoices
  showWalletBanners: true,
  addAllEnabledWalletsAfterRestoreOrCreateSeedPhrase: false,
  preventMultiTab: false,
}
