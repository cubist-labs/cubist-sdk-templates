import { CubistORM, S1, S2, } from '../build/orm/index.js';

// Project instance
const cubist = new CubistORM();
const S1 = cubist.S1;
const S2 = cubist.S2;

export async function send(ch: number, val: number) {
  if (!await cubist.whenBridged()) {
    throw new Error('Bridge not running');
  }

  let sender: S1 | S2;
  if (ch === 1) {
    sender = await S1.deployed();
  } else if (ch === 2) {
    sender = await S2.deployed();
  } else {
    throw new Error('Sending channel should be 1 or 2');
  }
  console.log(`Sending on channel ${ch} (${sender.address()}, ${sender.target()}) ${val}`);
  await (await sender.inner.send(val)).wait(/* confirmations: */ 1);
}

if (process.argv.length < 4) {
  console.error('Usage: send <channel> <val>');
  process.exit(1);
}
send(parseInt(process.argv[2]), parseInt(process.argv[3])).catch(console.error);
