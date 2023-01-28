// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

contract Scaffold is Script {
    function run() external {
        bytes memory lCode = address(0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7).code;

        console.log("length", lCode.length);
    }
}
