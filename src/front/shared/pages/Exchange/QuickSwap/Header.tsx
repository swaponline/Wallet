import { FormattedMessage } from 'react-intl'
import { isMobile } from 'react-device-detect'
import { GoSettings } from 'react-icons/go'
import CSSModules from 'react-css-modules'
import styles from './index.scss'
import { externalConfig } from 'helpers'
import { Sections } from './types'
import { LIQUIDITY_SOURCE_DATA } from './constants'

function Header(props) {
  const {
    network,
    activeSection,
    onlyAggregator,
    onlySource,
    wrongNetwork,
    receivedCurrency,
    openAggregatorSection,
    openSourceSection,
    openSettingsSection,
    hasUniSwapV3,
    useUniSwapV3,
    setUseUniSwapV3,
  } = props

  let sourceTitle = LIQUIDITY_SOURCE_DATA[network.networkVersion]?.name || (
    <FormattedMessage id="source" defaultMessage="Source" />
  )
  if (onlySource) sourceTitle = <FormattedMessage id="menu.exchange" defaultMessage="Exchange" />

  return (
    <div styleName="header">
      {!onlySource && (
        <button
          styleName={`tab ${activeSection === Sections.Aggregator ? 'active' : ''} ${
            externalConfig.entry === 'testnet' ? 'disabled' : ''
          }`}
          onClick={openAggregatorSection}
        >
          <FormattedMessage id="aggregator" defaultMessage="Aggregator" />
        </button>
      )}

      {!onlyAggregator && (
        <>
          {hasUniSwapV3 ? (
            <>
              <button
                id="sourceSectionDescription"
                styleName={`tab ${(activeSection === Sections.Source && !useUniSwapV3) ? 'active' : ''}`}
                onClick={() => {
                  openSourceSection()
                  setUseUniSwapV3(false)
                }}
              >
                {sourceTitle}
              </button>
              <button
                id="sourceSectionDescription"
                styleName={`tab ${(activeSection === Sections.Source && useUniSwapV3) ? 'active' : ''}`}
                onClick={() => {
                  openSourceSection()
                  setUseUniSwapV3(true)
                }}
              >
                {`UniSwap V3`}
              </button>
            </>
          ) : (
            <button
              id="sourceSectionDescription"
              styleName={`tab ${activeSection === Sections.Source ? 'active' : ''}`}
              onClick={openSourceSection}
            >
              {sourceTitle}
            </button>
          )}
        </>
      )}

      <button
        styleName={`tab ${activeSection === Sections.Settings ? 'active' : ''} ${
          wrongNetwork || receivedCurrency.notExist ? 'disabled' : ''
        }`}
        onClick={openSettingsSection}
      >
        {isMobile ? (
          <GoSettings alt="swap settings" />
        ) : (
          <FormattedMessage id="settings" defaultMessage="Settings" />
        )}
      </button>
    </div>
  )
}

export default CSSModules(Header, styles, { allowMultiple: true })
