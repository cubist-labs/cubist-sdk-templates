import { CubistORM, } from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

export async function dec(val) {
  const sender = (await cubist.StorageSender.deployed()).inner;
  await (await sender.dec(val)).wait(1);
  console.log("Decremented counter");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error('Usage: dec <val>');
    process.exit(1);
  }
  dec(parseInt(process.argv[2])).catch(console.error);;
}
