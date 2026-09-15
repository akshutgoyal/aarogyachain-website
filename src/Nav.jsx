import { Link, NavLink } from "react-router-dom";
import { useEffect } from "react";
import { useChain } from "./chain";
import { ROLES } from "./contract";

function short(a) {
  return a ? a.slice(0, 6) + "…" + a.slice(-4) : "";
}

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
  const { account, role, saveRole, connect } = useChain();

  // The badge demos whichever page you are on — read the real path from the hash.
  const path = typeof window !== "undefined" ? window.location.hash.replace(/^#/, "") : "";
  const seg = path.split("/")[1];
  useEffect(() => {
    if (seg && ROLES[seg] && seg !== role) saveRole(seg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seg]);
  const shown = seg && ROLES[seg] ? seg : role;
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
        {shown !== "verify" && (
          <span className="demo-as">Currently <span className={`role-badge ${shown}`}>{ROLES[shown].label}</span></span>
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
