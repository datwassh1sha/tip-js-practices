import { demoTasks, variantTasks, variantNumber } from "./data.js";
import {
  addTask,
  findTaskById,
  removeTask,
  setTaskCompleted,
  updateTask,
} from "./task-service.js";
import { getVisibleTasks } from "./task-selectors.js";
import { renderEmptyState, renderSummary, renderTaskList } from "./task-view.js";
import { validateTaskDraft } from "./form-validation.js";
import { loadTasks, removeSavedTasks, saveTasks } from "./task-storage.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
  storageStatus: document.querySelector("#storage-status"),
  form: document.querySelector("#task-form"),
  formHeading: document.querySelector("#form-heading"),
  formMode: document.querySelector("#form-mode"),
  formMessage: document.querySelector("#form-message"),
  idInput: document.querySelector("#task-id"),
  titleInput: document.querySelector("#task-title"),
  priorityInput: document.querySelector("#task-priority"),
  submitButton: document.querySelector("#form-submit"),
  cancelButton: document.querySelector("#cancel-edit"),
  resetButton: document.querySelector("#reset-data"),
};

const params = new URLSearchParams(window.location.search);
const isVariant = params.get("dataset") === "variant";
const isCheckRun = params.get("mode") === "check";
const initialTasks = isVariant ? variantTasks : demoTasks;
const datasetName = isVariant ? "variant" : "demo";
const storageKey = isCheckRun
  ? `tip-js-practice-04:checks:${datasetName}`
  : `tip-js-practice-04:${datasetName}`;

// Готовая граница запуска: даже незавершённый или ошибочный модуль хранилища
// не должен оставлять страницу без диагностического сообщения.
let loaded;
try {
  loaded = loadTasks(window.localStorage, storageKey, initialTasks);
} catch (error) {
  loaded = {
    ok: false,
    source: "fallback",
    tasks: initialTasks.map((task) => ({ ...task })),
    error: `Хранилище не инициализировано: ${error.message}`,
  };
  console.error(error);
}
let currentTasks = loaded.tasks;
let currentFilter = "all";
let editingId = null;

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

if (loaded.source === "storage") {
  elements.storageStatus.textContent = "Данные восстановлены из localStorage.";
} else if (loaded.ok) {
  elements.storageStatus.textContent = "Используется исходный набор; сохранённых данных пока нет.";
} else {
  elements.storageStatus.textContent = loaded.error;
  elements.storageStatus.classList.add("is-warning");
}

function renderApp() {
  // Отрисовка выводится из текущего состояния и не читает и не записывает
  // localStorage: режим отображения не является частью модели задачи.
  const visibleTasks = getVisibleTasks(currentTasks, currentFilter);

  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);

  elements.filters.querySelectorAll("button[data-filter]").forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function clearFieldError(name) {
  const input = elements.form.elements.namedItem(name);
  const message = elements.form.querySelector(`[data-error-for="${name}"]`);
  if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
    input.setCustomValidity("");
    input.removeAttribute("aria-invalid");
  }
  if (message) message.textContent = "";
}

function clearFormErrors() {
  for (const name of ["id", "title", "priority"]) clearFieldError(name);
  elements.formMessage.textContent = "";
}

function showFormErrors(errors) {
  clearFormErrors();
  for (const [name, text] of Object.entries(errors)) {
    const input = elements.form.elements.namedItem(name);
    const message = elements.form.querySelector(`[data-error-for="${name}"]`);
    if (input instanceof HTMLInputElement || input instanceof HTMLSelectElement) {
      input.setCustomValidity(text);
      input.setAttribute("aria-invalid", "true");
    }
    if (message) message.textContent = text;
  }
  elements.form.reportValidity();
}

function setFormMode(id = null) {
  if (id === null || id === undefined) {
    editingId = null;
    elements.form.reset();
    clearFormErrors();
    elements.idInput.disabled = false;
    elements.formHeading.textContent = "Добавление задачи";
    elements.formMode.textContent = "Режим создания новой задачи.";
    elements.submitButton.textContent = "Добавить задачу";
    elements.cancelButton.hidden = true;
    elements.idInput.focus();
    return;
  }

  const task = findTaskById(currentTasks, id);

  if (!task) {
    elements.formMessage.textContent = `Задача с идентификатором ${id} не найдена.`;
    return;
  }

  editingId = task.id;
  elements.idInput.value = String(task.id);
  elements.titleInput.value = task.title;
  elements.priorityInput.value = task.priority;
  clearFormErrors();
  elements.idInput.disabled = true;
  elements.formHeading.textContent = "Редактирование задачи";
  elements.formMode.textContent = `Редактируется задача с идентификатором ${task.id}.`;
  elements.submitButton.textContent = "Сохранить изменения";
  elements.cancelButton.hidden = false;
  elements.titleInput.focus();
}

function persistCurrentTasks(successMessage) {
  const saved = saveTasks(window.localStorage, storageKey, currentTasks);
  elements.storageStatus.classList.toggle("is-warning", !saved.ok);
  elements.storageStatus.textContent = saved.ok
    ? "Изменения сохранены в localStorage."
    : saved.error;
  elements.message.textContent = saved.ok ? successMessage : `${successMessage} ${saved.error}`;
  renderApp();
  return saved;
}

// Готовая вспомогательная функция из логики ПР3. После полной перерисовки
// возвращает фокус на действие той же задачи либо на активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

function handleFormSubmit(event) {
  event.preventDefault();

  // Значения FormData читаются строками; число получается явным Number
  // внутри чистой валидации. В режиме редактирования поле id отключено
  // и в FormData отсутствует, поэтому передаётся editingId.
  const formData = new FormData(elements.form);
  const draft = {
    id: formData.get("id"),
    title: formData.get("title"),
    priority: formData.get("priority"),
  };

  const validation = validateTaskDraft(draft, currentTasks, editingId);

  if (!validation.ok) {
    showFormErrors(validation.errors);
    return;
  }

  const { id, title, priority } = validation.value;
  const isEditing = editingId !== null;
  const result = isEditing
    ? updateTask(currentTasks, editingId, title, priority)
    : addTask(currentTasks, id, title, priority);

  if (!result.ok) {
    // Отказ сервиса не считается успешной операцией: массив не заменяется
    // и в хранилище ничего не записывается.
    elements.formMessage.textContent = result.error;
    return;
  }

  currentTasks = result.tasks;
  setFormMode();
  persistCurrentTasks(
    isEditing
      ? `Задача «${title}» изменена.`
      : `Задача «${title}» добавлена.`,
  );
}

function handleTaskListClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-action]");
  if (!button || !elements.list.contains(button)) return;

  const action = button.dataset.action;
  const card = button.closest("li[data-task-id]");
  if (!card) return;

  const id = Number(card.dataset.taskId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    elements.message.textContent = "Некорректный идентификатор задачи.";
    return;
  }

  if (action === "edit") {
    // Режим интерфейса не является частью модели и не сохраняется.
    setFormMode(id);
    return;
  }

  let result;
  let successMessage;

  if (action === "toggle") {
    const task = findTaskById(currentTasks, id);

    if (!task) {
      elements.message.textContent = "Задача не найдена.";
      return;
    }

    result = setTaskCompleted(currentTasks, id, !task.completed);
    successMessage = `Статус задачи ${id} изменён.`;
  } else if (action === "delete") {
    result = removeTask(currentTasks, id);
    successMessage = `Задача ${id} удалена.`;
  } else {
    elements.message.textContent = "Неизвестное действие.";
    return;
  }

  if (!result.ok) {
    elements.message.textContent = result.error || "Не удалось выполнить операцию.";
    return;
  }

  currentTasks = result.tasks;

  if (editingId === id && action === "delete") {
    setFormMode();
  }

  persistCurrentTasks(successMessage);
  restoreTaskFocus(id, action);
}

function handleFilterClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-filter]");
  if (!button || !elements.filters.contains(button)) return;

  const filter = button.dataset.filter;

  if (!["all", "pending", "completed"].includes(filter)) return;

  currentFilter = filter;
  renderApp();
}

function handleResetClick() {
  const removed = removeSavedTasks(window.localStorage, storageKey);

  elements.storageStatus.classList.toggle("is-warning", !removed.ok);
  elements.storageStatus.textContent = removed.ok
    ? "Сохранённые данные удалены; показан исходный набор."
    : removed.error;

  currentTasks = initialTasks.map((task) => ({ ...task }));
  currentFilter = "all";
  setFormMode();

  if (removed.ok) {
    // Исходный набор не сохраняется обратно: ключ должен остаться отсутствующим.
    elements.message.textContent = "Отображён исходный набор задач.";
  } else {
    elements.message.textContent = removed.error;
  }

  renderApp();
}

elements.form.addEventListener("submit", handleFormSubmit);
elements.form.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
    clearFieldError(event.target.name);
  }
});
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);
elements.cancelButton.addEventListener("click", () => setFormMode());
elements.resetButton.addEventListener("click", handleResetClick);

try {
  setFormMode();
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
