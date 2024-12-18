import { FormattedMessage } from 'react-intl'
import { useState } from 'react'
import CSSModules from 'react-css-modules'
import styles from './index.scss'
import utils from 'common/utils'
import ADDRESSES from 'common/helpers/constants/ADDRESSES'
import actions from 'redux/actions'
import { feedback, externalConfig, constants, transactions, routing } from 'helpers'
import { ComponentState, BlockReasons, Actions, Direction } from './types'
import {
  SWAP_API,
  GWEI_DECIMALS,
  COIN_DECIMALS,
  LIQUIDITY_SOURCE_DATA,
  SEC_PER_MINUTE,
} from './constants'
import Button from 'components/controls/Button/Button'
import ReviewSwapModal from './ReviewSwapModal'


type FooterProps = {
  history: any
  parentState: ComponentState
  insufficientBalanceA: boolean
  insufficientBalanceB: boolean
  isSourceMode: boolean
  sourceAction: Actions
  reportError: (e: IError) => void
  resetSwapData: VoidFunction
  resetSpendedAmount: VoidFunction
  setBlockReason: (a: BlockReasons) => void
  isApiRequestBlocking: () => boolean
  setPending: (a: boolean) => void
  onInputDataChange: VoidFunction
  finalizeApiSwapData: () => Promise<void>
  baseChainWallet: IUniversalObj

  hasUniSwapV3: boolean
  useUniSwapV3: boolean

  isWrapUnwrap: boolean
  isWrappedTokenA: boolean
  isWrappedTokenB: boolean
}

function Footer(props: FooterProps) {
  const {
    history,
    parentState,
    isSourceMode,
    sourceAction,
    reportError,
    setBlockReason,
    resetSwapData,
    resetSpendedAmount,
    isApiRequestBlocking,
    insufficientBalanceA,
    insufficientBalanceB,
    setPending,
    baseChainWallet,
    onInputDataChange,
    finalizeApiSwapData,
    useUniSwapV3,
    hasUniSwapV3,
    
    isWrapUnwrap,
    isWrappedTokenA,
    isWrappedTokenB,
  } = props

  const {
    blockReason,
    network,
    spendedAmount,
    fromWallet,
    spendedCurrency,
    receivedCurrency,
    toWallet,
    swapData,
    gasLimit,
    gasPrice,
    needApproveA,
    needApproveB,
    isPending,
    receivedAmount,
    userDeadline,
    error,
    slippage,
    currentLiquidityPair,
    swapFee,
    serviceFee,
    fiat,
    uniV3ActivePoolFee,
  } = parentState

  const [finalizeSwap, setFinalizeSwap] = useState<boolean>(false)

  const startSwapReview = async () => {
    setFinalizeSwap(true)
    await finalizeApiSwapData()
  }

  const approve = async (direction) => {
    let spender: `0x${number}` = isSourceMode
      ? LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router
      : externalConfig.swapContract[SWAP_API[network.networkVersion].spender]

    if (useUniSwapV3 && hasUniSwapV3) {
      spender = externalConfig?.UNISWAP_V3_CONTRACTS[network.networkVersion]?.router
    }
    
    let wallet = fromWallet
    let amount = spendedAmount

    if (direction === Direction.Receive) {
      wallet = toWallet
      amount = receivedAmount
    }

    setPending(true)

    try {
      const transactionHash = await actions[wallet.standard].approve({
        to: spender,
        name: wallet.tokenKey,
        amount,
      })

      actions.notifications.show(constants.notifications.Transaction, {
        link: transactions.getLink(wallet.standard, transactionHash),
      })

      setPending(false)
      await onInputDataChange()
    } catch (error) {
      reportError(error)
    }
  }

  const apiSwap = async () => {
    if (isSourceMode) return
    if (!swapData) throw new Error('No swap data. Can not complete swap')
    if (swapData.to !== externalConfig.swapContract[SWAP_API[network.networkVersion].spender]) {
      return console.log('%c0x constant proxy is not equal to swap transaction proxy', 'color:red')
    }

    const baseCurrency = fromWallet.standard ? fromWallet.baseCurrency : fromWallet.currency
    const assetName = fromWallet.standard ? fromWallet.tokenKey : fromWallet.currency

    feedback.zerox.startedSwap(
      `Network: ${network.chainName}. ${fromWallet.currency} -> ${toWallet.currency}`
    )
    setPending(true)

    try {
      if (gasLimit) swapData.gas = gasLimit
      if (gasPrice) swapData.gasPrice = utils.amount.formatWithDecimals(gasPrice, GWEI_DECIMALS)

      const txHash = await actions[baseCurrency.toLowerCase()].sendReadyTransaction({
        data: swapData,
      })

      if (txHash) {
        const txInfoUrl = transactions.getTxRouter(assetName.toLowerCase(), txHash)
        routing.redirectTo(txInfoUrl)
      }

      resetSwapData()
      resetSpendedAmount()
    } catch (error) {
      reportError(error)
    }

    setPending(false)
    setFinalizeSwap(false)
  }

  const handleWrap = async () => {
    setPending(true)

    const baseCurrency = fromWallet.standard ? fromWallet.baseCurrency : fromWallet.currency
    const result = await actions.uniswap.nativeCoinWrapper({
      baseCurrency,
      chainId: network.networkVersion,
      amount: spendedAmount,
      waitReceipt: true,
      isWrap: (isWrappedTokenB) ? true : false,
    })
    
    setPending(false)

    if (result instanceof Error) {
      if (result?.message?.match(/INSUFFICIENT_OUTPUT_AMOUNT/)) {
        setBlockReason(BlockReasons.InsufficientSlippage)
      } else {
        reportError(result)
      }
    } else if (result?.transactionHash) {
      const txInfoUrl = transactions.getTxRouter(
        fromWallet.standard ? fromWallet.tokenKey : fromWallet.currency,
        result.transactionHash
      )

      routing.redirectTo(txInfoUrl)
    }
  }

  const directSwap = async () => {
    if (sourceAction !== Actions.Swap || !isSourceMode) return

    const baseCurrency = fromWallet.standard ? fromWallet.baseCurrency : fromWallet.currency

    feedback.liquiditySource.startedSwap(
      `Network: ${network.chainName}. Source: ${
        LIQUIDITY_SOURCE_DATA[network.networkVersion]?.name
      }. Route: ${fromWallet.currency} -> ${toWallet.currency}`
    )
    setPending(true)


    try {
      let result: any = false

      if (hasUniSwapV3 && useUniSwapV3) {
        result = await actions.uniswap.swapCallbackV3({
          slippage,
          baseCurrency,
          chainId: network.networkVersion,
          owner: fromWallet.address,
          fromToken: fromWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
          sellAmount: spendedAmount,
          fromTokenDecimals: fromWallet.decimals ?? COIN_DECIMALS,
          toToken: toWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
          buyAmount: receivedAmount,
          toTokenDecimals: toWallet.decimals ?? COIN_DECIMALS,
          deadlinePeriod: userDeadline * SEC_PER_MINUTE,
          useFeeOnTransfer: true,
          isNative: !(fromWallet.isToken && toWallet.isToken),
          fromNative: !fromWallet.isToken,
          toNative: !toWallet.isToken,
          fee: uniV3ActivePoolFee,
        })
        
      } else {
        result = await actions.uniswap.swapCallback({
          slippage,
          routerAddress: LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router,
          baseCurrency,
          owner: fromWallet.address,
          fromToken: fromWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
          sellAmount: spendedAmount,
          fromTokenDecimals: fromWallet.decimals ?? COIN_DECIMALS,
          toToken: toWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
          buyAmount: receivedAmount,
          toTokenDecimals: toWallet.decimals ?? COIN_DECIMALS,
          deadlinePeriod: userDeadline * SEC_PER_MINUTE,
          useFeeOnTransfer: true,
        })
      }

      setPending(false)

      if (result instanceof Error) {
        if (result?.message?.match(/INSUFFICIENT_OUTPUT_AMOUNT/)) {
          setBlockReason(BlockReasons.InsufficientSlippage)
        } else {
          reportError(result)
        }
      } else if (result?.transactionHash) {
        const txInfoUrl = transactions.getTxRouter(
          fromWallet.standard ? fromWallet.tokenKey : fromWallet.currency,
          result.transactionHash
        )

        routing.redirectTo(txInfoUrl)
      }
    } catch (error) {
      reportError(error)
    }

    setPending(false)
  }

  const addLiquidity = async () => {
    if (sourceAction !== Actions.AddLiquidity || !isSourceMode) return

    feedback.liquiditySource.addLiquidity(
      `Source: ${LIQUIDITY_SOURCE_DATA[network.networkVersion]?.name}. Asset A: ${
        fromWallet.currency
      }. Asset B: ${toWallet.currency}`
    )
    setPending(true)

    try {
      const result = await actions.uniswap.addLiquidityCallback({
        routerAddress: LIQUIDITY_SOURCE_DATA[network.networkVersion]?.router,
        baseCurrency: baseChainWallet.currency,
        // don't use slippage for the first pair creation
        slippage: currentLiquidityPair ? slippage : 0,
        tokenA: fromWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
        tokenADecimals: fromWallet.decimals ?? COIN_DECIMALS,
        amountADesired: spendedAmount,
        tokenB: toWallet.contractAddress ?? ADDRESSES.EVM_COIN_ADDRESS,
        tokenBDecimals: toWallet.decimals ?? COIN_DECIMALS,
        amountBDesired: receivedAmount,
        owner: fromWallet.address,
        deadlinePeriod: userDeadline * SEC_PER_MINUTE,
      })

      if (result?.transactionHash) {
        const txInfoUrl = transactions.getTxRouter(
          fromWallet.standard ? fromWallet.tokenKey : fromWallet.currency,
          result.transactionHash
        )

        routing.redirectTo(txInfoUrl)
      }
    } catch (error) {
      reportError(error)
    } finally {
      setPending(false)
    }
  }

  const doNotMakeApiRequest = isApiRequestBlocking()

  const commonBlockReasons =
    isPending ||
    (blockReason !== BlockReasons.NotApproved &&
      !!error &&
      !error.message?.match('transfer amount exceeds allowance'))
  const formFilled = !!spendedAmount && !!receivedAmount

  const approvingDoesNotMakeSense =
    sourceAction === Actions.AddLiquidity &&
    !currentLiquidityPair &&
    (insufficientBalanceA || insufficientBalanceB)

  const approveAIsAvailable =
    !commonBlockReasons && !insufficientBalanceA && spendedAmount && needApproveA
  const approveBIsAvailable =
    !commonBlockReasons && !insufficientBalanceB && receivedAmount && needApproveB

  const approveBIsNecessary = isSourceMode && sourceAction === Actions.AddLiquidity

  const apiSwapIsAvailable = swapData && !doNotMakeApiRequest && !commonBlockReasons && formFilled

  const directSwapIsAvailable =
    !commonBlockReasons && (!needApproveA || isWrapUnwrap) && !insufficientBalanceA && formFilled

  const addLiquidityIsAvailable =
    !commonBlockReasons && !needApproveA && !needApproveB && !insufficientBalanceB && formFilled

  return (
    <div styleName="footer">
      {finalizeSwap && (
        <ReviewSwapModal
          isPending={isPending}
          data={swapData}
          onSwap={apiSwap}
          onClose={() => setFinalizeSwap(false)}
          history={history}
          swapFee={swapFee}
          fiat={fiat}
          serviceFee={serviceFee}
          slippage={slippage}
          network={network}
          spendedAmount={spendedAmount}
          baseChainWallet={baseChainWallet}
          fromWallet={fromWallet}
          toWallet={toWallet}
        />
      )}
      {needApproveA && !isWrapUnwrap ? (
        <Button
          pending={isPending}
          disabled={!approveAIsAvailable || approvingDoesNotMakeSense}
          onClick={() => approve(Direction.Spend)}
          fullWidth
          brand
        >
          <FormattedMessage
            id="FormattedMessageIdApprove"
            defaultMessage="Approve {token}"
            values={{ token: spendedCurrency.name }}
          />
        </Button>
      ) : needApproveB && approveBIsNecessary && !isWrapUnwrap ? (
        <Button
          pending={isPending}
          disabled={!approveBIsAvailable || approvingDoesNotMakeSense}
          onClick={() => approve(Direction.Receive)}
          fullWidth
          brand
        >
          <FormattedMessage
            id="FormattedMessageIdApprove"
            defaultMessage="Approve {token}"
            values={{ token: receivedCurrency.name }}
          />
        </Button>
      ) : !isSourceMode ? (
        <Button pending={isPending} disabled={!apiSwapIsAvailable} onClick={startSwapReview} brand>
          <FormattedMessage id="reviewSwap" defaultMessage="Review swap" />
        </Button>
      ) : sourceAction === Actions.Swap ? (
        <>
          {isWrapUnwrap ? (
            <Button
              pending={isPending}
              disabled={!directSwapIsAvailable}
              onClick={handleWrap}
              brand
            >
              {isWrappedTokenA
                ? (<FormattedMessage id="quickswap_unwrap_token" defaultMessage="Unwrap coin" />)
                : (<FormattedMessage id="quickswap_wrap_token" defaultMessage="Wrap coin" />)
              }
            </Button>
          ) : (
            <Button pending={isPending} disabled={!directSwapIsAvailable} onClick={directSwap} brand>
              <FormattedMessage id="swap" defaultMessage="Swap" />
            </Button>
          )}
        </>
      ) : sourceAction === Actions.AddLiquidity ? (
        <Button
          pending={isPending}
          disabled={!addLiquidityIsAvailable}
          onClick={addLiquidity}
          brand
        >
          <FormattedMessage id="addLiquidity" defaultMessage="Add liquidity" />
        </Button>
      ) : null}
    </div>
  )
}

export default CSSModules(Footer, styles, { allowMultiple: true })
