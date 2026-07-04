import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { Message } from '$lib/types';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { messages } = (await request.json()) as { messages: Message[] };

		const OPENROUTER_API_KEY = env.OPENROUTER_API_KEY;

		if (!OPENROUTER_API_KEY) {
			throw new Error('API Key de OpenRouter no está configurada');
		}

		// Add a system prompt to guide the AI
		const systemMessage: Message = {
			role: 'system' as 'user', // casting for OpenRouter schema compatibility
			content: `Eres un asistente virtual empático, claro y conciso diseñado para ayudar a los ciudadanos en Venezuela, especialmente a personas de la tercera edad, durante y después del reciente terremoto. 
            
Tus respuestas deben ser:
1. Extremadamente claras y fáciles de leer.
2. Usar un tono calmado, respetuoso y útil.
3. Centralizar información oficial (como números de Protección Civil, bomberos, centros de acopio) cuando sea pertinente.
4. Si no sabes una información específica (ej. daños en una calle puntual), admítelo y recomienda canales oficiales.
5. Usa formato markdown para resaltar cosas importantes con negritas, y usa listas cuando enumeres pasos.`
		};

		const apiMessages = [systemMessage, ...messages.map((m: Message) => ({ role: m.role, content: m.content }))];

		const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENROUTER_API_KEY}`,
				'Content-Type': 'application/json',
				'HTTP-Referer': 'http://localhost:5173/', // Replace with actual domain in production
				'X-Title': 'Encuéntralos'
			},
			body: JSON.stringify({
				model: 'meta-llama/llama-3-8b-instruct:free', // Default free model for now, can be changed
				messages: apiMessages,
				stream: true
			})
		});

		if (!response.ok) {
			const err = await response.text();
			console.error('OpenRouter API Error:', err);
			return json({ error: 'Error comunicando con OpenRouter' }, { status: response.status });
		}

		// Creamos un TransformStream para parsear el Server-Sent Events (SSE) de OpenRouter y extraer solo el texto
		const stream = new ReadableStream({
			async start(controller) {
				const reader = response.body?.getReader();
				const decoder = new TextDecoder();

				if (!reader) {
					controller.close();
					return;
				}

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const chunk = decoder.decode(value, { stream: true });
						const lines = chunk.split('\n');

						for (const line of lines) {
							if (line.startsWith('data: ') && line !== 'data: [DONE]') {
								try {
									const data = JSON.parse(line.slice(6));
									if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
										// Enviamos solo el contenido de texto puro al cliente
										controller.enqueue(new TextEncoder().encode(data.choices[0].delta.content));
									}
								} catch {
									// Parse error on a chunk, ignore and continue
								}
							}
						}
					}
				} catch (e) {
					console.error('Error durante el streaming:', e);
				} finally {
					controller.close();
					reader.releaseLock();
				}
			}
		});

		return new Response(stream, {
			headers: {
				'Content-Type': 'text/plain; charset=utf-8',
				'Cache-Control': 'no-cache'
			}
		});
	} catch (error) {
		console.error('Error en /api/chat:', error);
		return json({ error: 'Error interno del servidor' }, { status: 500 });
	}
};
