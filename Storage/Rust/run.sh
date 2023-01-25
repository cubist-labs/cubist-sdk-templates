#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

function run-cli {
    "$SCRIPT_DIR/target/debug/cli" "$@"
}

cd "$SCRIPT_DIR"
rm -rf build deploy
cubist build
cargo build --bin cli
cubist start
run-cli list
run-cli deploy --sender-value 10 --receiver-value 20
run-cli list     # expect sender value to be 10 and receiver value to be 20
run-cli store-sender 30 
sleep 0.5        # give the relayer some time to propagate the value
run-cli list     # expect sender value to be 30 and receiver value to be 30
run-cli store-receiver 40
run-cli list     # expect sender value to be 30 and receiver value to be 40
run-cli inc
sleep 0.5        # give the relayer some time to propagate the value
run-cli list     # expect sender value to be 31 and receiver value to be 31
cubist stop