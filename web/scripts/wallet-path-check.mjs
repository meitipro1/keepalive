/**
 * Proves the site's write path end to end on Studionet, with no browser.
 *
 *   node web/scripts/wallet-path-check.mjs <account name in ~/.keepalive/accounts.json> <stream id>
 *
 * The site signs through the visitor's wallet: genlayer-js 1.x is given the
 * wallet as an EIP-1193 provider and asks it for eth_sendTransaction. Here a
 * stand-in provider plays the wallet, signing with a local test account and
 * forwarding everything else to the RPC, and the same calls the site makes run
 * against it: writeContract, then waitForTransactionReceipt with status
 * ACCEPTED, then the same success test as web/lib/write.ts. It funds the stream
 * with 1 GEN and exits exactly the shares that minted.
 *
 * The key is read from ~/.keepalive/accounts.json at run time and never
 * printed or written anywhere.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const deployment = JSON.parse(fs.readFileSync(path.join(here, "..", "lib", "deployment.json"), "utf8"));
const [name = "patron1", sidText = "2"] = process.argv.slice(2);
const keys = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".keepalive", "accounts.json"), "utf8"));
const signer = privateKeyToAccount(keys[name].startsWith("0x") ? keys[name] : `0x${keys[name]}`);
const chain = { ...studionet, id: deployment.chainId, rpcUrls: { default: { http: [deployment.rpc] } } };
const wallet = createWalletClient({ account: signer, chain, transport: http(deployment.rpc) });

async function rpc(method, params) {
  const response = await fetch(deployment.rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await response.json();
  if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
  return body.result;
}

/** What a browser wallet does, in miniature. */
const provider = {
  async request({ method, params }) {
    if (method === "eth_requestAccounts" || method === "eth_accounts") return [signer.address];
    if (method === "eth_chainId") return `0x${deployment.chainId.toString(16)}`;
    if (method === "eth_sendTransaction") {
      const tx = params[0];
      return wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
    }
    return rpc(method, params ?? []);
  },
  on() {},
  removeListener() {},
};

const client = createClient({ chain, account: signer.address, provider });

function leaderOf(receipt) {
  const rounds = receipt?.consensus_data?.leader_receipt;
  return Array.isArray(rounds) ? (rounds.find((r) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0]) : rounds;
}

/** The success test from web/lib/write.ts, applied to the receipt. */
function outcome(receipt) {
  const status = String(receipt?.statusName ?? receipt?.status_name ?? receipt?.status ?? "").toUpperCase();
  const leader = leaderOf(receipt);
  const execution = String(leader?.execution_result ?? "").toUpperCase();
  const kind = String(leader?.result?.status ?? "").toLowerCase();
  const ok = (status === "ACCEPTED" || status === "FINALIZED" || status === "5" || status === "7") && execution === "SUCCESS" && kind === "return";
  return { ok, status, execution, kind, readable: leader?.result?.payload?.readable ?? leader?.result?.payload };
}

async function send(functionName, args, value) {
  const hash = await client.writeContract({ address: deployment.keepalive, functionName, args, value });
  console.log(`${functionName} submitted ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, status: "ACCEPTED", interval: 4000, retries: 75 });
  const result = outcome(receipt);
  console.log(`${functionName} ${result.ok ? "decided and accepted" : "NOT accepted"}: status=${result.status} execution=${result.execution} result=${result.kind} returned=${result.readable}`);
  return { hash, ...result };
}

const sid = Number(sidText);
const before = BigInt(await rpc("eth_getBalance", [signer.address, "latest"]));
const funded = await send("fund", [sid], 10n ** 18n);
if (!funded.ok) process.exit(1);
const minted = BigInt(String(funded.readable).replace(/"/g, ""));
const exited = await send("exit", [sid, minted], 0n);
const after = BigInt(await rpc("eth_getBalance", [signer.address, "latest"]));
console.log(`balance ${before} -> ${after} (fund 1 GEN, then exit ${minted} shares)`);
process.exit(exited.ok ? 0 : 1);
