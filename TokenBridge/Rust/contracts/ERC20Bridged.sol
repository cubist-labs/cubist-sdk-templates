// SPDX-License-Identifier: MIT
// vim:syntax=javascript
pragma solidity ^0.8.0;

import "./TokenSender.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/*
 * Bridge receiver.
 *
 * This contract is the "receiving" side of a cross-chain bridge.
 * It defines an ERC20 token that is minted in response to payments
 * on the "sending" side; a user can burn these tokens via bridgeSend
 * to release native tokens from the sending side.
 */
contract ERC20Bridged is ERC20, Ownable {
    TokenSender private _bridge_sender;

    constructor(
        string memory name,
        string memory symbol,
        TokenSender sender
    ) ERC20(name, symbol) Ownable() {
        // set up the "sender" side of the bridge
        _bridge_sender = sender;
    }

    function bridgeMint(address to, uint256 amount) public onlyOwner {
        // mint functionality provided by the base ERC20 contract
        _mint(to, amount);
    }

    function bridgeSend(address to, uint256 amount) public {
        // burn functionality provided by the base ERC20 contract
        _burn(_msgSender(), amount);

        // transfer the requested amount
        _bridge_sender.bridgeReceive(to, amount);
    }
}
