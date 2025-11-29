import * as vscode from 'vscode';

export class ChatViewProvider implements vscode.WebviewViewProvider {

    public static readonly viewType = 'cortex.chatView';

    private _view?: vscode.WebviewView;
    private _messageQueue: Array<{ text: string, audio: string }> = [];
    private _isConnected: boolean = false;

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
                case 'saveHistory': {
                    // Forward history to extension for storage
                    vscode.commands.executeCommand('cortex.saveChatHistory', data.history);
                    break;
                }
                case 'webviewLoaded': {
                    // Request history load
                    vscode.commands.executeCommand('cortex.loadChatHistory');
                    // Restore connection status
                    this.setConnectionStatus(this._isConnected);
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

    public setConnectionStatus(isConnected: boolean) {
        this._isConnected = isConnected;
        if (this._view) {
            this._view.webview.postMessage({ type: 'statusUpdate', isConnected });
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

    public loadHistory(history: any[]) {
        if (this._view) {
            this._view.webview.postMessage({ type: 'loadHistory', history });
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
`.trim();

        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' https://cdn.jsdelivr.net; img-src ${webview.cspSource} https: data:; media-src data:;">
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
                        flex-shrink: 0;
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
                        padding-bottom: 60px; /* Space for clear button */
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
                    
                    .mermaid-output {
                        background-color: black;
                        padding: 20px;
                        border-radius: 8px;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                        cursor: zoom-in;
                        transition: transform 0.2s;
                    }

                    .mermaid-output:hover {
                        transform: scale(1.02);
                    }
                    
                    .mermaid-output svg {
                        max-width: none !important;
                        width: 100% !important;
                        height: auto !important;
                    }

                    /* Lightbox */
                    .lightbox {
                        display: none;
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-color: rgba(0, 0, 0, 0.9);
                        z-index: 1000;
                        justify-content: center;
                        align-items: center;
                        overflow: auto;
                        cursor: zoom-out;
                    }

                    .lightbox.active {
                        display: flex;
                        animation: fadeIn 0.2s ease-out;
                    }

                    .lightbox-content {
                        max-width: 95%;
                        max-height: 95%;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }

                    .lightbox-content img {
                        max-width: 100%;
                        max-height: 90vh;
                        object-fit: contain;
                        box-shadow: 0 0 20px rgba(255,255,255,0.1);
                        border-radius: 4px;
                        background-color: black; /* Ensure background matches */
                    }

                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }

                    @keyframes pulse {
                        0% { transform: scale(1); }
                        50% { transform: scale(1.1); }
                        100% { transform: scale(1); }
                    }

                    .play-btn.attention {
                        animation: pulse 1.5s infinite;
                        border: 2px solid var(--vscode-focusBorder);
                    }
                </style>
			</head>
			<body>
                <!-- Tabs -->
                <div class="tabs">
                    <div class="tab-container">
                        <div class="tab active" id="tab-chat">Chat</div>
                        <div class="tab" id="tab-architecture">Architecture</div>
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
                    <button class="clear-btn" id="clear-chat-btn">Clear Chat</button>
                </div>

                <!-- Architecture Tab -->
                <div id="architecture-content" class="content-area">
                    <div id="architecture-container">
                        <!-- Hidden Source -->
                        <div id="mermaid-source" style="display: none;">
${mermaidDiagram}
                        </div>
                        <!-- Output Container -->
                        <div id="mermaid-output" class="mermaid-output"></div>
                    </div>
                </div>

                <!-- Lightbox -->
                <div id="lightbox" class="lightbox">
                    <div id="lightbox-content" class="lightbox-content"></div>
                </div>

				<script type="module" nonce="${nonce}">
                    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
                    
                    // Initialize
                    mermaid.initialize({ startOnLoad: false, theme: 'dark' });
                    window.mermaid = mermaid;
                </script>

				<script nonce="${nonce}">
                    const vscode = acquireVsCodeApi();
                    let chatHistory = [];
                    
                    // Initialize
                    window.addEventListener('load', () => {
                        // Restore state
                        const state = vscode.getState() || { tab: 'chat' };
                        switchTab(state.tab, false); // false = don't save state yet

                        // Notify extension we are ready
                        vscode.postMessage({ type: 'webviewLoaded' });

                        // Attach Event Listeners
                        document.getElementById('tab-chat').addEventListener('click', () => switchTab('chat'));
                        document.getElementById('tab-architecture').addEventListener('click', () => switchTab('architecture'));
                        document.getElementById('clear-chat-btn').addEventListener('click', clearChat);
                        
                        // Lightbox Listeners
                        document.getElementById('mermaid-output').addEventListener('click', openLightbox);
                        document.getElementById('lightbox').addEventListener('click', closeLightbox);

                        // Unlock Audio on Interaction
                        document.body.addEventListener('click', unlockAudio, { once: true });
                        document.body.addEventListener('keydown', unlockAudio, { once: true });
                    });

                    function unlockAudio() {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        if (AudioContext) {
                            const ctx = new AudioContext();
                            ctx.resume();
                        }
                    }

                    // Tab Switching
                    function switchTab(tabName, saveState = true) {
                        // Hide all content
                        document.querySelectorAll('.content-area').forEach(el => el.classList.remove('active'));
                        document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));

                        // Show selected
                        const content = document.getElementById(tabName + '-content');
                        const tab = document.getElementById('tab-' + tabName);
                        
                        if (content) content.classList.add('active');
                        if (tab) tab.classList.add('active');

                        if (saveState) {
                            vscode.setState({ tab: tabName });
                        }

                        // Trigger Mermaid render if switching to architecture
                        if (tabName === 'architecture' && window.mermaid) {
                            // Clear previous output and inject fresh source
                            const source = document.getElementById('mermaid-source').textContent;
                            const output = document.getElementById('mermaid-output');
                            output.textContent = source;
                            output.removeAttribute('data-processed'); // Clear mermaid marker

                            // Delay to ensure DOM is updated
                            setTimeout(async () => {
                                try {
                                    await window.mermaid.run({
                                        nodes: [output]
                                    });
                                } catch (err) {
                                    console.error('Mermaid Render Error:', err);
                                    vscode.postMessage({ type: 'onError', value: 'Mermaid Render Error: ' + err.message });
                                }
                            }, 100);
                        }
                    }

                    // Lightbox Logic
                    function openLightbox() {
                        const output = document.getElementById('mermaid-output');
                        const svg = output.querySelector('svg');
                        const lightbox = document.getElementById('lightbox');
                        const lightboxContent = document.getElementById('lightbox-content');
                        
                        if (svg) {
                            // Ensure namespace exists for image rendering
                            if (!svg.hasAttribute('xmlns')) {
                                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                            }

                            // Serialize SVG to string
                            const serializer = new XMLSerializer();
                            let source = serializer.serializeToString(svg);

                            // Encode to Base64
                            const base64 = btoa(unescape(encodeURIComponent(source)));
                            const imgSrc = 'data:image/svg+xml;base64,' + base64;

                            // Create Image
                            lightboxContent.innerHTML = '<img src="' + imgSrc + '" alt="Architecture Diagram" />';
                            lightbox.classList.add('active');
                        }
                    }

                    function closeLightbox() {
                        document.getElementById('lightbox').classList.remove('active');
                    }

                    // Clear Chat
                    function clearChat() {
                        document.getElementById('chat-container').innerHTML = '';
                        chatHistory = [];
                        saveHistory();
                    }

                    function saveHistory() {
                        vscode.postMessage({ type: 'saveHistory', history: chatHistory });
                    }

                    // Message Handling
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.type) {
                            case 'addInsight':
                                addMessage(message.text, message.audio, true); // true = save to history
                                break;
                            case 'statusUpdate':
                                updateStatus(message.isConnected);
                                break;
                            case 'loadHistory':
                                loadHistory(message.history);
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

                    function loadHistory(history) {
                        if (!history) return;
                        chatHistory = history;
                        const container = document.getElementById('chat-container');
                        container.innerHTML = ''; // Clear current
                        
                        history.forEach(msg => {
                            renderMessage(msg.text, msg.audio, msg.timestamp, false); // false = don't auto-play
                        });
                        
                        // Scroll to bottom
                        if (container.lastElementChild) {
                            container.lastElementChild.scrollIntoView();
                        }
                    }

                    function addMessage(text, audioBase64, save = false) {
                        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        
                        if (save) {
                            chatHistory.push({ text, audio: audioBase64, timestamp: now });
                            saveHistory();
                        }

                        renderMessage(text, audioBase64, now, true); // true = auto-play new messages
                    }

                    function renderMessage(text, audioBase64, timestamp, autoPlay) {
                        const container = document.getElementById('chat-container');
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
                        time.textContent = timestamp;
                        header.appendChild(time);

                        body.appendChild(header);

                        // Text Content (Safe)
                        const textDiv = document.createElement('div');
                        textDiv.className = 'text-content';
                        textDiv.textContent = text;
                        body.appendChild(textDiv);

                        // Audio
                        if (audioBase64) {
                            const audioId = 'audio-' + Math.random().toString(36).substr(2, 9);
                            const playerDiv = document.createElement('div');
                            playerDiv.className = 'audio-player';

                            const audio = document.createElement('audio');
                            audio.id = audioId;
                            audio.src = 'data:audio/mp3;base64,' + audioBase64;
                            playerDiv.appendChild(audio);

                            const playBtn = document.createElement('button');
                            playBtn.className = 'play-btn';
                            playBtn.innerHTML = '▶'; // Play symbol
                            playBtn.onclick = () => {
                                document.getElementById(audioId).play();
                                playBtn.classList.remove('attention');
                            };
                            playerDiv.appendChild(playBtn);
                            
                            const label = document.createElement('span');
                            label.textContent = 'Play Insight';
                            label.style.fontSize = '0.9em';
                            playerDiv.appendChild(label);

                            body.appendChild(playerDiv);

                            // Auto-play only if requested (new messages)
                            if (autoPlay) {
                                setTimeout(() => {
                                    const audioEl = document.getElementById(audioId);
                                    if(audioEl) {
                                        audioEl.play().catch(e => {
                                            console.log("Auto-play prevented:", e);
                                            // Visual cue that audio is ready but blocked
                                            const btn = audioEl.nextElementSibling;
                                            if (btn) btn.classList.add('attention');
                                        });
                                    }
                                }, 500);
                            }
                        }

                        msgDiv.appendChild(body);
                        container.appendChild(msgDiv);
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
