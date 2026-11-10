export const STORAGE_VERSION = 1;

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function isValidId(id) {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

function isDraftingTask(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    isValidId(value.id) &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 100 &&
    typeof value.completed === "boolean" &&
    ALLOWED_PRIORITIES.has(value.priority)
  );
}

function copyTasks(tasks) {
  return tasks.map((task) => ({ ...task }));
}

function describeError(error) {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

// Все функции принимают объект storage явно, чтобы их можно было проверить
// без обращения к глобальному window.localStorage.

export function isValidTaskList(value) {
  if (!Array.isArray(value)) return false;

  const seen = new Set();

  for (const task of value) {
    if (!isDraftingTask(task)) return false;
    if (seen.has(task.id)) return false;
    seen.add(task.id);
  }

  return true;
}

export function loadTasks(storage, key, fallbackTasks) {
  const fallback = copyTasks(fallbackTasks);

  let raw;

  try {
    raw = storage.getItem(key);
  } catch (error) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: `Не удалось прочитать сохранённые данные: ${describeError(error)}`,
    };
  }

  if (raw === null || raw === undefined) {
    return { ok: true, source: "initial", tasks: fallback };
  }

  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: `Сохранённые данные повреждены и не могут быть прочитаны: ${describeError(error)}`,
    };
  }

  if (parsed === null || typeof parsed !== "object" || parsed.version !== STORAGE_VERSION) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: "Сохранённые данные имеют неизвестную версию формата.",
    };
  }

  if (!isValidTaskList(parsed.tasks)) {
    return {
      ok: false,
      source: "fallback",
      tasks: fallback,
      error: "Сохранённые данные не соответствуют схеме задач.",
    };
  }

  return { ok: true, source: "storage", tasks: copyTasks(parsed.tasks) };
}

export function saveTasks(storage, key, tasks) {
  if (!isValidTaskList(tasks)) {
    return { ok: false, error: "Список задач некорректен и не сохранён." };
  }

  try {
    storage.setItem(key, JSON.stringify({ version: STORAGE_VERSION, tasks }));
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось сохранить данные в браузере: ${describeError(error)}`,
    };
  }

  return { ok: true };
}

export function removeSavedTasks(storage, key) {
  try {
    storage.removeItem(key);
  } catch (error) {
    return {
      ok: false,
      error: `Не удалось удалить сохранённые данные: ${describeError(error)}`,
    };
  }

  return { ok: true };
}
