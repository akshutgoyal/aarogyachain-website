import { useEffect, useState } from "react";
import { useChain, normAddr } from "./chain";

export function Msg() {
  const { msg } = useChain();
  if (!msg) return null;
  return <div className={`status ${msg.kind}`}>{msg.text}</div>;
}

export function short(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
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

const PAGE_ROLE = { admin: "admin", doctor: "doctor", auditor: "auditor", patient: "patient" };

export function RoleGateNotice() {
  return null;
}

export function SetupCard({ page }) {
  const { account, contractAddress, saveAddress, connect, role } = useChain();
  const [open, setOpen] = useState(!(contractAddress && account));
  const needed = PAGE_ROLE[page];
  const roleOk = !needed || role === needed;

  const checks = [
    { ok: !!contractAddress, text: "Contract address set" },
    { ok: !!account, text: account ? "Wallet connected — " + short(account) : "Wallet connected" },
    { ok: !!account, text: "On Sepolia testnet", soft: !account },
    { ok: roleOk, text: roleOk ? "Demo role matches this page" : `Demo role is "${role}", this page needs "${needed}"` },
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <div className="panel setup">
      <div className="summary" onClick={() => setOpen(!open)}>
        <span className={`dot ${allOk ? "ok" : "wait"}`} />
        <b>{allOk ? "Ready" : "Setup needed"}</b>
        <span className="sub" style={{ margin: 0 }}>
          {contractAddress ? "contract set" : "no contract"} · {account ? short(account) : "wallet disconnected"} · demoing as {role}
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
            <div className="status info">Deploy via Remix first (see contract/README.md), then paste the address here. It is remembered on this device.</div>
          )}
        </>
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
