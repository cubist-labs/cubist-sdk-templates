mod cubist_gen;

use std::{fmt::Display, fs, str::FromStr};

use crate::cubist_gen::*;
use clap::{Args, Parser, Subcommand};
use color_eyre::owo_colors::OwoColorize;
use cubist_sdk::core::TargetProject;
use ethers::types::{Address, U256};
use ethers_providers::Middleware;
use eyre::{bail, eyre, Context, Result};

const TOKEN_SENDER: &str = "TokenSender";
const ERC20_BRIDGED: &str = "ERC20Bridged";

macro_rules! s_action {
    ($x: expr) => {
        $x.bold().green()
    };
}

macro_rules! s_value {
    ($x: expr) => {
        $x.yellow()
    };
}

macro_rules! s_contract {
    ($x: expr) => {
        $x.blue()
    };
}

#[derive(Debug, Parser)]
#[clap(about = "Multi-chain Token Bridge dApp", long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Deploy and configure both 'TokenSender' and 'ERC20Bridged' contracts.
    ///
    /// 'TokenSender' contract is the "sending" side of a cross-chain bridge.
    /// It receives payment in native tokens and issues ERC20 tokens (sym 'FBB') from
    /// 'ERC20Bridged' in response. When commanded by 'ERC20Bridged', it releases
    /// native tokens to a specified recipient.
    ///
    /// 'ERC20Bridged' is the "receiving" side of a cross-chain bridge.
    /// It defines an ERC20 token (sym 'FBB') that is minted in response to payments
    /// on the "sending" side; a user can burn these tokens via 'bridge_send'
    /// to release native tokens from the sending side.
    Deploy,
    /// List balances of accounts and contracts on both chains.
    Balances,
    /// Mint some FBB tokens.  This is done by calling 'TokenSender' and specifying a WEI amount and
    /// an address to receive minted FBB.  Conversion rate is 0.999, which means that 'TokenSender'
    /// will send a request to 'ERC20Bridged' to mint FBB tokens (in the amount of 99.9% of the
    /// received WEI amount) and award them to the specified recipient.
    Buy(BuyArgs),
    /// Burn some FBB tokens.  This is done by calling 'ERC20Bridged' and specifying an FBB amount
    /// and an address to receive WEI.  Conversion rate is 1.0, which means that 'ERC20Bridged' will
    /// first burn the specified amount of FBB and then send a request to 'TokenSender' to award
    /// the same amount of WEI to the specified recipient.
    Sell(SellArgs),
}

#[derive(Debug, Args)]
struct BuyArgs {
    /// Payment in WEI. The amount of minted FBB will be equal to 99.9% of that.
    #[clap(index = 1)]
    payment_wei: u64,
    /// Receiver of newly minted FBB.  Either a hex address (starting with '0x')
    /// or account index on 'ERC20Bridged' chain.  Defaults to the address
    /// of the first (index 0) account on 'ERC20Bridged' chain.
    #[clap(index = 2, default_value = "0")]
    fbb_receiver: String,
}

#[derive(Debug, Args)]
struct SellArgs {
    /// The amount of FBB to sell/burn.
    #[clap(index = 1)]
    amount_fbb: u64,
    /// Receiver of WEI.  Either a hex address (starting with '0x')
    /// or account index on 'TokenSender' chain.  Defaults to the
    /// address of the first (index 0) account on 'TokenSender' chain.
    #[clap(index = 2, default_value = "0")]
    wei_receiver: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let args = Cli::parse();

    match args.command {
        Command::Deploy => deploy().await,
        Command::Balances => balances().await,
        Command::Buy(args) => buy(&args).await,
        Command::Sell(args) => sell(&args).await,
    }
}

async fn deploy() -> Result<()> {
    let cubist = cubist().await?;

    let deploy_dir = cubist.config().deploy_dir();
    if deploy_dir.is_dir() {
        println!(
            "{} deployment dir: {}",
            s_action!("Deleting"),
            s_value!(deploy_dir.display()),
        );
        fs::remove_dir_all(deploy_dir).context("Deleting previous deployment dir")?;
    }

    let e20b = ERC20Bridged::deploy_shims().await?;
    let e20b_shim_addr = e20b.addr(TokenSender::target());
    println!(
        "{} {}({})",
        s_action!("Deploying"),
        s_contract!(TOKEN_SENDER),
        s_value!(e20b_shim_addr)
    );
    let toks = TokenSender::deploy(e20b_shim_addr).await?;

    let toks_shim_addr = toks.addr(ERC20Bridged::target());
    println!(
        "{} {}({}, {})",
        s_action!("Deploying"),
        s_contract!(ERC20_BRIDGED),
        s_value!("'FBB'"),
        s_value!(toks_shim_addr)
    );
    let _e20b =
        ERC20Bridged::deploy(("FooBarBaz".to_owned(), "FBB".to_owned(), toks_shim_addr)).await?;

    // wait for the bridge to be up
    assert!(cubist.when_bridged(None).await);

    println!("{}", s_action!("Done"));
    Ok(())
}

async fn proj_accounts(proj: &TargetProject) -> Result<Vec<(Option<String>, Address)>> {
    Ok(proj
        .accounts()
        .await?
        .into_iter()
        .map(|a| (None, a))
        .collect())
}

async fn token_sender_accounts() -> Result<Vec<(Option<String>, Address)>> {
    let target = TokenSender::target();
    let proj = cubist().await?.project(target).unwrap();

    let mut result = proj_accounts(&proj).await?;
    if let Ok(c) = TokenSender::deployed().await {
        result.push((Some(TOKEN_SENDER.to_owned()), c.address()));
    }
    if let Ok(c) = ERC20Bridged::deployed().await {
        result.push((Some(format!("(shim) {ERC20_BRIDGED}")), c.addr(target)));
    }
    Ok(result)
}

async fn erc20_accounts() -> Result<Vec<(Option<String>, Address)>> {
    let target = ERC20Bridged::target();
    let proj = cubist().await?.project(target).unwrap();

    let mut result = proj_accounts(&proj).await?;
    if let Ok(c) = ERC20Bridged::deployed().await {
        result.push((Some(ERC20_BRIDGED.to_owned()), c.address()));
    }
    if let Ok(c) = TokenSender::deployed().await {
        result.push((Some(format!("(shim) {TOKEN_SENDER}")), c.addr(proj.target)));
    }
    Ok(result)
}

async fn get_fbb_balance(acc: Address) -> Result<Option<U256>> {
    if let Ok(erc20) = ERC20Bridged::deployed().await {
        let fbb = erc20.balance_of(acc).call().await?;
        Ok(Some(fbb))
    } else {
        Ok(None)
    }
}

const DASHES: &str = "──────────────────────────────────────────────────────────────";
const SEP_TOP: (&str, &str, &str) = ("┌─", "─┬─", "─┐");
const SEP_MID: (&str, &str, &str) = ("├─", "─┼─", "─┤");
const SEP_DEF: (&str, &str, &str) = ("│ ", " │ ", " │");
const SEP_BOT: (&str, &str, &str) = ("└─", "─┴─", "─┘");

fn print_sender_row<T1: Display, T2: Display, T3: Display, T4: Display>(
    ind: T1,
    name: T2,
    addr: T3,
    wei: T4,
    sep: Option<(&str, &str, &str)>,
) {
    let sep = sep.unwrap_or(SEP_DEF);
    println!(
        "{}{ind:>10.10}{}{name:>19.19}{}{addr:>42.42}{}{wei:>25.25}{}",
        sep.0, sep.1, sep.1, sep.1, sep.2
    );
}

fn print_erc20_row<T1: Display, T2: Display, T3: Display, T4: Display, T5: Display>(
    ind: T1,
    name: T2,
    addr: T3,
    wei: T4,
    fbb: T5,
    sep: Option<(&str, &str, &str)>,
) {
    let sep = sep.unwrap_or(SEP_DEF);
    println!(
        "{}{ind:>10.10}{}{name:>19.19}{}{addr:>42.42}{}{wei:>25.25}{}{fbb:>20.20}{}",
        sep.0, sep.1, sep.1, sep.1, sep.1, sep.2
    );
}

async fn balances() -> Result<()> {
    let cubist = cubist().await?;

    println!();
    let proj = cubist.project(TokenSender::target()).unwrap();
    print_sender_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_TOP));
    print_sender_row(
        format!("({})", TokenSender::target()).green().bold(),
        "name".bold(),
        "address".bold(),
        "wei".bold(),
        None,
    );
    print_sender_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_MID));
    for (i, acc) in token_sender_accounts().await?.into_iter().enumerate() {
        print_sender_row(
            i,
            s_contract!(acc.0.unwrap_or_default()),
            s_value!(format!("{:?}", acc.1)),
            s_value!(proj.provider().get_balance(acc.1, None).await?.to_string()),
            None,
        );
    }
    print_sender_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_BOT));

    println!();
    print_erc20_row(DASHES, DASHES, DASHES, DASHES, DASHES, Some(SEP_TOP));
    print_erc20_row(
        format!("({})", ERC20Bridged::target()).green().bold(),
        "name".bold(),
        "address".bold(),
        "wei".bold(),
        "fbb".bold(),
        None,
    );
    print_erc20_row(DASHES, DASHES, DASHES, DASHES, DASHES, Some(SEP_MID));
    let proj = cubist.project(ERC20Bridged::target()).unwrap();
    for (i, acc) in erc20_accounts().await?.into_iter().enumerate() {
        print_erc20_row(
            i,
            s_contract!(acc.0.unwrap_or_default()),
            s_value!(format!("{:?}", acc.1)),
            s_value!(proj.provider().get_balance(acc.1, None).await?.to_string()),
            s_value!(get_fbb_balance(acc.1)
                .await?
                .unwrap_or_default()
                .to_string()),
            None,
        );
    }
    print_erc20_row(DASHES, DASHES, DASHES, DASHES, DASHES, Some(SEP_BOT));
    println!();
    Ok(())
}

async fn buy(args: &BuyArgs) -> Result<()> {
    let tok = TokenSender::deployed()
        .await
        .context("Contracts not deployed; call 'deploy' first")?;
    let receiver = to_address(&args.fbb_receiver, erc20_accounts().await?)?;
    let mut call = tok.bridge_send(receiver);
    call.tx.set_value(args.payment_wei);
    println!(
        "\n{} {}.bridge_send{{value: {}}}({:?})\n",
        s_action!("Calling"),
        s_contract!(TOKEN_SENDER),
        s_value!(args.payment_wei),
        s_value!(receiver)
    );
    call.send().await?.await?;
    Ok(())
}

async fn sell(args: &SellArgs) -> Result<()> {
    let erc20 = ERC20Bridged::deployed()
        .await
        .context("Contracts not deployed; call 'deploy' first")?;
    let receiver = to_address(&args.wei_receiver, token_sender_accounts().await?)?;
    println!(
        "\n{} {}.bridge_send({:?}, {})\n",
        s_action!("Calling"),
        s_contract!(ERC20_BRIDGED),
        s_value!(receiver),
        s_value!(args.amount_fbb),
    );
    erc20
        .bridge_send(receiver, U256::from(args.amount_fbb))
        .send()
        .await?
        .await?;
    Ok(())
}

fn to_address<T>(addr: &str, acc: Vec<(T, Address)>) -> Result<Address> {
    if addr.starts_with("0x") {
        Ok(Address::from_str(addr).context(format!("Invalid address: {addr}"))?)
    } else if let Ok(i) = addr.parse::<usize>() {
        let t = acc
            .get(i)
            .ok_or_else(|| eyre!("Index out of bounds, must be between 0..{}", acc.len() - 1))?;
        Ok(t.1)
    } else {
        bail!("Invalid address: {}", addr)
    }
}
