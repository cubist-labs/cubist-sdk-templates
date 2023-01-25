#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

cd "$SCRIPT_DIR"
rm -rf build deploy

# build
yarn
cubist build
yarn build

# start cubist services
cubist stop
cubist start

# print out balances (WEI and FBB) of all accounts
yarn balances

# deploy the two contracts and configures them to talk to each other; print balances again
yarn deploy
yarn balances

# buy FBB (worth 1000000000000 WEI) and award the proceeds to account-0 on Polygon
yarn buy 1000000000000 0

# print balances; expect:
#   - 999000000000 FBB in account-0 on Polygon
#   - 1000000000000 WEI in 'TokenSender' contract
yarn balances

# sell 99000000000 FBB and award the proceeds to account-1 on Ethereum
yarn sell 99000000000 1

# print balances; expect:
#   - 99000000000 less FBB (i.e., 900000000000) in account-0 on Polygon
#   - 99000000000 less WEI (i.e., 901000000000) in 'TokenSender' contract
#   - 99000000000 more WEI (i.e., 10000000000099000000000) in account-1 on Ethereum
yarn balances

# stop cubist services
cubist stop