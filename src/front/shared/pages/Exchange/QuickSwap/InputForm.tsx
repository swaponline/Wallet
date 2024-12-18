import { useState, useEffect, useRef } from 'react'
import { FormattedMessage, useIntl } from 'react-intl'
import { connect } from 'redaction'
import CSSModules from 'react-css-modules'
import { withRouter } from 'react-router-dom'
import { utils, localStorage, constants, links } from 'helpers'
import { localisedUrl } from 'helpers/locale'
import actions from 'redux/actions'
import Tooltip from 'components/ui/Tooltip/Tooltip'
import Button from 'components/controls/Button/Button'
import InlineLoader from 'components/loaders/InlineLoader/InlineLoader'
import Switching from 'components/controls/Switching/Switching'
import SelectGroup from 'components/SelectGroup'
import { QuickSwapFormTour } from 'components/Header/WidgetTours'
import externalConfig from 'helpers/externalConfig'
import styles from './index.scss'
import { ComponentState, Direction, Actions, CurrencyMenuItem } from './types'

const usePrevious = (value) => {
  const ref = useRef()

  useEffect(() => {
    ref.current = value
  }, [value])

  return ref.current
}

type InputFormProps = {
  history: any
  user: any
  parentState: ComponentState
  stateReference: any
  selectCurrency: ({ direction: Direction, value: CurrencyMenuItem }) => void
  updateWallets: () => void
  flipCurrency: () => void
  openExternalExchange: () => void
  onInputDataChange: () => void
  resetReceivedAmount: () => void
  setSpendedAmount: (v: string) => void
  setReceivedAmount: (v: string) => void
  insufficientBalanceA: boolean
  insufficientBalanceB: boolean
  switchUniV3SourcePool: (fee: number, address: string) => void
}

function InputForm(props: InputFormProps) {
  const {
    history,
    user,
    parentState,
    stateReference,
    setSpendedAmount,
    selectCurrency,
    updateWallets,
    flipCurrency,
    openExternalExchange,
    onInputDataChange,
    resetReceivedAmount,
    setReceivedAmount,
    insufficientBalanceA,
    insufficientBalanceB,
    switchUniV3SourcePool,
  } = props

  const {
    isSourceMode,
    sourceAction,
    currencies,
    receivedList,
    currentLiquidityPair,
    spendedAmount,
    spendedCurrency,
    receivedAmount,
    receivedCurrency,
    fiat,
    fromWallet,
    toWallet,
    isPending,
    useUniSwapV3,
    uniV3PoolsByFee,
    uniV3ActivePoolFee,
  } = parentState

  const [fromBalancePending, setFromBalancePending] = useState(false)
  const [toBalancePending, setToBalancePending] = useState(false)

  const sawBankCardMessage = localStorage.getItem('sawBankCardMessage')
  const [isTourOpen, setIsTourOpen] = useState(!sawBankCardMessage)

  const closeTour = () => {
    setIsTourOpen(false)
    localStorage.setItem('sawBankCardMessage', true)
  }

  const hasFiatAmount = spendedAmount && fromWallet.infoAboutCurrency?.price_fiat
  const fiatValue = hasFiatAmount
    && utils.toMeaningfulFloatValue({
      value: spendedAmount,
      rate: fromWallet.infoAboutCurrency.price_fiat,
    })

  const updateBalance = async (direction, wallet) => {
    if (!Object.keys(wallet).length) return

    const key = wallet.standard || wallet.currency

    if (direction === Direction.Spend) setFromBalancePending(true)
    if (direction === Direction.Receive) setToBalancePending(true)

    await actions[key.toLowerCase()].getBalance(wallet.tokenKey)

    updateWallets()

    setTimeout(() => {
      if (direction === Direction.Spend) setFromBalancePending(false)
      if (direction === Direction.Receive) setToBalancePending(false)
    }, 300)
  }

  const balanceTooltip = (direction, wallet) => {
    const wrongTooltip = wallet.balanceError || Number.isNaN(wallet.balance)

    if (!wrongTooltip) {
      return (
        <span styleName="balanceTooltip">
          <span styleName="title">
            <FormattedMessage id="partial767" defaultMessage="Balance: " />
          </span>

          <button styleName="balanceUpdateBtn" onClick={() => updateBalance(direction, wallet)}>
            {wallet.balance}
            <i className="fas fa-sync-alt" styleName="icon" />
          </button>
        </span>
      )
    }

    return null
  }

  const getWalletStoreData = (wallet): IUniversalObj | undefined => {
    let data

    if (Object.keys(wallet).length) {
      data = wallet.isToken
        ? user.tokensData[wallet.tokenKey.toLowerCase()]
        : user[`${wallet.currency.toLowerCase()}Data`]
    }

    return data
  }

  const { locale } = useIntl()

  const openAddCustomTokenModal = () => {
    const { parentState: { baseChainWallet } } = props
    const baseCurrency = baseChainWallet.currency?.toLowerCase()

    history.push(localisedUrl(locale, links.home))
    actions.modals.open(constants.modals.AddCustomToken, {
      baseCurrency,
    })
  }

  const fromWalletData = getWalletStoreData(fromWallet)
  const toWalletData = getWalletStoreData(toWallet)

  useEffect(() => {
    updateBalance(Direction.Spend, fromWallet)
  }, [fromWalletData?.balance])

  useEffect(() => {
    updateBalance(Direction.Receive, toWallet)
  }, [toWalletData?.balance])

  const [isBalanceFetching, setIsBalanceFetching] = useState(user.isBalanceFetching)
  const prevIsBalanceFetching = usePrevious(isBalanceFetching)

  useEffect(() => {
    setIsBalanceFetching(user.isBalanceFetching)

    // update in the end of balance fetching
    if (prevIsBalanceFetching && !user.isBalanceFetching) {
      updateBalance(Direction.Spend, fromWallet)
      updateBalance(Direction.Receive, toWallet)
    }
  }, [user.isBalanceFetching])

  const [flagForLazyChanges, setFlagForLazyChanges] = useState(false)

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    if (flagForLazyChanges) {
      timeoutId = setTimeout(async () => {
        await onInputDataChange()
        setFlagForLazyChanges(false)
      }, 600)
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [flagForLazyChanges])

  useEffect(() => {
    onInputDataChange()
  }, [spendedCurrency?.value, receivedCurrency?.value, isSourceMode])

  const addFirstLiquidity = isSourceMode && (sourceAction === Actions.AddLiquidity) && !currentLiquidityPair

  const isValidNumber = (value) => !isNaN(Number(value)) && Number(value) > 0

  const handleSpendAmount = (value) => {
    setSpendedAmount(value)

    if (!receivedCurrency.notExist && isValidNumber(value) && value !== spendedAmount) {
      setFlagForLazyChanges(true)
    }

    // there will be new external data on "every" one of our changes
    // reset the old ones
    if (!addFirstLiquidity) resetReceivedAmount()
  }

  const handleReceiveAmount = (value) => {
    setReceivedAmount(value)

    if (isValidNumber(value) && value !== receivedAmount) {
      setFlagForLazyChanges(true)
    }
  }

  const supportedCurrencies = externalConfig.opts.buyFiatSupported
  const showFiatExchangeBtn = window.transakApiKey
    || supportedCurrencies.includes(spendedCurrency.value)

  const renderUniV3PoolsByFee = () => {
    return (
      <div styleName="univ3SwitchPoolFee">
        <strong>
          <FormattedMessage
            id="qe_UNIV3_PoolsByFee"
            defaultMessage="Pool fee:"
          />
        </strong>
        {uniV3PoolsByFee.map(({ fee, address }) => {
          return (
            <a styleName={(fee == uniV3ActivePoolFee) ? 'active' : ''}
              key={fee}
              onClick={() => {
                switchUniV3SourcePool(fee, address)
              }}
            >
              {(fee / 10000)}%
            </a>
          )
        })}
      </div>
    )
  }
  return (
    <form action="">
      <QuickSwapFormTour isTourOpen={isTourOpen} closeTour={closeTour} />

      <div styleName="inputWrapper">
        <SelectGroup
          activeFiat={fiat}
          error={insufficientBalanceA}
          fiat={fiatValue && fiatValue}
          inputValueLink={stateReference.spendedAmount.pipe(handleSpendAmount)}
          selectedValue={spendedCurrency.value}
          inputId="quickSwapSpendCurrencyInput"
          placeholder="0.00"
          currencies={currencies}
          inputToolTip={
            fromBalancePending ? (
              <div styleName="balanceLoader">
                <InlineLoader />
              </div>
            ) : (
              balanceTooltip(Direction.Spend, fromWallet)
            )
          }
          onSelect={(value) => selectCurrency({
            direction: Direction.Spend,
            value,
          })}
        />
      </div>

      <div styleName={`formCenter ${showFiatExchangeBtn ? 'padding' : ''}`}>
        {showFiatExchangeBtn && (
          <>
            <Button
              className="buyViaBankCardButton"
              styleName="fiatExchangeBtn"
              pending={isPending}
              disabled={isPending}
              onClick={openExternalExchange}
              empty
              small
            >
              <FormattedMessage id="buyViaBankCard" defaultMessage="Buy via bank card" />
            </Button>

            <Tooltip id="buyViaBankCardButton" place="top" mark={false}>
              <FormattedMessage
                id="bankCardButtonDescription"
                defaultMessage={
                  `In the modal window, you have to go through several steps to exchange fiat funds
                  for {buyCurrency}. Select {buyCurrency} in the window and specify the address
                  of your wallet (you can copy it below). Wait until the funds are credited to your address.
                  Then you can buy tokens using it.`
                }
                values={{
                  buyCurrency: spendedCurrency.value.toUpperCase(),
                }}
              />
            </Tooltip>
          </>
        )}

        <div styleName="arrows">
          <Switching noneBorder onClick={flipCurrency} />
        </div>
      </div>

      <div styleName={`inputWrapper ${receivedCurrency.notExist ? 'disabled' : ''}`}>
        <SelectGroup
          disabled={!addFirstLiquidity}
          activeFiat={fiat}
          error={isSourceMode && sourceAction === Actions.AddLiquidity && insufficientBalanceB}
          inputValueLink={stateReference.receivedAmount.pipe(handleReceiveAmount)}
          selectedValue={receivedCurrency.value}
          inputId="quickSwapReceiveCurrencyInput"
          currencies={receivedList}
          inputToolTip={
            toBalancePending ? (
              <div styleName="balanceLoader">
                <InlineLoader />
              </div>
            ) : (
              balanceTooltip(Direction.Receive, toWallet)
            )
          }
          onSelect={(value) => {
            selectCurrency({
              direction: Direction.Receive,
              value,
            })
          }}
        />
        {useUniSwapV3 && uniV3PoolsByFee.length > 0 && (
          <>{renderUniV3PoolsByFee()}</>
        )}
      </div>
      {receivedCurrency.notExist && (
        <div styleName="addCustomTokenBtn">
          <Button id="addCustomTokenBtn" onClick={openAddCustomTokenModal} empty small>
            <FormattedMessage id="addCustomToken" defaultMessage="Add custom token" />
          </Button>
        </div>
      )}
    </form>
  )
}

export default connect(({ user }) => ({
  user,
}))(withRouter(CSSModules(InputForm, styles, { allowMultiple: true })))
