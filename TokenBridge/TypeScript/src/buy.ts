import {
  CubistORM,
  ERC20Bridged,
} from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

import {
  AccountAddress,
  BigNumber,
} from '@cubist-labs/cubist';

// Project instance
const cubist = new CubistORM();

const ERC20Bridged = cubist.ERC20Bridged;
const e20bProject = ERC20Bridged.project;
const TokenSender = cubist.TokenSender;
const tsProject = TokenSender.project;

/** Transfer from native (wei) tokens on ethereum to FFB tokens on polygon.
 * @param {AccountAddress} receivingAccount - The address on polygon to send tokens to.
 * @param {BigNumber} amount - Number of tokens to send. */
export async function sendToERC20Bridged(receivingAccount: AccountAddress, amount: BigNumber): Promise<void> {
  // Default address on chain TokenSender is running on (Ethereum)
  const sendingAccount = await tsProject.getSignerAddress();

  // Get the deployed contracts
  const tokenSender = await TokenSender.deployed();
  const erc20Bridged = await ERC20Bridged.deployed();

  // of the amount we charge a 0.1% fee
  const fee = amount.div(1000n);

  console.log(`Transferring ${amount.sub(fee)} wei
    from ${sendingAccount}
    to ${receivingAccount}
    @ 0.1% fee (${fee} wei)...`);
  const originalReceiverBalance = await erc20Bridged.inner.balanceOf(receivingAccount);
  // send the tokens
  await (await tokenSender.inner.bridgeSend(receivingAccount, { value: amount })).wait();
  console.log('Waiting until tokens arrive...');
  while (true) {
    const newReceiverBalance = await erc20Bridged.inner.balanceOf(receivingAccount);
    // if the new balance is = old balance + amount - fee, we're done
    // This is not what we would do for real since you can have concurrent
    // transfers instead you would want to associate a transfer id of sorts
    // with each transfer to get transactional semantics.
    if (originalReceiverBalance.add(amount.sub(fee)).eq(newReceiverBalance)) {
      console.log(`Received tokens! New balance: ${newReceiverBalance} fbb`);
      break;
    }
    await sleep(1000);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error(`Usage: buy <val> <account-index|address>`);
    console.error(`  where val: WEI amount to spend (to buy FBB tokens at 0.1% fee)`);
    console.error(`  where account-index: 0, ..., ${(await e20bProject.accounts()).length - 1}`);
    console.error(`  where address: 0x...`);
    process.exit(1);
  }
  const amount = BigNumber.from(process.argv[2]);
  const address = await parseAccountOrAddress(process.argv[3]);
  sendToERC20Bridged(address, amount).catch(console.error);;
}

// Parse argument as an account index (on chain ERC20Bridged is deployed) or accept an address
async function parseAccountOrAddress(accountOrAddress: string): Promise<AccountAddress> {
  if (accountOrAddress.startsWith('0x')) {
    return accountOrAddress;
  }
  const index = parseInt(accountOrAddress);
  const accounts = await e20bProject.accounts();
  if (index < 0 || index >= accounts.length) {
    throw new Error(`Invalid account or address: ${accountOrAddress}`);
  }
  return accounts[index];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
