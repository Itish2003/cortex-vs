import * as vscode from 'vscode';
import WebSocket from 'ws';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { exec } from 'child_process';

let ws: WebSocket | null = null;

export function activate(context: vscode.ExtensionContext) {

	console.log('Cortex Mentor extension is now active.');

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(plug) Cortex';
	statusBarItem.tooltip = 'Cortex Mentor: Disconnected';
	statusBarItem.command = 'cortex-vs.connect';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	const playAudio = (audioBuffer: Buffer) => {
		const tempDir = os.tmpdir();
		const tempFilePath = path.join(tempDir, `cortex_insight_${Date.now()}.wav`);

		fs.writeFile(tempFilePath, audioBuffer, (err) => {
			if (err) {
				console.error('Cortex Mentor: Failed to write temporary audio file:', err);
				return;
			}

			let command: string;
			if (os.platform() === 'darwin') { // macOS
				command = `afplay "${tempFilePath}"`;
			} else if (os.platform() === 'linux') { // Linux
				command = `aplay "${tempFilePath}"`;
			} else if (os.platform() === 'win32') { // Windows
				command = `start "${tempFilePath}"`; // 'start' command opens with default player
			} else {
				console.warn('Cortex Mentor: Unsupported OS for audio playback.');
				return;
			}

			exec(command, (error) => {
				if (error) {
					console.error('Cortex Mentor: Failed to play audio:', error);
				} else {
					console.log('Cortex Mentor: Audio played successfully.');
				}
				// Clean up the temporary file
				fs.unlink(tempFilePath, (unlinkErr) => {
					if (unlinkErr) {
						console.error('Cortex Mentor: Failed to delete temporary audio file:', unlinkErr);
					}
				});
			});
		});
	};

	const connect = () => {
		if (ws) {
			return; // Already connected or connecting
		}
		statusBarItem.text = '$(sync~spin) Cortex';
		statusBarItem.tooltip = 'Cortex Mentor: Connecting...';
		ws = new WebSocket('ws://localhost:8000/ws');

		ws.on('open', () => {
			console.log('Cortex Mentor: Connected to backend.');
			statusBarItem.text = '$(zap) Cortex';
			statusBarItem.tooltip = 'Cortex Mentor: Connected';
			statusBarItem.command = 'cortex-vs.disconnect';
		});

		ws.on('message', (data: WebSocket.Data) => {
			if (data instanceof Buffer) {
				console.log('Cortex Mentor: Received audio data.');
				playAudio(data);
			} else {
				console.log('Cortex Mentor: Received non-audio message:', data.toString());
			}
		});

		ws.on('close', () => {
			console.log('Cortex Mentor: Disconnected from backend.');
			statusBarItem.text = '$(plug) Cortex';
			statusBarItem.tooltip = 'Cortex Mentor: Disconnected';
			statusBarItem.command = 'cortex-vs.connect';
			ws = null;
		});

		ws.on('error', (error) => {
			console.error('Cortex Mentor WebSocket error:', error);
			statusBarItem.text = '$(error) Cortex';
			statusBarItem.tooltip = `Cortex Mentor: Error - ${error.message}`;
			if (ws) {
				ws.close();
			}
		});
	};

	const disconnect = () => {
		if (ws) {
			ws.close();
		}
	};

	context.subscriptions.push(vscode.commands.registerCommand('cortex-vs.connect', connect));
	context.subscriptions.push(vscode.commands.registerCommand('cortex-vs.disconnect', disconnect));

	// Automatically connect on startup
	connect();
}

export function deactivate() {
	if (ws) {
		ws.close();
	}
}
