import * as vscode from 'vscode';
import WebSocket from 'ws';

let ws: WebSocket | null = null;

import { ChatViewProvider } from './ChatViewProvider';

export function activate(context: vscode.ExtensionContext) {

	console.log('Cortex Mentor extension is now active.');
	vscode.window.showInformationMessage('Cortex Mentor: Extension Activated!');

	// Register the Chat View Provider
	const provider = new ChatViewProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ChatViewProvider.viewType, provider)
	);

	const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.text = '$(plug) Cortex';
	statusBarItem.tooltip = 'Cortex Mentor: Disconnected';
	statusBarItem.command = 'cortex-vs.connect';
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	const connect = () => {
		if (ws) {
			return; // Already connected or connecting
		}

		// Get URL from configuration
		const config = vscode.workspace.getConfiguration('cortex');
		const backendUrl = config.get<string>('backendUrl') || 'ws://localhost:8000/ws';

		statusBarItem.text = '$(sync~spin) Cortex';
		statusBarItem.tooltip = 'Cortex Mentor: Connecting...';
		ws = new WebSocket(backendUrl);

		ws.on('open', () => {
			console.log('Cortex Mentor: Connected to backend.');
			statusBarItem.text = '$(zap) Cortex';
			statusBarItem.tooltip = 'Cortex Mentor: Connected';
			statusBarItem.command = 'cortex-vs.disconnect';
			provider.setConnectionStatus(true);
		});

		ws.on('message', (data: WebSocket.Data) => {
			try {
				// Parse the incoming message as JSON
				const messageStr = data.toString();
				const message = JSON.parse(messageStr);

				if (message.type === 'insight') {
					console.log('Cortex Mentor: Received insight.');
					// Force the view to open
					vscode.commands.executeCommand('cortex.chatView.focus');
					// Send to the Chat View
					provider.addInsight(message.text, message.audio);
					vscode.window.showInformationMessage('Cortex Mentor: Insight received and displayed.');
				} else {
					console.log('Cortex Mentor: Received unknown message type:', message);
				}

			} catch (e) {
				console.error('Cortex Mentor: Failed to parse message:', e);
				// Fallback for raw audio (legacy support if needed, but we are moving to JSON)
				if (data instanceof Buffer) {
					console.log('Cortex Mentor: Received raw buffer (legacy), ignoring.');
				}
			}
		});

		ws.on('close', () => {
			console.log('Cortex Mentor: Disconnected from backend.');
			statusBarItem.text = '$(plug) Cortex';
			statusBarItem.tooltip = 'Cortex Mentor: Disconnected';
			statusBarItem.command = 'cortex-vs.connect';
			ws = null;
			provider.setConnectionStatus(false);
		});

		ws.on('error', (error) => {
			console.error('Cortex Mentor WebSocket error:', error);
			statusBarItem.text = '$(error) Cortex';
			statusBarItem.tooltip = `Cortex Mentor: Error - ${error.message}`;
			if (ws) {
				ws.close();
			}
			provider.setConnectionStatus(false);
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
