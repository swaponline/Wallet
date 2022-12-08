import SwapApp, { ServiceInterface, constants } from 'swap.app'
import instances from './instances'

let _privateKeys
let _mnemonic
const getPublicDataMethods = {}

class SwapAuth extends ServiceInterface {

  _serviceName: string

  accounts: any

  // @ts-ignore
  static get name() {
    return 'auth'
  }

  constructor(privateKeys, useMnemonic?: string) {
    super()

    this._serviceName         = 'auth'
    this.accounts             = {}

    _privateKeys = privateKeys
    _mnemonic = useMnemonic
  }

  initService() {
    const { app } = this

    SwapApp.required(app)

    Object.keys(_privateKeys).forEach((name) => {
      if (Object.keys(constants.COINS).indexOf(name) < 0) {
        let error = `SwapAuth._initService(): There is no instance with name "${name}".`
        error += `Only [${JSON.stringify(Object.keys(constants.COINS)).replace(/"/g, '\'')}] available`

        throw new Error(error)
      }

      try {
        const instance = instances[name]
        const account = (_mnemonic)
          ? instance.loginMnemonic(_mnemonic, 0, false, app)
          : instance.login(_privateKeys[name], app)

        this.accounts[name] = account
        getPublicDataMethods[name] = () => instance.getPublicData(account, app)
      }
      catch (err) {
        throw new Error(`SwapAuth._initService(): ${err}`)
      }
    })
  }

  getPublicData() {
    const data = {
      peer: this.app.services.room.peer,
    }

    Object.keys(getPublicDataMethods).forEach((name) => {
      data[name] = getPublicDataMethods[name]()
    })

    return data
  }
}

export default SwapAuth
