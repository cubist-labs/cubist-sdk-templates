// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import './Receiver1.sol';
import './Receiver2.sol';

contract Channel {
    uint256 number;
    R1 r1;
    R2 r2;

    constructor (R1 addr1, R2 addr2) {
      r1 = addr1;
      r2 = addr2;
    }

    function send(uint256 num) public {
        r1.store(num);
        r2.store(num);
        number = num;
    }

    function retrieve() public view returns (uint256) {
        return number;
    }
}
