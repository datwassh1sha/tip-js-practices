// Сервисный модуль задачи ПР2–ПР4. Реализация перенесена из ПР2/ПР3
// и дополнена неизменяющей операцией updateTask.
// Для предусмотренных ошибок возвращается { ok: false, error: "..." }.
// DOM, localStorage и внешнее состояние в этом модуле не используются.

const ALLOWED_PRIORITIES = ["low", "medium", "high"];

function isValidId(id) {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

function isAllowedPriority(priority) {
  return ALLOWED_PRIORITIES.includes(priority);
}

// Общая проверка названия: строка, trim, длина от 1 до 100.
function normalizeTitle(title) {
  if (typeof title !== "string") {
    return { ok: false, error: "Название задачи должно быть строкой" };
  }

  const cleanTitle = title.trim();

  if (cleanTitle.length < 1 || cleanTitle.length > 100) {
    return { ok: false, error: "Название должно содержать от 1 до 100 символов" };
  }

  return { ok: true, title: cleanTitle };
}

export function createTask(id, title, priority = "medium") {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  const normalized = normalizeTitle(title);

  if (!normalized.ok) {
    return normalized;
  }

  if (!isAllowedPriority(priority)) {
    return { ok: false, error: "Некорректный приоритет" };
  }

  return {
    ok: true,
    task: {
      id: id,
      title: normalized.title,
      completed: false,
      priority: priority,
    },
  };
}

export function findTaskById(tasks, id) {
  return tasks.find((task) => task.id === id);
}

export function getPendingTasks(tasks) {
  return tasks.filter((task) => task.completed === false);
}

export function getTaskTitles(tasks) {
  return tasks.map((task) => task.title);
}

export function getTaskStats(tasks) {
  const total = tasks.length;
  let completed = 0;

  for (const task of tasks) {
    if (task.completed === true) {
      completed += 1;
    }
  }

  const pending = total - completed;
  const progress = total > 0 ? (completed / total) * 100 : 0;

  return {
    total: total,
    completed: completed,
    pending: pending,
    progress: progress,
  };
}

export function addTask(tasks, id, title, priority = "medium") {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  if (tasks.some((task) => task.id === id)) {
    return { ok: false, error: "Задача с таким id уже существует" };
  }

  const result = createTask(id, title, priority);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    tasks: [...tasks, result.task],
  };
}

export function setTaskCompleted(tasks, id, completed) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  if (typeof completed !== "boolean") {
    return { ok: false, error: "completed должен быть логическим значением" };
  }

  if (!tasks.some((task) => task.id === id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.map((task) => (task.id === id ? { ...task, completed } : task)),
  };
}

export function renameTask(tasks, id, title) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  const normalized = normalizeTitle(title);

  if (!normalized.ok) {
    return normalized;
  }

  if (!tasks.some((task) => task.id === id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.map((task) =>
      task.id === id ? { ...task, title: normalized.title } : task,
    ),
  };
}

export function removeTask(tasks, id) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  if (!tasks.some((task) => task.id === id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.filter((task) => task.id !== id),
  };
}

// ПР4. Меняет только title и priority выбранной задачи.
// id и completed сохраняются, исходный массив и его объекты не изменяются.
export function updateTask(tasks, id, title, priority) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  if (!tasks.some((task) => task.id === id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  const normalized = normalizeTitle(title);

  if (!normalized.ok) {
    return normalized;
  }

  if (!isAllowedPriority(priority)) {
    return { ok: false, error: "Некорректный приоритет" };
  }

  return {
    ok: true,
    tasks: tasks.map((task) =>
      task.id === id
        ? { ...task, title: normalized.title, priority: priority }
        : task,
    ),
  };
}
