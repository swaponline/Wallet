import { useState } from 'react'
import { FormattedMessage } from 'react-intl'
import { isMobile } from 'react-device-detect'
import { BigNumber } from 'bignumber.js'
import CSSModules from 'react-css-modules'
import styles from './index.scss'
import commonUtils from 'common/utils'
import { AddressFormat, AddressType } from 'domain/address'
import { metamask, links, constants, localStorage, utils } from 'helpers'
import actions from 'redux/actions'
import { LIQUIDITY_SOURCE_DATA } from './constants'
import { SwapData } from './types'
import Address from 'components/ui/Address/Address'
import Copy from 'components/ui/Copy/Copy'
import Button from 'components/controls/Button/Button'
import Tooltip from 'components/ui/Tooltip/Tooltip'
import { COIN_DECIMALS, MAX_PERCENT } from './constants'
import { ServiceFee } from './types'
import config from 'helpers/externalConfig'


const onlyEvmWallets = (config?.opts?.ui?.disableInternalWallet) ? true : false

type ComponentProps = {
  history: any
  isSourceMode: boolean
  slippage: number
  network: EvmNetworkConfig
  swapData?: SwapData
  swapFee: string
  spendedAmount: string
  baseChainWallet: IUniversalObj
  fromWallet: IUniversalObj
  toWallet: IUniversalObj
  fiat: string
  serviceFee: ServiceFee | false
  useUniSwapV3?: boolean
  setUseUniSwapV3?: any
}

function UserInfo(props: ComponentProps) {
  const {
    history,
    isSourceMode,
    slippage,
    network,
    swapData,
    swapFee,
    fromWallet,
    toWallet,
    spendedAmount,
    baseChainWallet,
    fiat,
    serviceFee,
    useUniSwapV3,
    setUseUniSwapV3,
  } = props

  const hasUniSwapV3 = config && config.UNISWAP_V3_CONTRACTS && config.UNISWAP_V3_CONTRACTS[network.networkVersion]
  
  const mnemonic = localStorage.getItem(constants.privateKeyNames.twentywords)
  const [mnemonicSaved, setMnemonicSaved] = useState(mnemonic === '-')

  const isWalletCreated = localStorage.getItem(constants.localStorage.isWalletCreate)
  const saveSecretPhrase = !mnemonicSaved && !metamask.isConnected()

  const saveMnemonic = () => {
    actions.modals.open(constants.modals.SaveWalletSelectMethod, {
      onClose: () => {
        const mnemonic = localStorage.getItem(constants.privateKeyNames.twentywords)

        setMnemonicSaved(mnemonic === '-')
      },
    })
  }

  const createWallet = () => {
    const walletName = fromWallet.tokenKey || fromWallet.currency

    history.push(`${links.createWallet}/${walletName.toUpperCase()}`)
  }

  const connectWallet = () => {
    metamask.connect({ dontRedirect: true })
  }

  let fee: string | undefined = undefined
  let total: string | undefined = undefined
  let fiatFee: string | undefined = undefined
  let totalFiat: string | undefined = undefined
  let price: string | undefined = undefined

  if (swapData) {
    const { sellAmount, buyAmount } = swapData

    const fromAmount = commonUtils.amount.formatWithoutDecimals(
      sellAmount,
      fromWallet.decimals ?? COIN_DECIMALS
    )
    const toAmount = commonUtils.amount.formatWithoutDecimals(
      buyAmount,
      toWallet.decimals ?? COIN_DECIMALS
    )
    const howMuchToDisplay = 7

    price = `${new BigNumber(fromAmount).div(toAmount).dp(howMuchToDisplay).toString()} ${
      fromWallet.currency
    } / ${toWallet.currency}`

    const totalAmount = new BigNumber(spendedAmount).plus(swapFee).dp(howMuchToDisplay)

    fee = `${new BigNumber(swapFee).dp(howMuchToDisplay)} ${network.currency}`

    // don't show total amount for tokens. Show only transaction fee
    if (!fromWallet.isToken) {
      total = `${totalAmount} ${network.currency}`
    }

    if (baseChainWallet.infoAboutCurrency?.price) {
      const fixedAmount = utils.toMeaningfulFloatValue({
        value: swapFee,
        rate: baseChainWallet.infoAboutCurrency.price,
      })
      const fixedTotalAmount = utils.toMeaningfulFloatValue({
        value: totalAmount,
        rate: baseChainWallet.infoAboutCurrency.price,
      })

      fiatFee = `(${fixedAmount} ${fiat})`
      totalFiat = `(${fixedTotalAmount} ${fiat})`
    }
  }

  const connectWalletButton = (
    <Button
      id="connectWalletBtn"
      brand
      fullWidth
      styleName="walletButton"
      onClick={connectWallet}
    >
      <FormattedMessage id="Exchange_ConnectAddressOption" defaultMessage="Connect Wallet" />
    </Button>
  )
  const walletAddressBlock = (
    <span styleName="indicator">
      <FormattedMessage id="addressOfYourWallet" defaultMessage="Address of your wallet:" />

      <Copy text={fromWallet.address}>
        <span styleName="value address">
          <Address
            address={fromWallet.address}
            format={isMobile ? AddressFormat.Short : AddressFormat.Full}
            type={metamask.isConnected() ? AddressType.Metamask : AddressType.Internal}
          />
        </span>
      </Copy>
    </span>
  )

  const switchUseUniV3 = (useV3) => {
    setUseUniSwapV3(useV3)
  }
  return (
    <section styleName="userInfo">
      {onlyEvmWallets ? (
        <>
          {!metamask.isConnected() ? (
            <>{connectWalletButton}</>
          ) : (
            <>{walletAddressBlock}</>
          )}
        </>
      ) : (
        <>
          {!metamask.isConnected() && (!isWalletCreated || !mnemonicSaved) && (
            <>{connectWalletButton}</>
          )}
          {!isWalletCreated ? (
            <Button id="createWalletBtn" styleName="walletButton" gray fullWidth onClick={createWallet}>
              <FormattedMessage id="menu.CreateWallet" defaultMessage="Create wallet" />
            </Button>
          ) : saveSecretPhrase ? (
            <Button
              id="saveSecretPhraseBtn"
              styleName="walletButton"
              gray
              fullWidth
              onClick={saveMnemonic}
            >
              <FormattedMessage id="BTCMS_SaveMnemonicButton" defaultMessage="Save secret phrase" />
            </Button>
          ) : (
            <>{walletAddressBlock}</>
          )}
        </>
      )}

      <span styleName="indicator">
        <FormattedMessage id="network" defaultMessage="Network" />:{' '}
        <span styleName="value">{network.chainName}</span>
      </span>

      {isSourceMode && (
        <span styleName="indicator">
          <FormattedMessage id="source" defaultMessage="Source" />:{' '}
          {hasUniSwapV3 ? (
            <>
              {useUniSwapV3 ? (
                <span styleName="value">{`UniSwap V3`}</span>
              ) : (
                <span styleName="value">{LIQUIDITY_SOURCE_DATA[network.networkVersion]?.name}</span>
              )}
            </>
          ) : (
            <span styleName="value">{LIQUIDITY_SOURCE_DATA[network.networkVersion]?.name}</span>
          )}
        </span>
      )}

      <span styleName="indicator">
        <span>
          <FormattedMessage id="slippageTolerance" defaultMessage="Slippage tolerance" />{' '}
          <Tooltip id="slippageTolerance">
            <FormattedMessage
              id="slippageNotice"
              defaultMessage="Your transaction will revert if the price changes unfavorably by more than this percentage"
            />
          </Tooltip>
          :
        </span>
        <span styleName="value">{slippage}%</span>
      </span>

      {serviceFee && !isSourceMode && (
        <span styleName="indicator">
          <span>
            <FormattedMessage id="FeeInfoBlockServiceFee" defaultMessage="Service fee" />{' '}
            <Tooltip id="FeeInfoBlockServiceFee">
              <FormattedMessage
                id="aggregatorFeeDescription"
                defaultMessage="The percentage of the purchase amount that charged as a commission"
              />
            </Tooltip>
            :
          </span>
          <span styleName="value">
            {new BigNumber(serviceFee.percent).multipliedBy(MAX_PERCENT).toNumber()}%
          </span>
        </span>
      )}

      {price && (
        <span styleName="indicator">
          <FormattedMessage id="orders105" defaultMessage="Price" />:{' '}
          <span styleName="value">{price}</span>
        </span>
      )}

      {swapFee && fee && (
        <span styleName="indicator">
          <FormattedMessage id="fee" defaultMessage="Fee" />:{' '}
          <span styleName="value">
            {fee} {fiatFee && fiatFee}
          </span>
        </span>
      )}

      {total && spendedAmount && swapFee && (
        <span styleName="indicator">
          <FormattedMessage id="total" defaultMessage="Total" />:{' '}
          <span styleName="value">
            {total} {totalFiat && totalFiat}
          </span>
        </span>
      )}
    </section>
  )
}

export default CSSModules(UserInfo, styles, { allowMultiple: true })
