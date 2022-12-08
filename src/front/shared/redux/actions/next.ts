import BigInteger from 'bigi'

import { BigNumber } from 'bignumber.js'
import * as bitcoin from 'bitcoinjs-lib'
import * as bip39 from 'bip39'

import bitcoinMessage from 'bitcoinjs-message'
import { getState } from 'redux/core'
import reducers from 'redux/core/reducers'
import { next, apiLooper, constants, api } from 'helpers'
import actions from 'redux/actions'
import typeforce from 'swap.app/util/typeforce'
import config from 'app-config'
import bitcore from 'bitcore-lib'
import * as mnemonicUtils from 'common/utils/mnemonic'
import { default as nextUtils } from 'common/utils/coin/next'


const NETWORK = (process.env.MAINNET) ? `MAINNET` : `TESTNET`


const hasAdminFee = !!config?.opts?.fee?.next?.min && config.opts.fee.next

const getMainPublicKey = () => {
  const {
    user: {
      nextData,
    },
  } = getState()

  return nextData.publicKey.toString('Hex')
}

const getWalletByWords = (mnemonic: string, walletNumber: number = 0, path: string = '') => {
  return mnemonicUtils.getNextWallet(next.network, mnemonic, walletNumber, path)
}


const auth = (privateKey) => {
  if (!privateKey) {
    throw new Error('Missing privateKey')
  }
  //@ts-ignore
  const keyPair = bitcoin.ECPair.fromWIF(privateKey, next.network)
  //@ts-ignore
  const account = bitcoin.ECPair.fromWIF(privateKey, next.network)
  //@ts-ignore
  const { address } = bitcoin.payments.p2pkh({
    pubkey: account.publicKey,
    //@ts-ignore
    network: next.network,
  })

  const { publicKey } = account

  return {
    account,
    keyPair,
    address,
    privateKey,
    publicKey,
  }
}

const getPrivateKeyByAddress = (address) => {
  const {
    user: {
      nextData: {
        address: oldAddress,
        privateKey,
      },
    },
  } = getState()

  if (oldAddress === address) return privateKey
  //@ts-ignore
  if (mnemonicAddress === address) return mnemonicKey
}

const login = (
  privateKey,
  mnemonic: string | null = null,
) => {

  if (privateKey) {
    const hash = bitcoin.crypto.sha256(privateKey)
    const d = BigInteger.fromBuffer(hash)

    // keyPair     = bitcoin.ECPair.fromWIF(privateKey, next.network)
  } else {
    console.info('Created account Next ...')
    // keyPair     = bitcoin.ECPair.makeRandom({ network: next.network })
    // privateKey  = keyPair.toWIF()
    // use random 12 words
    //@ts-ignore: strictNullChecks
    if (!mnemonic) mnemonic = bip39.generateMnemonic()

    //@ts-ignore: strictNullChecks
    const accData = getWalletByWords(mnemonic)

    privateKey = accData.WIF
  }

  localStorage.setItem(constants.privateKeyNames.next, privateKey)

  const data = {
    ...auth(privateKey),
    currency: 'NEXT',
    fullName: 'NEXT.coin',
  }

  window.getNextAddress = () => data.address
  window.getNextData = () => data

  reducers.user.setAuthData({
    name: 'nextData',
    data,
  })

  return privateKey
}


const getTx = (txRaw) => {
  if (txRaw
    && txRaw.getId
    //@ts-ignore
    && txRaw.getId instanceof 'function'
  ) {
    return txRaw.getId()
  } else {
    return txRaw
  }
}

const getTxRouter = (txId) => `/next/tx/${txId}`

const getLinkToInfo = (tx) => {
  if (!tx) {
    return
  }
  return `${config.link.nextExplorer}/#/tx/${tx}`
}

const fetchBalanceStatus = (address) => {
  return apiLooper.get('nextExplorer', `/address/${address}`, {
    checkStatus: (answer) => {
      try {
        if (answer && answer.balance !== undefined) return true
      } catch (e) { /* */console.log(e) }
      return false
    },
  }).then(({ balance, unconfirmedBalance }) => ({
    address,
    balance,
    unconfirmedBalance,
  })).catch((e) => false)
}

const getBalance = () => {
  const { user: { nextData: { address } } } = getState()

  return apiLooper.get('nextExplorer', `/address/${address}`, {
    inQuery: {
      delay: 500,
      name: `balance`,
    },
    checkStatus: (answer) => {
      try {
        if (answer && answer.balance !== undefined) return true
      } catch (e) { /* */ }
      return false
    },
    ignoreErrors: true,
  }).then((answer: any) => {
    const balance = (typeof answer.balance === 'undefined') ? 0 : answer.balance
    const unconfirmedBalance = (typeof answer.unconfirmedBalance === 'undefined') ? 0 : answer.unconfirmedBalance

    reducers.user.setBalance({
      name: 'nextData',
      amount: balance,
      unconfirmedBalance,
    })
    return balance
  }).catch((e) => {
    reducers.user.setBalanceError({ name: 'nextData' })
  })
}

const fetchBalance = (address) => nextUtils.fetchBalance({
  address,
  NETWORK,
})

const fetchTx = (hash, cacheResponse) => nextUtils.fetchTx({
  hash,
  cacheResponse,
  NETWORK,
})

const fetchTxRaw = (txId, cacheResponse) =>
  apiLooper.get('nextExplorer', `/rawtx/${txId}`, {
    cacheResponse,
    checkStatus: (answer) => {
      try {
        if (answer && answer.rawtx !== undefined) return true
      } catch (e) { /* */ }
      return false
    },
  }).then(({ rawtx }) => rawtx)

const fetchTxInfo = (hash, cacheResponse) => nextUtils.fetchTxInfo({
  hash,
  cacheResponse,
  NETWORK,
})

const getInvoices = (address) => {
  const { user: { nextData: { userAddress } } } = getState()

  address = address || userAddress

  return actions.invoices.getInvoices({
    currency: 'NEXT',
    address,
  })
}

const getAllMyAddresses = () => {
  const {
    user: {
      nextData,
      nextMultisigSMSData,
      nextMultisigUserData,
      nextMultisigPinData,
    },
  } = getState()

  const retData = []

  //@ts-ignore: strictNullChecks
  retData.push(nextData.address.toLowerCase())

  //@ts-ignore: strictNullChecks
  if (nextMultisigSMSData?.address) retData.push(nextMultisigSMSData.address.toLowerCase())
  // @ToDo - SMS MultiWallet

  //@ts-ignore: strictNullChecks
  if (nextMultisigUserData?.address) retData.push(nextMultisigUserData.address.toLowerCase())
  if (nextMultisigUserData?.wallets?.length) {
    nextMultisigUserData.wallets.map((wallet) => {
      //@ts-ignore: strictNullChecks
      retData.push(wallet.address.toLowerCase())
    })
  }

  //@ts-ignore: strictNullChecks
  if (nextMultisigPinData?.address) retData.push(nextMultisigPinData.address.toLowerCase())

  return retData
}

const getDataByAddress = (address) => {
  const {
    user: {
      nextData,
      nextMultisigSMSData,
      nextMultisigUserData,
      nextMultisigG2FAData,
    },
  } = getState()

  const founded = [
    nextData,
    nextMultisigSMSData,
    nextMultisigUserData,
    ...(
      nextMultisigUserData
      && nextMultisigUserData.wallets
      && nextMultisigUserData.wallets.length
    )
      ? nextMultisigUserData.wallets
      : [],
    nextMultisigG2FAData,
  ].filter(data => data && data.address && data.address.toLowerCase() === address.toLowerCase())

  return (founded.length) ? founded[0] : false
}

const getTransaction = (address: string = ``, ownType: string = ``) =>
  new Promise((resolve) => {
    const myAllWallets = getAllMyAddresses()

    let { user: { nextData: { address: userAddress } } } = getState()
    address = address || userAddress

    const type = (ownType) || 'next'

    if (!typeforce.isCoinAddress.NEXT(address)) {
      resolve([])
    }

    return apiLooper.get('nextExplorer', `/txs/${address}`, {
      checkStatus: (answer) => {
        try {
          if (answer && answer.txs !== undefined) return true
        } catch (e) { /* */ }
        return false
      },
    }).then((res: any) => {
      const transactions = res.txs.map((item) => {
        const direction = item.vin[0].address !== address ? 'in' : 'out'

        const isSelf = direction === 'out'
          && item.vout.filter((item) =>
            item.scriptPubKey.addresses[0] === address
          ).length === item.vout.length

        return ({
          type,
          hash: item.txid,
          //@ts-ignore: strictNullChecks
          canEdit: (myAllWallets.indexOf(address) !== -1),
          confirmations: item.confirmations,
          value: isSelf
            ? item.fees
            : item.vout.filter((item) => {
              if (!item.scriptPubKey.addresses) return false
              const currentAddress = item.scriptPubKey.addresses[0]

              return direction === 'in'
                ? (currentAddress === address)
                : (currentAddress !== address)
            })[0].value,
          date: item.time * 1000,
          direction: isSelf ? 'self' : direction,
        })
      })
      resolve(transactions)
    })
      .catch(() => {
        resolve([])
      })
  })

//@ts-ignore
const send = ({ from, to, amount, feeValue, speed } = {}) => {

  return new Promise(async (ready) => {
    const networks = bitcore.Networks
    const nextNetwork = {
      name: 'next-mainnet',
      alias: 'next-mainnet',
      pubkeyhash: 0x4b,
      privatekey: 0x80,
      scripthash: 0x05,
      xpubkey: 0x0488B21E,
      xprivkey: 0x0488ADE4,
      networkMagic: 0xcbe4d0a1,
      port: 7078,
      dnsSeeds: [
        config.api.nextExplorer,
      ]
    }
    networks.add(nextNetwork)

    const bitcoreNextNetwork = networks.get('next-mainnet', 'name')

    const bitcoinNetwork = networks.get('livenet', 'name')
    // need remove because of bitcore.PrivateKey() use 'privatekey' key to get network
    // for validation and bitcoin.livenet.privatekey === nextNetwork.privatekey
    networks.remove(bitcoinNetwork)

    const privKeyWIF = getPrivateKeyByAddress(from)
    const privateKey = new bitcore.PrivateKey(privKeyWIF, bitcoreNextNetwork)
    const publicKey = bitcore.PublicKey.fromPrivateKey(privateKey)
    const addressFrom = new bitcore.Address(publicKey, bitcoreNextNetwork)

    const unspents: bitcore.Transaction.UnspentOutput[] = await fetchUnspents(from) || []
    const amountSat = new BigNumber(String(amount)).multipliedBy(1e8).integerValue().toNumber()

    const transaction = new bitcore.Transaction()
      .from(unspents)
      .to(to, amountSat)
      .change(addressFrom)
      .sign(privateKey)

    const rawTx = String(transaction.serialize())
    const broadcastAnswer: any = await broadcastTx(rawTx)
    const txid = broadcastAnswer.raw

    ready(txid)
  })
}


const fetchUnspents = (address) => nextUtils.fetchUnspents({
  address,
  NETWORK,
}).then((unspents: any) => unspents.map(unspent => ({
    address: unspent.address,
    txId: unspent.txid,
    outputIndex: unspent.outputIndex,
    script: unspent.script,
    satoshis: unspent.satoshis,
  }))
)


const broadcastTx = (txRaw) => nextUtils.broadcastTx({
  txRaw,
  NETWORK,
})

const signMessage = (message, encodedPrivateKey) => {
  //@ts-ignore
  const keyPair = bitcoin.ECPair.fromWIF(encodedPrivateKey, [next.networks.mainnet])
  //@ts-ignore: strictNullChecks
  const privateKeyBuff = Buffer.from(keyPair.privateKey)

  const signature = bitcoinMessage.sign(message, privateKeyBuff, keyPair.compressed)

  return signature.toString('base64')
}

const checkWithdraw = (scriptAddress) => nextUtils.checkWithdraw({
  scriptAddress,
  NETWORK,
})

export default {
  login,
  checkWithdraw,
  getBalance,
  getTransaction,
  send,
  fetchUnspents,
  broadcastTx,
  fetchTx,
  fetchTxInfo,
  fetchBalance,
  signMessage,
  getTx,
  getLinkToInfo,
  getInvoices,
  getWalletByWords,
  getAllMyAddresses,
  getDataByAddress,
  getMainPublicKey,
  getTxRouter,
  fetchTxRaw,
}
