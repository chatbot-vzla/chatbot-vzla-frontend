<script lang="ts">
	import type { Attachment } from '$lib/types';
	import { wsStore } from '$lib/stores/websocket.svelte';

	interface Props {
		isLoading: boolean;
		onSend: (text: string) => void;
		attachedFiles: Attachment[];
	}

	let { isLoading, onSend, attachedFiles = $bindable() }: Props = $props();
	let inputValue = $state('');
	let fileInput = $state<HTMLInputElement | null>(null);

	function handleSend() {
		if ((!inputValue.trim() && attachedFiles.length === 0) || isLoading) return;
		onSend(inputValue);
		inputValue = '';
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSend();
		}
	}

	function triggerFileInput() {
		fileInput?.click();
	}

	function handleFileChange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.files) {
			Array.from(target.files).forEach((file) => {
				const reader = new FileReader();
				reader.onload = (e) => {
					if (e.target?.result) {
						attachedFiles.push({
							name: file.name,
							url: e.target.result as string,
							type: file.type
						});
					}
				};
				reader.readAsDataURL(file);
			});
			// Reset input so the same file can be selected again
			target.value = '';
		}
	}

	function removeFile(index: number) {
		attachedFiles = attachedFiles.filter((_, i) => i !== index);
	}
</script>

<div class="p-4 bg-base-100 border-t border-base-200 w-full flex flex-col gap-3">
	<!-- Input de tipo archivo oculto -->
	<input
		type="file"
		multiple
		class="hidden"
		bind:this={fileInput}
		onchange={handleFileChange}
	/>

	<!-- Previsualización de Archivos Adjuntos -->
	{#if attachedFiles.length > 0}
		<div class="flex flex-wrap gap-2 px-1">
			{#each attachedFiles as file, index (index)}
				<div class="relative bg-base-200 rounded-2xl p-2 pr-8 border border-base-300 flex items-center gap-2 max-w-[160px] truncate shadow-sm">
					{#if file.type.startsWith('image/')}
						<img src={file.url} alt={file.name} class="w-8 h-8 rounded-lg object-cover border border-base-content/10" />
					{:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-primary p-1.5 bg-base-300 rounded-lg shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
							<path stroke-linecap="round" stroke-linejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
						</svg>
					{/if}
					<span class="text-xs font-semibold truncate leading-tight">{file.name}</span>
					<button
						type="button"
						class="absolute top-1 right-1 btn btn-circle btn-xs bg-base-300 hover:bg-error hover:text-error-content border-none"
						onclick={() => removeFile(index)}
						aria-label="Quitar archivo"
					>
						<svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<div class="join w-full shadow-sm rounded-3xl h-16 lg:h-[72px]">
		<!-- Botón de Adjuntar -->
		<button
			type="button"
			class="btn h-full join-item bg-base-300 border-base-300 hover:bg-base-300/70 px-4 lg:px-5"
			onclick={triggerFileInput}
			aria-label="Adjuntar archivo o imagen"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="2.5"
				stroke="currentColor"
				class="w-6 h-6 lg:w-7 lg:h-7 opacity-60"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
			</svg>
		</button>

		<!-- Input de Texto Expandido -->
		<input
			type="text"
			placeholder="Haz una pregunta o consulta sobre la emergencia..."
			class="input h-full join-item w-full bg-base-300/80 border-base-300 focus:outline-none placeholder:text-base-content/40 text-sm lg:text-base"
			bind:value={inputValue}
			onkeydown={handleKeydown}
			oninput={() => wsStore.wakeUp()}
			disabled={isLoading}
		/>

		<!-- Botón de Enviar -->
		<button
			type="button"
			class="btn h-full join-item bg-base-300 border-base-300 hover:bg-base-300/70 px-4 lg:px-5 text-base-content/70"
			onclick={handleSend}
			disabled={isLoading || (!inputValue.trim() && attachedFiles.length === 0)}
			aria-label="Enviar mensaje"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
				stroke-width="2.5"
				stroke="currentColor"
				class="w-6 h-6 lg:w-7 lg:h-7"
			>
				<path stroke-linecap="round" stroke-linejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
			</svg>
		</button>
	</div>
</div>
