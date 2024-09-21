import { useState, useEffect, useRef } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './UniV3Pools.scss'
import CSSModules from 'react-css-modules'
import actions from 'redux/actions'
import CurrencySelect from 'components/ui/CurrencySelect/CurrencySelect'
import getCoinInfo from 'common/coins/getCoinInfo'
import Switching from 'components/controls/Switching/Switching'
import { Direction } from './types'
import constants from 'common/helpers/constants'
import uniswap from 'redux/actions/uniswap'
import Button from 'components/controls/Button/Button'
import BigNumber from 'bignumber.js'
import {
  PositionAction,
  VIEW_SIDE,
} from './univ3/types'
import {
  formatAmount,
  renderPricePerToken,
} from './univ3/helpers'

import PositionInfo from './univ3/PositionInfo'
import RemoveLiquidity from './univ3/RemoveLiquidity'
import AddLiquidity from './univ3/AddLiquidity'


function UniV3Pools(props) {
  const {
    currentLiquidityPair,
    parentState,
    flipCurrency,
    selectCurrency,
    userDeadline,
    slippage,
  } = props

  const {
    currencies,
    network,
    baseChainWallet,
    baseChainWallet: {
      address: userWalletAddress,
    },
    spendedCurrency,
    spendedCurrency: {
      name: spendedName,
    },
    receivedCurrency,
    receivedCurrency: {
      name: receivedName,
    },
    fromWallet,
    toWallet,
  } = parentState
  
  const tokenA = uniswap.wrapCurrency(
    network.networkVersion,
    fromWallet?.contractAddress || constants.ADDRESSES.EVM_COIN_ADDRESS
  )
  const tokenB = uniswap.wrapCurrency(
    network.networkVersion,
    toWallet?.contractAddress || constants.ADDRESSES.EVM_COIN_ADDRESS
  )
  console.log('>>> TOKEN A-B', tokenA, tokenB)
  console.log('>>> userWalletAddress', userWalletAddress)
  const [ isPoolFetching, setIsPoolFetching ] = useState((currentLiquidityPair==null) ? false : true)
  const [ poolInfo, setPoolInfo ] = useState<any>(null)
  const [ userPositions, setUserPositions ] = useState<any[]>([])

  const [ currentAction, setCurrentAction ] = useState(PositionAction.LIST)
  const [ activePositionId, setActivePositionId ] = useState(0)
  
  const [ doPositionsUpdate, setDoPositionsUpdate ] = useState(true)
  
  const _doFetchPoolInfo = () => {
    if (currentLiquidityPair) {
      // Fetching pool info
      setIsPoolFetching(true)
      console.log('>>> FETCHING')
      actions.uniswap.getUserPoolLiquidityV3({
        owner: userWalletAddress,
        baseCurrency: network.currency,
        chainId: network.networkVersion,
        poolAddress: currentLiquidityPair,
      }).then(({ pool, positions }) => {
        console.log('>>> getUserPoolLiquidityV3', pool, positions)
        setPoolInfo(pool)
        setUserPositions(positions.filter((pos) => {
          const {
            token0: {
              amountWei: token0Amount,
            },
            token1: {
              amountWei: token1Amount,
            }
          } = pos
          // filter closed positions
          return !(token0Amount == 0 && token1Amount == 0)
        }))
        setIsPoolFetching(false)
      }).catch((err) => {
        console.log('>ERR getUserPoolLiquidityV3', err)
      })
    } else {
      setIsPoolFetching(false)
    }
  }
  useEffect(() => {
    _doFetchPoolInfo()
  }, [ currentLiquidityPair ])

  useEffect(() => {
    if (doPositionsUpdate) {
      setDoPositionsUpdate(false)
      _doFetchPoolInfo()
    }
  }, [ doPositionsUpdate ])
  console.log('>>> UniV3Pools', props)

  const getPositionById = (positionId) => {
    const ret = userPositions.filter(({ tokenId }) => {
      return (tokenId == positionId)
    })
    return (ret.length > 0) ? ret[0] : false
  }
  const showPositionInfo = (positionId) => {
    setActivePositionId(positionId)
    setCurrentAction(PositionAction.INFO)
  }

  let poolViewSide = VIEW_SIDE.NONE
  if (poolInfo && poolInfo.token0 && poolInfo.token1) {
    if (tokenA.toLowerCase() == poolInfo.token0.address.toLowerCase() && tokenB.toLowerCase() == poolInfo.token1.address.toLowerCase()) {
      poolViewSide = VIEW_SIDE.A_TO_B
    } else {
      poolViewSide = VIEW_SIDE.B_TO_A
    }
  }

  useEffect(() => {
    if (currentAction == PositionAction.INFO) {
      const viewHolder = document.getElementById('uniV3Holder')
      if (viewHolder) viewHolder.scrollIntoView({behavior: "smooth"})
    }
  }, [ currentAction ])

  return (
    <div id="uniV3Holder">
      {currentAction == PositionAction.INFO && (
        <PositionInfo
          positionId={activePositionId}
          setCurrentAction={setCurrentAction}
          poolInfo={poolInfo}
          positionInfo={getPositionById(activePositionId)}
          tokenA={tokenA}
          tokenB={tokenB}
          baseCurrency={network.currency}
          chainId={network.networkVersion}
        />
      )}
      {currentAction == PositionAction.DEL_LIQUIDITY && (
        <RemoveLiquidity
          positionId={activePositionId}
          setCurrentAction={setCurrentAction}
          poolInfo={poolInfo}
          positionInfo={getPositionById(activePositionId)}
          tokenA={tokenA}
          tokenB={tokenB}
          owner={userWalletAddress}
          baseCurrency={network.currency}
          chainId={network.networkVersion}
          userDeadline={userDeadline}
          slippage={slippage}
          setDoPositionsUpdate={setDoPositionsUpdate}
          isPoolFetching={isPoolFetching}
        />
      )}
      {currentAction == PositionAction.ADD_LIQUIDITY && (
        <AddLiquidity
          positionId={activePositionId}
          setCurrentAction={setCurrentAction}
          poolInfo={poolInfo}
          positionInfo={getPositionById(activePositionId)}
          tokenA={tokenA}
          tokenB={tokenB}
          owner={userWalletAddress}
          baseCurrency={network.currency}
          chainId={network.networkVersion}
          userDeadline={userDeadline}
          slippage={slippage}
          setDoPositionsUpdate={setDoPositionsUpdate}
          isPoolFetching={isPoolFetching}
        />
      )}
      {currentAction == PositionAction.LIST && (
        <>
          <div styleName="currencyHolder">
            <CurrencySelect
              selectedItemRender={(item) => {
                const { blockchain } = getCoinInfo(item.value)

                return blockchain ? `${item.title.replaceAll('*','')} (${blockchain})` : item.fullTitle
              }}
              styleName="currencySelect"
              placeholder="Enter the name of coin"
              selectedValue={spendedCurrency.value}
              onSelect={(value) => selectCurrency({
                direction: Direction.Spend,
                value,
              })}
              currencies={currencies}
            />
            <div styleName="arrows">
              <Switching noneBorder onClick={flipCurrency} />
            </div>
            <CurrencySelect
              selectedItemRender={(item) => {
                const { blockchain } = getCoinInfo(item.value)

                return blockchain ? `${item.title.replaceAll('*','')} (${blockchain})` : item.fullTitle
              }}
              styleName="currencySelect"
              placeholder="Enter the name of coin"
              selectedValue={receivedCurrency.value}
              onSelect={(value) => {
                selectCurrency({
                  direction: Direction.Receive,
                  value,
                })
              }}
              currencies={currencies}
            />
          </div>
          {isPoolFetching ? (
            <>
              <div>Fetching pair info</div>
            </>
          ) : (
            <>
              {currentLiquidityPair == null ? (
                <div styleName="noActivePool">
                  <FormattedMessage
                    id="qs_uni_user_donthave_pool"
                    defaultMessage="This pair dont have liquidity - create it"
                  />
                </div>
              ) : (
                <>
                  <div styleName="currentPriceHolder">
                    <strong>
                      <FormattedMessage id="qs_uni_pools_currentPrice" defaultMessage="Current price: " />
                      {` `}
                    </strong>
                    <span>
                      {poolViewSide == VIEW_SIDE.A_TO_B && (
                        <>
                          {renderPricePerToken({
                            price: poolInfo.currentPrice.buyOneOfToken1,
                            tokenA: poolInfo.token0.symbol,
                            tokenB: poolInfo.token1.symbol,
                          })}
                        </>
                      )}
                      {poolViewSide == VIEW_SIDE.B_TO_A && (
                        <>
                          {renderPricePerToken({
                            price: poolInfo.currentPrice.buyOneOfToken0,
                            tokenA: poolInfo.token1.symbol,
                            tokenB: poolInfo.token0.symbol,
                          })}
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    {(userPositions.length == 0) ? (
                      <div styleName="noActivePositions">
                        <FormattedMessage
                          id="qs_uni_user_donthave_positions"
                          defaultMessage="You are dont have active pool liquidity positions."
                        />
                      </div>
                    ) : (
                      <>
                        {userPositions.map((posInfo) => {
                          const {
                            fee,
                            tokenId,
                            priceHigh,
                            priceLow,
                            token0,
                            token1,
                          } = posInfo

                          const posInRange = (
                            poolViewSide == VIEW_SIDE.A_TO_B
                          ) ? (
                            new BigNumber(posInfo.priceHigh.buyOneOfToken1).isLessThanOrEqualTo(poolInfo.currentPrice.buyOneOfToken1) 
                            && new BigNumber(posInfo.priceLow.buyOneOfToken1).isGreaterThanOrEqualTo(poolInfo.currentPrice.buyOneOfToken1)
                          ) : (
                            new BigNumber(posInfo.priceLow.buyOneOfToken0).isLessThanOrEqualTo(poolInfo.currentPrice.buyOneOfToken0)
                            && new BigNumber(posInfo.priceHigh.buyOneOfToken0).isGreaterThanOrEqualTo(poolInfo.currentPrice.buyOneOfToken0)
                          )

                          return (
                            <section styleName="poolPosition" key={tokenId}>
                              <div styleName="poolPositionHeader">
                                <div>
                                  <strong>#{tokenId}</strong>
                                  <div>
                                    <FormattedMessage
                                      id="qs_uni_position_fee"
                                      defaultMessage="Fee: {fee}%"
                                      values={{ fee: fee/10000 }}
                                    />
                                  </div>
                                </div>
                                {posInRange ? (
                                  <em>
                                    <i className="fas fa-circle"></i>
                                    <FormattedMessage
                                      id="qs_uni_position_inrange"
                                      defaultMessage="in range"
                                    />
                                  </em>
                                ) : (
                                  <em styleName="outOfRange">
                                    <i className="fas fa-exclamation-triangle"></i>
                                    <FormattedMessage
                                      id="qs_uni_position_inrange"
                                      defaultMessage="out of range"
                                    />
                                  </em>
                                )}
                              </div>
                              <div styleName="poolPositionInfo">
                                <div styleName="liquidity">
                                  <strong>
                                    <FormattedMessage id="qs_uni_pool_liquidity" defaultMessage="Liquidity" />
                                  </strong>
                                  <div>
                                    <span>{formatAmount(token0.amount)}</span>
                                    <strong>{token0.symbol}</strong>
                                  </div>
                                  <div>
                                    <span>{formatAmount(token1.amount)}</span>
                                    <strong>{token1.symbol}</strong>
                                  </div>
                                </div>
                                <div styleName="prices">
                                  <strong>
                                    <FormattedMessage id="qs_uni_pool_pricerange" defaultMessage="Price range" />
                                  </strong>
                                  {poolViewSide == VIEW_SIDE.A_TO_B && (
                                    <>
                                      <div>
                                        <FormattedMessage id="qs_uni_price_min" defaultMessage="Min:" />
                                        {' '}
                                        {renderPricePerToken({
                                          price: priceHigh.buyOneOfToken1,
                                          tokenA: token0.symbol,
                                          tokenB: token1.symbol,
                                        })}
                                      </div>
                                      <div>
                                        <FormattedMessage id="qs_uni_price_max" defaultMessage="Max:" />
                                        {` `}
                                        {renderPricePerToken({
                                          price: priceLow.buyOneOfToken1,
                                          tokenA: token0.symbol,
                                          tokenB: token1.symbol,
                                        })}
                                      </div>
                                    </>
                                  )}
                                  {poolViewSide == VIEW_SIDE.B_TO_A && (
                                    <>
                                      <div>
                                        <FormattedMessage id="qs_uni_price_min" defaultMessage="Min:" />
                                        {renderPricePerToken({
                                          price: priceLow.buyOneOfToken0,
                                          tokenA: token1.symbol,
                                          tokenB: token0.symbol,
                                        })}
                                      </div>
                                      <div>
                                        <FormattedMessage id="qs_uni_price_max" defaultMessage="Max:" />
                                        {renderPricePerToken({
                                          price: priceHigh.buyOneOfToken0,
                                          tokenA: token1.symbol,
                                          tokenB: token0.symbol,
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div styleName="poolControl">
                                <a onClick={() => {
                                  showPositionInfo(tokenId)
                                }}>
                                  <FormattedMessage
                                    id="qs_uni_manage_position"
                                    defaultMessage="Manage position"
                                  />
                                </a>
                              </div>
                            </section>
                          )
                        })}
                      </>
                    )}
                    <div style={{ marginBottom: '20px' }}>
                      <Button
                        pending={false /*isPending*/}
                        disabled={false /*!addLiquidityIsAvailable*/}
                        onClick={() => {}}
                        brand
                      >
                        <FormattedMessage id="qs_uni_addPosition" defaultMessage="Create New Position" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
  
  /* Its return type 'Element | undefined' is not a valid JSX element. */
  //return (<div></div>)
}


export default CSSModules(UniV3Pools, styles, { allowMultiple: true })