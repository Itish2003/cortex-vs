import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Activation Test Suite', () => {
	test('Should activate the extension', async () => {
		const extension = vscode.extensions.getExtension('itish.cortex-vs');
		assert.ok(extension, 'Extension not found');
		await extension.activate();
		assert.ok(extension.isActive, 'Extension is not active');
	});

	test('Connect command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex-vs.connect'),
			'Connect command not registered'
		);
	});

	test('Disconnect command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex-vs.disconnect'),
			'Disconnect command not registered'
		);
	});

	test('Save chat history command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex.saveChatHistory'),
			'Save chat history command not registered'
		);
	});

	test('Load chat history command should be registered', async () => {
		const commands = await vscode.commands.getCommands(true);
		assert.ok(
			commands.includes('cortex.loadChatHistory'),
			'Load chat history command not registered'
		);
	});
});

suite('Configuration Test Suite', () => {
	test('Backend URL configuration should exist', () => {
		const config = vscode.workspace.getConfiguration('cortex');
		const backendUrl = config.get<string>('backendUrl');
		assert.ok(backendUrl, 'Backend URL configuration not found');
		assert.strictEqual(
			backendUrl,
			'ws://localhost:8000/ws',
			'Default backend URL is incorrect'
		);
	});

	test('Configuration should be inspectable', () => {
		const config = vscode.workspace.getConfiguration('cortex');
		const inspection = config.inspect('backendUrl');
		assert.ok(inspection, 'Configuration inspection failed');
		assert.strictEqual(
			inspection?.defaultValue,
			'ws://localhost:8000/ws',
			'Default value inspection failed'
		);
	});
});

suite('Views Test Suite', () => {
	test('Chat view should be contributable', async () => {
		// Get all registered views - this tests that the view is properly contributed
		const extension = vscode.extensions.getExtension('itish.cortex-vs');
		assert.ok(extension, 'Extension not found');

		const packageJson = extension.packageJSON;
		assert.ok(packageJson.contributes, 'Contributes section not found');
		assert.ok(packageJson.contributes.views, 'Views contribution not found');
		assert.ok(
			packageJson.contributes.views['cortex-sidebar'],
			'Cortex sidebar view not found'
		);

		const chatView = packageJson.contributes.views['cortex-sidebar'].find(
			(v: any) => v.id === 'cortex.chatView'
		);
		assert.ok(chatView, 'Chat view not found in contributions');
		assert.strictEqual(chatView.type, 'webview', 'Chat view should be a webview');
	});

	test('Activity bar container should be registered', async () => {
		const extension = vscode.extensions.getExtension('itish.cortex-vs');
		assert.ok(extension, 'Extension not found');

		const packageJson = extension.packageJSON;
		const viewContainers = packageJson.contributes.viewsContainers;
		assert.ok(viewContainers, 'View containers not found');
		assert.ok(viewContainers.activitybar, 'Activity bar not found');

		const cortexSidebar = viewContainers.activitybar.find(
			(c: any) => c.id === 'cortex-sidebar'
		);
		assert.ok(cortexSidebar, 'Cortex sidebar container not found');
		assert.strictEqual(
			cortexSidebar.title,
			'Cortex Mentor',
			'Sidebar title is incorrect'
		);
	});
});
