import { CubistORM, } from '../build/orm/index.js';

// Project instance
const cubist = new CubistORM();

// Conctract factories
const R1 = cubist.R1;
const R2 = cubist.R2;
const Channel = cubist.Channel;
const S1 = cubist.S1;
const S2 = cubist.S2;


export async function deploy() {
  const r1 = await R1.deploy();
  const r2 = await R2.deploy();
  console.log(`Deployed consumers/receivers
  R1 to ${r1.target()} @ ${r1.address()}
  R2 to ${r2.target()} @ ${r2.address()}`);

  let ch = await Channel.deploy(r1.addressOn(Channel.target()), r2.addressOn(Channel.target()));
  console.log(`Deployed Channel to ${ch.target()} @ ${ch.address()}`);

  console.log('Deploy producers');
  const s1 = await S1.deploy(ch.addressOn(S1.target()));
  const s2 = await S2.deploy(ch.addressOn(S2.target()));
  console.log(`Deployed producers/senders
  S1 to ${s1.target()} @ ${s1.address()}
  S2 to ${s2.target()} @ ${s2.address()}`);
}

deploy().catch(console.error);;
