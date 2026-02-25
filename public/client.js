const socket = io();

let userName = localStorage.getItem('userName') || '';
let roomCode = localStorage.getItem('roomCode') || '';
let isHost = localStorage.getItem('isHost') === 'true';
let team = localStorage.getItem('team') || '';

// البنق
setInterval(() => { socket.emit('ping', Date.now()); }, 2000);
socket.on('pong', (startTime) => { document.getElementById('ping-value').textContent = Date.now() - startTime; });

window.onload = () => {
    if (userName && roomCode) {
        if (isHost) {
            socket.emit('createRoom', { userName, existingCode: roomCode });
        } else {
            socket.emit('joinRoom', { userName, roomCode, team });
        }
    } else if (userName) {
        switchScreen('choice-screen');
        document.getElementById('display-name').textContent = userName;
    } else {
        switchScreen('name-screen');
    }
};

function submitName() {
    const inputVal = document.getElementById('username').value.trim();
    if (inputVal) {
        userName = inputVal;
        localStorage.setItem('userName', userName);
        document.getElementById('display-name').textContent = userName;
        switchScreen('choice-screen');
    } else {
        showError('name-error', 'يرجى إدخال اسمك أولاً!');
    }
}

function createRoom() { socket.emit('createRoom', { userName }); }
function showJoin() { switchScreen('join-screen'); }

function joinRoom() {
    const inputCode = document.getElementById('room-code-input').value.trim();
    const selectedTeam = document.getElementById('team-select').value;
    
    if (inputCode) {
        roomCode = inputCode;
        team = selectedTeam;
        socket.emit('joinRoom', { userName, roomCode, team });
    } else {
        showError('join-error', 'يرجى إدخال كود الغرفة!');
    }
}

function pressBuzzer() { socket.emit('pressBuzzer', { userName, roomCode }); }
function resetBuzzer() { socket.emit('resetBuzzer', roomCode); }

function startHostTimer() { socket.emit('hostTimerAction', { roomCode, action: 'start' }); }
function stopHostTimer() { socket.emit('hostTimerAction', { roomCode, action: 'stop' }); }
function resetHostTimer() { socket.emit('hostTimerAction', { roomCode, action: 'reset' }); }

function leaveRoom() {
    socket.emit('leaveRoom', { userName, roomCode });
    localStorage.removeItem('roomCode');
    localStorage.removeItem('isHost');
    localStorage.removeItem('team');
    isHost = false; roomCode = ''; team = '';
    switchScreen('choice-screen');
}

function logout() {
    localStorage.clear();
    location.reload();
}

function switchScreen(toId) {
    document.querySelectorAll('.custom-card').forEach(c => c.classList.add('hidden'));
    document.getElementById(toId).classList.remove('hidden');
}

function showError(errorId, message) {
    const errorElement = document.getElementById(errorId);
    errorElement.textContent = message;
    errorElement.classList.remove('hidden');
    setTimeout(() => errorElement.classList.add('hidden'), 3000);
}

socket.on('roomCreated', (data) => {
    roomCode = data.roomCode;
    isHost = true;
    localStorage.setItem('roomCode', roomCode);
    localStorage.setItem('isHost', 'true');
    switchScreen('host-screen');
    document.getElementById('room-code').textContent = roomCode;
    updateMembers(data.members);
});

socket.on('joinedRoom', (data) => {
    roomCode = data.roomCode;
    localStorage.setItem('roomCode', roomCode);
    localStorage.setItem('isHost', 'false');
    localStorage.setItem('team', team);
    
    switchScreen('player-screen');
    document.getElementById('player-room-code').textContent = roomCode;
    document.getElementById('player-name-display').textContent = userName;
    
    const teamBadge = document.getElementById('player-team-display');
    if(team === 'team1') {
        teamBadge.textContent = 'الفريق الأول 🔵';
        teamBadge.className = 'badge bg-primary rounded-pill fs-6 px-3 py-2';
    } else {
        teamBadge.textContent = 'الفريق الثاني 🔴';
        teamBadge.className = 'badge bg-danger rounded-pill fs-6 px-3 py-2';
    }
});

socket.on('updateMembers', (members) => { updateMembers(members); });

// ---- التعديل الشامل لنظام المؤقت والأصوات للجميع ----
let buzzerInterval;
socket.on('buzzerPressed', (data) => {
    const buzzer = document.getElementById('buzzer');
    
    // 1. تشغيل صوت الضغط للكل (الهوست واللاعبين)
    const pressSound = document.getElementById('buzzer-sound');
    pressSound.currentTime = 0;
    pressSound.play().catch(e => console.log("المتصفح يحتاج تفاعل لتشغيل الصوت"));

    // 2. تحديث الشاشات
    if (!isHost) {
        buzzer.disabled = true;
        if (data.userName === userName) {
            buzzer.classList.add('pressed');
            buzzer.textContent = "أنت ضغطت!";
        } else {
            buzzer.textContent = "مقفول 🔒";
        }
        document.getElementById('status').innerHTML = `<strong class='text-danger'>${data.userName}</strong> ضغط الزر أولاً!`;
        
        // إظهار المؤقت للاعبين
        document.getElementById('buzzer-timer-view').classList.remove('hidden');
        document.getElementById('red-alert').classList.add('hidden');
        document.getElementById('buzzer-timer-value').textContent = '4';
    } else {
        document.getElementById('last-pressed').textContent = data.userName;
        
        // إظهار المؤقت للهوست
        document.getElementById('host-buzzer-timer-view').classList.remove('hidden');
        document.getElementById('host-red-alert').classList.add('hidden');
        document.getElementById('host-buzzer-timer-value').textContent = '4';
    }

    // 3. تشغيل العداد (3 ثواني) للجميع
    let timeLeft = 4;
    clearInterval(buzzerInterval);
    buzzerInterval = setInterval(() => {
        timeLeft--;
        
        if (!isHost) {
            document.getElementById('buzzer-timer-value').textContent = timeLeft;
        } else {
            document.getElementById('host-buzzer-timer-value').textContent = timeLeft;
        }

        if (timeLeft <= 0) {
            clearInterval(buzzerInterval);
            
            // تشغيل صوت انتهاء الوقت للجميع
            const timeupSound = document.getElementById('timeup-sound');
            timeupSound.currentTime = 0;
            timeupSound.play().catch(e => console.log("المتصفح يحتاج تفاعل"));

            // إظهار التنبيه الأحمر
            if (!isHost) {
                document.getElementById('buzzer-timer-view').classList.add('hidden');
                document.getElementById('red-alert').classList.remove('hidden');
            } else {
                document.getElementById('host-buzzer-timer-view').classList.add('hidden');
                document.getElementById('host-red-alert').classList.remove('hidden');
            }
        }
    }, 1000);
});

socket.on('buzzerReset', () => {
    clearInterval(buzzerInterval);

    if (!isHost) {
        const buzzer = document.getElementById('buzzer');
        buzzer.classList.remove('pressed');
        buzzer.disabled = false;
        buzzer.textContent = "اضغط!";
        document.getElementById('status').textContent = 'مستعد؟ اصبعك على الزر!';
        document.getElementById('buzzer-timer-view').classList.add('hidden');
        document.getElementById('red-alert').classList.add('hidden');
    } else {
        document.getElementById('last-pressed').textContent = 'لا أحد';
        document.getElementById('host-buzzer-timer-view').classList.add('hidden');
        document.getElementById('host-red-alert').classList.add('hidden');
    }
});

socket.on('hostTimerUpdate', (timeLeft) => {
    document.getElementById('host-timer-view').classList.remove('hidden');
    document.getElementById('host-timer-value').textContent = timeLeft;
    if(isHost) document.getElementById('host-timer-display').textContent = timeLeft;
});

socket.on('error', (data) => {
    alert(data.message);
    if(data.message.includes('غير موجودة')) {
        localStorage.removeItem('roomCode');
        location.reload();
    }
});

function updateMembers(members) {
    if (!isHost) return;
    const membersList = document.getElementById('members-list');
    membersList.innerHTML = ''; 

    let team1HTML = '<h6 class="text-primary fw-bold mt-2">الفريق الأول 🔵</h6><ul class="list-unstyled mb-3">';
    let team2HTML = '<h6 class="text-danger fw-bold">الفريق الثاني 🔴</h6><ul class="list-unstyled mb-0">';

    members.forEach((m, index) => {
        if(index === 0) {
            membersList.innerHTML += `<div class="mb-3"><span class="badge bg-success me-2">الهوست</span><strong class="text-success">${m.name}</strong></div><hr>`;
        } else {
            if(m.team === 'team1') team1HTML += `<li>👤 ${m.name}</li>`;
            if(m.team === 'team2') team2HTML += `<li>👤 ${m.name}</li>`;
        }
    });

    membersList.innerHTML += team1HTML + '</ul>' + team2HTML + '</ul>';
}

function copyCode() {
    const text = document.getElementById('room-code').textContent;
    navigator.clipboard.writeText(text).then(() => alert('تم النسخ بنجاح!'));
}

function toggleCodeVisibility() {
    const code = document.getElementById('room-code');
    const btn = document.getElementById('toggle-code-btn');
    code.classList.toggle('hidden-code');
    btn.innerHTML = code.classList.contains('hidden-code') ? '👁️ إظهار' : '👁️ إخفاء';
}