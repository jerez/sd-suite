import streamDeck from "@elgato/streamdeck";

import { ConnectDevice } from "./actions/connect-device";
import { DisconnectDevice } from "./actions/disconnect-device";
import { ShareDevice } from "./actions/share-device";
import { UnshareDevice } from "./actions/unshare-device";

streamDeck.logger.setLevel("trace");

async function main(): Promise<void> {
	streamDeck.actions.registerAction(new ShareDevice());
	streamDeck.actions.registerAction(new UnshareDevice());
	streamDeck.actions.registerAction(new ConnectDevice());
	streamDeck.actions.registerAction(new DisconnectDevice());
	await streamDeck.connect();
}

void main();
