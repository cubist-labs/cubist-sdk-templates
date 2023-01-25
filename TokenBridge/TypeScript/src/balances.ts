import {
  CubistORM,
  ERC20Bridged,
} from '../build/orm/index.js';
import { internal, } from '@cubist-labs/cubist';
import { fileURLToPath, } from 'url';

// Project instance
const cubist = new CubistORM();

const ERC20Bridged = cubist.ERC20Bridged;
const TokenSender = cubist.TokenSender;

export async function balances() {
  const e20bProject = ERC20Bridged.project;
  const tsProject = TokenSender.project;

  // print wei balances of normal accounts on TokenSender chain (Ethereum)
  {
    console.log(`Accounts on ${tsProject.target()}:`);
    const accounts = await tsProject.accounts();
    const table = [];
    for (const account of accounts) {
      table.push({ account, wei: `${await tsProject.getBalance(account)}` });
    }
    console.table(table);
  }

  // print wei and fbb balances of normal accounts on ERC20Bridged chain (Polygon)
  {
    console.log(`Accounts on ${e20bProject.target()}:`);
    const accounts = await e20bProject.accounts();
    const table = [];
    for (const account of accounts) {
      const row:any = { account, wei: `${await e20bProject.getBalance(account)}` };
      try {
        const erc20Bridged = await ERC20Bridged.deployed();
        row.fbb = `${await erc20Bridged.inner.balanceOf(account)}`;
      } catch (e) { }
      table.push(row);
    }
    console.table(table);
  }

  try {
    const e20Bridged = await ERC20Bridged.deployed();
    const tokenSender = await TokenSender.deployed();
    console.log(`Contracts`);
    console.table([
      { 
        contract: `ERC20Bridged @ ${e20bProject.target()}`,
        address: e20Bridged.addressOn(e20bProject.target()), 
        wei: `${await e20bProject.getBalance(e20Bridged.addressOn(e20bProject.target()))}`,
      },
      { 
        contract: `ERC20Bridged @ ${tsProject.target()}`,
        address: e20Bridged.addressOn(tsProject.target()),
        wei: `${await tsProject.getBalance(e20Bridged.addressOn(tsProject.target()))}`,
      },
      { 
        contract: `TokenSender @ ${tsProject.target()}`,
        address: tokenSender.addressOn(tsProject.target()),
        wei: `${await tsProject.getBalance(tokenSender.addressOn(tsProject.target()))}`,
      },
      { 
        contract: `TokenSender @ ${e20bProject.target()}`,
        address: tokenSender.addressOn(e20bProject.target()), 
        wei: `${await e20bProject.getBalance(tokenSender.addressOn(e20bProject.target()))}`,
      },
    ]);
  } catch (e) { 
    console.log(`Contracts not deployed yet`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  balances().catch(console.error);;
}
