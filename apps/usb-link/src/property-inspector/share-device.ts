import { initializeDeviceActionPropertyInspector } from "./device-action-form";
import { onPropertyInspectorReady } from "./show-property-inspector";
import { getStreamDeckClient } from "./stream-deck-client";

onPropertyInspectorReady(() =>
	initializeDeviceActionPropertyInspector({
		client: getStreamDeckClient(),
		document,
		helperText: "Local device name to share.",
	}),
);
