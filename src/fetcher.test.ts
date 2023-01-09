import { Fetcher } from './fetcher'
import {WETH9 as _WETH9} from "@uniswap/sdk-core/dist/entities/weth9";
import { Contract, ContractFactory } from "@ethersproject/contracts";
import { FACTORY_ABI, FACTORY_BYTECODE } from "./abis/GenericFactory";
import { Provider} from "@ethersproject/providers";
import { Wallet } from "@ethersproject/wallet";
import {WebSocketProvider} from "@ethersproject/providers";

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
  let provider: Provider
  let wallet: Wallet

  beforeAll(async () => {

    provider = new WebSocketProvider("ws://127.0.0.1:8545")
    // private key from anvil
    wallet = new Wallet("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", provider)
    const cf = new ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, wallet)
    factory = await cf.deploy(wallet.address)

    console.log(factory.address)
  })

  it('should fetch pairs', async () => {
    const pairs = await Fetcher.fetchAllPairs(1)
    console.log(pairs)
  })
})
