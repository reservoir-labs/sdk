import { Fetcher } from './fetcher'
import { WETH9 as _WETH9 } from '@reservoir-labs/sdk-core/dist/entities/weth9'
import { Contract, ContractFactory } from '@ethersproject/contracts'
import GenericFactory from './abis/GenericFactory.json'
import { BaseProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'
import { WebSocketProvider } from '@ethersproject/providers'

describe('fetcher', () => {
  // const ADDRESSES = [
  //   '0x0000000000000000000000000000000000000001',
  //   '0x0000000000000000000000000000000000000002',
  //   '0x0000000000000000000000000000000000000003'
  // ]
  //
  // // this is the chainID for AVAX C-chain
  // const CHAIN_ID = 43114
  //
  // const WETH9 = _WETH9[43114]

  let factory: Contract
  let provider: BaseProvider
  let wallet: Wallet

  beforeAll(async () => {
    provider = new WebSocketProvider('ws://127.0.0.1:8545')
    // private key from anvil
    wallet = new Wallet('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', provider)
    const cf = new ContractFactory(GenericFactory.abi, GenericFactory.bytecode, wallet)
    factory = await cf.deploy(wallet.address)

    console.log('factory address', factory.address)
  })

  it('should fetch pairs', async () => {
    const pairs = await Fetcher.fetchAllPairs(43114, provider)
    console.log('pairs', pairs)
  })
})
