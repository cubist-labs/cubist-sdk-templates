#![allow(non_snake_case)]
#![allow(unused_imports)]

mod cubist_gen;

use std::time::Duration;

use cubist_sdk::core::*;
use crate::cubist_gen::*;
use ethers::types::U256;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let cubist = cubist().await?;    
    println!("Deploy consumers");
    let r1 = R1::deploy(()).await?;
    let r2 = R2::deploy(()).await?;
    println!("Deploy channel");    
    let ch = Channel::deploy((r1.addr(Channel::target()), r2.addr(Channel::target()))).await?;
    println!("Deploy producers");
    let s1 = S1::deploy(ch.addr(S1::target())).await?;
    let s2 = S2::deploy(ch.addr(S2::target())).await?;
    assert_eq!(true, cubist.when_bridged(None).await);
    println!("Bridged");

    println!("send(1)");
    let num1 = U256::from(1);
    s1.send(num1).send().await?.await?;

    for i in 0..15 {
        let msg = format!("({i}) ch: {:?}, r1: {:?}, r2: {:?}",
                          ch.retrieve().call().await?,
                          r1.retrieve().call().await?,
                          r2.retrieve().call().await?);
        println!("{}", msg);
        if msg.ends_with("1, r1: 1, r2: 1") {
            break;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    println!("send(2)");
    let num2 = U256::from(2);
    s2.send(num2).send().await?.await?;

    for i in 0..15 {
        let msg = format!("({i}) ch: {:?}, r1: {:?}, r2: {:?}",
                 ch.retrieve().call().await?,
                 r1.retrieve().call().await?,
                          r2.retrieve().call().await?);
        println!("{msg}");
        if msg.ends_with("2, r1: 2, r2: 2") {
            break;
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }

    println!("Done");
    
    Ok(())
}
