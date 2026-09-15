import { useState } from "react";
import { useChain } from "../chain";
import { SetupCard, RoleGateNotice, Msg, TokenHint, Copyable } from "../components";

export default function Auditor() {
  const { getContract, read, say, busy } = useChain();
  const [tokenId, setTokenId] = useState("1");
  const [result, setResult] = useState(null);

  async function audit() {
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1) return say("err", "Enter a valid token ID.");
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    setResult(null);
    const r = await read("auditRecord", () => c.auditRecord(id));
    if (r === null) return;
    setResult({ hash: r[0], type: r[1], mintedAt: new Date(Number(r[2]) * 1000).toLocaleString(), owner: r[3] });
    say("ok", "Metadata retrieved. Notice what is missing: the file location is never released to an auditor.");
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Auditor view</h1>
        <span className="nav-tag">Auditor role</span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        Requires the Auditor role. Metadata only — the contract never releases the file location to
        an auditor. Try it from a non-auditor wallet and watch it revert.
      </p>
      <RoleGateNotice page="auditor" />
      <SetupCard page="auditor" />
      <Msg />
      <TokenHint />

      <div className="panel">
        <h2>Audit one record</h2>
        <div className="row">
          <div className="field"><label>Token ID</label><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} /></div>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={audit}>{busy ? "Working…" : "Audit record"}</button>
        </div>
        {result && (
          <dl className="kv">
            <dt>On-chain digest</dt><dd className="mono"><Copyable value={result.hash} label={result.hash.slice(0, 18) + "…"} /></dd>
            <dt>Record type</dt><dd>{result.type}</dd>
            <dt>Minted</dt><dd>{result.mintedAt}</dd>
            <dt>Owner</dt><dd className="mono"><Copyable value={result.owner} /></dd>
            <dt>File location</dt><dd><span className="pill no">never released</span></dd>
          </dl>
        )}
      </div>

      <div className="panel">
        <h2>What an auditor can and cannot see</h2>
        <table className="tbl">
          <thead><tr><th>Field</th><th>Visible?</th></tr></thead>
          <tbody>
            <tr><td>Content digest (32 bytes)</td><td><span className="pill ok">yes</span></td></tr>
            <tr><td>Record type</td><td><span className="pill ok">yes</span></td></tr>
            <tr><td>Mint time &amp; owner</td><td><span className="pill ok">yes</span></td></tr>
            <tr><td>File location (CID)</td><td><span className="pill no">never</span></td></tr>
            <tr><td>Decrypted file</td><td><span className="pill no">never</span></td></tr>
          </tbody>
        </table>
        <p className="hint">The auditor is read-only because the role holds no write functions — enforcement, not convention.</p>
      </div>
    </div>
  );
}
