import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { BrowserProvider, Contract, getAddress, isAddress } from "ethers";
import { ABI, SEPOLIA_CHAIN_ID } from "./contract";

const Ctx = createContext(null);
export const useChain = () => useContext(Ctx);

const LS_ADDR = "aarogya.contractAddress";
const LS_ROLE = "aarogya.role";

export function ChainProvider({ children }) {
  const [account, setAccount] = useState(null);
  const [contractAddress, setContractAddress] = useState(() => localStorage.getItem(LS_ADDR) || "");
  const [role, setRole] = useState(() => localStorage.getItem(LS_ROLE) || "patient");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // {kind: ok|err|info, text}

  const say = useCallback((kind, text) => setMsg({ kind, text }), []);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) return say("err", "No wallet found. Install MetaMask first.");
      const provider = new BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const net = await provider.getNetwork();
      if (net.chainId !== SEPOLIA_CHAIN_ID) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }],
          });
        } catch {
          return say("err", "Please switch MetaMask to the Sepolia testnet.");
        }
      }
      setAccount(accounts[0]);
      say("ok", "Wallet connected.");
    } catch (e) {
      say("err", "Wallet connection failed: " + shortErr(e));
    }
  }, [say]);

  const getContract = useCallback(
    async (signerNeeded) => {
      if (!isAddress(contractAddress)) throw new Error("Set a valid contract address first.");
      const provider = new BrowserProvider(window.ethereum);
      if (signerNeeded) {
        const signer = await provider.getSigner();
        return new Contract(contractAddress, ABI, signer);
      }
      return new Contract(contractAddress, ABI, provider);
    },
    [contractAddress]
  );

  // Wrap a write call: busy flag, friendly messages, returns receipt or null.
  const write = useCallback(
    async (label, fn) => {
      setBusy(true);
      setMsg({ kind: "info", text: label + " — confirm in MetaMask…" });
      try {
        const tx = await fn();
        setMsg({ kind: "info", text: label + " — sent, waiting for confirmation…" });
        const rc = await tx.wait();
        setMsg({ kind: "ok", text: label + " confirmed in block " + rc.blockNumber + "." });
        return rc;
      } catch (e) {
        setMsg({ kind: "err", text: label + " failed: " + shortErr(e) });
        return null;
      } finally {
        setBusy(false);
      }
    },
    []
  );

  // Wrap a read call: returns value or null, surfaces reverts as messages.
  const read = useCallback(async (label, fn) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      setMsg({ kind: "err", text: label + " failed: " + shortErr(e) });
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const saveAddress = (a) => {
    setContractAddress(a);
    localStorage.setItem(LS_ADDR, a);
  };
  const saveRole = (r) => {
    setRole(r);
    localStorage.setItem(LS_ROLE, r);
  };

  const value = useMemo(
    () => ({ account, contractAddress, role, busy, msg, connect, getContract, write, read, say, saveAddress, saveRole }),
    [account, contractAddress, role, busy, msg, connect, getContract, write, read, say]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function shortErr(e) {
  const m = e?.shortMessage || e?.reason || e?.message || String(e);
  if (/user rejected/i.test(m)) return "transaction rejected in wallet.";
  if (/AccessDenied/.test(m)) return "no consent on record (AccessDenied).";
  if (/Expired/.test(m)) return "consent window expired (Expired).";
  if (/NotAuthorized/.test(m)) return "not authorized — wrong role or not the owner.";
  if (/RecordNotFound/.test(m)) return "record does not exist (RecordNotFound).";
  if (/IdentityExists/.test(m)) return "identity already registered.";
  if (/IdentityNotFound/.test(m)) return "patient has no active identity.";
  if (/AccessControlUnauthorizedAccount/.test(m)) return "your wallet lacks the required role.";
  return m.split("\n")[0].slice(0, 160);
}

export function normAddr(a) {
  try {
    return getAddress(a.trim());
  } catch {
    return null;
  }
}
