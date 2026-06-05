// scripts/verify.js
// ─────────────────────────────────────────────────────────────────────────────
//  Verification script — NFTMarketplace.sol + Marketplace.sol
//  Target network : SCAI Mainnet (Chain ID: 34)
//
//  Run:
//    npx hardhat run scripts/verify.js --network scai
//
//  Behaviour:
//    1. Reads deployed addresses from deployments/deployedAddresses.json
//    2. Attempts Hardhat `verify:verify` task (works if SCAI explorer supports
//       the Etherscan-compatible API).
//    3. If verification is unsupported / fails, falls back to exporting:
//         • ABI   → deployments/abi/<ContractName>.json
//         • Bytecode (creation code) → deployments/bytecode/<ContractName>.txt
//       so you can submit manually via the explorer UI.
// ─────────────────────────────────────────────────────────────────────────────

const { run, artifacts, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Paths ─────────────────────────────────────────────────────────────────────
const DEPLOYMENTS_DIR  = path.join(__dirname, "../deployments");
const ADDRESSES_FILE   = path.join(DEPLOYMENTS_DIR, "deployedAddresses.json");
const ABI_DIR          = path.join(DEPLOYMENTS_DIR, "abi");
const BYTECODE_DIR     = path.join(DEPLOYMENTS_DIR, "bytecode");

// ── Helpers ───────────────────────────────────────────────────────────────────
function banner(text) {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Load the most recent deployment record for "scai" from deployedAddresses.json */
function loadLatestRecord() {
  if (!fs.existsSync(ADDRESSES_FILE)) {
    throw new Error(
      `deployedAddresses.json not found.\nRun deploy.js first:\n  npx hardhat run scripts/deploy.js --network scai`
    );
  }
  const all = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  const records = Array.isArray(all) ? all : [all];
  const scaiRecords = records.filter((r) => r.network === "scai");
  if (scaiRecords.length === 0) throw new Error("No scai deployment found in deployedAddresses.json.");
  // Return the most recent entry
  return scaiRecords[scaiRecords.length - 1];
}

/**
 * Attempt Hardhat etherscan-style verification.
 * Returns true on success, false if unsupported or failed.
 */
async function tryHardhatVerify(contractName, address, constructorArgs) {
  console.log(`\n  🔎 Attempting on-chain verification for ${contractName}…`);
  console.log(`     Address : ${address}`);
  try {
    await run("verify:verify", {
      address,
      constructorArguments: constructorArgs,
    });
    console.log(`  ✅ ${contractName} verified on SCAI Explorer!`);
    return true;
  } catch (err) {
    const msg = err.message || "";
    if (msg.toLowerCase().includes("already verified")) {
      console.log(`  ℹ️  ${contractName} is already verified.`);
      return true;
    }
    // Any other error (unsupported API, network error, etc.)
    console.warn(`  ⚠️  On-chain verification failed for ${contractName}.`);
    console.warn(`     Reason: ${msg.split("\n")[0]}`);
    return false;
  }
}

/**
 * Export ABI and deployment bytecode to disk for manual submission.
 */
async function exportManualVerificationFiles(contractName, address, constructorArgs) {
  console.log(`\n  📁 Exporting ABI + bytecode for manual submission (${contractName})…`);

  ensureDir(ABI_DIR);
  ensureDir(BYTECODE_DIR);

  // ── Fetch compiled artifact ─────────────────────────────────────────────────
  const artifact = await artifacts.readArtifact(contractName);

  // ── ABI ─────────────────────────────────────────────────────────────────────
  const abiFile = path.join(ABI_DIR, `${contractName}.json`);
  fs.writeFileSync(abiFile, JSON.stringify(artifact.abi, null, 2));
  console.log(`     ABI      → deployments/abi/${contractName}.json`);

  // ── Bytecode (creation / init code) ─────────────────────────────────────────
  const bytecodeFile = path.join(BYTECODE_DIR, `${contractName}.txt`);
  fs.writeFileSync(bytecodeFile, artifact.bytecode);
  console.log(`     Bytecode → deployments/bytecode/${contractName}.txt`);

  // ── Human-readable summary file ──────────────────────────────────────────────
  const summaryFile = path.join(DEPLOYMENTS_DIR, `${contractName}_verification.txt`);
  const summary = [
    `Contract Name : ${contractName}`,
    `Address       : ${address}`,
    `Network       : SCAI Mainnet`,
    `Chain ID      : 34`,
    `Compiler      : Solidity 0.8.24`,
    `Optimiser     : enabled (runs: 200)`,
    `viaIR         : true`,
    ``,
    `Constructor Arguments (ABI-encoded):`,
    `  Raw args    : ${JSON.stringify(constructorArgs)}`,
    ``,
    `Manual Verification Steps`,
    `─────────────────────────`,
    `1. Visit https://explorer.securechain.ai/address/${address}`,
    `2. Click "Verify & Publish Contract"`,
    `3. Select compiler version: 0.8.24`,
    `4. Enable optimization with 200 runs`,
    `5. Paste the flattened source (run: npx hardhat flatten contracts/${contractName}.sol)`,
    `6. Enter the constructor arguments listed above`,
    ``,
    `ABI file      : deployments/abi/${contractName}.json`,
    `Bytecode file : deployments/bytecode/${contractName}.txt`,
  ].join("\n");

  fs.writeFileSync(summaryFile, summary);
  console.log(`     Summary  → deployments/${contractName}_verification.txt`);

  // ── Also print the flatten command ──────────────────────────────────────────
  console.log();
  console.log(`  To generate flattened source for manual upload:`);
  console.log(`    npx hardhat flatten contracts/${contractName}.sol > deployments/${contractName}_flat.sol`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  banner("NFT Marketplace — Verification Script");
  console.log(`  Network : ${network.name} (Chain ID: 34)`);

  // ── Load deployed addresses ──────────────────────────────────────────────────
  const record = loadLatestRecord();
  console.log(`  Deployment timestamp : ${record.deployedAt}`);

  const contracts = [
    {
      name:            "NFTMarketplace",
      address:         record.contracts.NFTMarketplace.address,
      constructorArgs: [
        record.contracts.NFTMarketplace.constructorArgs[0], // name
        record.contracts.NFTMarketplace.constructorArgs[1], // symbol
        BigInt(record.contracts.NFTMarketplace.constructorArgs[2] || "0"), // mintFee
      ],
    },
    {
      name:            "Marketplace",
      address:         record.contracts.Marketplace.address,
      constructorArgs: [], // no constructor args
    },
  ];

  // ── Verify each contract ─────────────────────────────────────────────────────
  for (const { name, address, constructorArgs } of contracts) {
    banner(`Verifying: ${name}`);

    const verified = await tryHardhatVerify(name, address, constructorArgs);

    if (!verified) {
      // Fallback: export ABI + bytecode for manual submission
      await exportManualVerificationFiles(name, address, constructorArgs);
    }
  }

  // ── Done ─────────────────────────────────────────────────────────────────────
  banner("Verification Script Complete");
  console.log("  Files saved under: deployments/");
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Verification script failed:", err.message || err);
  process.exitCode = 1;
});
