const priorities = ["low", "medium", "high"];

function isValidId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function validateTitle(title) {
  if (typeof title !== "string") {
    return { ok: false, error: "Название задачи должно быть строкой" };
  }

  const cleanTitle = title.trim();

  if (cleanTitle.length < 1 || cleanTitle.length > 100) {
    return {
      ok: false,
      error: "Название должно содержать от 1 до 100 символов",
    };
  }

  return { ok: true, title: cleanTitle };
}

export function createTask(id, title, priority = "medium") {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  const titleResult = validateTitle(title);

  if (!titleResult.ok) {
    return titleResult;
  }

  if (!priorities.includes(priority)) {
    return { ok: false, error: "Некорректный приоритет" };
  }

  return {
    ok: true,
    task: {
      id,
      title: titleResult.title,
      completed: false,
      priority,
    },
  };
}

export function findTaskById(tasks, id) {
  return tasks.find((task) => task.id === id);
}

export function getPendingTasks(tasks) {
  return tasks.filter((task) => !task.completed);
}

export function getTaskTitles(tasks) {
  return tasks.map((task) => task.title);
}

export function getTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const pending = total - completed;
  const progress = total === 0 ? 0 : (completed / total) * 100;

  return { total, completed, pending, progress };
}

export function addTask(tasks, id, title, priority = "medium") {
  const result = createTask(id, title, priority);

  if (!result.ok) {
    return result;
  }

  if (findTaskById(tasks, id)) {
    return {
      ok: false,
      error: "Задача с таким id уже существует",
    };
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
    return {
      ok: false,
      error: "completed должен быть логическим значением",
    };
  }

  if (!findTaskById(tasks, id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  const updatedTasks = tasks.map((task) =>
    task.id === id ? { ...task, completed } : task
  );

  return { ok: true, tasks: updatedTasks };
}

export function renameTask(tasks, id, title) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  const titleResult = validateTitle(title);

  if (!titleResult.ok) {
    return titleResult;
  }

  if (!findTaskById(tasks, id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  const updatedTasks = tasks.map((task) =>
    task.id === id ? { ...task, title: titleResult.title } : task
  );

  return { ok: true, tasks: updatedTasks };
}

export function removeTask(tasks, id) {
  if (!isValidId(id)) {
    return { ok: false, error: "Некорректный id" };
  }

  if (!findTaskById(tasks, id)) {
    return { ok: false, error: "Задача не найдена" };
  }

  return {
    ok: true,
    tasks: tasks.filter((task) => task.id !== id),
  };
}