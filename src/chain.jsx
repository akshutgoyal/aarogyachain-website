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

const sameList = (a, b) =>
  a.length === b.length && a.every((x, i) => (x || "").toLowerCase() === (b[i] || "").toLowerCase());

export const hasAddr = (list, addr) =>
  !!addr && list.some((a) => a.toLowerCase() === addr.toLowerCase());

// MetaMask reports only the *selected* account through eth_accounts, but
// wallet_getPermissions reveals every account the site is allowed to use. Without
// this the site can never see the Doctor or Auditor wallet.
async function readPermittedAccounts(eth) {
  try {
    const perms = await eth.request({ method: "wallet_getPermissions" });
    const p = (perms || []).find((x) => x.parentCapability === "eth_accounts");
    const caveat = (p?.caveats || []).find((c) => c.type === "restrictReturnedAccounts");
    return Array.isArray(caveat?.value) ? caveat.value : [];
  } catch {
    return [];
  }
}

export function ChainProvider({ children }) {
  const [selected, setSelected] = useState([]);   // what eth_accounts reports (one account)
  const [permitted, setPermitted] = useState([]); // every account MetaMask authorised for this site
  const [contractAddress, setContractAddress] = useState(() => localStorage.getItem(LS_ADDR) || "");
  const [roleMap, setRoleMap] = useState({});     // address -> admin | doctor | auditor | patient
  const [holders, setHolders] = useState({});     // role -> address, discovered from the chain
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const msgTimer = useRef(null);

  // Every account this site may act as, with the selected one first.
  const accounts = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const a of [...selected, ...permitted]) {
      const k = (a || "").toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(a);
    }
    return out;
  }, [selected, permitted]);
  const account = selected[0] || null;

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
    const apply = (sel, perm) => {
      if (Array.isArray(sel)) setSelected((prev) => (sameList(prev, sel) ? prev : sel));
      if (Array.isArray(perm)) setPermitted((prev) => (sameList(prev, perm) ? prev : perm));
    };

    const sync = async () => {
      try {
        const [sel, perm] = await Promise.all([
          eth.request({ method: "eth_accounts" }),
          readPermittedAccounts(eth),
        ]);
        apply(sel, perm);
      } catch { /* wallet locked, or mid-switch */ }
    };

    const onAccounts = (list) => apply(list);
    const onChain = () => window.location.reload();

    eth.on?.("accountsChanged", onAccounts);
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
      eth.removeListener?.("accountsChanged", onAccounts);
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
      const [list, perm] = await Promise.all([
        window.ethereum.request({ method: "eth_accounts" }),
        readPermittedAccounts(window.ethereum),
      ]);
      setSelected((prev) => (sameList(prev, list || []) ? prev : (list || [])));
      setPermitted((prev) => (sameList(prev, perm) ? prev : perm));
      say("ok", perm.length > 1
        ? `Wallet connected — ${perm.length} accounts authorised.`
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

  // MetaMask does not always expose every permitted account through eth_accounts,
  // so learn who holds each role from the contract's own events. Without this the
  // site cannot find the Doctor or Auditor wallet to switch to.
  const discoverHolders = useCallback(async () => {
    if (!isAddress(contractAddress)) {
      setHolders({});
      return {};
    }
    try {
      const c = await getContract(false);
      const provider = c.runner.provider || c.runner;
      const latest = await provider.getBlockNumber();
      const [ADMIN, MGR, AUD] = await Promise.all([
        c.DEFAULT_ADMIN_ROLE(), c.MANAGER_ROLE(), c.AUDITOR_ROLE(),
      ]);
      // MetaMask proxies eth_getLogs through its own RPC, which refuses wide
      // ranges. Start modest and shrink rather than failing silently.
      let events = null;
      for (const span of [10000, 3000, 500]) {
        const from = Math.max(0, latest - span);
        try {
          const [admins, managers, auditors, identities] = await Promise.all([
            c.queryFilter(c.filters.RoleGranted(ADMIN), from, latest),
            c.queryFilter(c.filters.RoleGranted(MGR), from, latest),
            c.queryFilter(c.filters.RoleGranted(AUD), from, latest),
            c.queryFilter(c.filters.IdentityCreated(), from, latest),
          ]);
          events = { admins, managers, auditors, identities };
          break;
        } catch { /* range rejected — try a narrower one */ }
      }
      if (!events) {
        setHolders({});
        return {};
      }
      const { admins, managers, auditors, identities } = events;
      const out = {};
      if (admins.length) out.admin = admins[admins.length - 1].args.account;
      if (managers.length) out.doctor = managers[managers.length - 1].args.account;
      if (auditors.length) out.auditor = auditors[auditors.length - 1].args.account;
      // The patient has no role — the label is the only on-chain clue.
      const patient = identities
        .map((e) => e.args)
        .find((a) => /patient/i.test(a.label || ""));
      if (patient) out.patient = patient.account;
      setHolders(out);
      return out;
    } catch {
      setHolders({});
      return {};
    }
  }, [contractAddress, getContract]);

  useEffect(() => { discoverHolders(); }, [discoverHolders, refreshKey]);

  // The connected wallet for a given page, if we have one. Prefer an account the
  // site can actually see; fall back to the address the chain says holds the role.
  const accountFor = useCallback(
    (page) => {
      const want = PAGE_ROLE[page];
      if (!want) return null;
      const known = accounts.find((a) => roleMap[a.toLowerCase()] === want);
      return known || holders[want] || null;
    },
    [accounts, roleMap, holders]
  );

  // MetaMask will not switch silently — the best any dapp can do is open its
  // account picker and let the user choose.
  const switchTo = useCallback(
    async (target) => {
      const eth = typeof window !== "undefined" ? window.ethereum : null;
      if (!eth) return say("err", "No wallet found.");
      const alreadyConnected = hasAddr(permitted, target);
      say("info", alreadyConnected
        ? `MetaMask is opening — choose ${short(target)} from the account list.`
        : `${short(target)} is not connected to this site. MetaMask is opening so you can add it.`);
      try {
        await eth.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      } catch {
        return say("info", "Account switch was dismissed. Use MetaMask's account selector instead.");
      }
      const [list, perm] = await Promise.all([
        eth.request({ method: "eth_accounts" }),
        readPermittedAccounts(eth),
      ]);
      setSelected((prev) => (sameList(prev, list || []) ? prev : (list || [])));
      setPermitted((prev) => (sameList(prev, perm) ? prev : perm));
      if (list?.[0]?.toLowerCase() === target.toLowerCase()) {
        say("ok", "Now acting as " + short(target) + ".");
      } else if (list?.[0]) {
        say("info",
          "MetaMask still has " + short(list[0]) + " selected — switch to " + short(target) +
          " in the account selector to use this page.");
      } else {
        say("info", "No account selected in MetaMask.");
      }
    },
    [say, permitted]
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
      account, accounts, permitted, contractAddress, roleMap, holders, busy, msg,
      connect, getContract, write, read, say, saveAddress,
      detectRoles, discoverHolders, accountFor, switchTo,
    }),
    [account, accounts, permitted, contractAddress, roleMap, holders, busy, msg, connect,
     getContract, write, read, say, detectRoles, discoverHolders, accountFor, switchTo]
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
