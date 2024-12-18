import config from 'app-config'
import { util } from 'swap.app'
import { constants } from 'swap.app'
import BigNumber from 'bignumber.js'
import reducers from 'redux/core/reducers'
import TOKEN_STANDARDS, { EXISTING_STANDARDS } from 'helpers/constants/TOKEN_STANDARDS'

const getCustomTokenConfig = () => {
  const tokensInfo = JSON.parse(localStorage.getItem('customToken') || '{}')

  if (!Object.keys(tokensInfo).length || !tokensInfo[config.entry]) {
    return {}
  }

  return tokensInfo[config.entry]
}

const initExternalConfig = () => {
  // Add to swap.core not exists tokens
  EXISTING_STANDARDS.forEach((standard) => {
    Object.keys(config[standard]).forEach((tokenSymbol) => {
      if (!constants.COIN_DATA[tokenSymbol]) {
        util.tokenRegistrar[standard].register(tokenSymbol, config[standard][tokenSymbol].decimals)
      }
    })
  })
}

const externalConfig = () => {
  // Reconfigure app config if it widget or use external config
  if (config.opts && config.opts.inited) {
    return config
  }

  config.opts = {
    inited: true,
    hasWalletConnect: true,
    curEnabled: {
      eth: true,
      bnb: true,
      matic: true,
      arbeth: true,
      aureth: true,
      xdai: true,
      ftm: true,
      avax: true,
      movr: true,
      one: true,
      ame: true,
      phi_v1: true,
      phi: true,
      fkw: true,
      phpx: true,
      btc: true,
      ghost: true,
      next: false,
    },
    blockchainSwapEnabled: {
      btc: true,
      eth: true,
      bnb: false,
      matic: false,
      arbeth: false,
      aureth: false,
      xdai: false,
      ftm: false,
      avax: false,
      movr: false,
      one: false,
      ame: false,
      phi_v1: false,
      phi: false,
      fkw: false,
      phpx: false,
      ghost: true,
      next: false,
    },
    L2_EVM_KEYS: ['aureth', 'arbeth'],
    createWalletCoinsOrder: false,
    buyFiatSupported: ['eth', 'matic'],
    defaultExchangePair: {
      buy: '{eth}wbtc',
      sell: 'btc',
    },
    preventMultiTab: true,
    defaultQuickSell: false,
    ownTokens: false,
    addCustomTokens: true,
    invoiceEnabled: !config.isWidget,
    showWalletBanners: false,
    showHowItsWork: false,
    fee: {},
    hideShowPrivateKey: false,
    plugins: {
      setItemPlugin: false,
      getItemPlugin: false,
      userDataPluginApi: false,
      backupPlugin: false,
      backupPluginUrl: false,
      restorePluginUrl: false,
    },
    WPuserHash: false,
    buyViaCreditCardLink: false,
    activeFiat: 'USD',
    exchangeDisabled: false,
    ui: {
      hideServiceLinks: false,
      serviceLink: 'https://onout.org/wallet',
      farmLink: false, // use default link #/marketmaker
      bannersSource: 'https://noxon.wpmix.net/swapBanners/banners.php',
      disableInternalWallet: false,
      faq: {
        before: [/*
          {
            title: 'Faq title before 1',
            content: 'Faq 1 content'
          },
          {
            title: 'Faq title before 2',
            content: 'Faq 2 content'
          }
        */],
        after: [/*
          {
            title: 'Faq title after',
            content: 'Faq content'
          }
        */]
      },
      menu: {
        before: [/*
          {
            "title": "After",
            "link": "https:\/\/google.com"
          }
        */],
        after: []
      },
    },
  }

  // WalletConnect custom ProjectID 
  if (window
    && window.SO_WalletConnectProjectId
  ) {
    config.api.WalletConnectProjectId = window.SO_WalletConnectProjectId
  }
  if (window
    && window.SO_WalletConnectDisabled
  ) {
    config.opts.hasWalletConnect = false
  }

  if (window
    && window.SO_AllowMultiTab
  ) {
    config.opts.preventMultiTab = false
  }
  if (window
    && window.SO_FaqBeforeTabs
    && window.SO_FaqBeforeTabs.length
  ) {
    config.opts.ui.faq.before = window.SO_FaqBeforeTabs
  }
  if (window
    && window.SO_FaqAfterTabs
    && window.SO_FaqAfterTabs.length
  ) {
    config.opts.ui.faq.after = window.SO_FaqAfterTabs
  }

  if (window
    && window.SO_MenuItemsBefore
    && window.SO_MenuItemsBefore.length
  ) {
    config.opts.ui.menu.before = window.SO_MenuItemsBefore
  }
  if (window
    && window.SO_MenuItemsAfter
    && window.SO_MenuItemsAfter.length
  ) {
    config.opts.ui.menu.after = window.SO_MenuItemsAfter
  }

  if (window?.SO_disableInternalWallet) {
    config.opts.ui.disableInternalWallet = window.SO_disableInternalWallet
  }

  if (window?.SO_addAllEnabledWalletsAfterRestoreOrCreateSeedPhrase) {
    config.opts.addAllEnabledWalletsAfterRestoreOrCreateSeedPhrase = window.SO_addAllEnabledWalletsAfterRestoreOrCreateSeedPhrase
  }

  if (window
    && window.SO_fiatBuySupperted
    && window.SO_fiatBuySupperted.length
  ) {
    config.opts.buyFiatSupported = window.SO_fiatBuySupperted
  }
  if (window
    && window.SO_defaultQuickSell
  ) {
    config.opts.defaultQuickSell = window.SO_defaultQuickSell
  }
  if (window
    && window.SO_defaultQuickBuy
  ) {
    config.opts.defaultQuickBuy = window.SO_defaultQuickBuy
  }
  if (window
    && window.SO_createWalletCoinsOrder
    && window.SO_createWalletCoinsOrder.length
  ) {
    config.opts.createWalletCoinsOrder = window.SO_createWalletCoinsOrder
  }

  if (window
    && window.invoiceEnabled
  ) {
    config.opts.invoiceEnabled = true
  }

  if (window
    && window.hideServiceLinks
  ) {
    config.opts.ui.hideServiceLinks = window.hideServiceLinks
  }

  if (window
    && window.WPuserHash
  ) {
    config.opts.WPuserHash = window.WPuserHash
    window.WPuserHash = false
  }

  if (window
    && window.showHowItWorksOnExchangePage
  ) {
    config.showHowItsWork = window.showHowItWorksOnExchangePage
  }

  if (window
    && window.buildOptions
    && Object.keys(window.buildOptions)
    && Object.keys(window.buildOptions).length
  ) {
    config.opts = { ...config.opts, ...window.buildOptions }
  }

  if (window
    && window.DEFAULT_FIAT
  ) {
    config.opts.activeFiat = window.DEFAULT_FIAT
  }
  reducers.user.setActiveFiat({ activeFiat: config.opts.activeFiat })

  if (window
    && window.EXCHANGE_DISABLED
  ) {
    config.opts.exchangeDisabled = window.EXCHANGE_DISABLED
  }


  // Plugin: enable/disable currencies
  if (window && window.CUR_NEXT_DISABLED === false) {
    config.opts.curEnabled.next = true
    config.opts.blockchainSwapEnabled.next = true
  }
  
  const wpCurrencyDisabledFlages = {
    /* WordPress window flag => option key */
    CUR_BTC_DISABLED: `btc`,
    CUR_GHOST_DISABLED: `ghost`,
    CUR_ETH_DISABLED: `eth`,
    CUR_BNB_DISABLED: `bnb`,
    CUR_MATIC_DISABLED: `matic`,
    CUR_ARBITRUM_DISABLED: `arbeth`,
    CUR_XDAI_DISABLED: `xdai`,
    CUR_FTM_DISABLED: `ftm`,
    CUR_AVAX_DISABLED: `avax`,
    CUR_MOVR_DISABLED: `movr`,
    CUR_ONE_DISABLED: `one`,
    CUR_AME_DISABLED: `ame`,
    CUR_AURORA_DISABLED: `aureth`,
    CUR_PHI_DISABLED: `phi_v1`,
    CUR_PHI_V2_DISABLED: `phi`,
    CUR_FKW_DISABLED: 'fkw',
    CUR_PHPX_DISABLED: 'phpx',
  }
  if (window) {
    Object.keys(wpCurrencyDisabledFlages).forEach((windowFlagKey) => {
      if (window[windowFlagKey] === true) {
        config.opts.curEnabled[wpCurrencyDisabledFlages[windowFlagKey]] = false
        config.opts.blockchainSwapEnabled[wpCurrencyDisabledFlages[windowFlagKey]] = false
      }
    })
  }


  config.enabledEvmNetworks = Object.keys(config.evmNetworks)
    .filter((key) => !config.opts.curEnabled || config.opts.curEnabled[key.toLowerCase()])
    .reduce((acc, key) => {
      acc[key] = config.evmNetworks[key]

      return acc
    }, {})

  config.enabledEvmNetworkVersions = Object.values(config.enabledEvmNetworks).map(
    (info: { networkVersion: number }) => info.networkVersion
  )

  // Plugins
  if (window
    && window.backupPlugin
    && window.backupUrl
    && window.restoreUrl
  ) {
    config.opts.plugins.backupPlugin = window.backupPlugin
    config.opts.plugins.backupPluginUrl = window.backupUrl
    config.opts.plugins.restorePluginUrl = window.restoreUrl
  }

  if (window
    && window.setItemPlugin
  ) {
    config.opts.plugins.setItemPlugin = window.setItemPlugin
  }
  if (window && window.getItemPlugin) {
    config.opts.plugins.getItemPlugin = window.getItemPlugin
  }
  if (window && window.userDataPluginApi) {
    config.opts.plugins.userDataPluginApi = window.userDataPluginApi
  }

  // ------
  if (window
    && window.buyViaCreditCardLink
  ) {
    config.opts.buyViaCreditCardLink = window.buyViaCreditCardLink
  }

  if (window
    && window.SWAP_HIDE_EXPORT_PRIVATEKEY !== undefined
  ) {
    config.opts.hideShowPrivateKey = window.SWAP_HIDE_EXPORT_PRIVATEKEY
  }

  if (window?.widgetEvmLikeTokens?.length) {
    config.opts.ownTokens = window.widgetEvmLikeTokens
  }

  if (config?.isWidget || config?.opts.ownTokens?.length) {
    // THIS IS CODE FOR SHOW ALL WIDGET TOKENS IN WALLET BY DEFAULT
    // if (config?.opts.ownTokens?.length) {
    //   config.opts.ownTokens.forEach((token) => {
    //     config[token.standard][token.name.toLowerCase()] = token

    //     const baseCurrency = TOKEN_STANDARDS[token.standard].currency.toUpperCase()
    //     const tokenName = token.name.toUpperCase()
    //     const tokenValue = `{${baseCurrency}}${tokenName}`

    //     reducers.core.markCoinAsVisible(tokenValue)
    //   })
    // }

    // Clean not uninitialized single-token
    // ? we can't use here as whole string {#WIDGETTOKENCODE#} ?
    const wcPb = `{#`
    const wcP = `WIDGETTOKENCODE`
    const wcPe = `#}`

    EXISTING_STANDARDS.forEach((standard) => {
      const ownTokens = {}

      Object.keys(config[standard]).forEach((tokenSymbol) => {
        if (tokenSymbol !== `${wcPb}${wcP}${wcPe}`) {
          ownTokens[tokenSymbol] = config[standard][tokenSymbol]
        }
      })

      config[standard] = ownTokens
    })
  }

  if (config.opts.addCustomTokens) {
    const customTokenConfig = getCustomTokenConfig()

    Object.keys(customTokenConfig).forEach((standard) => {
      if (!config[standard]) return

      Object.keys(customTokenConfig[standard]).forEach((tokenContractAddr) => {
        const tokenObj = customTokenConfig[standard][tokenContractAddr]
        const { symbol } = tokenObj

        if (!config[standard][symbol.toLowerCase()]) {
          config[standard][symbol.toLowerCase()] = {
            address: tokenObj.address,
            decimals: tokenObj.decimals,
            fullName: tokenObj.symbol,
            canSwap: true
          }
        }
      })
    })
  }

  // Comission config - default false
  if (window
    && window.widgetERC20Comisions
    && Object.keys(window.widgetERC20Comisions)
  ) {
    let hasTokenAdminFee = false

    Object.keys(window.widgetERC20Comisions).filter((key) => {
      const curKey = key.toLowerCase()
      if (window.widgetERC20Comisions[curKey]) {
        let { fee, address, min } = window.widgetERC20Comisions[curKey]
        let feeOk = false
        let minOk = false

        // @ToDo add currency isAddress Check
        if (fee && address && min) {
          try {
            fee = new BigNumber(fee.replace(',', '.')).toNumber()
            feeOk = true
          } catch (e) {
            console.error(`Fail convert ${fee} to number for ${curKey}`)
          }
          try {
            min = new BigNumber(min.replace(',', '.')).toNumber()
            minOk = true
          } catch (e) {
            console.error(`Fail convert ${min} to number for ${curKey}`)
          }

          if (minOk && feeOk) {
            config.opts.fee[curKey.toLowerCase()] = {
              fee,
              address,
              min,
            }
          }
        } else {
          if (TOKEN_STANDARDS[curKey.toLowerCase()] && address) {
            hasTokenAdminFee = true
            config.opts.fee[curKey.toLowerCase()] = {
              address,
            }
          }
        }
      }
    })

    // add currency commissions for tokens
    if (hasTokenAdminFee) {
      EXISTING_STANDARDS.forEach((standard) => {
        const baseCurrency = TOKEN_STANDARDS[standard].currency.toLowerCase()
        const baseCurrencyFee = config.opts.fee[baseCurrency]

        if (!config.opts.fee[standard]) {
          config.opts.fee[standard] = {}
        }

        if (baseCurrencyFee?.min && baseCurrencyFee?.fee && config.opts.fee[standard].address) {
          config.opts.fee[standard].min = baseCurrencyFee.min
          config.opts.fee[standard].fee = baseCurrencyFee.fee
        }
      })
    }
  }
  window.appConfig = config
  return config
}

export default externalConfig()

export {
  externalConfig,
  initExternalConfig,
}
