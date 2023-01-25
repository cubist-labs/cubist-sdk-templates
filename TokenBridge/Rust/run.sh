#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

function run-cli {
    "$SCRIPT_DIR/target/debug/cli" "$@"
}

cd "$SCRIPT_DIR"
rm -rf build deploy

# build
cubist build
cargo build --bin cli

# start cubist services
cubist stop
cubist start

# print out balances (WEI and FBB) of all accounts
run-cli balances

# deploy the two contracts and configures them to talk to each other; print balances again
run-cli deploy
run-cli balances

# buy FBB (worth 1000000000000 WEI) and award the proceeds to account-0 on Polygon
run-cli buy 1000000000000 0
sleep 0.5 # give the relayer some time to propagate values

# print balances; expect:
#   - 999000000000 FBB in account-0 on Polygon
#   - 1000000000000 WEI in 'TokenSender' contract
run-cli balances

# sell 99000000000 FBB and award the proceeds to account-1 on Ethereum
run-cli sell 99000000000 1
sleep 0.5 # give the relayer some time to propagate values

# print balances; expect:
#   - 99000000000 less FBB (i.e., 900000000000) in account-0 on Polygon
#   - 99000000000 less WEI (i.e., 901000000000) in 'TokenSender' contract
#   - 99000000000 more WEI (i.e., 10000000000099000000000) in account-1 on Ethereum
run-cli balances

# stop cubist services
cubist stop