mod cubist_gen;

use crate::cubist_gen::*;
use ethers::types::U256;

#[tokio::main]
async fn main() -> eyre::Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt::init();
    let cubist = cubist().await?;

    println!("Deploying");
    let receiver_one = StorageReceiver::deploy(U256::from(1)).await?;
    let sender_one =
        StorageSender::deploy((U256::from(2), receiver_one.addr(StorageSender::target()))).await?;

    assert!(cubist.when_bridged(None).await);
    println!("Cubist relayer in place");

    println!("Deploying again using a different Cubist instance");
    let cubist = new_cubist().await?;
    let receiver_two = cubist.storage_receiver().deploy(U256::from(10)).await?;
    let sender_two = cubist
        .storage_sender()
        .deploy((U256::from(20), receiver_two.addr(StorageSender::target())))
        .await?;

    assert!(cubist.when_bridged(None).await);
    println!("Second Cubist relayer in place");

    assert_eq!(U256::from(10), receiver_two.retrieve().call().await?);
    assert_eq!(U256::from(20), sender_two.retrieve().call().await?);

    assert_eq!(U256::from(1), receiver_one.retrieve().call().await?);
    assert_eq!(U256::from(2), sender_one.retrieve().call().await?);

    let sender_three = U256::from(3);
    let sender_thirty = U256::from(30);

    println!("Storing {sender_three:?}, {sender_thirty:?}");

    let call = sender_one.store(sender_three);
    call.send().await?.await?;
    let call = sender_two.store(sender_thirty);
    call.send().await?.await?;

    assert_eq!(sender_three, sender_one.retrieve().call().await?);
    assert_eq!(sender_thirty, sender_two.retrieve().call().await?);

    // wait up to 10s and make sure that both 'store' calls on Polygon were propagated to Ethereum
    for delay in std::iter::repeat(std::time::Duration::from_millis(200)).take(50) {
        let receiver_val_one = receiver_one.retrieve().call().await?;
        let receiver_val_two = receiver_two.retrieve().call().await?;
        if receiver_val_one == sender_three && receiver_val_two == sender_thirty {
            break;
        }
        tokio::time::sleep(delay).await;
    }

    // one last chance
    let retrieved_one = receiver_one.retrieve().call().await?;
    let retrieved_two = receiver_two.retrieve().call().await?;
    println!("Retrieved {retrieved_one:?}, {retrieved_two:?}");
    assert_eq!(sender_three, retrieved_one);
    assert_eq!(sender_thirty, retrieved_two);

    Ok(())
}
