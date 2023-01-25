// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

contract R1 {
    uint256 number;

    constructor () {}

    function store(uint256 num) public {
      number = num;
    }

    function retrieve() public view returns (uint256) {
        return number;
    }
}
