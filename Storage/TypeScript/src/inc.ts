import { CubistORM, } from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

export async function inc(val: number): Promise<void> {
  const sender = (await cubist.StorageSender.deployed()).inner;
  await (await sender.inc(val)).wait(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error('Usage: inc <val>');
    process.exit(1);
  }
  inc(parseInt(process.argv[2])).catch(console.error);;
}
