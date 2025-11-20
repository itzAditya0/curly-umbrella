// State
let state = {
    userId: null,
    privateKey: null, // Decrypted private key object
    publicKey: null,  // My public key object
    publicKeyArmored: null, // My public key string
    friends: {}, // { id: { publicKey: keyObj, messages: [] } }
    currentChatId: null,
    socket: null
};

// DOM Elements
const els = {
    setupSection: document.getElementById('setup-section'),
    dashboardSection: document.getElementById('dashboard-section'),
    status: document.getElementById('connection-status'),
    setupError: document.getElementById('setup-error'),
    myUserId: document.getElementById('my-user-id'),
    friendsList: document.getElementById('friends-list'),
    chatHeader: document.getElementById('current-chat-name'),
    messagesContainer: document.getElementById('messages-container'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),
    connectBtn: document.getElementById('connect-btn'),
    addFriendBtn: document.getElementById('add-friend-btn'),
    friendIdInput: document.getElementById('friend-id-input'),
    copyIdBtn: document.getElementById('copy-id-btn')
};

// --- Initialization & Key Management ---

els.connectBtn.addEventListener('click', async () => {
    const pubFile = document.getElementById('public-key-file').files[0];
    const privFile = document.getElementById('private-key-file').files[0];
    const passphrase = document.getElementById('passphrase').value;

    if (!pubFile || !privFile) {
        showError('Please upload both public and private keys.');
        return;
    }

    try {
        els.connectBtn.disabled = true;
        els.connectBtn.textContent = 'DECRYPTING_KEYS...';

        const pubText = await readFile(pubFile);
        const privText = await readFile(privFile);

        // Parse keys
        state.publicKey = await openpgp.readKey({ armoredKey: pubText });
        state.publicKeyArmored = pubText;

        const privateKey = await openpgp.readPrivateKey({ armoredKey: privText });

        // Decrypt private key
        try {
            state.privateKey = await openpgp.decryptKey({
                privateKey,
                passphrase
            });
        } catch (e) {
            throw new Error('Invalid passphrase or private key.');
        }

        els.connectBtn.textContent = 'CONNECTING_SERVER...';
        connectWebSocket();

    } catch (err) {
        showError(err.message);
        els.connectBtn.disabled = false;
        els.connectBtn.textContent = 'ESTABLISH_UPLINK';
    }
});

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(e);
        reader.readAsText(file);
    });
}

function showError(msg) {
    els.setupError.textContent = `ERROR: ${msg}`;
}

// --- WebSocket & Networking ---

function connectWebSocket() {
    // Use ws://localhost:8765 for local dev, user can change if needed
    // In production this would be wss://
    const wsUrl = location.protocol === 'https:'
        ? `wss://${location.host}/ws` // If served via proxy
        : 'ws://localhost:8765';

    state.socket = new WebSocket(wsUrl);

    state.socket.onopen = () => {
        els.status.textContent = 'ONLINE';
        els.status.className = 'status online';
    };

    state.socket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        await handleServerMessage(data);
    };

    state.socket.onclose = () => {
        els.status.textContent = 'OFFLINE';
        els.status.className = 'status offline';
        // Optional: Auto-reconnect logic could go here
    };

    state.socket.onerror = (err) => {
        console.error('WebSocket error:', err);
        showError('Connection failed.');
        els.connectBtn.disabled = false;
        els.connectBtn.textContent = 'ESTABLISH_UPLINK';
    };
}

async function handleServerMessage(data) {
    console.log('Received:', data.type);

    switch (data.type) {
        case 'WELCOME':
            state.userId = data.userId;
            els.myUserId.textContent = state.userId;
            els.setupSection.classList.add('hidden');
            els.dashboardSection.classList.remove('hidden');
            break;

        case 'FRIEND_REQUEST':
            if (confirm(`Accept friend request from ${data.from}?`)) {
                await acceptFriend(data.from, data.publicKey);
            }
            break;

        case 'FRIEND_ACCEPT':
            await addFriend(data.from, data.publicKey);
            alert(`User ${data.from} accepted your request.`);
            break;

        case 'MESSAGE':
            await receiveMessage(data.from, data.content, data.timestamp);
            break;

        case 'ERROR':
            alert(`Server Error: ${data.message}`);
            break;
    }
}

// --- Friend Management ---

els.addFriendBtn.addEventListener('click', () => {
    const targetId = els.friendIdInput.value.trim().toUpperCase();
    if (!targetId) return;
    if (targetId === state.userId) {
        alert("Cannot add yourself.");
        return;
    }
    if (state.friends[targetId]) {
        alert("Already friends.");
        return;
    }

    state.socket.send(JSON.stringify({
        type: 'FRIEND_REQUEST',
        targetId: targetId,
        publicKey: state.publicKeyArmored
    }));

    els.friendIdInput.value = '';
    alert(`Request sent to ${targetId}`);
});

async function acceptFriend(friendId, friendPublicKeyArmored) {
    await addFriend(friendId, friendPublicKeyArmored);

    state.socket.send(JSON.stringify({
        type: 'FRIEND_ACCEPT',
        requesterId: friendId,
        publicKey: state.publicKeyArmored
    }));
}

async function addFriend(friendId, friendPublicKeyArmored) {
    const friendKey = await openpgp.readKey({ armoredKey: friendPublicKeyArmored });

    state.friends[friendId] = {
        publicKey: friendKey,
        messages: []
    };

    renderFriendsList();
}

function renderFriendsList() {
    els.friendsList.innerHTML = '';
    Object.keys(state.friends).forEach(id => {
        const li = document.createElement('li');
        li.className = `friend-item ${id === state.currentChatId ? 'active' : ''}`;
        li.innerHTML = `
            <span>${id}</span>
            <span class="status-dot"></span>
        `;
        li.onclick = () => selectChat(id);
        els.friendsList.appendChild(li);
    });
}

function selectChat(friendId) {
    state.currentChatId = friendId;
    els.chatHeader.textContent = `> SECURE_UPLINK: ${friendId}`;
    els.messageInput.disabled = false;
    els.sendBtn.disabled = false;
    renderFriendsList(); // Update active class
    renderMessages();
}

// --- Messaging ---

els.sendBtn.addEventListener('click', sendMessage);
els.messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

async function sendMessage() {
    const content = els.messageInput.value.trim();
    if (!content || !state.currentChatId) return;

    const friend = state.friends[state.currentChatId];

    try {
        // Encrypt message
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: content }),
            encryptionKeys: friend.publicKey,
            signingKeys: state.privateKey
        });

        // Send to server
        state.socket.send(JSON.stringify({
            type: 'MESSAGE',
            to: state.currentChatId,
            content: encrypted,
            timestamp: Date.now()
        }));

        // Store locally
        friend.messages.push({
            from: 'me',
            text: content,
            timestamp: Date.now()
        });

        els.messageInput.value = '';
        renderMessages();

    } catch (err) {
        console.error('Encryption failed:', err);
        alert('Failed to encrypt message.');
    }
}

async function receiveMessage(fromId, encryptedContent, timestamp) {
    if (!state.friends[fromId]) return; // Should not happen if logic is correct

    try {
        const message = await openpgp.readMessage({ armoredMessage: encryptedContent });

        const { data: decrypted } = await openpgp.decrypt({
            message,
            decryptionKeys: state.privateKey,
            verificationKeys: state.friends[fromId].publicKey
        });

        state.friends[fromId].messages.push({
            from: 'them',
            text: decrypted,
            timestamp: timestamp
        });

        if (state.currentChatId === fromId) {
            renderMessages();
        } else {
            // Optional: Notification indicator
        }

    } catch (err) {
        console.error('Decryption failed:', err);
        state.friends[fromId].messages.push({
            from: 'them',
            text: '[DECRYPTION_ERROR]',
            timestamp: timestamp
        });
    }
}

function renderMessages() {
    els.messagesContainer.innerHTML = '';
    if (!state.currentChatId) return;

    const messages = state.friends[state.currentChatId].messages;

    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.from === 'me' ? 'sent' : 'received'}`;

        const date = new Date(msg.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <span class="meta">${msg.from === 'me' ? 'YOU' : state.currentChatId} // ${timeStr}</span>
            ${escapeHtml(msg.text)}
        `;
        els.messagesContainer.appendChild(div);
    });

    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

els.copyIdBtn.addEventListener('click', () => {
    if (state.userId) {
        navigator.clipboard.writeText(state.userId);
        els.copyIdBtn.textContent = '[COPIED]';
        setTimeout(() => els.copyIdBtn.textContent = '[CPY]', 2000);
    }
});
