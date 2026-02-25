const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// توجيه الخادم لقراءة ملفات الواجهة من مجلد public
app.use(express.static('public'));

const rooms = {}; // لتخزين بيانات الغرف

io.on('connection', (socket) => {
    // حساب البنق
    socket.on('ping', (time) => {
        socket.emit('pong', time);
    });

    // إنشاء غرفة
    socket.on('createRoom', (data) => {
        const roomCode = data.existingCode || Math.floor(100000 + Math.random() * 900000).toString();
        socket.join(roomCode);
        
        if (!rooms[roomCode]) {
            rooms[roomCode] = { 
                host: socket.id, 
                hostName: data.userName, 
                members: [{ id: socket.id, name: data.userName, team: 'host' }],
                buzzerPressed: false
            };
        } else {
            rooms[roomCode].host = socket.id;
            rooms[roomCode].members[0] = { id: socket.id, name: data.userName, team: 'host' };
        }
        
        socket.emit('roomCreated', { roomCode, members: rooms[roomCode].members });
    });

    // الانضمام لغرفة
    socket.on('joinRoom', (data) => {
        const { userName, roomCode, team } = data;
        if (rooms[roomCode]) {
            socket.join(roomCode);
            rooms[roomCode].members = rooms[roomCode].members.filter(m => m.name !== userName);
            rooms[roomCode].members.push({ id: socket.id, name: userName, team: team });
            
            socket.emit('joinedRoom', { roomCode });
            io.to(roomCode).emit('updateMembers', rooms[roomCode].members);
        } else {
            socket.emit('error', { message: 'الغرفة غير موجودة، تأكد من الكود.' });
        }
    });

    // ضغط زر البزر
    socket.on('pressBuzzer', (data) => {
        const { userName, roomCode } = data;
        if (rooms[roomCode] && !rooms[roomCode].buzzerPressed) {
            rooms[roomCode].buzzerPressed = true;
            io.to(roomCode).emit('buzzerPressed', { userName });
        }
    });

    // إعادة تعيين البزر
    socket.on('resetBuzzer', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].buzzerPressed = false;
            io.to(roomCode).emit('buzzerReset');
        }
    });

    // التحكم في مؤقت الهوست (10 ثواني)
    let hostTimers = {};
    socket.on('hostTimerAction', (data) => {
        const { roomCode, action } = data;
        if (action === 'start') {
            if (hostTimers[roomCode]) clearInterval(hostTimers[roomCode]);
            let timeLeft = 10;
            io.to(roomCode).emit('hostTimerUpdate', timeLeft);
            hostTimers[roomCode] = setInterval(() => {
                timeLeft--;
                io.to(roomCode).emit('hostTimerUpdate', timeLeft);
                if (timeLeft <= 0) clearInterval(hostTimers[roomCode]);
            }, 1000);
        } else if (action === 'stop') {
            if (hostTimers[roomCode]) clearInterval(hostTimers[roomCode]);
        } else if (action === 'reset') {
            if (hostTimers[roomCode]) clearInterval(hostTimers[roomCode]);
            io.to(roomCode).emit('hostTimerUpdate', 10);
        }
    });

    // مغادرة الغرفة
    socket.on('leaveRoom', (data) => {
        const { userName, roomCode } = data;
        if (rooms[roomCode]) {
            socket.leave(roomCode);
            rooms[roomCode].members = rooms[roomCode].members.filter(m => m.id !== socket.id);
            io.to(roomCode).emit('updateMembers', rooms[roomCode].members);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل بنجاح على المنفذ ${PORT}`);
});