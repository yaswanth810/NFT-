// src/utils/pinata.js
// ─────────────────────────────────────────────────────────────────────────────
// Pinata IPFS upload utilities
// Prefers JWT auth (VITE_PINATA_JWT) — falls back to API key + secret pair
// ─────────────────────────────────────────────────────────────────────────────

const PINATA_BASE  = "https://api.pinata.cloud";
const JWT          = (import.meta.env.VITE_PINATA_JWT        || "").trim();
const API_KEY      = (import.meta.env.VITE_PINATA_API_KEY    || "").trim();
const API_SECRET   = (import.meta.env.VITE_PINATA_SECRET     || "").trim();

/** Build auth headers — JWT is preferred over API key/secret */
function authHeaders() {
  if (JWT) {
    return { Authorization: `Bearer ${JWT}` };
  }
  if (API_KEY && API_SECRET) {
    return {
      pinata_api_key:        API_KEY,
      pinata_secret_api_key: API_SECRET,
    };
  }
  throw new Error(
    "Pinata credentials not configured. Add VITE_PINATA_JWT (or VITE_PINATA_API_KEY + VITE_PINATA_SECRET) to frontend/.env"
  );
}

/**
 * Upload a File object to Pinata (pinFileToIPFS).
 * @param   {File}    file  — image or any file
 * @param   {string}  name  — optional pin name shown in Pinata dashboard
 * @returns {Promise<string>} IPFS CID  (e.g. "QmXyz...")
 */
export async function uploadFileToPinata(file, name = "") {
  const formData = new FormData();
  formData.append("file", file);

  if (name) {
    formData.append("pinataMetadata", JSON.stringify({ name }));
  }

  // NOTE: do NOT set Content-Type manually — browser sets it with the boundary
  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method:  "POST",
    headers: authHeaders(),
    body:    formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Pinata file upload failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return data.IpfsHash;   // CID string
}

/**
 * Upload a plain JSON object to Pinata (pinJSONToIPFS).
 * @param   {object}  json  — NFT metadata { name, description, image, ... }
 * @param   {string}  name  — optional pin name
 * @returns {Promise<string>} IPFS CID
 */
export async function uploadJSONToPinata(json, name = "") {
  const body = {
    pinataContent:  json,
    pinataMetadata: { name: name || "NFT Metadata" },
    pinataOptions:  { cidVersion: 1 },
  };

  const res = await fetch(`${PINATA_BASE}/pinning/pinJSONToIPFS`, {
    method:  "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text().catch(() => res.statusText);
    throw new Error(`Pinata JSON upload failed (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  return data.IpfsHash;
}

/**
 * Convert an IPFS CID or ipfs:// URI to a public gateway URL (for image preview).
 * Uses the Pinata dedicated gateway.
 */
export function ipfsToGateway(cidOrUri) {
  if (!cidOrUri) return "";
  const cid = cidOrUri.startsWith("ipfs://") ? cidOrUri.slice(7) : cidOrUri;
  return `https://gateway.pinata.cloud/ipfs/${cid}`;
}

/** Test Pinata credentials by calling the /data/testAuthentication endpoint. */
export async function testPinataAuth() {
  const res = await fetch(`${PINATA_BASE}/data/testAuthentication`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Auth test failed (${res.status})`);
  return await res.json();
}
