// --- Simple Client-side Auth Helpers ---
function getUsers() {
  try {
    const raw = localStorage.getItem("taskmate-users");
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function saveUsers(users) {
  localStorage.setItem("taskmate-users", JSON.stringify(users));
}

function normalizeUsername(username) {
  return (username || "").trim().toLowerCase();
}

function getCurrentUser() {
  try {
    return localStorage.getItem("taskmate-current-user");
  } catch (_) {
    return null;
  }
}

function setCurrentUser(username) {
  if (username) localStorage.setItem("taskmate-current-user", username);
}

function clearCurrentUser() {
  localStorage.removeItem("taskmate-current-user");
}

function getUserByUsername(username) {
  const users = getUsers();
  const norm = normalizeUsername(username);
  return users.find((u) => normalizeUsername(u.username) === norm) || null;
}

function addUser(username, password) {
  const users = getUsers();
  users.push({ username, password });
  saveUsers(users);
}

function ensureAuthUI(taskManagerInstance) {
  const authScreen = document.getElementById("auth-screen");
  const authForm = document.getElementById("auth-form");
  const usernameInput = document.getElementById("auth-username");
  const passwordInput = document.getElementById("auth-password");
  const toggleBtn = document.getElementById("auth-toggle");
  const errorEl = document.getElementById("auth-error");
  const userChip = document.getElementById("current-user");
  const signoutBtn = document.getElementById("signout-btn");

  let isSignup = false;

  function setMode(signup) {
    isSignup = signup;
    const submitBtn = authForm.querySelector("#auth-submit");
    if (submitBtn) submitBtn.textContent = signup ? "Sign Up" : "Sign In";
    if (toggleBtn) toggleBtn.textContent = signup ? "Sign In" : "Create one";
    const header = document.querySelector(".auth-left-header h2");
    const sub = document.querySelector(".auth-left-header p");
    if (header) header.textContent = signup ? "Create Account" : "Welcome Back";
    if (sub)
      sub.textContent = signup
        ? "Sign up to start organizing your tasks"
        : "Sign in to access your tasks";
    errorEl.style.display = "none";
    const switchText = document.getElementById("auth-switch-text");
    if (switchText)
      switchText.textContent = signup
        ? "Already have an account?"
        : "Don't have an account?";
  }

  if (toggleBtn) toggleBtn.addEventListener("click", () => setMode(!isSignup));

  authForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
      errorEl.textContent = "Please enter username and password.";
      errorEl.style.display = "block";
      return;
    }
    const existing = getUserByUsername(username);
    if (isSignup) {
      if (existing) {
        errorEl.textContent = "User already exists. Try signing in.";
        errorEl.style.display = "block";
        return;
      }
      addUser(username, password);
      setCurrentUser(username);
      authScreen.style.display = "none";
      if (taskManagerInstance) taskManagerInstance.onUserChanged();
    } else {
      if (!existing || existing.password !== password) {
        errorEl.textContent = "Invalid credentials. Please try again.";
        errorEl.style.display = "block";
        return;
      }
      setCurrentUser(existing.username);
      authScreen.style.display = "none";
      if (taskManagerInstance) taskManagerInstance.onUserChanged();
    }
    usernameInput.value = "";
    passwordInput.value = "";
  });

  if (signoutBtn) {
    signoutBtn.addEventListener("click", () => {
      clearCurrentUser();
      if (userChip) {
        userChip.style.display = "none";
        userChip.textContent = "";
      }
      signoutBtn.style.display = "none";
      authScreen.style.display = "flex";
    });
  }

  // Initial show/hide based on current user
  const current = getCurrentUser();
  if (!current) {
    authScreen.style.display = "flex";
    setMode(false);
  } else {
    authScreen.style.display = "none";
    if (userChip) {
      userChip.textContent = current;
      userChip.style.display = "inline-block";
    }
    if (signoutBtn) signoutBtn.style.display = "inline-flex";
  }
}

class TaskManager {
  constructor() {
    this.tasks = this.loadTasks();
    this.currentView = "today";
    this.currentFilter = "all";
    this.searchTerm = "";
    this.editingTaskId = null;

    this.initializeElements();
    this.setupEventListeners();
    this.renderTasks();
    this.updateStats();
    this.updateTaskCounts();

    // Auth UI wiring after base UI is ready
    ensureAuthUI(this);
    this.refreshUserHeader();
  }

  initializeElements() {
    // Main elements
    this.taskInput = document.getElementById("task-input");
    this.addTaskBtn = document.getElementById("add-task-btn");
    this.tasksList = document.getElementById("tasks-list");
    this.emptyState = document.getElementById("empty-state");
    this.tasksContainer = document.getElementById("tasks-container");

    // Header elements
    this.viewTitle = document.getElementById("view-title");
    this.searchBtn = document.getElementById("search-btn");
    this.filterBtn = document.getElementById("filter-btn");
    this.searchContainer = document.getElementById("search-container");
    this.searchInput = document.getElementById("search-input");
    this.clearSearchBtn = document.getElementById("clear-search");

    // Task details elements
    this.taskDetails = document.getElementById("task-details");
    this.taskDueDate = document.getElementById("task-due-date");
    this.taskPriority = document.getElementById("task-priority");
    this.taskProject = document.getElementById("task-project");
    this.cancelTaskBtn = document.getElementById("cancel-task");
    this.saveTaskBtn = document.getElementById("save-task");

    // Filter elements
    this.filterBar = document.getElementById("filter-bar");
    this.filterBtns = document.querySelectorAll(".filter-btn");
    this.priorityFilters = document.querySelectorAll(".priority-filter");

    // Navigation elements
    this.navItems = document.querySelectorAll(".nav-item");

    // Modal elements
    this.editModal = document.getElementById("edit-modal");
    this.closeModalBtn = document.getElementById("close-modal");
    this.cancelEditBtn = document.getElementById("cancel-edit");
    this.saveEditBtn = document.getElementById("save-edit");

    // Edit form elements
    this.editTaskText = document.getElementById("edit-task-text");
    this.editTaskDueDate = document.getElementById("edit-task-due-date");
    this.editTaskPriority = document.getElementById("edit-task-priority");
    this.editTaskProject = document.getElementById("edit-task-project");

    // Stats elements
    this.totalTasksEl = document.getElementById("total-tasks");
    this.completedTasksEl = document.getElementById("completed-tasks");
    this.completionRateEl = document.getElementById("completion-rate");
    this.progressFill = document.getElementById("progress-fill");

    // Count elements
    this.todayCountEl = document.getElementById("today-count");
    this.upcomingCountEl = document.getElementById("upcoming-count");
    this.allCountEl = document.getElementById("all-count");
    this.completedCountEl = document.getElementById("completed-count");

    // User header elements
    this.userChip = document.getElementById("current-user");
    this.signoutBtn = document.getElementById("signout-btn");
  }

  setupEventListeners() {
    // Task input
    this.taskInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.showTaskDetails();
      }
    });

    this.taskInput.addEventListener("focus", () => {
      this.showTaskDetails();
    });

    // Add task button
    this.addTaskBtn.addEventListener("click", () => {
      this.showTaskDetails();
    });

    // Task details
    this.cancelTaskBtn.addEventListener("click", () => {
      this.hideTaskDetails();
    });

    this.saveTaskBtn.addEventListener("click", () => {
      this.addTask();
    });

    // Search functionality
    this.searchBtn.addEventListener("click", () => {
      this.toggleSearch();
    });

    this.clearSearchBtn.addEventListener("click", () => {
      this.clearSearch();
    });

    this.searchInput.addEventListener("input", () => {
      this.searchTerm = this.searchInput.value.toLowerCase();
      this.renderTasks();
    });

    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Escape") {
        this.clearSearch();
      }
    });

    // Filter functionality
    this.filterBtn.addEventListener("click", () => {
      this.toggleFilter();
    });

    this.filterBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.setFilter(btn.dataset.filter);
      });
    });

    this.priorityFilters.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.togglePriorityFilter(btn.dataset.priority);
      });
    });

    // Navigation
    this.navItems.forEach((item) => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        this.setView(item.dataset.view);
      });
    });

    // Modal
    this.closeModalBtn.addEventListener("click", () => {
      this.closeEditModal();
    });

    this.cancelEditBtn.addEventListener("click", () => {
      this.closeEditModal();
    });

    this.saveEditBtn.addEventListener("click", () => {
      this.saveEditedTask();
    });

    this.editModal.addEventListener("click", (e) => {
      if (e.target === this.editModal) {
        this.closeEditModal();
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "k":
            e.preventDefault();
            this.toggleSearch();
            break;
          case "n":
            e.preventDefault();
            this.taskInput.focus();
            break;
        }
      }
      if (e.key === "Escape") {
        this.hideTaskDetails();
        this.closeEditModal();
        this.clearSearch();
      }
    });
  }

  // Task CRUD Operations
  addTask() {
    const text = this.taskInput.value.trim();
    if (!text) return;

    const task = {
      id: Date.now().toString(),
      text: text,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate: this.taskDueDate.value || null,
      priority: this.taskPriority.value,
      project: this.taskProject.value,
    };

    this.tasks.unshift(task);
    this.saveTasks();
    this.renderTasks();
    this.updateStats();
    this.updateTaskCounts();
    this.resetTaskForm();
    this.hideTaskDetails();

    // Success feedback
    this.showNotification("Task added successfully!", "success");
  }

  deleteTask(id) {
    if (confirm("Are you sure you want to delete this task?")) {
      this.tasks = this.tasks.filter((task) => task.id !== id);
      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.updateTaskCounts();
      this.showNotification("Task deleted successfully!", "info");
    }
  }

  toggleTask(id) {
    const task = this.tasks.find((task) => task.id === id);
    if (task) {
      task.completed = !task.completed;
      task.completedAt = task.completed ? new Date().toISOString() : null;
      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.updateTaskCounts();

      const message = task.completed
        ? "Task completed! 🎉"
        : "Task uncompleted";
      this.showNotification(message, task.completed ? "success" : "info");
    }
  }

  editTask(id) {
    const task = this.tasks.find((task) => task.id === id);
    if (task) {
      this.editingTaskId = id;
      this.editTaskText.value = task.text;
      this.editTaskDueDate.value = task.dueDate || "";
      this.editTaskPriority.value = task.priority;
      this.editTaskProject.value = task.project;
      this.showEditModal();
    }
  }

  saveEditedTask() {
    const task = this.tasks.find((task) => task.id === this.editingTaskId);
    if (task) {
      task.text = this.editTaskText.value.trim();
      task.dueDate = this.editTaskDueDate.value || null;
      task.priority = this.editTaskPriority.value;
      task.project = this.editTaskProject.value;
      task.updatedAt = new Date().toISOString();

      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.updateTaskCounts();
      this.closeEditModal();
      this.showNotification("Task updated successfully!", "success");
    }
  }

  // Filtering and Search
  getFilteredTasks() {
    let filteredTasks = [...this.tasks];

    // Filter by view
    switch (this.currentView) {
      case "today":
        const today = new Date().toISOString().split("T")[0];
        filteredTasks = filteredTasks.filter(
          (task) => !task.completed && (!task.dueDate || task.dueDate <= today)
        );
        break;
      case "upcoming":
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        filteredTasks = filteredTasks.filter(
          (task) =>
            !task.completed &&
            task.dueDate &&
            task.dueDate > tomorrow.toISOString().split("T")[0]
        );
        break;
      case "completed":
        filteredTasks = filteredTasks.filter((task) => task.completed);
        break;
      case "all":
        // Show all tasks
        break;
    }

    // Filter by project
    if (this.currentFilter !== "all") {
      filteredTasks = filteredTasks.filter(
        (task) => task.project === this.currentFilter
      );
    }

    // Filter by search term
    if (this.searchTerm) {
      filteredTasks = filteredTasks.filter((task) =>
        task.text.toLowerCase().includes(this.searchTerm)
      );
    }

    return filteredTasks;
  }

  // Rendering
  renderTasks() {
    const filteredTasks = this.getFilteredTasks();

    if (filteredTasks.length === 0) {
      this.emptyState.style.display = "block";
      this.tasksList.style.display = "none";
    } else {
      this.emptyState.style.display = "none";
      this.tasksList.style.display = "block";
      this.tasksList.innerHTML = filteredTasks
        .map((task) => this.createTaskHTML(task))
        .join("");
    }

    // Setup task event listeners
    this.setupTaskEventListeners();
  }

  createTaskHTML(task) {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let dueDateClass = "";
    let dueDateText = "";

    if (dueDate) {
      const dueDateOnly = new Date(dueDate);
      dueDateOnly.setHours(0, 0, 0, 0);

      if (dueDateOnly < today) {
        dueDateClass = "overdue";
        dueDateText = "Overdue";
      } else if (dueDateOnly.getTime() === today.getTime()) {
        dueDateClass = "today";
        dueDateText = "Today";
      } else {
        dueDateText = dueDate.toLocaleDateString();
      }
    }

    return `
            <div class="task-item ${
              task.completed ? "completed" : ""
            }" data-id="${task.id}">
                <div class="task-checkbox ${
                  task.completed ? "checked" : ""
                }" data-id="${task.id}">
                    ${task.completed ? '<i class="fas fa-check"></i>' : ""}
                </div>
                <div class="task-content">
                    <div class="task-text">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        ${
                          task.dueDate
                            ? `<div class="task-due-date ${dueDateClass}">
                            <i class="fas fa-calendar"></i>
                            <span>${dueDateText}</span>
                        </div>`
                            : ""
                        }
                        <div class="task-priority ${task.priority}">${
      task.priority
    }</div>
                        <div class="task-project">${task.project}</div>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="task-action-btn edit" data-id="${
                      task.id
                    }" title="Edit task">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="task-action-btn delete" data-id="${
                      task.id
                    }" title="Delete task">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
  }

  setupTaskEventListeners() {
    // Checkbox listeners
    document.querySelectorAll(".task-checkbox").forEach((checkbox) => {
      checkbox.addEventListener("click", (e) => {
        this.toggleTask(e.target.closest(".task-checkbox").dataset.id);
      });
    });

    // Edit button listeners
    document.querySelectorAll(".task-action-btn.edit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.editTask(btn.dataset.id);
      });
    });

    // Delete button listeners
    document.querySelectorAll(".task-action-btn.delete").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteTask(btn.dataset.id);
      });
    });
  }

  // UI Controls
  showTaskDetails() {
    this.taskDetails.classList.add("active");
    this.taskInput.focus();
  }

  hideTaskDetails() {
    this.taskDetails.classList.remove("active");
    this.resetTaskForm();
  }

  resetTaskForm() {
    this.taskInput.value = "";
    this.taskDueDate.value = "";
    this.taskPriority.value = "medium";
    this.taskProject.value = "personal";
  }

  showEditModal() {
    this.editModal.classList.add("active");
    this.editTaskText.focus();
  }

  closeEditModal() {
    this.editModal.classList.remove("active");
    this.editingTaskId = null;
  }

  toggleSearch() {
    const isActive = this.searchContainer.classList.contains("active");
    if (isActive) {
      this.clearSearch();
    } else {
      this.searchContainer.classList.add("active");
      this.searchInput.focus();
    }
  }

  clearSearch() {
    this.searchContainer.classList.remove("active");
    this.searchInput.value = "";
    this.searchTerm = "";
    this.renderTasks();
  }

  toggleFilter() {
    this.filterBar.classList.toggle("active");
  }

  setFilter(filter) {
    this.currentFilter = filter;
    this.filterBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === filter);
    });
    this.renderTasks();
  }

  togglePriorityFilter(priority) {
    const btn = document.querySelector(`[data-priority="${priority}"]`);
    btn.classList.toggle("active");
    this.renderTasks();
  }

  setView(view) {
    this.currentView = view;

    // Update navigation
    this.navItems.forEach((item) => {
      item.classList.toggle("active", item.dataset.view === view);
    });

    // Update title
    const titles = {
      today: "Today",
      upcoming: "Upcoming",
      all: "All Tasks",
      completed: "Completed",
    };
    this.viewTitle.textContent = titles[view];

    this.renderTasks();
  }

  // Statistics and Progress
  updateStats() {
    const totalTasks = this.tasks.length;
    const completedTasks = this.tasks.filter((task) => task.completed).length;
    const completionRate =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    this.totalTasksEl.textContent = totalTasks;
    this.completedTasksEl.textContent = completedTasks;
    this.completionRateEl.textContent = `${completionRate}%`;
    this.progressFill.style.width = `${completionRate}%`;
  }

  updateTaskCounts() {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayCount = this.tasks.filter(
      (task) => !task.completed && (!task.dueDate || task.dueDate <= today)
    ).length;

    const upcomingCount = this.tasks.filter(
      (task) =>
        !task.completed &&
        task.dueDate &&
        task.dueDate > tomorrow.toISOString().split("T")[0]
    ).length;

    const allCount = this.tasks.filter((task) => !task.completed).length;
    const completedCount = this.tasks.filter((task) => task.completed).length;

    this.todayCountEl.textContent = todayCount;
    this.upcomingCountEl.textContent = upcomingCount;
    this.allCountEl.textContent = allCount;
    this.completedCountEl.textContent = completedCount;
  }

  // Notifications
  showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
            <div class="notification-content">
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

    // Add notification styles if not present
    if (!document.querySelector("#notification-styles")) {
      const styles = document.createElement("style");
      styles.id = "notification-styles";
      styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                    max-width: 300px;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    gap: 12px;
                }
                .notification-success {
                    border-left: 4px solid #28a745;
                }
                .notification-info {
                    border-left: 4px solid #17a2b8;
                }
                .notification-close {
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #6c757d;
                    padding: 4px;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
      document.head.appendChild(styles);
    }

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 3000);
  }

  // Local Storage
  loadTasks() {
    try {
      const currentUser = getCurrentUser();
      const key = currentUser
        ? `taskflow-tasks:${currentUser}`
        : "taskflow-tasks";
      const tasks = localStorage.getItem(key);
      return tasks ? JSON.parse(tasks) : [];
    } catch (error) {
      console.error("Error loading tasks:", error);
      return [];
    }
  }

  saveTasks() {
    try {
      const currentUser = getCurrentUser();
      const key = currentUser
        ? `taskflow-tasks:${currentUser}`
        : "taskflow-tasks";
      localStorage.setItem(key, JSON.stringify(this.tasks));
    } catch (error) {
      console.error("Error saving tasks:", error);
      this.showNotification("Error saving tasks. Please try again.", "error");
    }
  }

  // Utility
  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Data Management
  exportTasks() {
    const dataStr = JSON.stringify(this.tasks, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taskflow-backup-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);
    this.showNotification("Tasks exported successfully!", "success");
  }

  importTasks(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedTasks = JSON.parse(e.target.result);
        if (confirm("This will replace all current tasks. Continue?")) {
          this.tasks = importedTasks;
          this.saveTasks();
          this.renderTasks();
          this.updateStats();
          this.updateTaskCounts();
          this.showNotification("Tasks imported successfully!", "success");
        }
      } catch (error) {
        this.showNotification(
          "Error importing tasks. Invalid file format.",
          "error"
        );
      }
    };
    reader.readAsText(file);
  }

  clearAllTasks() {
    if (
      confirm(
        "Are you sure you want to delete all tasks? This cannot be undone."
      )
    ) {
      this.tasks = [];
      this.saveTasks();
      this.renderTasks();
      this.updateStats();
      this.updateTaskCounts();
      this.showNotification("All tasks cleared!", "info");
    }
  }
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.taskManager = new TaskManager();
  // If user not signed in, overlay blocks the app; when signed in, data loads per user

  // Add keyboard shortcut info
  console.log(`
🚀 TaskFlow Keyboard Shortcuts:
• Ctrl/Cmd + K: Toggle search
• Ctrl/Cmd + N: Focus task input
• Escape: Close modals/forms
• Enter: Save task (when input is focused)
    `);
});

// Extend TaskManager with user-awareness
TaskManager.prototype.onUserChanged = function () {
  // Migration: if legacy tasks exist and per-user key empty, copy
  const user = getCurrentUser();
  if (user) {
    const legacyRaw = localStorage.getItem("taskflow-tasks");
    const perUserKey = `taskflow-tasks:${user}`;
    const perUserRaw = localStorage.getItem(perUserKey);
    if (legacyRaw && !perUserRaw) {
      localStorage.setItem(perUserKey, legacyRaw);
    }
  }
  // Reload tasks for new user and refresh UI
  this.tasks = this.loadTasks();
  this.renderTasks();
  this.updateStats();
  this.updateTaskCounts();
  this.refreshUserHeader();
};

TaskManager.prototype.refreshUserHeader = function () {
  const user = getCurrentUser();
  if (this.userChip) {
    if (user) {
      this.userChip.textContent = user;
      this.userChip.style.display = "inline-block";
    } else {
      this.userChip.textContent = "";
      this.userChip.style.display = "none";
    }
  }
  if (this.signoutBtn) {
    this.signoutBtn.style.display = user ? "inline-flex" : "none";
  }
};