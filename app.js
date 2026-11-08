const STORAGE_KEYS = {
  users: 'todolist_users',
  session: 'todolist_session',
  tasks: 'todolist_tasks'
};

const state = {
  currentUser: null,
  selectedDate: new Date().toISOString().slice(0, 10),
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  filter: 'all'
};

const authView = document.getElementById('authView');
const appView = document.getElementById('appView');
const authMessage = document.getElementById('authMessage');
const userNameEl = document.getElementById('userName');
const userEmailEl = document.getElementById('userEmail');
const headerAvatar = document.getElementById('headerAvatar');
const taskListTitle = document.getElementById('taskListTitle');

const tabButtons = [...document.querySelectorAll('.tab-button')];
const authForms = [...document.querySelectorAll('.auth-form')];

function showMessage(text, type = 'success') {
  authMessage.textContent = text;
  authMessage.className = `auth-message ${type}`;
}

function clearMessage() {
  authMessage.textContent = '';
  authMessage.className = 'auth-message';
}

function setScreen(screen) {
  if (screen === 'auth') {
    appView.classList.remove('active');
    authView.classList.add('active');
  } else {
    authView.classList.remove('active');
    appView.classList.add('active');
  }
}

function getUsers() {
  const raw = localStorage.getItem(STORAGE_KEYS.users);
  return raw ? JSON.parse(raw) : [];
}

function saveUsers(users) {
  localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function getTasksForUser(email) {
  const raw = localStorage.getItem(`${STORAGE_KEYS.tasks}_${email}`);
  return raw ? JSON.parse(raw) : [];
}

function saveTasksForUser(email, tasks) {
  localStorage.setItem(`${STORAGE_KEYS.tasks}_${email}`, JSON.stringify(tasks));
}

function formatDate(dateString) {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}

function getUserByEmail(email) {
  return getUsers().find((user) => user.email.toLowerCase() === email.toLowerCase());
}

function normalizeString(value) {
  return String(value).trim().toLowerCase();
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  authForms.forEach((form) => {
    form.classList.toggle('active', form.id === `${tabName}Form`);
  });
  clearMessage();
}

function showAuthForms() {
  setActiveTab('login');
  setScreen('auth');
}

function loginUser(email, password) {
  const users = getUsers();
  const user = users.find(
    (item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password
  );

  if (!user) {
    showMessage('E-mail ou senha inválidos.', 'error');
    return;
  }

  state.currentUser = user;
  localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ email: user.email }));
  clearMessage();
  renderApp();
  setScreen('app');
}

function registerUser(event) {
  event.preventDefault();
  const name = document.getElementById('registerName').value.trim();
  const email = document.getElementById('registerEmail').value.trim();
  const password = document.getElementById('registerPassword').value;
  const question = document.getElementById('registerQuestion').value;
  const answer = document.getElementById('registerAnswer').value.trim();

  if (password.length < 6) {
    showMessage('A senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  const users = getUsers();
  if (users.some((user) => normalizeString(user.email) === normalizeString(email))) {
    showMessage('Este e-mail já está cadastrado.', 'error');
    return;
  }

  const newUser = {
    id: crypto.randomUUID(),
    name,
    email,
    password,
    recoveryQuestion: question,
    recoveryAnswer: normalizeString(answer),
    createdAt: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);
  showMessage('Conta criada com sucesso! Agora você pode entrar.', 'success');
  document.getElementById('registerForm').reset();
  setActiveTab('login');
}

function recoverPassword(event) {
  event.preventDefault();
  const email = document.getElementById('recoverEmail').value.trim();
  const question = document.getElementById('recoverQuestion').value;
  const answer = normalizeString(document.getElementById('recoverAnswer').value);
  const newPassword = document.getElementById('newPassword').value;

  const user = getUserByEmail(email);

  if (!user) {
    showMessage('Usuário não encontrado.', 'error');
    return;
  }

  if (user.recoveryQuestion !== question || user.recoveryAnswer !== answer) {
    showMessage('Resposta secreta incorreta.', 'error');
    return;
  }

  if (newPassword.length < 6) {
    showMessage('A nova senha deve ter pelo menos 6 caracteres.', 'error');
    return;
  }

  const users = getUsers().map((item) => {
    if (normalizeString(item.email) === normalizeString(email)) {
      return { ...item, password: newPassword };
    }
    return item;
  });

  saveUsers(users);
  showMessage('Senha atualizada com sucesso! Você pode fazer login agora.', 'success');
  document.getElementById('recoverForm').reset();
  setActiveTab('login');
}

function getCurrentUserSession() {
  const raw = localStorage.getItem(STORAGE_KEYS.session);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.email) return null;
    return getUserByEmail(parsed.email);
  } catch {
    return null;
  }
}

function renderUserHeader() {
  const user = state.currentUser || getCurrentUserSession();
  if (!user) return;

  userNameEl.textContent = user.name;
  userEmailEl.textContent = user.email;
  headerAvatar.textContent = user.name.charAt(0).toUpperCase();
}

function createTask(task) {
  const tasks = getTasksForUser(state.currentUser.email);
  tasks.push(task);
  saveTasksForUser(state.currentUser.email, tasks);
}

function toggleTask(taskId) {
  const tasks = getTasksForUser(state.currentUser.email).map((task) => {
    if (task.id === taskId) {
      return { ...task, done: !task.done };
    }
    return task;
  });
  saveTasksForUser(state.currentUser.email, tasks);
  renderTaskList();
  renderStats();
  renderCalendar();
}

function removeTask(taskId) {
  const tasks = getTasksForUser(state.currentUser.email).filter((task) => task.id !== taskId);
  saveTasksForUser(state.currentUser.email, tasks);
  renderTaskList();
  renderStats();
  renderCalendar();
}

function getFilteredTasks(tasks) {
  const selectedDate = state.selectedDate;
  const dateTasks = tasks.filter((task) => task.date === selectedDate || !selectedDate);

  if (state.filter === 'pending') {
    return dateTasks.filter((task) => !task.done);
  }

  if (state.filter === 'done') {
    return dateTasks.filter((task) => task.done);
  }

  return dateTasks;
}

function renderStats() {
  const tasks = getTasksForUser(state.currentUser.email);
  const today = new Date().toISOString().slice(0, 10);

  document.getElementById('statTotal').textContent = String(tasks.length);
  document.getElementById('statDone').textContent = String(tasks.filter((task) => task.done).length);
  document.getElementById('statPending').textContent = String(tasks.filter((task) => !task.done).length);
  document.getElementById('statToday').textContent = String(tasks.filter((task) => task.date === today).length);
}

function renderCalendar() {
  const calendar = document.getElementById('calendar');
  const monthLabel = document.getElementById('monthLabel');
  const tasks = getTasksForUser(state.currentUser.email);
  const firstDay = new Date(state.currentYear, state.currentMonth, 1);
  const lastDay = new Date(state.currentYear, state.currentMonth + 1, 0);
  const firstWeekDay = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const daysInPrevMonth = new Date(state.currentYear, state.currentMonth, 0).getDate();

  monthLabel.textContent = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric'
  }).format(firstDay);

  const weekdayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const html = [];

  weekdayNames.forEach((day) => {
    html.push(`<div class="calendar-day-name">${day}</div>`);
  });

  for (let i = firstWeekDay - 1; i >= 0; i--) {
    const dateNumber = daysInPrevMonth - i;
    html.push(`<button type="button" class="calendar-day other-month" data-date="${state.currentYear}-${String(state.currentMonth).padStart(2, '0')}-${String(dateNumber).padStart(2, '0')}">${dateNumber}</button>`);
  }

  for (let day = 1; day <= totalDays; day++) {
    const dateString = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const hasTask = tasks.some((task) => task.date === dateString);
    const selected = dateString === state.selectedDate;
    html.push(
      `<button type="button" class="calendar-day ${selected ? 'selected' : ''} ${hasTask ? 'has-task' : ''}" data-date="${dateString}">${day}</button>`
    );
  }

  const totalCells = html.length;
  const nextCells = (7 - (totalCells % 7)) % 7;
  for (let i = 1; i <= nextCells; i++) {
    html.push(`<button type="button" class="calendar-day other-month" data-date="${state.currentYear}-${String(state.currentMonth + 2).padStart(2, '0')}-${String(i).padStart(2, '0')}">${i}</button>`);
  }

  calendar.innerHTML = html.join('');

  document.querySelectorAll('.calendar-day').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedDate = button.dataset.date;
      taskListTitle.textContent = `Tarefas — ${formatDate(state.selectedDate)}`;
      renderCalendar();
      renderTaskList();
    });
  });

  taskListTitle.textContent = `Tarefas — ${formatDate(state.selectedDate)}`;
}

function renderTaskList() {
  const tasks = getTasksForUser(state.currentUser.email)
    .filter((task) => task.date === state.selectedDate || !task.date)
    .sort((a, b) => new Date(a.date || '9999-12-31') - new Date(b.date || '9999-12-31'));

  const filtered = state.filter === 'all'
    ? tasks
    : state.filter === 'pending'
      ? tasks.filter((task) => !task.done)
      : tasks.filter((task) => task.done);

  const list = document.getElementById('taskList');

  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Nenhuma tarefa para este dia.</div>';
    return;
  }

  list.innerHTML = filtered
    .map(
      (task) => `
        <div class="task-item">
          <button type="button" class="task-check ${task.done ? 'checked' : ''}" data-task-id="${task.id}" aria-label="Marcar tarefa como concluída"></button>
          <div class="task-main">
            <h4>${task.title}</h4>
            <p>${task.description || 'Sem descrição adicional.'}</p>
            <div class="task-meta">
              <span class="badge date">${formatDate(task.date)}</span>
              <span class="badge priority-${task.priority.toLowerCase()}">${task.priority}</span>
            </div>
          </div>
          <button type="button" class="task-remove" data-remove-id="${task.id}" aria-label="Remover tarefa">×</button>
        </div>
      `
    )
    .join('');

  document.querySelectorAll('.task-check').forEach((button) => {
    button.addEventListener('click', () => toggleTask(button.dataset.taskId));
  });

  document.querySelectorAll('.task-remove').forEach((button) => {
    button.addEventListener('click', () => removeTask(button.dataset.removeId));
  });
}

function handleTaskSubmit(event) {
  event.preventDefault();

  const title = document.getElementById('taskTitle').value.trim();
  const description = document.getElementById('taskDescription').value.trim();
  const date = document.getElementById('taskDate').value;
  const priority = document.getElementById('taskPriority').value;

  if (!title || !date) return;

  const newTask = {
    id: crypto.randomUUID(),
    title,
    description,
    date,
    priority,
    done: false,
    createdAt: new Date().toISOString()
  };

  createTask(newTask);
  state.selectedDate = date;
  document.getElementById('taskForm').reset();
  document.getElementById('taskPriority').value = 'Média';
  renderCalendar();
  renderTaskList();
  renderStats();
}

function renderApp() {
  const user = state.currentUser || getCurrentUserSession();
  if (!user) {
    showAuthForms();
    return;
  }

  state.currentUser = user;
  renderUserHeader();
  renderStats();
  renderCalendar();
  renderTaskList();
}

function logout() {
  localStorage.removeItem(STORAGE_KEYS.session);
  state.currentUser = null;
  setScreen('auth');
  showAuthForms();
  document.getElementById('loginForm').reset();
}

function bindEvents() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveTab(button.dataset.tab));
  });

  document.getElementById('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    loginUser(
      document.getElementById('loginEmail').value,
      document.getElementById('loginPassword').value
    );
  });

  document.getElementById('registerForm').addEventListener('submit', registerUser);
  document.getElementById('recoverForm').addEventListener('submit', recoverPassword);
  document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
  document.getElementById('logoutBtn').addEventListener('click', logout);

  document.getElementById('filterStatus').addEventListener('change', (event) => {
    state.filter = event.target.value;
    renderTaskList();
  });

  document.getElementById('prevMonth').addEventListener('click', () => {
    const prevMonthDate = new Date(state.currentYear, state.currentMonth - 1, 1);
    state.currentMonth = prevMonthDate.getMonth();
    state.currentYear = prevMonthDate.getFullYear();
    renderCalendar();
  });

  document.getElementById('nextMonth').addEventListener('click', () => {
    const nextMonthDate = new Date(state.currentYear, state.currentMonth + 1, 1);
    state.currentMonth = nextMonthDate.getMonth();
    state.currentYear = nextMonthDate.getFullYear();
    renderCalendar();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  const sessionUser = getCurrentUserSession();

  if (sessionUser) {
    state.currentUser = sessionUser;
    setScreen('app');
    renderApp();
  } else {
    showAuthForms();
  }
});
