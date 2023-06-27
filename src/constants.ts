import JSBI from 'jsbi'
import { SupportedChainId } from '@reservoir-labs/sdk-core'

export const FACTORY_ADDRESS = {
  // this is deployed using the ReservoirDeployer
  [SupportedChainId.AVAX]: '0xDd723D9273642D82c5761a4467fD5265d94a22da',
  [SupportedChainId.AVAX_TESTNET]: '0xDd723D9273642D82c5761a4467fD5265d94a22da'
}

export const ROUTER_ADDRESS = {
  [SupportedChainId.AVAX]: '0x9Fc6B082DfB632bC11156f6fD2dc5F97F9B865F0',
  [SupportedChainId.AVAX_TESTNET]: '0xC7e9e9c1C9Aef23cAA4c885D7FEA876696DaC538'
}
export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)
export const FEE_ACCURACY = JSBI.BigInt(1_000_000) // 100%

export const A_PRECISION = JSBI.BigInt(100)

export const DEFAULT_AMPLIFICATION_COEFFICIENT_PRECISE = JSBI.multiply(JSBI.BigInt(1000), A_PRECISION) // 1000 with 100 of precision

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
