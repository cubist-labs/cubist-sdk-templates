// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.16;

import './Channel.sol';

contract S1 {
    Channel channel;

    constructor (Channel addr) {
      channel = addr;
    }

    function send(uint256 num) public {
        channel.send(num);
    }
}
