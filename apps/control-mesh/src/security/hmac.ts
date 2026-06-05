import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Headers used to authenticate one Control Mesh peer request.
 */
export type SignedPeerHeaders = {
	"x-control-mesh-node-id": string;
	"x-control-mesh-nonce": string;
	"x-control-mesh-signature": string;
	"x-control-mesh-timestamp": string;
};

/**
 * Request fields needed to produce a peer HMAC signature.
 */
export type SignPeerRequestInput = {
	body: string;
	method: string;
	nonce?: string;
	path: string;
	secret: string;
	senderNodeId: string;
	timestamp?: string;
};

/**
 * Request fields needed to verify a peer HMAC signature.
 */
export type VerifyPeerRequestInput = {
	body: string;
	headers: Partial<SignedPeerHeaders>;
	method: string;
	nonceCache: NonceCache;
	now?: Date;
	path: string;
	resolveSecret(nodeId: string): Promise<string | undefined> | string | undefined;
};

export type VerifyPeerRequestResult = { ok: true; senderNodeId: string } | { error: string; ok: false };

/**
 * In-memory replay guard for signed peer request nonces.
 */
export type NonceCache = {
	freshnessMs: number;
	/**
	 * Checks whether a nonce key has already been used inside the freshness window.
	 */
	has(nonceKey: string, now: Date): boolean;
	/**
	 * Records a nonce key as used at the provided time.
	 */
	remember(nonceKey: string, now: Date): void;
};

/**
 * Creates a timestamp-bounded nonce cache for replay detection.
 */
export function createNonceCache(freshnessMs = 300_000): NonceCache {
	const seen = new Map<string, number>();

	return {
		freshnessMs,
		has(nonceKey, now) {
			pruneSeenNonces(seen, now, freshnessMs);
			return seen.has(nonceKey);
		},
		remember(nonceKey, now) {
			pruneSeenNonces(seen, now, freshnessMs);
			seen.set(nonceKey, now.getTime());
		},
	};
}

/**
 * Signs a peer request using the trust-link shared secret.
 */
export async function signPeerRequest(input: SignPeerRequestInput): Promise<{ headers: SignedPeerHeaders }> {
	const timestamp = input.timestamp ?? new Date().toISOString();
	const nonce = input.nonce ?? crypto.randomUUID();
	const signature = signCanonicalRequest({
		body: input.body,
		method: input.method,
		nonce,
		path: input.path,
		secret: input.secret,
		timestamp,
	});

	return {
		headers: {
			"x-control-mesh-node-id": input.senderNodeId,
			"x-control-mesh-nonce": nonce,
			"x-control-mesh-signature": signature,
			"x-control-mesh-timestamp": timestamp,
		},
	};
}

/**
 * Verifies peer authentication headers, timestamp freshness, nonce replay, and HMAC signature.
 */
export async function verifyPeerRequest(input: VerifyPeerRequestInput): Promise<VerifyPeerRequestResult> {
	const senderNodeId = input.headers["x-control-mesh-node-id"];
	const timestamp = input.headers["x-control-mesh-timestamp"];
	const nonce = input.headers["x-control-mesh-nonce"];
	const signature = input.headers["x-control-mesh-signature"];

	if (!senderNodeId || !timestamp || !nonce || !signature) {
		return { error: "Missing Control Mesh authentication headers.", ok: false };
	}

	const now = input.now ?? new Date();
	const timestampDate = new Date(timestamp);
	if (Number.isNaN(timestampDate.getTime())) {
		return { error: "Invalid request timestamp.", ok: false };
	}

	if (Math.abs(now.getTime() - timestampDate.getTime()) > input.nonceCache.freshnessMs) {
		return { error: "Request timestamp is outside the freshness window.", ok: false };
	}

	// Scope nonce reuse by sender so independent peers can use the same nonce value.
	const nonceKey = `${senderNodeId}:${nonce}`;
	if (input.nonceCache.has(nonceKey, now)) {
		return { error: "Nonce has already been used.", ok: false };
	}

	const secret = await input.resolveSecret(senderNodeId);
	if (!secret) {
		return { error: "No enabled trust link for sender.", ok: false };
	}

	const expectedSignature = signCanonicalRequest({
		body: input.body,
		method: input.method,
		nonce,
		path: input.path,
		secret,
		timestamp,
	});

	if (!isEqualSignature(signature, expectedSignature)) {
		return { error: "Invalid request signature.", ok: false };
	}

	input.nonceCache.remember(nonceKey, now);
	return { ok: true, senderNodeId };
}

function signCanonicalRequest(input: {
	body: string;
	method: string;
	nonce: string;
	path: string;
	secret: string;
	timestamp: string;
}): string {
	// Keep the signed surface narrow and deterministic across caller and executor.
	return createHmac("sha256", input.secret).update(canonicalizeRequest(input)).digest("hex");
}

function canonicalizeRequest(input: {
	body: string;
	method: string;
	nonce: string;
	path: string;
	timestamp: string;
}): string {
	return [input.method.toUpperCase(), input.path, input.timestamp, input.nonce, hashBody(input.body)].join("\n");
}

function hashBody(body: string): string {
	return createHash("sha256").update(body).digest("hex");
}

function isEqualSignature(received: string, expected: string): boolean {
	const receivedBuffer = Buffer.from(received, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");

	// timingSafeEqual requires equal-length buffers, so reject malformed signatures first.
	if (receivedBuffer.length !== expectedBuffer.length) {
		return false;
	}

	return timingSafeEqual(receivedBuffer, expectedBuffer);
}

function pruneSeenNonces(seen: Map<string, number>, now: Date, freshnessMs: number): void {
	const oldestAllowed = now.getTime() - freshnessMs;

	for (const [nonceKey, seenAt] of seen.entries()) {
		if (seenAt < oldestAllowed) {
			seen.delete(nonceKey);
		}
	}
}
