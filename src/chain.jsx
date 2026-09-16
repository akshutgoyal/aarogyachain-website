import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, Contract, getAddress, isAddress } from "ethers";
import { ABI, SEPOLIA_CHAIN_ID } from "./contract";

const Ctx = createContext(null);
export const useChain = () => useContext(Ctx);

const LS_ADDR = "aarogya.contractAddress";

// The wallet each page needs. null means any wallet will do.
export const PAGE_ROLE = {
  admin: "admin",
  doctor: "doctor",
  auditor: "auditor",
  patient: "patient",
  verify: null,
  home: null,
};

export const ROLE_LABEL = {
  admin: "Admin",
  doctor: "Doctor",
  auditor: "Auditor",
  patient: "Patient",
};

export function short(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

export function ChainProvider({ children }) {
  const [accounts, setAccounts] = useState([]);   // every account MetaMask allows this site
  const [account, setAccount] = useState(null);   // the one MetaMask currently has selected
  const [contractAddress, setContractAddress] = useState(() => localStorage.getItem(LS_ADDR) || "");
  const [roleMap, setRoleMap] = useState({});     // address -> admin | doctor | auditor | patient
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const msgTimer = useRef(null);

  // Flash a message, then clear it. Failures linger longer so they can be read —
  // the demo's reverts are the interesting part.
  const say = useCallback((kind, text) => {
    setMsg({ kind, text });
    clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), kind === "err" ? 6000 : 3000);
  }, []);

  useEffect(() => () => clearTimeout(msgTimer.current), []);

  // ---- follow MetaMask, so switching there needs no re-click here
  useEffect(() => {
    const eth = typeof window !== "undefined" ? window.ethereum : null;
    if (!eth) return;

    // Only touch state when something actually changed, so this cannot loop.
    const apply = (list) => {
      const next = list || [];
      setAccounts((prev) =>
        prev.length === next.length && prev.every((a, i) => a.toLowerCase() === (next[i] || "").toLowerCase())
          ? prev
          : next);
      const first = next[0] || null;
      setAccount((prev) => {
        const a = prev ? prev.toLowerCase() : null;
        const b = first ? first.toLowerCase() : null;
        return a === b ? prev : first;
      });
    };

    const sync = () => eth.request({ method: "eth_accounts" }).then(apply).catch(() => {});
    const onChain = () => window.location.reload();

    eth.on?.("accountsChanged", apply);
    eth.on?.("chainChanged", onChain);
    sync();

    // MetaMask does not reliably emit accountsChanged for every switch, so also
    // re-read on focus and on a slow interval. This is what makes an account
    // change here take effect without a page refresh.
    const id = setInterval(sync, 2000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      eth.removeListener?.("accountsChanged", apply);
      eth.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    try {
      if (!window.ethereum) return say("err", "No wallet found. Install MetaMask first.");
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
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
      const list = await window.ethereum.request({ method: "eth_accounts" });
      setAccounts(list || []);
      setAccount(list?.[0] || null);
      say("ok", list?.length > 1
        ? `Wallet connected — ${list.length} accounts available.`
        : "Wallet connected.");
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

  // ---- read each connected wallet's role straight off the chain
  const detectRoles = useCallback(async (list) => {
    const who = list ?? accounts;
    if (!isAddress(contractAddress) || !who?.length) {
      setRoleMap({});
      return {};
    }
    try {
      const c = await getContract(false);
      const [ADMIN, MGR, AUD] = await Promise.all([
        c.DEFAULT_ADMIN_ROLE(), c.MANAGER_ROLE(), c.AUDITOR_ROLE(),
      ]);
      const out = {};
      await Promise.all(
        who.map(async (a) => {
          const [isAdmin, isMgr, isAud, identity] = await Promise.all([
            c.hasRole(ADMIN, a),
            c.hasRole(MGR, a),
            c.hasRole(AUD, a),
            c.identities(a).catch(() => null),
          ]);
          out[a.toLowerCase()] =
            isAdmin ? "admin"
            : isMgr ? "doctor"
            : isAud ? "auditor"
            : identity?.[2] ? "patient"
            : null;
        })
      );
      setRoleMap(out);
      return out;
    } catch {
      setRoleMap({});
      return {};
    }
  }, [accounts, contractAddress, getContract]);

  useEffect(() => { detectRoles(); }, [detectRoles, refreshKey]);

  // The connected wallet for a given page, if we have one.
  const accountFor = useCallback(
    (page) => {
      const want = PAGE_ROLE[page];
      if (!want) return null;
      return accounts.find((a) => roleMap[a.toLowerCase()] === want) || null;
    },
    [accounts, roleMap]
  );

  // MetaMask will not switch silently — this opens its account picker.
  const switchTo = useCallback(
    async (target) => {
      const eth = typeof window !== "undefined" ? window.ethereum : null;
      if (!eth) return say("err", "No wallet found.");
      try {
        await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      } catch {
        return say("info", "Account switch was dismissed. Use the MetaMask account selector.");
      }
      const list = await eth.request({ method: "eth_accounts" });
      setAccounts(list || []);
      setAccount(list?.[0] || null);
      if (list?.[0]?.toLowerCase() === target.toLowerCase()) {
        say("ok", "Switched to " + short(target) + ".");
      } else {
        say("info",
          "MetaMask still has " + short(list?.[0]) + " selected — choose " + short(target) +
          " from the account list to use this page.");
      }
    },
    [say]
  );

  // Wrap a write call: busy flag, friendly messages, returns receipt or null.
  const write = useCallback(async (label, fn) => {
    setBusy(true);
    say("info", label + " — confirm in MetaMask…");
    try {
      const tx = await fn();
      say("info", label + " — sent, waiting for confirmation…");
      const rc = await tx.wait();
      say("ok", label + " confirmed in block " + rc.blockNumber + ".");
      setRefreshKey((k) => k + 1); // roles may have just changed
      return rc;
    } catch (e) {
      say("err", label + " failed: " + shortErr(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [say]);

  // Wrap a read call: returns value or null, surfaces reverts as messages.
  const read = useCallback(async (label, fn) => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      say("err", label + " failed: " + shortErr(e));
      return null;
    } finally {
      setBusy(false);
    }
  }, [say]);

  const saveAddress = (a) => {
    setContractAddress(a);
    localStorage.setItem(LS_ADDR, a);
  };

  const value = useMemo(
    () => ({
      account, accounts, contractAddress, roleMap, busy, msg,
      connect, getContract, write, read, say, saveAddress,
      detectRoles, accountFor, switchTo,
    }),
    [account, accounts, contractAddress, roleMap, busy, msg, connect, getContract,
     write, read, say, detectRoles, accountFor, switchTo]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function shortErr(e) {
  // ethers fills in e.revert when the ABI declares the custom error.
  const name = e?.revert?.name || e?.info?.error?.name || "";
  const m = (name ? name + " — " : "") + (e?.shortMessage || e?.reason || e?.message || String(e));
  if (/user rejected/i.test(m)) return "transaction rejected in wallet.";
  if (/AccessControlUnauthorizedAccount/.test(m))
    return "this wallet does not hold the required role — switch MetaMask to the account that does.";
  if (/AccessDenied/.test(m)) return "no consent on record (AccessDenied).";
  if (/Expired/.test(m)) return "consent window expired (Expired).";
  if (/NotAuthorized/.test(m)) return "not authorized — wrong role, or not the record owner.";
  if (/RecordNotFound/.test(m)) return "record does not exist (RecordNotFound).";
  if (/IdentityExists/.test(m)) return "identity already registered.";
  if (/IdentityNotFound/.test(m)) return "that patient has no active identity.";
  if (/ERC721NonexistentToken/.test(m)) return "that token does not exist (wrong ID, or already revoked).";
  return m.split("\n")[0].slice(0, 160);
}

export function normAddr(a) {
  try {
    return getAddress(a.trim());
  } catch {
    return null;
  }
}
