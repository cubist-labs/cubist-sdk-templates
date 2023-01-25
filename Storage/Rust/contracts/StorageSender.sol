// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import './StorageReceiver.sol';

contract StorageSender {

    StorageReceiver receiver;
    uint256 number;

    constructor (uint256 num, StorageReceiver addr) {
      number = num;
      receiver = addr;
    }

    function store(uint256 num) public {
        number = num;
        receiver.store(number);
    }

    function inc(uint256 num) public {
        number += num;
        receiver.store(number);
    }

    function dec(uint256 num) public {
      if (number >= num) {
        number -= num;
      } else {
        number = 0;
      }
      receiver.store(number);
    }

    function retrieve() public view returns (uint256){
      return number;
    }
}