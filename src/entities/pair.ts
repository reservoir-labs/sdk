import { BigintIsh, Price, sqrt, Token, CurrencyAmount } from '@reservoir-labs/sdk-core'
import invariant from 'tiny-invariant'
import JSBI from 'jsbi'
import { keccak256, pack } from '@ethersproject/solidity'
import { getCreate2Address } from '@ethersproject/address'
import { HashZero } from '@ethersproject/constants'
import {
  FACTORY_ADDRESS,
  MINIMUM_LIQUIDITY,
  FIVE,
  FEE_ACCURACY,
  ONE,
  ZERO,
  DEFAULT_AMPLIFICATION_COEFFICIENT_PRECISE,
} from '../constants'
import { InsufficientReservesError, InsufficientInputAmountError } from '../errors'
import ConstantProductPair from '../abis/ConstantProductPair.json'
import StablePair from '../abis/StablePair.json'
import { defaultAbiCoder } from '@ethersproject/abi'
import { calcInGivenOut, calcOutGivenIn, calculateInvariant } from '../lib/stableMath'
import { decimal } from '../lib/numbers'

export const computePairAddress = ({
  factoryAddress,
  tokenA,
  tokenB,
  curveId,
}: {
  factoryAddress: string
  tokenA: Token
  tokenB: Token
  curveId: number
}): string => {
  const [token0, token1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA] // does safety checks

  let initCode: any

  switch (curveId) {
    case 0:
      initCode = ConstantProductPair.bytecode.object
      break
    case 1:
      initCode = StablePair.bytecode.object
      break
  }

  const encodedTokenAddresses = defaultAbiCoder.encode(['address', 'address'], [token0.address, token1.address])
  const initCodeWithTokens = pack(['bytes', 'bytes'], [initCode, encodedTokenAddresses])

  // N.B: we do not use a salt as the initCode is unique with token0 and token1 appended to it
  return getCreate2Address(factoryAddress, pack(['bytes32'], [HashZero]), keccak256(['bytes'], [initCodeWithTokens]))
}
export class Pair {
  public readonly liquidityToken: Token
  private readonly tokenAmounts: [CurrencyAmount<Token>, CurrencyAmount<Token>]

  public readonly curveId: number

  // TODO: does the frontend dev need to know about the platformFee as well?
  // not necessary for the swap function, but for the misc info about yield yes
  public readonly swapFee: JSBI

  // null for ConstantProductPair, non-zero for StablePair
  // stored with A_PRECISION
  public readonly amplificationCoefficient: JSBI | null

  public static getAddress(tokenA: Token, tokenB: Token, curveId: number): string {
    // it is assumed that the chainId of tokenA is on one of the supported chains. Else it will throw
    // I would write an invariant to assert this but I don't know how to write it elegantly at the moment
    // so using this ts-ignore for now
    // @ts-ignore
    return computePairAddress({ factoryAddress: FACTORY_ADDRESS[tokenA.chainId], tokenA, tokenB, curveId })
  }

  public constructor(
    currencyAmountA: CurrencyAmount<Token>,
    tokenAmountB: CurrencyAmount<Token>,
    curveId: number,
    swapFee: JSBI = JSBI.BigInt(3000),
    amplificationCoefficient: JSBI | null = null
  ) {
    invariant(curveId == 0 || curveId == 1, 'INVALID_CURVE_ID')
    const tokenAmounts = currencyAmountA.currency.sortsBefore(tokenAmountB.currency) // does safety checks
      ? [currencyAmountA, tokenAmountB]
      : [tokenAmountB, currencyAmountA]
    this.liquidityToken = new Token(
      tokenAmounts[0].currency.chainId,
      Pair.getAddress(tokenAmounts[0].currency, tokenAmounts[1].currency, curveId),
      18,
      'RES-LP',
      'Reservoir LP Token'
    )
    this.tokenAmounts = tokenAmounts as [CurrencyAmount<Token>, CurrencyAmount<Token>]
    this.curveId = curveId
    this.swapFee = swapFee
    this.amplificationCoefficient = amplificationCoefficient
  }

  /**
   * Returns true if the token is either token0 or token1
   * @param token to check
   */
  public involvesToken(token: Token): boolean {
    return token.equals(this.token0) || token.equals(this.token1)
  }

  /**
   * Returns the current mid price of the pair in terms of token0, i.e. the ratio of reserve1 to reserve0
   */
  // TODO: refactor this to take into account stable curve?
  public get token0Price(): Price<Token, Token> {
    const result = this.tokenAmounts[1].divide(this.tokenAmounts[0])
    return new Price(this.token0, this.token1, result.denominator, result.numerator)
  }

  /**
   * Returns the current mid price of the pair in terms of token1, i.e. the ratio of reserve0 to reserve1
   */
  // TODO: refactor this to take into account stable curve?
  public get token1Price(): Price<Token, Token> {
    const result = this.tokenAmounts[0].divide(this.tokenAmounts[1])
    return new Price(this.token1, this.token0, result.denominator, result.numerator)
  }

  /**
   * Returns the quote token's liq expressed in terms of the base token's liq
   * @param token base token
   */
  public liqRatio(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0)
      ? new Price(this.token0, this.token1, this.tokenAmounts[0].quotient, this.tokenAmounts[1].quotient)
      : new Price(this.token1, this.token0, this.tokenAmounts[1].quotient, this.tokenAmounts[0].quotient)
  }

  /**
   * Return the price of the given token in terms of the other token in the pair.
   * @param token token to return price of
   */
  public priceOf(token: Token): Price<Token, Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.token0Price : this.token1Price
  }

  /**
   * Returns the chain ID of the tokens in the pair.
   */
  public get chainId(): number {
    return this.token0.chainId
  }

  public get token0(): Token {
    return this.tokenAmounts[0].currency
  }

  public get token1(): Token {
    return this.tokenAmounts[1].currency
  }

  public get reserve0(): CurrencyAmount<Token> {
    return this.tokenAmounts[0]
  }

  public get reserve1(): CurrencyAmount<Token> {
    return this.tokenAmounts[1]
  }

  public reserveOf(token: Token): CurrencyAmount<Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    return token.equals(this.token0) ? this.reserve0 : this.reserve1
  }

  public getOutputAmount(inputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(inputAmount.currency), 'TOKEN')
    if (JSBI.equal(this.reserve0.quotient, ZERO) || JSBI.equal(this.reserve1.quotient, ZERO)) {
      throw new InsufficientReservesError()
    }
    const inputReserve = this.reserveOf(inputAmount.currency)
    const outputReserve = this.reserveOf(inputAmount.currency.equals(this.token0) ? this.token1 : this.token0)
    let outputAmount

    if (this.curveId == 0) {
      const inputAmountWithFee = JSBI.multiply(inputAmount.quotient, JSBI.subtract(FEE_ACCURACY, this.swapFee))
      const numerator = JSBI.multiply(inputAmountWithFee, outputReserve.quotient)
      const denominator = JSBI.add(JSBI.multiply(inputReserve.quotient, FEE_ACCURACY), inputAmountWithFee)
      outputAmount = CurrencyAmount.fromRawAmount(
        inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
        JSBI.divide(numerator, denominator)
      )
      if (JSBI.equal(outputAmount.quotient, ZERO)) {
        throw new InsufficientInputAmountError()
      }
    } else if (this.curveId == 1) {
      invariant(this.amplificationCoefficient != null)
      const feeDeductedAmountIn = inputAmount.multiply(JSBI.subtract(FEE_ACCURACY, this.swapFee)).divide(FEE_ACCURACY)

      outputAmount = calcOutGivenIn(
        inputReserve.toExact(),
        outputReserve.toExact(),
        this.amplificationCoefficient.toString(),
        feeDeductedAmountIn.toExact()
      )
      outputAmount = outputAmount.mul(decimal(10).pow(outputReserve.currency.decimals)).toDP(0)

      outputAmount = CurrencyAmount.fromRawAmount(
        inputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
        JSBI.BigInt(outputAmount.toString())
      )
    }

    // @ts-ignore
    return [outputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount), this.curveId)]
  }

  public getInputAmount(outputAmount: CurrencyAmount<Token>): [CurrencyAmount<Token>, Pair] {
    invariant(this.involvesToken(outputAmount.currency), 'TOKEN')
    if (
      JSBI.equal(this.reserve0.quotient, ZERO) ||
      JSBI.equal(this.reserve1.quotient, ZERO) ||
      JSBI.greaterThanOrEqual(outputAmount.quotient, this.reserveOf(outputAmount.currency).quotient)
    ) {
      throw new InsufficientReservesError()
    }

    let outputReserve = this.reserveOf(outputAmount.currency)
    let inputReserve = this.reserveOf(outputAmount.currency.equals(this.token0) ? this.token1 : this.token0)
    let inputAmount

    if (this.curveId == 0) {
      const numerator = JSBI.multiply(JSBI.multiply(inputReserve.quotient, outputAmount.quotient), FEE_ACCURACY)
      const denominator = JSBI.multiply(
        JSBI.subtract(outputReserve.quotient, outputAmount.quotient),
        JSBI.subtract(FEE_ACCURACY, this.swapFee)
      )
      inputAmount = CurrencyAmount.fromRawAmount(
        outputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
        JSBI.add(JSBI.divide(numerator, denominator), ONE)
      )
    } else if (this.curveId == 1) {
      invariant(this.amplificationCoefficient != null)

      inputAmount = calcInGivenOut(
        inputReserve.toExact(),
        outputReserve.toExact(),
        this.amplificationCoefficient.toString(),
        outputAmount.toExact()
      )

      // normalize amount from 18 decimals into the correct decimals for the token again
      // `toDP` is used to chop off the digits after the decimal point
      inputAmount = inputAmount.mul(decimal(10).pow(inputReserve.currency.decimals)).toDP(0)
      inputAmount = CurrencyAmount.fromRawAmount(
        outputAmount.currency.equals(this.token0) ? this.token1 : this.token0,
        JSBI.BigInt(inputAmount.toString())
      )
        .multiply(JSBI.add(FEE_ACCURACY, this.swapFee)) // add fee
        .divide(FEE_ACCURACY)
    }

    // @ts-ignore
    return [inputAmount, new Pair(inputReserve.add(inputAmount), outputReserve.subtract(outputAmount), this.curveId)]
  }

  // normalizes all amounts to 18 decimals so that they can be used in the StablePair convergence algorithm
  // private _scaleAmounts(amounts: CurrencyAmount<Token>[]): JSBI[] {
  //   return amounts.map(amount => {
  //     return JSBI.multiply(
  //       JSBI.BigInt(amount.quotient),
  //       JSBI.exponentiate(JSBI.BigInt(10), JSBI.BigInt(18 - amount.currency.decimals))
  //     )
  //   })
  // }

  // TODO: the math for the stable case is still slightly (0.0001% off), to investigate why
  public getLiquidityMinted(
    totalSupply: CurrencyAmount<Token>,
    tokenAmountA: CurrencyAmount<Token>,
    tokenAmountB: CurrencyAmount<Token>
  ): CurrencyAmount<Token> {
    invariant(totalSupply.currency.equals(this.liquidityToken), 'LIQUIDITY')
    const tokenAmounts = tokenAmountA.currency.sortsBefore(tokenAmountB.currency) // does safety checks
      ? [tokenAmountA, tokenAmountB]
      : [tokenAmountB, tokenAmountA]
    invariant(tokenAmounts[0].currency.equals(this.token0) && tokenAmounts[1].currency.equals(this.token1), 'TOKEN')
    invariant(this.curveId === 0 || this.curveId === 1)

    let liquidity: JSBI

    if (this.curveId === 0) {
      if (JSBI.equal(totalSupply.quotient, ZERO)) {
        liquidity = JSBI.subtract(
          sqrt(JSBI.multiply(tokenAmounts[0].quotient, tokenAmounts[1].quotient)),
          MINIMUM_LIQUIDITY
        )
      } else {
        const amount0 = JSBI.divide(
          JSBI.multiply(tokenAmounts[0].quotient, totalSupply.quotient),
          this.reserve0.quotient
        )
        const amount1 = JSBI.divide(
          JSBI.multiply(tokenAmounts[1].quotient, totalSupply.quotient),
          this.reserve1.quotient
        )
        liquidity = JSBI.lessThanOrEqual(amount0, amount1) ? amount0 : amount1
      }
      if (!JSBI.greaterThan(liquidity, ZERO)) {
        throw new InsufficientInputAmountError()
      }
    }
    // stable case
    else {
      if (JSBI.equal(totalSupply.quotient, ZERO)) {
        // calculate initial stable liq
        const newLiq = calculateInvariant(
          tokenAmounts[0].toExact(),
          tokenAmounts[1].toExact(),
          DEFAULT_AMPLIFICATION_COEFFICIENT_PRECISE.toString() // might want to read this from the factory
        )
        liquidity = JSBI.subtract(JSBI.BigInt(newLiq), MINIMUM_LIQUIDITY)
      } else {
        invariant(this.amplificationCoefficient !== null)

        const oldLiq = JSBI.BigInt(
          calculateInvariant(
            this.tokenAmounts[0].toExact(),
            this.tokenAmounts[1].toExact(),
            this.amplificationCoefficient.toString()
          ).toString()
        )

        const newLiq = JSBI.BigInt(
          calculateInvariant(
            this.tokenAmounts[0].add(tokenAmounts[0]).toExact(),
            this.tokenAmounts[1].add(tokenAmounts[1]).toExact(),
            this.amplificationCoefficient.toString()
          ).toString()
        )

        liquidity = JSBI.divide(JSBI.multiply(JSBI.subtract(newLiq, oldLiq), totalSupply.quotient), oldLiq)
      }
      if (!JSBI.greaterThan(liquidity, ZERO)) {
        throw new InsufficientInputAmountError()
      }
    }
    return CurrencyAmount.fromRawAmount(this.liquidityToken, liquidity)
  }

  // TODO: to take into account the two types of platformFee calculations for the two curves
  public getLiquidityValue(
    token: Token,
    totalSupply: CurrencyAmount<Token>,
    liquidity: CurrencyAmount<Token>,
    feeOn: boolean = false,
    kLast?: BigintIsh
  ): CurrencyAmount<Token> {
    invariant(this.involvesToken(token), 'TOKEN')
    invariant(totalSupply.currency.equals(this.liquidityToken), 'TOTAL_SUPPLY')
    invariant(liquidity.currency.equals(this.liquidityToken), 'LIQUIDITY')
    invariant(JSBI.lessThanOrEqual(liquidity.quotient, totalSupply.quotient), 'LIQUIDITY')

    let totalSupplyAdjusted: CurrencyAmount<Token>
    if (!feeOn) {
      totalSupplyAdjusted = totalSupply
    } else {
      invariant(!!kLast, 'K_LAST')
      const kLastParsed = JSBI.BigInt(kLast)
      if (!JSBI.equal(kLastParsed, ZERO)) {
        const rootK = sqrt(JSBI.multiply(this.reserve0.quotient, this.reserve1.quotient))
        const rootKLast = sqrt(kLastParsed)
        if (JSBI.greaterThan(rootK, rootKLast)) {
          const numerator = JSBI.multiply(totalSupply.quotient, JSBI.subtract(rootK, rootKLast))
          const denominator = JSBI.add(JSBI.multiply(rootK, FIVE), rootKLast)
          const feeLiquidity = JSBI.divide(numerator, denominator)
          totalSupplyAdjusted = totalSupply.add(CurrencyAmount.fromRawAmount(this.liquidityToken, feeLiquidity))
        } else {
          totalSupplyAdjusted = totalSupply
        }
      } else {
        totalSupplyAdjusted = totalSupply
      }
    }

    return CurrencyAmount.fromRawAmount(
      token,
      JSBI.divide(JSBI.multiply(liquidity.quotient, this.reserveOf(token).quotient), totalSupplyAdjusted.quotient)
    )
  }
}
