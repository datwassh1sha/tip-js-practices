import { getTaskStats } from "./task-service.js";

// Модуль представления ПР3, расширенный действием edit.
// Здесь создаётся DOM, но не изменяются данные и localStorage.

const PRIORITY_LABELS = {
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
};

function createActionButton(action, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.action = action;

  const text = document.createElement("span");
  text.classList.add("action-label");
  text.textContent = label;

  button.append(text);
  return button;
}

export function createTaskElement(task) {
  const card = document.createElement("li");
  card.classList.add("task-card");
  card.dataset.taskId = String(task.id);

  if (task.completed) {
    card.classList.add("is-completed");
  }

  const title = document.createElement("h3");
  title.classList.add("task-title");
  // Название выводится только как текст: разметка из данных не исполняется.
  title.textContent = task.title;

  const status = document.createElement("p");
  status.classList.add("task-status");
  status.textContent = task.completed ? "Выполнена" : "В работе";

  const priority = document.createElement("p");
  priority.classList.add("task-priority");
  priority.textContent = PRIORITY_LABELS[task.priority] ?? "Не указан";

  const toggleButton = createActionButton("toggle", "Выполнена");
  toggleButton.setAttribute("aria-pressed", String(Boolean(task.completed)));
  toggleButton.setAttribute("aria-label", `Изменить статус задачи «${task.title}»`);

  const editButton = createActionButton("edit", "Изменить");
  editButton.setAttribute("aria-label", `Изменить задачу «${task.title}»`);

  const deleteButton = createActionButton("delete", "Удалить");
  deleteButton.setAttribute("aria-label", `Удалить задачу «${task.title}»`);

  const actions = document.createElement("div");
  actions.classList.add("task-actions");
  actions.append(toggleButton, editButton, deleteButton);

  card.append(title, status, priority, actions);

  return card;
}

export function renderTaskList(listElement, tasks) {
  // replaceChildren заменяет содержимое, поэтому повторная отрисовка
  // не накапливает карточки и не создаёт побочных эффектов.
  listElement.replaceChildren(...tasks.map((task) => createTaskElement(task)));
}

export function renderSummary(summaryElement, tasks, visibleCount) {
  const stats = getTaskStats(tasks);

  const values = {
    total: stats.total,
    completed: stats.completed,
    pending: stats.pending,
    progress: `${stats.progress.toFixed(1)}%`,
    visible: visibleCount,
  };

  summaryElement.querySelectorAll("[data-stat]").forEach((element) => {
    const key = element.dataset.stat;

    if (Object.hasOwn(values, key)) {
      element.textContent = String(values[key]);
    }
  });
}

export function renderEmptyState(messageElement, total, visibleCount) {
  if (total === 0) {
    messageElement.textContent = "Список задач пуст.";
    messageElement.hidden = false;
  } else if (visibleCount === 0) {
    messageElement.textContent = "Нет задач по выбранному фильтру.";
    messageElement.hidden = false;
  } else {
    messageElement.textContent = "";
    messageElement.hidden = true;
  }
}
