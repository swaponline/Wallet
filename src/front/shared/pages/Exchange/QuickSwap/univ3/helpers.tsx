import { FormattedMessage } from 'react-intl'


export const formatAmount = (priceIn) => {
  priceIn = Number(priceIn)
  let roundTo = (priceIn < 0.009) ? 5 : 4
  if (priceIn > 100) roundTo = 3
  const fixedPrice = Number(priceIn.toFixed(roundTo))
  if (fixedPrice == 0) return 0
  //if (Number.isFinite(fixedPrice)) return '****'
  return (fixedPrice < 0.00001) ? '<0.00001' : fixedPrice
}

export const renderPricePerToken = ({ price, tokenA, tokenB }) => {
  return (
    <FormattedMessage
      id="qs_uni_price_per_token"
      defaultMessage="{price} {tokenA} per {tokenB}"
      values={{
        price: formatAmount(price),
        tokenA: (<strong>{tokenA}</strong>),
        tokenB: (<strong>{tokenB}</strong>),
      }}
    />
  )
}