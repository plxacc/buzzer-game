const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const rooms = {};
const users = {}; // لتتبع اسم المستخدم لكل socket.id

io.on('connection', (socket) => {
    console.log('مستخدم متصل:', socket.id);

    socket.on('createRoom', (data) => {
        const { userName } = data;
        users[socket.id] = userName; // تخزين اسم المستخدم
        const roomCode = Math.floor(100000 + Math.random() * 900000).toString();
        rooms[roomCode] = { 
            members: [userName], 
            buzzerPressed: false, 
            lastPressed: null 
        };
        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, members: rooms[roomCode].members });
    });

    socket.on('joinRoom', (data) => {
        const { userName, roomCode } = data;
        if (!rooms[roomCode]) {
            socket.emit('error', { message: 'الغرفة غير موجودة، تأكد من إدخال الكود الصحيح.' });
        } else if (rooms[roomCode].members.includes(userName)) {
            socket.emit('error', { message: 'هذا الاسم مستخدم بالفعل في الغرفة، اختر اسمًا آخر.' });
        } else {
            users[socket.id] = userName; // تخزين اسم المستخدم
            rooms[roomCode].members.push(userName);
            socket.join(roomCode);
            io.to(roomCode).emit('updateMembers', rooms[roomCode].members);
            socket.emit('joinedRoom', { roomCode });
        }
    });

    socket.on('pressBuzzer', (data) => {
        const { userName, roomCode } = data;
        if (rooms[roomCode] && !rooms[roomCode].buzzerPressed) {
            rooms[roomCode].buzzerPressed = true;
            rooms[roomCode].lastPressed = userName;
            io.to(roomCode).emit('buzzerPressed', { userName });
        }
    });

    socket.on('resetBuzzer', (roomCode) => {
        if (rooms[roomCode]) {
            rooms[roomCode].buzzerPressed = false;
            rooms[roomCode].lastPressed = null;
            io.to(roomCode).emit('buzzerReset');
        }
    });

    socket.on('leaveRoom', (data) => {
        const { userName, roomCode } = data;
        if (rooms[roomCode]) {
            rooms[roomCode].members = rooms[roomCode].members.filter(member => member !== userName);
            socket.leave(roomCode);
            io.to(roomCode).emit('updateMembers', rooms[roomCode].members);
            if (rooms[roomCode].members.length === 0) {
                delete rooms[roomCode];
                console.log(`تم حذف الغرفة ${roomCode} لأنها أصبحت فارغة`);
            }
        }
    });

    socket.on('disconnect', () => {
        console.log('مستخدم انقطع:', socket.id);
        const userName = users[socket.id];
        if (userName) {
            for (const roomCode in rooms) {
                if (rooms[roomCode].members.includes(userName)) {
                    rooms[roomCode].members = rooms[roomCode].members.filter(member => member !== userName);
                    io.to(roomCode).emit('updateMembers', rooms[roomCode].members);
                    if (rooms[roomCode].members.length === 0) {
                        delete rooms[roomCode];
                        console.log(`تم حذف الغرفة ${roomCode} لأنها أصبحت فارغة`);
                    }
                }
            }
            delete users[socket.id]; // حذف المستخدم من القائمة
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`الخادم يعمل على المنفذ ${PORT}`);
});