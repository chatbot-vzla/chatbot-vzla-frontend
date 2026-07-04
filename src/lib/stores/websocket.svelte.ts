import { browser } from '$app/environment';
import { LocalStorageStore } from './storage.svelte';
import { env } from '$env/dynamic/public';
import type { Message, Attachment } from '$lib/types';
import { marked } from 'marked';

export class WebSocketStore {
	messages = $state<Message[]>([]);
	status = $state<'idle' | 'connecting' | 'connected' | 'disconnected' | 'error'>('idle');
	
	private socket: WebSocket | null = null;
	private timeoutId: ReturnType<typeof setTimeout> | null = null;
	private readonly TIMEOUT_MS = 3 * 60 * 1000; // 3 minutos de inactividad
	private conversationIdStore: LocalStorageStore<string>;

	constructor() {
		this.conversationIdStore = new LocalStorageStore<string>(
			'chat_conversation_id',
			browser && window.crypto && crypto.randomUUID 
				? crypto.randomUUID() 
				: Math.random().toString(36).substring(2, 15)
		);
	}

	get conversationId() {
		return this.conversationIdStore.value;
	}

	connect() {
		if (!browser || this.status === 'connected' || this.status === 'connecting') return;

		this.status = 'connecting';
		const domain = env.PUBLIC_VITE_BACKEND_DOMAIN || 'localhost:8000';
		const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
		const wsUrl = `${protocol}//${domain}/ws/chat/${this.conversationId}/`;

		try {
			this.socket = new WebSocket(wsUrl);

			this.socket.onopen = () => {
				this.status = 'connected';
				this.resetTimeout();
			};

			this.socket.onmessage = async (event) => {
				this.resetTimeout();
				try {
					const data = JSON.parse(event.data);
					
					if (data.error) {
						this.messages = [...this.messages, { role: 'assistant', content: data.error, isError: true }];
						return;
					}

					if (data.message && data.sender) {
						// Ignoramos los mensajes del USER porque los agregamos optimisticamente en sendMessage
						if (data.sender.toUpperCase() === 'USER') return;
						
						const parsedContent = await marked.parse(data.message);
						this.messages = [...this.messages, { role: 'assistant', content: parsedContent }];
					}
				} catch (e) {
					console.error('Failed to parse WS message', e);
				}
			};

			this.socket.onclose = () => {
				this.status = 'disconnected';
				this.socket = null;
				this.clearTimeout();
			};

			this.socket.onerror = (error) => {
				console.error('WebSocket Error:', error);
				this.status = 'error';
			};
		} catch (error) {
			console.error('WebSocket connection failed:', error);
			this.status = 'error';
		}
	}

	disconnect() {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
		this.status = 'disconnected';
		this.clearTimeout();
	}

	sendMessage(text: string, attachments: Attachment[] = []) {
		if (!text.trim() && attachments.length === 0) return;

		// Añadir localmente (optimistic update)
		this.messages = [...this.messages, { role: 'user', content: text, attachments }];
		this.resetTimeout();

		const payload = JSON.stringify({ message: text, sender: 'USER', attachments });

		if (this.status !== 'connected') {
			this.connect();
			
			// Encolar mensaje hasta que conecte
			const checkInterval = setInterval(() => {
				if (this.status === 'connected' && this.socket) {
					this.socket.send(payload);
					clearInterval(checkInterval);
				} else if (this.status === 'error' || this.status === 'disconnected') {
					// Fallo en la conexión
					this.messages = [...this.messages, { role: 'assistant', content: 'Error: No se pudo conectar con el servidor', isError: true }];
					clearInterval(checkInterval);
				}
			}, 100);
		} else if (this.socket) {
			this.socket.send(payload);
		}
	}

	wakeUp() {
		if (this.status === 'disconnected' || this.status === 'idle') {
			this.connect();
		} else if (this.status === 'connected') {
			this.resetTimeout();
		}
	}

	private resetTimeout() {
		this.clearTimeout();
		if (browser) {
			this.timeoutId = setTimeout(() => {
				console.log('Inactividad detectada. Desconectando WebSocket...');
				this.disconnect();
			}, this.TIMEOUT_MS);
		}
	}

	private clearTimeout() {
		if (this.timeoutId) {
			clearTimeout(this.timeoutId);
			this.timeoutId = null;
		}
	}
}

export const wsStore = new WebSocketStore();
