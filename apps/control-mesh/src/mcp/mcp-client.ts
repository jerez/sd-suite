import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

/**
 * Executable Stream Deck action metadata returned by the Elgato MCP bridge tool.
 */
export type McpTool = {
	description?: string;
	id: string;
	name: string;
	title?: string;
};

/**
 * Minimal client for the Elgato MCP HTTP endpoint used by Control Mesh.
 */
export type McpClient = {
	/**
	 * Calls one executable Stream Deck action by runtime action id.
	 */
	executeAction(actionId: string): Promise<unknown>;
	/**
	 * Lists executable Stream Deck actions exposed through the official MCP bridge tools.
	 */
	listActions(): Promise<McpTool[]>;
};

/**
 * Runtime dependencies and endpoint configuration for the MCP client.
 */
export type McpClientOptions = {
	fetch?: typeof fetch;
	timeoutMs?: number;
	url: string;
};

/**
 * Creates an SDK-backed client for the official Stream Deck MCP bridge tools.
 */
export function createMcpClient(input: McpClientOptions): McpClient {
	const fetchImpl = input.fetch ?? fetch;
	let connection: Promise<Client> | undefined;

	return {
		async executeAction(actionId) {
			return withSessionRecovery(async (client) =>
				parseJsonTextContent(
					await client.callTool(
						{
							arguments: { id: actionId },
							name: "streamdeck__execute_action",
						},
						undefined,
						{ timeout: input.timeoutMs },
					),
				),
			);
		},
		async listActions() {
			return withSessionRecovery(async (client) =>
				parseExecutableActions(
					await client.callTool(
						{
							arguments: {},
							name: "streamdeck__get_executable_actions",
						},
						undefined,
						{ timeout: input.timeoutMs },
					),
				),
			);
		},
	};

	function getConnection(): Promise<Client> {
		connection ??= connectMcpClient(fetchImpl, input);
		return connection;
	}

	async function resetConnection(): Promise<void> {
		if (!connection) {
			return;
		}

		const currentConnection = connection;
		connection = undefined;
		const client = await currentConnection.catch(() => undefined);
		await client?.close().catch(() => undefined);
	}

	async function withSessionRecovery<T>(operation: (client: Client) => Promise<T>): Promise<T> {
		try {
			return await operation(await getConnection());
		} catch (error) {
			if (!isExpiredSessionError(error)) {
				throw error;
			}

			await resetConnection();
			return operation(await getConnection());
		}
	}
}

async function connectMcpClient(fetchImpl: typeof fetch, input: McpClientOptions): Promise<Client> {
	const client = new Client({ name: "control-mesh", version: "0.1.0" }, { capabilities: {} });
	const transport = new StreamableHTTPClientTransport(new URL(input.url), {
		fetch: fetchImpl,
		requestInit: input.timeoutMs === undefined ? undefined : { signal: AbortSignal.timeout(input.timeoutMs) },
	});

	await client.connect(transport, { timeout: input.timeoutMs });

	return client;
}

type ExecutableActionsPayload = {
	actions?: Array<{
		description?: {
			description?: string;
			name?: string;
		};
		id?: string;
		title?: string;
	}>;
};

function parseExecutableActions(result: unknown): McpTool[] {
	const payload = parseJsonTextContent(result) as ExecutableActionsPayload;

	return (payload.actions ?? []).flatMap((action): McpTool[] => {
		const id = action.id?.trim() ?? "";
		const name = action.description?.name?.trim() ?? "";
		if (!id || !name) {
			return [];
		}

		return [
			{
				...(action.description?.description ? { description: action.description.description } : {}),
				id,
				name,
				title: action.title?.trim() || undefined,
			},
		];
	});
}

function parseJsonTextContent(result: unknown): unknown {
	const content = Array.isArray((result as { content?: unknown })?.content)
		? ((result as { content: Array<{ text?: string; type?: string }> }).content ?? [])
		: [];
	const textContent = content.find((item) => item.type === "text")?.text;
	if (!textContent) {
		throw new Error("MCP response did not include text content.");
	}

	try {
		return JSON.parse(textContent) as unknown;
	} catch {
		throw new Error("MCP response did not include valid JSON text.");
	}
}

function isExpiredSessionError(error: unknown): boolean {
	return error instanceof StreamableHTTPError && error.code === 404;
}
