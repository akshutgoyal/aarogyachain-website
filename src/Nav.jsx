import { Link, NavLink, useLocation } from "react-router-dom";
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
  const { pathname } = useLocation();

  // The nav demos whichever page you are on — the badge just reflects it.
  useEffect(() => {
    const seg = pathname.split("/")[1];
    if (seg && ROLES[seg] && seg !== role) saveRole(seg);
  }, [pathname, role, saveRole]);
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
        {role !== "verify" && (
          <span className="demo-as">Currently <span className={`role-badge ${role}`}>{ROLES[role].label}</span></span>
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
