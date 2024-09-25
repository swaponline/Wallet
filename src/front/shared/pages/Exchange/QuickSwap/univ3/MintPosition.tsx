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
    baseCurrency,
    chainId,
    userDeadline,
    slippage,
    intl,
    owner,
  } = props

  console.log('>>>> MIN POSITION', props)
  
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
      console.log('>>>> pools by fee', answer)
    }).catch((err) => {
      setIsPoolsByFetching(false)
      console.log('>>> fetch pools by fee err', err)
    })
  }, [token0Address, token1Address])
  
  const [ activeFee, setActiveFee ] = useState(0)
  
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
      isLowerPrice: (token == TOKEN._0),
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
    return new BigNumber(amount)
      .multipliedBy(10 ** ((token_type == TOKEN._0) ? token0.decimals : token1.decimals))
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
      console.log('>>> do fetch balances')
      console.log({
        baseCurrency,
        chainId,
        owner,
        token0Address,
        token1Address
      })
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

  const renderDepositToken0 = () => {
    return (
      <AmountInput
        amount={amount0}
        disabled={false}
        onChange={(v) => { setAmount0(v) }}
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
        amount={amount0}
        disabled={false}
        onChange={(v) => { setAmount1(v) }}
        symbol={getTokenSymbol(TOKEN._1)}
        balance={formatAmount(fromWei(TOKEN._1, token0BalanceWei))}
        isBalanceUpdate={isFetchingBalanceAllowance}
        onBalanceUpdate={() => { setDoFetchBalanceAllowance(true) }}
      />
    )
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

  console.log('>>>>> IN RANGE, LOWER, HIGH', posInRange, startPriceIsLower, startPriceIsHigh)

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
          <div styleName="selectFee">
            {allowedFees.map((fee) => {
              return (
                <div key={fee}>
                  <label onClick={() => setActiveFee(fee)}>
                    {(fee / 10000)+`%`}
                    <input
                      type="radio"
                      name="uniPoolFee"
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
          <div>
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
              onBlur={() => { calcPriceByTick((viewSide == VIEW_SIDE.A_TO_B) ? TOKEN._0 : TOKEN._1, true)}}
              label={(
                <FormattedMessage id="uni_mint_lower_price" defaultMessage="Low price" />
              )}
            />
            <PriceInput
              price={(viewSide == VIEW_SIDE.A_TO_B) ? token0HighPrice : token1HighPrice}
              onChange={(v) => { setHightPrice(v, getTokenFromViewSide()) }}
              tokenA={getTokenSymbolFromViewSideA()}
              tokenB={getTokenSymbolFromViewSideB()}
              onBlur={() => { calcPriceByTick((viewSide == VIEW_SIDE.A_TO_B) ? TOKEN._0 : TOKEN._1, false)}}
              label={(
                <FormattedMessage id="uni_mint_high_price" defaultMessage="High price" />
              )}
            />
          </div>
          {!posInRange && (
            <div>
              <div>
                <FormattedMessage
                  id="uni_mint_out_of_price"
                  defaultMessage="Your position will not earn fees or be used in trades until the market price moves into your range."
                />
              </div>
            </div>
          )}
          {!poolsByFee[activeFee] && (
            <div>
              <div>
                <FormattedMessage
                  id="uni_mint_need_init_pool"
                  defaultMessage="This pool must be initialized before you can add liquidity. To initialize, select a starting price for the pool. Then, enter your liquidity price range and deposit amount. Gas fees will be higher than usual due to the initialization transaction."
                />
              </div>
              <PriceInput
                price={startPrice}
                onChange={(v) => { setStartPrice(v) }}
                tokenA={getTokenSymbolFromViewSideA()}
                tokenB={getTokenSymbolFromViewSideB()}
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
            </div>
          )}
          <div>
            <h4>Deposit amounts</h4>
            {(viewSide == VIEW_SIDE.A_TO_B) ? (
              <>
                {!startPriceIsLower && renderDepositToken0()}
                {!startPriceIsHigh && renderDepositToken1()}
              </>
            ) : (
              <>
                {!startPriceIsLower && renderDepositToken1()}
                {!startPriceIsHigh && renderDepositToken0()}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default injectIntl(CSSModules(MintPosition, styles, { allowMultiple: true }))