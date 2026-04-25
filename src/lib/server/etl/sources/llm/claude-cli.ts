/**
 * Appel à la CLI Claude (claude --print) — [SPEC-LLM]
 *
 * Utilise la session Claude Code locale, sans clé API ni facturation séparée.
 * Prérequis : CLI `claude` installée et connectée (claude --version).
 */

import { spawn } from 'node:child_process';

// ─── Détection avec cache 30s ─────────────────────────────────────────────────

let _cached: boolean | null = null;
let _cacheExpiry = 0;

/**
 * Vérifie que la CLI Claude est disponible.
 * Résultat mis en cache 30 secondes pour éviter les appels répétés.
 */
export async function detectClaude(): Promise<boolean> {
	if (_cached !== null && Date.now() < _cacheExpiry) return _cached;
	const result = await new Promise<boolean>((resolve) => {
		const proc = spawn('claude', ['--version'], { stdio: 'ignore' });
		proc.on('error', () => resolve(false));
		proc.on('close', (code) => resolve(code === 0));
	});
	_cached = result;
	_cacheExpiry = Date.now() + 30_000;
	return result;
}

/**
 * Envoie un prompt à la CLI Claude et retourne la réponse textuelle.
 *
 * @param prompt - Prompt complet (inclure le contexte système si nécessaire)
 * @returns Réponse brute de Claude, trimée
 * @throws Si la CLI retourne un code non nul
 */
export async function callClaude(prompt: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const proc = spawn('claude', ['--print', '--output-format', 'text'], {
			stdio: ['pipe', 'pipe', 'pipe']
		});

		let stdout = '';
		let stderr = '';

		proc.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
		});
		proc.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});

		proc.stdin.write(prompt, 'utf8');
		proc.stdin.end();

		proc.on('error', (err) => reject(err));
		proc.on('close', (code) => {
			if (code !== 0) reject(new Error(`claude exited ${code}: ${stderr.slice(0, 200)}`));
			else resolve(stdout.trim());
		});
	});
}
