export type CurrencyMenuItem = {
  name: string
  title: string
  icon: string
  value: string
  fullTitle: string
  blockchain?: string
  standard?: string
  notExist?: boolean
}

export type TokenData = {
  symbol: string
  name: string
  decimals: number
  address: string
  logoURI: string
}

export type SwapData = {
  allowanceTarget: string
  buyAmount: string
  data: string
  gasPrice: string
  gas: string
  sellAmount: string
  to: `0x${number}`
}

export type SwapInfo = {
  swapFee: string,
  fiat: string,
  serviceFee: ServiceFee | false,
  slippage: number,
  network: EvmNetworkConfig,
  spendedAmount: string,
  baseChainWallet: IUniversalObj,
  fromWallet: IUniversalObj,
  toWallet: IUniversalObj,
}

export enum Sections {
  Aggregator,
  Source,
  Settings,
}

export enum Actions {
  Swap,
  AddLiquidity,
  UniPoolsV3,
  AddLiquidityV3,
}

export enum Direction {
  Spend,
  Receive,
}

export enum BlockReasons {
  InsufficientSlippage,
  NoLiquidity,
  NoBalance,
  NoBaseCurrencyBalance,
  Liquidity,
  PairDoesNotExist,
  NotApproved,
  Unknown,
}

export type ServiceFee = {
  address: string
  percent: number
}

export type ComponentState = SwapInfo & {
  externalExchangeReference: null | IUniversalObj
  externalWindowTimer: null | NodeJS.Timeout
  currentLiquidityPair: null | string
  currencies: CurrencyMenuItem[]
  receivedList: CurrencyMenuItem[]
  error: IError | null
  activeSection: Sections
  isPending: boolean
  isSourceMode: boolean
  onlyAggregator: boolean
  onlySource: boolean
  needApproveA: boolean
  needApproveB: boolean
  spendedCurrency: CurrencyMenuItem
  receivedCurrency: CurrencyMenuItem
  receivedAmount: string
  sourceAction: Actions
  userDeadline: number
  slippageMaxRange: number
  wrongNetwork: boolean
  swapData: SwapData | undefined
  gasPrice: string
  gasLimit: string
  blockReason: BlockReasons | undefined
  liquidityErrorMessage: string
  zeroxApiKey: string
  
  useUniSwapV3: boolean
  uniV3PoolsByFee: any[]
  uniV3ActivePoolFee: number
  // Wrap/Unwrap
  isWrapUnwrap: boolean
  isWrappedTokenA: boolean
  isWrappedTokenB: boolean
  isNativeTokenA: boolean
  isNativeTokenB: boolean
}
