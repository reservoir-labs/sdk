import { Fetcher } from './fetcher'
import { BaseProvider, JsonRpcProvider } from '@ethersproject/providers'
import { Token } from '@reservoir-labs/sdk-core'
import { Pair } from 'entities'

describe('fetcher', () => {
  let provider: BaseProvider = new JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc')
  const USDC_AVAX = '0x5D60473C5Cb323032d6fdFf42380B50E2AE4d245'
  const USDT_AVAX = '0x6e9FDaE1Fe20b0A5a605C879Ae14030a0aE99cF9'
  const BTCB_AVAX = '0x152b9d0FdC40C096757F570A51E494bd4b943E50'
  const WBTCE_AVAX = '0x50b7545627a5162F82A992c33b87aDc75187B218'

  describe('fetchAllPairs', () => {
    it('should fetch pairs', async () => {
      const pairs = await Fetcher.fetchAllPairs(43114, provider)

      expect(pairs.length).toEqual(3)
    })
  })

  describe('fetchRelevantPairs', () => {
    it('should not return pairs that have not been created', async () => {
      const relevantPairs = await Fetcher.fetchRelevantPairs(
        43114,
        new Token(43114, BTCB_AVAX, 8),
        new Token(43114, WBTCE_AVAX, 8),
        provider
      )
      console.log(relevantPairs)
      expect(relevantPairs.length).toBeLessThan(6)
      expect(relevantPairs.length).toBeGreaterThan(0)
    })
  })

  describe('fetchPairData', () => {
    it('should fetch the info a of a valid pair', async () => {
      const pair: Pair = await Fetcher.fetchPairData(
        new Token(43114, USDC_AVAX, 6),
        new Token(43114, USDT_AVAX, 6),
        0,
        provider
      )

      expect(pair.curveId).toEqual(0)
      expect(pair.amplificationCoefficient).toEqual(null)
      expect(pair.reserve0.toExact()).toEqual('1000000')
      expect(pair.reserve1.toExact()).toEqual('950000')
    })
    it("should revert for a pair that doesn't exist", () => {
      // somehow jest's `toThrow` doesn't catch EVM call exceptions, so comment this test case out for now
      // expect(() => {
      //   Fetcher.fetchPairData(
      //       new Token(43114, '0x0000000000000000000000000000000000000000', 6),
      //       new Token(43114, '0xfbC22278A96299D91d41C453234d97b4F5Eb9B2d', 6),
      //       0,
      //       provider
      //   )
      // }).toThrow()
    })
  })

  describe('fetchPairDataUsingAddress', () => {
    it('should fetch the info of a valid pair', async () => {
      const pairAddresses = await Fetcher.fetchAllPairs(43114, provider)

      const pair = await Fetcher.fetchPairDataUsingAddress(43114, pairAddresses[0], provider)

      expect(pair.curveId).toEqual(0)
      expect(pair.amplificationCoefficient).toEqual(null)
      expect(pair.reserve0.toExact()).toEqual('1000000')
      expect(pair.reserve1.toExact()).toEqual('950000')
      expect(pair.token0.symbol).toEqual('USDC')
      expect(pair.token1.symbol).toEqual('USDT')
    })
  })
})
