import { getTaskStats } from "./task-selectors.js";

export function createTaskElement(task) {
    const card = document.createElement("li");
    card.classList.add("task-card");
    card.dataset.taskId = task.id;

    if (task.completed) {
        card.classList.add("is-completed");
    }

    const title = document.createElement("h3");
    title.classList.add("task-title");
    title.textContent = task.title;

    const status = document.createElement("p");
    status.classList.add("task-status");
    status.textContent = task.completed ? "Выполнена" : "В работе";

    const priority = document.createElement("p");
    priority.classList.add("task-priority");

    if (task.priority === "low") {
        priority.textContent = "Низкий";
    } else if (task.priority === "medium") {
        priority.textContent = "Средний";
    } else {
        priority.textContent = "Высокий";
    }

    const actions = document.createElement("div");
    actions.classList.add("task-actions");

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.dataset.action = "toggle";
    toggleButton.setAttribute("aria-pressed", String(task.completed));

    const toggleLabel = document.createElement("span");
    toggleLabel.classList.add("action-label");
    toggleLabel.textContent = "Выполнена";
    toggleButton.append(toggleLabel);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";

    const deleteLabel = document.createElement("span");
    deleteLabel.classList.add("action-label");
    deleteLabel.textContent = "Удалить";
    deleteButton.append(deleteLabel);

    actions.append(toggleButton, deleteButton);
    card.append(title, status, priority, actions);

    return card;
}

export function renderTaskList(listElement, tasks) {
    const cards = tasks.map(task => createTaskElement(task));
    listElement.replaceChildren(...cards);
}



export function renderSummary(summaryElement, tasks, visibleCount) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;
  const progress =
    total === 0 ? 0 : (completed / total) * 100;

const values = {
  total,
  completed,
  pending,
  progress: `${progress.toFixed(1)}%`,
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
