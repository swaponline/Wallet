import puppeteer from 'puppeteer'
import { createBrowser, addTokenToWallet, takeScreenshot, clickOn, waitSlowLoadSelector, timeOut } from '../utils'

jest.setTimeout(360 * 1000)

describe('Adding custom tokens', () => {
  let testBrowser: puppeteer.Browser | undefined
  let testPage: puppeteer.Page | undefined

  type TestCase = [
    string,
    string,
    {
      contract: string
      titleId: string
      walletTitle: string
    }
  ]


  const cases: TestCase[] = [
  /*
    [
      'Custom ETH ERC20',
      'etherc20',
      {
        contract: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        titleId: 'erc20weth',
        walletTitle: 'WETH ERC20',
      },
    ],
    */
    [
      'Custom BSC BEP20',
      'bnbbep20',
      {
        contract: '0x094616f0bdfb0b526bd735bf66eca0ad254ca81f',
        titleId: 'bep20wbnb',
        walletTitle: 'WBNB BEP20',
      },
    ],
    /*
    [
      'Custom POLYGON ERC20',
      'maticerc20matic',
      {
        contract: '0x9c3c9283d3e44854697cd22d3faa240cfb032889',
        titleId: 'erc20maticwmatic',
        walletTitle: 'WMATIC ERC20MATIC',
      },
    ],
    */
    /*
    [
      'Custom xDai ERC20',
      'xdaierc20xdai',
      {
        contract: '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d',
        titleId: 'erc20xdaiwxdai',
        walletTitle: 'WXDAI ERC20XDAI',
      },
    ],
    [
      'Custom Fantom ERC20',
      'ftmerc20ftm',
      {
        contract: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',
        titleId: 'erc20ftmwftm',
        walletTitle: 'WFTM ERC20FTM',
      },
    ],
    [
      'Custom Avalanche ERC20',
      'avaxerc20avax',
      {
        contract: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7',
        titleId: 'erc20avaxwavax',
        walletTitle: 'WAVAX ERC20AVAX',
      },
    ],
    [
      'Custom moonbase ERC20',
      'movrerc20movr',
      {
        contract: '0x98878B06940aE243284CA214f92Bb71a2b032B8A',
        titleId: 'erc20movrwmovr',
        walletTitle: 'WMOVR ERC20MOVR',
      },
    ],
    */
    // their testnet is not working
    // [
    //   'Custom Harmony ERC20',
    //   'oneerc20one',
    //   {
    //     contract: '',
    //     titleId: '',
    //     walletTitle: '',
    //   },
    // ],
    // @todo fix token addition for Aurora betanet
    // [
    //   'Custom Aurora ERC20',
    //   'auretherc20aurora',
    //   {
    //     contract: '0x9D29f395524B3C817ed86e2987A14c1897aFF849',
    //     titleId: 'erc20auroraeth',
    //     walletTitle: 'WETH ERC20AURETH',
    //   },
    // ],
  ]

  async function checkTokenDisplay(params) {
    const { page, name, expectedTitle } = params

    const walletTitle = await page.$eval(`#${name}WalletTitle`, (el) => el.textContent)

    if (walletTitle !== expectedTitle) {
      throw new Error(`incorrect display for ${name.toUpperCase()} type`)
    }
  }

  beforeAll(async () => {
    const { browser, page } = await createBrowser()

    testBrowser = browser
    testPage = page

    await page.waitForSelector('#preloaderCreateBtn')
    await page.click('#preloaderCreateBtn')

    await timeOut(60_000)
  })

  afterAll(async () => {
    await testBrowser?.close()
  })

  // add some coin on first load
  // it lets to write less code for token tests
  it('adding ETH', async () => {
    if (testPage) {
      try {
        await clickOn({
          page: testPage,
          selector: `#ethWallet`,
        })
        await clickOn({
          page: testPage,
          selector: '#continueBtn',
        })
      } catch (error) {
        console.error(error)
        await takeScreenshot(testPage, `AddingWalletError_eth`)
        expect(false).toBe(true)
      }
    } else {
      throw new Error('page is not found')
    }
  })

  it.each(cases)('adding %s', async (name, typeId, options) => {
    if (testPage) {
      try {
        const { contract, titleId, walletTitle } = options

        await addTokenToWallet({
          page: testPage,
          standardId: typeId,
          contract,
        })

        const isAddedToken = await waitSlowLoadSelector(testPage, `#${titleId}WalletTitle`, 60_000, 20)
        if (!isAddedToken) {
          throw new Error('Add token timeout')
        }

        await checkTokenDisplay({
          page: testPage,
          name: titleId,
          expectedTitle: walletTitle,
        })
      } catch (error) {
        console.error(error)
        await takeScreenshot(testPage, `AddingWalletError_${typeId}`)
        expect(false).toBe(true)
      }
    } else {
      throw new Error('page is not found')
    }
  })
})
