export function onPropertyInspectorReady(callback: () => void | Promise<void>): void {
	if (typeof document === "undefined") {
		return;
	}

	document.addEventListener("DOMContentLoaded", () => {
		void callback();
	});
}
