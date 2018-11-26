import React, { PureComponent } from 'react'

import Table from 'components/tables/Table/Table'
import styles from 'components/tables/Table/Table.scss'
import RowHistory from './RowHistory/RowHistory'
import { FormattedMessage } from 'react-intl'


export default class SwapsHistory extends PureComponent {

  render() {
    let { orders } = this.props
    const titles = [
      <FormattedMessage id="SwapHisrory14" defaultMessage="Avatar" />,
      <FormattedMessage id="SwapHisrory15" defaultMessage="Exchange" />,
      <FormattedMessage id="SwapHisrory16" defaultMessage="You buy" />,
      <FormattedMessage id="SwapHisrory17" defaultMessage="You sell" />,
      <FormattedMessage id="SwapHisrory18" defaultMessage="Exchange rate" />,
      <FormattedMessage id="SwapHisrory19" defaultMessage="Status refund" />,
      <FormattedMessage id="SwapHisrory20" defaultMessage="Status order" />,
      <FormattedMessage id="SwapHisrory211" defaultMessage="Lock time" />,
      <FormattedMessage id="SwapHisrory22" defaultMessage="Link" />,
    ]

    if (orders === null || orders.length === 0) {
      return null
    }

    return (
      <div style={{ marginBottom: '50px' }}>
        <FormattedMessage id="SwapHisrory21" defaultMessage="Swaps history">
          {message => <h3>{message}</h3>}
        </FormattedMessage>
        <Table
          id="table-history"
          className={styles.historySwap}
          titles={titles}
          rows={orders.reverse()}
          rowRender={(row, index) => (
            <RowHistory
              key={index}
              row={row}
            />
          )}
        />
      </div>
    )
  }
}
