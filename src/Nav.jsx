import { Link, NavLink } from "react-router-dom";
import { useChain, short, ROLE_LABEL } from "./chain";

function CopyAddr({ value }) {
  async function copy() {
    try { await navigator.clipboard.writeText(value); } catch { /* ignore */ }
  }
  return (
    <span className="wallet-pill" title={value}>
      <span className="okdot" />
      <span className="nav-tag" title="Connected network">Sepolia</span>
      <span>{short(value)}</span>
      <button className="copybtn" onClick={copy} title="Copy full address">copy</button>
    </span>
  );
}

export default function Nav() {
  const { account, contractAddress, roleMap, connect } = useChain();

  // The badge reflects what this wallet actually holds on-chain, not the page you
  // are on. With no contract address there is nothing to read, so say so rather
  // than implying the wallet has no role.
  const detected = account && contractAddress ? roleMap[account.toLowerCase()] : null;

  return (
    <nav className="nav">
      <Link to="/" style={{ textDecoration: "none", color: "inherit" }} className="brand">
        Aarogya<span>Chain</span>
      </Link>
      <div className="nav-links">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>Home</NavLink>
        <NavLink to="/patient" className={({ isActive }) => (isActive ? "active" : "")}>Patient</NavLink>
        <NavLink to="/doctor" className={({ isActive }) => (isActive ? "active" : "")}>Doctor</NavLink>
        <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Admin</NavLink>
        <NavLink to="/auditor" className={({ isActive }) => (isActive ? "active" : "")}>Auditor</NavLink>
        <NavLink to="/verify" className={({ isActive }) => (isActive ? "active" : "")}>Verify</NavLink>
      </div>
      <div className="nav-right">
        {account && (
          <span className="demo-as">
            {contractAddress ? (
              <>
                Connected as{" "}
                {detected
                  ? <span className={`role-badge ${detected}`}>{ROLE_LABEL[detected]}</span>
                  : <span className="role-badge">No role</span>}
              </>
            ) : (
              <>Roles unknown — set the contract address</>
            )}
          </span>
        )}
        {account ? (
          <CopyAddr value={account} />
        ) : (
          <button className="btn" onClick={connect}>Connect wallet</button>
        )}
      </div>
    </nav>
  );
}
