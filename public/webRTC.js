// Simple WebRTC manager encapsulating all browser-side RTC behaviors
(function () {
    class WebRTCManager {
        constructor() {
            this.socket = null;
            this.username = null;
            this.localVideo = null;
            this.videoArea = null;
            this.remoteVideos = null;
            this.addSystemMessage = () => {};
            this.localStream = null;
            this.peerConnections = new Map(); // username -> RTCPeerConnection
            this.remoteVideoEls = new Map(); // username -> HTMLVideoElement
            this.remoteVideoContainers = new Map(); // username -> container div
            this.participantsOrdered = [];
            this.initializedSocketHandlers = false;
            this.cameraEnabled = true;
            this.micEnabled = true;
        }

        init(socket, username, refs) {
            this.socket = socket;
            this.username = username;
            this.localVideo = refs.localVideo;
            this.videoArea = refs.videoArea;
            this.remoteVideos = refs.remoteVideos;
            this.addSystemMessage = refs.addSystemMessage || this.addSystemMessage;
            if (!this.initializedSocketHandlers) {
                this._registerSocketHandlers();
                this.initializedSocketHandlers = true;
            }
        }

        async onRoomJoin() {
            await this.startLocalVideo();
            if (this.socket) this.socket.emit('webrtc_join');
        }

        onRoomLeaveOrDeleted() {
            this.stopLocalVideo();
            this.cleanupAllPeers();
        }

        onSocketDisconnect() {
            this.stopLocalVideo();
            this.cleanupAllPeers();
        }

        setParticipantsOrdered(list) {
            this.participantsOrdered = Array.isArray(list) ? list : [];
            this._reorderRemoteVideos();
        }

        async startLocalVideo() {
            try {
                if (this.localStream && this.localStream.getTracks().some(t => t.readyState === 'live')) {
                    if (this.localVideo) this.localVideo.srcObject = this.localStream;
                    if (this.videoArea) this.videoArea.style.display = 'block';
                    this._updateControlButtons();
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                this.localStream = stream;
                this.cameraEnabled = true;
                this.micEnabled = true;
                if (this.localVideo) this.localVideo.srcObject = stream;
                if (this.videoArea) this.videoArea.style.display = 'block';
                this._updateControlButtons();
            } catch (err) {
                console.error('getUserMedia error:', err);
                this.addSystemMessage('카메라/마이크 권한이 거부되었거나 사용할 수 없습니다.');
                if (this.videoArea) this.videoArea.style.display = 'none';
            }
        }

        stopLocalVideo() {
            try {
                if (this.localStream) this.localStream.getTracks().forEach(t => t.stop());
            } catch (_) {}
            if (this.localVideo) this.localVideo.srcObject = null;
            if (this.videoArea) this.videoArea.style.display = 'none';
            this.localStream = null;
            this.cameraEnabled = false;
            this.micEnabled = false;
            this._updateControlButtons();
        }

        toggleCamera() {
            if (!this.localStream) return;
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                this.cameraEnabled = !this.cameraEnabled;
                videoTrack.enabled = this.cameraEnabled;
                this._updateControlButtons();
                // 모든 피어 연결에 변경사항 전송
                this._updateTracksForAllPeers();
            }
        }

        toggleMic() {
            if (!this.localStream) return;
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                this.micEnabled = !this.micEnabled;
                audioTrack.enabled = this.micEnabled;
                this._updateControlButtons();
                // 모든 피어 연결에 변경사항 전송
                this._updateTracksForAllPeers();
            }
        }

        _updateControlButtons() {
            const cameraBtn = document.getElementById('toggleCameraBtn');
            const micBtn = document.getElementById('toggleMicBtn');
            const cameraIcon = document.getElementById('cameraIcon');
            const micIcon = document.getElementById('micIcon');
            
            if (cameraBtn) {
                if (this.cameraEnabled) {
                    cameraBtn.textContent = '📹 카메라 끄기';
                    cameraBtn.classList.remove('active');
                } else {
                    cameraBtn.textContent = '📹 카메라 켜기';
                    cameraBtn.classList.add('active');
                }
            }
            
            if (micBtn) {
                if (this.micEnabled) {
                    micBtn.textContent = '🎤 마이크 끄기';
                    micBtn.classList.remove('active');
                } else {
                    micBtn.textContent = '🎤 마이크 켜기';
                    micBtn.classList.add('active');
                }
            }
        }

        _updateTracksForAllPeers() {
            // 모든 피어 연결에 현재 트랙 상태 업데이트
            this.peerConnections.forEach((pc, peerName) => {
                const senders = pc.getSenders();
                senders.forEach(sender => {
                    if (sender.track) {
                        if (sender.track.kind === 'video' && this.localStream) {
                            const newTrack = this.localStream.getVideoTracks()[0];
                            if (newTrack) sender.replaceTrack(newTrack);
                        } else if (sender.track.kind === 'audio' && this.localStream) {
                            const newTrack = this.localStream.getAudioTracks()[0];
                            if (newTrack) sender.replaceTrack(newTrack);
                        }
                    }
                });
            });
        }

        cleanupAllPeers() {
            this.peerConnections.forEach((pc) => {
                try { pc.getSenders().forEach(s => { try { pc.removeTrack(s); } catch(_){} }); } catch(_){ }
                try { pc.close(); } catch(_){ }
            });
            this.peerConnections.clear();
            if (this.remoteVideos) this.remoteVideos.innerHTML = '';
            this.remoteVideoEls.clear();
            this.remoteVideoContainers.clear();
            this.participantsOrdered = [];
        }

        async _ensurePeerConnection(peerName) {
            let pc = this.peerConnections.get(peerName);
            if (pc) return pc;
            pc = new RTCPeerConnection({ iceServers: [ { urls: 'stun:stun.l.google.com:19302' } ] });
            if (this.localStream) {
                this.localStream.getTracks().forEach(track => pc.addTrack(track, this.localStream));
            }
            pc.onicecandidate = (e) => {
                if (e.candidate && this.socket) this.socket.emit('webrtc_ice_candidate', { to: peerName, candidate: e.candidate });
            };
            pc.ontrack = (e) => {
                const [stream] = e.streams;
                if (!stream) return;
                let container = this.remoteVideoContainers.get(peerName);
                let video = this.remoteVideoEls.get(peerName);
                
                if (!container || !video) {
                    // 컨테이너 생성
                    container = document.createElement('div');
                    container.className = 'remote-video-container';
                    container.style.position = 'relative';
                    container.style.width = '320px';
                    container.style.height = '180px';
                    
                    // 비디오 요소 생성
                    video = document.createElement('video');
                    video.autoplay = true;
                    video.playsInline = true;
                    video.style.width = '100%';
                    video.style.height = '100%';
                    video.style.background = '#000';
                    video.style.borderRadius = '8px';
                    video.style.objectFit = 'cover';
                    
                    // 사용자 이름 레이블
                    const label = document.createElement('div');
                    label.className = 'remote-video-label';
                    label.textContent = peerName;
                    
                    // 볼륨 조절 컨트롤
                    const controls = document.createElement('div');
                    controls.className = 'remote-video-controls';
                    const volumeLabel = document.createElement('label');
                    volumeLabel.textContent = '🔊';
                    volumeLabel.style.cursor = 'pointer';
                    const volumeSlider = document.createElement('input');
                    volumeSlider.type = 'range';
                    volumeSlider.min = '0';
                    volumeSlider.max = '100';
                    volumeSlider.value = '100';
                    volumeSlider.style.width = '100px';
                    volumeSlider.addEventListener('input', (e) => {
                        if (video) {
                            video.volume = e.target.value / 100;
                        }
                    });
                    controls.appendChild(volumeLabel);
                    controls.appendChild(volumeSlider);
                    
                    container.appendChild(video);
                    container.appendChild(label);
                    container.appendChild(controls);
                    
                    this.remoteVideoEls.set(peerName, video);
                    this.remoteVideoContainers.set(peerName, container);
                    if (this.remoteVideos) this.remoteVideos.appendChild(container);
                    this._reorderRemoteVideos();
                }
                video.srcObject = stream;
                // 초기 볼륨 설정
                video.volume = 1.0;
            };
            pc.onconnectionstatechange = () => {
                if (pc.connectionState === 'failed' || pc.connectionState === 'closed' || pc.connectionState === 'disconnected') {
                    this._removePeer(peerName);
                }
            };
            this.peerConnections.set(peerName, pc);
            return pc;
        }

        async _createAndSendOffer(peerName) {
            const pc = this.peerConnections.get(peerName);
            if (!pc || !this.socket) return;
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            this.socket.emit('webrtc_offer', { to: peerName, sdp: pc.localDescription });
        }

        _removePeer(peerName) {
            const pc = this.peerConnections.get(peerName);
            if (pc) { try { pc.close(); } catch(_){} }
            this.peerConnections.delete(peerName);
            const container = this.remoteVideoContainers.get(peerName);
            if (container) { 
                try { 
                    const video = this.remoteVideoEls.get(peerName);
                    if (video) video.srcObject = null;
                } catch(_){} 
                container.remove(); 
            }
            this.remoteVideoEls.delete(peerName);
            this.remoteVideoContainers.delete(peerName);
        }

        _reorderRemoteVideos() {
            if (!this.remoteVideos || !this.participantsOrdered.length) return;
            const fragment = document.createDocumentFragment();
            this.participantsOrdered.filter(u => u !== this.username).forEach(u => {
                const container = this.remoteVideoContainers.get(u);
                if (container) fragment.appendChild(container);
            });
            this.remoteVideos.appendChild(fragment);
        }

        _registerSocketHandlers() {
            if (!this.socket) return;
            // 순서 업데이트
            this.socket.on('room_users', (payload) => {
                if (!payload || !Array.isArray(payload.users)) return;
                this.setParticipantsOrdered(payload.users);
            });
            // 새 피어 참여 알림 → 오퍼 생성
            this.socket.on('webrtc_peer_joined', async ({ username: peer }) => {
                if (!peer || peer === this.username) return;
                await this._ensurePeerConnection(peer);
                await this._createAndSendOffer(peer);
            });
            // 오퍼 수신 → 앤서 생성
            this.socket.on('webrtc_offer', async ({ from, sdp }) => {
                if (!from || from === this.username) return;
                const pc = await this._ensurePeerConnection(from);
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                this.socket.emit('webrtc_answer', { to: from, sdp: pc.localDescription });
            });
            // 앤서 수신 → 원격 SDP 설정
            this.socket.on('webrtc_answer', async ({ from, sdp }) => {
                const pc = this.peerConnections.get(from);
                if (!pc) return;
                await pc.setRemoteDescription(new RTCSessionDescription(sdp));
            });
            // ICE 후보 수신
            this.socket.on('webrtc_ice_candidate', async ({ from, candidate }) => {
                const pc = this.peerConnections.get(from);
                if (!pc || !candidate) return;
                try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) { console.warn('addIceCandidate failed', e); }
            });
        }
    }

    window.WebRTCManager = new WebRTCManager();
})();


