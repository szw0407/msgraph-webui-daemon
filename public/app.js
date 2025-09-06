class CalendarApp {
    constructor() {
        this.currentUserId = null;
        this.users = [];
        this.events = [];
        this.refreshInterval = null;
        this.nextRefreshTime = null;
        this.refreshCountdown = null;
        this.isOnline = navigator.onLine;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkConnectionStatus();
        this.loadFromURL();
        this.loadUsers();
        this.startRefreshCountdown();
        
        // Service Worker registration for PWA
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(console.error);
        }
    }

    setupEventListeners() {
        // Login buttons
        document.getElementById('loginBtn').addEventListener('click', () => this.login());
        document.getElementById('loginBtnMain').addEventListener('click', () => this.login());
        document.getElementById('addAccountBtn').addEventListener('click', () => this.login());
        
        // Refresh buttons
        document.getElementById('refreshBtn').addEventListener('click', () => this.refreshEvents());
        document.getElementById('refreshBtn2').addEventListener('click', () => this.refreshEvents());
        
        // Settings and logout
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('logoutBtn').addEventListener('click', () => this.logout());
        
        // Online/offline detection
        window.addEventListener('online', () => this.setConnectionStatus(true));
        window.addEventListener('offline', () => this.setConnectionStatus(false));
    }

    setConnectionStatus(online) {
        this.isOnline = online;
        const statusElement = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        
        if (online) {
            statusElement.className = 'badge bg-success me-3';
            statusText.innerHTML = '<i class="fas fa-wifi me-1"></i>Online';
        } else {
            statusElement.className = 'badge bg-danger me-3';
            statusText.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';
        }
    }

    checkConnectionStatus() {
        this.setConnectionStatus(this.isOnline);
    }

    loadFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const userId = urlParams.get('userId');
        const loginSuccess = urlParams.get('loginSuccess');
        const error = urlParams.get('error');

        if (error === 'auth_failed') {
            this.showError('Authentication failed. Please try again.');
        } else if (loginSuccess && userId) {
            this.currentUserId = userId;
            localStorage.setItem('currentUserId', userId);
            this.showSuccess('Login successful!');
            // Clean URL
            window.history.replaceState({}, document.title, "/");
        } else {
            // Try to load from localStorage
            this.currentUserId = localStorage.getItem('currentUserId');
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/users');
            const data = await response.json();
            this.users = data.users || [];
            
            if (this.users.length === 0) {
                this.showLoginSection();
            } else {
                this.renderUserSelection();
                if (this.currentUserId && this.users.find(u => u.id === this.currentUserId)) {
                    this.showMainContent();
                    this.loadEvents();
                } else if (this.users.length === 1) {
                    this.currentUserId = this.users[0].id;
                    localStorage.setItem('currentUserId', this.currentUserId);
                    this.showMainContent();
                    this.loadEvents();
                } else {
                    this.showUserSelection();
                }
            }
        } catch (error) {
            console.error('Failed to load users:', error);
            this.showLoginSection();
        }
    }

    showLoginSection() {
        document.getElementById('loginSection').style.display = 'block';
        document.getElementById('userSelectionSection').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'inline-block';
        document.getElementById('userDropdown').style.display = 'none';
    }

    showUserSelection() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('userSelectionSection').style.display = 'block';
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userDropdown').style.display = 'none';
    }

    showMainContent() {
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('userSelectionSection').style.display = this.users.length > 1 ? 'block' : 'none';
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('loginBtn').style.display = 'none';
        document.getElementById('userDropdown').style.display = 'inline-block';
        
        const currentUser = this.users.find(u => u.id === this.currentUserId);
        if (currentUser) {
            document.getElementById('currentUserName').textContent = currentUser.name;
            document.getElementById('currentUserInfo').textContent = `${currentUser.name} (${currentUser.email})`;
        }
    }

    renderUserSelection() {
        const container = document.getElementById('userBadges');
        container.innerHTML = '';
        
        this.users.forEach(user => {
            const badge = document.createElement('span');
            badge.className = `badge bg-light text-dark user-badge ${user.id === this.currentUserId ? 'active' : ''}`;
            badge.innerHTML = `<i class="fas fa-user me-1"></i>${user.name}`;
            badge.addEventListener('click', () => this.switchUser(user.id));
            container.appendChild(badge);
        });
    }

    switchUser(userId) {
        this.currentUserId = userId;
        localStorage.setItem('currentUserId', userId);
        this.renderUserSelection();
        this.showMainContent();
        this.loadEvents();
    }

    login() {
        window.location.href = '/api/login';
    }

    async logout() {
        if (this.currentUserId) {
            try {
                await fetch(`/api/logout?userId=${encodeURIComponent(this.currentUserId)}`);
                localStorage.removeItem('currentUserId');
                this.currentUserId = null;
                this.events = [];
                this.clearRefreshInterval();
                this.loadUsers();
            } catch (error) {
                console.error('Logout error:', error);
            }
        }
    }

    async loadEvents() {
        if (!this.currentUserId) return;

        try {
            const response = await fetch(`/api/events?userId=${encodeURIComponent(this.currentUserId)}`);
            const data = await response.json();
            
            if (response.ok) {
                this.events = data.events || [];
                this.renderEvents();
                this.updateLastUpdate();
                this.cacheEvents();
            } else {
                throw new Error(data.error || 'Failed to load events');
            }
        } catch (error) {
            console.error('Failed to load events:', error);
            // Try to load from cache
            this.loadCachedEvents();
            this.showError('Failed to load events. Showing cached data.');
        }
    }

    async refreshEvents() {
        const refreshBtn = document.getElementById('refreshBtn');
        const refreshBtn2 = document.getElementById('refreshBtn2');
        
        // Disable buttons and show loading
        refreshBtn.disabled = true;
        refreshBtn2.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';
        refreshBtn2.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';
        
        await this.loadEvents();
        
        // Re-enable buttons
        setTimeout(() => {
            refreshBtn.disabled = false;
            refreshBtn2.disabled = false;
            refreshBtn.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Manual Refresh';
            refreshBtn2.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Refresh Now';
        }, 1000);
    }

    renderEvents() {
        const container = document.getElementById('eventsContainer');
        const eventCount = document.getElementById('eventCount');
        
        eventCount.textContent = this.events.length;
        
        if (this.events.length === 0) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-calendar-check fa-3x mb-3"></i>
                    <h5>No events today</h5>
                    <p>You have a free day! Enjoy your time.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.events.map(event => {
            const startTime = new Date(event.start.dateTime);
            const endTime = new Date(event.end.dateTime);
            const timeFormat = { hour: '2-digit', minute: '2-digit' };
            
            return `
                <div class="card event-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${this.escapeHtml(event.subject)}</h6>
                                <p class="event-time mb-2">
                                    <i class="fas fa-clock me-1"></i>
                                    ${startTime.toLocaleTimeString('en-US', timeFormat)} - 
                                    ${endTime.toLocaleTimeString('en-US', timeFormat)}
                                </p>
                                ${event.location ? `
                                    <p class="text-muted mb-1">
                                        <i class="fas fa-map-marker-alt me-1"></i>
                                        ${this.escapeHtml(event.location.displayName)}
                                    </p>
                                ` : ''}
                                ${event.organizer ? `
                                    <p class="text-muted mb-1">
                                        <i class="fas fa-user me-1"></i>
                                        ${this.escapeHtml(event.organizer.emailAddress.name)}
                                    </p>
                                ` : ''}
                                ${event.isOnlineMeeting ? `
                                    <p class="event-online mb-0">
                                        <i class="fas fa-video me-1"></i>
                                        Online Meeting
                                        ${event.onlineMeetingUrl ? `
                                            <a href="${event.onlineMeetingUrl}" target="_blank" class="btn btn-sm btn-outline-success ms-2">
                                                <i class="fas fa-external-link-alt me-1"></i>Join
                                            </a>
                                        ` : ''}
                                    </p>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateLastUpdate() {
        const lastUpdate = document.getElementById('lastUpdate');
        lastUpdate.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    cacheEvents() {
        if (this.currentUserId && this.events) {
            localStorage.setItem(`events_${this.currentUserId}`, JSON.stringify({
                events: this.events,
                timestamp: Date.now()
            }));
        }
    }

    loadCachedEvents() {
        if (this.currentUserId) {
            const cached = localStorage.getItem(`events_${this.currentUserId}`);
            if (cached) {
                try {
                    const data = JSON.parse(cached);
                    this.events = data.events || [];
                    this.renderEvents();
                    
                    const lastUpdate = document.getElementById('lastUpdate');
                    lastUpdate.textContent = `Last updated: ${new Date(data.timestamp).toLocaleTimeString()} (cached)`;
                } catch (error) {
                    console.error('Failed to load cached events:', error);
                }
            }
        }
    }

    startRefreshCountdown() {
        this.clearRefreshInterval();
        
        // Random interval between 50-70 seconds
        const randomInterval = 50000 + Math.random() * 20000;
        this.nextRefreshTime = Date.now() + randomInterval;
        
        // Update countdown every second
        this.refreshCountdown = setInterval(() => {
            const remaining = Math.max(0, this.nextRefreshTime - Date.now());
            const seconds = Math.ceil(remaining / 1000);
            
            if (seconds > 0) {
                document.getElementById('refreshCounter').textContent = `Next refresh in: ${seconds}s`;
            } else {
                document.getElementById('refreshCounter').textContent = 'Refreshing...';
                this.loadEvents();
                this.startRefreshCountdown(); // Schedule next refresh
            }
        }, 1000);
    }

    clearRefreshInterval() {
        if (this.refreshCountdown) {
            clearInterval(this.refreshCountdown);
            this.refreshCountdown = null;
        }
    }

    showSettings() {
        const modal = new bootstrap.Modal(document.getElementById('settingsModal'));
        
        // Populate connected accounts
        const accountsContainer = document.getElementById('connectedAccounts');
        accountsContainer.innerHTML = this.users.map(user => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <strong>${this.escapeHtml(user.name)}</strong><br>
                    <small class="text-muted">${this.escapeHtml(user.email)}</small>
                </div>
                <button class="btn btn-sm btn-outline-danger" onclick="app.removeAccount('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        modal.show();
    }

    async removeAccount(userId) {
        try {
            await fetch(`/api/logout?userId=${encodeURIComponent(userId)}`);
            if (userId === this.currentUserId) {
                localStorage.removeItem('currentUserId');
                this.currentUserId = null;
                this.clearRefreshInterval();
            }
            this.loadUsers();
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('settingsModal'));
            modal.hide();
        } catch (error) {
            console.error('Failed to remove account:', error);
            this.showError('Failed to remove account');
        }
    }

    showError(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-danger border-0 position-fixed';
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 1050;';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    showSuccess(message) {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = 'toast align-items-center text-white bg-success border-0 position-fixed';
        toast.style.cssText = 'top: 20px; right: 20px; z-index: 1050;';
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-check me-2"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;
        
        document.body.appendChild(toast);
        const bsToast = new bootstrap.Toast(toast);
        bsToast.show();
        
        toast.addEventListener('hidden.bs.toast', () => {
            document.body.removeChild(toast);
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize the app
const app = new CalendarApp();
