import { expect, } from 'chai';
import { TestDK, BigNumber, } from '@cubist-labs/cubist';
import { CubistORM, } from '../build/orm';
import { jest, } from '@jest/globals'

jest.setTimeout(120000);

const testdk = new TestDK(CubistORM, { tmp_deploy_dir: true });
const cubist = testdk.cubist;
const ERC20Bridged = cubist.ERC20Bridged;
const e20bProject = ERC20Bridged.project;
const TokenSender = cubist.TokenSender;
const tsProject = TokenSender.project;


beforeAll(async () => {
  await testdk.startService();
});

afterAll(async () => {
  await testdk.stopService();
});


describe('deploy and test', () => {
  it('deploys and transfer tokens cross-chain', async () => {

    console.log('Deploying!');
    // Break the circular dependency between ERC20Bridged and TokenSender by first
    // deploying ERC20Bridged shims only, then passing that address to TokenSender,
    // then finally deploying ERC20Bridged with TokenSender's address.
    const erc20bShims = await ERC20Bridged.deployShims();
    expect(erc20bShims.size).to.eq(1);
    expect(erc20bShims.has(TokenSender.target())).is.true;
    // get the shim contract on the token sender chain
    const erc20BridgedShim = erc20bShims.get(TokenSender.target());

    // deploy the token sender contract and its shim
    const tokenSender = await TokenSender.deploy(erc20BridgedShim.address);

    // Deploy ERC20Bridged with the TokenSender address. We already deployed
    // all the shim, so we're going to call `deployWithShims` to add the native
    // ERC20Bridged contract to the shim's permitted callers.
    const erc20Bridged = await ERC20Bridged.deployWithShims(erc20bShims,
          "FooBarBaz", "FBB", tokenSender.addressOn(ERC20Bridged.target()));

    // wait for bridge
    expect(await cubist.whenBridged()).is.true;

    // send tokens to account[0] on polygon
    const amount = BigNumber.from(2000000000000n);
    const fee = amount.div(1000n);
    const e20bAccount0 = {
      address: (await e20bProject.accounts())[0],
      originalBalance: await erc20Bridged.inner.balanceOf((await e20bProject.accounts())[0])
    };
    await (await tokenSender.inner.bridgeSend(e20bAccount0.address, { value: amount })).wait();

    // TokenSigner holds the tokens on the ethereum side
    expect(amount.eq(await tsProject.getBalance(tokenSender.address())));

    // This is the actual amount once we subtract the fee
    const actualAmount = amount.sub(fee);

    // make sure the tokens are received on the polygon side
    await tryAFewTimes(15, async () => {
      const balance = await erc20Bridged.inner.balanceOf(e20bAccount0.address);
      expect(balance.eq(e20bAccount0.originalBalance.add(actualAmount))).is.true;
    });

    // Use ERC20 to transfer half the tokens to account[1]
    const e20bAccount1 = {
      address: (await e20bProject.accounts())[1],
      originalBalance: await erc20Bridged.inner.balanceOf((await e20bProject.accounts())[1])
    };
    await (await erc20Bridged.inner.transfer(e20bAccount1.address, actualAmount.div(2))).wait();
    {
      // check account[0] balance
      const balance0 = await erc20Bridged.inner.balanceOf(e20bAccount0.address);
      expect(balance0.eq(e20bAccount0.originalBalance.add(actualAmount.div(2)))).is.true;
      // check account[1] balance
      const balance1 = await erc20Bridged.inner.balanceOf(e20bAccount1.address);
      expect(balance1.eq(e20bAccount1.originalBalance.add(actualAmount.div(2)))).is.true;
    }

    // send FBB tokens to account[1] on ethereum
    const tsAccount1 = {
      address: (await tsProject.accounts())[1],
      originalBalance: await tsProject.getBalance((await tsProject.accounts())[1]),
    };

    // update balance of account[0] (this is the default signer we use)
    e20bAccount0.originalBalance = await erc20Bridged.inner.balanceOf(e20bAccount0.address);
    // send all tokens
    await (await erc20Bridged.inner.bridgeSend(tsAccount1.address, e20bAccount0.originalBalance)).wait();
    expect((await erc20Bridged.inner.balanceOf(e20bAccount0.address)).eq(0)).is.true;

    // make sure the tokens are received on the ethereum side
    await tryAFewTimes(15, async () => {
      const balance = await tsProject.getBalance(tsAccount1.address);
      expect(balance.eq(tsAccount1.originalBalance.add(actualAmount.div(2)))).is.true;
    });

    // make sure TokenSigner's balance = amount - actualAmount/2 (the amount we transfer to account[1])
    expect((amount.sub(actualAmount.div(2))).eq(await tsProject.getBalance(tokenSender.address())));

  });
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryAFewTimes(nr, fn) {
  for (let i = 0; i < nr; i++) {
    try {
      await fn();
      return;
    } catch (e) {
      await sleep(1000);
    }
  }
  // try one last time, and throw error if it fails
  try {
    await fn();
  } catch (e) {
    throw new Error(`Failed after 5 attempts: ${e}`);
  }
}
