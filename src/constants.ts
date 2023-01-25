import JSBI from 'jsbi'

// TODO: update this with the standardized CREATE2 address that will be the same across all chains
// Currently it only works for the wallet derived from anvil's private key
export const FACTORY_ADDRESS = '0x2b0d36facd61b71cc05ab8f3d2355ec3631c0dd5'

export const MINIMUM_LIQUIDITY = JSBI.BigInt(1000)

// exports for internal consumption
export const ZERO = JSBI.BigInt(0)
export const ONE = JSBI.BigInt(1)
export const FIVE = JSBI.BigInt(5)
export const _997 = JSBI.BigInt(997)
export const _1000 = JSBI.BigInt(1000)
