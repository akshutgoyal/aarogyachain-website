import { useState } from "react";
import { keccak256, toUtf8Bytes } from "ethers";
import { useChain } from "../chain";
import { SetupCard, RoleGateNotice, Msg, TokenHint, Copyable, needAddr, short } from "../components";

const DEMO_DIGEST = keccak256(toUtf8Bytes("encrypted-file-bytes"));

export default function Doctor() {
  const { account, getContract, write, read, say, busy } = useChain();
  const [patient, setPatient] = useState("");
  const [recordType, setRecordType] = useState("MRI_SCAN");
  const [tokenId, setTokenId] = useState("1");
  const [cid, setCid] = useState(null);
  const [emReason, setEmReason] = useState("");
  const [emToken, setEmToken] = useState("1");

  async function request() {
    const p = needAddr(patient, say, "patient address"); if (!p) return;
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const rc = await write("requestRecord", () => c.requestRecord(p, recordType));
    if (rc) {
      const ev = rc.logs?.find((l) => l.fragmentName === "RecordRequested");
      const id = ev?.args?.requestId;
      say("ok", `Request #${id ?? "?"} filed for ${short(p)} — the admin mints it next.`);
    }
  }

  async function view() {
    const id = Number(tokenId);
    if (!Number.isInteger(id) || id < 1) return say("err", "Enter a valid token ID.");
    if (!account) return say("err", "Connect your wallet first — the contract checks your address against the consent window.");
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    setCid(null);
    const allowed = await read("canAccess", () => c.canAccess(id, account));
    // State the caller explicitly: the contract gate is on msg.sender, and
    // MetaMask would otherwise substitute its own selected account.
    const v = await read("viewRecord", () => c.viewRecord(id, { from: account }));
    if (v !== null) {
      setCid(v);
      say("ok", allowed ? "File location released — your consent window is open." : "You are the record's owner, so the read is allowed without consent.");
    }
  }

  async function emergency() {
    const id = Number(emToken);
    if (!Number.isInteger(id) || id < 1) return say("err", "Enter a valid token ID.");
    if (!emReason.trim()) return say("err", "A reason is required — it is written to the chain permanently.");
    if (!account) return say("err", "Connect your wallet first.");
    if (!window.confirm("Emergency access is logged permanently on-chain with your wallet and this reason. Continue?")) return;
    const me = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!me) return;
    await write("emergencyAccess", () => me.emergencyAccess(id, account, emReason.trim()));
  }

  async function tryMint() {
    if (!account) return say("err", "Connect your wallet first.");
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    await write("mintRecord (as Doctor)", () => c.mintRecord(account, DEMO_DIGEST, "QmBlockedAttempt", "XRAY"));
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Doctor console</h1>
        <span className="nav-tag">Doctor · Manager role</span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        Request records, open files while the patient's consent is valid, and break glass in a
        genuine emergency. Every action lands on-chain — the lab requests, the admin mints.
      </p>
      <RoleGateNotice page="doctor" />
      <SetupCard page="doctor" />
      <Msg />
      <TokenHint />

      <div className="panel">
        <h2>1 · Request a record</h2>
        <p className="sub">Requires the Manager role. This files a request event — it does not create the NFT.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Patient wallet address</label>
            <input placeholder="0x…" value={patient} onChange={(e) => setPatient(e.target.value)} />
            {account && <p className="btn-row-note">Paste quickly: <Copyable value={account} label="use my address" /></p>}
          </div>
          <div className="field">
            <label>Record type</label>
            <select value={recordType} onChange={(e) => setRecordType(e.target.value)}>
              <option>MRI_SCAN</option><option>BLOOD_PANEL</option><option>PRESCRIPTION</option><option>DISCHARGE_SUMMARY</option><option>XRAY</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={request}>{busy ? "Working…" : "Request record"}</button>
        </div>
      </div>

      <div className="panel">
        <h2>2 · View a record file</h2>
        <p className="sub">The contract releases the file location only while your consent window is open. Otherwise it reverts — <span className="mono">AccessDenied</span> if you never had consent, <span className="mono">Expired</span> if the window closed.</p>
        <div className="row">
          <div className="field"><label>Token ID</label><input value={tokenId} onChange={(e) => setTokenId(e.target.value)} /></div>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={view}>{busy ? "Working…" : "View record"}</button>
        </div>
        {cid && (
          <dl className="kv">
            <dt>File location</dt><dd className="mono"><Copyable value={cid} label={cid} /></dd>
            <dt>Next step</dt><dd>Fetch the encrypted file from IPFS, then decrypt locally — your key unwraps it, our server never could.</dd>
          </dl>
        )}
      </div>

      <div className="panel" style={{ borderColor: "var(--warn)" }}>
        <h2>3 · Emergency break-glass</h2>
        <p className="sub">One record, one hour, your own wallet — and the reason is recorded permanently. Not preventable, but never invisible.</p>
        <div className="row">
          <div className="field"><label>Token ID</label><input value={emToken} onChange={(e) => setEmToken(e.target.value)} /></div>
          <div className="field" style={{ flex: 2 }}>
            <label>Reason (goes on-chain, permanently)</label>
            <input placeholder="e.g. unconscious patient, ER night shift" value={emReason} onChange={(e) => setEmReason(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn warn" disabled={busy} onClick={emergency}>{busy ? "Working…" : "Use emergency access"}</button>
        </div>
        <p className="btn-row-note">You will be asked to confirm — this event can never be deleted.</p>
      </div>

      <div className="panel" style={{ borderColor: "var(--danger)" }}>
        <h2>4 · Prove the admin gate</h2>
        <p className="sub">This button deliberately calls <span className="mono">mintRecord</span> from your Doctor wallet. The website does not block it — the contract does. Expect a revert.</p>
        <div className="actions">
          <button className="btn danger" disabled={busy} onClick={tryMint}>{busy ? "Working…" : "Try to mint as Doctor"}</button>
        </div>
        <p className="btn-row-note">A revert here is the demo working: issuing records is reserved for the administrator.</p>
      </div>
    </div>
  );
}
