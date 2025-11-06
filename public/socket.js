let socket = null;
let currentRoom = null;
let username = null;

// DOM 요소들
const userLabel = document.getElementById('userLabel');
const connBadge = document.getElementById('connBadge');
const logoutBtn = document.getElementById('logoutBtn');
const createRoomInput = document.getElementById('createRoomInput');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomList = document.getElementById('roomList');
const currentRoomTitle = document.getElementById('currentRoomTitle');
const roomActions = document.getElementById('roomActions');
const leaveRoomBtn = document.getElementById('leaveRoomBtn');
const deleteRoomBtn = document.getElementById('deleteRoomBtn');
const messages = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const localVideo = document.getElementById('localVideo');
const videoArea = document.getElementById('videoArea');
const remoteVideos = document.getElementById('remoteVideos');

// WebRTC 로직은 webRTC.js (window.WebRTCManager)에서 관리합니다.

// 초기화
async function init() {
    // 사용자 정보 확인
    const me = await window.api.me();
    if (!me.authenticated) {
        location.href = '/login.html';
        return;
    }
    
    username = me.user;
    userLabel.textContent = username;
    
    // 소켓 연결
    connectSocket();
    
    // 이벤트 리스너 등록
    setupEventListeners();
}

function connectSocket() {
    socket = io({
        withCredentials: true,
        transports: ['websocket', 'polling']
    });
    
    socket.on('connect', () => {
        console.log('connected to server');
        connBadge.textContent = '연결됨';
        connBadge.style.background = '#10b981';
        // 서버에 사용자 정보 전달 및 방 목록 요청
        if (username) {
            socket.emit('set_user', username);
        }
        socket.emit('request_room_list');
    });
    
    socket.on('disconnect', (reason) => {
        console.log('disconnected from server:', reason);
        connBadge.textContent = '연결 안됨';
        connBadge.style.background = '#ef4444';
        if (window.WebRTCManager) window.WebRTCManager.onSocketDisconnect();
    });
    
    socket.on('connect_error', (error) => {
        console.error('socket connection error:', error);
        connBadge.textContent = '연결 실패';
        connBadge.style.background = '#ef4444';
    });
    
    socket.on('error', (error) => {
        console.error('socket error:', error);
        if (error.message) {
            alert('오류: ' + error.message);
        }
    });

    socket.on('new_message', (data) => {
        addMessage(data.username, data.message, data.timestamp);
    });

    socket.on('user_joined', (data) => {
        addSystemMessage(`${data.username}님이 방에 참여했습니다.`);
    });

    socket.on('user_left', (data) => {
        addSystemMessage(`${data.username}님이 방을 나갔습니다.`);
    });

    socket.on('room_list_update', (roomList) => {
        updateRoomList(roomList);
    });

    socket.on('room_created', (data) => {
        // 방 생성 성공 시 해당 방을 자동으로 선택
        selectRoom(data.roomName);
    });

    socket.on('room_deleted', (data) => {
        // 방이 삭제된 경우 현재 방에서 나가기
        if (currentRoom === data.roomName) {
            currentRoom = null;
            currentRoomTitle.textContent = '방을 선택하세요';
            roomActions.style.display = 'none';
            clearMessages();
            if (window.WebRTCManager) window.WebRTCManager.onRoomLeaveOrDeleted();
            
            // 모든 방 아이템에서 active 클래스 제거
            document.querySelectorAll('.room-item').forEach(item => {
                item.classList.remove('active');
            });
        }
        addSystemMessage(`방 "${data.roomName}"이 삭제되었습니다.`);
    });
    // room_users 및 webrtc_* 이벤트는 WebRTCManager에서 처리됩니다.
}

function setupEventListeners() {
    // 로그아웃
    logoutBtn.addEventListener('click', async () => {
        await window.api.logout();
        location.href = '/login.html';
    });

    // 방 생성
    createRoomBtn.addEventListener('click', createRoom);
    createRoomInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });

    // 방 나가기
    leaveRoomBtn.addEventListener('click', leaveCurrentRoom);

    // 방 삭제
    deleteRoomBtn.addEventListener('click', deleteCurrentRoom);

    // 메시지 전송
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

function createRoom() {
    const roomName = createRoomInput.value.trim();
    if (!roomName) return;
    
    // 서버에 방 생성 요청
    socket.emit('create_room', roomName);
    createRoomInput.value = '';
}

function updateRoomList(rooms) {
    // 기존 방 목록 초기화
    roomList.innerHTML = '';
    
    // 서버에서 받은 방 목록으로 업데이트
    rooms.forEach(room => {
        const roomItem = document.createElement('div');
        roomItem.className = 'room-item';
        roomItem.innerHTML = `
            <div style="font-weight: bold;">${room.name}</div>
            <div style="font-size: 12px; color: #6b7280;">
                생성자: ${room.creator} | 참여자: ${room.userCount}명
            </div>
        `;
        roomItem.addEventListener('click', () => selectRoom(room.name));
        roomList.appendChild(roomItem);
    });
}

function addRoomToList(roomName) {
    const roomItem = document.createElement('div');
    roomItem.className = 'room-item';
    roomItem.textContent = roomName;
    roomItem.addEventListener('click', () => selectRoom(roomName));
    roomList.appendChild(roomItem);
}

function selectRoom(roomName) {
    // 이전 방에서 나가기
    if (currentRoom) {
        socket.emit('leave_room', currentRoom);
        if (window.WebRTCManager) window.WebRTCManager.onRoomLeaveOrDeleted();
    }

    // 새 방에 참여
    currentRoom = roomName;
    socket.emit('join_room', roomName);

    // UI 업데이트
    updateRoomSelection(roomName);
    clearMessages();

    // WebRTC 초기화 및 참여
    if (window.WebRTCManager) {
        window.WebRTCManager.init(socket, username, {
            localVideo,
            videoArea,
            remoteVideos,
            addSystemMessage,
        });
        window.WebRTCManager.onRoomJoin();
    }
}

function updateRoomSelection(roomName) {
    // 모든 방 아이템에서 active 클래스 제거
    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });

    // 선택된 방에 active 클래스 추가
    document.querySelectorAll('.room-item').forEach(item => {
        const roomNameElement = item.querySelector('div:first-child');
        if (roomNameElement && roomNameElement.textContent === roomName) {
            item.classList.add('active');
        }
    });

    // 헤더 업데이트
    currentRoomTitle.textContent = roomName;
    roomActions.style.display = 'flex';
    
    // 방 목록에서 현재 방의 생성자 확인
    const roomItems = document.querySelectorAll('.room-item');
    let isCreator = false;
    roomItems.forEach(item => {
        const roomNameElement = item.querySelector('div:first-child');
        if (roomNameElement && roomNameElement.textContent === roomName) {
            const creatorText = item.querySelector('div:last-child').textContent;
            if (creatorText.includes(`생성자: ${username}`)) {
                isCreator = true;
            }
        }
    });
    
    // 생성자만 삭제 버튼 표시
    deleteRoomBtn.style.display = isCreator ? 'block' : 'none';
}

function leaveCurrentRoom() {
    if (currentRoom) {
        socket.emit('leave_room', currentRoom);
        currentRoom = null;
        
        // UI 초기화
        currentRoomTitle.textContent = '방을 선택하세요';
        roomActions.style.display = 'none';
        clearMessages();
        if (window.WebRTCManager) window.WebRTCManager.onRoomLeaveOrDeleted();
        
        // 모든 방 아이템에서 active 클래스 제거
        document.querySelectorAll('.room-item').forEach(item => {
            item.classList.remove('active');
        });
    }
}

function deleteCurrentRoom() {
    if (currentRoom) {
        if (confirm(`방 "${currentRoom}"을 삭제하시겠습니까?`)) {
            socket.emit('delete_room', currentRoom);
        }
    }
}

function sendMessage() {
    const message = messageInput.value.trim();
    if (!message || !currentRoom) return;

    // 메시지 길이 제한 (500자)
    if (message.length > 500) {
        alert('메시지는 500자를 초과할 수 없습니다.');
        return;
    }

    socket.emit('send_message', { message });
    messageInput.value = '';
}

function addMessage(messageUsername, message, timestamp) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const time = new Date(timestamp).toLocaleTimeString();
    const isOwnMessage = messageUsername === username;
    
    if (isOwnMessage) {
        messageDiv.style.textAlign = 'right';
        messageDiv.style.backgroundColor = '#e3f2fd';
        messageDiv.style.padding = '8px';
        messageDiv.style.borderRadius = '8px';
        messageDiv.style.margin = '4px 0';
    }
    
    messageDiv.innerHTML = `
        <div class="meta">${messageUsername} - ${time}</div>
        <div>${message}</div>
    `;
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function addSystemMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'system-message';
    messageDiv.style.textAlign = 'center';
    messageDiv.style.color = '#6b7280';
    messageDiv.style.fontSize = '12px';
    messageDiv.style.fontStyle = 'italic';
    messageDiv.style.margin = '8px 0';
    messageDiv.textContent = message;
    
    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function clearMessages() {
    messages.innerHTML = '';
}

// 페이지 로드 시 초기화
window.addEventListener('DOMContentLoaded', init);
