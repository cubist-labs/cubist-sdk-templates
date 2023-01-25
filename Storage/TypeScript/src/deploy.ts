import {
  CubistORM,
  EthersStorageReceiver,
  EthersStorageSender,
} from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

// Contract factories
const StorageReceiver = cubist.StorageReceiver;
const StorageSender = cubist.StorageSender;

// Type of deployed contracts
export type DeployedContracts = {
  receiver: EthersStorageReceiver,
  sender: EthersStorageSender,
}

export async function deploy(val: number) : Promise<DeployedContracts> {
  // Deploy StorageReceiver
  const receiver = await StorageReceiver.deploy(val);
  const senderTarget = StorageSender.target();
  console.log(`Deployed StorageReceiver
to ${receiver.target()} @ ${receiver.address()}
   ${senderTarget} @ ${receiver.addressOn(senderTarget)}`);

  // Deploy StorageSender
  const sender = await StorageSender.deploy(val, receiver.addressOn(senderTarget));
  console.log(`Deployed StorageSender 
to ${senderTarget} @ ${sender.addressOn(senderTarget)}`);

  // Return the inner ethers.js contracts
  return { 
    receiver: receiver.inner,
    sender: sender.inner
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 3) {
    console.error('Usage: deploy <val>');
    process.exit(1);
  }
  deploy(parseInt(process.argv[2])).catch(console.error);;
}
