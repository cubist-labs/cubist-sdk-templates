import { CubistORM, } from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

export async function store(val) {
  const sender = (await cubist.StorageSender.deployed()).inner;
  await (await sender.store(val)).wait(1);
  console.log("New value stored");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error('Usage: store <val>');
    process.exit(1);
  }
  store(parseInt(process.argv[2])).catch(console.error);;
}
