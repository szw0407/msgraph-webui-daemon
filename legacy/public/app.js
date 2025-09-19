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

    // Service Worker registration for PWA with update handling
    this.setupServiceWorker();
  }

  setupServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered successfully");

          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (
                  newWorker.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New service worker is available
                  this.showUpdateAvailable();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error("Service Worker registration failed:", error);
        });

      // Listen for service worker messages
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data && event.data.type === "UPDATE_AVAILABLE") {
          this.showUpdateAvailable();
        }
      });
    }
  }

  showUpdateAvailable() {
    // Create update notification
    const toast = document.createElement("div");
    toast.className =
      "toast align-items-center text-white bg-info border-0 position-fixed";
    toast.style.cssText =
      "top: 20px; right: 20px; z-index: 1055; min-width: 300px;";
    toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="fas fa-sync-alt me-2"></i>
                    App update available! 
                    <button class="btn btn-sm btn-light ms-2" onclick="app.updateApp()">Update Now</button>
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        `;

    document.body.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { autohide: false });
    bsToast.show();

    toast.addEventListener("hidden.bs.toast", () => {
      document.body.removeChild(toast);
    });
  }

  updateApp() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration && registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          window.location.reload();
        } else {
          window.location.reload(true);
        }
      });
    } else {
      window.location.reload(true);
    }
  }

  async clearCache() {
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration && registration.active) {
          // Send message to service worker to clear cache
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            if (event.data.success) {
              this.showSuccess("Cache cleared successfully!");
            }
          };
          registration.active.postMessage({ type: "CLEAR_CACHE" }, [
            channel.port2,
          ]);
        }
      }

      // Clear localStorage cache as well
      Object.keys(localStorage).forEach((key) => {
        if (
          key.startsWith("events_") ||
          key === "users_cache" ||
          key === "currentUserId"
        ) {
          localStorage.removeItem(key);
        }
      });

      this.showSuccess("All caches cleared! Refresh the page to see changes.");
    } catch (error) {
      console.error("Failed to clear cache:", error);
      this.showError("Failed to clear cache");
    }
  }

  forceRefresh() {
    // Clear all caches and force reload
    if ("caches" in window) {
      caches
        .keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          // Force reload from server
          window.location.reload(true);
        });
    } else {
      // Fallback for browsers without cache API
      window.location.href = window.location.href + "?t=" + Date.now();
    }
  }

  setupEventListeners() {
    // Login buttons
    document
      .getElementById("loginBtn")
      .addEventListener("click", () => this.login());
    document
      .getElementById("loginBtnMain")
      .addEventListener("click", () => this.login());
    document
      .getElementById("addAccountBtnModal")
      .addEventListener("click", () => this.login());

    // Refresh buttons
    document
      .getElementById("refreshBtn")
      .addEventListener("click", () => this.refreshEvents());
    document
      .getElementById("refreshBtn2")
      .addEventListener("click", () => this.refreshEvents());

    // Settings and logout
    document
      .getElementById("settingsBtn")
      .addEventListener("click", () => this.showSettings());
    document
      .getElementById("logoutBtn")
      .addEventListener("click", () => this.logout());

    // Developer tools (will be attached when settings modal is shown)
    document.addEventListener("click", (event) => {
      if (event.target.id === "clearCacheBtn") {
        this.clearCache();
      } else if (event.target.id === "forceRefreshBtn") {
        this.forceRefresh();
      }
    });

    // Online/offline detection
    window.addEventListener("online", () => {
      this.setConnectionStatus(true);
      // When coming back online, refresh data and restart auto-refresh
      if (this.currentUserId) {
        this.loadUsers();
        this.loadEvents();
      }
      this.startRefreshCountdown();
    });
    window.addEventListener("offline", () => this.setConnectionStatus(false));

    // Keyboard shortcuts for user switching
    document.addEventListener("keydown", (event) =>
      this.handleKeyboardShortcuts(event)
    );
  }

  handleKeyboardShortcuts(event) {
    // Alt/Option + number key to switch users
    if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey) {
      const num = parseInt(event.key);
      if (num >= 1 && num <= this.users.length) {
        event.preventDefault();
        const targetUser = this.users[num - 1];
        if (targetUser && targetUser.id !== this.currentUserId) {
          this.switchUser(targetUser.id);
        }
      }
    }

    // Alt/Option + A to add new account
    if (
      event.altKey &&
      event.key.toLowerCase() === "a" &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      this.login();
    }

    // Alt/Option + S to show settings
    if (
      event.altKey &&
      event.key.toLowerCase() === "s" &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.metaKey
    ) {
      event.preventDefault();
      this.showSettings();
    }
  }

  setConnectionStatus(online) {
    this.isOnline = online;
    const statusElement = document.getElementById("connectionStatus");
    const statusText = document.getElementById("statusText");
    const refreshBtn = document.getElementById("refreshBtn");
    const refreshBtn2 = document.getElementById("refreshBtn2");

    if (online) {
      statusElement.className = "badge bg-success me-3";
      statusText.innerHTML = '<i class="fas fa-wifi me-1"></i>Online';

      // Re-enable refresh buttons
      refreshBtn.disabled = false;
      refreshBtn2.disabled = false;
      refreshBtn.title = "Refresh data from server";
      refreshBtn2.title = "Refresh data from server";
    } else {
      statusElement.className = "badge bg-danger me-3";
      statusText.innerHTML = '<i class="fas fa-wifi-slash me-1"></i>Offline';

      // Update refresh buttons for offline mode
      refreshBtn.title = "Cannot refresh while offline - showing cached data";
      refreshBtn2.title = "Cannot refresh while offline - showing cached data";

      // When going offline, try to load cached data if no current content
      if (this.users.length === 0) {
        this.loadCachedUsers();
      }
    }
  }

  checkConnectionStatus() {
    this.setConnectionStatus(this.isOnline);
  }

  loadFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get("userId");
    const loginSuccess = urlParams.get("loginSuccess");
    const error = urlParams.get("error");

    if (error === "auth_failed") {
      this.showError("Authentication failed. Please try again.");
    } else if (loginSuccess && userId) {
      this.currentUserId = userId;
      localStorage.setItem("currentUserId", userId);
      this.showSuccess("Login successful!");
      // Clean URL
      window.history.replaceState({}, document.title, "/");
    } else {
      // Try to load from localStorage
      this.currentUserId = localStorage.getItem("currentUserId");
    }
  }

  async loadUsers() {
    try {
      // If offline, try to load from cache first
      this.loadCachedUsers();
      // test connectivity by calling api
      try {
        const response = await fetch("/api/users");
        const data = await response.json();
        this.users = data.users || [];

        // Cache users data when online
        this.cacheUsers();

        if (this.users.length === 0) {
          this.showLoginSection();
        } else if (
          this.currentUserId &&
          this.users.find((u) => u.id === this.currentUserId)
        ) {
          this.showMainContent();
          this.loadEvents();
        } else if (this.users.length === 1) {
          // Auto-select the only user
          this.currentUserId = this.users[0].id;
          localStorage.setItem("currentUserId", this.currentUserId);
          this.showMainContent();
          this.loadEvents();
        } else {
          // Multiple users but no current selection - select first user
          this.currentUserId = this.users[0].id;
          localStorage.setItem("currentUserId", this.currentUserId);
          this.showMainContent();
          this.loadEvents();
        }
      } catch (error) {
        // seems not online
        this.setConnectionStatus(false);
        return;
      }
    } catch (error) {
      console.error("Failed to load users:", error);

      // Check network connectivity and update status accordingly
      const isConnected = await this.checkNetworkConnectivity();
      if (!isConnected) {
        this.setConnectionStatus(false);
      }

      // Try to load from cache when network fails
      if (this.loadCachedUsers()) {
        this.showError("Network error. Showing cached data.");
      } else {
        this.showLoginSection();
      }
    }
  }

  showLoginSection() {
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("mainContent").style.display = "none";
    document.getElementById("loginBtn").style.display = "inline-block";
    document.getElementById("userDropdown").style.display = "none";
  }

  showMainContent() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("mainContent").style.display = "block";
    document.getElementById("loginBtn").style.display = "none";
    document.getElementById("userDropdown").style.display = "inline-block";

    const currentUser = this.users.find((u) => u.id === this.currentUserId);
    if (currentUser) {
      document.getElementById("currentUserName").textContent = currentUser.name;
      document.getElementById(
        "currentUserInfo"
      ).textContent = `${currentUser.name} (${currentUser.email})`;
    }

    // Update connected accounts count
    document.getElementById("connectedCount").textContent = this.users.length;
  }

  switchUser(userId) {
    if (userId === this.currentUserId) {
      return; // Already selected
    }

    // Show loading state
    this.showLoadingState();

    this.currentUserId = userId;
    localStorage.setItem("currentUserId", userId);
    this.showMainContent();
    this.loadEvents();

    this.showSuccess(
      `Switched to ${this.users.find((u) => u.id === userId)?.name || "user"}`
    );
  }

  showLoadingState() {
    const container = document.getElementById("eventsContainer");
    container.innerHTML = `
            <div class="text-center">
                <div class="loading-spinner mx-auto"></div>
                <p class="mt-3">Loading calendar events...</p>
            </div>
        `;
  }

  getUserInitials(name) {
    if (!name) {
      return "?";
    }
    const names = name.trim().split(" ");
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  }

  login() {
    window.location.href = "/api/login";
  }

  async logout() {
    if (this.currentUserId) {
      try {
        await fetch(
          `/api/logout?userId=${encodeURIComponent(this.currentUserId)}`
        );

        // Remove the user from the local list
        this.users = this.users.filter(
          (user) => user.id !== this.currentUserId
        );

        // Clear current user
        localStorage.removeItem("currentUserId");
        this.currentUserId = null;
        this.events = [];
        this.clearRefreshInterval();

        // Show appropriate section based on remaining users
        if (this.users.length === 0) {
          this.showLoginSection();
        } else {
          // Auto-select the first remaining user
          this.currentUserId = this.users[0].id;
          localStorage.setItem("currentUserId", this.currentUserId);
          this.showMainContent();
          this.loadEvents();
        }
      } catch (error) {
        console.error("Logout error:", error);
      }
    }
  }

  async checkNetworkConnectivity() {
    try {
      // Try to fetch the users endpoint to test connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch("/api/users", {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async loadEvents() {
    if (!this.currentUserId) {
      return;
    }

    try {
      if (!this.isOnline) {
        // If offline, load from cache
        this.loadCachedEvents();
        return;
      }

      const response = await fetch(
        `/api/events?userId=${encodeURIComponent(this.currentUserId)}`
      );
      const data = await response.json();

      if (response.ok) {
        this.setConnectionStatus(true);
        this.events = data.events || [];
        this.renderEvents();
        this.updateLastUpdate();
        this.cacheEvents();
      } else {
        throw new Error(data.error || "Failed to load events");
      }
    } catch (error) {
      console.error("Failed to load events:", error);

      // Check network connectivity and update status accordingly
      const isConnected = await this.checkNetworkConnectivity();
      if (!isConnected) {
        this.setConnectionStatus(false);
      }

      // Try to load from cache
      if (this.loadCachedEvents()) {
        this.showError("Failed to load events. Showing cached data.");
      } else {
        this.showError("Failed to load events and no cached data available.");
      }

      // update the online status
      this.setConnectionStatus(false);
    }
  }

  async refreshEvents() {
    if (!this.isOnline) {
      this.showError("Cannot refresh while offline. Showing cached data.");
      this.loadCachedEvents();
      return;
    }

    const refreshBtn = document.getElementById("refreshBtn");
    const refreshBtn2 = document.getElementById("refreshBtn2");

    // Disable buttons and show loading
    refreshBtn.disabled = true;
    refreshBtn2.disabled = true;
    refreshBtn.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';
    refreshBtn2.innerHTML =
      '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';

    await this.loadEvents();

    // Re-enable buttons
    setTimeout(() => {
      refreshBtn.disabled = false;
      refreshBtn2.disabled = false;
      refreshBtn.innerHTML =
        '<i class="fas fa-sync-alt me-1"></i>Manual Refresh';
      refreshBtn2.innerHTML = '<i class="fas fa-sync-alt me-1"></i>Refresh Now';
    }, 1000);
  }

  renderEvents() {
    const container = document.getElementById("eventsContainer");
    const eventCount = document.getElementById("eventCount");

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

    container.innerHTML = this.events
      .map((event) => {
        const startTime = new Date(event.start.dateTime);
        const endTime = new Date(event.end.dateTime);
        const timeFormat = { hour: "2-digit", minute: "2-digit" };

        return `
                <div class="card event-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <h6 class="card-title mb-1">${this.escapeHtml(
                                  event.subject
                                )}</h6>
                                <p class="event-time mb-2">
                                    <i class="fas fa-clock me-1"></i>
                                    ${startTime.toLocaleTimeString(
                                      "en-US",
                                      timeFormat
                                    )} - 
                                    ${endTime.toLocaleTimeString(
                                      "en-US",
                                      timeFormat
                                    )}
                                </p>
                                ${
                                  event.location
                                    ? `
                                    <p class="text-muted mb-1">
                                        <i class="fas fa-map-marker-alt me-1"></i>
                                        ${this.escapeHtml(
                                          event.location.displayName
                                        )}
                                    </p>
                                `
                                    : ""
                                }
                                ${
                                  event.organizer
                                    ? `
                                    <p class="text-muted mb-1">
                                        <i class="fas fa-user me-1"></i>
                                        ${this.escapeHtml(
                                          event.organizer.emailAddress.name
                                        )}
                                    </p>
                                `
                                    : ""
                                }
                                ${
                                  event.isOnlineMeeting
                                    ? `
                                    <p class="event-online mb-0">
                                        <i class="fas fa-video me-1"></i>
                                        Online Meeting
                                        ${
                                          event.onlineMeetingUrl
                                            ? `
                                            <a href="${event.onlineMeetingUrl}" target="_blank" class="btn btn-sm btn-outline-success ms-2">
                                                <i class="fas fa-external-link-alt me-1"></i>Join
                                            </a>
                                        `
                                            : ""
                                        }
                                    </p>
                                `
                                    : ""
                                }
                            </div>
                        </div>
                    </div>
                </div>
            `;
      })
      .join("");
  }

  updateLastUpdate() {
    const lastUpdate = document.getElementById("lastUpdate");
    lastUpdate.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  }

  cacheEvents() {
    if (this.currentUserId && this.events) {
      localStorage.setItem(
        `events_${this.currentUserId}`,
        JSON.stringify({
          events: this.events,
          timestamp: Date.now(),
        })
      );
    }
  }

  cacheUsers() {
    if (this.users && this.users.length > 0) {
      localStorage.setItem(
        "users_cache",
        JSON.stringify({
          users: this.users,
          timestamp: Date.now(),
        })
      );
    }
  }

  loadCachedUsers() {
    const cached = localStorage.getItem("users_cache");
    if (cached) {
      try {
        const data = JSON.parse(cached);
        this.users = data.users || [];

        if (this.users.length > 0) {
          // If we have a saved current user, use it, otherwise use first user
          if (
            this.currentUserId &&
            this.users.find((u) => u.id === this.currentUserId)
          ) {
            this.showMainContent();
            this.loadCachedEvents();
          } else if (this.users.length === 1) {
            this.currentUserId = this.users[0].id;
            localStorage.setItem("currentUserId", this.currentUserId);
            this.showMainContent();
            this.loadCachedEvents();
          } else {
            this.currentUserId = this.users[0].id;
            localStorage.setItem("currentUserId", this.currentUserId);
            this.showMainContent();
            this.loadCachedEvents();
          }
          return true;
        }
      } catch (error) {
        console.error("Failed to load cached users:", error);
      }
    }
    return false;
  }

  loadCachedEvents() {
    if (this.currentUserId) {
      const cached = localStorage.getItem(`events_${this.currentUserId}`);
      if (cached) {
        try {
          const data = JSON.parse(cached);
          this.events = data.events || [];
          this.renderEvents();

          const lastUpdate = document.getElementById("lastUpdate");
          lastUpdate.textContent = `Last updated: ${new Date(
            data.timestamp
          ).toLocaleTimeString()} (cached)`;
          return true;
        } catch (error) {
          console.error("Failed to load cached events:", error);
        }
      }
    }
    return false;
  }

  startRefreshCountdown() {
    this.clearRefreshInterval();

    // Don't start auto-refresh if offline
    if (!this.isOnline) {
      document.getElementById("refreshCounter").textContent =
        "Auto-refresh paused (offline)";
      return;
    }

    // Random interval between 50-70 seconds
    const randomInterval = 50000 + Math.random() * 20000;
    this.nextRefreshTime = Date.now() + randomInterval;

    // Update countdown every second
    this.refreshCountdown = setInterval(() => {
      const remaining = Math.max(0, this.nextRefreshTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);

      if (seconds > 0) {
        document.getElementById(
          "refreshCounter"
        ).textContent = `Next refresh in: ${seconds}s`;
      } else {
        document.getElementById("refreshCounter").textContent = "Refreshing...";
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
    const modal = new bootstrap.Modal(document.getElementById("settingsModal"));

    // Populate quick switch badges
    this.renderQuickSwitchBadges();

    // Populate connected accounts
    const accountsContainer = document.getElementById("connectedAccounts");
    if (this.users.length === 0) {
      accountsContainer.innerHTML = `
                <div class="text-center text-muted">
                    <i class="fas fa-user-slash fa-2x mb-2"></i>
                    <p>No accounts connected</p>
                </div>
            `;
    } else {
      accountsContainer.innerHTML = this.users
        .map((user) => {
          const initials = this.getUserInitials(user.name);
          const isCurrent = user.id === this.currentUserId;
          return `
                    <div class="account-card ${isCurrent ? "current" : ""}">
                        <div class="d-flex align-items-center">
                            <div class="user-initials me-3">${initials}</div>
                            <div class="flex-grow-1">
                                <div class="d-flex align-items-center">
                                    <strong class="me-2">${this.escapeHtml(
                                      user.name
                                    )}</strong>
                                    ${
                                      isCurrent
                                        ? '<span class="badge bg-primary">Current</span>'
                                        : ""
                                    }
                                </div>
                                <small class="text-muted">${this.escapeHtml(
                                  user.email
                                )}</small>
                            </div>
                            <div class="d-flex gap-2">
                                ${
                                  isCurrent
                                    ? ""
                                    : `
                                    <button class="btn btn-sm btn-outline-primary" onclick="app.switchUserFromModal('${user.id}')">
                                        <i class="fas fa-exchange-alt"></i>
                                    </button>
                                `
                                }
                                <button class="btn btn-sm btn-outline-danger" onclick="app.removeAccount('${
                                  user.id
                                }')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
        })
        .join("");
    }

    modal.show();
  }

  renderQuickSwitchBadges() {
    const container = document.getElementById("quickSwitchBadges");
    container.innerHTML = "";

    this.users.forEach((user, index) => {
      const badge = document.createElement("div");
      badge.className = `quick-switch-badge bg-light text-dark ${
        user.id === this.currentUserId ? "current" : ""
      }`;
      badge.title = `Alt+${index + 1} to switch to this account`;

      const initials = this.getUserInitials(user.name);
      badge.innerHTML = `
                <span class="user-avatar-small">${initials}</span>
                <span>${user.name}</span>
                <small class="ms-1 opacity-75">(${index + 1})</small>
            `;

      badge.addEventListener("click", () => {
        if (user.id !== this.currentUserId) {
          this.switchUserFromModal(user.id);
        }
      });

      container.appendChild(badge);
    });

    // Add "Add Account" badge
    const addBadge = document.createElement("div");
    addBadge.className = "quick-switch-badge bg-primary text-white";
    addBadge.title = "Alt+A to add account";
    addBadge.innerHTML = '<i class="fas fa-plus me-2"></i>Add Account';
    addBadge.addEventListener("click", () => this.login());
    container.appendChild(addBadge);
  }

  switchUserFromModal(userId) {
    this.switchUser(userId);
    // Close modal
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("settingsModal")
    );
    modal.hide();
  }

  async removeAccount(userId) {
    try {
      await fetch(`/api/logout?userId=${encodeURIComponent(userId)}`);

      const userToRemove = this.users.find((u) => u.id === userId);
      const wasCurrentUser = userId === this.currentUserId;

      // Remove from users list
      this.users = this.users.filter((user) => user.id !== userId);

      if (wasCurrentUser) {
        localStorage.removeItem("currentUserId");
        this.currentUserId = null;
        this.clearRefreshInterval();

        if (this.users.length > 0) {
          // Switch to first remaining user
          this.currentUserId = this.users[0].id;
          localStorage.setItem("currentUserId", this.currentUserId);
          this.showMainContent();
          this.loadEvents();
        } else {
          // No users left, show login
          this.showLoginSection();
        }
      }

      // Refresh the settings modal if it's open
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("settingsModal")
      );
      if (modal) {
        this.renderQuickSwitchBadges();
        // Re-render account list
        this.showSettings();
      }

      this.showSuccess(`Removed account: ${userToRemove?.name || "User"}`);
    } catch (error) {
      console.error("Failed to remove account:", error);
      this.showError("Failed to remove account");
    }
  }

  showError(message) {
    // Create toast notification
    const toast = document.createElement("div");
    toast.className =
      "toast align-items-center text-white bg-danger border-0 position-fixed";
    toast.style.cssText = "top: 20px; right: 20px; z-index: 1050;";
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

    toast.addEventListener("hidden.bs.toast", () => {
      document.body.removeChild(toast);
    });
  }

  showSuccess(message) {
    // Create toast notification
    const toast = document.createElement("div");
    toast.className =
      "toast align-items-center text-white bg-success border-0 position-fixed";
    toast.style.cssText = "top: 20px; right: 20px; z-index: 1050;";
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

    toast.addEventListener("hidden.bs.toast", () => {
      document.body.removeChild(toast);
    });
  }

  escapeHtml(text) {
    if (!text) {
      return "";
    }
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize the app
const app = new CalendarApp();
