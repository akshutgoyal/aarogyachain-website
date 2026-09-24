import { useState } from "react";
import { isHexString, keccak256, toUtf8Bytes } from "ethers";
import { Link } from "react-router-dom";
import { useChain } from "../chain";
import { SetupCard, RoleGateNotice, Msg, Copyable, needAddr } from "../components";

export default function Admin() {
  const { getContract, write, read, say, busy } = useChain();
  const [idemAddr, setIdemAddr] = useState("");
  const [idemLabel, setIdemLabel] = useState("Patient 101");
  const [didAddr, setDidAddr] = useState("");
  const [did, setDid] = useState(null);
  const [mPatient, setMPatient] = useState("");
  const [mDigest, setMDigest] = useState("");
  const [mCid, setMCid] = useState("");
  const [mType, setMType] = useState("MRI_SCAN");
  const [minted, setMinted] = useState(null);
  const [revokeId, setRevokeId] = useState("");
  const [roleAddr, setRoleAddr] = useState("");
  const [rolePick, setRolePick] = useState("MANAGER");
  const [roleStatus, setRoleStatus] = useState(null);

  async function roleHashes(c) {
    return {
      admin: await c.DEFAULT_ADMIN_ROLE(),
      MANAGER: await c.MANAGER_ROLE(),
      AUDITOR: await c.AUDITOR_ROLE(),
    };
  }

  async function grantRoleNow() {
    const a = needAddr(roleAddr, say, "wallet address"); if (!a) return;
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const h = await roleHashes(c);
    const rc = await write(`grantRole(${rolePick})`, () => c.grantRole(h[rolePick], a));
    if (rc) checkRoles(a);
  }

  async function checkRoles(addr) {
    const a = needAddr(addr ?? roleAddr, say, "wallet address"); if (!a) return;
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const h = await roleHashes(c);
    const [admin, manager, auditor] = await Promise.all([
      c.hasRole(h.admin, a), c.hasRole(h.MANAGER, a), c.hasRole(h.AUDITOR, a),
    ]);
    const identity = await c.identities(a);
    setRoleStatus({ addr: a, admin, manager, auditor, label: identity[0], active: identity[2] });
  }

  async function deactivate() {
    const a = needAddr(roleAddr, say, "wallet address"); if (!a) return;
    if (!window.confirm(`Retire the identity for ${a}? History is kept — only the active flag flips — so the record of who existed is never erased.`)) return;
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const rc = await write("deactivateIdentity", () => c.deactivateIdentity(a));
    if (rc) checkRoles(a);
  }

  async function register() {
    const a = needAddr(idemAddr, say, "identity address"); if (!a) return;
    if (!idemLabel.trim()) return say("err", "Enter a role label — role titles only, never personal names.");
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    await write("createIdentity", () => c.createIdentity(a, idemLabel.trim()));
  }

  async function showDid() {
    const a = needAddr(didAddr, say); if (!a) return;
    const c = await getContract(false).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    setDid(null);
    const d = await read("didFor", () => c.didFor(a));
    if (d !== null) setDid(d);
  }

  function fillDemoDigest() {
    setMDigest(keccak256(toUtf8Bytes("encrypted-file-bytes")));
    setMCid("QmTestCid123");
    say("info", "Demo digest and CID filled in. In production the digest is keccak256 of the real encrypted file.");
  }

  async function mint() {
    const p = needAddr(mPatient, say, "patient address"); if (!p) return;
    const digest = mDigest.trim();
    if (!isHexString(digest, 32)) return say("err", "Digest must be a 32-byte hex string (0x + 64 hex chars).");
    if (!mCid.trim()) return say("err", "Enter the IPFS CID of the encrypted file.");
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const next = Number(await read("nextTokenId", () => c.nextTokenId()));
    const rc = await write("mintRecord", () => c.mintRecord(p, digest, mCid.trim(), mType));
    if (rc && next) setMinted({ id: next, tx: rc.hash, patient: p });
  }

  async function revoke() {
    const id = Number(revokeId);
    if (!Number.isInteger(id) || id < 1) return say("err", "Enter a valid token ID.");
    if (!window.confirm(`Permanently burn record #${id}? This is used when a patient's wallet is lost, and the burn event stays public forever.`)) return;
    const c = await getContract(true).catch((e) => { say("err", e.message); return null; });
    if (!c) return;
    const rc = await write("revokeRecord", () => c.revokeRecord(id));
    if (rc) say("ok", `Record #${id} invalidated on-chain. Next: mint a replacement to the patient's new wallet.`);
  }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Hospital IT — admin</h1>
        <span className="nav-tag">Admin role</span>
      </div>
      <p style={{ color: "var(--muted)" }}>
        The deployer wallet holds the admin role. Register identities, mint records to patients,
        revoke on wallet loss — and nothing else: even the admin cannot read a file without consent.
      </p>
      <RoleGateNotice page="admin" />
      <SetupCard page="admin" />
      <Msg />

      <div className="panel">
        <h2>1 · Register identity</h2>
        <p className="sub">Identity creation is itself an on-chain event (<span className="mono">IdentityCreated</span>) — the audit trail starts here.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Wallet address</label>
            <input placeholder="0x…" value={idemAddr} onChange={(e) => setIdemAddr(e.target.value)} />
          </div>
          <div className="field">
            <label>Role label</label>
            <select value={idemLabel} onChange={(e) => setIdemLabel(e.target.value)}>
              <option>Hospital IT</option><option>Cardiology</option><option>Lab Technician</option><option>Compliance</option><option>Patient 101</option>
            </select>
            <p className="hint">Labels are public on-chain — role titles only, never real names.</p>
          </div>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={register}>{busy ? "Working…" : "Register identity"}</button>
        </div>
      </div>

      <div className="panel">
        <h2>2 · Assign roles</h2>
        <p className="sub">The administrator grants Manager and Auditor rights. The Doctor gets <span className="mono">MANAGER_ROLE</span>, the Auditor gets <span className="mono">AUDITOR_ROLE</span> — without these, their calls revert.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Wallet address</label>
            <input placeholder="0x…" value={roleAddr} onChange={(e) => setRoleAddr(e.target.value)} />
          </div>
          <div className="field">
            <label>Role</label>
            <select value={rolePick} onChange={(e) => setRolePick(e.target.value)}>
              <option value="MANAGER">MANAGER_ROLE</option>
              <option value="AUDITOR">AUDITOR_ROLE</option>
            </select>
          </div>
        </div>
        <div className="actions">
          <button className="btn" disabled={busy} onClick={grantRoleNow}>{busy ? "Working…" : `Grant ${rolePick}`}</button>
          <button className="btn ghost" disabled={busy} onClick={() => checkRoles()}>{busy ? "Working…" : "Check roles"}</button>
          <button className="btn danger small" disabled={busy} onClick={deactivate}>Retire identity</button>
        </div>
        {roleStatus && (
          <dl className="kv">
            <dt>Wallet</dt><dd className="mono"><Copyable value={roleStatus.addr} /></dd>
            <dt>Identity label</dt><dd>{roleStatus.label || "—"} {roleStatus.active ? <span className="pill ok">active</span> : <span className="pill no">retired</span>}</dd>
            <dt>DEFAULT_ADMIN_ROLE</dt><dd>{roleStatus.admin ? <span className="pill ok">yes</span> : <span className="pill no">no</span>}</dd>
            <dt>MANAGER_ROLE</dt><dd>{roleStatus.manager ? <span className="pill ok">yes</span> : <span className="pill no">no</span>}</dd>
            <dt>AUDITOR_ROLE</dt><dd>{roleStatus.auditor ? <span className="pill ok">yes</span> : <span className="pill no">no</span>}</dd>
          </dl>
        )}
      </div>

      <div className="panel">
        <h2>3 · Resolve a DID</h2>
        <p className="sub">Free read. Shows the decentralized identifier derived from any wallet — no registry, no password database.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Wallet address</label>
            <input placeholder="0x…" value={didAddr} onChange={(e) => setDidAddr(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" disabled={busy} onClick={showDid}>{busy ? "Working…" : "Resolve DID"}</button>
        </div>
        {did && (<dl className="kv"><dt>DID</dt><dd className="mono"><Copyable value={did} label={did} /></dd></dl>)}
      </div>

      <div className="panel">
        <h2>4 · Mint a record NFT</h2>
        <p className="sub">Admin-only. The token is allocated to a registered patient identity and is soulbound from birth — it can never be transferred.</p>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Patient wallet address</label>
            <input placeholder="0x…" value={mPatient} onChange={(e) => setMPatient(e.target.value)} />
          </div>
          <div className="field">
            <label>Record type</label>
            <select value={mType} onChange={(e) => setMType(e.target.value)}>
              <option>MRI_SCAN</option><option>BLOOD_PANEL</option><option>PRESCRIPTION</option><option>DISCHARGE_SUMMARY</option><option>XRAY</option>
            </select>
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>32-byte digest — keccak256 of the encrypted file</label>
            <input className="mono" placeholder="0x…" value={mDigest} onChange={(e) => setMDigest(e.target.value)} />
          </div>
        </div>
        <div className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>IPFS CID of the encrypted file</label>
            <input className="mono" placeholder="Qm…" value={mCid} onChange={(e) => setMCid(e.target.value)} />
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost" disabled={busy} onClick={fillDemoDigest}>Fill demo values</button>
          <button className="btn" disabled={busy} onClick={mint}>{busy ? "Working…" : "Mint to patient"}</button>
        </div>
        {minted && (
          <dl className="kv">
            <dt>Minted token</dt><dd className="mono">#{minted.id}</dd>
            <dt>Owner</dt><dd className="mono">{minted.patient}</dd>
            <dt>Transaction</dt><dd className="mono"><Copyable value={minted.tx} /></dd>
            <dt>Next step</dt><dd>Switch to the <Link to="/patient">Patient page</Link> with that wallet to grant consent.</dd>
          </dl>
        )}
      </div>

      <div className="panel" style={{ borderColor: "var(--danger)" }}>
        <h2>5 · Revoke a record (lost wallet)</h2>
        <p className="sub">Burns the token and clears its data. Both the burn and the reissue stay public — history is never rewritten.</p>
        <div className="row"><div className="field"><label>Token ID</label><input value={revokeId} onChange={(e) => setRevokeId(e.target.value)} /></div></div>
        <div className="actions">
          <button className="btn danger" disabled={busy} onClick={revoke}>{busy ? "Working…" : "Revoke record"}</button>
        </div>
        <p className="btn-row-note">You will be asked to confirm — this cannot be undone.</p>
      </div>
    </div>
  );
}
