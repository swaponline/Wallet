import { PureComponent } from 'react'
import { connect } from 'redaction'
import { BigNumber } from 'bignumber.js'
import { FormattedMessage } from 'react-intl'
import CSSModules from 'react-css-modules'
import getCoinInfo from 'common/coins/getCoinInfo'
import utils from 'common/utils'
import erc20Like from 'common/erc20Like'
import { EVM_COIN_ADDRESS, ZERO_ADDRESS } from 'common/helpers/constants/ADDRESSES'
import {
  apiLooper,
  externalConfig,
  constants,
  localStorage,
  metamask,
  links,
  user,
  cacheStorageGet,
  cacheStorageSet,
  quickswap,
} from 'helpers'
import { localisedUrl } from 'helpers/locale'
import actions from 'redux/actions'
import Link from 'local_modules/sw-valuelink'
import { buildApiSwapParams, estimateApiSwapData } from './swapApi'
import {
  ComponentState,
  Direction,
  BlockReasons,
  Sections,
  Actions,
  CurrencyMenuItem,
} from './types'
import {
  SWAP_API,
  GWEI_DECIMALS,
  COIN_DECIMALS,
  API_GAS_LIMITS,
  MAX_PERCENT,
  LIQUIDITY_SOURCE_DATA,
} from './constants'

import styles from './index.scss'
import TokenInstruction from './TokenInstruction'
import Header from './Header'
import InputForm from './InputForm'
import SourceActions from './SourceActions'
import UserInfo from './UserInfo'
import Settings from './Settings'
import Feedback from './Feedback'
import Footer from './Footer'

import UniV3Pools from './UniV3Pools'

const QuickswapModes = {
  aggregator: 'aggregator',
  source: 'source',
  only_aggregator: 'only_aggregator',
  only_source: 'only_source',
}

const CURRENCY_PLUG = {
  blockchain: '-',
  fullTitle: '-',
  name: '-',
  notExist: true,
}
import config from 'helpers/externalConfig'

class QuickSwap extends PureComponent<IUniversalObj, ComponentState> {
  constructor(props) {
    super(props)

    const { match, activeFiat, allCurrencies, history } = props
    const { params, path } = match

    const mode = QuickswapModes[window.quickswapMode]
    let onlyAggregator = false
    let onlySource = false
    let activeSection

    switch (mode) {
      case QuickswapModes.only_aggregator:
        activeSection = Sections.Aggregator
        onlyAggregator = true
        break
      case QuickswapModes.only_source:
        activeSection = Sections.Source
        onlySource = true
        break
      case QuickswapModes.aggregator:
        activeSection = Sections.Aggregator
        break
      case QuickswapModes.source:
        activeSection = Sections.Source
        break
      default:
        activeSection = Sections.Aggregator
    }

    // for testnets API isn't available
    if (externalConfig.entry === 'testnet') {
      activeSection = Sections.Source
      onlySource = true
    }

    const isSourceMode = activeSection === Sections.Source

    let {
      currentCurrencies,
      receivedList,
      spendedCurrency,
      receivedCurrency,
      wrongNetwork,
    } = this.returnCurrentAssetState(allCurrencies, activeSection)

    if (externalConfig.opts.defaultQuickSell) {
      const defaultSellCurrency = allCurrencies.filter((curData) => curData.value.toUpperCase() === externalConfig.opts.defaultQuickSell.toUpperCase())
      if (defaultSellCurrency.length) {
        [spendedCurrency] = defaultSellCurrency
        receivedList = this.returnReceivedList(allCurrencies, spendedCurrency)
      }
    }
    if (externalConfig.opts.defaultQuickBuy) {
      const defaultBuyCurrency = allCurrencies.filter((curData) => curData.value.toUpperCase() === externalConfig.opts.defaultQuickBuy.toUpperCase())
      if (defaultBuyCurrency.length) [receivedCurrency] = defaultBuyCurrency
    }

    // if we have url parameters then show it as default values
    if (!wrongNetwork && path.match(/\/quick/) && params.sell && params.buy) {
      const urlSpendedCurrency = currentCurrencies.find(
        (item) => item.value.toLowerCase() === params.sell.toLowerCase(),
      )
      if (!urlSpendedCurrency) history.push(localisedUrl('', `${links.quickSwap}`))

      const urlReceivedList = this.returnReceivedList(currentCurrencies, urlSpendedCurrency)
      const urlReceivedCurrency = urlReceivedList.find(
        (item) => item.value.toLowerCase() === params.buy.toLowerCase(),
      )

      if (!urlReceivedCurrency) history.push(localisedUrl('', `${links.quickSwap}`))

      // reassigning these variables only if url is correct
      if (urlSpendedCurrency && urlReceivedList && urlReceivedCurrency) {
        spendedCurrency = urlSpendedCurrency
        receivedList = urlReceivedList
        receivedCurrency = urlReceivedCurrency
      }
    }

    const baseChainWallet = actions.core.getWallet({
      currency: spendedCurrency.blockchain || spendedCurrency.value,
    })
    const fromWallet = actions.core.getWallet({
      currency: spendedCurrency.value,
    })
    const toWallet = actions.core.getWallet({
      currency: receivedCurrency.value,
    })

    this.state = {
      error: null,
      liquidityErrorMessage: '',
      isPending: false,
      isSourceMode,
      onlyAggregator,
      onlySource,
      activeSection,
      needApproveA: false,
      needApproveB: false,
      externalExchangeReference: null,
      externalWindowTimer: null,
      currentLiquidityPair: null,
      fiat: window.DEFAULT_FIAT || activeFiat,
      currencies: currentCurrencies,
      receivedList,
      baseChainWallet,
      spendedCurrency,
      spendedAmount: '',
      fromWallet: fromWallet || {},
      receivedCurrency,
      receivedAmount: '',
      toWallet: toWallet || {},
      sourceAction: Actions.Swap,
      slippage: 0.5,
      userDeadline: 20,
      slippageMaxRange: 100,
      wrongNetwork,
      network:
        externalConfig.evmNetworks[
          spendedCurrency.blockchain || spendedCurrency.value.toUpperCase()
        ],
      swapData: undefined,
      swapFee: '',
      gasPrice: '',
      gasLimit: '',
      blockReason: undefined,
      serviceFee: false,
      zeroxApiKey: window.zeroxApiKey || '',

      useUniSwapV3: false,
      uniV3PoolsByFee: [],
      uniV3ActivePoolFee: 0,

      // Wrap/Unwrap native coin
      isWrapUnwrap: false,
      isWrappedTokenA: false,
      isWrappedTokenB: false,
      isNativeTokenA: false,
      isNativeTokenB: false,
    }
  }

  setUseUniSwapV3(useV3) {
    this.setState(() => ({
      useUniSwapV3: useV3,
    }), () => {
      console.log('>>>> switch uniswap - update pair address')
      this.updateCurrentPairAddress()
    })
  }
  
  componentDidMount() {
    this.updateNetwork()
    this.updateServiceFeeData()
  }

  componentDidUpdate(prevProps, prevState) {
    const { metamaskData, availableBlockchains } = this.props
    const { metamaskData: prevMetamaskData } = prevProps
    const { wrongNetwork: prevWrongNetwork, activeSection: prevActiveSection } = prevState
    const { blockReason, currencies, spendedCurrency, activeSection, wrongNetwork: curWrongNetwork } = this.state

    const chainId = metamask.getChainId()
    const isCurrentNetworkAvailable = !!availableBlockchains[chainId]
    const isSpendedCurrencyNetworkAvailable = metamask.isAvailableNetworkByCurrency(spendedCurrency.value)
    const switchToCorrectNetwork = prevWrongNetwork
      && (isSpendedCurrencyNetworkAvailable || isCurrentNetworkAvailable)
    const switchToWrongNetwork = !prevWrongNetwork && !isSpendedCurrencyNetworkAvailable
    const switchFromWrongToWrong = prevWrongNetwork && curWrongNetwork
    const disconnect = prevMetamaskData.isConnected && !metamaskData.isConnected

    let needFullUpdate = (
      disconnect
      || (
        metamaskData.isConnected
        && (
          (
            (
              switchToCorrectNetwork
              || switchToWrongNetwork
            ) && !switchFromWrongToWrong
          )
          || prevMetamaskData.address !== metamaskData.address
        )
      )
    )

    //console.log('>>> need full up', needFullUpdate, switchToCorrectNetwork, switchToWrongNetwork, switchFromWrongToWrong)
    const changeSection = activeSection !== prevActiveSection

    if (changeSection) {
      const {
        currentCurrencies,
        spendedCurrency: newSpendedCurrency,
        wrongNetwork,
      } = this.returnCurrentAssetState(currencies, activeSection)

      const haveSpendedCurrencyInList = currentCurrencies.filter(currency => currency.value === spendedCurrency.value).length === 1

      const needCurrenciesListsUpdate = (
        newSpendedCurrency.value === spendedCurrency.value
        || haveSpendedCurrencyInList && !blockReason
      )

      if (needCurrenciesListsUpdate) {
        this.setState(() => ({
          wrongNetwork,
          currencies: currentCurrencies,
        }), this.updateReceivedList)
      } else if (!haveSpendedCurrencyInList) {
        needFullUpdate = true
      }
    }

    if (needFullUpdate) {
      const {
        currentCurrencies,
        receivedList,
        spendedCurrency,
        receivedCurrency,
        wrongNetwork,
      } = this.returnCurrentAssetState(currencies, activeSection)

      this.updateBaseChainWallet(spendedCurrency)

      const fromWallet = actions.core.getWallet({
        currency: spendedCurrency.value,
      })
      const toWallet = actions.core.getWallet({
        currency: receivedCurrency.value,
      })

      this.setState(() => ({
        wrongNetwork,
        currencies: currentCurrencies,
        spendedCurrency,
        receivedList,
        receivedCurrency,
        network:
          externalConfig.evmNetworks[
            spendedCurrency.blockchain || spendedCurrency.value.toUpperCase()
          ],
        fromWallet,
        toWallet,
      }))
    }
  }

  componentWillUnmount() {
    this.clearWindowTimer()
    this.saveOptionsInStorage()
  }

  returnCurrentAssetState = (currentCurrencies, activeSection: Sections) => {
    const { allCurrencies } = this.props

    let { currencies: filteredCurrencies, wrongNetwork } = quickswap.filterCurrencies({
      currencies: allCurrencies,
    })
    let currencies: any[] = []

    if (wrongNetwork) {
      filteredCurrencies = currentCurrencies
    }

    if (activeSection === Sections.Aggregator) {
      currencies = filteredCurrencies.filter(currency => {
        const { coin, blockchain } = getCoinInfo(currency.value)
        const network = externalConfig.evmNetworks[blockchain || coin]

        return !!SWAP_API[network?.networkVersion]
      })
    }

    if (!currencies.length) {
      currencies = filteredCurrencies.length ? filteredCurrencies : [ CURRENCY_PLUG ]
    }

    const spendedCurrency = currencies[0]
    let receivedList = this.returnReceivedList(currencies, spendedCurrency)

    // user doesn't have enough tokens in the wallet. Show a notice about it
    if (!receivedList.length) {
      receivedList = [CURRENCY_PLUG]
    }

    const receivedCurrency = receivedList[0]

    return {
      wrongNetwork,
      currentCurrencies: currencies,
      receivedList,
      spendedCurrency,
      receivedCurrency,
    }
  }

  updateServiceFeeData = () => {
    const { fromWallet } = this.state

    const feeOptsKey = fromWallet?.standard || fromWallet?.currency
    const currentFeeOpts = externalConfig.opts.fee[feeOptsKey?.toLowerCase()]
    const correctFeeRepresentation = !Number.isNaN(window?.zeroxFeePercent)
      && window.zeroxFeePercent >= 0
      && window.zeroxFeePercent <= 100

    // Если клиент уже установил больше 1% - используем принудительно 1%
    if (window.zeroxFeePercent > 1) window.zeroxFeePercent = 1
    if (currentFeeOpts?.address && correctFeeRepresentation) {
      // percent of the buyAmount >= 0 && <= 1
      const apiPercentFormat = new BigNumber(window.zeroxFeePercent).dividedBy(MAX_PERCENT)

      this.setState(() => ({
        serviceFee: {
          address: currentFeeOpts.address,
          percent: Number(apiPercentFormat),
        },
      }))
    } else {
      this.setState(() => ({
        serviceFee: false,
      }))
    }
  }

  updateBaseChainWallet = (currencyItem: CurrencyMenuItem) => {
    const { coin, blockchain } = getCoinInfo(currencyItem.value)
    const baseChainWallet = actions.core.getWallet({
      currency: blockchain || coin,
    })

    this.setState(() => ({
      baseChainWallet,
    }))
  }

  updateNetwork = async () => {
    const { spendedCurrency } = this.state

    const network = externalConfig.evmNetworks[spendedCurrency.blockchain || spendedCurrency.value.toUpperCase()]

    this.updateBaseChainWallet(spendedCurrency)

    this.setState(
      () => ({
        network,
      }),
      async () => {
        await this.updateCurrentPairAddress()
      },
    )
  }

  updateWallets = () => {
    const { spendedCurrency, receivedCurrency } = this.state

    this.updateBaseChainWallet(spendedCurrency)

    const fromWallet = actions.core.getWallet({
      currency: spendedCurrency.value,
    })
    const toWallet = actions.core.getWallet({
      currency: receivedCurrency.value,
    })

    this.setState(() => ({
      fromWallet,
      toWallet,
    }))
  }

  saveOptionsInStorage = () => {
    const { fromWallet, toWallet } = this.state

    const exchangeSettings = localStorage.getItem(constants.localStorage.exchangeSettings)

    if (exchangeSettings) {
      const sell = fromWallet.tokenKey || fromWallet.currency || ''
      const buy = toWallet.tokenKey || toWallet.currency || ''

      exchangeSettings.quickCurrency = {
        sell,
        buy,
      }
      localStorage.setItem(constants.localStorage.exchangeSettings, exchangeSettings)
    }
  }

  returnReceivedList = (currencies, spendedCurrency) => {
    const result = currencies.filter((item) => {
      const currentSpendedAsset = item.value === spendedCurrency?.value
      const spendedAssetChain = item.blockchain || item.value.toUpperCase()
      const receivedAssetChain =        spendedCurrency?.blockchain || spendedCurrency?.value?.toUpperCase()

      return spendedAssetChain === receivedAssetChain && !currentSpendedAsset
    })

    return result
  }

  updateReceivedList = () => {
    const { currencies, spendedCurrency } = this.state
    let receivedList = this.returnReceivedList(currencies, spendedCurrency)

    if (!receivedList.length) {
      receivedList = [
        {
          blockchain: '-',
          fullTitle: '-',
          name: '-',
          notExist: true,
        },
      ]
    }

    this.setState(
      () => ({
        receivedList,
        receivedCurrency: receivedList[0],
        toWallet: actions.core.getWallet({ currency: receivedList[0].value }),
      }),
      async () => {
        this.resetSwapData()
      },
    )
  }

  reportError = (error: IError) => {
    const { liquidityErrorMessage } = this.state
    const possibleNoLiquidity = JSON.stringify(error)?.match(/INSUFFICIENT_ASSET_LIQUIDITY/)
    const insufficientSlippage = JSON.stringify(error)?.match(/IncompleteTransformERC20Error/)
    const notEnoughBalance = error.message?.match(/(N|n)ot enough .* balance/)
    const notApproved = JSON.stringify(error)?.match(/SenderNotAuthorizedError/)

    if (possibleNoLiquidity) {
      this.setBlockReason(BlockReasons.NoLiquidity)
    } else if (insufficientSlippage) {
      this.setBlockReason(BlockReasons.InsufficientSlippage)
    } else if (notEnoughBalance) {
      this.setBlockReason(BlockReasons.NoBalance)
    } else if (liquidityErrorMessage) {
      this.setBlockReason(BlockReasons.Liquidity)
    } else if (notApproved) {
      this.setBlockReason(BlockReasons.NotApproved)
    } else {
      this.setBlockReason(BlockReasons.Unknown)

      console.group('%c Swap', 'color: red;')
      console.error(error)
      console.groupEnd()
    }

    this.setState(() => ({
      isPending: false,
      error,
    }))
  }

  onInputDataChange = async () => {
    const { activeSection, sourceAction, currentLiquidityPair } = this.state

    await this.updateCurrentPairAddress()
    await this.checkApprove(Direction.Spend)

    if (
      activeSection === Sections.Source
      && sourceAction !== Actions.AddLiquidity
      && currentLiquidityPair
    ) {
      this.resetSwapData()
    }

    this.setState(() => ({
      error: null,
    }))

    if (activeSection === Sections.Aggregator) {
      await this.fetchApiSwapPrice()
    } else if (activeSection === Sections.Source) {
      await this.processingSourceActions()
      // start approve check only after the received amount request in processingSourceActions()
      if (activeSection === Sections.Source && sourceAction === Actions.AddLiquidity) {
        await this.checkApprove(Direction.Receive)
      }
    }
  }

  tryToSkipValidation = (error): boolean => {
    const { code, reason, values } = JSON.parse(error.message)
    const INVALID_TX_CODE = 105
    const transactionError = code === INVALID_TX_CODE && reason === 'Error'
    const insufficientSlippage = reason === 'IncompleteTransformERC20Error'

    if (transactionError && !insufficientSlippage) {
      const liquidityError = values.message.match(/^[0-9a-zA-Z]+: K$/m)

      if (liquidityError) {
        this.setState(() => ({
          liquidityErrorMessage: liquidityError[0],
        }))
      }

      return true
    }

    return false
  }

  fetchApiSwapPrice = async () => {
    const {
      isSourceMode,
      network,
      spendedAmount,
      isPending,
      zeroxApiKey,
      slippage,
      fromWallet,
      toWallet,
      serviceFee,
      baseChainWallet,
      gasLimit,
      gasPrice,
    } = this.state

    if (!isSourceMode && !zeroxApiKey) {
      return console.log('%c0x API key is not set', 'color:red')
    }

    const dontFetch = (
      new BigNumber(spendedAmount).isNaN()
      || new BigNumber(spendedAmount).isEqualTo(0)
      || isPending
    )

    if (dontFetch) return

    this.setState(() => ({
      isPending: true,
      blockReason: undefined,
    }))

    let repeatRequest = true
    const params = buildApiSwapParams({
      route: '/price',
      slippage,
      spendedAmount,
      fromWallet,
      toWallet,
      serviceFee,
      zeroxApiKey,
    })
    let { headers, endpoint } = params

    while (repeatRequest) {
      const swap: any = await apiLooper.get(SWAP_API[network.networkVersion].name, endpoint, {
        headers,
        sourceError: true,
        reportErrors: (error: IError) => {
          if (!repeatRequest) {
            this.reportError(error)
          }
        },
      })

      if (!(swap instanceof Error)) {
        repeatRequest = false

        const data = await estimateApiSwapData({
          data: swap,
          withoutValidation: endpoint.match(/skipValidation/),
          baseChainWallet,
          toWallet,
          gasLimit,
          gasPrice,
          onError: this.reportError,
        })
        console.log('SWAP PRICE response', data)
        this.setState(() => ({ ...data }))
      } else if (this.tryToSkipValidation(swap)) {
        const p = buildApiSwapParams({
          route: '/price',
          skipValidation: true,
          slippage,
          spendedAmount,
          fromWallet,
          toWallet,
          serviceFee,
          zeroxApiKey,
        })
        headers = p.headers
        endpoint = p.endpoint
      } else {
        this.reportError(swap)
        repeatRequest = false
      }
    }
  }

  finalizeApiSwapData = async () => {
    const {
      network,
      spendedAmount,
      zeroxApiKey,
      slippage,
      fromWallet,
      toWallet,
      serviceFee,
      baseChainWallet,
      gasLimit,
      gasPrice,
    } = this.state

    const { headers, endpoint } = buildApiSwapParams({
      route: '/quote',
      slippage,
      spendedAmount,
      fromWallet,
      toWallet,
      serviceFee,
      zeroxApiKey,
    })

    this.resetSwapData()
    this.setState(() => ({
      swapFee: '',
      isPending: true,
    }))
    const rawQuote: any = await apiLooper.get(SWAP_API[network.networkVersion].name, endpoint, {
      headers,
      sourceError: true,
      reportErrors: this.reportError,
    })
    const data = await estimateApiSwapData({
      data: rawQuote,
      baseChainWallet,
      toWallet,
      gasLimit,
      gasPrice,
    })
    this.setState(() => ({ ...data }))
  }

  getHasUniSwapV3 = () => {
    const { network } = this.state
    return config && config.UNISWAP_V3_CONTRACTS && config.UNISWAP_V3_CONTRACTS[network.networkVersion]
  }

  isWrappedToken = (tokenAddress) => {
    const { network: { networkVersion: chainId } } = this.state
    return actions.uniswap.isWrappedToken({
      chainId,
      tokenAddress,
    })
  }
  isNativeToken = (tokenAddress) => (tokenAddress == EVM_COIN_ADDRESS) ? true : false

  updateCurrentPairAddress = async () => {
    const { network, baseChainWallet, fromWallet, toWallet, useUniSwapV3 } = this.state
    const tokenA = fromWallet?.contractAddress || EVM_COIN_ADDRESS
    const tokenB = toWallet?.contractAddress || EVM_COIN_ADDRESS

    const isWrappedTokenA = this.isWrappedToken(tokenA)
    const isWrappedTokenB = this.isWrappedToken(tokenB)
    const isNativeTokenA = this.isNativeToken(tokenA)
    const isNativeTokenB = this.isNativeToken(tokenB)

    console.log('>>>> UPDATE CURRENT PAIR ADDRESS', tokenA, tokenB, isWrappedTokenA, isWrappedTokenB, isNativeTokenA, isNativeTokenB)

    if ((isWrappedTokenA && isNativeTokenB) || (isWrappedTokenB && isNativeTokenA)) {
      this.setState({
        isWrapUnwrap: true,
        isWrappedTokenA,
        isWrappedTokenB,
        isNativeTokenA,
        isNativeTokenB,
        uniV3PoolsByFee: [],
        uniV3ActivePoolFee: 0,
        currentLiquidityPair: null,
        blockReason: undefined
      })
      return
    } else {
      this.setState({
        isWrapUnwrap: false,
        isWrappedTokenA,
        isWrappedTokenB,
        isNativeTokenA,
        isNativeTokenB,
      })
    }
    const hasUniSwapV3 = this.getHasUniSwapV3()
    
    let pairAddress = (useUniSwapV3 && hasUniSwapV3) ? false : cacheStorageGet(
      'quickswapLiquidityPair',
      `${externalConfig.entry}_${tokenA}_${tokenB}_${(useUniSwapV3 && hasUniSwapV3) ? 'V3' : 'V2'}`,
    )

    if (!pairAddress) {
      pairAddress = await actions.uniswap[(useUniSwapV3 && hasUniSwapV3) ? 'getPoolAddressV3All' : 'getPairAddress']({
        baseCurrency: baseChainWallet.currency,
        chainId: network.networkVersion,
        factoryAddress: LIQUIDITY_SOURCE_DATA[network.networkVersion]?.factory,
        tokenA,
        tokenB,
      })
      let newFee = 0
      if (useUniSwapV3 && hasUniSwapV3) {
        if (pairAddress.length) {
          // check exists pool for active fee
          const { uniV3ActivePoolFee } = this.state
          const existsCurrenctFeePool = pairAddress.filter(({ fee }) => {
            return (fee == uniV3ActivePoolFee)
          })
          const _pairAddress = pairAddress
          pairAddress = (existsCurrenctFeePool.length > 0) ? existsCurrenctFeePool[0].address : pairAddress[0].address
          this.setState(() => ({
            uniV3PoolsByFee: _pairAddress,
            uniV3ActivePoolFee: (existsCurrenctFeePool.length > 0) ? existsCurrenctFeePool[0].fee: _pairAddress[0].fee
          }))
          newFee = (existsCurrenctFeePool.length > 0) ? existsCurrenctFeePool[0].fee : _pairAddress[0].fee
        } else {
          pairAddress = ZERO_ADDRESS
          this.setState(() => ({
            uniV3PoolsByFee: [],
            uniV3ActivePoolFee: 0,
          }))
        }
      }
      const SECONDS = 15

      cacheStorageSet(
        'quickswapLiquidityPair',
        `${externalConfig.entry}_${tokenA}_${tokenB}_${(useUniSwapV3 && hasUniSwapV3) ? 'V3' : 'V2'}`,
        pairAddress,
        SECONDS,
      )
    } else {
      console.log('>>>> USE CACHE')
    }

    const noLiquidityPair = pairAddress === ZERO_ADDRESS

    this.setState(() => ({
      currentLiquidityPair: noLiquidityPair ? null : pairAddress,
      blockReason: noLiquidityPair ? BlockReasons.PairDoesNotExist : undefined,
    }))
  }

  processingSourceActions = async () => {
    const { sourceAction, currentLiquidityPair, spendedAmount, isWrapUnwrap } = this.state

    if (isWrapUnwrap) {
      this.setState({
        receivedAmount: spendedAmount,
      })
      return
    }
    if (!currentLiquidityPair || !spendedAmount) return

    switch (sourceAction) {
      case Actions.Swap:
        await this.fetchAmountOut()
        break
      case Actions.AddLiquidity:
        await this.fetchLiquidityData()
    }
  }

  fetchAmountOut = async () => {
    const {
      network,
      baseChainWallet,
      spendedAmount,
      fromWallet,
      toWallet,
      useUniSwapV3,
      uniV3ActivePoolFee,
    } = this.state

    const tokenA = fromWallet.contractAddress ?? EVM_COIN_ADDRESS
    const tokenB = toWallet.contractAddress ?? EVM_COIN_ADDRESS

    this.setPending(true)

    const hasUniSwapV3 = this.getHasUniSwapV3()
    
    try {
      const amountOut = await actions.uniswap[(hasUniSwapV3 && useUniSwapV3) ? 'getAmountOutV3' : 'getAmountOut']({
        routerAddress: LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router,
        baseCurrency: baseChainWallet.currency,
        chainId: network.networkVersion,
        tokenA,
        tokenADecimals: fromWallet.decimals ?? COIN_DECIMALS,
        amountIn: spendedAmount,
        tokenB,
        tokenBDecimals: toWallet.decimals ?? COIN_DECIMALS,
        fee: uniV3ActivePoolFee,
      })

      this.setState(() => ({
        receivedAmount: amountOut,
      }))
    } catch (error) {
      this.reportError(error)
    } finally {
      this.setPending(false)
    }
  }

  fetchLiquidityData = async () => {
    const { network, spendedAmount, baseChainWallet, currentLiquidityPair, fromWallet, toWallet } = this.state

    this.setPending(true)

    try {
      const result = await actions.uniswap.getLiquidityAmountForAssetB({
        chainId: network.networkVersion,
        pairAddress: currentLiquidityPair,
        routerAddress: LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router,
        baseCurrency: baseChainWallet.currency,
        tokenA: fromWallet.contractAddress ?? EVM_COIN_ADDRESS,
        amountADesired: spendedAmount,
        tokenADecimals: fromWallet.decimals ?? COIN_DECIMALS,
        tokenBDecimals: toWallet.decimals ?? COIN_DECIMALS,
      })

      this.setState(() => ({
        receivedAmount: result,
      }))
    } catch (error) {
      this.reportError(error)
    }

    this.setPending(false)
  }

  setSpendedAmount = (value) => {
    this.setState(() => ({
      spendedAmount: value,
    }))
  }

  setReceivedAmount = (value) => {
    this.setState(() => ({
      receivedAmount: value,
    }))
  }

  resetReceivedAmount = () => {
    this.setState(() => ({
      receivedAmount: '',
    }))
  }

  resetSwapData = () => {
    this.setState(() => ({ swapData: undefined }))
    this.resetReceivedAmount()
  }

  switchUniV3SourcePool = (fee, poolAddress) => {
    this.setState(() => ({
      uniV3ActivePoolFee: fee,
      currentLiquidityPair: poolAddress,
    }), () => {
      console.log('>>> UPDATE DATA ON FEE CHANGE')
      this.onInputDataChange()
    })
    
  }
  
  checkApprove = async (direction) => {
    const { network, isSourceMode, spendedAmount, receivedAmount, fromWallet, toWallet, useUniSwapV3 } = this.state
    const hasUniSwapV3 = this.getHasUniSwapV3()

    let amount = spendedAmount
    let wallet = fromWallet

    if (direction === Direction.Receive) {
      amount = receivedAmount
      wallet = toWallet
    }

    let spender: `0x${number}` = isSourceMode
      ? LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router
      : externalConfig.swapContract[SWAP_API[network.networkVersion].spender]

    if (hasUniSwapV3 && useUniSwapV3) {
      spender = config?.UNISWAP_V3_CONTRACTS[network.networkVersion]?.router
    }

    if (!wallet.isToken) {
      this.setNeedApprove(direction, false)
    } else {
      const { standard, address, contractAddress, decimals } = wallet
      const allowance = await erc20Like[standard].checkAllowance({
        contract: contractAddress,
        owner: address,
        decimals,
        spender,
      })

      if (amount) {
        this.setNeedApprove(direction, new BigNumber(amount).isGreaterThan(allowance))
      }
    }
  }

  setNeedApprove = (direction, value) => {
    if (direction === Direction.Spend) {
      this.setState(() => ({ needApproveA: value }))
    } else {
      this.setState(() => ({ needApproveB: value }))
    }
  }

  selectCurrency = (params) => {
    const { direction, value } = params
    const { spendedCurrency, receivedCurrency } = this.state

    const changeSpendedSide = direction === Direction.Spend && spendedCurrency.value !== value.value
    const changeReceivedSide = direction === Direction.Receive && receivedCurrency.value !== value.value

    if (changeSpendedSide) {
      this.setState(
        () => ({
          spendedCurrency: value,
        }),
        this.updateSpendedSide,
      )
    }

    if (changeReceivedSide) {
      this.setState(
        () => ({
          receivedCurrency: value,
        }),
        this.updateReceivedSide,
      )
    }
  }

  updateSpendedSide = async () => {
    const { spendedCurrency } = this.state

    const fromWallet = actions.core.getWallet({ currency: spendedCurrency.value })

    this.setState(
      () => ({
        fromWallet,
      }),
      async () => {
        this.updateNetwork()
        this.updateReceivedList()
        this.updateServiceFeeData()
        await this.onInputDataChange()
      },
    )
  }

  updateReceivedSide = () => {
    const { receivedCurrency } = this.state

    this.setState(
      () => ({
        toWallet: actions.core.getWallet({ currency: receivedCurrency.value }),
      }),
      async () => {
        await this.onInputDataChange()
      },
    )
  }

  flipCurrency = () => {
    const { currencies, fromWallet, spendedCurrency, receivedCurrency, toWallet, wrongNetwork } =      this.state

    if (wrongNetwork || receivedCurrency.notExist) return

    const receivedList = this.returnReceivedList(currencies, receivedCurrency)

    this.setState(
      () => ({
        fromWallet: toWallet,
        spendedCurrency: receivedCurrency,
        receivedList,
        toWallet: fromWallet,
        receivedCurrency: spendedCurrency,
      }),
      async () => {
        await this.onInputDataChange()
      },
    )
  }

  openExternalExchange = () => {
    const { externalExchangeReference, fromWallet } = this.state

    const link = user.getExternalExchangeLink({
      address: fromWallet.address,
      currency: fromWallet.currency,
    })

    if (link && (externalExchangeReference === null || externalExchangeReference.closed)) {
      this.setPending(true)

      const newWindowProxy = window.open(link)

      this.setState(
        () => ({
          externalExchangeReference: newWindowProxy,
        }),
        this.startCheckingExternalWindow,
      )
    } else {
      // in this case window reference must exist and the window is not closed
      externalExchangeReference?.focus()
    }
  }

  startCheckingExternalWindow = () => {
    const { externalExchangeReference } = this.state

    const timer = setInterval(() => {
      if (externalExchangeReference?.closed) {
        this.closeExternalExchange()
      }
    }, 1000)

    this.setState(() => ({
      externalWindowTimer: timer,
    }))
  }

  closeExternalExchange = () => {
    const { externalExchangeReference, externalWindowTimer } = this.state

    if (externalExchangeReference) {
      externalExchangeReference.close()

      this.setState(() => ({
        externalExchangeReference: null,
      }))
    }

    if (externalWindowTimer) {
      clearInterval(externalWindowTimer)

      this.setState(() => ({
        externalWindowTimer: null,
      }))
    }

    this.setPending(false)
  }

  clearWindowTimer = () => {
    const { externalWindowTimer } = this.state

    if (externalWindowTimer) {
      clearInterval(externalWindowTimer)
    }
  }

  openAggregatorSection = () => {
    this.setState(() => ({
      activeSection: Sections.Aggregator,
      isSourceMode: false,
      receivedAmount: '',
    }))
  }

  openSourceSection = () => {
    this.setState(() => ({
      activeSection: Sections.Source,
      sourceAction: Actions.Swap,
      isSourceMode: true,
      receivedAmount: '',
      swapData: undefined,
    }))
  }

  openSettingsSection = () => {
    this.setState(() => ({
      activeSection: Sections.Settings,
    }))
  }

  setAction = (type) => {
    this.resetSwapData()

    this.setState(() => ({
      spendedAmount: '',
      sourceAction: type,
    }))
  }

  mnemonicIsSaved = () => localStorage.getItem(constants.privateKeyNames.twentywords) === '-'

  setPending = (value: boolean) => {
    this.setState(() => ({
      isPending: value,
    }))
  }

  setBlockReason = (value: BlockReasons) => {
    this.setState(() => ({
      blockReason: value,
    }))
  }

  resetSpendedAmount = () => {
    this.setState(() => ({
      spendedAmount: '',
    }))
  }

  isApiRequestBlocking = () => {
    const {
      isPending,
      spendedAmount,
      fromWallet,
      baseChainWallet,
      slippage,
      slippageMaxRange,
      gasPrice,
      gasLimit,
    } = this.state

    const wrongSlippage = slippage
      && (new BigNumber(slippage).isEqualTo(0)
        || new BigNumber(slippage).isGreaterThan(slippageMaxRange))

    const wrongGasPrice = new BigNumber(gasPrice).isPositive()
      && new BigNumber(gasPrice).isGreaterThan(API_GAS_LIMITS.MAX_PRICE)

    const wrongGasLimit = new BigNumber(gasLimit).isPositive()
      && (new BigNumber(gasLimit).isLessThan(API_GAS_LIMITS.MIN_LIMIT)
        || new BigNumber(gasLimit).isGreaterThan(API_GAS_LIMITS.MAX_LIMIT))

    const wrongSettings = wrongGasPrice || wrongGasLimit || wrongSlippage
    const noBalance = baseChainWallet.balanceError || new BigNumber(baseChainWallet.balance).isEqualTo(0)

    return (
      noBalance
      || isPending
      || wrongSettings
      || new BigNumber(spendedAmount).isNaN()
      || new BigNumber(spendedAmount).isEqualTo(0)
      || new BigNumber(spendedAmount).isGreaterThan(fromWallet.balance)
    )
  }

  createLimitOrder = () => {
    actions.modals.open(constants.modals.LimitOrder)
  }

  render() {
    const { history, intl } = this.props
    const {
      baseChainWallet,
      activeSection,
      isSourceMode,
      onlyAggregator,
      onlySource,
      needApproveA,
      needApproveB,
      fiat,
      spendedAmount,
      spendedCurrency,
      receivedAmount,
      fromWallet,
      toWallet,
      receivedCurrency,
      sourceAction,
      wrongNetwork,
      network,
      swapData,
      swapFee,
      blockReason,
      slippage,
      serviceFee,

      currentLiquidityPair,
      useUniSwapV3,
      userDeadline,
      // Wrap/Unwrap
      isWrapUnwrap,
      isWrappedTokenA,
      isWrappedTokenB,
    } = this.state

    const hasUniSwapV3 = this.getHasUniSwapV3()
    
    const linked = Link.all(
      this,
      'slippage',
      'gasPrice',
      'gasLimit',
      'userDeadline',
      'spendedAmount',
      'receivedAmount',
    )

    const insufficientBalanceA = new BigNumber(fromWallet.balance).isEqualTo(0)
      || new BigNumber(spendedAmount)
        .plus(fromWallet?.standard ? 0 : swapFee || 0)
        .isGreaterThan(fromWallet.balance)

    const insufficientBalanceB = new BigNumber(toWallet.balance).isEqualTo(0)
      || new BigNumber(receivedAmount).isGreaterThan(toWallet.balance)

    return (
      <>
        {onlyAggregator && <TokenInstruction />}

        {spendedCurrency.notExist || receivedCurrency.notExist && (
          <p styleName="noAssetsNotice">
            <FormattedMessage
              id="notEnoughAssetsNotice"
              defaultMessage="You don't have available assets for {networkName} to exchange. Please change the network or add a custom asset to the wallet."
              values={{
                networkName: network.chainName || 'Unknown network',
              }}
            />
          </p>
        )}

        <section styleName="quickSwap">
          <Header
            network={network}
            onlyAggregator={onlyAggregator}
            onlySource={onlySource}
            activeSection={activeSection}
            wrongNetwork={wrongNetwork}
            receivedCurrency={receivedCurrency}
            openAggregatorSection={this.openAggregatorSection}
            openSourceSection={this.openSourceSection}
            openSettingsSection={this.openSettingsSection}
            hasUniSwapV3={hasUniSwapV3}
            useUniSwapV3={useUniSwapV3}
            setUseUniSwapV3={this.setUseUniSwapV3.bind(this)}
          />
          {activeSection === Sections.Settings ? (
            <Settings
              isSourceMode={isSourceMode}
              stateReference={linked}
              onInputDataChange={this.onInputDataChange}
              resetSwapData={this.resetSwapData}
              slippage={slippage}
            />
          ) : (
            <>
              {activeSection === Sections.Source && (
                <SourceActions
                  sourceAction={sourceAction}
                  setAction={this.setAction}
                  useUniSwapV3={useUniSwapV3}
                />
              )}
              {(sourceAction == Actions.UniPoolsV3 || sourceAction == Actions.AddLiquidityV3) ? (
                <>
                  <div>
                    <UniV3Pools
                      currentLiquidityPair={currentLiquidityPair}
                      parentState={this.state}
                      selectCurrency={this.selectCurrency}
                      flipCurrency={this.flipCurrency}
                      userDeadline={userDeadline}
                      slippage={slippage}
                      intl={intl}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div styleName={`${wrongNetwork ? 'disabled' : ''}`}>
                    <InputForm
                      parentState={this.state}
                      stateReference={linked}
                      selectCurrency={this.selectCurrency}
                      flipCurrency={this.flipCurrency}
                      openExternalExchange={this.openExternalExchange}
                      onInputDataChange={this.onInputDataChange}
                      setSpendedAmount={this.setSpendedAmount}
                      updateWallets={this.updateWallets}
                      insufficientBalanceA={insufficientBalanceA}
                      insufficientBalanceB={insufficientBalanceB}
                      resetReceivedAmount={this.resetReceivedAmount}
                      setReceivedAmount={this.setReceivedAmount}
                      switchUniV3SourcePool={this.switchUniV3SourcePool}
                    />
                  </div>
                </>
              )}
              
              <UserInfo
                history={history}
                isSourceMode={isSourceMode}
                slippage={slippage}
                network={network}
                swapData={swapData}
                swapFee={swapFee}
                spendedAmount={spendedAmount}
                baseChainWallet={baseChainWallet}
                fromWallet={fromWallet}
                toWallet={toWallet}
                fiat={fiat}
                serviceFee={serviceFee}
                useUniSwapV3={useUniSwapV3}
                setUseUniSwapV3={this.setUseUniSwapV3.bind(this)}
              />
              {!(sourceAction == Actions.UniPoolsV3 || sourceAction == Actions.AddLiquidityV3) && (
                <>
                  <Feedback
                    network={network}
                    isSourceMode={isSourceMode}
                    wrongNetwork={wrongNetwork}
                    insufficientBalanceA={insufficientBalanceA}
                    insufficientBalanceB={insufficientBalanceB}
                    blockReason={blockReason}
                    baseChainWallet={baseChainWallet}
                    spendedAmount={spendedAmount}
                    needApproveA={needApproveA}
                    needApproveB={needApproveB}
                    spendedCurrency={spendedCurrency}
                    receivedCurrency={receivedCurrency}
                    sourceAction={sourceAction}
                    isWrapUnwrap={isWrapUnwrap}
                  />

                  <Footer
                    history={history}
                    parentState={this.state}
                    isSourceMode={isSourceMode}
                    sourceAction={sourceAction}
                    reportError={this.reportError}
                    setBlockReason={this.setBlockReason}
                    resetSwapData={this.resetSwapData}
                    resetSpendedAmount={this.resetSpendedAmount}
                    isApiRequestBlocking={this.isApiRequestBlocking}
                    insufficientBalanceA={insufficientBalanceA}
                    insufficientBalanceB={insufficientBalanceB}
                    setPending={this.setPending}
                    onInputDataChange={this.onInputDataChange}
                    finalizeApiSwapData={this.finalizeApiSwapData}
                    baseChainWallet={baseChainWallet}
                    useUniSwapV3={useUniSwapV3}
                    hasUniSwapV3={hasUniSwapV3}
                    isWrapUnwrap={isWrapUnwrap}
                    isWrappedTokenA={isWrappedTokenA}
                    isWrappedTokenB={isWrappedTokenB}
                  />
                </>
              )}
            </>
          )}
        </section>
      </>
    )
  }
}

export default connect(({ currencies, user, oneinch }) => ({
  allCurrencies: currencies.items,
  tokensWallets: user.tokensData,
  activeFiat: user.activeFiat,
  metamaskData: user.metamaskData,
  availableBlockchains: oneinch.blockchains,
}))(CSSModules(QuickSwap, styles, { allowMultiple: true }))
