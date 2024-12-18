import { useState, useEffect } from 'react'
import { FormattedMessage } from 'react-intl'
import cssModules from 'react-css-modules'
import styles from './InfoBlock.scss'
import { renderPricePerToken, formatAmount } from '../helpers'
import BigNumber from 'bignumber.js'
import {
  VIEW_SIDE,
  TOKEN,
} from '../types'
import actions from 'redux/actions'

const InfoBlock = (props: any) => {
  const {
    chainId,
    baseCurrency,
    positionInfo,
    positionInfo: {
      tokenId: positionId,
      poolInfo,
      currentPrice,
      priceHigh,
      priceLow,
      token0,
      token1,
      isClosed,
      fee,
    }
  } = props

  const [ poolViewSide, setPoolViewSide ] = useState(VIEW_SIDE.A_TO_B)
  
  const posInRange = (
    poolViewSide == VIEW_SIDE.A_TO_B
  ) ? (
    new BigNumber(priceHigh.buyOneOfToken1).isLessThanOrEqualTo(currentPrice.buyOneOfToken1) 
    && new BigNumber(priceLow.buyOneOfToken1).isGreaterThanOrEqualTo(currentPrice.buyOneOfToken1)
  ) : (
    new BigNumber(priceLow.buyOneOfToken0).isLessThanOrEqualTo(currentPrice.buyOneOfToken0)
    && new BigNumber(priceHigh.buyOneOfToken0).isGreaterThanOrEqualTo(currentPrice.buyOneOfToken0)
  )
  
  const isWrappedToken0 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token0.address })
  const isWrappedToken1 = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token1.address })

  const getTokenSymbol = (tokenType) => {
    return (tokenType == TOKEN._0)
      ? isWrappedToken0 ? baseCurrency : token0.symbol
      : isWrappedToken1 ? baseCurrency : token1.symbol
  }

  return (
    <div styleName="positionInfo">
      <div styleName="posIdAndFee">
        <span>Position Id: <em>#{positionId}</em></span>
        <em>
          <FormattedMessage
            id="qs_uni_position_fee"
            defaultMessage="Fee: {fee}%"
            values={{ fee: fee/10000 }}
          />
        </em>
      </div>
      <div styleName="switchViewSide">
        <span>
          <FormattedMessage id="univ3_pos_info_price_range" defaultMessage="Price range" />
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
                id="qs_uni_position_outrange"
                defaultMessage="out of range"
              />
            </em>
          )}
          {isClosed && (
            <em styleName="closed">
              <i className="fas fa-ban"></i>
              <FormattedMessage
                id="qs_uni_position_closed"
                defaultMessage="closed"
              />
            </em>
          )}
        </span>
        <div>
          <a 
            styleName={(poolViewSide == VIEW_SIDE.A_TO_B) ? 'active' : ''}
            onClick={() => { setPoolViewSide(VIEW_SIDE.A_TO_B) }}
          >
            {getTokenSymbol(TOKEN._0)}
          </a>
          <a
            styleName={(poolViewSide == VIEW_SIDE.B_TO_A) ? 'active' : ''}
            onClick={() => { setPoolViewSide(VIEW_SIDE.B_TO_A) }}
          >
            {getTokenSymbol(TOKEN._1)}
          </a>
        </div>
      </div>
      <div styleName="priceRangeHolder">
        <div styleName="minPrice">
          <strong>
            <FormattedMessage id="qs_uni_min_price" defaultMessage="Min price" />
          </strong>
          <span>
            {formatAmount((poolViewSide == VIEW_SIDE.A_TO_B) ? priceHigh.buyOneOfToken1 : priceLow.buyOneOfToken0)}
          </span>
          <em>
            <FormattedMessage
              id="qs_uni_per_token"
              defaultMessage="{tokenA} per {tokenB}"
              values={{
                tokenA: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._0) : getTokenSymbol(TOKEN._1),
                tokenB: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._1) : getTokenSymbol(TOKEN._0),
              }}
            />
          </em>
        </div>
        <div styleName="maxPrice">
          <strong>
            <FormattedMessage id="qs_uni_max_price" defaultMessage="Max price" />
          </strong>
          <span>
            {formatAmount((poolViewSide == VIEW_SIDE.A_TO_B) ? priceLow.buyOneOfToken1 : priceHigh.buyOneOfToken0)}
          </span>
          <em>
            <FormattedMessage
              id="qs_uni_per_token"
              defaultMessage="{tokenA} per {tokenB}"
              values={{
                tokenA: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._0) : getTokenSymbol(TOKEN._1),
                tokenB: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._1) : getTokenSymbol(TOKEN._0),
              }}
            />
          </em>
        </div>
        <div styleName="curPrice">
          <strong>
            <FormattedMessage id="qs_uni_current_price" defaultMessage="Current price" />
          </strong>
          <span>
            {formatAmount((poolViewSide == VIEW_SIDE.A_TO_B) ? currentPrice.buyOneOfToken1 : currentPrice.buyOneOfToken0)}
          </span>
          <em>
            <FormattedMessage
              id="qs_uni_per_token"
              defaultMessage="{tokenA} per {tokenB}"
              values={{
                tokenA: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._0) : getTokenSymbol(TOKEN._1),
                tokenB: (poolViewSide == VIEW_SIDE.A_TO_B) ? getTokenSymbol(TOKEN._1) : getTokenSymbol(TOKEN._0),
              }}
            />
          </em>
        </div>
      </div>
      <div styleName="liquidity">
        <strong>
          <FormattedMessage
            id="qs_uni_posinfo_liqudity_title"
            defaultMessage="Liquidity"
          />
        </strong>
        <div>
          <span>{formatAmount(token0.amount)}</span>
          <strong>{getTokenSymbol(TOKEN._0)}</strong>
        </div>
        <div>
          <span>{formatAmount(token1.amount)}</span>
          <strong>{getTokenSymbol(TOKEN._1)}</strong>
        </div>
      </div>
    </div>
  )
}

export default cssModules(InfoBlock, styles, { allowMultiple: true })
