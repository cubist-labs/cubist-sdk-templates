mod cubist_gen;

use std::{fs, fmt::Display};

use crate::cubist_gen::*;
use clap::{Args, Parser, Subcommand};
use color_eyre::owo_colors::OwoColorize;
use ethers::types::U256;
use eyre::{Context, Result};

const SENDER: &str = "StorageSender";
const RECEIVER: &str = "StorageReceiver";

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
#[clap(about = "Multi-chain Storage dApp", long_about = None)]
struct Cli {
    #[clap(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    /// Deploy both 'StorageSender' and 'StorageReceiver',
    /// configuring the sender to forward values to the receiver
    Deploy(DeployArgs),
    /// List the current deployments.  Only one instance of 'StorageSender'
    /// and 'StorageReceiver' contracts may exist at a time.
    List,
    /// Store a value to 'StorageSender'; the relayer will automatically
    /// forward that value to its 'StorageReceiver' contract.
    StoreSender(StoreArgs),
    /// Store a value to 'StorageReceiver'.
    StoreReceiver(StoreArgs),
    /// Alias for 'store-sender'.
    Store(StoreArgs),
    /// Increment the value of 'StorageSender' by one; the relayer will automatically
    /// forward the new value to its 'StorageReceiver' contract.
    Inc,
    /// Decrement the value of 'StorageSender' by one; the relayer will automatically
    /// forward the new value to its 'StorageReceiver' contract.
    Dec,
}

#[derive(Debug, Args)]
struct DeployArgs {
    /// The value to which to initialize the 'StorageSender' contract.
    #[clap(short = 's', long = "sender-value", default_value = "0")]
    sender_value: u64,
    /// The value to which to initialize the 'StorageReceiver' contract.
    #[clap(short = 'r', long = "receiver-value", default_value = "0")]
    receiver_value: u64,
}

#[derive(Debug, Args)]
struct StoreArgs {
    /// The value to store.
    #[clap(index = 1)]
    val: u64,
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let args = Cli::parse();

    match args.command {
        Command::Deploy(args) => deploy(&args).await,
        Command::List => list().await,
        Command::Store(args) => store_sender(&args).await,
        Command::StoreSender(args) => store_sender(&args).await,
        Command::StoreReceiver(args) => store_receiver(&args).await,
        Command::Inc => inc().await,
        Command::Dec => dec().await,
    }
}

async fn deploy(args: &DeployArgs) -> Result<()> {
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

    println!(
        "{} {}({})",
        s_action!("Deploying"),
        s_contract!(RECEIVER),
        s_value!(args.receiver_value),
    );
    let receiver = StorageReceiver::deploy(U256::from(args.receiver_value)).await?;

    println!(
        "{} {}({})",
        s_action!("Deploying"),
        s_contract!(SENDER),
        s_value!(args.sender_value),
    );
    let rec_shim_addr = receiver.addr(StorageSender::target());
    StorageSender::deploy((U256::from(args.sender_value), rec_shim_addr)).await?;

    // wait for the bridge to be up
    assert!(cubist.when_bridged(None).await);

    println!("{}", s_action!("Done"));
    Ok(())
}

const DASHES: &str = "──────────────────────────────────────────────────────────────";
const SEP_TOP: (&str, &str, &str) = ("┌─", "─┬─", "─┐");
const SEP_MID: (&str, &str, &str) = ("├─", "─┼─", "─┤");
const SEP_DEF: (&str, &str, &str) = ("│ ", " │ ", " │");
const SEP_BOT: (&str, &str, &str) = ("└─", "─┴─", "─┘");

fn print_row<T1: Display, T2: Display, T3: Display, T4: Display>(
    contract: T1,
    value: T2,
    target: T3,
    address: T4,
    sep: Option<(&str, &str, &str)>,
) {
    let sep = sep.unwrap_or(SEP_DEF);
    println!(
        "{}{contract:>15.15}{}{value:>5.5}{}{target:8.8}{}{address:>11.11}{}",
        sep.0, sep.1, sep.1, sep.1, sep.2
    );
}

async fn list() -> Result<()> {
    let receiver_tuple = match StorageReceiver::deployed().await {
        Ok(rec) => {
            let val = rec.retrieve().await?;
            (
                RECEIVER,
                StorageReceiver::target(),
                Some(rec.address()),
                Some(val),
            )
        }
        _ => (RECEIVER, StorageReceiver::target(), None, None),
    };
    let sender_tuple = match StorageSender::deployed().await {
        Ok(sender) => {
            let val = sender.retrieve().await?;
            (
                SENDER,
                StorageSender::target(),
                Some(sender.address()),
                Some(val),
            )
        }
        _ => (SENDER, StorageSender::target(), None, None),
    };
    print_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_TOP));
    print_row(
        "contract".bold(),
        "value".bold(),
        "target".bold(),
        "address".bold(),
        None,
    );
    print_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_MID));
    for t in [sender_tuple, receiver_tuple] {
        print_row(
            s_contract!(&t.0),
            s_value!(t.3.map(|x| x.to_string()).unwrap_or_default()),
            s_action!(t.1.to_string()),
            s_value!(t.2.map(|x| x.to_string()).unwrap_or_default()),
            None,
        );
    }
    print_row(DASHES, DASHES, DASHES, DASHES, Some(SEP_BOT));
    println!();
    Ok(())
}

async fn store_sender(args: &StoreArgs) -> Result<()> {
    let sender = StorageSender::deployed()
        .await
        .context("Contracts not deployed; call 'cargo run -- deploy' first")?;
    println!(
        "\n{} {}.store({})\n",
        s_action!("Calling"),
        s_contract!(SENDER),
        s_value!(args.val)
    );
    sender.store(U256::from(args.val)).send().await?.await?;
    Ok(())
}

async fn store_receiver(args: &StoreArgs) -> Result<()> {
    let receiver = StorageReceiver::deployed()
        .await
        .context("Contracts not deployed; call 'deploy' first")?;
    println!(
        "\n{} {}.store({})\n",
        s_action!("Calling"),
        s_contract!(RECEIVER),
        s_value!(args.val)
    );
    receiver.store(U256::from(args.val)).send().await?.await?;
    Ok(())
}

async fn inc() -> Result<()> {
    let sender = StorageSender::deployed().await?;
    println!(
        "\n{} {}.inc({})\n",
        s_action!("Calling"),
        s_contract!(SENDER),
        s_value!(1)
    );
    sender.inc(1.into()).send().await?.await?;
    Ok(())
}

async fn dec() -> Result<()> {
    let sender = StorageSender::deployed().await?;
    println!(
        "{} {}.dec({}) ... ",
        s_action!("Calling"),
        s_contract!(SENDER),
        s_value!(1)
    );
    sender.dec(1.into()).send().await?.await?;
    Ok(())
}
