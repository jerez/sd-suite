/**
 * Defers property-inspector initialization until the DOM is ready in the SDPI runtime.
 */
export function onPropertyInspectorReady(callback: () => void | Promise<void>): void {
	if (typeof document === "undefined") {
		return;
	}

	document.addEventListener("DOMContentLoaded", () => {
		void callback();
	});
}
