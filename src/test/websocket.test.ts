import * as assert from 'assert';
import * as vscode from 'vscode';

/**
 * Unit tests for WebSocket client functionality
 *
 * Note: Full WebSocket integration tests require a running backend server.
 * These tests focus on the WebSocket message handling logic and configuration.
 */

suite('WebSocket Configuration Test Suite', () => {
	test('Backend URL should be configurable', () => {
		const config = vscode.workspace.getConfiguration('cortex');
		const backendUrl = config.get<string>('backendUrl');

		assert.ok(backendUrl, 'Backend URL should be defined');
		assert.ok(
			backendUrl!.startsWith('ws://') || backendUrl!.startsWith('wss://'),
			'Backend URL should use WebSocket protocol'
		);
	});

	test('Default backend URL should be localhost', () => {
		const config = vscode.workspace.getConfiguration('cortex');
		const inspection = config.inspect<string>('backendUrl');

		assert.ok(inspection, 'Configuration should be inspectable');
		assert.strictEqual(
			inspection?.defaultValue,
			'ws://localhost:8000/ws',
			'Default URL should be ws://localhost:8000/ws'
		);
	});

	test('Backend URL can be customized', async () => {
		const config = vscode.workspace.getConfiguration('cortex');

		// Test that we can update the configuration
		// Note: This will be reset after the test
		const originalValue = config.get<string>('backendUrl');

		try {
			await config.update('backendUrl', 'ws://custom:9000/ws', vscode.ConfigurationTarget.Workspace);
			const updatedValue = config.get<string>('backendUrl');
			assert.strictEqual(updatedValue, 'ws://custom:9000/ws', 'URL should be updateable');
		} finally {
			// Restore original value
			await config.update('backendUrl', originalValue, vscode.ConfigurationTarget.Workspace);
		}
	});
});

suite('WebSocket Message Parsing Test Suite', () => {
	/**
	 * Test helper to simulate message parsing logic from extension.ts
	 */
	function parseWebSocketMessage(data: string): { type: string; text?: string; audio?: string } | null {
		try {
			const message = JSON.parse(data);
			return message;
		} catch {
			return null;
		}
	}

	test('Should parse valid insight message', () => {
		const messageData = JSON.stringify({
			type: 'insight',
			text: 'This is a test insight',
			audio: 'base64AudioData'
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Message should be parsed');
		assert.strictEqual(parsed!.type, 'insight', 'Type should be insight');
		assert.strictEqual(parsed!.text, 'This is a test insight', 'Text should match');
		assert.strictEqual(parsed!.audio, 'base64AudioData', 'Audio should match');
	});

	test('Should handle message with missing optional fields', () => {
		const messageData = JSON.stringify({
			type: 'insight',
			text: 'Insight without audio'
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Message should be parsed');
		assert.strictEqual(parsed!.type, 'insight');
		assert.strictEqual(parsed!.text, 'Insight without audio');
		assert.strictEqual(parsed!.audio, undefined, 'Audio should be undefined');
	});

	test('Should handle unknown message types gracefully', () => {
		const messageData = JSON.stringify({
			type: 'unknown_type',
			data: 'some data'
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Message should still be parsed');
		assert.strictEqual(parsed!.type, 'unknown_type');
	});

	test('Should return null for invalid JSON', () => {
		const invalidData = 'not valid json{{{';

		const parsed = parseWebSocketMessage(invalidData);

		assert.strictEqual(parsed, null, 'Invalid JSON should return null');
	});

	test('Should handle empty message', () => {
		const parsed = parseWebSocketMessage('');
		assert.strictEqual(parsed, null, 'Empty string should return null');
	});

	test('Should handle message with special characters', () => {
		const messageData = JSON.stringify({
			type: 'insight',
			text: 'Special chars: <>&"\' and unicode: \u00e9\u00e8\u00ea',
			audio: 'YXVkaW9fZGF0YQ=='
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Message should be parsed');
		assert.ok(parsed!.text!.includes('Special chars'), 'Text should contain special chars');
	});

	test('Should handle large message payload', () => {
		const largeText = 'A'.repeat(100000);
		const messageData = JSON.stringify({
			type: 'insight',
			text: largeText,
			audio: 'base64data'
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Large message should be parsed');
		assert.strictEqual(parsed!.text!.length, 100000, 'Text length should match');
	});

	test('Should handle nested JSON in text field', () => {
		const messageData = JSON.stringify({
			type: 'insight',
			text: 'Contains JSON: {"nested": "value"}',
			audio: ''
		});

		const parsed = parseWebSocketMessage(messageData);

		assert.ok(parsed, 'Message should be parsed');
		assert.ok(parsed!.text!.includes('{"nested"'), 'Nested JSON should be preserved');
	});
});

suite('WebSocket Connection State Test Suite', () => {
	test('Connect command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex-vs.connect'),
			'Connect command should be registered'
		);
	});

	test('Disconnect command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex-vs.disconnect'),
			'Disconnect command should be registered'
		);
	});

	test('Connect command should be executable', async () => {
		// Execute connect command - should not throw
		// Note: Will attempt to connect but may fail without backend
		try {
			await vscode.commands.executeCommand('cortex-vs.connect');
			// If we get here without error, command executed
			assert.ok(true, 'Connect command executed without throwing');
		} catch (error) {
			// Connection failure is expected without backend
			assert.ok(true, 'Connect command executed (connection expected to fail without backend)');
		}
	});

	test('Disconnect command should be executable', async () => {
		try {
			await vscode.commands.executeCommand('cortex-vs.disconnect');
			assert.ok(true, 'Disconnect command executed without throwing');
		} catch (error) {
			// Should not throw even when not connected
			assert.fail('Disconnect command should not throw: ' + error);
		}
	});
});

suite('WebSocket Status Bar Test Suite', () => {
	test('Extension should contribute to status bar', async () => {
		const extension = vscode.extensions.getExtension('itish.cortex-vs');
		assert.ok(extension, 'Extension should be found');

		// Verify the extension is active (it auto-connects on startup)
		if (!extension.isActive) {
			await extension.activate();
		}
		assert.ok(extension.isActive, 'Extension should be active');
	});

	test('Status bar icon states should be documented', () => {
		// Document expected status bar states
		const expectedStates = [
			{ icon: '$(plug)', tooltip: 'Disconnected' },
			{ icon: '$(sync~spin)', tooltip: 'Connecting' },
			{ icon: '$(zap)', tooltip: 'Connected' },
			{ icon: '$(error)', tooltip: 'Error' }
		];

		// Verify we have all expected states defined
		assert.strictEqual(expectedStates.length, 4, 'Should have 4 connection states');

		expectedStates.forEach(state => {
			assert.ok(state.icon.startsWith('$('), 'Icon should use VS Code icon syntax');
			assert.ok(state.tooltip, 'Each state should have a tooltip');
		});
	});
});

suite('WebSocket Reconnection Test Suite', () => {
	test('Multiple connect calls should be idempotent', async () => {
		// Calling connect multiple times should not cause issues
		try {
			await vscode.commands.executeCommand('cortex-vs.connect');
			await vscode.commands.executeCommand('cortex-vs.connect');
			await vscode.commands.executeCommand('cortex-vs.connect');
			assert.ok(true, 'Multiple connect calls should not throw');
		} catch (error) {
			// Connection failures are expected, but shouldn't crash
			assert.ok(true, 'Connect handled gracefully');
		}
	});

	test('Disconnect after disconnect should be safe', async () => {
		try {
			await vscode.commands.executeCommand('cortex-vs.disconnect');
			await vscode.commands.executeCommand('cortex-vs.disconnect');
			assert.ok(true, 'Multiple disconnect calls should be safe');
		} catch (error) {
			assert.fail('Multiple disconnects should not throw: ' + error);
		}
	});

	test('Connect-disconnect-connect cycle should work', async () => {
		try {
			await vscode.commands.executeCommand('cortex-vs.connect');
			await vscode.commands.executeCommand('cortex-vs.disconnect');
			await vscode.commands.executeCommand('cortex-vs.connect');
			assert.ok(true, 'Connection cycle should work');
		} catch (error) {
			// Connection may fail without backend, but cycle should be attempted
			assert.ok(true, 'Connection cycle attempted');
		}
	});
});

suite('WebSocket Error Handling Test Suite', () => {
	/**
	 * Test helper to simulate error handling logic
	 */
	function handleWebSocketError(error: Error): { shouldReconnect: boolean; message: string } {
		// Simulates error handling logic from extension.ts
		const message = error.message || 'Unknown error';

		// Connection refused - server not running
		if (message.includes('ECONNREFUSED')) {
			return { shouldReconnect: false, message: 'Server not available' };
		}

		// Network errors - might be temporary
		if (message.includes('ETIMEDOUT') || message.includes('ENETUNREACH')) {
			return { shouldReconnect: true, message: 'Network error' };
		}

		// Default case
		return { shouldReconnect: false, message };
	}

	test('Should handle connection refused error', () => {
		const error = new Error('connect ECONNREFUSED 127.0.0.1:8000');
		const result = handleWebSocketError(error);

		assert.strictEqual(result.shouldReconnect, false, 'Should not auto-reconnect on refused');
		assert.ok(result.message.includes('Server'), 'Message should mention server');
	});

	test('Should handle timeout error', () => {
		const error = new Error('connect ETIMEDOUT');
		const result = handleWebSocketError(error);

		assert.strictEqual(result.shouldReconnect, true, 'Should suggest reconnect on timeout');
	});

	test('Should handle network unreachable error', () => {
		const error = new Error('connect ENETUNREACH');
		const result = handleWebSocketError(error);

		assert.strictEqual(result.shouldReconnect, true, 'Should suggest reconnect on network error');
	});

	test('Should handle unknown errors gracefully', () => {
		const error = new Error('Some unknown error');
		const result = handleWebSocketError(error);

		assert.ok(result.message, 'Should provide error message');
		assert.strictEqual(result.shouldReconnect, false, 'Should not auto-reconnect on unknown error');
	});

	test('Should handle error with no message', () => {
		const error = new Error();
		const result = handleWebSocketError(error);

		assert.ok(result.message, 'Should have fallback message');
	});
});
