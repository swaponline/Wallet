import React from 'react'
import { Link } from 'react-router-dom'
import CSSModules from 'react-css-modules'
import styles from './index.scss'
import links from 'helpers/links'
import { constants } from 'helpers'
import { FormattedMessage } from 'react-intl'
import web3Icons from 'images/'
import screenIcons from './images'

const isDark = localStorage.getItem(constants.localStorage.isDark)

const SplashScreen = () => {
  const handlerSkipBtn = () => {
    const date = new Date()
    const daysInThisMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
    // 60 second * 60 minutes * 24 hours * daysInThisMonth * 12 months
    const SEC_IN_YEAR = 60 * 60 * 24 * daysInThisMonth * 12

    setCookie({
      name: 'swapDisalbeStarter',
      value: 'true',
      options: {
        expires: SEC_IN_YEAR * 5,
      },
    })
  }

  const setCookie = (params) => {
    let { name, value, options = {} } = params

    let expires = options.expires

    if (typeof expires == 'number' && expires) {
      let date = new Date()

      date.setTime(date.getTime() + expires * 1000)
      expires = options.expires = date;
    }

    if (expires && expires.toUTCString) {
      options.expires = expires.toUTCString()
    }

    value = encodeURIComponent(value)

    let updatedCookie = name + '=' + value

    for (let propName in options) {
      updatedCookie += '; ' + propName

      const propValue = options[propName]

      if (propValue !== true) {
        updatedCookie += '=' + propValue
      }
    }

    document.cookie = updatedCookie
  }


  return (
    <section styleName={`splashScreen ${isDark ? 'dark' : ''}`}>
      <h2>
        <FormattedMessage
          id="SplashScreenTitle"
          defaultMessage="Simple interface to access blockchains"
        />
      </h2>

      <div styleName="infoWrapper">
        <div styleName="infoBlock">
          <img src={screenIcons.WALLET} />
          <p>
            <FormattedMessage
              id="SplashScreenWalletText"
              defaultMessage="Store, send, receive cryptocurrencies (Bitcoin, Ethereum, tokens...) without installation and registration"
            />
          </p>
        </div>

        <div styleName="infoBlock">
          <img src={screenIcons.EXCHANGE} />
          <p>
            <FormattedMessage
              id="SplashScreenExchangeText"
              defaultMessage="Trade on the decentralized P2P exchange using atomic swap technology"
            />
          </p>
        </div>
      </div>

      <div styleName="buttonsWrapper">
        <div styleName="topButtons">
          <Link to={links.createWallet}>
            <FormattedMessage
              id="AlertModalcreateWallet"
              defaultMessage="Create Wallet"
            />
          </Link>

          <Link to={links.connectWallet}>
            <img styleName="connectBtnIcon" src={web3Icons.METAMASK} />{' '}
            <FormattedMessage
              id="ImportKeys_ConnectWallet"
              defaultMessage="Connect Wallet"
            />
          </Link>
        </div>

        <Link to={links.restoreWallet}>
          <FormattedMessage
            id="ImportKeys_RestoreMnemonic"
            defaultMessage="Restore from 12-word seed"
          />
        </Link>

        <Link to={links.exchange} onClick={handlerSkipBtn}>
          <FormattedMessage id="skip" defaultMessage="Skip" />
        </Link>
      </div>
    </section>
  )
}

export default CSSModules(SplashScreen, styles, { allowMultiple: true })