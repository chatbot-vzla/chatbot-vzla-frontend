import { browser } from '$app/environment';

/**
 * A Svelte 5 rune-based store for syncing state with localStorage.
 */
export class LocalStorageStore<T> {
	value = $state<T>() as T;
	key: string;

	constructor(key: string, initialValue: T) {
		this.key = key;

		if (browser) {
			const item = localStorage.getItem(key);
			if (item !== null) {
				try {
					this.value = JSON.parse(item);
				} catch {
					this.value = initialValue;
				}
			} else {
				this.value = initialValue;
			}
		} else {
			this.value = initialValue;
		}

		// Use an effect to sync changes back to localStorage
		$effect.root(() => {
			$effect(() => {
				if (browser) {
					localStorage.setItem(this.key, JSON.stringify(this.value));
				}
			});
		});
	}
}
