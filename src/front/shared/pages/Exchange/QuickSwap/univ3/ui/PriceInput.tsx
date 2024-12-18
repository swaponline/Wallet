import { FormattedMessage } from 'react-intl'
import cssModules from 'react-css-modules'
import styles from './PriceInput.scss'

type PriceInputProps = {
  price: number
  label: any,
  disabled?: boolean
  onChange?: (amount:number) => void
  onBlur?: () => void
  tokenA: string,
  tokenB: string,
}
const PriceInput = (props: PriceInputProps) => {
  const {
    price,
    label = false,
    disabled = false,
    onChange = (v: number) => {},
    onBlur = () => {},
    tokenA = 'A',
    tokenB = 'B',
  } = props

  return (
    <div styleName="priceInput">
      <div>
        <label>{label}</label>
        <input
          type="number"
          value={price}
          disabled={disabled}
          placeholder="0"
          onBlur={() => { onBlur() }}
          onChange={(e) => { onChange(Number(e.target.value)) }}
        />
        <span>
          <FormattedMessage
            id="PriceInput_amount_per_one"
            defaultMessage="{tokenA} per {tokenB}"
            values={{
              tokenA,
              tokenB,
            }}
          />
        </span>
      </div>
    </div>
  )
}

export default cssModules(PriceInput, styles, { allowMultiple: true })
