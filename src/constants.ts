import JSBI from 'jsbi'
import { SupportedChainId } from '@reservoir-labs/sdk-core'

export const FACTORY_ADDRESS = {
  // this is deployed using the ReservoirDeployer
  [SupportedChainId.ARBITRUM]: '0x89D235b4A770CB09ee976dF814266226A23A9315',
  [SupportedChainId.ARBITRUM_SEPOLIA]: '0x89D235b4A770CB09ee976dF814266226A23A9315',
  [SupportedChainId.AVALANCHE]: '0x1A49Bc8464731A08c16EdF17F33CF77db37228a4'
}

export const ROUTER_ADDRESS = {
  [SupportedChainId.ARBITRUM]: '0x84baf4228D31595370BDCD02ad2d9467Ba1cADAf',
  [SupportedChainId.ARBITRUM_SEPOLIA]: '0x0E177118dC36B78D9cc7F018d82090208601e467',
  [SupportedChainId.AVALANCHE]: '0xe80B7cdC7b0ac8A6F6AbD16096DCE8E1510aB20d'
}
export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)
export const FEE_ACCURACY = JSBI.BigInt(1_000_000) // 100%

export const A_PRECISION = JSBI.BigInt(100)

export const DEFAULT_AMPLIFICATION_COEFFICIENT_PRECISE = JSBI.multiply(JSBI.BigInt(1000), A_PRECISION) // 1000 with 100 of precision

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
