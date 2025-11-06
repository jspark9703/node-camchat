window.api = {
	// JWT 토큰 저장
	getToken() {
		return localStorage.getItem('jwt_token');
	},
	setToken(token) {
		if (token) {
			localStorage.setItem('jwt_token', token);
		} else {
			localStorage.removeItem('jwt_token');
		}
	},
	async request(path, method = 'GET', body) {
		const opts = { 
			method, 
			headers: { 'Content-Type': 'application/json' }, 
			credentials: 'same-origin' 
		};
		
		// JWT 토큰이 있으면 Authorization 헤더에 추가
		const token = this.getToken();
		if (token) {
			opts.headers['Authorization'] = `Bearer ${token}`;
		}
		
		if (body) opts.body = JSON.stringify(body);
		const res = await fetch(path, opts);
		let data = null;
		try { data = await res.json(); } catch (e) { /* ignore */ }
		return data || { ok: false, error: 'invalid response' };
	},
	async me() {
		const res = await this.request('/api/v1/auth/me');
		if (res && res.authenticated) {
			return { authenticated: true, user: res.user, userId: res.userId, name: res.name };
		}
		return { authenticated: false };
	},
	async login(email, password) {
		const res = await this.request('/api/v1/auth/login', 'POST', { email, password });
		if (res && res.success && res.data) {
			this.setToken(res.data.accessToken);
			return { ok: true, token: res.data.accessToken, user: res.data.user };
		}
		return { ok: false, error: res.error || 'Login failed' };
	},
	async signup(email, password, name) {
		const res = await this.request('/api/v1/auth/register', 'POST', { email, password, name });
		if (res && res.success) {
			// 회원가입 후 자동 로그인
			const loginRes = await this.login(email, password);
			return loginRes;
		}
		return { ok: false, error: res.error || 'Signup failed' };
	},
	async logout() {
		const res = await this.request('/api/v1/auth/logout', 'POST');
		this.setToken(null);
		return { ok: true };
	},
	async duplCheck(email) {
		return this.request(`/api/v1/auth/dupl_check?email=${encodeURIComponent(email)}`);
	},
};
