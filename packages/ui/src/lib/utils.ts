import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combines conditional class values and resolves conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
