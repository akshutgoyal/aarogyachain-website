import { useState } from "react";
import { isHexString, keccak256, toUtf8Bytes } from "ethers";
import { useChain } from "../chain";
import { SetupCard, Msg } from "../components";

const DEMO_DIGEST = keccak256(toUtf8Bytes("encrypted-file-bytes"));

export default function Verify() {
  const { contractAddress, getContract, read, say, busy } = useChain();
  const [tokenId, setTokenId] = useState("1");
  const [digest, setDigest] = useState("");
  const [verdict, setVerdict] = useState(null); // true | false | null

  async function check() {
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1) return say("err", "Enter a valid token ID.");
    const d = digest.trim();
    if (!isHexString(d, 32)) return say("err", "Digest must be a 32-byte hex string (0x + 64 hex chars).");
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    setVerdict(null);
    const v = await read("verifyRecord", () => c.verifyRecord(id, d));
    if (v === null) return;
    setVerdict(v);
    say(v ? "ok" : "err", v
      ? "MATCH — the file is authentic. It hashes to exactly what is on-chain."
      : "MISMATCH — this file does not hash to the on-chain digest. It was altered, or it is the wrong file.");
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Verify a record</h1>
        <span className="nav-tag">Open to anyone</span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        Free, permissionless, trustless — no wallet needed to ask. Paste the digest of any file and
        the contract answers match or mismatch, without ever revealing the record.
      </p>
      <SetupCard page="verify" />
      <Msg />

      <div className="panel">
        <h2>Check authenticity</h2>
        <div className="row">
          <div className="field"><label>Token ID</label><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} /></div>
          <div className="field" style={{ flex: 3 }}>
            <label>Digest to check — keccak256 of the file</label>
            <input className="mono" placeholder="0x…" value={digest} onChange={(e) => setDigest(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" disabled={busy} onClick={() => { setDigest(DEMO_DIGEST); say("info", "Demo digest filled — it matches what 'Fill demo values' mints on the Admin page."); }}>Fill demo digest</button>
          <button className="btn" disabled={busy} onClick={check}>{busy ? "Checking…" : "Verify"}</button>
        </div>
        {verdict !== null && (
          <div style={{ marginTop: 16 }}>
            {verdict
              ? <span className="pill ok" style={{ fontSize: 15, padding: "8px 18px" }}>✓ AUTHENTIC</span>
              : <span className="pill no" style={{ fontSize: 15, padding: "8px 18px" }}>✗ TAMPERED / WRONG FILE</span>}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>How verification works</h2>
        <ol className="steps">
          <li>Fetch the encrypted file from IPFS using its CID.</li>
          <li>Compute <b><span className="mono">keccak256(file)</span></b> locally — in production the site does this in your browser.</li>
          <li>Call <b><span className="mono">verifyRecord(tokenId, digest)</span></b> — a free <span className="mono">view</span> call.</li>
          <li><b>True</b> means byte-identical to what was minted. <b>False</b> means altered. There is no partial match.</li>
        </ol>
        {contractAddress && (
          <p className="hint">
            Inspect the contract: <a href={`https://sepolia.etherscan.io/address/${contractAddress}`} target="_blank" rel="noreferrer">view on Sepolia Etherscan</a>
          </p>
        )}
      </div>
    </div>
  );
}
