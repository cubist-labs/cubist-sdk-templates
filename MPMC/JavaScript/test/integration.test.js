import { expect, } from 'chai';
import { TestDK, } from '@cubist-labs/cubist';
import { CubistORM, } from '../build/orm';
import { jest, } from '@jest/globals'

jest.setTimeout(120000);

const testdk = new TestDK(CubistORM, { tmp_deploy_dir: true });
const cubist = testdk.cubist;

beforeAll(async () => {
  await testdk.startService();
});

afterAll(async () => {
  await testdk.stopService();
});

const R1 = cubist.R1;
const R2 = cubist.R2;
const Channel = cubist.Channel;
const S1 = cubist.S1;
const S2 = cubist.S2;

describe('deploy and test', () => {
  it('deploys and updates values cross-chain', async () => {

    console.log('Deploy consumers');
    const r1 = await R1.deploy();
    const r2 = await R2.deploy();
    console.log(`Deployed consumers/receivers
                R1 to ${r1.target()} @ ${r1.address()}
                R2 to ${r2.target()} @ ${r2.address()}`);

    console.log('Deploy channel');    
    let ch = await Channel.deploy(r1.addressOn(Channel.target()), r2.addressOn(Channel.target()));
    console.log(`Deployed Channel to ${ch.target()} @ ${ch.address()}`);


    console.log('Deploy producers');
    const s1 = await S1.deploy(ch.addressOn(S1.target()));
    const s2 = await S2.deploy(ch.addressOn(S2.target()));
    console.log(`Deployed producers/senders
                S1 to ${s1.target()} @ ${s1.address()}
                S2 to ${s2.target()} @ ${s2.address()}`);

    // wait for the bridge to be established before calling any cross-chain contract methods
    expect(await cubist.whenBridged()).is.true;
    console.log('Bridged');

    console.log('s1.send(1)');
    expect(await (await s1.inner.send(1)).wait()).to.not.throw;

    const isX = async (x) => {
      return (await ch.inner.retrieve()).eq(x) &&
        (await r1.inner.retrieve()).eq(x) &&
        (await r2.inner.retrieve()).eq(x);
    };

    for (let i = 0; i < 15; i++) {
      console.log(`${i}: ch=${await ch.inner.retrieve()} r1=${await r1.inner.retrieve()} r2=${await r2.inner.retrieve()}`);
      if (await isX(1)) {
        break;
      }
      await sleep(1000);
    }
    expect(await isX(1)).is.true;

    console.log('s2.send(2)');
    expect(await (await s2.inner.send(2)).wait(/* confirmations: */ 1)).to.not.throw;

    for (let i = 0; i < 15; i++) {
      console.log(`${i}: ch=${await ch.inner.retrieve()} r1=${await r1.inner.retrieve()} r2=${await r2.inner.retrieve()}`);
      if (await isX(2)) {
        break;
      }
      await sleep(1000);
    }
    expect(await isX(2)).is.true;
  });
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
