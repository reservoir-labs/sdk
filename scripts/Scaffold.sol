// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

import { GenericFactory } from "lib/v3-core/src/GenericFactory.sol";

import { Create2Lib } from "lib/v3-core/src/libraries/Create2Lib.sol";

//import "lib/v3-core/scripts/BaseScript.sol";

//import { FactoryStoreLib } from "lib/v3-core/src/libraries/FactoryStore.sol";
import { ConstantProductPair } from "lib/v3-core/src/curve/constant-product/ConstantProductPair.sol";
import { StableMintBurn } from "lib/v3-core/src/curve/stable/StableMintBurn.sol";
import { StablePair } from "lib/v3-core/src/curve/stable/StablePair.sol";

uint256 constant INITIAL_MINT_AMOUNT = 100e18;
uint256 constant DEFAULT_SWAP_FEE_CP = 3000; // 0.3%
uint256 constant DEFAULT_SWAP_FEE_SP = 100; // 0.01%
uint256 constant DEFAULT_PLATFORM_FEE = 250_000; // 25%
uint256 constant DEFAULT_AMP_COEFF = 1000;
uint256 constant DEFAULT_MAX_CHANGE_RATE = 0.0005e18;

contract Scaffold is Script {
    bytes private _factoryCode = vm.getCode("lib/v3-core/out/GenericFactory.sol/GenericFactory.json");

    GenericFactory internal _factory;

    function _setup() internal {
        _factory = GenericFactory(
            Create2Lib.computeAddress(
                CREATE2_FACTORY,
                abi.encodePacked(type(GenericFactory).creationCode, abi.encode(msg.sender)),
                bytes32(uint256(0))
            )
        );

        if (address(_factory).code.length == 0) {
            vm.broadcast();
            GenericFactory lFactory = new GenericFactory{salt: bytes32(uint256(0))}(msg.sender);

            require(lFactory == _factory, "Create2 Address Mismatch");
        }
    }

    function main() external {
        _setup();


    }
}
