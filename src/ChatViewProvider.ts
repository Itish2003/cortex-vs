import * as vscode from 'vscode';

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'cortex.chatView';

    private _view?: vscode.WebviewView;
    private _messageQueue: Array<{ text: string, audio: string }> = [];

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

        // Flush pending messages
        while (this._messageQueue.length > 0) {
            const msg = this._messageQueue.shift();
            if (msg) {
                this.addInsight(msg.text, msg.audio);
            }
        }
    }

    public addInsight(text: string, audioBase64: string) {
        if (this._view) {
            this._view.show?.(true); // Make sure view is visible
            this._view.webview.postMessage({ type: 'addInsight', text: text, audio: audioBase64 });
        } else {
            // Queue the message if the view is not yet ready
            this._messageQueue.push({ text, audio: audioBase64 });
        }
    }

    public setConnectionStatus(isConnected: boolean) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'statusUpdate', isConnected });
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to whitelist which scripts can be run
        const nonce = getNonce();

        // Mermaid Diagram Source (from docs/architecture.md)
        const mermaidDiagram = `
graph TD
    subgraph "User's Local Machine"
        subgraph "Environment (Observers)"
            A[IDE Plugin]
            B[Git Hooks]
            C[CLI Wrapper]
        end
        
        subgraph "Private RAG System (User Model)"
            F["Markdown Knowledge Graph"]
            G["Local ChromaDB"]
            H["Local Ollama"]
        end
        User([User])
    end

    subgraph "Cortex Backend"
        subgraph "Real-time Delivery"
            D[FastAPI Gateway]
            D1(WebSocket)
            D2[Redis Pub/Sub]
            E["ARQ Task Queue"]
        end
        
        subgraph "Agent Fleet"
            AGENT_L1["L1: Comprehension"]
            AGENT_L2["L2: Synthesis"]
            AGENT_L3["L3: Engagement"]
        end
        
        subgraph "Public RAG System"
            I["Upstash Context"]
            J[Gemini TTS]
        end
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> AGENT_L1
    AGENT_L1 --> F
    AGENT_L1 --> G
    G --> H
    AGENT_L1 --> E
    E --> AGENT_L2
    AGENT_L2 --- G
    AGENT_L2 --- I
    AGENT_L2 --> E
    E --> AGENT_L3
    AGENT_L3 --> J
    AGENT_L3 --> D2
    D --> D1
    D1 --> A
    A --> User
`;

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; media-src data:;">
				<title>Cortex Mentor Chat</title>
                <script nonce="${nonce}" src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
                <style>
                    :root {
                        --container-paddding: 20px;
                        --input-padding-vertical: 6px;
                        --input-padding-horizontal: 4px;
                        --input-margin-vertical: 4px;
                        --input-margin-horizontal: 0;
                    }

                    body {
                        font-family: var(--vscode-font-family);
                        padding: 0;
                        margin: 0;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        display: flex;
                        flex-direction: column;
                        height: 100vh;
                        overflow: hidden;
                    }

                    /* Tabs */
                    .tabs {
                        display: flex;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background-color: var(--vscode-sideBar-background);
                        align-items: center;
                        justify-content: space-between;
                    }
                    
                    .tab-container {
                        display: flex;
                    }

                    .tab {
                        padding: 10px 20px;
                        cursor: pointer;
                        border-bottom: 2px solid transparent;
                        opacity: 0.7;
                        transition: all 0.2s;
                        font-weight: 500;
                    }
                    
                    .tab:hover {
                        opacity: 1;
                        background-color: var(--vscode-list-hoverBackground);
                    }
                    
                    .tab.active {
                        opacity: 1;
                        border-bottom-color: var(--vscode-panelTitle-activeBorder);
                        color: var(--vscode-panelTitle-activeForeground);
                    }

                    /* Status Indicator */
                    .status-container {
                        padding-right: 15px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 0.8em;
                        opacity: 0.8;
                    }

                    .status-dot {
                        width: 8px;
                        height: 8px;
                        border-radius: 50%;
                        background-color: var(--vscode-testing-iconFailed);
                        transition: background-color 0.3s;
                    }

                    .status-dot.connected {
                        background-color: var(--vscode-testing-iconPassed);
                        box-shadow: 0 0 4px var(--vscode-testing-iconPassed);
                    }

                    /* Content Areas */
                    .content-area {
                        flex: 1;
                        overflow-y: auto;
                        padding: 15px;
                        display: none;
                    }
                    
                    .content-area.active {
                        display: block;
                    }

                    /* Chat Styles */
                    #chat-container {
                        display: flex;
                        flex-direction: column;
                        gap: 15px;
                    }

                    .message {
                        display: flex;
                        gap: 10px;
                        animation: fadeIn 0.3s ease-out;
                        max-width: 100%;
                    }

                    .avatar {
                        width: 30px;
                        height: 30px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 1.2em;
                        flex-shrink: 0;
                        background-color: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground);
                    }

                    .message-body {
                        flex: 1;
                        background-color: var(--vscode-editor-inactiveSelectionBackground);
                        padding: 10px 14px;
                        border-radius: 0 12px 12px 12px;
                        position: relative;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }

                    .message-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 6px;
                        font-size: 0.85em;
                        opacity: 0.8;
                    }

                    .author {
                        font-weight: 600;
                    }

                    .timestamp {
                        font-size: 0.9em;
                    }

                    .text-content {
                        line-height: 1.5;
                        white-space: pre-wrap;
                        word-wrap: break-word;
                    }

                    /* Audio Player */
                    .audio-player {
                        margin-top: 10px;
                        background: rgba(0,0,0,0.05);
                        padding: 8px;
                        border-radius: 8px;
                        display: flex;
                        align-items: center;
                        gap: 10px;
                    }

                    .play-btn {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: background-color 0.2s;
                    }

                    .play-btn:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }

                    /* Architecture Styles */
                    #architecture-container {
                        display: flex;
                        justify-content: center;
                        align-items: flex-start;
                        padding-top: 20px;
                    }
                    
                    .mermaid {
                        background-color: white;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                    }

                    /* Clear Button */
                    .clear-btn {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        background-color: var(--vscode-errorForeground);
                        color: white;
                        border: none;
                        padding: 8px 12px;
                        border-radius: 4px;
                        cursor: pointer;
                        opacity: 0.8;
                        font-size: 0.8em;
                        z-index: 100;
                    }
                    .clear-btn:hover {
                        opacity: 1;
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; transform: translateY(5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                </style>
			</head>
			<body>
                <!-- Tabs -->
                <div class="tabs">
                    <div class="tab-container">
                        <div class="tab active" onclick="switchTab('chat')">Chat</div>
                        <div class="tab" onclick="switchTab('architecture')">Architecture</div>
                    </div>
                    <div class="status-container" title="WebSocket Connection Status">
                        <div id="status-dot" class="status-dot"></div>
                        <span id="status-text">Disconnected</span>
                    </div>
                </div>

                <!-- Chat Tab -->
                <div id="chat-content" class="content-area active">
                    <div id="chat-container">
                        <!-- Messages go here -->
                    </div>
                    <button class="clear-btn" onclick="clearChat()">Clear Chat</button>
                </div>

                <!-- Architecture Tab -->
                <div id="architecture-content" class="content-area">
                    <div id="architecture-container">
                        <div class="mermaid">
                            ${mermaidDiagram}
                        </div>
                    </div>
                </div>

				<script type="module" nonce="${nonce}">
                    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                    
                    // Initialize Mermaid
                    mermaid.initialize({ startOnLoad: true, theme: 'default' });
                </script>

				<script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    
                    // Tab Switching
                    // (We need to attach this to window because module scope is not global)
                    window.switchTab = function(tabName) {
                        // Hide all content
                        document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

                        // Show selected
                        document.getElementById(tabName + '-content').classList.add('active');
                        
                        // Highlight tab
                        const tabs = document.querySelectorAll('.tab');
                        if (tabName === 'chat') tabs[0].classList.add('active');
                        else tabs[1].classList.add('active');
                    }

                    // Clear Chat
                    window.clearChat = function() {
                        document.getElementById('chat-container').innerHTML = '';
                    }

                    // Message Handling
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addInsight':
                                addMessage(message.text, message.audio);
                                break;
                            case 'statusUpdate':
                                updateStatus(message.isConnected);
                                break;
                        }
                    });

                    function updateStatus(isConnected) {
                        const dot = document.getElementById('status-dot');
                        const text = document.getElementById('status-text');
                        if (isConnected) {
                            dot.classList.add('connected');
                            text.textContent = 'Connected';
                        } else {
                            dot.classList.remove('connected');
                            text.textContent = 'Disconnected';
                        }
                    }

                    function addMessage(text, audioBase64) {
                        const container = document.getElementById('chat-container');
                        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        const msgDiv = document.createElement('div');
                        msgDiv.className = 'message';

                        // Avatar
                        const avatar = document.createElement('div');
                        avatar.className = 'avatar';
                        avatar.textContent = '🤖'; // Robot emoji for Cortex
                        msgDiv.appendChild(avatar);

                        // Body
                        const body = document.createElement('div');
                        body.className = 'message-body';

                        // Header
                        const header = document.createElement('div');
                        header.className = 'message-header';
                        
                        const author = document.createElement('span');
                        author.className = 'author';
                        author.textContent = 'Cortex Mentor';
                        header.appendChild(author);

                        const time = document.createElement('span');
                        time.className = 'timestamp';
                        time.textContent = now;
                        header.appendChild(time);

                        body.appendChild(header);

                        // Text Content (Safe)
                        const textDiv = document.createElement('div');
                        textDiv.className = 'text-content';
                        textDiv.textContent = text;
                        body.appendChild(textDiv);

                        // Audio
                        if (audioBase64) {
                            const audioId = 'audio-' + Date.now();
                            const playerDiv = document.createElement('div');
                            playerDiv.className = 'audio-player';

                            const audio = document.createElement('audio');
                            audio.id = audioId;
                            audio.src = \`data:audio/mp3;base64,\${audioBase64}\`;
                            playerDiv.appendChild(audio);

                            const playBtn = document.createElement('button');
                            playBtn.className = 'play-btn';
                            playBtn.innerHTML = '▶'; // Play symbol
                            playBtn.onclick = () => document.getElementById(audioId).play();
                            playerDiv.appendChild(playBtn);
                            
                            const label = document.createElement('span');
                            label.textContent = 'Play Insight';
                            label.style.fontSize = '0.9em';
                            playerDiv.appendChild(label);

                            body.appendChild(playerDiv);

                            // Auto-play
                            setTimeout(() => {
                                const audioEl = document.getElementById(audioId);
                                if(audioEl) {
                                    audioEl.play().catch(e => console.log("Auto-play prevented:", e));
                                }
                            }, 500);
                        }

                        msgDiv.appendChild(body);
                        container.appendChild(msgDiv);
                        
                        // Scroll to bottom
                        msgDiv.scrollIntoView({ behavior: 'smooth' });
                    }
                </script>
			</body>
			</html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
