const PRIORITY_LABELS = Object.freeze({
  low: "Низкий",
  medium: "Средний",
  high: "Высокий",
});

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

export function createTaskElement(task, category) {
  const card = document.createElement("li");
  card.classList.add("task-card");
  card.dataset.taskId = String(task.id);

  if (task.completed) {
    card.classList.add("is-completed");
  }

  const title = document.createElement("h3");
  title.classList.add("task-title");
  // Название приходит с сервера и считается недоверенным текстом.
  title.textContent = task.title;

  const meta = document.createElement("p");
  meta.classList.add("task-meta");

  const status = document.createElement("span");
  status.classList.add("task-status");
  status.textContent = task.completed ? "Выполнена" : "В работе";

  const priority = document.createElement("span");
  priority.classList.add("task-priority");
  priority.textContent = PRIORITY_LABELS[task.priority] ?? "Не указан";

  const categoryName = document.createElement("span");
  categoryName.classList.add("task-category");
  categoryName.textContent = category?.name ?? "Без категории";

  meta.append(status, priority, categoryName);

  const toggle = createActionButton("toggle", task.completed ? "Вернуть в работу" : "Выполнена");
  toggle.setAttribute("aria-pressed", String(Boolean(task.completed)));
  toggle.setAttribute("aria-label", `Изменить статус задачи «${task.title}»`);

  const edit = createActionButton("edit", "Изменить");
  edit.setAttribute("aria-label", `Изменить задачу «${task.title}»`);

  const remove = createActionButton("delete", "Удалить");
  remove.setAttribute("aria-label", `Удалить задачу «${task.title}»`);

  const actions = document.createElement("div");
  actions.classList.add("task-actions");
  actions.append(toggle, edit, remove);

  card.append(title, meta, actions);

  return card;
}

export function renderTaskList(list, tasks, categories) {
  const byId = new Map(
    (Array.isArray(categories) ? categories : []).map((category) => [category.id, category]),
  );

  // replaceChildren заменяет содержимое: повторная отрисовка не копит карточки.
  list.replaceChildren(
    ...(Array.isArray(tasks) ? tasks : []).map((task) => createTaskElement(task, byId.get(task.categoryId))),
  );
}