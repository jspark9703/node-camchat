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
            this.participantsOrdered = [];
            this.initializedSocketHandlers = false;
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
                    return;
                }
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                this.localStream = stream;
                if (this.localVideo) this.localVideo.srcObject = stream;
                if (this.videoArea) this.videoArea.style.display = 'block';
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
        }

        cleanupAllPeers() {
            this.peerConnections.forEach((pc) => {
                try { pc.getSenders().forEach(s => { try { pc.removeTrack(s); } catch(_){} }); } catch(_){ }
                try { pc.close(); } catch(_){ }
            });
            this.peerConnections.clear();
            if (this.remoteVideos) this.remoteVideos.innerHTML = '';
            this.remoteVideoEls.clear();
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
                let video = this.remoteVideoEls.get(peerName);
                if (!video) {
                    video = document.createElement('video');
                    video.autoplay = true;
                    video.playsInline = true;
                    video.style.width = '320px';
                    video.style.height = '180px';
                    video.style.background = '#000';
                    video.style.borderRadius = '8px';
                    this.remoteVideoEls.set(peerName, video);
                    if (this.remoteVideos) this.remoteVideos.appendChild(video);
                    this._reorderRemoteVideos();
                }
                video.srcObject = stream;
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
            const video = this.remoteVideoEls.get(peerName);
            if (video) { try { video.srcObject = null; } catch(_){} video.remove(); }
            this.remoteVideoEls.delete(peerName);
        }

        _reorderRemoteVideos() {
            if (!this.remoteVideos || !this.participantsOrdered.length) return;
            const fragment = document.createDocumentFragment();
            this.participantsOrdered.filter(u => u !== this.username).forEach(u => {
                const el = this.remoteVideoEls.get(u);
                if (el) fragment.appendChild(el);
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


