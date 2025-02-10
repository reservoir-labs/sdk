import invariant from 'tiny-invariant'
import {
  Token,
  Currency,
  CurrencyAmount,
  Percent,
  TradeType,
  validateAndParseAddress,
  SupportedChainId,
} from '@reservoir-labs/sdk-core'
import { Pair, Trade } from './entities'
import { Multicall } from './multicall'
import { Payments } from './payments'
import JSBI from 'jsbi'
import { Interface } from '@ethersproject/abi'
import IReservoirRouter from './abis/IReservoirRouter.json'
import { ROUTER_ADDRESS } from './constants'
import { calculateSlippageAmount } from './utils/math'
import { PermitOptions, SelfPermit } from './selfPermit'

/**
 * Options for producing the arguments to send call to the router.
 */
export interface TradeOptions {
  /**
   * How much the execution price is allowed to move unfavorably from the trade execution price.
   */
  allowedSlippage: Percent
  /**
   * The account that should receive the output of the swap.
   */
  recipient: string

  /**
   * Whether any of the tokens in the path are fee on transfer tokens, which should be handled with special methods
   */
  feeOnTransfer?: boolean
}

/**
 * The parameters to use in the call to the Uniswap V2 Router to execute a trade.
 */
export interface MethodParameters {
  /**
   * The arguments to pass to the method, all hex encoded.
   */
  calldata: string
  /**
   * The amount of wei to send in hex.
   */
  value: string
}

function toHex(currencyAmount: CurrencyAmount<Currency>) {
  return `0x${currencyAmount.quotient.toString(16)}`
}

const ZERO_HEX = '0x0'

/**
 * Represents the Uniswap V2 Router, and has static methods for helping execute trades.
 */
export abstract class Router {
  /**
   * Cannot be constructed.
   */
  private constructor() {}
  public static INTERFACE: Interface = new Interface(IReservoirRouter.abi)
  /**
   * Produces the on-chain method name to call and the hex encoded parameters to pass as arguments for a given trade.
   * @param trade to produce call parameters for
   * @param options options for the call parameters
   * @param permit ERC-2616 or DAI style permit signature signed by the wallet for the input token, if applicable
   */
  public static swapCallParameters(
    trade: Trade<Currency, Currency, TradeType>,
    options: TradeOptions,
    permit?: PermitOptions
  ): MethodParameters {
    const etherIn = trade.inputAmount.currency.isNative
    const etherOut = trade.outputAmount.currency.isNative
    // the router does not support both ether in and out
    invariant(!(etherIn && etherOut), 'ETHER_IN_OUT')

    const calldatas: string[] = []

    // the permit is assumed to be for the input token
    if (permit) {
      const encodedPermit = SelfPermit.encodePermit(trade.inputAmount.wrapped.currency, permit)
      calldatas.push(encodedPermit)
    }

    // assumed that the chainId is part of the SupportedChainId
    // @ts-ignore
    const to: string = etherOut ? ROUTER_ADDRESS[trade.route.chainId] : validateAndParseAddress(options.recipient)
    const amountIn: string = toHex(trade.maximumAmountIn(options.allowedSlippage))
    const amountOut: string = toHex(trade.minimumAmountOut(options.allowedSlippage))
    const path: string[] = trade.route.path.map((token: Token) => token.address)
    const curveIds: number[] = trade.route.pairs.map((pair: Pair) => pair.curveId)

    let methodName: string
    let args: (string | string[] | number[])[] | string

    const value: string = etherIn ? amountIn : ZERO_HEX

    switch (trade.tradeType) {
      case TradeType.EXACT_INPUT:
        methodName = 'swapExactForVariable'
        // uint amountIn, uint amountOutMin, address[] path, uint256[] curveIds, address to
        args = [amountIn, amountOut, path, curveIds, to]
        break

      case TradeType.EXACT_OUTPUT:
        methodName = 'swapVariableForExact'
        // uint amountOut, uint amountInMax, address[] path, uint256[] curveIds, address to
        args = [amountOut, amountIn, path, curveIds, to]
        break
    }
    const encodedSwapCall = Router.INTERFACE.encodeFunctionData(methodName, args)
    calldatas.push(encodedSwapCall)

    if (etherIn && trade.tradeType === TradeType.EXACT_OUTPUT) {
      calldatas.push(Payments.encodeRefundETH())
    }
    if (etherOut) {
      calldatas.push(Payments.encodeUnwrapWETH(JSBI.BigInt(amountOut), options.recipient))
    }

    // encodeMulticall checks if the array is larger than 1
    // so if no native tokens are involved multicall would not be used
    const calldata = Multicall.encodeMulticall(calldatas)

    // the difference between a nativeIn swap vs a wrapped native token swap is that
    // the nativeIn swap would have value attached to it, but the wrapped one would not have value
    return {
      calldata,
      value,
    }
  }

  public static addLiquidityParameters(
    tokenAmountA: CurrencyAmount<Currency>,
    tokenAmountB: CurrencyAmount<Currency>,
    curveId: number,
    options: TradeOptions,
    tokenAPermit?: PermitOptions,
    tokenBPermit?: PermitOptions
  ): MethodParameters {
    invariant(!tokenAmountA.currency.equals(tokenAmountB.currency), 'ATTEMPTING_TO_ADD_LIQ_FOR_SAME_TOKEN')
    invariant(curveId === 0 || curveId === 1, 'INVALID_CURVE_ID')
    const etherIn = tokenAmountA.currency.isNative || tokenAmountB.currency.isNative
    const calldatas: string[] = []

    if (tokenAPermit) {
      calldatas.push(SelfPermit.encodePermit(tokenAmountA.wrapped.currency, tokenAPermit))
    }
    if (tokenBPermit) {
      calldatas.push(SelfPermit.encodePermit(tokenAmountB.wrapped.currency, tokenBPermit))
    }

    const methodName = 'addLiquidity'
    const args = [
      tokenAmountA.wrapped.currency.address,
      tokenAmountB.wrapped.currency.address,
      curveId,
      tokenAmountA.quotient.toString(),
      tokenAmountB.quotient.toString(),
      calculateSlippageAmount(tokenAmountA.quotient, options.allowedSlippage).lower.toString(),
      calculateSlippageAmount(tokenAmountB.quotient, options.allowedSlippage).lower.toString(),
      validateAndParseAddress(options.recipient),
    ]
    const encodedAddLiqCall = Router.INTERFACE.encodeFunctionData(methodName, args)
    calldatas.push(encodedAddLiqCall)

    let value: string = ZERO_HEX
    if (etherIn) {
      value = tokenAmountA.currency.isNative ? tokenAmountA.quotient.toString() : tokenAmountB.quotient.toString()
      calldatas.push(Payments.encodeRefundETH())
    }

    const calldata = Multicall.encodeMulticall(calldatas)

    return {
      calldata,
      value,
    }
  }

  public static removeLiquidityParameters(
    tokenAmountA: CurrencyAmount<Currency>,
    tokenAmountB: CurrencyAmount<Currency>,
    curveId: number,
    liquidityAmount: CurrencyAmount<Token>,
    options: TradeOptions,
    liquidityTokenPermit?: PermitOptions
  ): MethodParameters {
    invariant(!tokenAmountA.currency.equals(tokenAmountB.currency), 'ATTEMPTING_TO_REMOVE_LIQ_FOR_SAME_TOKEN')
    invariant(liquidityAmount.currency.chainId in SupportedChainId, 'CHAIN_ID')
    const etherOut = tokenAmountA.currency.isNative || tokenAmountB.currency.isNative
    const validatedRecipient = validateAndParseAddress(options.recipient)
    const calldatas: string[] = []

    if (liquidityTokenPermit) {
      calldatas.push(SelfPermit.encodePermit(liquidityAmount.currency, liquidityTokenPermit))
    }

    const methodName = 'removeLiquidity'

    // we can assume that the chainId is part of the SupportedChainId, as checked in the invariant above
    // @ts-ignore
    const to: string = etherOut ? ROUTER_ADDRESS[liquidityAmount.currency.chainId] : validatedRecipient
    const tokenAMinimumAmount = calculateSlippageAmount(tokenAmountA.quotient, options.allowedSlippage).lower
    const tokenBMinimumAmount = calculateSlippageAmount(tokenAmountB.quotient, options.allowedSlippage).lower
    const args = [
      tokenAmountA.wrapped.currency.address,
      tokenAmountB.wrapped.currency.address,
      curveId,
      liquidityAmount.quotient.toString(),
      tokenAMinimumAmount.toString(),
      tokenBMinimumAmount.toString(),
      to,
    ]
    const encodedRemoveLiqCall = Router.INTERFACE.encodeFunctionData(methodName, args)
    calldatas.push(encodedRemoveLiqCall)

    if (etherOut) {
      calldatas.push(
        Payments.encodeUnwrapWETH(
          tokenAmountA.currency.isNative ? tokenAMinimumAmount : tokenBMinimumAmount,
          validatedRecipient
        )
      )
      calldatas.push(
        Payments.encodeSweepToken(
          tokenAmountA.currency.isNative ? tokenAmountB.wrapped.currency : tokenAmountA.wrapped.currency,
          tokenAmountA.currency.isNative ? tokenBMinimumAmount : tokenAMinimumAmount,
          validatedRecipient
        )
      )
    }

    const calldata = Multicall.encodeMulticall(calldatas)

    return {
      calldata,
      value: ZERO_HEX, // value will always be zero when removing liq
    }
  }
}
