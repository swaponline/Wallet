import { FormattedMessage } from 'react-intl'
import cssModules from 'react-css-modules'
import styles from './AmountInput.scss'
import InlineLoader from 'components/loaders/InlineLoader/InlineLoader'

type AmountInputProps = {
  amount: number
  disabled?: boolean
  onChange: (amount:number) => void
  symbol: string
  balance: any
  onBalanceUpdate: () => void
  fiatPrice?: any
  isBalanceUpdate?: boolean
}
const AmountInput = (props: AmountInputProps) => {
  const {
    amount,
    disabled = false,
    onChange,
    symbol,
    balance,
    onBalanceUpdate,
    fiatPrice = false,
    isBalanceUpdate = false,
  } = props

  return (
    <div styleName="amountInput">
      <div>
        <input
          type="number"
          value={amount}
          disabled={disabled}
          onChange={(e) => { onChange(Number(e.target.value)) }}
        />
        <span>{symbol}</span>
        {fiatPrice && (
          <p>~{fiatPrice}</p>
        )}
        <div onClick={() => { if (!isBalanceUpdate) onBalanceUpdate() }}>
          {isBalanceUpdate ? (
            <InlineLoader />
          ) : (
            <>
              <em>
                <FormattedMessage
                  id="Control_AmountInput_Balance"
                  defaultMessage="Balance:"
                />
              </em>
              <i>{balance}</i>
              <span className="fas fa-sync-alt"></span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default cssModules(AmountInput, styles, { allowMultiple: true })
