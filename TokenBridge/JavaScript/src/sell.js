import { CubistORM, } from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

import {
  BigNumber,
} from '@cubist-labs/cubist';

// Project instance
const cubist = new CubistORM();

const ERC20Bridged = cubist.ERC20Bridged;
const e20bProject = ERC20Bridged.project;
const TokenSender = cubist.TokenSender;
const tsProject = TokenSender.project;

/** Transfer tokens from FBB (on polygon) to wei (on ethereum).
 * @param {AccountAddress} receivingAccount - The address on ethereum to send
 * amount (minus fees) FBB tokens to.
 * @param {BigNumber} amount - Number of tokens (minus 0.1% fee) to send. */
export async function sendFromERC20Bridged(receivingAccount, amount) {
  // Default address on chain ERC20Bridged is running on (Polygon)
  const sendingAccount = await e20bProject.getSignerAddress();

  // Get the deployed contracts
  const erc20Bridged = await ERC20Bridged.deployed();

  // Make sure the sender has enough tokens for the transfer
  const senderBalance = await erc20Bridged.inner.balanceOf(sendingAccount);
  if (!senderBalance.gte(amount)) {
    throw new Error(`Sender ${sendingAccount} doesn't have enough FBBs!`);
  }
  console.log(`Transferring ${amount} fbb
    from ${sendingAccount}
    to ${receivingAccount}...`);
  const originalReceiverBalance = await tsProject.getBalance(receivingAccount);
  // send the tokens
  await (await erc20Bridged.inner.bridgeSend(receivingAccount, amount)).wait();
  console.log('Waiting until tokens arrive...');
  while (true) {
    if (receivingAccount === await tsProject.getSignerAddress()) {
      console.log('The receiver is the default signer used by the relayer, check balance manually!');
      break;
    }
    const newReceiverBalance = await tsProject.getBalance(receivingAccount);
    console.log(`receiver balance = ${newReceiverBalance}`)
    // if the new balance is = old balance + amount, we're done
    // This is not what we would do for real since you can have concurrent
    // transfers instead you would want to associate a transfer id of sorts
    // with each transfer to get transactional semantics.
    console.log(`Received = ${newReceiverBalance.sub(originalReceiverBalance)}`);
    if (originalReceiverBalance.add(amount).eq(newReceiverBalance)) {
      console.log(`Received tokens! New balance: ${newReceiverBalance} wei`);
      break;
    }
    await sleep(1000);
  }

}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error('Usage: sendFromERC20Bridged <account-index|address> <val>');
    console.error(`  where account-index: 0, ..., ${(await tsProject.accounts()).length - 1}`);
    console.error(`  where address: 0x...`);
    console.error(`  where val: number of tokens to send`);
    process.exit(1);
  }
  const amount = BigNumber.from(process.argv[2]);
  const address = await parseAccountOrAddress(process.argv[3]);
  sendFromERC20Bridged(address, amount).catch(console.error);;
}

// Parse argument as an account index (on chain ERC20Bridged is deployed) or accept an address
async function parseAccountOrAddress(accountOrAddress) {
  if (accountOrAddress.startsWith('0x')) {
    return accountOrAddress;
  }
  const index = parseInt(accountOrAddress);
  const accounts = await tsProject.accounts();
  if (index < 0 || index >= accounts.length) {
    throw new Error(`Invalid account or address: ${accountOrAddress}`);
  }
  return accounts[index];
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
