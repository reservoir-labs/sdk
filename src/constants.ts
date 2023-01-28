import JSBI from 'jsbi'

// TODO: update this with the standardized CREATE2 address that will be the same across all chains
// Currently it only works for the wallet derived from anvil's private key
export const FACTORY_ADDRESS = '0x678D933b69E83da05a54286E4b05b9f76Cd06e2c'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)
export const FEE_ACCURACY = JSBI.BigInt(1_000_000) // 100%

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
