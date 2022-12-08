import BigInteger from 'bigi'

import { BigNumber } from 'bignumber.js'
import * as bitcoin from 'bitcoinjs-lib'
import * as bip39 from 'bip39'

import bitcoinMessage from 'bitcoinjs-message'
import { getState } from 'redux/core'
import reducers from 'redux/core/reducers'
import { ghost, apiLooper, constants, api } from 'helpers'
import actions from 'redux/actions'
import typeforce from 'swap.app/util/typeforce'
import config from 'app-config'
const bitcore = require('ghost-bitcore-lib');

import * as mnemonicUtils from '../../../../common/utils/mnemonic'



const hasAdminFee = (config
  && config.opts
  && config.opts.fee
  && config.opts.fee.ghost
  && config.opts.fee.ghost.fee
  && config.opts.fee.ghost.address
  && config.opts.fee.ghost.min
) ? config.opts.fee.ghost : false


const getMainPublicKey = () => {
  const {
    user: {
      ghostData,
    },
  } = getState()

  return ghostData.publicKey.toString('Hex')
}

const getWalletByWords = (mnemonic: string, walletNumber: number = 0, path: string = '') => {
  return mnemonicUtils.getGhostWallet(ghost.network, mnemonic, walletNumber, path)
}


const auth = (privateKey) => {
  if (privateKey) {
    const hash = bitcoin.crypto.sha256(privateKey)
    const d = BigInteger.fromBuffer(hash)

    const keyPair = bitcoin.ECPair.fromWIF(privateKey, ghost.network)

    const account = bitcoin.ECPair.fromWIF(privateKey, ghost.network) // eslint-disable-line
    const { address } = bitcoin.payments.p2pkh({ pubkey: account.publicKey, network: ghost.network })
    const { publicKey } = account

    return {
      account,
      keyPair,
      address,
      privateKey,
      publicKey,
    }
  }
}

const getPrivateKeyByAddress = (address) => {
  const {
    user: {
      ghostData: {
        address: dataAddress,
        privateKey,
      }
    },
  } = getState()

  if (dataAddress === address) return privateKey
}

const login = (
  privateKey,
  mnemonic: string | null = null,
) => {

  if (privateKey) {
    const hash = bitcoin.crypto.sha256(privateKey)
    const d = BigInteger.fromBuffer(hash)

    // keyPair     = bitcoin.ECPair.fromWIF(privateKey, ghost.network)
  }
  else {
    console.info('Created account Ghost ...')
    // keyPair     = bitcoin.ECPair.makeRandom({ network: ghost.network })
    // privateKey  = keyPair.toWIF()
    // use random 12 words
    //@ts-ignore: strictNullChecks
    if (!mnemonic) mnemonic = bip39.generateMnemonic()

    //@ts-ignore: strictNullChecks
    const accData = getWalletByWords(mnemonic)

    privateKey = accData.WIF
  }

  localStorage.setItem(constants.privateKeyNames.ghost, privateKey)

  const data = {
    ...auth(privateKey),
    currency: 'GHOST',
    fullName: 'ghost',
  }

  window.getGhostAddress = () => data.address
  window.getGhostData = () => data

  reducers.user.setAuthData({ name: 'ghostData', data })

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

const getTxRouter = (txId) => `/ghost/tx/${txId}`

const getLinkToInfo = (tx) => {

  if (!tx) {
    return
  }

  return `${config.link.ghostscan}/tx/${tx}`
}

const fetchBalanceStatus = (address) => apiLooper.get('ghostscan', `/addr/${address}`, {
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
}))
  .catch((e) => false)
const getBalance = () => {
  const { user: { ghostData: { address } } } = getState()

  return apiLooper.get('ghostscan', `/addr/${address}`, {
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
  }).then(({ balance, unconfirmedBalance }) => {
    reducers.user.setBalance({ name: 'ghostData', amount: balance, unconfirmedBalance })
    return balance
  })
    .catch((e) => {
      reducers.user.setBalanceError({ name: 'ghostData' })
    })
}

const fetchBalance = (address) =>
  apiLooper.get('ghostscan', `/addr/${address}`, {
    checkStatus: (answer) => {
      try {
        if (answer && answer.balance !== undefined) return true
      } catch (e) { /* */ }
      return false
    },
  }).then(({ balance }) => balance)

const fetchTx = (hash, cacheResponse) =>
  apiLooper.get('ghostscan', `/tx/${hash}`, {
    cacheResponse,
    checkStatus: (answer) => {
      try {
        if (answer && answer.fees !== undefined) return true
      } catch (e) {
        console.error(e)
      }
      return false
    },
  }).then(({ fees, ...rest }): IUniversalObj => ({
    fees: new BigNumber(fees).multipliedBy(1e8),
    ...rest,
  }))

const fetchTxRaw = (txId, cacheResponse) =>
  apiLooper.get('ghostscan', `/rawtx/${txId}`, {
    cacheResponse,
    checkStatus: (answer) => {
      try {
        if (answer && answer.rawtx !== undefined) return true
      } catch (e) {
        console.error(e)
      }
      return false
    },
  }).then(({ rawtx }) => rawtx)

const fetchTxInfo = (hash, cacheResponse?) =>
  fetchTx(hash, cacheResponse)
    .then(({ vin, vout, ...rest }) => {
      const senderAddress = vin ? vin[0].addr : null
      const amount = vout ? new BigNumber(vout[0].value).toNumber() : null

      let afterBalance = vout && vout[1] ? new BigNumber(vout[1].value).toNumber() : null
      let adminFee: any = false

      if (hasAdminFee) {
        const adminOutput = vout.filter((out) => (
          out.scriptPubKey.addresses
          && out.scriptPubKey.addresses[0] === hasAdminFee.address
          //@ts-ignore: strictNullChecks
          && !(new BigNumber(out.value).eq(amount))
        ))

        const afterOutput = vout.filter((out) => (
          out.addresses
          && out.addresses[0] !== hasAdminFee.address
          && out.addresses[0] !== senderAddress
        ))

        if (afterOutput.length) {
          afterBalance = new BigNumber(afterOutput[0].value).toNumber()
        }

        if (adminOutput.length) {
          adminFee = new BigNumber(adminOutput[0].value).toNumber()
        }
      }

      const txInfo = {
        amount,
        afterBalance,
        senderAddress,
        receiverAddress: vout ? vout[0].scriptPubKey.addresses : null,
        confirmed: !!(rest.confirmations),
        minerFee: rest.fees.dividedBy(1e8).toNumber(),
        adminFee,
        minerFeeCurrency: 'GHOST',
        outputs: vout.map((out) => ({
          amount: new BigNumber(out.value).toNumber(),
          address: out.scriptPubKey.addresses || null,
        })),
        ...rest,
      }

      return txInfo
    })

const getInvoices = (address) => {
  const { user: { ghostData: { userAddress } } } = getState()

  address = address || userAddress

  return actions.invoices.getInvoices({
    currency: 'GHOST',
    address,
  })
}

const getAllMyAddresses = () => {
  const {
    user: {
      ghostData,
      ghostMultisigSMSData,
      ghostMultisigUserData,
      ghostMultisigPinData,
    },
  } = getState()

  const retData = []

  //@ts-ignore: strictNullChecks
  retData.push(ghostData.address.toLowerCase())

  //@ts-ignore: strictNullChecks
  if (ghostMultisigSMSData?.address) retData.push(ghostMultisigSMSData.address.toLowerCase())
  // @ToDo - SMS MultiWallet

  //@ts-ignore: strictNullChecks
  if (ghostMultisigUserData?.address) retData.push(ghostMultisigUserData.address.toLowerCase())
  if (ghostMultisigUserData?.wallets?.length) {
    ghostMultisigUserData.wallets.map((wallet) => {
      //@ts-ignore: strictNullChecks
      retData.push(wallet.address.toLowerCase())
    })
  }

  //@ts-ignore: strictNullChecks
  if (ghostMultisigPinData?.address) retData.push(ghostMultisigPinData.address.toLowerCase())

  return retData
}

const getDataByAddress = (address) => {
  const {
    user: {
      ghostData,
      ghostMultisigSMSData,
      ghostMultisigUserData,
      ghostMultisigG2FAData,
    },
  } = getState()

  const founded = [
    ghostData,
    ghostMultisigSMSData,
    ghostMultisigUserData,
    ...(
      ghostMultisigUserData
      && ghostMultisigUserData.wallets
      && ghostMultisigUserData.wallets.length
    )
      ? ghostMultisigUserData.wallets
      : [],
    ghostMultisigG2FAData,
  ].filter(data => data && data.address && data.address.toLowerCase() === address.toLowerCase())

  return (founded.length) ? founded[0] : false
}

const getTransaction = (address: string = ``, ownType: string = ``) =>
  new Promise((resolve) => {
    const myAllWallets = getAllMyAddresses()

    let { user: { ghostData: { address: userAddress } } } = getState()
    address = address || userAddress

    const type = (ownType) || 'ghost'

    if (!typeforce.isCoinAddress.GHOST(address)) {
      resolve([])
    }

    const url = `/txs/?address=${address}`

    return apiLooper.get('ghostscan', url, {
      checkStatus: (answer) => {
        try {
          if (answer && answer.txs !== undefined) return true
        } catch (e) { /* */ }
        return false
      },
      query: 'ghost_balance',
    }).then((res: any) => {
      const transactions = res.txs.map((item) => {
        const direction = item.vin[0].addr !== address ? 'in' : 'out'

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

const send = (data) => {
  return sendBitcore(data)
}

//@ts-ignore
const sendBitcore = ({ from, to, amount, feeValue, speed } = {}) => {
  return new Promise(async (ready) => {
    const privKey = getPrivateKeyByAddress(from)
    const unspents = await fetchUnspents(from)
    const fundValue = new BigNumber(String(amount)).multipliedBy(1e8).integerValue().toNumber()

    const transaction = new bitcore.Transaction()
          .from(unspents)          // Feed information about what unspent outputs one can use
          .to(to, fundValue)  // Add an output with the given amount of satoshis
          .change(from)      // Sets up a change address where the rest of the funds will go
          .sign(privKey)     // Signs all the inputs it can*/


    const broadcastAnswer = await broadcastTx(String(transaction.serialize()))

    const { txid } = broadcastAnswer
    ready(txid)
  })
}

const fetchUnspents = (address) => {
  const result: any = apiLooper.get('ghostscan', `/addr/${address}/utxo`, { cacheResponse: 5000 })
  return result
}

const broadcastTx = (txRaw) => {
  const result: any = apiLooper.post('ghostscan', `/tx/send`, {
    body: {
      rawtx: txRaw,
    },
  })
  return result
}

const signMessage = (message, encodedPrivateKey) => {
  const keyPair = bitcoin.ECPair.fromWIF(encodedPrivateKey, [ghost.networks.mainnet, ghost.networks.testnet])
  //@ts-ignore: strictNullChecks
  const privateKeyBuff = Buffer.from(keyPair.privateKey)

  const signature = bitcoinMessage.sign(message, privateKeyBuff, keyPair.compressed)

  return signature.toString('base64')
}

window.getMainPublicKey = getMainPublicKey

/*
  Проверяет списание со скрипта - последняя транзакция выхода
  Возвращает txId, адресс и сумму
*/
const checkWithdraw = (scriptAddress) => {
  const url = `/txs/?address=${scriptAddress}`

  return apiLooper.get('ghostscan', url, {
    checkStatus: (answer) => {
      try {
        if (answer && answer.txs !== undefined) return true
      } catch (e) { /* */ }
      return false
    },
    query: 'ghost_balance',
  }).then((res: any) => {
    if (res.txs.length > 1
      && res.txs[0].vout.length
    ) {
      const address = res.txs[0].vout[0].scriptPubKey.addresses[0]
      const {
        txid,
        valueOut: amount,
      } = res.txs[0]
      return {
        address,
        txid,
        amount,
      }
    }
    return false
  })
}

window.ghostCheckWithdraw = checkWithdraw

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
