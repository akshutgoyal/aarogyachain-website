import { HashRouter, Routes, Route } from "react-router-dom";
import { ChainProvider } from "./chain";
import Nav from "./Nav";
import { Msg } from "./components";
import Home from "./pages/Home";
import Patient from "./pages/Patient";
import Doctor from "./pages/Doctor";
import Admin from "./pages/Admin";
import Auditor from "./pages/Auditor";
import Verify from "./pages/Verify";

export default function App() {
  return (
    <HashRouter>
      <ChainProvider>
        <Nav />
        <div className="global-msg"><Msg /></div>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/patient" element={<Patient />} />
          <Route path="/doctor" element={<Doctor />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/auditor" element={<Auditor />} />
          <Route path="/verify" element={<Verify />} />
        </Routes>
        <footer className="footer">
          <span>AarogyaChain — SIH 2026</span>
          <span>Contract: Solidity 0.8.24 · OpenZeppelin ERC-721 + AccessControl · ERC-5192 · Sepolia → Base L2</span>
          <span><i>Mongo answers quickly — the chain answers truthfully.</i></span>
        </footer>
      </ChainProvider>
    </HashRouter>
  );
}
