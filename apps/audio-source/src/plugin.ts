import streamDeck from "@elgato/streamdeck";

import { CycleAudioInputDevice } from "./actions/cycle-audio-input-device";
import { CycleAudioOutputDevice } from "./actions/cycle-audio-output-device";

streamDeck.logger.setLevel("error");

async function main(): Promise<void> {
  streamDeck.actions.registerAction(new CycleAudioInputDevice());
  streamDeck.actions.registerAction(new CycleAudioOutputDevice());
  await streamDeck.connect();
}

void main();
