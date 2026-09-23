/**
 * The one deployment every page reads, written by scripts/deploy.py from
 * contracts/FROZEN.json. No environment variable can point a page at another
 * contract or another network.
 */

import record from "./deployment.json";
import type { Deployment } from "./types";

export const DEPLOYMENT: Deployment = record as Deployment;

/** 0xF22F for Studionet. */
export const CHAIN_HEX = `0x${DEPLOYMENT.chainId.toString(16)}`;

export const NETWORK_NAME = "GenLayer Studionet";

/** The short name the pill and the sentences use. */
export const NETWORK_SHORT = "Studionet";

export function txUrl(hash: string): string {
  return `${DEPLOYMENT.explorer}/tx/${hash}`;
}

export function addressUrl(address: string): string {
  return `${DEPLOYMENT.explorer}/address/${address}`;
}

/** The public repository, once there is one. Empty hides the link rather than pointing at a guess. */
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "";
