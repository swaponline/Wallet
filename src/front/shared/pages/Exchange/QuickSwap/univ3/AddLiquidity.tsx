import { useState, useEffect, useRef } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './AddLiquidity.scss'
import CSSModules from 'react-css-modules'
import BigNumber from 'bignumber.js'
import actions from 'redux/actions'
import modals from 'helpers/constants/modals'
import {
  PositionAction,
  VIEW_SIDE,
  TOKEN,
} from './types'
import { renderPricePerToken } from './helpers'
import { formatAmount } from './helpers'
import Button from 'components/controls/Button/Button'
import AmountInput from './ui/AmountInput'
import InfoBlock from './ui/InfoBlock'
import BackButton from './ui/BackButton'

function AddLiquidity(props) {
  const {
    positionId,
    setCurrentAction,
    poolInfo,
    positionInfo,
    positionInfo: {
      priceHigh,
      priceLow,
      currentPrice,
      addLiquidityPrice,
      token0,
      token0: {
        address: token0Address,
      },
      token1,
      token1: {
        address: token1Address,
      },
      tickCurrent,
      tickLower,
      tickUpper,
    },
    owner,
    baseCurrency,
    chainId,
    userDeadline,
    slippage,
    setDoPositionsUpdate,
  } = props

  const [ poolViewSide, setPoolViewSide ] = useState(VIEW_SIDE.A_TO_B)
  
  const isWrappedToken0 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token0.address })
  const isWrappedToken1 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token1.address })

  const [ amount0, setAmount0 ] = useState(0)
  const [ amount1, setAmount1 ] = useState(0)

  const inRange = (tickCurrent >= tickLower) && (tickCurrent <= tickUpper)

  const outRangeToken0Only = !inRange && (tickCurrent < tickLower)
  const outRangeToken1Only = !inRange && (tickCurrent > tickUpper)

  const calcAmount = (amount, token) => {
    if (token == TOKEN._0) {
      const _amount1 = actions.uniswap.addLiquidityV3CalcAmount({
        amountIn: amount,
        price: currentPrice.buyOneOfToken0,
        priceHigh: priceHigh.buyOneOfToken0,
        priceLow: priceLow.buyOneOfToken0,
      }).toNumber()
      setAmount0(amount)
      setAmount1(_amount1)
    }
    if (token == TOKEN._1) {
      const _amount0 = actions.uniswap.addLiquidityV3CalcAmount({
        amountIn: amount,
        price: currentPrice.buyOneOfToken1,
        priceHigh: priceLow.buyOneOfToken1,
        priceLow: priceHigh.buyOneOfToken1,
      }).toNumber()
      setAmount0(_amount0)
      setAmount1(amount)
    }
  }
  
  const token0IsWrapped = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token0.address })
  const token1IsWrapped = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token1.address })
  const hasWrappedToken = token0IsWrapped || token1IsWrapped

  const getTokenSymbol = (tokenType) => {
    return (tokenType == TOKEN._0)
      ? isWrappedToken0 ? baseCurrency : token0.symbol
      : isWrappedToken1 ? baseCurrency : token1.symbol
  }

  const [ isFetchingBalanceAllowance, setIsFetchingBalanceAllowance ] = useState(false)
  const [ doFetchBalanceAllowance, setDoFetchBalanceAllowance ] = useState(true)
  const [ token0BalanceWei, setToken0BalanceWei ] = useState<BigNumber>(new BigNumber(0))
  const [ token1BalanceWei, setToken1BalanceWei ] = useState<BigNumber>(new BigNumber(0))

  const [ token0AllowanceWei, setToken0AllowanceWei ] = useState<BigNumber>(new BigNumber(0))
  const [ token1AllowanceWei, setToken1AllowanceWei ] = useState<BigNumber>(new BigNumber(0))

  const fromWei = (token_type:TOKEN, wei:BigNumber): Number => {
    return new BigNumber(wei)
      .div(new BigNumber(10).pow((token_type == TOKEN._0) ? token0.decimals : token1.decimals))
      .toNumber()
  }

  const toWei = (token_type:TOKEN, amount:any): BigNumber => {
    return new BigNumber(
      new BigNumber(amount)
        .multipliedBy(10 ** ((token_type == TOKEN._0) ? token0.decimals : token1.decimals))
        .toFixed(0)
    )
  }

  const token0BalanceOk = token0BalanceWei.isGreaterThanOrEqualTo(toWei(TOKEN._0, amount0))
  const token1BalanceOk = token1BalanceWei.isGreaterThanOrEqualTo(toWei(TOKEN._1, amount1))
  const token0AllowanceOk = token0AllowanceWei.isGreaterThanOrEqualTo(toWei(TOKEN._0, amount0))
  const token1AllowanceOk = token1AllowanceWei.isGreaterThanOrEqualTo(toWei(TOKEN._1, amount1))
  const amountsNotZero = (new BigNumber(amount0).isGreaterThan(0) || new BigNumber(amount1).isGreaterThan(0))
  
  useEffect(() => {
    if (doFetchBalanceAllowance && token0Address && token1Address && !isFetchingBalanceAllowance) {
      setIsFetchingBalanceAllowance(true)
      setDoFetchBalanceAllowance(false)
      setToken0BalanceWei(new BigNumber(0))
      setToken1BalanceWei(new BigNumber(0))
      setToken0AllowanceWei(new BigNumber(0))
      setToken1AllowanceWei(new BigNumber(0))
      actions.uniswap.getBalanceAndAllowanceV3({
        baseCurrency,
        chainId,
        owner,
        token0Address,
        token1Address
      }).then((answer) => {
        setToken0BalanceWei(new BigNumber(answer.token0.balance))
        setToken0AllowanceWei(new BigNumber(answer.token0.allowance))
        setToken1BalanceWei(new BigNumber(answer.token1.balance))
        setToken1AllowanceWei(new BigNumber(answer.token1.allowance))
        setIsFetchingBalanceAllowance(false)
      }).catch((err) => {
        console.log('>> fail fetch balance and allowance', err)
        setIsFetchingBalanceAllowance(false)
      })
    }
  }, [ token0Address, token1Address, doFetchBalanceAllowance, isFetchingBalanceAllowance ])

  const [ isApproving, setIsApproving ] = useState(false)
  
  const handleApprove = (token_type:TOKEN) => {
    setIsApproving(true)
    actions.uniswap.approveTokenV3({
      baseCurrency,
      chainId,
      tokenAddress: (token_type == TOKEN._0) ? token0Address : token1Address,
      amountWei: toWei(token_type, (token_type == TOKEN._0) ? amount0 : amount1),
      waitReceipt: true,
    }).then((approveTx) => {
      setDoFetchBalanceAllowance(true)
      setIsApproving(false)
    }).catch((err) => {
      console.log('Fail approve', err)
      setIsApproving(false)
    })
  }

  const [ isAddLiquidity, setIsAddLiquidity ] = useState(false)
  
  const handleAddLiquidity = async () => {
    actions.modals.open(modals.Confirm, {
      title: (<FormattedMessage id="qs_uni_pos_liq_add_title" defaultMessage="Confirm action" />),
      message: (<FormattedMessage id="qs_uni_pos_liq_add_message" defaultMessage="Add liquidity?" />),
      onAccept: () => {
        let amount0Wei = toWei(TOKEN._0, amount0)
        let amount1Wei = toWei(TOKEN._1, amount1)
        if (!inRange && outRangeToken0Only) amount1Wei = new BigNumber(0)
        if (!inRange && outRangeToken1Only) amount0Wei = new BigNumber(0)

        setIsAddLiquidity(true)
        actions.uniswap.addLiquidityV3({
          chainId,
          baseCurrency,
          amount0Wei,
          amount1Wei,
          position: positionInfo,
          deadlinePeriod: userDeadline,
          slippage,
          waitReceipt: true
        }).then(() => {
          setDoPositionsUpdate(true)
          actions.modals.open(modals.AlertModal, {
            message: (<FormattedMessage id="qs_uni_pos_liq_added" defaultMessage="Liquidity successfully added" />),
            onClose: () => {
              setCurrentAction(PositionAction.INFO)
            }
          })
        }).catch((err) => {
        console.log(err)
          setIsAddLiquidity(false)
        })
      }
    })
  }

  const isWorking = isApproving || isAddLiquidity

  return (
    <div>
      <BackButton onClick={() => { setCurrentAction(PositionAction.LIST) }}>
        <FormattedMessage id="qs_uni_return_to_pos_list" defaultMessage="Return back to positions list" />
      </BackButton>
      <InfoBlock
        positionInfo={positionInfo}
        chainId={chainId}
        baseCurrency={baseCurrency}
      />
      <h3 styleName="header">
        <FormattedMessage
          id="qs_uni_pos_liq_add_header"
          defaultMessage="Add more liquidity"
        />
      </h3>
      <div>
        {(inRange || (!inRange && outRangeToken0Only)) && (
          <div>
            <AmountInput
              amount={amount0}
              disabled={isWorking}
              onChange={(v) => { calcAmount(v, TOKEN._0) }}
              symbol={getTokenSymbol(TOKEN._0)}
              balance={formatAmount(fromWei(TOKEN._0, token0BalanceWei))}
              isBalanceUpdate={isFetchingBalanceAllowance}
              onBalanceUpdate={() => { if (!isWorking)  setDoFetchBalanceAllowance(true) }}
            />
          </div>
        )}
        {(inRange || (!inRange && outRangeToken1Only)) && (
          <div>
            <AmountInput
              amount={amount1}
              disabled={isWorking}
              onChange={(v) => { calcAmount(v, TOKEN._1) }}
              symbol={getTokenSymbol(TOKEN._1)}
              balance={formatAmount(fromWei(TOKEN._1, token1BalanceWei))}
              isBalanceUpdate={isFetchingBalanceAllowance}
              onBalanceUpdate={() => { if (!isWorking) setDoFetchBalanceAllowance(true) }}
            />
          </div>
        )}
      </div>
      <div>
        {isFetchingBalanceAllowance ? (
          <Button brand disabled={true} fullWidth>
            <FormattedMessage id="qs_uni_liq_add_fetching" defaultMessage="Fetching..." />
          </Button>
        ) : (
          <>
            {!(token0BalanceOk && token1BalanceOk) ? (
              <Button brand disabled={true} fullWidth>
                <FormattedMessage
                  id="qs_uni_liq_add_nocoins"
                  defaultMessage="Insufficient {symbol} balance"
                  values={{
                    symbol: (!token0BalanceOk)
                      ? getTokenSymbol(TOKEN._0)
                      : getTokenSymbol(TOKEN._1)
                  }}
                />
              </Button>
            ) : (
              <>
                {(amountsNotZero && !(token0AllowanceOk && token1AllowanceOk)) ? (
                  <Button
                    brand
                    disabled={isApproving}
                    fullWidth
                    onClick={() => {
                      handleApprove((!token0AllowanceOk) ? TOKEN._0 : TOKEN._1)
                    }}
                  >
                    {isApproving ? (
                      <FormattedMessage
                        id="qs_uni_liq_add_is_approving"
                        defaultMessage="Approving {symbol}"
                        values={{
                          symbol: (!token0AllowanceOk)
                            ? getTokenSymbol(TOKEN._0)
                            : getTokenSymbol(TOKEN._1)
                        }}
                      />
                    ) : (
                      <FormattedMessage
                        id="qs_uni_liq_add_do_approve"
                        defaultMessage="Approve {symbol}"
                        values={{
                          symbol: (!token0AllowanceOk)
                            ? getTokenSymbol(TOKEN._0)
                            : getTokenSymbol(TOKEN._1)
                        }}
                      />
                    )}
                  </Button>
                ) : (
                  <Button
                    brand
                    onClick={() => { handleAddLiquidity() }}
                    disabled={!amountsNotZero || isAddLiquidity}
                    fullWidth
                  >
                    {isAddLiquidity ? (
                      <FormattedMessage
                        id="qs_uni_pos_liq_add_processing"
                        defaultMessage="Adding liquidity"
                      />
                    ) : (
                      <FormattedMessage
                        id="qs_uni_pos_liq_add_confirm"
                        defaultMessage="Add liquidity"
                      />
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}
        <div styleName="cancelHolder">
          <Button
            gray
            fullWidth
            onClick={() => { setCurrentAction(PositionAction.INFO) }}
            disabled={isWorking}
          >
            <FormattedMessage id="qs_uni_cancel" defaultMessage="Cancel" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default CSSModules(AddLiquidity, styles, { allowMultiple: true })