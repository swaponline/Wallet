import { useState, useEffect, useRef } from 'react'
import { FormattedMessage } from 'react-intl'
import styles from './RemoveLiquidity.scss'
import CSSModules from 'react-css-modules'
import BigNumber from 'bignumber.js'
import actions from 'redux/actions'
import modals from 'helpers/constants/modals'
import {
  PositionAction,
  VIEW_SIDE,
  TOKEN,
} from './types'
import { formatAmount } from './helpers'
import Button from 'components/controls/Button/Button'
import Toggle from 'components/controls/Toggle/Toggle'
import BackButton from './ui/BackButton'
import InfoBlock from './ui/InfoBlock'

function RemoveLiquidity(props) {
  const {
    positionId,
    setDoPositionsUpdate,
    setCurrentAction,
    poolInfo,
    positionInfo,
    positionInfo: {
      priceHigh,
      priceLow,
      token0,
      token1,
    },
    owner,
    baseCurrency,
    chainId,
  } = props

  const [ liqPercent, setLiqPercent ] = useState(0)
  const [ doWrap, setDoWrap ] = useState(false)

  const token0IsWrapped = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token0.address })
  const token1IsWrapped = actions.uniswap.isWrappedToken({ chainId, tokenAddress: token1.address })
  const hasWrappedToken = token0IsWrapped || token1IsWrapped
  
  const [ isRemoving, setIsRemoving ] = useState(false)

  const getTokenSymbol = (tokenType) => {
    return (tokenType == TOKEN._0)
      ? token0IsWrapped ? baseCurrency : token0.symbol
      : token1IsWrapped ? baseCurrency : token1.symbol
  }
  
  const handleRemoveLiquidity = () => {
    actions.modals.open(modals.Confirm, {
      title: (<FormattedMessage id="qs_uni_pos_liq_del_title" defaultMessage="Confirm action" />),
      message: (
        <FormattedMessage
          id="qs_uni_pos_liq_del_message"
          defaultMessage="Do you really want to remove {percents}% of liquidity ({token0Amount} {token0Symbol} and {token1Amount} {token1Symbol})?"
          values={{
            percents: liqPercent,
            token0Amount: formatAmount(new BigNumber(token0.amount).dividedBy(100).multipliedBy(liqPercent).toNumber()),
            token0Symbol: !doWrap ? getTokenSymbol(TOKEN._0) : token0.symbol,
            token1Amount: formatAmount(new BigNumber(token1.amount).dividedBy(100).multipliedBy(liqPercent).toNumber()),
            token1Symbol: !doWrap ? getTokenSymbol(TOKEN._1) : token1.symbol,
          }}
        />
      ),
      onAccept: async () => {
        setIsRemoving(true)
        try {
          await actions.uniswap.removeLiquidityV3({
            baseCurrency,
            chainId,
            owner,
            position: positionInfo,
            percents: liqPercent,
            waitReceipt: true,
            unwrap: (hasWrappedToken && !doWrap) ? true : false,
          })
          setDoPositionsUpdate(true)
          actions.modals.open(modals.AlertModal, {
            message: (<FormattedMessage id="qs_uni_pos_liq_deleted" defaultMessage="Liquidity successfully removed" />),
            onClose: () => {
              setCurrentAction(PositionAction.INFO)
            }
          })
        } catch (err) {
          console.log('>>> ERROR', err)
          setIsRemoving(false)
        }
      }
    })
  }

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
          id="qs_uni_pos_liq_del_header"
          defaultMessage="Remove liquidity"
        />
      </h3>
      <div styleName="percentRange">
        <strong>
          <FormattedMessage
            id="qs_uni_pos_liq_del_amount"
            defaultMessage="Amount"
          />
        </strong>
        <div styleName="predefinedPercents">
          <span>
            {liqPercent}%
          </span>
          <div styleName={(isRemoving) ? 'disabled' : ''}>
            <a onClick={() => { if (!isRemoving) setLiqPercent(25) }}>25%</a>
            <a onClick={() => { if (!isRemoving) setLiqPercent(50) }}>50%</a>
            <a onClick={() => { if (!isRemoving) setLiqPercent(75) }}>75%</a>
            <a onClick={() => { if (!isRemoving) setLiqPercent(100) }}>max</a>
          </div>
        </div>
        <div styleName="inputHolder">
          <input type="range" disabled={isRemoving} min={0} max={100} value={liqPercent} onChange={(e) => { setLiqPercent(Number(e.target.value)) }} />
        </div>
      </div>
      <div styleName="pooledCount">
        <div>
          <span>
            <FormattedMessage
              id="qs_uni_pos_liq_del_token_symbol"
              defaultMessage="Pooled {symbol}:"
              values={{symbol: getTokenSymbol(TOKEN._0)}}
            />
          </span>
          <strong>
            {formatAmount(new BigNumber(token0.amount).dividedBy(100).multipliedBy(liqPercent).toNumber())}
          </strong>
        </div>
        <div>
          <span>
            <FormattedMessage
              id="qs_uni_pos_liq_del_token_symbol"
              defaultMessage="Pooled {symbol}:"
              values={{symbol: getTokenSymbol(TOKEN._1)}}
            />
          </span>
          <strong>
            {formatAmount(new BigNumber(token1.amount).dividedBy(100).multipliedBy(liqPercent).toNumber())}
          </strong>
        </div>
        {hasWrappedToken && (
          <div styleName="wrapNative">
            <span>
              <FormattedMessage
                id="qs_uni_pos_liq_del_unwrap"
                defaultMessage="Collect as {tokenSymbol}"
                values={{
                  tokenSymbol: (token0IsWrapped) ? token0.symbol : token1.symbol
                }}
              />
            </span>
            <Toggle checked={doWrap} onChange={(v) => { console.log('toggle', v, isRemoving); if (!isRemoving) setDoWrap(v) }} />
          </div>
        )}
      </div>
      <div>
        <Button
          brand
          onClick={() => { handleRemoveLiquidity() }}
          disabled={(liqPercent == 0) || isRemoving}
          fullWidth
        >
          {isRemoving ? (
            <FormattedMessage
              id="qs_uni_pos_liq_del_removing"
              defaultMessage="Liquidity removal..."
            />
          ) : (
            <FormattedMessage
              id="qs_uni_pos_liq_del_confirm"
              defaultMessage="Remove liquidity"
            />
          )}
        </Button>
      </div>
      <div styleName="cancelHolder">
        <Button
          gray
          fullWidth
          onClick={() => { setCurrentAction(PositionAction.INFO) }}
          disabled={isRemoving}
        >
          <FormattedMessage id="qs_uni_cancel" defaultMessage="Cancel" />
        </Button>
      </div>
    </div>
  )
}

export default CSSModules(RemoveLiquidity, styles, { allowMultiple: true })