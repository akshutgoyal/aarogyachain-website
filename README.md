# AarogyaChain website (production-look demo UI)

React + Vite + ethers v6 front end for the deployed `AarogyaChain.sol` contract.
No backend — the browser talks to Sepolia directly through MetaMask.

## Run it

```bash
cd /home/akshut/SIH/website-muse
npm install
npm run dev     # → http://localhost:5173
```

## Wire it to your contract

1. Deploy `../contract/AarogyaChain.sol` via Remix (see `../contract/README.md`).
2. Paste the deployed address into the **Contract address** box on any page
   (it is remembered in localStorage).
3. Pick your role in the nav bar, connect the matching wallet, and go.

## Pages

| Route | Who | What it calls |
|---|---|---|
| `/` | anyone | explainer + record lifecycle |
| `/patient` | Patient | `grantAccess`, `revokeAccess`, `ownerOf` scan + `viewRecord` |
| `/doctor` | Doctor (Manager) | `requestRecord`, `viewRecord`, `emergencyAccess` |
| `/admin` | Hospital IT (Admin) | `createIdentity`, `didFor`, `mintRecord`, `revokeRecord` |
| `/auditor` | Auditor | `auditRecord` (metadata only — never the CID) |
| `/verify` | anyone | `verifyRecord` — free, permissionless verdict |

## Stack (matches slide 3 of the deck)

- Solidity 0.8.24 · OpenZeppelin ERC-721 + AccessControl · ERC-5192 soulbound
- `did:ethr` (W3C DID Core) · EIP-4361 sign-in (via MetaMask)
- IPFS/Pinata + MongoDB cache (Phase 2) · Ethereum Sepolia → Base L2
- Frontend: React 18 + Vite + ethers v6

## Notes

- Reverts surface as plain-English messages (AccessDenied, Expired,
  NotAuthorized…) — the demo's three cut-offs are all reachable from the UI.
- Verify page needs no wallet: reads are free.
- Everything is a demo UI over the real contract — no mock data anywhere.
