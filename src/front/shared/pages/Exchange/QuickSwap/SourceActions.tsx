import { FormattedMessage } from 'react-intl'
import CSSModules from 'react-css-modules'
import styles from './SourceActions.scss'
import { Actions } from './types'

function SourceActions(props) {
  const { sourceAction, setAction, useUniSwapV3 } = props

  const actions = [
    {
      type: Actions.Swap,
      message: <FormattedMessage id="swap" defaultMessage="Swap" />,
    },
    ...((!useUniSwapV3) ? [{
      type: Actions.AddLiquidity,
      message: <FormattedMessage id="addLiquidity" defaultMessage="Add liquidity" />,
    }] : []),
    ...((useUniSwapV3) ? [{
      type: Actions.UniPoolsV3,
      message: <FormattedMessage id="qs_uniPoolsV3" defaultMessage="Liquidity pools" />,
    }] : []),
  ]
  
  return (
    <div styleName="actionsWrapper">
      {actions.map((action) => {
        return (
          <label styleName="actionLabel" key={`key_${action.type}`}>
            <input
              type="radio"
              name="sourceAction"
              checked={sourceAction === action.type}
              onChange={() => setAction(action.type)}
            />
            {action.message}
          </label>
        )
      })}
    </div>
  )
}

export default CSSModules(SourceActions, styles, { allowMultiple: true })
