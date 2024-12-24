import JSBI from 'jsbi'
import { SupportedChainId } from '@reservoir-labs/sdk-core'

export const FACTORY_ADDRESS = {
  // this is deployed using the ReservoirDeployer
  [SupportedChainId.ARBITRUM]: '',
  [SupportedChainId.ARBITRUM_SEPOLIA]: ''
}

export const ROUTER_ADDRESS = {
  [SupportedChainId.ARBITRUM]: '',
  [SupportedChainId.ARBITRUM_SEPOLIA]: ''
}
export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)
export const FEE_ACCURACY = JSBI.BigInt(1_000_000) // 100%

export const A_PRECISION = JSBI.BigInt(100)

export const DEFAULT_AMPLIFICATION_COEFFICIENT_PRECISE = JSBI.multiply(JSBI.BigInt(1000), A_PRECISION) // 1000 with 100 of precision

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
