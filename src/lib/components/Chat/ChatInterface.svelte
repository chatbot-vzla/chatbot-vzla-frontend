<script lang="ts">
	import MessageComponent from '$lib/components/Chat/Message.svelte';
	import SuggestedPrompts from '$lib/components/Chat/SuggestedPrompts.svelte';
	import ChatInput from '$lib/components/Chat/ChatInput.svelte';
	import { APP_CONFIG } from '$lib/config';
	import type { Attachment } from '$lib/types';
	import { wsStore } from '$lib/stores/websocket.svelte';

	let messageContainer = $state<HTMLDivElement | null>(null);
	let attachedFiles = $state<Attachment[]>([]);
	let isDragging = $state(false);

	let isWaiting = $derived(wsStore.messages.length > 0 && wsStore.messages[wsStore.messages.length - 1].role === 'user' && !wsStore.messages[wsStore.messages.length - 1].isError);

	// Efecto para autoscroll optimizado con requestAnimationFrame
	$effect(() => {
		if (messageContainer && wsStore.messages.length > 0) {
			requestAnimationFrame(() => {
				if (messageContainer) {
					messageContainer.scrollTop = messageContainer.scrollHeight;
				}
			});
		}
	});

	$effect(() => {
		wsStore.wakeUp();
	});

	// Manejo de drag and drop
	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		const currentTarget = e.currentTarget as HTMLElement;
		if (!currentTarget) return;
		const rect = currentTarget.getBoundingClientRect();
		const x = e.clientX;
		const y = e.clientY;
		if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
			isDragging = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			Array.from(e.dataTransfer.files).forEach((file) => {
				const reader = new FileReader();
				reader.onload = (event) => {
					if (event.target?.result) {
						attachedFiles.push({
							name: file.name,
							url: event.target.result as string,
							type: file.type
						});
					}
				};
				reader.readAsDataURL(file);
			});
		}
	}

	function sendMessage(text: string) {
		if (!text.trim() && attachedFiles.length === 0) return;

		wsStore.sendMessage(text, attachedFiles);
		attachedFiles = [];
	}

	function handleRetry() {
		const userMessages = wsStore.messages.filter((m) => m.role === 'user');
		if (userMessages.length === 0) return;
		const lastUserMsg = userMessages[userMessages.length - 1];

		sendMessage(lastUserMsg.content);
	}

	function handleWakeUp() {
		wsStore.wakeUp();
	}
</script>

<div
	role="region"
	class="flex flex-col h-full w-full bg-base-100 relative rounded-none md:rounded-3xl overflow-hidden border-x-0 md:border border-base-200"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onpointerdown={handleWakeUp}
>
	<!-- Overlay de Drag & Drop -->
	{#if isDragging}
		<div
			class="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary/50 m-4 rounded-2xl flex flex-col items-center justify-center gap-3 z-30 pointer-events-none animate-pulse"
		>
			<div class="p-4 bg-primary text-primary-content rounded-full shadow-lg">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					class="w-8 h-8"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2.5"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
					/>
				</svg>
			</div>
			<span class="text-base font-bold text-primary">Suelta tus archivos o imágenes aquí</span>
		</div>
	{/if}

	<!-- Área de mensajes -->
	<div
		bind:this={messageContainer}
		class="grow px-2 py-6 md:p-6 overflow-y-auto w-full flex flex-col"
	>
		{#if wsStore.messages.length === 0}
			<div class="my-auto flex flex-col items-center justify-center text-center space-y-8 py-8">
				<div class="space-y-2">
					<div class="text-3xl font-extrabold text-base-content tracking-tight">
						¿En qué puedo ayudarte hoy?
					</div>
					<p class="text-sm text-base-content/60 max-w-sm mx-auto">
						Selecciona una de las consultas de emergencia sugeridas o escribe tu propia pregunta
						abajo.
					</p>
				</div>
				<SuggestedPrompts onSelect={sendMessage} />
			</div>
		{:else}
			<div class="space-y-1">
				{#each wsStore.messages as msg, i (i)}
					<MessageComponent
						role={msg.role}
						content={msg.content}
						attachments={msg.attachments}
						isError={msg.isError}
						onRetry={msg.isError ? handleRetry : undefined}
					/>
				{/each}
				{#if isWaiting}
					<!-- Esqueleto de carga inicial del asistente -->
					<div class="chat chat-start mb-2 animate-pulse">
						<div class="chat-image avatar placeholder">
							<div class="w-8 rounded-xl bg-base-300"></div>
						</div>
						<div class="chat-header text-xs opacity-50 mb-1">{APP_CONFIG.appName}</div>
						<div class="chat-bubble bg-base-200 text-base-content shadow-sm flex items-center h-12">
							<span class="loading loading-dots loading-sm opacity-50"></span>
						</div>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Input de usuario -->
	<ChatInput isLoading={isWaiting} onSend={sendMessage} bind:attachedFiles />

	<!-- Botón de WhatsApp Flotante -->
	<a
		href="https://wa.me/584241234567"
		target="_blank"
		rel="noopener noreferrer"
		class="absolute bottom-28 right-4 md:right-6 btn btn-circle w-16 h-16 md:w-14 md:h-14 bg-[#25D366] hover:bg-[#22c35e] text-white border-none shadow-lg z-10 hover:scale-105 active:scale-95 transition-transform"
		aria-label="Contactar por WhatsApp"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			class="w-9 h-9 md:w-8 md:h-8"
			viewBox="0 0 24 24"
			fill="none"
		>
			<path
				d="M6.014 8.00613C6.12827 7.1024 7.30277 5.87414 8.23488 6.01043L8.23339 6.00894C9.14051 6.18132 9.85859 7.74261 10.2635 8.44465C10.5504 8.95402 10.3641 9.4701 10.0965 9.68787C9.7355 9.97883 9.17099 10.3803 9.28943 10.7834C9.5 11.5 12 14 13.2296 14.7107C13.695 14.9797 14.0325 14.2702 14.3207 13.9067C14.5301 13.6271 15.0466 13.46 15.5548 13.736C16.3138 14.178 17.0288 14.6917 17.69 15.27C18.0202 15.546 18.0977 15.9539 17.8689 16.385C17.4659 17.1443 16.3003 18.1456 15.4542 17.9421C13.9764 17.5868 8 15.27 6.08033 8.55801C5.97237 8.24048 5.99955 8.12044 6.014 8.00613Z"
				fill="currentColor"
			/>
			<path
				fill-rule="evenodd"
				clip-rule="evenodd"
				d="M12 23C10.7764 23 10.0994 22.8687 9 22.5L6.89443 23.5528C5.56462 24.2177 4 23.2507 4 21.7639V19.5C1.84655 17.492 1 15.1767 1 12C1 5.92487 5.92487 1 12 1C18.0751 1 23 5.92487 23 12C23 18.0751 18.0751 23 12 23ZM6 18.6303L5.36395 18.0372C3.69087 16.4772 3 14.7331 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C11.0143 21 10.552 20.911 9.63595 20.6038L8.84847 20.3397L6 21.7639V18.6303Z"
				fill="currentColor"
			/>
		</svg>
	</a>
</div>
