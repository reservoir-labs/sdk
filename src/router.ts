import invariant from 'tiny-invariant'
import { Token, Currency, CurrencyAmount, Percent, TradeType, validateAndParseAddress } from '@reservoir-labs/sdk-core'
import { Pair, Trade } from './entities'
import { Multicall } from './multicall'
import { Payments } from './payments'
import JSBI from 'jsbi'
import {Interface} from "@ethersproject/abi";
import IReservoirRouter from './abis/IReservoirRouter.json'
import {ROUTER_ADDRESS} from "./constants";

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
export interface SwapParameters {
  /**
   * The arguments to pass to the method, all hex encoded.
   */
  calldata: (string | string[] | number[])[] | string
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
   */
  public static swapCallParameters(trade: Trade<Currency, Currency, TradeType>, options: TradeOptions): SwapParameters {
    const etherIn = trade.inputAmount.currency.isNative
    const etherOut = trade.outputAmount.currency.isNative
    // the router does not support both ether in and out
    invariant(!(etherIn && etherOut), 'ETHER_IN_OUT')

    const calldatas: string[] = []

    let to: string = etherOut ? ROUTER_ADDRESS : validateAndParseAddress(options.recipient)
    const amountIn: string = toHex(trade.maximumAmountIn(options.allowedSlippage))
    const amountOut: string = toHex(trade.minimumAmountOut(options.allowedSlippage))
    const path: string[] = trade.route.path.map((token: Token) => token.address)
    const curveIds: number[] = trade.route.pairs.map((pair: Pair) => pair.curveId)

    let methodName: string
    let args: (string | string[] | number[])[] | string

    let value: string
    if (etherIn) {
      value = amountIn
    } else {
      value = ZERO_HEX
    }

    let encodedSwapCall
    switch (trade.tradeType) {
      case TradeType.EXACT_INPUT:
        methodName = 'swapExactForVariable'
        // uint amountIn, uint amountOutMin, address[] path, uint256[] curveIds, address to
        args = [amountIn, amountOut, path, curveIds, to]
        encodedSwapCall = Router.INTERFACE.encodeFunctionData(methodName, args)
        break

      case TradeType.EXACT_OUTPUT:
        methodName = 'swapVariableForExact'
        // uint amountOut, uint amountInMax, address[] path, uint256[] curveIds, address to
        args = [amountOut, amountIn, path, curveIds, to]
        encodedSwapCall = Router.INTERFACE.encodeFunctionData(methodName, args)
        break
    }
    calldatas.push(encodedSwapCall)

    // we have to refundETH whenever the native token is an input
    if (etherIn) {
      calldatas.push(Payments.encodeRefundETH())
    }
    // unwrap ETH
    if (etherOut) {
      calldatas.push(Payments.encodeUnwrapWETH(JSBI.BigInt(amountOut), options.recipient))
    }

    // encodeMulticall checks if the array is larger than 1
    const calldata = Multicall.encodeMulticall(calldatas)
    console.log("final calldata", calldata)

    // the difference between a nativeIn swap vs a wrapped native token swap is that
    // the nativeIn swap would have value attached to it, but the wrapped one would not have value
    return {
      calldata,
      value
    }
  }

  public static addLiquidityParameters() {}

  public static removeLiquidityParameters() {}
}
