import { useState, useEffect, useRef } from 'react'
import { FormattedMessage, injectIntl, defineMessages } from 'react-intl'
import styles from './MintPosition.scss'
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
import BackButton from './ui/BackButton'
import AmountInput from './ui/AmountInput'
import PriceInput from './ui/PriceInput'

const defaultLanguage = defineMessages({
  fee_desc_100: {
    id: 'univ3_fee_desc_100',
    defaultMessage: 'Best for very stable pairs.',
  },
  fee_desc_500: {
    id: 'univ3_fee_desc_500',
    defaultMessage: 'Best for stable pairs.',
  },
  fee_desc_3000: {
    id: 'univ3_fee_desc_3000',
    defaultMessage: 'Best for most pairs.',
  },
  fee_desc_10000: {
    id: 'univ3_fee_desc_10000',
    defaultMessage: 'Best for exotic pairs.',
  }
})
function MintPosition(props) {
  const {
    token0Address,
    token1Address,
    token0Wallet,
    token1Wallet,
    activePair,
    setCurrentAction,
    setDoPositionsUpdate,
    baseCurrency,
    chainId,
    userDeadline,
    slippage,
    intl,
    owner,

  } = props

  
  const allowedFees = [
    100,  // 0.01%
    500,  // 0.05%
    3000, // 0.3%
    10000,// 1%
  ]

  const [ token0, setToken0 ] = useState<any|boolean>(false)
  const [ token1, setToken1 ] = useState<any|boolean>(false)
  const [ isFetchTokensInfo, setIsFetchTokensInfo ] = useState(false)
  
  useEffect(() => {
    setIsFetchTokensInfo(true)
    actions.uniswap.getTokensInfoV3({
      baseCurrency,
      chainId,
      token0Address,
      token1Address,
    }).then(({ token0, token1 }) => {
      setToken0(token0)
      setToken1(token1)
      setIsFetchTokensInfo(false)
    }).catch((err) => {
      console.log('>>> fail fetch tokens info', err)
    })
  }, [ token0Address, token1Address ])


  const [ poolsByFee, setPoolsByFee ] = useState({})
  const [ isPoolsByFeeFetching, setIsPoolsByFetching ] = useState(true)

  const [ viewSide, setViewSide ] = useState(VIEW_SIDE.A_TO_B)
  
  useEffect(() => {
    setIsPoolsByFetching(true)
    setPoolsByFee({})
    actions.uniswap.getPoolAddressV3All({
      baseCurrency,
      chainId,
      tokenA: token0Address,
      tokenB: token1Address,
      byFee: true,
    }).then((answer) => {
      setIsPoolsByFetching(false)
      setPoolsByFee(answer)
      let _activeFee = 0
      allowedFees.forEach((fee) => {
        if (answer[fee]) _activeFee = fee
      })
      setActiveFee(_activeFee)
    }).catch((err) => {
      setIsPoolsByFetching(false)
      console.log('>>> fetch pools by fee err', err)
    })
  }, [token0Address, token1Address])
  
  const [ activeFee, setActiveFee ] = useState(0)

  const [ poolInfo, setPoolInfo ] = useState<any>(false)
  const [ isPoolFetching, setIsPoolFetching ] = useState(false)

  useEffect(() => {
    if (poolsByFee[activeFee]) {
      // Fetching pool info
      setIsPoolFetching(true)
      actions.uniswap.getUserPoolLiquidityV3({
        owner,
        baseCurrency,
        chainId,
        poolAddress: poolsByFee[activeFee],
      }).then(({ pool }) => {
        setPoolInfo(pool)
        setIsPoolFetching(false)
      }).catch((err) => {
        console.log('>ERR getUserPoolLiquidityV3', err)
      })
    } else {
      setIsPoolFetching(false)
    }
  }, [ activeFee, poolsByFee ])

  useEffect(() => {
    if (poolInfo) {
      const {
        currentPrice,
        currentPrice: {
          buyOneOfToken0,
          buyOneOfToken1,
        },
      } = poolInfo

      setStartPrice(
        Number(
          (viewSide == VIEW_SIDE.A_TO_B)
            ? buyOneOfToken1
            : buyOneOfToken0
        )
      )
    } else {
      setStartPrice(0)
    }
  }, [ poolInfo, viewSide ])
  
  const isWrappedToken0 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token0Address })
  const isWrappedToken1 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token1Address })

  const getTokenSymbol = (tokenType) => {
    return (tokenType == TOKEN._0)
      ? isWrappedToken0 ? baseCurrency : token0.symbol
      : isWrappedToken1 ? baseCurrency : token1.symbol
  }

  const [ startPrice, setStartPrice ] = useState(0)

  const [ token0LowerPrice, setToken0LowerPrice ] = useState(0)
  const [ token0HighPrice, setToken0HighPrice ] = useState(0)
  
  const [ token1LowerPrice, setToken1LowerPrice ] = useState(0)
  const [ token1HighPrice, setToken1HighPrice ] = useState(0)
  
  const setLowerPrice = (v:number, token:TOKEN) => {
    return (token == TOKEN._0) ? setToken0LowerPrice(v) : setToken1LowerPrice(v)
  }
  const setHightPrice = (v:number, token:TOKEN) => {
    return (token == TOKEN._0) ? setToken0HighPrice(v) : setToken1HighPrice(v)
  }
  const getTokenFromViewSide = () => {
    return (viewSide == VIEW_SIDE.A_TO_B) ? TOKEN._0 : TOKEN._1
  }
  const getTokenSymbolFromViewSideA = () => {
    return (viewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._0) : getTokenSymbol(TOKEN._1)
  }
  const getTokenSymbolFromViewSideB = () => {
    return (viewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._1) : getTokenSymbol(TOKEN._0)
  }

  const calcPriceByTick = (token: TOKEN, isLowerPrice: boolean) => {
    const price = (
      (token == TOKEN._0)
        ? (isLowerPrice) ? token0LowerPrice : token0HighPrice
        : (isLowerPrice) ? token1LowerPrice : token1HighPrice
    )
    const priceInfo = actions.uniswap.getPriceRoundedToTick({
      fee: activeFee,
      price,
      Decimal0: (token == TOKEN._0) ? token0.decimals : token1.decimals,
      Decimal1: (token == TOKEN._0) ? token1.decimals : token0.decimals,
      isLowerPrice: (token == TOKEN._0) ? false : true,
    })

    const {
      price: {
        buyOneOfToken0,
        buyOneOfToken1,
      },
      tick,
    } = priceInfo
    
    if (token == TOKEN._0) {
      if (isLowerPrice) {
        setToken0LowerPrice(Number(buyOneOfToken1))
        setToken1HighPrice(Number(buyOneOfToken0))
      } else {
        setToken0HighPrice(Number(buyOneOfToken1))
        setToken1LowerPrice(Number(buyOneOfToken0))
      }
    } else {
      if (isLowerPrice) {
        setToken1LowerPrice(Number(buyOneOfToken1))
        setToken0HighPrice(Number(buyOneOfToken0))
      } else {
        setToken1HighPrice(Number(buyOneOfToken1))
        setToken0LowerPrice(Number(buyOneOfToken0))
      }
    }
  }

  useEffect(() => {
    setToken0LowerPrice(0)
    setToken0HighPrice(0)
    setToken1LowerPrice(0)
    setToken1HighPrice(0)
  }, [ activeFee ])

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


  const [ amount0, setAmount0 ] = useState(0)
  const [ amount1, setAmount1 ] = useState(0)

  const [ token0BalanceWei, setToken0BalanceWei ] = useState<BigNumber>(new BigNumber(0))
  const [ token1BalanceWei, setToken1BalanceWei ] = useState<BigNumber>(new BigNumber(0))

  const [ token0AllowanceWei, setToken0AllowanceWei ] = useState<BigNumber>(new BigNumber(0))
  const [ token1AllowanceWei, setToken1AllowanceWei ] = useState<BigNumber>(new BigNumber(0))

  const [ isFetchingBalanceAllowance, setIsFetchingBalanceAllowance ] = useState(false)
  const [ doFetchBalanceAllowance, setDoFetchBalanceAllowance ] = useState(true)
  
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

  

  const isBaseFetching = (isFetchTokensInfo || isPoolsByFeeFetching)


  /* @to-do - need optimize code size */
  const calcAmount = (amount, token) => {
    if (viewSide == VIEW_SIDE.A_TO_B) {
      if (token == TOKEN._0) {
        const perTokenPrice = actions.uniswap.addLiquidityV3CalcAmount({
          amountIn: 1,
          price: startPrice,
          priceHigh: token0HighPrice,
          priceLow: token0LowerPrice,
        }).toNumber()
        const _amount1 = new BigNumber(amount).dividedBy(perTokenPrice).toFixed(token1.decimals)
        setAmount0(amount)
        setAmount1(Number(_amount1))
      }
      if (token == TOKEN._1) {
        const _amount0 = actions.uniswap.addLiquidityV3CalcAmount({
          amountIn: amount,
          price: startPrice,
          priceHigh: token0HighPrice,
          priceLow: token0LowerPrice,
        }).toFixed(token0.decimals)
        setAmount0(Number(_amount0))
        setAmount1(amount)
      }
    } else {
      if (token == TOKEN._1) {
        const perTokenPrice = actions.uniswap.addLiquidityV3CalcAmount({
          amountIn: 1,
          price: startPrice,
          priceHigh: token1HighPrice,
          priceLow: token1LowerPrice,
        }).toNumber()
        const _amount0 = new BigNumber(amount).dividedBy(perTokenPrice).toFixed(token0.decimals)
        setAmount0(Number(_amount0))
        setAmount1(amount)
      }
      if (token == TOKEN._0) {
        const _amount1 = actions.uniswap.addLiquidityV3CalcAmount({
          amountIn: amount,
          price: startPrice,
          priceHigh: token1HighPrice,
          priceLow: token1LowerPrice,
        }).toFixed(token1.decimals)
        setAmount1(Number(_amount1))
        setAmount0(amount)
      }
    }
  }
  
  const posInRange = (
    viewSide == VIEW_SIDE.A_TO_B
  ) ? (
    new BigNumber(token0LowerPrice).isLessThanOrEqualTo(startPrice) 
    && new BigNumber(token0HighPrice).isGreaterThanOrEqualTo(startPrice)
  ) : (
    new BigNumber(token1LowerPrice).isLessThanOrEqualTo(startPrice)
    && new BigNumber(token1HighPrice).isGreaterThanOrEqualTo(startPrice)
  )

  
  
  const startPriceIsLower = (viewSide == VIEW_SIDE.A_TO_B) ? new BigNumber(startPrice).isLessThan(token0LowerPrice) : new BigNumber(startPrice).isLessThan(token1LowerPrice)
  const startPriceIsHigh = (viewSide == VIEW_SIDE.A_TO_B) ? new BigNumber(startPrice).isGreaterThan(token0HighPrice) : new BigNumber(startPrice).isGreaterThan(token1HighPrice)

  const [ isCreatingPosition, setIsCreatingPosition ] = useState(false)

  const calcMintParams = (calcFee = false) => {
    const amount0Wei = toWei(TOKEN._0, amount0).toString()
    const amount1Wei = toWei(TOKEN._1, amount1).toString()

    const sqrtPriceX96 = actions.uniswap.calculateSqrtPriceX96({
      Decimal0: (viewSide == VIEW_SIDE.A_TO_B) ? token1.decimals : token0.decimals,
      Decimal1: (viewSide == VIEW_SIDE.A_TO_B) ? token0.decimals : token1.decimals,
      price: startPrice,
    })
    const tickCurrent = actions.uniswap.getTickAtSqrtRatio(sqrtPriceX96)

    const { tick: _tickLower } = actions.uniswap.getPriceRoundedToTick({
      fee: activeFee,
      price: token0LowerPrice,
      Decimal0: token0.decimals,
      Decimal1: token1.decimals,
      isLowerPrice: true,
    })
    const { tick: _tickUpper } = actions.uniswap.getPriceRoundedToTick({
      fee: activeFee,
      price: token0HighPrice,
      Decimal0: token0.decimals,
      Decimal1: token1.decimals,
      isLowerPrice: true,
    })
    const [ tickLower, tickUpper ] = (_tickLower > _tickUpper) ? [ _tickUpper, _tickLower ] : [ _tickLower, _tickUpper ]

    return {
      baseCurrency,
      chainId,
      owner,
      token0Address,
      token1Address,
      amount0Wei,
      amount1Wei,
      fee: activeFee,
      poolExists: (poolsByFee[activeFee]) ? true : false,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      slippagePercent: slippage,
      deadlinePeriod: userDeadline,
      waitReceipt: true,
      calcFee,
    }
  }

  const handleCreatePosition = () => {
    const mintParams = calcMintParams(true)
    setIsCreatingPosition(true)
    actions.uniswap.mintPositionV3(mintParams).then((estimateGas) => {
      actions.modals.open(modals.Confirm, {
        title: (
          <FormattedMessage
            id="uni_mint_preview_title"
            defaultMessage="Creating new pool position"
          />
        ),
        message: (
          <FormattedMessage
            id="uni_mint_preview_message"
            defaultMessage="Create new pool position? Estimate gas {gas} {baseCurrency}"
            values={{
              baseCurrency,
              gas: new BigNumber(estimateGas).dividedBy(10**18).toNumber()
            }}
          />
        ),
        yes: (
          <FormattedMessage
            id="uni_mint_preview_confirm"
            defaultMessage="Confirm"
          />
        ),
        onAccept: () => {
          const mintParams = calcMintParams(false)
          actions.uniswap.mintPositionV3(mintParams).then((answer) => {
            setDoPositionsUpdate(true)
            actions.modals.open(modals.AlertModal, {
              message: (
                <FormattedMessage
                  id="qs_uni_pos_minted"
                  defaultMessage="New pool position successfull created"
                />
              ),
              onClose: () => {
                setCurrentAction(PositionAction.LIST)
              }
            })
          }).catch((err) => {
            setIsCreatingPosition(false)
          })
        },
        onCancel: () => {
          setIsCreatingPosition(false)
        },
      })
    }).catch((err) => {
      setIsCreatingPosition(false)
    })
  }

  const renderDepositToken0 = () => {
    return (
      <AmountInput
        amount={amount0}
        disabled={isCreatingPosition}
        onChange={(v) => { calcAmount(v, TOKEN._0) }}
        symbol={getTokenSymbol(TOKEN._0)}
        balance={formatAmount(fromWei(TOKEN._0, token0BalanceWei))}
        isBalanceUpdate={isFetchingBalanceAllowance}
        onBalanceUpdate={() => { setDoFetchBalanceAllowance(true) }}
      />
    )
  }

  const renderDepositToken1 = () => {
    return (
      <AmountInput
        amount={amount1}
        disabled={isCreatingPosition}
        onChange={(v) => { calcAmount(v, TOKEN._1) }}
        symbol={getTokenSymbol(TOKEN._1)}
        balance={formatAmount(fromWei(TOKEN._1, token1BalanceWei))}
        isBalanceUpdate={isFetchingBalanceAllowance}
        onBalanceUpdate={() => { setDoFetchBalanceAllowance(true) }}
      />
    )
  }

  const renderPreview = () => {
    return (
      <div>
        <div>
          <h4>
            <FormattedMessage
              id="uni_mint_privew_price_range"
              defaultMessage="Your teir fee {fee}"
              values={{
                fee: `${activeFee/1000}%`
              }}
            />
          </h4>
        </div>
        <AmountInput
          amount={amount0}
          disabled={true}
          onChange={(v) => {}}
          symbol={getTokenSymbol(TOKEN._1)}
          balance={formatAmount(fromWei(TOKEN._1, token1BalanceWei))}
          isBalanceUpdate={isFetchingBalanceAllowance}
          onBalanceUpdate={() => { setDoFetchBalanceAllowance(true) }}
        />
        <AmountInput
          amount={amount1}
          disabled={true}
          onChange={(v) => {}}
          symbol={getTokenSymbol(TOKEN._1)}
          balance={formatAmount(fromWei(TOKEN._1, token1BalanceWei))}
          isBalanceUpdate={isFetchingBalanceAllowance}
          onBalanceUpdate={() => { setDoFetchBalanceAllowance(true) }}
        />
      </div>
    )
  }

  return (
    <div>
      <BackButton onClick={() => { setCurrentAction(PositionAction.LIST) }}>
        <FormattedMessage
          id="qs_uni_return_to_pos_list"
          defaultMessage="Return back to positions list"
        />
      </BackButton>
      <h3>
        <FormattedMessage
          id="uni_mint_new_pos_title"
          defaultMessage="Creating new liquidity position"
        />
      </h3>
      {isBaseFetching ? (
        <>
          Fetching info
        </>
      ) : (
        <>
          <h4>
            <FormattedMessage
              id="uni_mint_select_your_fee"
              defaultMessage="Select you fee"
            />
          </h4>
          <div styleName="selectFee">
            {allowedFees.map((fee) => {
              return (
                <div
                  key={fee}
                  onClick={() => { if (!isCreatingPosition) { setActiveFee(fee) }}}
                  styleName={[
                    (fee == activeFee) ? 'active' : '',
                    (poolsByFee[fee]) ? `` : `notCreated`
                  ].join(` `)}
                >
                  <label onClick={() => setActiveFee(fee)}>
                    <span>{(fee / 10000)+`%`}</span>
                    <input
                      type="radio"
                      name="uniPoolFee"
                      disabled={isCreatingPosition}
                      checked={activeFee == fee}
                      onChange={() => setActiveFee(fee)}
                    />
                  </label>
                  <span>{intl.formatMessage(defaultLanguage[`fee_desc_${fee}`])}</span>
                  <em>
                    {poolsByFee[fee] ? (
                      <FormattedMessage
                        id="uni_mint_pool_created"
                        defaultMessage="Created"
                      />
                    ) : (
                      <FormattedMessage
                        id="uni_mint_pool_notcreated"
                        defaultMessage="Not created"
                      />
                    )}
                  </em>
                </div>
              )
            })}
          </div>
          <div styleName="viewSideHolder">
            <strong>
              <FormattedMessage
                id="uni_mint_set_price_range"
                defaultMessage="Set price range"
              />
            </strong>
            <div styleName="selectViewSide">
              <a 
                styleName={(viewSide == VIEW_SIDE.A_TO_B) ? 'active' : ''}
                onClick={() => { setViewSide(VIEW_SIDE.A_TO_B) }}
              >
                {getTokenSymbol(TOKEN._0)}
              </a>
              <a
                styleName={(viewSide == VIEW_SIDE.B_TO_A) ? 'active' : ''}
                onClick={() => { setViewSide(VIEW_SIDE.B_TO_A) }}
              >
                {getTokenSymbol(TOKEN._1)}
              </a>
            </div>
          </div>
          <div>
            <PriceInput
              price={(viewSide == VIEW_SIDE.A_TO_B) ? token0LowerPrice : token1LowerPrice}
              onChange={(v) => { setLowerPrice(v, getTokenFromViewSide()) }}
              tokenA={getTokenSymbolFromViewSideA()}
              tokenB={getTokenSymbolFromViewSideB()}
              disabled={isCreatingPosition}
              onBlur={() => { calcPriceByTick((viewSide == VIEW_SIDE.A_TO_B) ? TOKEN._0 : TOKEN._1, true)}}
              label={(
                <FormattedMessage
                  id="uni_mint_lower_price"
                  defaultMessage="Low {symbol} price"
                  values={{
                    symbol: getTokenSymbolFromViewSideB()
                  }}
                />
              )}
            />
            <PriceInput
              price={(viewSide == VIEW_SIDE.A_TO_B) ? token0HighPrice : token1HighPrice}
              onChange={(v) => { setHightPrice(v, getTokenFromViewSide()) }}
              tokenA={getTokenSymbolFromViewSideA()}
              tokenB={getTokenSymbolFromViewSideB()}
              disabled={isCreatingPosition}
              onBlur={() => { calcPriceByTick((viewSide == VIEW_SIDE.A_TO_B) ? TOKEN._0 : TOKEN._1, false)}}
              label={(
                <FormattedMessage
                  id="uni_mint_high_price"
                  defaultMessage="High {symbol} price"
                  values={{
                    symbol: getTokenSymbolFromViewSideB()
                  }}
                />
              )}
            />
          </div>
          {!posInRange && (
            <div styleName="notInRange">
              <i className="fa fa-exclamation-triangle"></i>
              <span>
                <FormattedMessage
                  id="uni_mint_out_of_price"
                  defaultMessage="Your position will not earn fees or be used in trades until the market price moves into your range."
                />
              </span>
            </div>
          )}
          {!poolsByFee[activeFee] && (
            <div styleName="needInitPool">
              <i className="fa fa-info-circle"></i>
              <span>
                <FormattedMessage
                  id="uni_mint_need_init_pool"
                  defaultMessage="This pool must be initialized before you can add liquidity. To initialize, select a starting price for the pool. Then, enter your liquidity price range and deposit amount. Gas fees will be higher than usual due to the initialization transaction."
                />
              </span>
            </div>
          )}
          <PriceInput
            price={startPrice}
            onChange={(v) => { setStartPrice(v) }}
            tokenA={getTokenSymbolFromViewSideA()}
            tokenB={getTokenSymbolFromViewSideB()}
            disabled={isCreatingPosition || poolsByFee[activeFee]}
            label={(
              <FormattedMessage
                id="uni_mint_start_price"
                defaultMessage="Starting {symbol} price"
                values={{
                  symbol: getTokenSymbolFromViewSideB(),
                }}
              />
            )}
          />
          <div>
            <h4>
              <FormattedMessage
                id="uni_mint_deposit_amounts"
                defaultMessage="Deposit amounts"
              />
            </h4>
            {(viewSide == VIEW_SIDE.A_TO_B) ? (
              <>
                {!startPriceIsHigh && renderDepositToken1()}
                {!startPriceIsLower && renderDepositToken0()}
              </>
            ) : (
              <>
                {!startPriceIsHigh && renderDepositToken0()}
                {!startPriceIsLower && renderDepositToken1()}
              </>
            )}
          </div>
          <Button
            brand
            disabled={false}
            fullWidth
            onClick={() => { handleCreatePosition() }}
          >
            <FormattedMessage
              id="uni_mint_preview"
              defaultMessage="Create new position"
            />
          </Button>
        </>
      )}
    </div>
  )
}

export default injectIntl(CSSModules(MintPosition, styles, { allowMultiple: true }))