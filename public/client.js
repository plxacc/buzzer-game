const socket = io(); // يعمل محليًا أو مع الخادم العام بناءً على URL الصفحة

let userName = '';
let roomCode = '';
let isHost = false;

function submitName() {
    userName = document.getElementById('username').value.trim();
    if (userName) {
        switchScreen('name-screen', 'choice-screen');
        document.getElementById('display-name').textContent = userName;
    } else {
        showError('name-screen', 'يرجى إدخال اسم صالح.');
    }
}

function createRoom() {
    socket.emit('createRoom', { userName });
}

function showJoin() {
    switchScreen('choice-screen', 'join-screen');
}

function joinRoom() {
    const inputCode = document.getElementById('room-code-input').value.trim();
    if (inputCode) {
        roomCode = inputCode;
        socket.emit('joinRoom', { userName, roomCode });
    } else {
        showError('join-screen', 'يرجى إدخال كود الغرفة.');
    }
}

function pressBuzzer() {
    socket.emit('pressBuzzer', { userName, roomCode });
}

function resetBuzzer() {
    socket.emit('resetBuzzer', roomCode);
}

function copyCode() {
    const codeElement = isHost ? document.getElementById('room-code') : document.getElementById('player-room-code');
    const codeText = codeElement.textContent;
    navigator.clipboard.writeText(codeText)
        .then(() => {
            alert('تم نسخ الكود: ' + codeText);
        })
        .catch(err => {
            console.error('فشل في نسخ الكود:', err);
        });
}

function toggleCodeVisibility() {
    const codeElement = document.getElementById('room-code');
    const toggleButton = document.getElementById('toggle-code-btn');
    if (codeElement.classList.contains('hidden-code')) {
        codeElement.classList.remove('hidden-code');
        toggleButton.textContent = 'إخفاء الكود';
    } else {
        codeElement.classList.add('hidden-code');
        toggleButton.textContent = 'إظهار الكود';
    }
}

function goBackToName() {
    switchScreen('choice-screen', 'name-screen');
}

function goBackToChoice() {
    if (!isHost && roomCode) {
        socket.emit('leaveRoom', { userName, roomCode });
    }
    switchScreen('join-screen', 'choice-screen');
    switchScreen('host-screen', 'choice-screen');
    switchScreen('player-screen', 'choice-screen');
    isHost = false;
    roomCode = '';
}

function switchScreen(fromId, toId) {
    const fromScreen = document.getElementById(fromId);
    const toScreen = document.getElementById(toId);
    fromScreen.classList.add('fade-out');
    setTimeout(() => {
        fromScreen.classList.add('hidden');
        fromScreen.classList.remove('fade-out');
        toScreen.classList.remove('hidden');
        toScreen.classList.add('fade-in');
        setTimeout(() => toScreen.classList.remove('fade-in'), 300);
    }, 300);
}

function showError(screenId, message) {
    const errorElement = document.querySelector(`#${screenId} #error-message`);
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => errorElement.classList.add('hidden'), 5000);
}

// Socket.IO Listeners
socket.on('roomCreated', (data) => {
    roomCode = data.roomCode;
    isHost = true;
    switchScreen('choice-screen', 'host-screen');
    document.getElementById('room-code').textContent = roomCode;
    updateMembers(data.members);
});

socket.on('joinedRoom', (data) => {
    roomCode = data.roomCode;
    switchScreen('join-screen', 'player-screen');
    document.getElementById('player-room-code').textContent = roomCode;
    document.getElementById('player-name-display').textContent = userName;
});

socket.on('updateMembers', (members) => {
    updateMembers(members);
});

socket.on('buzzerPressed', (data) => {
    const buzzer = document.getElementById('buzzer');
    if (!isHost) {
        if (data.userName === userName) {
            buzzer.classList.add('pressed');
            buzzer.disabled = true;
        } else {
            buzzer.classList.remove('pressed');
            buzzer.disabled = true;
        }
    }
    document.getElementById('status').textContent = `${data.userName} ضغط الزر!`;
    if (isHost) {
        document.getElementById('last-pressed').textContent = data.userName;
    }
});

socket.on('buzzerReset', () => {
    const buzzer = document.getElementById('buzzer');
    buzzer.classList.remove('pressed');
    buzzer.disabled = false;
    document.getElementById('status').textContent = 'اضغط الزر عندما تكون جاهزًا';
    if (isHost) {
        document.getElementById('last-pressed').textContent = 'لا أحد';
    }
});

socket.on('error', (data) => {
    const currentScreen = document.querySelector('.container:not(.hidden)').id;
    showError(currentScreen, data.message);
});

function updateMembers(members) {
    const membersList = document.getElementById('members-list');
    if (!isHost) return;

    const hostName = members[0];
    const players = members.slice(1);

    let hostSection = membersList.querySelector('.host-section');
    if (!hostSection) {
        hostSection = document.createElement('div');
        hostSection.className = 'host-section';
        hostSection.innerHTML = `<div class="host-label">هوست</div><ul><li class="host-name">${hostName}</li></ul>`;
        membersList.appendChild(hostSection);
    } else {
        hostSection.querySelector('.host-name').textContent = hostName;
    }

    let playersSection = membersList.querySelector('.players-section');
    if (players.length > 0) {
        if (!playersSection) {
            playersSection = document.createElement('div');
            playersSection.className = 'players-section';
            membersList.appendChild(playersSection);
        }
        playersSection.innerHTML = `<div class="players-label">لاعبون</div><ul>${players.map(player => `<li class="player-name">${player}</li>`).join('')}</ul>`;
    } else if (playersSection) {
        playersSection.remove();
    }
}