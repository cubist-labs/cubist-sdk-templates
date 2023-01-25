import {
  CubistORM,
  ERC20Bridged,
  TokenSender,
  EthersERC20Bridged,
} from '../build/orm/index.js';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

const ERC20Bridged = cubist.ERC20Bridged;
const TokenSender = cubist.TokenSender;

// Type of deployed contracts
export type DeployedContracts = {
  erc20Bridged: ERC20Bridged;
  tokenSender: TokenSender;
}

export async function deploy() : Promise<DeployedContracts> {

  console.log('Deploying!');

  // Break the circular dependency between ERC20Bridged and TokenSender by first
  // deploying ERC20Bridged shims only, then passing that address to TokenSender,
  // then finally deploying ERC20Bridged with TokenSender's address.
  const erc20bShims = await ERC20Bridged.deployShims();
  // get the shim contract on the token sender chain
  const erc20BridgedShim: EthersERC20Bridged = erc20bShims.get(TokenSender.target());
  console.log(`Deployed ERC20Bridged
    to ${TokenSender.target()} @ ${erc20BridgedShim.address}`);

  // deploy the token sender contract and its shim
  const tokenSender: TokenSender = await TokenSender.deploy(erc20BridgedShim.address);
  console.log(`Deployed TokenSender
    to ${TokenSender.target()} @ ${tokenSender.address()}, and
    to ${ERC20Bridged.target()} @ ${tokenSender.addressOn(ERC20Bridged.target())}`);

  // Deploy ERC20Bridged with the TokenSender address. We already deployed all
  // the shims (in this case only one), so we're going to call `deployWithShims`
  // to add the native ERC20Bridged contract to the shim's permitted callers.
  const erc20Bridged = await ERC20Bridged.deployWithShims(erc20bShims,
        "FooBarBaz", "FBB", tokenSender.addressOn(ERC20Bridged.target()));
  console.log(`Deployed ERC20Bridged
    to ${ERC20Bridged.target()} @ ${erc20Bridged.address()}`);

  // Return the inner ethers.js contracts
  return { 
    erc20Bridged,
    tokenSender,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  deploy().catch(console.error);;
}
