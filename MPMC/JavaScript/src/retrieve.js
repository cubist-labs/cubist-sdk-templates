import { CubistORM, } from '../build/orm/index.js';

// Project instance
const cubist = new CubistORM();
const R1 = cubist.R1;
const R2 = cubist.R2;
const Channel = cubist.Channel;

export async function retrieve() {
  if (!await cubist.whenBridged()) {
    throw new Error('Bridge not running');
  }

  const r1 = await R1.deployed();
  const r2 = await R2.deployed();
  const ch = await Channel.deployed();

  console.log(`retrieve:
  on Channel (${ch.target()}): ${await ch.inner.retrieve()}
  on R1 (${r1.target()}): ${await r1.inner.retrieve()}
  on R2 (${r2.target()}): ${await r2.inner.retrieve()}`);
}

retrieve().catch(console.error);
