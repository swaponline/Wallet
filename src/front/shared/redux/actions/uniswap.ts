import BigNumber from 'bignumber.js'
import { ethers } from 'ethers'
import { abi as FactoryV2ABI } from '@uniswap/v2-periphery/build/IUniswapV2Factory.json'
import { abi as RouterV2ABI } from '@uniswap/v2-periphery/build/IUniswapV2Router02.json'
import { abi as PairV2ABI } from '@uniswap/v2-periphery/build/IUniswapV2Pair.json'
import ethLikeHelper from 'common/helpers/ethLikeHelper'
import constants from 'common/helpers/constants'
import utils from 'common/utils'
import actions from 'redux/actions'

import config from 'helpers/externalConfig'

import { abi as FactoryV3ABI } from '@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json'
import { abi as QuoterV3ABI } from '@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json'
import { abi as SwapRouterV3ABI } from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import { abi as PositionManagerV3ABI } from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import { abi as PoolV3ABI } from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import { abi as ERC20MetadataABI } from '@uniswap/v3-periphery/artifacts/contracts/interfaces/IERC20Metadata.sol/IERC20Metadata.json'
import { abi as MulticallABI } from 'common/multicall/abi.json'
import WrappedCoinAbi from 'common/wrappedcoin/abi.json'

import { Interface as AbiInterface } from '@ethersproject/abi'
import JSBI from 'jsbi'

const ABIS = {
  factory: FactoryV2ABI,
  router: RouterV2ABI,
  pair: PairV2ABI,
  
  factory_v3: FactoryV3ABI,
  pool_v3: PoolV3ABI,
  quoter_v3: QuoterV3ABI,
  router_v3: SwapRouterV3ABI,
  position_manager_v3: PositionManagerV3ABI,
  
  erc20: ERC20MetadataABI,
  multicall: MulticallABI,
  
  wrapped: WrappedCoinAbi,
}

enum SwapMethods {
  swapExactETHForTokens = 'swapExactETHForTokens',
  swapExactTokensForETH = 'swapExactTokensForETH',
  swapExactTokensForTokens = 'swapExactTokensForTokens',
  swapTokensForExactTokens = 'swapTokensForExactTokens',
  swapExactETHForTokensSupportingFeeOnTransferTokens = 'swapExactETHForTokensSupportingFeeOnTransferTokens',
  swapExactTokensForETHSupportingFeeOnTransferTokens = 'swapExactTokensForETHSupportingFeeOnTransferTokens',
  swapExactTokensForTokensSupportingFeeOnTransferTokens = 'swapExactTokensForTokensSupportingFeeOnTransferTokens',
}

enum LiquidityMethods {
  addLiquidity = 'addLiquidity',
  addLiquidityETH = 'addLiquidityETH',
  removeLiquidity = 'removeLiquidity',
  removeLiquidityETH = 'removeLiquidityETH',
}

type GetContractParams = {
  name: 'factory' | 'router' | 'pair' | 'factory_v3' | 'quoter_v3' | 'router_v3' | 'position_manager_v3' | 'pool_v3' | 'erc20' | 'multicall' | 'wrapped'
  address: string
  baseCurrency: string
}

// V3 - from https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickMath.sol
const TickMath_MIN_SQRT_RATIO = '4295128739'
const TickMath_MAX_SQRT_RATIO = '1461446703485210103287273052203988822378723970342'
const Q96 = 0x1000000000000000000000000
const TICK_SPACING_BY_FEE = {
  100:    0,
  500:    10,
  3000:   60,
  10000:  200
}


/* ---------------------------------- */
const wrapCurrency = (chainId: number, currencyAddress: string) => {
  const { WrapperCurrency, EVM_COIN_ADDRESS } = constants.ADDRESSES

  return currencyAddress === EVM_COIN_ADDRESS ? WrapperCurrency[chainId] : currencyAddress
}

const getContract = (params: GetContractParams) => {
  const { name, address, baseCurrency } = params

  return ethLikeHelper[baseCurrency?.toLowerCase()]?.getContract({
    abi: ABIS[name],
    address,
  })
}

const getDeadline = async (provider, deadlinePeriod): Promise<string> => {
  const latestBlockNumber = await provider.eth.getBlockNumber()
  const latestBlock = await provider.eth.getBlock(latestBlockNumber)
  const timestamp = latestBlock.timestamp

  return utils.amount.toHexNumber(new BigNumber(timestamp).plus(deadlinePeriod))
}

const getSlippageRange = (slippagePercent, amount) => {
  const MAX_PERCENT = 100

  return new BigNumber(amount).div(MAX_PERCENT).times(slippagePercent).toNumber()
}

const getMinAmount = (amount, range) => {
  return new BigNumber(amount).minus(range).integerValue(BigNumber.ROUND_CEIL)
}
const getMinSpippageAmount = (amount, slippagePercent) => {
  return getMinAmount(amount, getSlippageRange(slippagePercent, amount))
}

const getPairAddress = async (params) => {
  const { factoryAddress, baseCurrency, chainId } = params
  let { tokenA, tokenB } = params

  const factory = getContract({
    name: 'factory',
    address: factoryAddress,
    baseCurrency,
  })

  tokenA = wrapCurrency(chainId, tokenA)
  tokenB = wrapCurrency(chainId, tokenB)

  try {
    return await factory?.methods.getPair(tokenA, tokenB).call()
  } catch (error) {
    console.error(error)
    return false
  }
}
// Get pools for all exists fee
// { fee => address, ... }
const getPoolAddressV3All = async (params) => {
  const { baseCurrency, chainId } = params
  let { tokenA, tokenB, byFee } = params

  tokenA = wrapCurrency(chainId, tokenA)
  tokenB = wrapCurrency(chainId, tokenB)
  
  const mcContract = getContract({
    name: 'multicall',
    address: config?.UNISWAP_V3_CONTRACTS[chainId]?.multicall,
    baseCurrency,
  })
  const factoryAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.factory
  const factoryInterface = new AbiInterface(FactoryV3ABI)
  
  const allowedFees = [
    100,  // 0.01%
    500,  // 0.05%
    3000, // 0.3%
    10000,// 1%
  ]
  const poolsByFeeCalls = allowedFees.map((fee) => {
    return {
      target: factoryAddress,
      callData: factoryInterface.encodeFunctionData('getPool', [tokenA, tokenB, fee])
    }
  })
  
  const poolsByFeeAnswers = await mcContract?.methods.tryAggregate(false, poolsByFeeCalls).call()

  const poolsByFee = allowedFees.map((fee, feeIndex) => {
    return {
      fee,
      address: factoryInterface.decodeFunctionResult('getPool', poolsByFeeAnswers[feeIndex].returnData)[0],
    }
  }).filter(({ address }) => {
    return address != "0x0000000000000000000000000000000000000000"
  })
  if (byFee) {
    const ret = {}
    poolsByFee.forEach(({ fee, address }) => {
      ret[fee] = address
    })
    return ret
  }

  return poolsByFee
}
window.getPoolAddressV3All = getPoolAddressV3All

const getPoolAddressV3 = async (params) => {
  const { baseCurrency, chainId } = params
  let { tokenA, tokenB, fee } = params

  const factory = getContract({
    name: 'factory_v3',
    address: config?.UNISWAP_V3_CONTRACTS[chainId]?.factory,
    baseCurrency,
  })

  tokenA = wrapCurrency(chainId, tokenA)
  tokenB = wrapCurrency(chainId, tokenB)

  try {
    const poolAddress = await factory?.methods.getPool(tokenA, tokenB, fee || 10000).call()

    return poolAddress
  } catch (error) {
    console.error(error)
    return false
  }
}
window.getPoolAddressV3 = getPoolAddressV3

const getPoolInfoV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    poolAddress,
  } = params
  
  const mcContract = getContract({
    name: 'multicall',
    address: config?.UNISWAP_V3_CONTRACTS[chainId]?.multicall,
    baseCurrency,
  })

  // Fetch base pool info
  const poolInterface = new AbiInterface(PoolV3ABI)
  const basePoolInfoCalls = [
    { target: poolAddress, callData: poolInterface.encodeFunctionData('slot0') },
    { target: poolAddress, callData: poolInterface.encodeFunctionData('token0') },
    { target: poolAddress, callData: poolInterface.encodeFunctionData('token1') },
  ]

  const basePoolInfoAnswer = await mcContract?.methods.tryAggregate(false, basePoolInfoCalls).call()

  const pool_slot0 = poolInterface.decodeFunctionResult('slot0', basePoolInfoAnswer[0].returnData)
  const pool_token0 = poolInterface.decodeFunctionResult('token0', basePoolInfoAnswer[1].returnData)[0]
  const pool_token1 = poolInterface.decodeFunctionResult('token1', basePoolInfoAnswer[2].returnData)[0]

  // Fetch tokens info
  const tokenInterface = new AbiInterface(ERC20MetadataABI)
  const tokensInfoCalls = [
    { target: pool_token0, callData: tokenInterface.encodeFunctionData('decimals') },
    { target: pool_token0, callData: tokenInterface.encodeFunctionData('symbol') },
    { target: pool_token1, callData: tokenInterface.encodeFunctionData('decimals') },
    { target: pool_token1, callData: tokenInterface.encodeFunctionData('symbol') }
  ]
  const tokensInfoAnswer = await mcContract?.methods.tryAggregate(false, tokensInfoCalls).call()

  const poolInfo = {
    ...pool_slot0,
    sqrtPriceX96: pool_slot0.sqrtPriceX96.toString(),
    token0: {
      address: pool_token0,
      decimals: tokenInterface.decodeFunctionResult('decimals', tokensInfoAnswer[0].returnData)[0],
      symbol: tokenInterface.decodeFunctionResult('symbol', tokensInfoAnswer[1].returnData)[0],
    },
    token1: {
      address: pool_token1,
      decimals: tokenInterface.decodeFunctionResult('decimals', tokensInfoAnswer[2].returnData)[0],
      symbol: tokenInterface.decodeFunctionResult('symbol', tokensInfoAnswer[3].returnData)[0],
    }
  }
  
  return poolInfo
}

window.getPoolInfoV3 = getPoolInfoV3

const getAmountOutV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    tokenA,
    tokenADecimals,
    tokenB,
    tokenBDecimals,
    amountIn,
    fee,
  } = params
  
  const quoterContract = getContract({
    name: 'quoter_v3',
    address: config?.UNISWAP_V3_CONTRACTS[chainId]?.quoter,
    baseCurrency,
  })

  const wrappedTokenA = wrapCurrency(chainId, tokenA)
  const wrappedTokenB = wrapCurrency(chainId, tokenB)

  const unitAmountIn = utils.amount.formatWithDecimals(amountIn, tokenADecimals)

  const callParams = [
    wrappedTokenA,
    wrappedTokenB,
    fee || 100,//00,
    unitAmountIn,
    0
  ]
  const quotedAmountOut = await quoterContract?.methods.quoteExactInputSingle(...callParams).call()
  return utils.amount.formatWithoutDecimals(quotedAmountOut, tokenBDecimals)
}
window.getAmountOutV3 = getAmountOutV3

const calcPriceV3 = (params) => {
  const {
    sqrtPriceX96,
    Decimal0,
    Decimal1,
  } = params
  // @ts-ignore

  const buyOneOfToken0 = (new BigNumber(sqrtPriceX96).dividedBy(new BigNumber(2).pow(96))).pow(2).dividedBy(
    new BigNumber(10).pow(Decimal1).dividedBy(new BigNumber(10).pow(Decimal0))
  ).toFixed(Decimal1)
  const buyOneOfToken1 = new BigNumber(1).dividedBy(buyOneOfToken0).toFixed(Decimal0);
  // console.log("price of token0 in value of token1 : " + buyOneOfToken0.toString());
  // console.log("price of token1 in value of token0 : " + buyOneOfToken1.toString());
  // console.log("");
  // @ts-ignore
  const buyOneOfToken0Wei =(Math.floor(buyOneOfToken0 * (10**Decimal1))).toLocaleString('fullwide', {useGrouping:false});
  // @ts-ignore
  const buyOneOfToken1Wei =(Math.floor(buyOneOfToken1 * (10**Decimal0))).toLocaleString('fullwide', {useGrouping:false});
  // console.log("price of token0 in value of token1 in lowest decimal : " + buyOneOfToken0Wei);
  // console.log("price of token1 in value of token1 in lowest decimal : " + buyOneOfToken1Wei);
  // console.log("");
  return {
    buyOneOfToken0,
    buyOneOfToken1,
    buyOneOfToken0Wei,
    buyOneOfToken1Wei,
  }
}
window.calcPriceV3 = calcPriceV3

const getAmountOut = async (params) => {
  const {
    routerAddress,
    baseCurrency,
    chainId,
    tokenA,
    tokenADecimals,
    tokenB,
    tokenBDecimals,
    amountIn,
  } = params

  const router = getContract({ name: 'router', address: routerAddress, baseCurrency })
  const unitAmountIn = utils.amount.formatWithDecimals(amountIn, tokenADecimals)
  const path = [wrapCurrency(chainId, tokenA), wrapCurrency(chainId, tokenB)]

  try {
    // use getAmountsOut instead of getAmountOut, because we don't need
    // to request pair reserves manually for the second method arguments
    const amounts = await router?.methods
      .getAmountsOut(utils.amount.toHexNumber(unitAmountIn), path)
      .call()

    return utils.amount.formatWithoutDecimals(amounts[1], tokenBDecimals)
  } catch (error) {
    return error
  }
}

const getLiquidityAmountForAssetB = async (params) => {
  const {
    chainId,
    pairAddress,
    routerAddress,
    baseCurrency,
    amountADesired,
    tokenADecimals,
    tokenBDecimals,
  } = params
  let { tokenA } = params

  tokenA = wrapCurrency(chainId, tokenA)

  const router = getContract({ name: 'router', address: routerAddress, baseCurrency })
  const pair = getContract({ name: 'pair', address: pairAddress, baseCurrency })

  try {
    const token1 = await pair.methods.token1().call()
    const { reserve0, reserve1 } = await pair.methods.getReserves().call()
    const unitAmountA = utils.amount.formatWithDecimals(amountADesired, tokenADecimals)

    const reservesOrder =
      tokenA.toLowerCase() === token1.toLowerCase() ? [reserve1, reserve0] : [reserve0, reserve1]

    const tokenBAmount = await router.methods.quote(unitAmountA, ...reservesOrder).call()

    return utils.amount.formatWithoutDecimals(tokenBAmount, tokenBDecimals)
  } catch (error) {
    return error
  }
}

const returnSwapDataByMethod = async (
  params
): Promise<{
  args: any[]
  value?: string
}> => {
  let {
    chainId,
    provider,
    method,
    fromToken,
    fromTokenDecimals,
    toToken,
    toTokenDecimals,
    owner,
    deadlinePeriod,
    slippage,
    sellAmount,
    buyAmount,
  } = params

  if (!SwapMethods[method]) throw new Error('Wrong method')

  const chainNumber = Number(chainId)

  // Swaps available only for tokens. Replace native currency with a wrapped one
  fromToken = wrapCurrency(chainNumber, fromToken)
  toToken = wrapCurrency(chainNumber, toToken)

  const path = [fromToken, toToken]
  const deadline = await getDeadline(provider, deadlinePeriod)

  const weiSellAmount = utils.amount.formatWithDecimals(sellAmount, fromTokenDecimals)
  const weiBuyAmount = utils.amount.formatWithDecimals(buyAmount, toTokenDecimals)
  const buySlilppageRange = getSlippageRange(slippage, weiBuyAmount)

  // the minimum amount of the purchased asset to be received
  const intOutMin = getMinAmount(weiBuyAmount, buySlilppageRange)
  const amountOutMin = utils.amount.toHexNumber(intOutMin)
  const amountIn = weiSellAmount

  switch (method) {
    case SwapMethods.swapExactETHForTokensSupportingFeeOnTransferTokens:
    case SwapMethods.swapExactETHForTokens:
      return {
        args: [amountOutMin, path, owner, deadline],
        // without decimals and not in hex format, because we do it in the actions
        value: sellAmount,
      }

    case SwapMethods.swapExactTokensForTokensSupportingFeeOnTransferTokens:
    case SwapMethods.swapExactTokensForETHSupportingFeeOnTransferTokens:
    case SwapMethods.swapExactTokensForETH:
    case SwapMethods.swapExactTokensForTokens:
      return {
        args: [amountIn, amountOutMin, path, owner, deadline],
      }
  }

  return { args: [] }
}

const returnSwapMethod = (params) => {
  const { fromToken, toToken, useFeeOnTransfer } = params

  if (
    fromToken.toLowerCase() === constants.ADDRESSES.EVM_COIN_ADDRESS &&
    toToken.toLowerCase() === constants.ADDRESSES.EVM_COIN_ADDRESS
  ) {
    throw new Error('Swap between two native coins')
  }

  if (fromToken.toLowerCase() === constants.ADDRESSES.EVM_COIN_ADDRESS) {
    return useFeeOnTransfer
      ? SwapMethods.swapExactETHForTokensSupportingFeeOnTransferTokens
      : SwapMethods.swapExactETHForTokens
  } else if (toToken.toLowerCase() === constants.ADDRESSES.EVM_COIN_ADDRESS) {
    return useFeeOnTransfer
      ? SwapMethods.swapExactTokensForETHSupportingFeeOnTransferTokens
      : SwapMethods.swapExactTokensForETH
  } else {
    return useFeeOnTransfer
      ? SwapMethods.swapExactTokensForTokensSupportingFeeOnTransferTokens
      : SwapMethods.swapExactTokensForTokens
  }
}

const getClosestLowTick = (tick, tickSpacing) => {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}

const getClosestHighTick = (tick, tickSpacing) => {
  const closestLowTick = getClosestLowTick(tick, tickSpacing);
  return (tick % tickSpacing === 0) ? closestLowTick : closestLowTick + tickSpacing;
}

const getPriceRoundedToTick = (params) => {
  const {
    price,
    Decimal0,
    Decimal1,
    isLowerPrice = true,
    fee = 3000
  } = params

  const roundedSqrt = priceToSqrtPriceX96(price, Decimal0, Decimal1)
  const roundedSqrt_ = calculateSqrtPriceX96({
    Decimal0,
    Decimal1,
    price
  })
  const roundedTick = getTickAtSqrtRatio(roundedSqrt)
  const closestTick = (isLowerPrice)
    ? getClosestHighTick(roundedTick, TICK_SPACING_BY_FEE[fee])
    : getClosestLowTick(roundedTick, TICK_SPACING_BY_FEE[fee])
  const sqrtAtTick = getSqrtRatioAtTick(closestTick)
  const priceAtTick = calcPriceV3({ sqrtPriceX96: sqrtAtTick, Decimal0, Decimal1 })
  return {
    price: priceAtTick,
    tick: closestTick,
    sqrtPriceX96: sqrtAtTick,
  }
}

const priceToSqrtPriceX96 = (amount, decimals0, decimals1) => {
  const amount0Wei = new BigNumber(amount).multipliedBy(10**decimals0)
  const amount1Wei = new BigNumber(1).multipliedBy(10**decimals1)
  
  const Q96 = new BigNumber(2).exponentiatedBy(96)
  const ret = new BigNumber(Math.sqrt(amount1Wei.dividedBy(amount0Wei).toNumber()) * 2 ** 96);

  const SqrtPriceX96 = new BigNumber(Math.sqrt(amount1Wei.toNumber() / amount0Wei.toNumber()) * 2 ** 96)

  return ret
}

const getTickAtSqrtRatio = (sqrtPriceX96) => {
  const Q96 = new BigNumber(2).exponentiatedBy(96)

  const tQ96 = new BigNumber(sqrtPriceX96).dividedBy(Q96).toNumber()

  let tick = Math.floor(Math.log(tQ96**2)/Math.log(1.0001))
  return tick
}

const calculateSqrtPriceX96 = (params) => {
  const {
    Decimal0,
    Decimal1,
    price, // 1 token0 = price token1
  } = params

  const priceRatio = price * (10 ** (Decimal1 - Decimal0))
  const sqrtPriceX96 = new BigNumber(
    new BigNumber(priceRatio)
      .sqrt()
      .multipliedBy(new BigNumber(2).pow(96))
      .integerValue(3)
      .toString()
  )

  const roundedTick = getTickAtSqrtRatio(sqrtPriceX96.toString())
  return getSqrtRatioAtTick(roundedTick).toString()
}

const mintPositionV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    owner,
    token0Address,
    token1Address,
    amount0Wei,
    amount1Wei,
    fee,
    poolExists = true,
    sqrtPriceX96,
    tickLower,
    tickUpper,
    slippagePercent,
    deadlinePeriod,
    waitReceipt = false,
    calcFee = false,
  } = params
  
  console.log('>>> MINT POSITION V3', params)
  
  const amount0Min = new BigNumber(amount0Wei).isGreaterThan(0) ? getMinSpippageAmount(amount0Wei, slippagePercent) : amount0Wei
  const amount1Min = new BigNumber(amount1Wei).isGreaterThan(0) ? getMinSpippageAmount(amount1Wei, slippagePercent) : amount1Wei

  const isWrappedToken0 = isWrappedToken({ chainId, tokenAddress: token0Address })
  const isWrappedToken1 = isWrappedToken({ chainId, tokenAddress: token1Address })

  const nativeWei = new BigNumber(
    (isWrappedToken0 || isWrappedToken1)
      ? ((isWrappedToken0) ? amount0Wei : amount1Wei)
      : 0
  )

  const provider = actions[baseCurrency.toLowerCase()].getWeb3()

  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const positionsContract = getContract({
    name: 'position_manager_v3',
    address: positionsContractAddress,
    baseCurrency,
  })

  const positionsInterface = new AbiInterface(PositionManagerV3ABI)
  
  const deadline = await getDeadline(provider, deadlinePeriod * 60)

  const callsDataSource = [
    ...((!poolExists) ? [
      [ 'createAndInitializePoolIfNecessary', [
          token0Address,
          token1Address,
          fee,
          sqrtPriceX96
        ]
      ]
    ] : []),
    [ 'mint', [
      [
        token0Address,
        token1Address,
        fee,
        tickLower,
        tickUpper,
        amount0Wei,
        amount1Wei,
        amount0Min.toString(),
        amount1Min.toString(),
        owner,
        deadline
      ]
    ]],
    ...((isWrappedToken0 || isWrappedToken1) ? [
      [ 'refundETH', []]
    ] : []),
  ]

  const callsData = callsDataSource.map(([ func, args ]) => {
    // @ts-ignore
    return positionsInterface.encodeFunctionData(func, args)
  })

  
  const txData = positionsContract.methods.multicall(callsData).encodeABI()
  const sendParams = {
    to: positionsContractAddress,
    data: txData,
    waitReceipt,
    amount: `0x`+new BigNumber(nativeWei.toFixed(0)).toString(16),
    amountInWei: true,
    estimateGas: calcFee,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)

}

const getUserPoolLiquidityV3 = async (params) => {
  const {
    owner,
    baseCurrency,
    chainId,
    poolAddress,
  } = params
  
  const poolInfo = await getPoolInfoV3({
    poolAddress,
    chainId,
    baseCurrency
  })
  
  const poolPositionsRaw = await getUserLiquidityPositionsV3({
    owner,
    baseCurrency,
    chainId,
    fromToken: poolInfo.token0.address,
    toToken: poolInfo.token1.address,
  })
  const currentPrice = calcPriceV3({
    sqrtPriceX96: poolInfo.sqrtPriceX96,
    Decimal0: poolInfo.token0.decimals,
    Decimal1: poolInfo.token1.decimals,
  })
  const poolPositions = poolPositionsRaw.map((poolPosition) => {
    const positionLiquidity = getTokenAmountsV3({
      liquidity: poolPosition.liquidity,
      sqrtPriceX96: poolInfo.sqrtPriceX96,
      tickLow: poolPosition.tickLower,
      tickHigh: poolPosition.tickUpper,
      Decimal0: poolInfo.token0.decimals,
      Decimal1: poolInfo.token1.decimals,
    })
    const priceLow = calcPriceV3({
      sqrtPriceX96: new BigNumber(getSqrtRatioAtTick(poolPosition.tickLower).toString()).toString(), 
      Decimal0: poolInfo.token0.decimals,
      Decimal1: poolInfo.token1.decimals,
    })
    const priceHigh = calcPriceV3({
      sqrtPriceX96: new BigNumber(getSqrtRatioAtTick(poolPosition.tickUpper).toString()).toString(),
      Decimal0: poolInfo.token0.decimals,
      Decimal1: poolInfo.token1.decimals,
    })
    return {
      ...poolPosition,
      rangeType: positionLiquidity.rangeType,
      token0: {
        ...poolInfo.token0,
        amountWei: positionLiquidity.amount0wei,
        amount: positionLiquidity.amount0Human,
      },
      token1: {
        ...poolInfo.token1,
        amountWei: positionLiquidity.amount1wei,
        amount: positionLiquidity.amount1Human,
      },
      poolInfo,
      isClosed: (positionLiquidity.amount1wei == 0 && positionLiquidity.amount0wei == 0),
      priceLow,
      priceHigh,
      currentPrice,
      // @ts-ignore
      tickCurrent: poolInfo.tick,
      sqrtPriceX96: poolInfo.sqrtPriceX96,
    }
  })

  return {
    pool: {
      ...poolInfo,
      currentPrice,
    },
    positions: poolPositions,
  }
}

const mulShift = (val, mulBy) => {
  return JSBI.signedRightShift(
    JSBI.multiply(val, JSBI.BigInt(mulBy)),
    JSBI.BigInt(128),
  )
}
window.BigNumber = BigNumber
window.mulShift = mulShift

//

const getSqrtRatioAtTick = (tick) => {
  const Q32 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(32))
  const ONE = JSBI.BigInt(1)
  const ZERO = JSBI.BigInt(0)
  const MaxUint256 = JSBI.BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')
  
  const absTick = tick < 0 ? tick * -1 : tick;

  let ratio =
    (absTick & 0x1) !== 0
      ? JSBI.BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
      : JSBI.BigInt('0x100000000000000000000000000000000');
  if ((absTick & 0x2) !== 0) {
    ratio = mulShift(ratio, '0xfff97272373d413259a46990580e213a');
  }
  if ((absTick & 0x4) !== 0) {
    ratio = mulShift(ratio, '0xfff2e50f5f656932ef12357cf3c7fdcc');
  }
  if ((absTick & 0x8) !== 0) {
    ratio = mulShift(ratio, '0xffe5caca7e10e4e61c3624eaa0941cd0');
  }
  if ((absTick & 0x10) !== 0) {
    ratio = mulShift(ratio, '0xffcb9843d60f6159c9db58835c926644');
  }
  if ((absTick & 0x20) !== 0) {
    ratio = mulShift(ratio, '0xff973b41fa98c081472e6896dfb254c0');
  }
  if ((absTick & 0x40) !== 0) {
    ratio = mulShift(ratio, '0xff2ea16466c96a3843ec78b326b52861');
  }
  if ((absTick & 0x80) !== 0) {
    ratio = mulShift(ratio, '0xfe5dee046a99a2a811c461f1969c3053');
  }
  if ((absTick & 0x100) !== 0) {
    ratio = mulShift(ratio, '0xfcbe86c7900a88aedcffc83b479aa3a4');
  }
  if ((absTick & 0x200) !== 0) {
    ratio = mulShift(ratio, '0xf987a7253ac413176f2b074cf7815e54');
  }
  if ((absTick & 0x400) !== 0) {
    ratio = mulShift(ratio, '0xf3392b0822b70005940c7a398e4b70f3');
  }
  if ((absTick & 0x800) !== 0) {
    ratio = mulShift(ratio, '0xe7159475a2c29b7443b29c7fa6e889d9');
  }
  if ((absTick & 0x1000) !== 0) {
    ratio = mulShift(ratio, '0xd097f3bdfd2022b8845ad8f792aa5825');
  }
  if ((absTick & 0x2000) !== 0) {
    ratio = mulShift(ratio, '0xa9f746462d870fdf8a65dc1f90e061e5');
  }
  if ((absTick & 0x4000) !== 0) {
    ratio = mulShift(ratio, '0x70d869a156d2a1b890bb3df62baf32f7');
  }
  if ((absTick & 0x8000) !== 0) {
    ratio = mulShift(ratio, '0x31be135f97d08fd981231505542fcfa6');
  }
  if ((absTick & 0x10000) !== 0) {
    ratio = mulShift(ratio, '0x9aa508b5b7a84e1c677de54f3e99bc9');
  }
  if ((absTick & 0x20000) !== 0) {
    ratio = mulShift(ratio, '0x5d6af8dedb81196699c329225ee604');
  }
  if ((absTick & 0x40000) !== 0) {
    ratio = mulShift(ratio, '0x2216e584f5fa1ea926041bedfe98');
  }
  if ((absTick & 0x80000) !== 0) {
    ratio = mulShift(ratio, '0x48a170391f7dc42444e8fa2');
  }

  if (tick > 0) {
    ratio = JSBI.divide(MaxUint256, ratio);
  }

  // back to Q96
  const result = JSBI.greaterThan(JSBI.remainder(ratio, Q32), ZERO)
    ? JSBI.add(JSBI.divide(ratio, Q32), ONE)
    : JSBI.divide(ratio, Q32);

  return result;
}

const addLiquidityV3CalcAmount = (params) => {
  const {
    amountIn,
    price,
    priceHigh,
    priceLow
  } = params

  const sqrtPrice = new BigNumber(price).sqrt()
  const sqrtPriceHigh = new BigNumber(priceHigh).sqrt()
  const sqrtPriceLow = new BigNumber(priceLow).sqrt()

  const L = new BigNumber(amountIn).multipliedBy(sqrtPrice).multipliedBy(sqrtPriceHigh).dividedBy(sqrtPriceHigh.minus(sqrtPrice))
  const amountOut = L.multipliedBy(sqrtPrice.minus(sqrtPriceLow))

  return amountOut
}

const getTokenAmountsV3 = (params) => {
  const { liquidity, sqrtPriceX96, tickLow, tickHigh, Decimal0,Decimal1 } = params

  let sqrtRatioA = Math.sqrt(1.0001**tickLow);
  let sqrtRatioB = Math.sqrt(1.0001**tickHigh);

  let currentTick = getTickAtSqrtRatio(sqrtPriceX96)
  let sqrtPrice = new BigNumber(sqrtPriceX96).dividedBy(new BigNumber(2).exponentiatedBy(96))

  let amount0wei = 0;
  let amount1wei = 0;
  
  let rangeType = 0
  if(currentTick <= tickLow){
    // amount0wei = Math.floor(liquidity*((sqrtRatioB-sqrtRatioA)/(sqrtRatioA*sqrtRatioB)));
    rangeType = 0
    amount0wei = Math.floor(
      new BigNumber(liquidity).multipliedBy(
        (
          new BigNumber(sqrtRatioB).minus(sqrtRatioA)
        ).dividedBy(
          new BigNumber(sqrtRatioA).multipliedBy(sqrtRatioB)
        )
      ).toNumber()
    )
  } else if(currentTick > tickHigh){
    // amount1wei = Math.floor(liquidity*(sqrtRatioB-sqrtRatioA));
    rangeType = 1
    amount1wei = Math.floor(
      new BigNumber(liquidity).multipliedBy(
        new BigNumber(sqrtRatioB).minus(sqrtRatioA)
      ).toNumber()
    )
  } else if(currentTick >= tickLow && currentTick < tickHigh){ 
    // amount0wei = Math.floor(liquidity*((sqrtRatioB-sqrtPrice)/(sqrtPrice*sqrtRatioB)));
    // amount1wei = Math.floor(liquidity*(sqrtPrice-sqrtRatioA));
    rangeType = 2
    amount0wei = Math.floor(
      new BigNumber(liquidity).multipliedBy(
        (
          new BigNumber(sqrtRatioB).minus(sqrtPrice)
        ).dividedBy(
          new BigNumber(sqrtPrice).multipliedBy(sqrtRatioB)
        )
      ).toNumber()
    )
    amount1wei = Math.floor(
      new BigNumber(liquidity).multipliedBy(
        new BigNumber(sqrtPrice).minus(sqrtRatioA)
      ).toNumber()
    )
  }
  const amount0Human = (Math.abs(amount0wei/(10**Decimal0))).toFixed(Decimal0)
  const amount1Human = (Math.abs(amount1wei/(10**Decimal1))).toFixed(Decimal1);
  return {
    amount0wei,
    amount1wei,
    amount0Human,
    amount1Human,
    rangeType,
    sqrtRatioA,
    sqrtRatioB,
  }
}

const isWrappedToken = ({ chainId, tokenAddress }) => {
  const wrappedAddress = constants.ADDRESSES.WrapperCurrency[chainId]
  return (wrappedAddress && tokenAddress.toUpperCase() == wrappedAddress.toUpperCase()) ? true : false
}

const sweepToken = async (params) => {
  const {
    baseCurrency,
    chainId,
    owner,
    tokenAddress,
    waitReceipt = false,
  } = params
  
  const mcContract = getContract({
    name: 'multicall',
    address: config?.UNISWAP_V3_CONTRACTS[chainId]?.multicall,
    baseCurrency,
  })
  
  const tokenInterface = new AbiInterface(ERC20MetadataABI)
  const tokensInfoCalls = [
    { target: tokenAddress, callData: tokenInterface.encodeFunctionData('balanceOf', [ config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager ]) }
  ]
  const tokensInfoAnswer = await mcContract?.methods.tryAggregate(false, tokensInfoCalls).call()
  const tokenAmount = tokenInterface.decodeFunctionResult('balanceOf', tokensInfoAnswer[0].returnData)[0].toString()
  const provider = actions[baseCurrency.toLowerCase()].getWeb3()

  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const positionsContract = getContract({
    name: 'position_manager_v3',
    address: positionsContractAddress,
    baseCurrency,
  })

  const positionsInterface = new AbiInterface(PositionManagerV3ABI)

  const recipient = owner

  const sweepTokenParams = [
    tokenAddress,
    tokenAmount,
    recipient
  ]
  

  const callsDataSource = [
    [ 'sweepToken', sweepTokenParams ]
  ]

  const callsData = callsDataSource.map((el) => {
    // @ts-ignore
    return positionsInterface.encodeFunctionData( el[0], el[1])
  })

  const txData = positionsContract.methods.multicall(callsData).encodeABI()
  const sendParams = {
    to: positionsContractAddress,
    data: txData,
    waitReceipt,
    amount: 0,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)
}
window.sweepToken = sweepToken

const getTokensInfoV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    token0Address,
    token1Address,
  } = params
  
  const mcContractAddress =  config?.UNISWAP_V3_CONTRACTS[chainId]?.multicall

  const mcContract = getContract({
    name: 'multicall',
    address: mcContractAddress,
    baseCurrency,
  })
  
  const erc20 = new AbiInterface(ERC20MetadataABI)

  const callsData = [
    { target: token0Address, callData: erc20.encodeFunctionData('name') },
    { target: token0Address, callData: erc20.encodeFunctionData('symbol') },
    { target: token0Address, callData: erc20.encodeFunctionData('decimals') },
    { target: token1Address, callData: erc20.encodeFunctionData('name') },
    { target: token1Address, callData: erc20.encodeFunctionData('symbol') },
    { target: token1Address, callData: erc20.encodeFunctionData('decimals') },
  ]

  const [
    token0_name,
    token0_symbol,
    token0_decimals,
    token1_name,
    token1_symbol,
    token1_decimals
  ] = await mcContract?.methods.tryAggregate(false, callsData).call()

  const decodeRaw = (func, raw, isNumber = false) => {
    if (isNumber) return new BigNumber(erc20.decodeFunctionResult(func, raw.returnData)[0].toString()).toNumber()
    return erc20.decodeFunctionResult(func, raw.returnData)[0]
  }
  const answer = {
    token0: {
      address: token0Address,
      name: decodeRaw('name', token0_name),
      symbol: decodeRaw('symbol', token0_symbol),
      decimals: decodeRaw('decimals', token0_decimals, true)
    },
    token1: {
      address: token1Address,
      name: decodeRaw('name', token1_name),
      symbol: decodeRaw('symbol', token1_symbol),
      decimals: decodeRaw('decimals', token1_decimals, true)
    }
  }
  return answer
}

const getBalanceAndAllowanceV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    owner,
    token0Address,
    token1Address,
  } = params
  
  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const mcContractAddress =  config?.UNISWAP_V3_CONTRACTS[chainId]?.multicall

  const mcContract = getContract({
    name: 'multicall',
    address: mcContractAddress,
    baseCurrency,
  })
  
  const erc20 = new AbiInterface(ERC20MetadataABI)
  const mcInterface = new AbiInterface(MulticallABI)

  const isWrappedToken0 = isWrappedToken({ chainId, tokenAddress: token0Address })
  const isWrappedToken1 = isWrappedToken({ chainId, tokenAddress: token1Address })

  const callsData = [
    ...(isWrappedToken0) ? [
      { target: mcContractAddress, callData: mcInterface.encodeFunctionData('getEthBalance', [owner]) },
      { target: mcContractAddress, callData: mcInterface.encodeFunctionData('getEthBalance', [owner]) },
    ] : [
      { target: token0Address, callData: erc20.encodeFunctionData('balanceOf', [owner]) },
      { target: token0Address, callData: erc20.encodeFunctionData('allowance', [owner, positionsContractAddress]) }
    ],
    ...(isWrappedToken1) ? [
      { target: mcContractAddress, callData: mcInterface.encodeFunctionData('getEthBalance', [owner]) },
      { target: mcContractAddress, callData: mcInterface.encodeFunctionData('getEthBalance', [owner]) },
    ] : [
      { target: token1Address, callData: erc20.encodeFunctionData('balanceOf', [owner]) },
      { target: token1Address, callData: erc20.encodeFunctionData('allowance', [owner, positionsContractAddress]) }
    ],
  ]

  const rawAnswer = await mcContract?.methods.tryAggregate(false, callsData).call()

  const answer = {
    token0: {
      balance: (
        (isWrappedToken0)
        ? new BigNumber(mcInterface.decodeFunctionResult('getEthBalance', rawAnswer[0].returnData)[0].toString()).toNumber()
        : new BigNumber(erc20.decodeFunctionResult('balanceOf', rawAnswer[0].returnData)[0].toString()).toNumber()
      ),
      allowance: (
        (isWrappedToken0)
        ? new BigNumber(mcInterface.decodeFunctionResult('getEthBalance', rawAnswer[1].returnData)[0].toString()).toNumber()
        : new BigNumber(erc20.decodeFunctionResult('allowance', rawAnswer[1].returnData)[0].toString()).toNumber()
      ),
    },
    token1: {
      balance: (
        (isWrappedToken0)
        ? new BigNumber(mcInterface.decodeFunctionResult('getEthBalance', rawAnswer[2].returnData)[0].toString()).toNumber()
        : new BigNumber(erc20.decodeFunctionResult('balanceOf', rawAnswer[2].returnData)[0].toString()).toNumber()
      ),
      allowance: (
        (isWrappedToken0)
        ? new BigNumber(mcInterface.decodeFunctionResult('getEthBalance', rawAnswer[3].returnData)[0].toString()).toNumber()
        : new BigNumber(erc20.decodeFunctionResult('allowance', rawAnswer[3].returnData)[0].toString()).toNumber()
      ),
    }
  }
  
  return answer
}

const approveTokenV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    tokenAddress,
    amountWei,
    waitReceipt = false,
  } = params

  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const tokenContract = getContract({
    name: 'erc20',
    address: tokenAddress,
    baseCurrency,
  })
  
  const txData = tokenContract.methods.approve(
    positionsContractAddress,
    `0x`+ new BigNumber(amountWei).toString(16)
  ).encodeABI()

  const sendParams = {
    to: tokenAddress,
    data: txData,
    waitReceipt,
    amount: 0,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)
}

const addLiquidityV3 = async (params) => {
  const {
    chainId,
    baseCurrency,
    amount0Wei,
    amount1Wei,
    position,
    position: {
      tokenId,
      token0,
      token1,
    },
    deadlinePeriod = 20, /* 20 min */
    slippage = 0.5,
    waitReceipt = false,
  } = params

  const amount0Min = amount0Wei.isGreaterThan(0) ? getMinSpippageAmount(amount0Wei, slippage) : amount0Wei
  const amount1Min = amount1Wei.isGreaterThan(0) ? getMinSpippageAmount(amount1Wei, slippage) : amount1Wei

  const isWrappedToken0 = isWrappedToken({ chainId, tokenAddress: token0.address })
  const isWrappedToken1 = isWrappedToken({ chainId, tokenAddress: token1.address })

  const nativeWei = (isWrappedToken0 || isWrappedToken1)
    ? ((isWrappedToken0) ? amount0Wei : amount1Wei)
    : 0

  const provider = actions[baseCurrency.toLowerCase()].getWeb3()

  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const positionsContract = getContract({
    name: 'position_manager_v3',
    address: positionsContractAddress,
    baseCurrency,
  })

  const positionsInterface = new AbiInterface(PositionManagerV3ABI)
  
  const deadline = await getDeadline(provider, deadlinePeriod * 60)
  /*
  console.log('>>> amount 0', amount0Wei.toString())
  console.log('>>> amount 1', amount1Wei.toString())
  console.log('>>> min 0', amount0Min.toString())
  console.log('>>> min 1', amount1Min.toString())
  console.log('>>> nativeWei', nativeWei.toString())
  console.log('>>> params', params)
  */
  
  const callsData = [
    positionsInterface.encodeFunctionData('increaseLiquidity', [[
      tokenId,                              // params.tokenId	        uint256
      `0x`+new BigNumber(amount0Wei.toFixed(0)).toString(16),         // params.amount0Desired  uint256
      `0x`+new BigNumber(amount1Wei.toFixed(0)).toString(16),         // params.amount1Desired  uint256
      `0x`+new BigNumber(amount0Min.toFixed(0)).toString(16),         // params.amount0Min      uint256
      `0x`+new BigNumber(amount1Min.toFixed(0)).toString(16),         // params.amount1Min      uint256
      deadline                              // params.deadline        uint256
    ]]),
    ...(isWrappedToken0 || isWrappedToken1) ? [
      positionsInterface.encodeFunctionData('refundETH')
    ] : []
  ]

  const txData = positionsContract.methods.multicall(callsData).encodeABI()
  const sendParams = {
    to: positionsContractAddress,
    data: txData,
    waitReceipt,
    amount: `0x`+new BigNumber(nativeWei.toFixed(0)).toString(16),
    amountInWei: true,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)

}

const removeLiquidityV3 = async (params) => {
  const {
    baseCurrency,
    chainId,
    owner,
    position,
    position: {
      tokenId,
      token0,
      token1,
      liquidity,
    },
    percents,
    unwrap = true,
    waitReceipt = false,
    slippage = 0.5,
    deadlinePeriod = 20,
  } = params
  
  const provider = actions[baseCurrency.toLowerCase()].getWeb3()

  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const positionsContract = getContract({
    name: 'position_manager_v3',
    address: positionsContractAddress,
    baseCurrency,
  })

  const positionsInterface = new AbiInterface(PositionManagerV3ABI)

  const delLiquidity = new BigNumber(liquidity).dividedBy(100).multipliedBy(percents).toFixed(0)
  const token0Amount = getMinSpippageAmount(new BigNumber(token0.amountWei).dividedBy(100).multipliedBy(percents), slippage).toFixed()
  const token1Amount = getMinSpippageAmount(new BigNumber(token1.amountWei).dividedBy(100).multipliedBy(percents), slippage).toFixed()

  const recipient = owner
  const deadline = await getDeadline(provider, deadlinePeriod * 60)
  const decreaseLiquidityParams = [
    tokenId,
    delLiquidity,
    token0Amount,
    token1Amount,
    deadline
  ]

  const hasWrappedToken = isWrappedToken({ chainId, tokenAddress: token0.address }) || isWrappedToken({ chainId, tokenAddress: token1.address })

  const sweepToken0Params = [
    token0.address,
    token0Amount,
    recipient
  ]
  const sweepToken1Params = [
    token1.address,
    token1Amount,
    recipient
  ]

  const collectParams = [
    tokenId,
    (unwrap && hasWrappedToken) ? constants.ADDRESSES.ZERO_ADDRESS : recipient,
    '340282366920938463463374607431768211455', // max bigint
    '340282366920938463463374607431768211455', // max bigint
  ]
  const unwrapToken0Params = [
    token0Amount,
    recipient
  ]
  const unwrapToken1Params = [
    token1Amount,
    recipient
  ]

  const callsDataSource = [
    [ 'decreaseLiquidity', [decreaseLiquidityParams] ],

    [ 'collect', [collectParams] ],

    ...(isWrappedToken({ chainId, tokenAddress: token0.address }) && unwrap) ? [
      [ 'unwrapWETH9', unwrapToken0Params ]
    ] : [],
    ...(isWrappedToken({ chainId, tokenAddress: token1.address }) && unwrap) ? [
      [ 'unwrapWETH9', unwrapToken1Params ]
    ] : [],
    
    ...(isWrappedToken({ chainId, tokenAddress: token0.address }) && unwrap) ? [
      [ 'sweepToken', sweepToken1Params ]
    ] : [],
    ...(isWrappedToken({ chainId, tokenAddress: token1.address }) && unwrap) ? [
      [ 'sweepToken', sweepToken0Params ]
    ] : [],
  ]

  const callsData = callsDataSource.map((el) => {
    // @ts-ignore
    return positionsInterface.encodeFunctionData( el[0], el[1])
  })

  const txData = positionsContract.methods.multicall(callsData).encodeABI()
  const sendParams = {
    to: positionsContractAddress,
    data: txData,
    waitReceipt,
    amount: 0,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)
}

// fromToken 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270
// toToken 0xD10b8A62764852C754f66ebA75556F63938E9026
const getUserLiquidityPositionsV3 = async (params) => {
  const {
    owner,
    baseCurrency,
    chainId,
    fromToken,
    toToken,
  } = params


  const positionsContractAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.position_manager
  const positionsContract = getContract({
    name: 'position_manager_v3',
    address: positionsContractAddress,
    baseCurrency,
  })

  const positionsInterface = new AbiInterface(PositionManagerV3ABI)

  // get count of user positions
  const positionsCount = await positionsContract.methods.balanceOf(owner).call()

  // get user positions ids
  const tokenIdsCallArgs = (Array.apply(null, Array(Number(positionsCount)))).map((_, index) => {
    return positionsInterface.encodeFunctionData('tokenOfOwnerByIndex', [owner, index])
  })

  const tokenIdsAnswer = await positionsContract.methods.multicall(tokenIdsCallArgs).call()

  const userPositionsIds = tokenIdsAnswer.map((answer) => {
    return positionsInterface.decodeFunctionResult('tokenOfOwnerByIndex', answer).toString()
  })
  // fetch positions detail information
  const positionsInfoCallArgs = userPositionsIds.map((positionId) => {
    return positionsInterface.encodeFunctionData('positions', [positionId])
  })
  const positionsInfoAnswer = await positionsContract.methods.multicall(positionsInfoCallArgs).call()

  const positionsInfo = positionsInfoAnswer.map((answer, i) => {
    const result = positionsInterface.decodeFunctionResult('positions', answer)
    return {
      tokenId: userPositionsIds[i],
      fee: result.fee,
      feeGrowthInside0LastX128: result.feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: result.feeGrowthInside1LastX128.toString(),
      liquidity: result.liquidity.toString(),
      nonce: result.nonce.toString(),
      operator: result.operator,
      tickLower: result.tickLower,
      tickUpper: result.tickUpper,
      token0: result.token0,
      token1: result.token1,
      tokensOwed0: result.tokensOwed0.toString(),
      tokensOwed1: result.tokensOwed1.toString(),
    }
  })
  if (fromToken && toToken) {
    return positionsInfo.filter((positionInfo) => {
      return (
        ((fromToken.toLowerCase() == positionInfo.token0.toLowerCase()) && (toToken.toLowerCase() == positionInfo.token1.toLowerCase()))
        ||
        ((fromToken.toLowerCase() == positionInfo.token1.toLowerCase()) && (toToken.toLowerCase() == positionInfo.token0.toLowerCase()))
      )
    })
  } else return positionsInfo
}

window.getUserLiquidityPositionsV3 = getUserLiquidityPositionsV3

const swapCallbackV3 = async (params) => {
  
  const {
    baseCurrency,
    chainId,
    owner,
    fromToken,
    fromTokenDecimals,
    toToken,
    toTokenDecimals,
    deadlinePeriod,
    slippage,
    sellAmount,
    buyAmount,
    waitReceipt = false,
    isNative = false,
    fromNative = false,
    toNative = false,
    fee = 10000,
  } = params

  try {
    const routerAddress = config?.UNISWAP_V3_CONTRACTS[chainId]?.router
    const provider = actions[baseCurrency.toLowerCase()].getWeb3()
    
    const routerContract = getContract({
      name: 'router_v3',
      address: routerAddress,
      baseCurrency,
    })

    const tokenIn = wrapCurrency(chainId, fromToken)
    const tokenOut = wrapCurrency(chainId, toToken)

    const recipient = owner
    const deadline = await getDeadline(provider, deadlinePeriod)
    
    const weiSellAmount = utils.amount.formatWithDecimals(sellAmount, fromTokenDecimals)
    const weiBuyAmount = utils.amount.formatWithDecimals(buyAmount, toTokenDecimals)
    const buySlilppageRange = getSlippageRange(slippage, weiBuyAmount)

    // the minimum amount of the purchased asset to be received
    const intOutMin = getMinAmount(weiBuyAmount, buySlilppageRange)
    const amountOutMinimum = utils.amount.toHexNumber(intOutMin)
    const amountIn = weiSellAmount
    
    const sqrtPriceLimitX96 = 0
    
    const callParams = [
      tokenIn,
      tokenOut,
      fee,
      recipient,
      deadline,
      amountIn,
      amountOutMinimum,
      sqrtPriceLimitX96,
    ]

    if (isNative) {
      // Свап с использованием нативных коинов
      if (fromNative) {
        // Swap Native to ERC20-like
        const txData = routerContract.methods.exactInputSingle(callParams).encodeABI()

        const sendParams = {
          to: routerAddress,
          data: txData,
          waitReceipt,
          amount: (fromNative) ? sellAmount : 0,
        }
        return actions[baseCurrency.toLowerCase()].send(sendParams)
      } else {
         // ERC20-like to Native - use multicall
         /*
          Меняем токен на врап-токен - получатель это роутер
          делаем инврап нативного токена
         */
         const callParams = [
          tokenIn,
          tokenOut,
          fee,
          routerAddress, // Шаг №1 - Токен меняем на врап - получатель это роутер
          deadline,
          amountIn,
          amountOutMinimum,
          sqrtPriceLimitX96,
        ]

        const routerAbiInterface = new AbiInterface(SwapRouterV3ABI)
        const callsData = [
          // swap to wrapped
          routerAbiInterface.encodeFunctionData('exactInputSingle', [callParams]),
          // unwrap to native
          routerAbiInterface.encodeFunctionData('unwrapWETH9', [amountOutMinimum, recipient])
        ]
        const txData = routerContract.methods.multicall(callsData).encodeABI()
        const sendParams = {
          to: routerAddress,
          data: txData,
          waitReceipt,
          amount: 0,
        }
        return actions[baseCurrency.toLowerCase()].send(sendParams)
      }
    } else {
      
      const txData = routerContract.methods.exactInputSingle(callParams).encodeABI()

      return actions[baseCurrency.toLowerCase()].send({
        to: routerAddress,
        data: txData,
        waitReceipt,
        amount: 0,
      })
    }
  } catch (error) {
    return error
  }
}

const swapCallback = async (params) => {
  const {
    routerAddress,
    baseCurrency,
    owner,
    fromToken,
    fromTokenDecimals,
    toToken,
    toTokenDecimals,
    deadlinePeriod,
    slippage,
    sellAmount,
    buyAmount,
    waitReceipt = false,
    useFeeOnTransfer,
  } = params

  try {
    const provider = actions[baseCurrency.toLowerCase()].getWeb3()
    const router = getContract({ name: 'router', address: routerAddress, baseCurrency })
    const method = returnSwapMethod({ fromToken, toToken, useFeeOnTransfer })
    const swapData = await returnSwapDataByMethod({
      chainId: actions[baseCurrency.toLowerCase()].chainId,
      slippage,
      provider,
      method,
      fromToken,
      fromTokenDecimals,
      toToken,
      toTokenDecimals,
      owner,
      deadlinePeriod,
      sellAmount,
      buyAmount,
    })

    const txData = router.methods[method](...swapData.args).encodeABI()
    
    const sendParams = {
      to: routerAddress,
      data: txData,
      waitReceipt,
      amount: swapData.value ?? 0,
    }
    return actions[baseCurrency.toLowerCase()].send(sendParams)
  } catch (error) {
    return error
  }
}

const returnAddLiquidityData = async (params) => {
  const {
    provider,
    slippage,
    tokenA,
    tokenADecimals,
    amountADesired,
    tokenB,
    tokenBDecimals,
    amountBDesired,
    owner,
    deadlinePeriod,
  } = params
  const lowerTokenA = tokenA.toLowerCase()
  const lowerTokenB = tokenB.toLowerCase()
  let method: string
  let args: (string | number)[]
  let value: number = 0

  if (
    lowerTokenA === constants.ADDRESSES.EVM_COIN_ADDRESS &&
    lowerTokenB === constants.ADDRESSES.EVM_COIN_ADDRESS
  ) {
    throw new Error('Two native coins')
  }

  const { formatWithDecimals, toHexNumber } = utils.amount
  const deadline = await getDeadline(provider, deadlinePeriod)
  const unitAmountADesired = formatWithDecimals(amountADesired, tokenADecimals)
  const unitAmountBDesired = formatWithDecimals(amountBDesired, tokenBDecimals)

  const amountASlippageRange = getSlippageRange(
    slippage,
    formatWithDecimals(amountADesired, tokenADecimals)
  )
  const amountBSlippageRange = getSlippageRange(
    slippage,
    formatWithDecimals(amountBDesired, tokenBDecimals)
  )

  const amountAMin = getMinAmount(unitAmountADesired, amountASlippageRange)
  const amountBMin = getMinAmount(unitAmountBDesired, amountBSlippageRange)
  const hexAmountADesired = toHexNumber(unitAmountADesired)
  const hexAmountBDesired = toHexNumber(unitAmountBDesired)
  const hexAmountAMin = toHexNumber(amountAMin)
  const hexAmountBMin = toHexNumber(amountBMin)

  if (
    lowerTokenA === constants.ADDRESSES.EVM_COIN_ADDRESS ||
    lowerTokenB === constants.ADDRESSES.EVM_COIN_ADDRESS
  ) {
    const tokenAIsNative = lowerTokenA === constants.ADDRESSES.EVM_COIN_ADDRESS

    method = LiquidityMethods.addLiquidityETH
    value = tokenAIsNative ? amountADesired : amountBDesired
    args = [
      tokenAIsNative ? tokenB : tokenA,
      tokenAIsNative ? hexAmountBDesired : hexAmountADesired,
      tokenAIsNative ? hexAmountBMin : hexAmountAMin,
      tokenAIsNative ? hexAmountAMin : hexAmountBMin,
      owner,
      deadline,
    ]
  } else {
    method = LiquidityMethods.addLiquidity
    args = [
      tokenA,
      tokenB,
      hexAmountADesired,
      hexAmountBDesired,
      hexAmountBMin,
      hexAmountBMin,
      owner,
      deadline,
    ]
  }

  return {
    method,
    args,
    value,
  }
}

const addLiquidityCallback = async (params) => {
  const {
    routerAddress,
    baseCurrency,
    waitReceipt = false,
    tokenA,
    tokenADecimals,
    amountADesired,
    tokenB,
    tokenBDecimals,
    amountBDesired,
    owner,
    deadlinePeriod,
  } = params
  let { slippage } = params

  const provider = actions[baseCurrency.toLowerCase()].getWeb3()
  const { method, args, value } = await returnAddLiquidityData({
    provider,
    tokenA,
    tokenADecimals,
    amountADesired,
    slippage,
    tokenB,
    tokenBDecimals,
    amountBDesired,
    owner,
    deadlinePeriod,
  })
  const router = getContract({ name: 'router', address: routerAddress, baseCurrency })
  const txData = router.methods[method](...args).encodeABI()

  try {
    const hexValue = new BigNumber(value).multipliedBy(10 ** 18).toString(16)
    const gasLimit = await router.methods[method](...args).estimateGas({
      from: owner,
      value: `0x${hexValue}`,
    })
    const additionGasMultiplier = 1.1

    return actions[baseCurrency.toLowerCase()].send({
      to: routerAddress,
      data: txData,
      waitReceipt,
      amount: value,
      gasLimit: new BigNumber(gasLimit).multipliedBy(additionGasMultiplier).toFixed(0) || 0,
    })
  } catch (error) {
    console.group('%c add liquidity', 'color: red')
    console.error(error)
    console.groupEnd()
    return false
  }
}

const nativeCoinWrapper = async (params) => {
  const {
    baseCurrency,
    chainId,
    amount,
    isWrap = false,
    calcFee = false,
    waitReceipt = false,
  } = params

  const wrappedAddress = constants.ADDRESSES.WrapperCurrency[chainId]

  const contract = getContract({ name: 'wrapped', address: wrappedAddress, baseCurrency })

  const amountWei = `0x` + new BigNumber(amount).multipliedBy(10 ** 18).toString(16)

  const txData = (isWrap)
    ? contract.methods.deposit().encodeABI()
    : contract.methods.withdraw(amountWei).encodeABI()

  const sendParams = {
    to: wrappedAddress,
    data: txData,
    waitReceipt,
    amount: (isWrap) ? amountWei : 0,
    amountInWei: true,
    estimateGas: calcFee,
  }

  return actions[baseCurrency.toLowerCase()].send(sendParams)
}


export default {
  getContract,
  getPairAddress,
  getAmountOut,
  getLiquidityAmountForAssetB,
  swapCallback,
  addLiquidityCallback,
  
  // v3
  calcPriceV3,
  getPoolAddressV3,
  getPoolAddressV3All,
  getAmountOutV3,
  swapCallbackV3,
  getUserPoolLiquidityV3,
  removeLiquidityV3,
  approveTokenV3,
  addLiquidityV3,
  addLiquidityV3CalcAmount,
  mintPositionV3,

  wrapCurrency,
  isWrappedToken,
  getBalanceAndAllowanceV3,
  getTokensInfoV3,
  getPriceRoundedToTick,
  priceToSqrtPriceX96,
  calculateSqrtPriceX96,
  getTickAtSqrtRatio,
  
  nativeCoinWrapper,
}
