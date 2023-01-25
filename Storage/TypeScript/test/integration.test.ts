import { expect, } from 'chai';
import { TestDK, } from '@cubist-labs/cubist';
import { CubistORM, } from '../build/orm';

jest.setTimeout(60000);

const testdk = new TestDK<CubistORM>(CubistORM, { tmp_deploy_dir: true });
const cubist = testdk.cubist;

beforeAll(async () => {
  await testdk.startService();
});

afterAll(async () => {
  await testdk.stopService();
});


describe('deploy and test', () => {
  it('deploys and updates values cross-chain', async () => {
    const val = 55;
    const receiver = await cubist.StorageReceiver.deploy(val);
    const senderTarget = cubist.StorageSender.target();
    const sender = await cubist.StorageSender.deploy(val, receiver.addressOn(senderTarget));
    
    // wait for the bridge to be established before calling any cross-chain contract methods
    expect(await cubist.whenBridged()).is.true;
    
    // check values
    expect((await sender.inner.retrieve()).eq(val)).is.true;
    expect((await receiver.inner.retrieve()).eq(val)).is.true;
    
    // increment counter
    expect(await (await sender.inner.inc(33)).wait(/* confirmations: */ 1)).to.not.throw;
    
    // check values
    expect((await sender.inner.retrieve()).eq(val + 33)).is.true;
    await tryAFewTimes(async () => {
      expect((await receiver.inner.retrieve()).eq(val + 33)).is.true;
    });

    // decrement counter
    expect(await (await sender.inner.dec(34)).wait(/* confirmations: */ 1)).to.not.throw;
    
    // check values
    expect((await sender.inner.retrieve()).eq(val - 1)).is.true;
    await tryAFewTimes(async () => {
      expect((await receiver.inner.retrieve()).eq(val - 1)).is.true;
    });
    
    // set counter
    expect(await (await sender.inner.store(val)).wait(/* confirmations: */ 1)).to.not.throw;
    
    // check values
    expect((await sender.inner.retrieve()).eq(val)).is.true;
    await tryAFewTimes(async () => {
      expect((await receiver.inner.retrieve()).eq(val)).is.true;
    });
  });
});

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function tryAFewTimes(fn: () => Promise<void>) {
  for (let i = 0; i < 5; i++) {
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
