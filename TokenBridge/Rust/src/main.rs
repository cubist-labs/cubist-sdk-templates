#![allow(non_snake_case)]

mod cubist_gen;

use crate::cubist_gen::*;

use ethers::providers::Middleware;
use ethers::types::{H160, U256};

// The value to be sent in this simple test case, and the expected amount received
const SENT_AMOUNT: u64 = 1_000_000_000_000u64;
const FEE_INVERSE: u64 = 1000;
const RCVD_AMOUNT: u64 = SENT_AMOUNT - SENT_AMOUNT / FEE_INVERSE;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let cubist = cubist().await?;

    // check if we've already deployed the app, and in that case get the addresses
    let (e20b, toks) = if let (Ok(toks), Ok(e20b)) = (
        TokenSender::deployed().await,
        ERC20Bridged::deployed().await,
    ) {
        println!("Already deployed, skipping deployment.");
        (e20b, toks)
    } else {
        // contracts aren't yet deployed, so deploy them
        println!("Deploying");

        // Break the circular dependency between ERC20Bridged and TokenSender by first
        // deploying ERC20Bridged shims only, then passing that address to TokenSender,
        // then finally deploying ERC20Bridged with TokenSender's address.
        let e20b = ERC20Bridged::deploy_shims().await?;
        let toks = TokenSender::deploy(e20b.addr(TokenSender::target())).await?;
        let e20b = ERC20Bridged::deploy((
            "FooBarBaz".to_owned(),
            "FBB".to_owned(),
            toks.addr(ERC20Bridged::target()),
        ))
        .await?;
        (e20b, toks)
    };

    // wait for the bridge to be up
    assert!(cubist.when_bridged(None).await);
    println!("CUBIST bridged");

    // get the starting balance for the TokenSender contract
    let toks_client = toks.client();
    let toks_bal_init = toks_client.get_balance(toks.address(), None).await?;

    // get the starting ERC20 balance for the recipient address
    let send_to = e20b.project().sender().await?;
    let e20b_st_bal_init = e20b.balance_of(send_to).call().await?;

    // bridge some gas tokens via TokenSender
    println!("Sending tokens");
    let mut call = toks.bridge_send(send_to);
    call.tx.set_value(SENT_AMOUNT);
    call.send().await?.await?;

    println!("Checking that funds arrived");
    let toks_bal_new = toks_bal_init + U256::from(SENT_AMOUNT);
    assert_eq!(
        toks_client.get_balance(toks.address(), None).await?,
        toks_bal_new
    );

    // check token balance in ERC20 contract
    println!("Checking that tokens arrived on remote end");
    let mut i = 15;
    while i > 0 {
        let bal = e20b.balance_of(send_to).call().await?;
        if bal - e20b_st_bal_init == RCVD_AMOUNT.into() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        i -= 1;
    }
    assert_eq!(
        e20b.balance_of(send_to).call().await? - e20b_st_bal_init,
        RCVD_AMOUNT.into()
    );

    let send_rando = H160::random();
    println!("Sending tokens back to lucky rando {send_rando:?}");
    let call = e20b.bridge_send(send_rando, RCVD_AMOUNT.into());
    call.send().await?.await?;

    let mut i = 15;
    while i > 0 {
        let bal = toks_client.get_balance(send_rando, None).await?;
        if bal == RCVD_AMOUNT.into() {
            break;
        }
        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
        i -= 1;
    }

    let tb = toks_client.get_balance(send_rando, None).await?;
    let tcb = toks_client.get_balance(toks.address(), None).await?;
    assert_eq!(tcb, toks_bal_new - U256::from(RCVD_AMOUNT));
    assert_eq!(tb, RCVD_AMOUNT.into());

    Ok(())
}
