# Student Registration

A Foundry project containing the `StudentRegistration` Solidity contract.

## Requirements

- Foundry

## Test

```sh
forge test
```

## Build

```sh
forge build
```

## Frontend

The Vite frontend lives in `frontend/` and uses `viem` for wallet access and multicall reads.

```sh
cd frontend
npm install
cp .env.example .env
# Set VITE_CONTRACT_ADDRESS to the deployed StudentRegistration address.
npm run dev
```