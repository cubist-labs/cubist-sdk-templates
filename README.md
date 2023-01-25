[![Node.js Tests](https://github.com/cubist-labs/cubist-sdk-templates/actions/workflows/node-tests.yml/badge.svg)](https://github.com/cubist-labs/cubist-sdk-templates/actions/workflows/node-tests.yml)
[![Rust tests](https://github.com/cubist-labs/cubist-sdk-templates/actions/workflows/rust-tests.yml/badge.svg)](https://github.com/cubist-labs/cubist-sdk-templates/actions/workflows/rust-tests.yml)

This repo contains starting templates for building dapps that run
across multiple chains. You can pull in any of these templates using the
[`cubist` cli tool](https://docs.cubist.dev/guide/installation). 
For example, to get started with a counter that lives across two chains:

```
cubist new --template Storage --type TypeScript
```

**For more information, check out [the Cubist docs](https://docs.cubist.dev).**

## Official templates

- [Storage](./Storage) -- A simple counter running on Polygon and accessible
on Ethereum.
- [TokenBridge](./TokenBridge) --  Two-chain dapp for bridging wrapped gas
tokens from Polygon to Ethereum.
- [MPMC](./MPMC) -- Many-chain dapp implementing the _multi-producer, multi-consumer
pattern_ across Avalanche, Ethereum, Polygon, and an Avalanche subnet.

# License

Copyright (C) 2022-2023 Cubist, Inc.

See the [NOTICE](NOTICE) file for licensing information.
