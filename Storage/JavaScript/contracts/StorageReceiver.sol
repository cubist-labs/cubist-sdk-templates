// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import "@openzeppelin/contracts/access/Ownable.sol";

contract StorageReceiver is Ownable {

    uint256 number;

    constructor (uint256 num) {
      number = num;
    }

    function store(uint256 num) public onlyOwner {
      number = num;
    }

    function retrieve() public view returns (uint256){
        return number;
    }
}
