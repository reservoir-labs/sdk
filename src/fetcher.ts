import { Contract } from '@ethersproject/contracts'
import { getNetwork } from '@ethersproject/networks'
import { getDefaultProvider } from '@ethersproject/providers'
import { SupportedChainId, Token, CurrencyAmount } from '@uniswap/sdk-core'
import { Pair } from './entities/pair'
import IUniswapV2Pair from '@uniswap/v2-core/build/IUniswapV2Pair.json'
import invariant from 'tiny-invariant'
import { FACTORY_ADDRESS } from './constants'

let TOKEN_DECIMALS_CACHE: { [chainId: number]: { [address: string]: number } } = {
  [SupportedChainId.MAINNET]: {
    '0xE0B7927c4aF23765Cb51314A0E0521A9645F0E2A': 9 // DGD
  }
}

// TODO: import these abis as npm package dependencies
const ERC20_ABI = [
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    payable: false,
    stateMutability: 'view',
    type: 'function'
  }
]

const FACTORY_ABI = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'aOwner',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'constructor'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'bytes32',
        name: 'codeId',
        type: 'bytes32'
      },
      {
        indexed: false,
        internalType: 'address',
        name: '_address',
        type: 'address'
      }
    ],
    name: 'Deployed',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'user',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'OwnerUpdated',
    type: 'event'
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'token0',
        type: 'address'
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'token1',
        type: 'address'
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'curveId',
        type: 'uint256'
      },
      {
        indexed: false,
        internalType: 'address',
        name: 'pair',
        type: 'address'
      }
    ],
    name: 'PairCreated',
    type: 'event'
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    name: '_curves',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'aInitCode',
        type: 'bytes'
      }
    ],
    name: 'addBytecode',
    outputs: [
      {
        internalType: 'bytes32',
        name: 'rCodeKey',
        type: 'bytes32'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes',
        name: 'aInitCode',
        type: 'bytes'
      }
    ],
    name: 'addCurve',
    outputs: [
      {
        internalType: 'uint256',
        name: 'rCurveId',
        type: 'uint256'
      },
      {
        internalType: 'bytes32',
        name: 'rCodeKey',
        type: 'bytes32'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'allPairs',
    outputs: [
      {
        internalType: 'address[]',
        name: '',
        type: 'address[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'aTokenA',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'aTokenB',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: 'aCurveId',
        type: 'uint256'
      }
    ],
    name: 'createPair',
    outputs: [
      {
        internalType: 'address',
        name: 'rPair',
        type: 'address'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [],
    name: 'curves',
    outputs: [
      {
        internalType: 'bytes32[]',
        name: '',
        type: 'bytes32[]'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'aCodeKey',
        type: 'bytes32'
      },
      {
        internalType: 'address',
        name: 'aToken0',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'aToken1',
        type: 'address'
      }
    ],
    name: 'deploy',
    outputs: [
      {
        internalType: 'address',
        name: 'rContract',
        type: 'address'
      }
    ],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
      }
    ],
    name: 'get',
    outputs: [
      {
        internalType: 'bytes32',
        name: '',
        type: 'bytes32'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'aCodeKey',
        type: 'bytes32'
      },
      {
        internalType: 'address',
        name: 'aToken0',
        type: 'address'
      },
      {
        internalType: 'address',
        name: 'aToken1',
        type: 'address'
      }
    ],
    name: 'getBytecode',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'address',
        name: '',
        type: 'address'
      },
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256'
      }
    ],
    name: 'getPair',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address'
      }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'aTarget',
        type: 'address'
      },
      {
        internalType: 'bytes',
        name: 'aCalldata',
        type: 'bytes'
      },
      {
        internalType: 'uint256',
        name: 'aValue',
        type: 'uint256'
      }
    ],
    name: 'rawCall',
    outputs: [
      {
        internalType: 'bytes',
        name: '',
        type: 'bytes'
      }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'bytes32',
        name: 'aKey',
        type: 'bytes32'
      },
      {
        internalType: 'bytes32',
        name: 'aValue',
        type: 'bytes32'
      }
    ],
    name: 'set',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'newOwner',
        type: 'address'
      }
    ],
    name: 'setOwner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
]

/**
 * Contains methods for constructing instances of pairs and tokens from on-chain data.
 */
export abstract class Fetcher {
  /**
   * Cannot be constructed.
   */
  private constructor() {}

  public static async fetchAllPairs(
    chainId: SupportedChainId,
    provider = getDefaultProvider(getNetwork(chainId))
  ): Promise<string[]> {
    const pairs: string[] = await new Contract(FACTORY_ADDRESS, FACTORY_ABI, provider).allPairs()

    console.log(pairs)

    return pairs
  }

  /**
   * Fetch information for a given token on the given chain, using the given ethers provider.
   * @param chainId chain of the token
   * @param address address of the token on the chain
   * @param provider provider used to fetch the token
   * @param symbol optional symbol of the token
   * @param name optional name of the token
   */
  public static async fetchTokenData(
    chainId: SupportedChainId,
    address: string,
    provider = getDefaultProvider(getNetwork(chainId)),
    symbol?: string,
    name?: string
  ): Promise<Token> {
    const parsedDecimals =
      typeof TOKEN_DECIMALS_CACHE?.[chainId]?.[address] === 'number'
        ? TOKEN_DECIMALS_CACHE[chainId][address]
        : await new Contract(address, ERC20_ABI, provider).decimals().then((decimals: number): number => {
            TOKEN_DECIMALS_CACHE = {
              ...TOKEN_DECIMALS_CACHE,
              [chainId]: {
                ...TOKEN_DECIMALS_CACHE?.[chainId],
                [address]: decimals
              }
            }
            return decimals
          })
    return new Token(chainId, address, parsedDecimals, symbol, name)
  }

  /**
   * Fetches information about a pair and constructs a pair from the given two tokens.
   * @param tokenA first token
   * @param tokenB second token
   * @param provider the provider to use to fetch the data
   */
  public static async fetchPairData(
    tokenA: Token,
    tokenB: Token,
    provider = getDefaultProvider(getNetwork(tokenA.chainId))
  ): Promise<Pair> {
    invariant(tokenA.chainId === tokenB.chainId, 'CHAIN_ID')
    const address = Pair.getAddress(tokenA, tokenB)
    const [reserves0, reserves1] = await new Contract(address, IUniswapV2Pair.abi, provider).getReserves()
    const balances = tokenA.sortsBefore(tokenB) ? [reserves0, reserves1] : [reserves1, reserves0]
    return new Pair(
      CurrencyAmount.fromRawAmount(tokenA, balances[0]),
      CurrencyAmount.fromRawAmount(tokenB, balances[1])
    )
  }
}
