import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="page">
      <div className="hero">
        <h1>Medical records the <span>patient actually owns</span></h1>
        <p>
          AarogyaChain turns each record into a soulbound NFT owned by the patient.
          Login is the wallet (DID), permission is a smart contract, and consent
          expires on its own. <i>Mongo answers quickly — the chain answers truthfully.</i>
        </p>
        <div className="cta-row">
          <Link to="/patient"><button className="btn ghost">I am a patient</button></Link>
          <Link to="/doctor"><button className="btn ghost">I am a doctor</button></Link>
          <Link to="/verify"><button className="btn ghost">Verify a record</button></Link>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>🪪 Login = wallet (DID)</h3>
          <p>Hospital IT registers each identity on-chain. The identifier is derived from the key — <span className="mono">did:ethr:&lt;chain&gt;:&lt;address&gt;</span> — so there is no password database to breach.</p>
          <Link className="go" to="/admin">Register identities →</Link>
        </div>
        <div className="card">
          <h3>🎟️ Record = soulbound NFT</h3>
          <p>Only the admin mints. Each token lands in the patient's wallet and can never move — transfers revert at the contract level (ERC-5192).</p>
          <Link className="go" to="/admin">Mint a record →</Link>
        </div>
        <div className="card">
          <h3>⏱️ Permission = expiring consent</h3>
          <p>The patient grants a doctor a 24-hour window. The contract enforces expiry — after that the read itself reverts, no revoke needed.</p>
          <Link className="go" to="/patient">Manage consent →</Link>
        </div>
        <div className="card">
          <h3>🔍 Verification is free</h3>
          <p>Re-hash the file, compare with the 32-byte on-chain digest. Match means authentic, mismatch means tampered — anyone can check, at no cost.</p>
          <Link className="go" to="/verify">Verify now →</Link>
        </div>
      </div>

      <div className="panel">
        <h2>How a record moves through the system</h2>
        <p className="sub">The same loop shown on slide 3 of the deck.</p>
        <ol className="steps">
          <li><b>Identity registered</b> — admin calls <span className="mono">createIdentity</span> for patient, doctor, auditor.</li>
          <li><b>Lab uploads &amp; encrypts</b> — the file goes to IPFS; only the <span className="mono">keccak256</span> digest goes on-chain.</li>
          <li><b>Admin mints</b> — the soulbound NFT is allocated to the patient's wallet. Anyone else's attempt reverts.</li>
          <li><b>Patient grants consent</b> — <span className="mono">grantAccess(tokenId, doctor, 86400)</span>. One action, one day.</li>
          <li><b>Doctor views</b> — the contract releases the file location only while consent is valid.</li>
          <li><b>Anyone verifies</b> — re-hash and compare. Every step emitted an event, so the audit trail builds itself.</li>
        </ol>
      </div>
    </div>
  );
}
