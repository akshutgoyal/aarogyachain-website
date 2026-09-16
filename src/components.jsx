import { useEffect, useRef, useState } from "react";
import { useChain, normAddr, PAGE_ROLE, ROLE_LABEL, short } from "./chain";

// Still re-exported from here — the page components import it by this path.
export { short };

export function Msg() {
  const { msg } = useChain();
  if (!msg) return null;
  return <div className={`status ${msg.kind}`}>{msg.text}</div>;
}

export function Copyable({ value, label }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch { /* clipboard unavailable */ }
  }
  return (
    <span className="copywrap">
      <span className="mono" title={value}>{label || short(value)}</span>
      <button className="copybtn" onClick={copy} title="Copy">{done ? "copied ✓" : "copy"}</button>
    </span>
  );
}

export function RoleGateNotice() {
  return null;
}

/**
 * Shows the readiness of this page and, when the connected wallet is not the one
 * this page needs, asks MetaMask to switch to it.
 */
export function SetupCard({ page }) {
  const { account, accounts, contractAddress, saveAddress, connect, roleMap, accountFor, switchTo, say } = useChain();
  const [open, setOpen] = useState(false);
  const triedRef = useRef(null);

  const want = PAGE_ROLE[page];
  const target = accountFor(page);
  const myRole = account ? roleMap[account.toLowerCase()] : null;
  const roleOk = !want || myRole === want;
  const walletReady = !!account && roleOk;

  // Ask MetaMask to switch, once per page + target, whenever it would help.
  useEffect(() => {
    if (!want || !account || roleOk || !target) return;
    const key = page + ":" + target.toLowerCase();
    if (triedRef.current === key) return;
    triedRef.current = key;
    say("info", `This page needs the ${ROLE_LABEL[want]} wallet (${short(target)}) — asking MetaMask to switch…`);
    switchTo(target);
  }, [want, account, roleOk, target, page, switchTo, say]);

  const checks = [
    { ok: !!contractAddress, text: "Contract address set" },
    { ok: !!account, text: account ? `Wallet connected — ${short(account)}` : "Wallet connected" },
    { ok: !!account, text: "On Sepolia testnet", soft: !account },
    {
      ok: roleOk,
      text: !want
        ? "Any wallet works on this page"
        : roleOk
          ? `${ROLE_LABEL[want]} wallet in use`
          : `Connected wallet is ${myRole ? ROLE_LABEL[myRole] : "not registered"}; this page needs the ${ROLE_LABEL[want]}`,
    },
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <div className="panel setup">
      <div className="summary" onClick={() => setOpen(!open)}>
        <span className={`dot ${allOk ? "ok" : "wait"}`} />
        <b>{allOk ? "Ready" : "Setup needed"}</b>
        <span className="sub" style={{ margin: 0 }}>
          {contractAddress ? "contract set" : "no contract"} ·{" "}
          {account ? short(account) : "wallet disconnected"}
          {want ? ` · this page needs the ${ROLE_LABEL[want]} wallet` : ""}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--muted)" }}>{open ? "hide ▲" : "show ▼"}</span>
      </div>

      {open && (
        <>
          <ul className="checks">
            {checks.map((c, i) => (
              <li key={i}>
                <span className={`dot ${c.ok ? "ok" : "wait"}`} /> {c.text}
              </li>
            ))}
          </ul>
          <div className="row" style={{ marginTop: 12 }}>
            <div className="field" style={{ flex: 2 }}>
              <label>Contract address (Sepolia)</label>
              <input placeholder="0x…" value={contractAddress} onChange={(e) => saveAddress(e.target.value.trim())} />
            </div>
            <div className="field">
              <label>Wallet</label>
              <div style={{ paddingTop: 6 }}>
                {account ? <Copyable value={account} /> : <button className="btn" onClick={connect}>Connect wallet</button>}
              </div>
            </div>
          </div>
          {!contractAddress && (
            <div className="status info">Paste the deployed contract address above. It is remembered on this device.</div>
          )}
        </>
      )}

      {/* The one wallet this page wants, with a switch offer. */}
      {want && account && !roleOk && (
        <div className="status info" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {target ? (
            <>
              <span>
                This page runs as the <b>{ROLE_LABEL[want]}</b> — that is <span className="mono">{short(target)}</span>.
              </span>
              <button className="btn" onClick={() => switchTo(target)}>Switch to {ROLE_LABEL[want]}</button>
            </>
          ) : (
            <span>
              No connected wallet holds the <b>{ROLE_LABEL[want]}</b> role yet.
              {page === "admin"
                ? " Deploy from the admin wallet, or connect it in MetaMask."
                : " Grant it on the Admin page first, then come back."}
            </span>
          )}
        </div>
      )}

      {want && !account && accounts.length > 0 && (
        <div className="status info">
          {accounts.length} wallet{accounts.length > 1 ? "s" : ""} already authorised — open the Wallet field above and connect.
        </div>
      )}
    </div>
  );
}

export function TokenHint() {
  const { contractAddress, getContract, say } = useChain();
  const [range, setRange] = useState(null);
  useEffect(() => {
    let live = true;
    (async () => {
      if (!contractAddress) return setRange(null);
      try {
        const c = await getContract(false);
        const n = Number(await c.nextTokenId());
        if (live) setRange(n > 1 ? `1–${n - 1}` : null);
      } catch { if (live) setRange(null); }
    })();
    return () => { live = false; };
  }, [contractAddress, getContract, say]);

  if (!contractAddress) return null;
  return (
    <p className="hint">
      {range ? <>Records minted so far — valid token IDs: <b className="mono">{range}</b>.</> : "No records minted yet. Ask the Admin to mint one first."}
    </p>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="chips">
      {options.map((o) => (
        <button key={o.value} className={`chip ${String(o.value) === String(value) ? "active" : ""}`} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function needAddr(v, say, what = "address") {
  const a = normAddr(v || "");
  if (!a) say("err", "Enter a valid " + what + ".");
  return a;
}
