// Minimal ABI: only the functions the UI calls. Matches contract/AarogyaChain.sol.
export const ABI = [
  "function createIdentity(address account, string label)",
  "function deactivateIdentity(address account)",
  "function didFor(address account) view returns (string)",
  "function identities(address) view returns (string label, uint64 createdAt, bool active)",
  "function requestRecord(address patient, string recordType) returns (uint256)",
  "function emergencyAccess(uint256 tokenId, address viewer, string reason)",
  "function mintRecord(address patient, bytes32 recordHash, string cid, string recordType) returns (uint256)",
  "function revokeRecord(uint256 tokenId)",
  "function grantAccess(uint256 tokenId, address viewer, uint64 durationSeconds)",
  "function revokeAccess(uint256 tokenId, address viewer)",
  "function canAccess(uint256 tokenId, address viewer) view returns (bool)",
  "function viewRecord(uint256 tokenId) view returns (string)",
  "function verifyRecord(uint256 tokenId, bytes32 fileHash) view returns (bool)",
  "function auditRecord(uint256 tokenId) view returns (bytes32 recordHash, string recordType, uint64 mintedAt, address owner)",
  "function locked(uint256 tokenId) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function transferFrom(address from, address to, uint256 tokenId)",
  "function approve(address to, uint256 tokenId)",
  "function consent(uint256, address) view returns (uint64)",
  "function nextTokenId() view returns (uint256)",
  "function nextRequestId() view returns (uint256)",
  "function hasRole(bytes32 role, address account) view returns (bool)",
  "function grantRole(bytes32 role, address account)",
  "function MANAGER_ROLE() view returns (bytes32)",
  "function AUDITOR_ROLE() view returns (bytes32)",
  "function DEFAULT_ADMIN_ROLE() view returns (bytes32)",
  "event RecordRequested(uint256 indexed requestId, address indexed requester, address indexed patient, string recordType)",
  "event RecordMinted(uint256 indexed tokenId, address indexed patient, bytes32 recordHash, string recordType)",
  "event AccessGranted(uint256 indexed tokenId, address indexed viewer, uint64 expiresAt)",
  "event AccessRevoked(uint256 indexed tokenId, address indexed viewer)",
  "event EmergencyAccessUsed(uint256 indexed tokenId, address indexed viewer, string reason, uint64 expiresAt)",
  "event RecordRevoked(uint256 indexed tokenId, address indexed admin)",

  // Custom errors. Without these ethers cannot decode a revert and all you get
  // is "execution reverted (unknown custom error)".
  "error NotAuthorized()",
  "error AccessDenied()",
  "error Expired()",
  "error RecordNotFound()",
  "error IdentityExists()",
  "error IdentityNotFound()",
  "error AccessControlUnauthorizedAccount(address account, bytes32 neededRole)",
  "error AccessControlBadConfirmation()",
  "error ERC721NonexistentToken(uint256 tokenId)",
  "error ERC721InsufficientApproval(address operator, uint256 tokenId)",
  "error ERC721InvalidReceiver(address receiver)",
  "error ReentrancyGuardReentrantCall()",
];

export const ROLES = {
  admin:   { label: "Admin",   desc: "Hospital IT — registers identities, mints & revokes records" },
  doctor:  { label: "Doctor",  desc: "Manager — requests records, views with consent, emergency break-glass" },
  auditor: { label: "Auditor", desc: "Compliance — metadata-only audit view, never the file" },
  patient: { label: "Patient", desc: "Record owner — grants & revokes time-boxed access" },
};

export const SEPOLIA_CHAIN_ID = 11155111n;
