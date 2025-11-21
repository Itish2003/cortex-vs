import * as vscode from 'vscode';

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'cortex.chatView';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) { }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'onInfo': {
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case 'onError': {
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    public addInsight(text: string, audioBase64: string) {
        if (this._view) {
            this._view.show?.(true); // Make sure view is visible
            this._view.webview.postMessage({ type: 'addInsight', text: text, audio: audioBase64 });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Get the local path to main script run in the webview, if we had one.
        // For now, we'll inline the script and styles.

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Cortex Mentor Chat</title>
                <style>
                    body {
                        font-family: var(--vscode-font-family);
                        padding: 10px;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                    }
                    .message {
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 10px;
                        margin-bottom: 10px;
                        border-radius: 5px;
                        border-left: 4px solid var(--vscode-textLink-activeForeground);
                        animation: fadeIn 0.5s ease-in;
                    }
                    .message-header {
                        font-weight: bold;
                        margin-bottom: 5px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .timestamp {
                        font-size: 0.8em;
                        color: var(--vscode-descriptionForeground);
                    }
                    .content {
                        line-height: 1.4;
                        white-space: pre-wrap;
                    }
                    .audio-controls {
                        margin-top: 8px;
                    }
                    button {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 5px 10px;
                        cursor: pointer;
                        border-radius: 3px;
                    }
                    button:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(10px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
			</head>
			<body>
                <div id="chat-container">
                    <!-- Messages will be added here -->
                </div>

				<script>
                    const vscode = acquireVsCodeApi();
                    const chatContainer = document.getElementById('chat-container');

                    window.addEventListener('message', event => {
                        const message = event.data; // The json data that the extension sent
                        switch (message.type) {
                            case 'addInsight':
                                {
                                    addMessage(message.text, message.audio);
                                    break;
                                }
                        }
                    });

                    function addMessage(text, audioBase64) {
                        const div = document.createElement('div');
                        div.className = 'message';
                        
                        const now = new Date();
                        const timeString = now.toLocaleTimeString();

                        let audioHtml = '';
                        if (audioBase64) {
                            // We use a unique ID for the audio element
                            const audioId = 'audio-' + Date.now();
                            audioHtml = \`
                                <div class="audio-controls">
                                    <audio id="\${audioId}" src="data:audio/wav;base64,\${audioBase64}"></audio>
                                    <button onclick="document.getElementById('\${audioId}').play()">▶ Play Audio</button>
                                </div>
                            \`;
                            
                            // Auto-play logic (optional, can be annoying if not expected)
                            setTimeout(() => {
                                const audio = document.getElementById(audioId);
                                if(audio) {
                                    audio.play().catch(e => console.log("Auto-play prevented:", e));
                                }
                            }, 100);
                        }

                        div.innerHTML = \`
                            <div class="message-header">
                                <span>Cortex Mentor</span>
                                <span class="timestamp">\${timeString}</span>
                            </div>
                            <div class="content">\${text}</div>
                            \${audioHtml}
                        \`;

                        chatContainer.appendChild(div);
                        window.scrollTo(0, document.body.scrollHeight);
                    }
                </script>
			</body>
			</html>`;
    }
}
