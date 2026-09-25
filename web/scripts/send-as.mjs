/**
 * Sends one write the way the site does, from a local test account.
 *
 *   node web/scripts/send-as.mjs <account name> <method> '<json args>' [GEN to send]
 *
 * The same stand-in wallet as wallet-path-check.mjs: genlayer-js 1.x gets an
 * EIP-1193 provider that signs eth_sendTransaction with the test account and
 * forwards everything else to the RPC. Then it waits for ACCEPTED and applies
 * the success test from web/lib/write.ts. A string argument written as "123n"
 * is sent as a bigint. Prints the hash, the outcome and what the contract
 * returned, and exits 1 unless the write was decided and accepted.
 *
 * The key is read from ~/.keepalive/accounts.json at run time and never
 * printed or written anywhere.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const deployment = JSON.parse(fs.readFileSync(path.join(here, "..", "lib", "deployment.json"), "utf8"));
const [name, method, argsText = "[]", genText = "0"] = process.argv.slice(2);
const keys = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".keepalive", "accounts.json"), "utf8"));
if (!keys[name]) throw new Error(`no account named ${name}`);
const signer = privateKeyToAccount(keys[name].startsWith("0x") ? keys[name] : `0x${keys[name]}`);
const chain = { ...studionet, id: deployment.chainId, rpcUrls: { default: { http: [deployment.rpc] } } };
const wallet = createWalletClient({ account: signer, chain, transport: http(deployment.rpc) });

async function rpc(rpcMethod, params) {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(deployment.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: rpcMethod, params }),
    });
    const body = await response.json();
    if (body.error?.code === -32029 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 15000));
      continue;
    }
    if (body.error) throw Object.assign(new Error(body.error.message), { code: body.error.code });
    return body.result;
  }
}

const provider = {
  async request({ method: m, params }) {
    if (m === "eth_requestAccounts" || m === "eth_accounts") return [signer.address];
    if (m === "eth_chainId") return `0x${deployment.chainId.toString(16)}`;
    if (m === "eth_sendTransaction") {
      const tx = params[0];
      return wallet.sendTransaction({
        to: tx.to,
        data: tx.data,
        value: tx.value ? BigInt(tx.value) : 0n,
        gas: tx.gas ? BigInt(tx.gas) : undefined,
      });
    }
    return rpc(m, params ?? []);
  },
  on() {},
  removeListener() {},
};

const client = createClient({ chain, account: signer.address, provider });

function leaderOf(receipt) {
  const rounds = receipt?.consensus_data?.leader_receipt;
  return Array.isArray(rounds) ? (rounds.find((r) => String(r?.mode ?? "").toLowerCase() === "leader") ?? rounds[0]) : rounds;
}

const args = JSON.parse(argsText).map((a) => (typeof a === "string" && /^\d+n$/.test(a) ? BigInt(a.slice(0, -1)) : a));
const hash = await client.writeContract({ address: deployment.keepalive, functionName: method, args, value: parseEther(genText) });
console.log(`${method} from ${signer.address} submitted ${hash}`);
const receipt = await client.waitForTransactionReceipt({
  hash,
  status: "ACCEPTED",
  interval: 5000,
  retries: method === "check" ? 150 : 75,
});
const status = String(receipt?.statusName ?? receipt?.status_name ?? receipt?.status ?? "").toUpperCase();
const leader = leaderOf(receipt);
const execution = String(leader?.execution_result ?? "").toUpperCase();
const kind = String(leader?.result?.status ?? "").toLowerCase();
const ok = (status === "ACCEPTED" || status === "FINALIZED" || status === "5" || status === "7") && execution === "SUCCESS" && kind === "return";
const payload = leader?.result?.payload;
console.log(`${method} ${ok ? "DECIDED AND ACCEPTED" : "NOT ACCEPTED"}: status=${status} execution=${execution} result=${kind}`);
console.log(`returned: ${typeof payload === "object" ? (payload?.readable ?? JSON.stringify(payload)) : payload}`);
process.exit(ok ? 0 : 1);
