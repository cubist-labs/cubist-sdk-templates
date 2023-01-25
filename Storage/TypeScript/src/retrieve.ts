import { CubistORM, } from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

// Contract targets
const senderTarget = cubist.StorageSender.target();
const receiverTarget = cubist.StorageReceiver.target();

export async function retrieveFromSender() {
  const sender = (await cubist.StorageSender.deployed()).inner;
  return await sender.retrieve();
}

export async function retrieveFromReceiver() {
  const receiver = (await cubist.StorageReceiver.deployed()).inner;
  return await receiver.retrieve();
}

export async function retrieve() {
  console.log(`Receiver counter (${receiverTarget}) = ${await retrieveFromReceiver()}`);
  console.log(`Sender counter (${senderTarget}) = ${await retrieveFromSender()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  retrieve().catch(console.error);
}
