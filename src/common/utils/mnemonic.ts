import * as bitcoin from 'bitcoinjs-lib'
import BIP32Factory from 'bip32'
import * as ecc from 'tiny-secp256k1'
import { hdkey } from 'ethereumjs-wallet'
import * as bip39 from 'bip39'

const bip32 = BIP32Factory(ecc)

const getRandomMnemonicWords = () => bip39.generateMnemonic()

const validateMnemonicWords = (mnemonic) => bip39.validateMnemonic(convertMnemonicToValid(mnemonic))

const convertMnemonicToValid = (mnemonic) => mnemonic
  .trim()
  .toLowerCase()
  .split(` `)
  .filter((word) => word)
  .join(` `)

const getBtcWallet = (network, mnemonic, walletNumber = 0, path) => {
  mnemonic = convertMnemonicToValid(mnemonic)
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.fromSeed(seed, network)
  const node = root.derivePath(path || `m/44'/0'/0'/0/${walletNumber}`)

  const account = bitcoin.payments.p2pkh({
    pubkey: node.publicKey,
    network,
  })

  return {
    mnemonic,
    address: account.address,
    publicKey: node.publicKey.toString('hex'),
    WIF: node.toWIF(),
    node,
    account,
  }
}

const getEthLikeWallet = (params) => {
  const { mnemonic, walletNumber = 0, path } = params
  const validMnemonic = convertMnemonicToValid(mnemonic)
  const seed = bip39.mnemonicToSeedSync(validMnemonic)
  const hdwallet = hdkey.fromMasterSeed(seed)
  const wallet = hdwallet.derivePath((path) || `m/44'/60'/0'/0/${walletNumber}`).getWallet()
  const publicKey = wallet.getPublicKey()
  const privateKey = wallet.getPrivateKey()

  return {
    mnemonic: validMnemonic,
    address: `0x${wallet.getAddress().toString('hex')}`,
    publicKey: `0x${publicKey.toString('hex')}`,
    privateKey: `0x${privateKey.toString('hex')}`,
    wallet,
  }
}

const getGhostWallet = (network, mnemonic, walletNumber = 0, path) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.fromSeed(seed, network)
  const node = root.derivePath((path) || `m/44'/0'/0'/0/${walletNumber}`)

  const account = bitcoin.payments.p2pkh({
    pubkey: node.publicKey,
    network,
  })

  return {
    mnemonic,
    address: account.address,
    publicKey: node.publicKey.toString('hex'),
    WIF: node.toWIF(),
    node,
    account,
  }
}

const getNextWallet = (network, mnemonic, walletNumber = 0, path) => {
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const root = bip32.fromSeed(seed, network)
  const node = root.derivePath((path) || `m/44'/707'/0'/0/${walletNumber}`)

  const account = bitcoin.payments.p2pkh({
    pubkey: node.publicKey,
    network,
  })

  return {
    mnemonic,
    address: account.address,
    publicKey: node.publicKey.toString('hex'),
    WIF: node.toWIF(),
    node,
    account,
  }
}

const mnemonicIsValid = (mnemonic:string):boolean => bip39.validateMnemonic(convertMnemonicToValid(mnemonic))

export {
  getRandomMnemonicWords,
  validateMnemonicWords,
  mnemonicIsValid,
  convertMnemonicToValid,
  getBtcWallet,
  getEthLikeWallet,
  getGhostWallet,
  getNextWallet,
}
