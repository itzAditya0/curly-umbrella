// Configuration
const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const IS_RENDER = window.location.hostname.includes('onrender.com');
const PRODUCTION_WS_URL = 'wss://curly-umbrella-7375.onrender.com/ws';

// Smart WebSocket URL detection
let WS_URL;
if (IS_LOCALHOST) {
    // Local development
    WS_URL = `ws://${window.location.host}/ws`;
} else if (IS_RENDER) {
    // Deployed on Render - use same-origin WebSocket
    WS_URL = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;
} else {
    // External deployment (e.g., Vercel) - use hardcoded backend URL
    WS_URL = PRODUCTION_WS_URL;
}

console.log(`🔗 WebSocket URL: ${WS_URL}`);

// State
const state = {
    myId: null,
    privateKey: null,
    publicKey: null,
    publicKeyArmored: null,
    friends: {}, // { id: { publicKey: keyObj, messages: [] } }
    currentChatId: null,
    socket: null,
    typingTimeout: null,
    incomingFiles: {}, // { fromId: { name, size, mime, chunks: [], receivedSize: 0 } }
    keyFiles: { public: null, private: null },

    // Mobile View Helper
    setMobileView(view) {
        const sidebar = document.querySelector('.sidebar');
        const chatArea = document.querySelector('.chat-area');

        if (view === 'chat') {
            sidebar?.classList.add('hidden-mobile');
            chatArea?.classList.add('active-mobile');
        } else {
            sidebar?.classList.remove('hidden-mobile');
            chatArea?.classList.remove('active-mobile');
        }
    }
};

// Audio
const audio = {
    message: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1O+8iSkFJHfH8N2QQAoUXrTp66hVFAlPn+Hs'), // Short beep
    connect: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHQ8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1O+8iSkFJHfH8N2QQAoUXrTp66hVFAlPn+Hs')
};

// DOM Elements
const els = {
    // Setup
    setupForm: document.getElementById('setup-form'),
    passphraseInput: document.getElementById('passphrase'),
    connectBtn: document.getElementById('connect-btn'),
    showGenBtn: document.getElementById('show-gen-btn'),
    setupError: document.getElementById('setup-error'),
    dropZone: document.getElementById('drop-zone'),
    publicKeyFile: document.getElementById('public-key-file'),
    privateKeyFile: document.getElementById('private-key-file'),

    // Key Gen
    genPanel: document.getElementById('gen-panel'),
    generateBtn: document.getElementById('generate-btn'),
    cancelGenBtn: document.getElementById('cancel-gen-btn'),
    genName: document.getElementById('gen-name'),
    genPass: document.getElementById('gen-passphrase'),

    // Sidebar
    settingsContent: document.getElementById('settings-content'),
    toggleSettings: document.getElementById('toggle-settings'),
    userCard: document.getElementById('user-card'),
    myUserIdDisplay: document.getElementById('my-user-id'),
    copyIdBtn: document.getElementById('copy-id-btn'),
    addFriendSection: document.getElementById('add-friend-section'),
    friendIdInput: document.getElementById('friend-id-input'),
    addFriendBtn: document.getElementById('add-friend-btn'),
    friendsSection: document.getElementById('friends-section'),
    friendsList: document.getElementById('friends-list'),

    // Chat Area
    emptyState: document.getElementById('empty-state'),
    chatInterface: document.getElementById('chat-interface'),
    currentChatName: document.getElementById('current-chat-name'),
    typingIndicator: document.getElementById('typing-indicator'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    // Files
    fileInput: document.getElementById('file-input'),
    attachBtn: document.getElementById('attach-btn'),

    // Header
    connectionStatus: document.getElementById('connection-status'),
    logoutBtn: document.getElementById('logout-btn')
};

// --- Initialization & Key Management ---

// Check OpenPGP
if (typeof openpgp === 'undefined') {
    alert('CRITICAL ERROR: OpenPGP.js library not loaded.');
}

// Toggle Settings Accordion
if (els.toggleSettings) {
    els.toggleSettings.addEventListener('click', () => {
        els.settingsContent.classList.toggle('hidden');
    });
}

// Toggle Key Gen Panel
if (els.showGenBtn) {
    els.showGenBtn.addEventListener('click', () => {
        console.log('Generate button clicked');
        els.setupForm.classList.add('hidden');
        els.genPanel.classList.remove('hidden');
        console.log('Setup form hidden:', els.setupForm.classList.contains('hidden'));
        console.log('Gen panel visible:', !els.genPanel.classList.contains('hidden'));
    });
}

if (els.cancelGenBtn) {
    els.cancelGenBtn.addEventListener('click', () => {
        els.genPanel.classList.add('hidden');
        els.setupForm.classList.remove('hidden');
    });
}

// Drag & Drop
if (els.dropZone) {
    els.dropZone.addEventListener('click', () => els.publicKeyFile.click());
    els.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        els.dropZone.style.borderColor = 'var(--accent)';
    });
    els.dropZone.addEventListener('dragleave', () => {
        els.dropZone.style.borderColor = 'var(--border)';
    });
    els.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        els.dropZone.style.borderColor = 'var(--border)';
        handleDroppedFiles(e.dataTransfer.files);
    });
}

// Handle File Inputs for Keys
if (els.publicKeyFile) {
    els.publicKeyFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            state.keyFiles.public = e.target.files[0];
            updateDropZoneText();
            els.privateKeyFile.click();
        }
    });
}

if (els.privateKeyFile) {
    els.privateKeyFile.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            state.keyFiles.private = e.target.files[0];
            updateDropZoneText();
        }
    });
}

function handleDroppedFiles(files) {
    for (let file of files) {
        if (file.name.includes('public')) state.keyFiles.public = file;
        if (file.name.includes('private')) state.keyFiles.private = file;
    }
    updateDropZoneText();
}

function updateDropZoneText() {
    let text = 'Drag & Drop Keys';
    if (state.keyFiles.public) text = `Public: ${state.keyFiles.public.name}`;
    if (state.keyFiles.private) text += ` | Private: ${state.keyFiles.private.name}`;
    els.dropZone.querySelector('.drop-text').textContent = text;
}

// Connect
if (els.connectBtn) {
    els.connectBtn.addEventListener('click', async () => {
        const passphrase = els.passphraseInput.value;
        if (!state.keyFiles.public || !state.keyFiles.private || !passphrase) {
            els.setupError.textContent = 'Please provide keys and passphrase.';
            return;
        }
        const pubText = await state.keyFiles.public.text();
        const privText = await state.keyFiles.private.text();
        await initializeKeys(pubText, privText, passphrase);
    });
}

// Generate Keys
if (els.generateBtn) {
    els.generateBtn.addEventListener('click', async () => {
        const name = els.genName.value.trim();
        const passphrase = els.genPass.value;

        if (!name || !passphrase) {
            alert('Please enter name and passphrase');
            return;
        }

        els.generateBtn.textContent = 'Generating...';
        els.generateBtn.disabled = true;

        try {
            const { privateKey, publicKey } = await openpgp.generateKey({
                type: 'ecc',
                curve: 'curve25519',
                userIDs: [{ name: name, email: `${name}@secure.chat` }],
                passphrase,
                format: 'armored'
            });

            console.log('Keys generated');

            downloadFile(`${name}_public.asc`, publicKey);
            downloadFile(`${name}_private.asc`, privateKey);

            await initializeKeys(publicKey, privateKey, passphrase);

        } catch (err) {
            console.error(err);
            alert('Key generation failed: ' + err.message);
            els.generateBtn.textContent = 'Generate';
            els.generateBtn.disabled = false;
        }
    });
}

function downloadFile(filename, content) {
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

async function initializeKeys(pubArmored, privArmored, passphrase) {
    try {
        state.publicKey = await openpgp.readKey({ armoredKey: pubArmored });
        state.publicKeyArmored = pubArmored;
        const privateKeyObj = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privArmored }),
            passphrase
        });
        state.privateKey = privateKeyObj;

        // UI Transition
        els.settingsContent.classList.add('hidden');
        els.userCard.classList.remove('hidden');
        els.addFriendSection.classList.remove('hidden');
        els.friendsSection.classList.remove('hidden');
        els.logoutBtn.classList.remove('hidden');

        connectWebSocket();
        audio.connect.play().catch(e => { });

    } catch (err) {
        console.error(err);
        els.setupError.textContent = 'Invalid keys or passphrase.';
    }
}

// --- WebSocket & Chat Logic ---

function connectWebSocket() {
    console.log(`🔌 Connecting to WebSocket: ${WS_URL}`);
    try {
        state.socket = new WebSocket(WS_URL);
    } catch (e) {
        console.error(`❌ WebSocket creation failed:`, e);
        alert('Failed to create WebSocket connection. Check console for details.');
        return;
    }

    state.socket.onopen = () => {
        console.log('✅ WebSocket Connected!');
        els.connectionStatus.className = 'status-indicator online';
        els.connectionStatus.title = 'Online';
    };

    state.socket.onclose = (event) => {
        console.log(`❌ WebSocket Closed: Code ${event.code}, Reason: ${event.reason || 'None'}`);
        els.connectionStatus.className = 'status-indicator offline';
        els.connectionStatus.title = 'Offline';

        // Alert user if unexpected disconnect
        if (event.code !== 1000) {
            alert(`WebSocket connection closed unexpectedly. Code: ${event.code}\nPlease refresh the page.`);
        }
    };

    state.socket.onerror = (error) => {
        console.error(`❌ WebSocket Error:`, error);
        els.connectionStatus.className = 'status-indicator offline';
        alert('WebSocket connection error! Please check:\n1. Backend is running\n2. Correct WebSocket URL\n3. Network connection');
    };

    state.socket.onmessage = async (event) => {
        try {
            console.log('📨 Raw WebSocket message:', event.data);
            const data = JSON.parse(event.data);
            console.log('📨 Parsed message type:', data.type, data);
            await handleServerMessage(data);
        } catch (err) {
            console.error(`❌ Error handling message:`, err);
        }
    };
}

// Logout
if (els.logoutBtn) {
    els.logoutBtn.addEventListener('click', () => {
        if (state.socket) state.socket.close();
        location.reload();
    });
}

// Mobile Back Button
const mobileBackBtn = document.getElementById('mobile-back-btn');
if (mobileBackBtn) {
    mobileBackBtn.addEventListener('click', () => {
        state.setMobileView('list');
        // Optionally hide chat interface
        els.chatInterface.classList.add('hidden');
        els.emptyState.classList.remove('hidden');
        state.currentChatId = null;
    });
}

async function handleServerMessage(data) {
    console.log('Received Message:', data.type, data);
    switch (data.type) {
        case 'WELCOME':
            state.myId = data.userId; // Server sends 'userId'
            els.myUserIdDisplay.textContent = state.myId;
            console.log('Connected with ID:', state.myId);
            break;

        case 'FRIEND_REQUEST':
            console.log('Received FRIEND_REQUEST from:', data.from);
            console.log('Received Public Key:', data.publicKey ? data.publicKey.substring(0, 50) + '...' : 'MISSING');

            // Receive friend request with their public key
            if (confirm(`Accept friend request from ${data.from}?`)) {
                try {
                    if (!data.publicKey) throw new Error('Missing public key from sender');

                    // Store their public key
                    const theirPublicKey = await openpgp.readKey({ armoredKey: data.publicKey });

                    // Send acceptance with YOUR public key
                    state.socket.send(JSON.stringify({
                        type: 'ACCEPT_FRIEND',
                        to: data.from,
                        publicKey: state.publicKeyArmored
                    }));

                    // Add friend with their key
                    state.friends[data.from] = {
                        publicKey: theirPublicKey,
                        messages: []
                    };
                    renderFriendsList();
                    alert(`${data.from} added! You can now chat securely.`);
                } catch (err) {
                    console.error('Invalid public key from friend:', err);
                    console.log('Full received key:', data.publicKey);
                    alert(`Failed to add friend: ${err.message}`);
                }
            }
            break;

        case 'FRIEND_ACCEPTED':
            console.log('Received FRIEND_ACCEPTED from:', data.from);
            console.log('Received Public Key:', data.publicKey ? data.publicKey.substring(0, 50) + '...' : 'MISSING');

            // Friend accepted, receive their public key
            try {
                if (!data.publicKey) throw new Error('Missing public key from friend');

                const theirPublicKey = await openpgp.readKey({ armoredKey: data.publicKey });

                if (!state.friends[data.from]) {
                    state.friends[data.from] = { publicKey: null, messages: [] };
                }
                state.friends[data.from].publicKey = theirPublicKey;
                renderFriendsList();
                alert(`${data.from} accepted your friend request! You can now chat securely.`);
            } catch (err) {
                console.error('Invalid public key from friend:', err);
                console.log('Full received key:', data.publicKey);
                alert(`Friend accepted but key exchange failed: ${err.message}`);
            }
            break;

        case 'MESSAGE':
            await receiveMessage(data);
            break;

        case 'TYPING':
            handleTyping(data.from);
            break;

        case 'FILE_START':
        case 'FILE_CHUNK':
        case 'FILE_END':
            await handleFilePacket(data);
            break;

        case 'ERROR':
            alert(`Server Error: ${data.message}`);
            break;
    }
}

async function handleFilePacket(data) {
    const fromId = data.from;

    if (data.type === 'FILE_START') {
        state.incomingFiles[fromId] = {
            name: data.name,
            size: data.size,
            mime: data.mime,
            chunks: [],
            receivedSize: 0
        };
        console.log(`Receiving file: ${data.name} (${data.size} bytes)`);

    } else if (data.type === 'FILE_CHUNK') {
        const fileState = state.incomingFiles[fromId];
        if (!fileState) return;

        fileState.chunks.push(data.chunk);
        fileState.receivedSize += data.chunk.length;

    } else if (data.type === 'FILE_END') {
        const fileState = state.incomingFiles[fromId];
        if (!fileState) return;

        console.log('File receive complete. Reassembling...');

        try {
            const fullBase64 = fileState.chunks.join('');
            const message = await openpgp.readMessage({ armoredMessage: fullBase64 });
            const { data: decryptedBinary } = await openpgp.decrypt({
                message,
                decryptionKeys: state.privateKey,
                verificationKeys: state.friends[fromId].publicKey,
                format: 'binary'
            });

            const blob = new Blob([decryptedBinary], { type: fileState.mime });
            const url = URL.createObjectURL(blob);

            state.friends[fromId].messages.push({
                from: 'them',
                type: 'file',
                content: url,
                name: fileState.name,
                mime: fileState.mime,
                timestamp: Date.now()
            });

            if (state.currentChatId === fromId) {
                renderMessages();
                audio.message.play().catch(e => { });
            } else {
                const friendItem = Array.from(els.friendsList.children).find(li => li.textContent.includes(fromId));
                if (friendItem) friendItem.classList.add('unread');
                audio.message.play().catch(e => { });
            }

        } catch (err) {
            console.error('File decryption failed:', err);
            alert('Failed to decrypt received file.');
        }

        delete state.incomingFiles[fromId];
    }
}

function handleTyping(fromId) {
    if (state.currentChatId === fromId) {
        els.typingIndicator.textContent = `${fromId} is typing...`;
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => {
            els.typingIndicator.textContent = '';
        }, 2000);
    }
}

// Add Friend - Send request with public key
if (els.addFriendBtn) {
    els.addFriendBtn.addEventListener('click', async () => {
        const friendId = els.friendIdInput.value.trim().toUpperCase();
        if (!friendId) return;

        if (friendId === state.myId) {
            alert('You cannot add yourself as a friend!');
            return;
        }

        if (state.friends[friendId]) {
            alert('Friend already added!');
            return;
        }

        if (!state.publicKeyArmored) {
            alert('Error: Your public key is not loaded. Please reconnect.');
            return;
        }

        // Send friend request with your public key
        state.socket.send(JSON.stringify({
            type: 'ADD_FRIEND',
            to: friendId,
            publicKey: state.publicKeyArmored // Send your public key
        }));

        // Add friend to list (without their key yet)
        state.friends[friendId] = { publicKey: null, messages: [] };
        renderFriendsList();
        els.friendIdInput.value = '';

        alert(`Friend request sent to ${friendId}. Awaiting acceptance...`);
    });
}

function addFriend(id, publicKeyArmored = null) {
    if (!state.friends[id]) {
        alert(`Friend ${id} added. Please click their name to upload their Public Key.`);
        state.friends[id] = { publicKey: null, messages: [] };
    }
    renderFriendsList();
}

function selectFriend(friendId) {
    state.currentChatId = friendId;

    // Update UI
    renderFriendsList();
    renderMessages();

    // Show chat interface
    els.emptyState.classList.add('hidden');
    els.chatInterface.classList.remove('hidden');
    els.currentChatName.textContent = `Chat with ${friendId}`;

    // Focus input
    els.messageInput.focus();

    // Switch to chat view on mobile
    state.setMobileView('chat');
}

function renderFriendsList() {
    els.friendsList.innerHTML = '';
    Object.keys(state.friends).forEach(id => {
        const li = document.createElement('li');
        const hasKey = state.friends[id].publicKey ? '🔐' : '⏳';
        li.textContent = `${hasKey} ${id}`;
        if (id === state.currentChatId) li.classList.add('active');

        li.addEventListener('click', () => {
            if (!state.friends[id].publicKey) {
                alert(`Waiting for ${id} to accept your friend request or exchange keys...`);
                return;
            }
            selectFriend(id);
        });
        els.friendsList.appendChild(li);
    });
}

// Copy ID
if (els.copyIdBtn) {
    els.copyIdBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(state.myId);
        els.copyIdBtn.textContent = '✅';
        setTimeout(() => els.copyIdBtn.textContent = '📋', 2000);
    });
}

// Send Message
if (els.sendBtn) {
    els.sendBtn.addEventListener('click', sendMessage);
}

if (els.messageInput) {
    els.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Typing Event
    els.messageInput.addEventListener('input', () => {
        if (state.currentChatId && state.socket) {
            state.socket.send(JSON.stringify({
                type: 'TYPING',
                to: state.currentChatId
            }));
        }
    });
}

// File Attachment
if (els.attachBtn) {
    els.attachBtn.addEventListener('click', () => els.fileInput.click());
}

async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) {
        alert('File too large. Max 100MB.');
        return;
    }

    await sendFile(file);
    els.fileInput.value = '';
}

if (els.fileInput) {
    els.fileInput.addEventListener('change', handleFileSelect);
}

async function sendFile(file) {
    if (!state.currentChatId) return;
    const friend = state.friends[state.currentChatId];

    if (!friend.publicKey) {
        alert('Missing Public Key for this friend!');
        return;
    }

    try {
        console.log(`Encrypting file: ${file.name}`);

        const fileData = new Uint8Array(await file.arrayBuffer());

        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ binary: fileData }),
            encryptionKeys: friend.publicKey,
            signingKeys: state.privateKey,
            format: 'armored'
        });

        state.socket.send(JSON.stringify({
            type: 'FILE_START',
            to: state.currentChatId,
            name: file.name,
            size: file.size,
            mime: file.type
        }));

        const CHUNK_SIZE = 64 * 1024;
        const totalChunks = Math.ceil(encrypted.length / CHUNK_SIZE);

        for (let i = 0; i < totalChunks; i++) {
            const chunk = encrypted.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
            state.socket.send(JSON.stringify({
                type: 'FILE_CHUNK',
                to: state.currentChatId,
                chunk: chunk
            }));
            if (i % 10 === 0) await new Promise(r => setTimeout(r, 10));
        }

        state.socket.send(JSON.stringify({
            type: 'FILE_END',
            to: state.currentChatId
        }));

        const url = URL.createObjectURL(file);
        friend.messages.push({
            from: 'me',
            type: 'file',
            content: url,
            name: file.name,
            mime: file.type,
            timestamp: Date.now()
        });

        renderMessages();

    } catch (err) {
        console.error('File send failed:', err);
        alert('Failed to send file.');
    }
}

async function sendMessage() {
    const content = els.messageInput.value.trim();
    if (!content || !state.currentChatId) return;

    const friend = state.friends[state.currentChatId];
    if (!friend.publicKey) {
        alert('Missing Public Key for this friend!');
        return;
    }

    try {
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: content }),
            encryptionKeys: friend.publicKey,
            signingKeys: state.privateKey
        });

        state.socket.send(JSON.stringify({
            type: 'MESSAGE',
            to: state.currentChatId,
            content: encrypted
        }));

        friend.messages.push({
            from: 'me',
            type: 'text',
            text: content,
            timestamp: Date.now()
        });

        els.messageInput.value = '';
        renderMessages();
        audio.message.play().catch(e => { });

    } catch (err) {
        console.error(err);
        alert('Encryption failed');
    }
}

async function receiveMessage(data) {
    const { from: fromId, content: encryptedMsg, timestamp } = data;

    try {
        const message = await openpgp.readMessage({ armoredMessage: encryptedMsg });
        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: state.privateKey,
            verificationKeys: state.friends[fromId].publicKey
        });

        state.friends[fromId].messages.push({
            from: 'them',
            type: 'text',
            text: decrypted,
            timestamp: timestamp
        });

        if (state.currentChatId === fromId) {
            renderMessages();
            audio.message.play().catch(e => { });
        } else {
            const friendItem = Array.from(els.friendsList.children).find(li => li.textContent.includes(fromId));
            if (friendItem) friendItem.classList.add('unread');
            audio.message.play().catch(e => { });
        }

    } catch (err) {
        console.error('Decryption failed:', err);
        state.friends[fromId].messages.push({
            from: 'them',
            type: 'text',
            text: '[DECRYPTION_ERROR]',
            timestamp: timestamp
        });
        if (state.currentChatId === fromId) renderMessages();
    }
}

function renderMessages() {
    if (!state.currentChatId) return;
    const messages = state.friends[state.currentChatId].messages;
    els.messagesContainer.innerHTML = '';

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.from}`;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <span class="meta">${msg.from === 'me' ? 'YOU' : state.currentChatId} // ${timeStr}</span>
            ${renderContent(msg)}
        `;
        els.messagesContainer.appendChild(div);
    });

    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
}

function renderContent(msg) {
    if (msg.type === 'file') {
        const isImage = msg.mime.startsWith('image/');
        const isPdf = msg.mime === 'application/pdf';

        if (isImage) {
            return `
                <div class="file-preview">
                    <img src="${msg.content}" alt="${msg.name}">
                    <div class="file-download">
                        <a href="${msg.content}" download="${msg.name}">[DOWNLOAD ${msg.name}]</a>
                    </div>
                </div>
            `;
        } else if (isPdf) {
            return `
                <div class="file-preview">
                    <iframe src="${msg.content}"></iframe>
                    <div class="file-download">
                        <a href="${msg.content}" download="${msg.name}">[DOWNLOAD ${msg.name}]</a>
                    </div>
                </div>
            `;
        } else {
            return `
                <div class="file-download">
                    <span>FILE: ${msg.name}</span>
                    <a href="${msg.content}" download="${msg.name}">[DOWNLOAD]</a>
                </div>
            `;
        }
    } else {
        return escapeHtml(msg.text);
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
