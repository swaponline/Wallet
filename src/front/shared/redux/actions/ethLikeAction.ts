import Web3 from 'web3'
import { BigNumber } from 'bignumber.js'
import { getState } from 'redux/core'
import actions from 'redux/actions'
import reducers from 'redux/core/reducers'
import DEFAULT_CURRENCY_PARAMETERS from 'common/helpers/constants/DEFAULT_CURRENCY_PARAMETERS'
import EVM_CONTRACTS_ABI from 'common/helpers/constants/EVM_CONTRACTS_ABI'
import ethLikeHelper from 'common/helpers/ethLikeHelper'
import * as mnemonicUtils from 'common/utils/mnemonic'
import typeforce from 'swap.app/util/typeforce'
import externalConfig from 'helpers/externalConfig'
import metamask from 'helpers/metamask'
import { feedback, constants, cacheStorageGet, cacheStorageSet, apiLooper } from 'helpers'

// get to contracts txs info
import InputDataDecoder from 'ethereum-input-data-decoder'
import WrappedCoinAbi from 'common/wrappedcoin/abi.json'

// use an ethereum private key for EVM compatible blockchains
const EVM_PRIVATE_KEY = 'eth'

class EthLikeAction {
  readonly coinName: string

  readonly ticker: string // upper case (ex. ETH)

  readonly tickerKey: string // lower case (ex. eth)

  readonly privateKeyName: string = EVM_PRIVATE_KEY

  readonly explorerApiName: string

  readonly explorerLink: string

  readonly explorerApiKey: string

  readonly chainId: string

  readonly adminFeeObj: {
    fee: string // percent of amount
    address: string // where to send
    min: string // min amount
  }

  readonly Web3: IUniversalObj

  private cache = new Map([['addressIsContract', {}]])

  constructor(options) {
    const {
      coinName,
      ticker,
      chainId,
      explorerApiName,
      explorerLink,
      explorerApiKey,
      adminFeeObj,
      web3,
    } = options

    this.coinName = coinName
    this.ticker = ticker
    this.chainId = chainId
    this.tickerKey = ticker.toLowerCase()
    this.explorerApiName = explorerApiName
    this.explorerLink = explorerLink
    this.explorerApiKey = explorerApiKey
    this.adminFeeObj = adminFeeObj
    this.Web3 = web3
  }

  getCurrentWeb3 = () => metamask.getWeb3() || this.Web3

  getWeb3 = () => this.getCurrentWeb3()

  reportError = (error, details = '') => {
    feedback.actions.failed(
      ''.concat(
        `Details => ticker: ${this.ticker}`,
        details ? `, ${details}` : '',
        ` | Error - ${error} `,
      ),
    )
    console.group(`Actions >%c ${this.ticker}`, 'color: red;')
    console.error('error: ', error)
    console.groupEnd()
  }

  getPrivateKeyByAddress = (address) => {
    const { user } = getState()
    const currencyData = user[`${this.tickerKey}Data`]

    if (currencyData.address === address) return currencyData.privateKey
  }

  getInvoices = () => {
    const { address } = getState().user[`${this.tickerKey}Data`]

    return actions.invoices.getInvoices({
      currency: this.ticker,
      address,
    })
  }

  getTx = (txRaw) => txRaw.transactionHash

  getTxRouter = (txId) => `/${this.tickerKey}/tx/${txId}`

  getLinkToInfo = (tx) => {
    if (!tx) return
    return `${this.explorerLink}/tx/${tx}`
  }

  fetchBalance = (address): Promise<number> => {
    const Web3 = this.getCurrentWeb3()
    return Web3.eth
      .getBalance(address)
      .then((result) => Number(Web3.utils.fromWei(result)))
      .catch((error) => console.error(error))
  }

  fetchTxInfo = (hash) => {
    const Web3 = this.getCurrentWeb3()
    return new Promise((res, rej) => {
      Web3.eth.getTransaction(hash)
        .then((tx) => {
          if (!tx) return res(null)
          const { from, to, value, gas, gasPrice, blockHash, input } = tx

          let amount = Web3.utils.fromWei(value)
          const minerFee = new BigNumber(Web3.utils.toBN(gas).toNumber())
            .multipliedBy(Web3.utils.toBN(gasPrice).toNumber())
            .dividedBy(1e18)
            .toNumber()

          let adminFee: number | false = false
          
          if ( input !== "0x" ) {
            // with contract interact
            // check wrapped coin
            let txData:any = false
            txData = new InputDataDecoder(WrappedCoinAbi).decodeData(tx.input)
            if (txData && txData.inputs?.length === 1 && txData.method === `withdraw`) {
              amount =  Web3.utils.fromWei(txData.inputs[0])
            }
          }
          if (this.adminFeeObj && to !== this.adminFeeObj.address) {
            const feeFromUsersAmount = new BigNumber(this.adminFeeObj.fee)
              .dividedBy(100)
              .multipliedBy(amount)

            if (new BigNumber(this.adminFeeObj.min).isGreaterThan(feeFromUsersAmount)) {
              adminFee = new BigNumber(this.adminFeeObj.min).toNumber()
            } else {
              adminFee = feeFromUsersAmount.toNumber()
            }
          }

          res({
            amount,
            afterBalance: null,
            receiverAddress: to,
            senderAddress: from,
            minerFee,
            minerFeeCurrency: this.ticker,
            adminFee,
            confirmed: blockHash !== null,
          })
        })
        .catch((error) => rej(error))
    })
  }

  login = (privateKey, mnemonic = '') => {

    const Web3 = this.getCurrentWeb3()
    let data

    if (privateKey) {
      data = Web3.eth.accounts.privateKeyToAccount(privateKey)
    } else {
      if (!mnemonic) {
        mnemonic = mnemonicUtils.getRandomMnemonicWords()
      }

      const accData = this.getWalletByWords(mnemonic)

      privateKey = accData.privateKey
      data = Web3.eth.accounts.privateKeyToAccount(privateKey)
      localStorage.setItem(constants.privateKeyNames[`${this.privateKeyName}Mnemonic`], privateKey)

    }

    localStorage.setItem(constants.privateKeyNames[this.privateKeyName], data.privateKey)

    Web3.eth.accounts.wallet.add(data.privateKey)

    reducers.user.setAuthData({ name: `${this.tickerKey}Data`, data })

    return data.privateKey
  }

  getBalance = (): Promise<number> => {
    const address = metamask.isEnabled() && metamask.isConnected()
      ? metamask.getAddress()
      : getState().user[`${this.tickerKey}Data`].address

    const balanceInCache = cacheStorageGet('currencyBalances', `${this.tickerKey}_${address}`)

    if (balanceInCache !== false) {
      reducers.user.setBalance({
        name: `${this.tickerKey}Data`,
        amount: balanceInCache,
      })
      return balanceInCache
    }

    return this.fetchBalance(address)
      .then((balance) => {
        cacheStorageSet('currencyBalances', `${this.tickerKey}_${address}`, balance, 30)
        reducers.user.setBalance({
          name: `${this.tickerKey}Data`,
          amount: balance,
        })
        return balance
      })
      .catch((error) => {
        console.error(error)
        reducers.user.setBalanceError({ name: `${this.tickerKey}Data` })
        return 0
      })
  }

  getAllMyAddresses = () => {
    const { user } = getState()
    const arrOfAddresses: string[] = []
    const dataAddress = user[`${this.tickerKey}Data`]?.address || ''
    const metamaskAddress: string = (
      metamask && metamask.isEnabled() && metamask.isConnected() && metamask.getAddress()
    ) || ''

    if (dataAddress) {
      arrOfAddresses.push(dataAddress.toLowerCase())
    }

    if (metamaskAddress && !arrOfAddresses.includes(metamaskAddress.toLowerCase())) {
      arrOfAddresses.push(metamaskAddress.toLowerCase())
    }

    return arrOfAddresses
  }

  getTransaction = (address = ``, ownType = ``) => {
    const ownerAddress = getState().user[`${this.tickerKey}Data`].address
    address = address || ownerAddress

    type ResponseItem = {
      value: number
      to: string
      hash: string
    }

    return new Promise((resolve) => {
      if (
        // some blockchains don't have API
        // don't show console errors in these cases
        !this.explorerApiKey
        || !typeforce.isCoinAddress[this.ticker](address)
      ) {
        resolve([])
      }

      if (this.explorerApiName === ``) {
        resolve([])
        return
      }

      const internalUrl = `?module=account&action=txlistinternal&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${this.explorerApiKey}`
      const url = `?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${this.explorerApiKey}`

      apiLooper
        .get(this.explorerApiName, internalUrl)
        .then((response: any) => {
          if (Array.isArray(response?.result)) {
            const internals: ResponseItem[] = []

            response.result.forEach((item: ResponseItem) => {
              const { value, to, hash } = item

              internals[hash] = {
                value,
                to,
              }
            })

            apiLooper
              .get(this.explorerApiName, url)
              .then((response: any) => {
                if (Array.isArray(response.result)) {
                  const transactions = this.formatTransactions({
                    address,
                    txs: response.result,
                    internalTxs: internals,
                    currencyName: ownType || this.tickerKey,
                  })

                  resolve(transactions)
                } else {
                  resolve([])
                }
              })
              .catch((error) => {
                this.reportError(error, 'part: getTransaction')
                resolve([])
              })
          } else {
            resolve([])
          }
        })
        .catch((error) => {
          resolve([])
        })
    })
  }

  formatTransactions = (params) => {
    const { address, txs, internalTxs, currencyName } = params

    const Web3 = this.getCurrentWeb3()
    const ownerAddress = getState().user[`${this.tickerKey}Data`].address

    return txs
      .filter(
        (item) => item.value > 0 || (internalTxs[item.hash] && internalTxs[item.hash].value > 0),
      ).map((item) => ({
        type: currencyName,
        confirmations: item.confirmations,
        hash: item.hash,
        status: item.blockHash ? 1 : 0,
        value: Web3.utils.fromWei(
          internalTxs[item.hash] && internalTxs[item.hash].value > 0
            ? internalTxs[item.hash].value
            : item.value,
        ),
        address: item.to,
        canEdit: address === ownerAddress,
        date: item.timeStamp * 1000,
        direction:
          (internalTxs[item.hash]
            && address.toLowerCase() === internalTxs[item.hash].to.toLowerCase())
          || address.toLowerCase() === item.to.toLowerCase()
            ? 'in'
            : 'out',
      }))
      .filter((item) => {
        if (
          item.direction === 'out'
          && item.address.toLowerCase() === this.adminFeeObj?.address?.toLowerCase()
        ) {
          return false
        }

        return true
      })
  }

  getWalletByWords = (mnemonic: string, walletNumber = 0, path = '') => (
    mnemonicUtils.getEthLikeWallet({ mnemonic, walletNumber, path })
  )

  checkSwapExists = async (params) => {
    const { ownerAddress, participantAddress } = params
    const Web3 = this.getCurrentWeb3()
    const swapContract = new Web3.eth.Contract(EVM_CONTRACTS_ABI.NATIVE_COIN_SWAP, externalConfig.swapContract[this.tickerKey])

    const swap = await swapContract.methods.swaps(ownerAddress, participantAddress).call()
    const balance = swap && swap.balance ? parseInt(swap.balance, 10) : 0

    return balance > 0
  }

  estimateGas = async (txData): Promise<string> => {
    const web3 = this.getCurrentWeb3()
    const multiplierForGasReserve = 1.05

    try {
      const limit = await web3.eth.estimateGas(txData)
      const hexLimitWithPercentForSuccess = new BigNumber(
        new BigNumber(limit).multipliedBy(multiplierForGasReserve).toFixed(0),
      ).toString(16)

      return `0x${hexLimitWithPercentForSuccess}`
    } catch (error) {
      this.reportError(error, 'estimateGas')

      return error
    }
  }

  isValidGasLimit = (limit) => (
    typeof limit === 'number'
    || (typeof limit === 'string' && limit.match(/^0x[0-9a-f]+$/i))
  )

  send = async (params): Promise<{ transactionHash: string } | number | Error> => {
    const {
      to,
      amount = 0,
      amountInWei = false,
      gasLimit: customGasLimit,
      speed,
      data,
      waitReceipt = false,
      estimateGas = false,
    } = params
    let { gasPrice } = params

    const Web3 = this.getCurrentWeb3()
    const ownerAddress = metamask.isConnected() ? metamask.getAddress() : getState().user[`${this.tickerKey}Data`].address
    const recipientIsContract = await this.isContract(to)

    gasPrice = gasPrice || (await ethLikeHelper[this.tickerKey].estimateGasPrice({ speed }))

    const defaultGasLimitKey = externalConfig?.L2_EVM_KEYS?.includes(this.tickerKey) ? this.tickerKey : 'evmLike'
    const defaultGasLimit = recipientIsContract
      ? DEFAULT_CURRENCY_PARAMETERS[defaultGasLimitKey].limit.contractInteract
      : DEFAULT_CURRENCY_PARAMETERS[defaultGasLimitKey].limit.send

    let sendMethod = Web3.eth.sendTransaction
    let txData: any = {
      data: data || undefined,
      from: Web3.utils.toChecksumAddress(ownerAddress),
      to: to.trim(),
      gasPrice,
      value: (amountInWei) ? amount : Web3.utils.toHex(Web3.utils.toWei(String(amount), 'ether')),
    }

    if (customGasLimit) {
      txData.gas = customGasLimit
    } else {
      const result: any = await this.estimateGas(txData)

      // the calculation failed which means this transaction
      // will be failed in the blockchain
      if (result instanceof Error) return result

      if (this.isValidGasLimit(result)) {
        txData.gas = result
      } else {
        txData.gas = defaultGasLimit
      }
    }

    if (estimateGas) {
      return new BigNumber(txData.gas).multipliedBy(txData.gasPrice).toNumber()
    }

    const privateKey = this.getPrivateKeyByAddress(ownerAddress)
    const walletData = actions.core.getWallet({
      address: ownerAddress,
      currency: this.ticker,
    })

    if (!walletData?.isMetamask) {
      const signedData = await Web3.eth.accounts.signTransaction(txData, privateKey)

      txData = signedData.rawTransaction
      sendMethod = Web3.eth.sendSignedTransaction
    }

    return new Promise((res, rej) => {
      sendMethod(txData)
        .on('transactionHash', (hash) => {
          reducers.transactions.addTransactionToQueue({
            networkCoin: this.ticker,
            hash,
          })

          if (!waitReceipt) {
            res({ transactionHash: hash })
          }
        })
        .on('receipt', (receipt) => {
          if (waitReceipt) res(receipt)

          if (this.adminFeeObj && !walletData.isMetamask) {
            this.sendAdminTransaction({
              from: Web3.utils.toChecksumAddress(ownerAddress),
              amount,
              gasPrice,
              defaultGasLimit,
            })
          }
        })
        .on('error', (error) => rej(error))
    })
  }

  sendAdminTransaction = async (params) => {
    const {
      from,
      amount,
      gasPrice,
      defaultGasLimit,
      externalAdminFeeObj,
    } = params
    const adminObj = externalAdminFeeObj || this.adminFeeObj
    const minAmount = new BigNumber(adminObj.min)
    const Web3 = this.getCurrentWeb3()

    let feeFromUsersAmount = new BigNumber(adminObj.fee)
      .dividedBy(100) // 100 %
      .multipliedBy(amount)
      .toNumber()

    if (minAmount.isGreaterThan(feeFromUsersAmount)) {
      feeFromUsersAmount = minAmount.toNumber()
    }

    const remainingBalance = await this.fetchBalance(from)

    if (new BigNumber(remainingBalance).isLessThan(feeFromUsersAmount)) {
      return
    }

    const txData = {
      from: Web3.utils.toChecksumAddress(from),
      to: adminObj.address.trim(),
      gasPrice,
      gas: '0x00',
      value: Web3.utils.toHex(
        Web3.utils.toWei(String(feeFromUsersAmount),
          'ether',
        )),
    }

    const limit = await this.estimateGas(txData)

    if (this.isValidGasLimit(limit)) {
      txData.gas = limit
    } else {
      txData.gas = defaultGasLimit
    }

    return this.sendReadyTransaction({ data: txData, toAdmin: true })
  }

  sendReadyTransaction = async (params) => {
    const { waitReceipt = false, toAdmin = false } = params
    let { data } = params

    const Web3 = this.getCurrentWeb3()
    const ownerAddress = metamask.isConnected()
      ? metamask.getAddress()
      : getState().user[`${this.tickerKey}Data`].address

    let sendMethod = Web3.eth.sendTransaction

    const walletData = actions.core.getWallet({
      address: ownerAddress,
      currency: this.ticker,
    })

    if (!walletData?.isMetamask) {
      const privateKey = this.getPrivateKeyByAddress(ownerAddress)
      const signedData = await Web3.eth.accounts.signTransaction(data, privateKey)

      data = signedData.rawTransaction
      sendMethod = Web3.eth.sendSignedTransaction
    }

    return new Promise((res, rej) => {
      sendMethod(data)
        .on('receipt', (receipt) => {
          if (waitReceipt) res(receipt)
        })
        .on('transactionHash', (hash) => {
          console.group('%c tx hash', 'color: green;')
          console.log(hash)
          console.groupEnd()
          if (!toAdmin && !waitReceipt) {
            reducers.transactions.addTransactionToQueue({
              networkCoin: this.ticker,
              hash,
            })
          }

          if (!waitReceipt) res(hash)
        })
        .on('error', (error) => {
          const isRejected = JSON.stringify(error).match(/([Dd]enied transaction|[Cc]ance(ll|l)ed)/)

          if (!isRejected) {
            this.reportError(error, 'part: sendReadyTransaction')
          }

          rej(error)
        })
    })
  }

  isContract = async (address: string): Promise<boolean> => {
    const lowerAddress = address.toLowerCase()
    const contractsList = this.cache.get('addressIsContract') || {}

    if (contractsList && contractsList[lowerAddress]) {
      return contractsList[lowerAddress]
    }

    const Web3 = this.getCurrentWeb3()

    try {
      const codeAtAddress = await Web3.eth.getCode(address)

      const codeIsEmpty = !codeAtAddress || codeAtAddress === '0x' || codeAtAddress === '0x0'

      contractsList[lowerAddress] = !codeIsEmpty

      return !codeIsEmpty
    } catch (err) {
      return false
    }
  }
}

const providers = externalConfig.web3

const INFURA_API_KEY =  (window && window.SO_INFURA_API_KEY) ? window.SO_INFURA_API_KEY : externalConfig.api.InfuraApiKey
providers.provider = providers.provider.replace(`{INFURA_API_KEY}`, INFURA_API_KEY)

export default {
  ETH: new EthLikeAction({
    coinName: 'Ethereum',
    ticker: 'ETH',
    chainId: externalConfig.evmNetworks.ETH.chainId,
    explorerApiName: 'etherscan',
    explorerApiKey: externalConfig.api.etherscan_ApiKey,
    explorerLink: externalConfig.link.etherscan,
    adminFeeObj: externalConfig.opts?.fee?.eth,
    web3: new Web3(providers.provider),
  }),
  // use an ethereum private key for EVM compatible blockchains
  BNB: new EthLikeAction({
    coinName: 'Binance Coin',
    ticker: 'BNB',
    chainId: externalConfig.evmNetworks.BNB.chainId,
    explorerApiName: 'bscscan',
    explorerApiKey: externalConfig.api.bscscan_ApiKey,
    explorerLink: externalConfig.link.bscscan,
    adminFeeObj: externalConfig.opts?.fee?.bnb,
    web3: new Web3(providers.binance_provider),
  }),
  MATIC: new EthLikeAction({
    coinName: 'MATIC Token',
    ticker: 'MATIC',
    chainId: externalConfig.evmNetworks.MATIC.chainId,
    explorerApiName: 'maticscan',
    explorerApiKey: externalConfig.api.polygon_ApiKey,
    explorerLink: externalConfig.link.maticscan,
    adminFeeObj: externalConfig.opts?.fee?.matic,
    web3: new Web3(providers.matic_provider),
  }),
  ARBETH: new EthLikeAction({
    coinName: 'Arbitrum ETH',
    ticker: 'ARBETH',
    chainId: externalConfig.evmNetworks.ARBETH.chainId,
    explorerApiName: 'rinkeby-explorer',
    explorerApiKey: '',
    explorerLink: externalConfig.link.arbitrum,
    adminFeeObj: externalConfig.opts?.fee?.arbeth,
    web3: new Web3(providers.arbitrum_provider),
  }),
  XDAI: new EthLikeAction({
    coinName: 'xDai',
    ticker: 'XDAI',
    chainId: externalConfig.evmNetworks.XDAI.chainId,
    explorerApiName: '', // needs for show transactions
    explorerApiKey: '',
    explorerLink: externalConfig.link.xdai,
    adminFeeObj: externalConfig.opts?.fee?.xdai,
    web3: new Web3(providers.xdai_provider),
  }),
  FTM: new EthLikeAction({
    coinName: 'Fantom',
    ticker: 'FTM',
    chainId: externalConfig.evmNetworks.FTM.chainId,
    explorerApiName: 'ftmscan',
    explorerApiKey: externalConfig.api.ftm_ApiKey,
    explorerLink: externalConfig.link.ftmscan,
    adminFeeObj: externalConfig.opts?.fee?.ftm,
    web3: new Web3(providers.ftm_provider),
  }),
  AVAX: new EthLikeAction({
    coinName: 'Avalanche',
    ticker: 'AVAX',
    chainId: externalConfig.evmNetworks.AVAX.chainId,
    explorerApiName: 'avaxscan',
    explorerApiKey: externalConfig.api.avax_ApiKey,
    explorerLink: externalConfig.link.avaxscan,
    adminFeeObj: externalConfig.opts?.fee?.avax,
    web3: new Web3(providers.avax_provider),
  }),
  MOVR: new EthLikeAction({
    coinName: 'Moonriver',
    ticker: 'MOVR',
    chainId: externalConfig.evmNetworks.MOVR.chainId,
    explorerApiName: 'movrscan',
    explorerApiKey: externalConfig.api.movr_ApiKey,
    explorerLink: externalConfig.link.movrscan,
    adminFeeObj: externalConfig.opts?.fee?.movr,
    web3: new Web3(providers.movr_provider),
  }),
  ONE: new EthLikeAction({
    coinName: 'Harmony One',
    ticker: 'ONE',
    chainId: externalConfig.evmNetworks.ONE.chainId,
    explorerApiName: 'onescan',
    explorerApiKey: externalConfig.api.one_ApiKey,
    explorerLink: externalConfig.link.oneExplorer,
    adminFeeObj: externalConfig.opts?.fee?.one,
    web3: new Web3(providers.one_provider),
  }),
  AURETH: new EthLikeAction({
    coinName: 'Aurora ETH',
    ticker: 'AURETH',
    chainId: externalConfig.evmNetworks.AURETH.chainId,
    explorerApiName: 'aurorascan',
    explorerApiKey: externalConfig.api.aurora_ApiKey,
    explorerLink: externalConfig.link.auroraExplorer,
    adminFeeObj: externalConfig.opts?.fee?.aureth,
    web3: new Web3(providers.aurora_provider),
  }),
  PHI_V1: new EthLikeAction({
    coinName: 'PHI_V1',
    ticker: 'PHI_V1',
    chainId: externalConfig.evmNetworks.PHI_V1.chainId,
    explorerApiName: ``, // нет апи - пустой список транзакций
    explorerApiKey: externalConfig.api?.phi_ApiKey,
    explorerLink: externalConfig.link.phi_v1Explorer,
    adminFeeObj: externalConfig.opts?.fee?.phi_v1,
    web3: new Web3(providers.phi_v1_provider),
  }),
  PHI: new EthLikeAction({
    coinName: 'PHI',
    ticker: 'PHI',
    chainId: externalConfig.evmNetworks.PHI.chainId,
    explorerApiName: 'phiscan', // ???
    explorerApiKey: 'not_needed_apikey',
    explorerLink: externalConfig.link.phi_Explorer,
    adminFeeObj: externalConfig.opts?.fee?.phi,
    web3: new Web3(providers.phi_provider),
  }),
  FKW: new EthLikeAction({
    coinName: 'FKW',
    ticker: 'FKW',
    chainId: externalConfig.evmNetworks.FKW.chainId,
    explorerApiName: 'fkwscan', // ???
    explorerApiKey: 'api-no-key',
    explorerLink: externalConfig.link.fkw_Explorer,
    adminFeeObj: externalConfig.opts?.fee?.fkw,
    web3: new Web3(providers.fkw_provider),
  }),
  PHPX: new EthLikeAction({
    coinName: 'PHPX',
    ticker: 'PHPX',
    chainId: externalConfig.evmNetworks.PHPX.chainId,
    explorerApiName: 'phpxscan',
    explorerApiKey: 'api-no-key',
    explorerLink: externalConfig.link.phpx_Explorer,
    adminFeeObj: externalConfig.opts?.fee?.phpx,
    web3: new Web3(providers.phpx_provider),
  }),
  AME: new EthLikeAction({
    coinName: 'AME',
    ticker: 'AME',
    chainId: externalConfig.evmNetworks.AME.chainId,
    explorerApiName: 'amescan',
    explorerApiKey: externalConfig.api.ame_ApiKey,
    explorerLink: externalConfig.link.amescan,
    adminFeeObj: externalConfig.opts?.fee?.ame,
    web3: new Web3(providers.ame_provider),
  }),
}
