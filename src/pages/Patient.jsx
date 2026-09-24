import { useState } from "react";
import { useChain, normAddr } from "../chain";
import { SetupCard, RoleGateNotice, Msg, Empty, Chips, Copyable, needAddr, short } from "../components";

const DURATIONS = [
  { label: "1 hour", value: "1" },
  { label: "24 hours", value: "24" },
  { label: "7 days", value: "168" },
  { label: "30 days", value: "720" },
];

export default function Patient() {
  const { account, getContract, write, read, say, busy } = useChain();
  const [tokenId, setTokenId] = useState("1");
  const [viewer, setViewer] = useState("");
  const [hours, setHours] = useState("24");
  const [grants, setGrants] = useState([]);
  const [mine, setMine] = useState([]);
  const [scanning, setScanning] = useState(false);

  const tid = () => {
    const n = Number(tokenId);
    if (!Number.isInteger(n) || n < 1) { say("err", "Enter a valid token ID."); return null; }
    return n;
  };

  async function grant() {
    const id = tid(); const v = needAddr(viewer, say, "doctor address"); if (id == null || !v) return;
    const secs = Math.max(1, Math.round(Number(hours) * 3600));
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const rc = await write("grantAccess", () => c.grantAccess(id, v, secs));
    if (rc) {
      const expiry = new Date(Date.now() + secs * 1000).toLocaleString();
      setGrants((g) => [{ token: id, viewer: v, expiry, tx: rc.hash }, ...g]);
    }
  }

  async function revoke(g) {
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const rc = await write("revokeAccess", () => c.revokeAccess(g.token, g.viewer));
    if (rc) setGrants((list) => list.filter((x) => !(x.token === g.token && x.viewer === g.viewer)));
  }

  async function myRecords() {
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    if (!account) return say("err", "Connect your wallet first.");
    setScanning(true);
    try {
      const next = Number(await read("nextTokenId", () => c.nextTokenId()));
      const found = [];
      for (let id = 1; id < next && id <= 25; id++) {
        try {
          const owner = await c.ownerOf(id);
          if (owner.toLowerCase() === account.toLowerCase()) {
            let isLocked = null;
            try { isLocked = await c.locked(id); } catch { /* pre-5192 */ }
            // Read as this wallet explicitly, so the contract sees the owner.
            found.push({ id, cid: await c.viewRecord(id, { from: account }), locked: isLocked });
          }
        } catch { /* burned or not ours */ }
      }
      setMine(found);
      say(found.length ? "ok" : "info", found.length ? `Found ${found.length} record(s) owned by this wallet.` : "No records owned by this wallet (checked the first 25 tokens).");
    } finally {
      setScanning(false);
    }
  }

  async function tryTransfer() {
    const id = tid(); if (id == null) return;
    if (!account) return say("err", "Connect your wallet first.");
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const dest = viewer.trim() || "0x000000000000000000000000000000000000dEaD";
    await write("transferFrom", () => c.transferFrom(account, dest, id));
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>My records</h1>
        <span className="nav-tag">Patient</span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        Every record NFT lives in your wallet — the hospital cannot move or take it back.
        Grant a doctor a time-boxed window; the contract enforces expiry automatically.
      </p>
      <RoleGateNotice page="patient" />
      <SetupCard page="patient" />
      <Msg />

      <div className="panel">
        <h2>Grant consent</h2>
        <p className="sub">Pick the record, name the doctor's wallet, choose how long — that's it. Revoke any time with one click.</p>
        <div className="row">
          <div className="field"><label>Token ID</label><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} /></div>
          <div className="field" style={{ flex: 2 }}>
            <label>Doctor's wallet address</label>
            <input placeholder="0x…" value={viewer} onChange={(e) => setViewer(e.target.value)} />
            {account && (
              <p className="btn-row-note">Paste quickly: <Copyable value={account} label="use my address" /></p>
            )}
          </div>
        </div>
        <div className="field">
          <label>Access duration</label>
          <Chips options={DURATIONS} value={hours} onChange={setHours} />
          <p className="hint">Contract-enforced: after {hours}h the read reverts on its own — nobody has to remember to revoke.</p>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={grant}>{busy ? "Working…" : "Grant access"}</button>
        </div>

        {grants.length > 0 ? (
          <table className="tbl">
            <thead><tr><th>Token</th><th>Doctor</th><th>Expires</th><th></th></tr></thead>
            <tbody>
              {grants.map((g, i) => (
                <tr key={i}>
                  <td className="mono">#{g.token}</td>
                  <td className="mono">{short(g.viewer)}</td>
                  <td>{g.expiry}</td>
                  <td><button className="btn danger small" disabled={busy} onClick={() => revoke(g)}>Revoke</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No active grants in this session. Grants you make appear here with a one-click revoke.</Empty>
        )}
      </div>

      <div className="panel">
        <h2>Records I own</h2>
        <p className="sub">Scans the first 25 tokens for NFTs held by your wallet and shows the file location only you can read.</p>
        <div className="actions">
          <button className="btn ghost" disabled={busy || scanning} onClick={myRecords}>{scanning ? "Scanning…" : "Find my records"}</button>
        </div>
        {mine.length > 0 ? (
          <table className="tbl">
            <thead><tr><th>Token</th><th>File location (CID)</th><th>ERC-5192</th></tr></thead>
            <tbody>{mine.map((m) => (
              <tr key={m.id}>
                <td className="mono">#{m.id}</td>
                <td className="mono"><Copyable value={m.cid} label={m.cid} /></td>
                <td>{m.locked ? <span className="pill ok">locked · soulbound</span> : <span className="pill wait">—</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        ) : (
          <Empty>Nothing scanned yet — click "Find my records".</Empty>
        )}
      </div>

      <div className="panel" style={{ borderColor: "var(--danger)" }}>
        <h2>Prove the record cannot move</h2>
        <p className="sub">You own this NFT — and even you cannot transfer it. This calls <span className="mono">transferFrom</span> on your own record. The website does not block it; the contract does. Expect a revert.</p>
        <div className="actions">
          <button className="btn danger" disabled={busy} onClick={tryTransfer}>{busy ? "Working…" : "Try to transfer my record"}</button>
        </div>
        <p className="btn-row-note">A revert here is the point: a medical record should never be tradeable. The recipient used is the address in the consent panel above, or a burn address if that is empty.</p>
      </div>
    </div>
  );
}
