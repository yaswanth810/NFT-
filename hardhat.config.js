require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY  = process.env.PRIVATE_KEY  || "0x0000000000000000000000000000000000000000000000000000000000000000";
const SCAI_RPC_URL = process.env.SCAI_RPC_URL || "https://mainnet-rpc.scai.network";
const EXPLORER_URL = process.env.SCAI_EXPLORER_URL || "https://explorer.securechain.ai";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "paris",   // Safe for SCAI Mainnet — avoids Cancun-only opcodes (mcopy etc.)
    },
  },

  networks: {
    // ── SCAI Mainnet ─────────────────────────────────────────────────────────
    scai: {
      url:      SCAI_RPC_URL,
      chainId:  34,
      accounts: [`0x${PRIVATE_KEY.replace(/^0x/, "")}`],
      gasPrice: "auto",
    },

    // ── Local Hardhat node (development / testing) ───────────────────────────
    localhost: {
      url:     "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // ── In-process Hardhat network ───────────────────────────────────────────
    hardhat: {
      chainId: 31337,
    },
  },

  // ── Block-explorer verification ────────────────────────────────────────────
  // No API key is required / available for the SCAI explorer.
  // The customChains entry registers the network so `hardhat verify` knows
  // the correct API endpoint if the explorer adds key-less verification later.
  etherscan: {
    apiKey: {
      scai: "no-api-key-required", // SCAI Explorer does not issue API keys
    },
    customChains: [
      {
        network: "scai",
        chainId: 34,
        urls: {
          apiURL:     `${EXPLORER_URL}/api`,
          browserURL: EXPLORER_URL,
        },
      },
    ],
  },

  // ── Gas reporter (opt-in via env) ──────────────────────────────────────────
  gasReporter: {
    enabled:    process.env.REPORT_GAS === "true",
    currency:   "USD",
    outputFile: "gas-report.txt",
    noColors:   true,
  },

  // ── Paths ──────────────────────────────────────────────────────────────────
  paths: {
    sources:   "./contracts",
    tests:     "./test",
    cache:     "./cache",
    artifacts: "./artifacts",
  },
};
