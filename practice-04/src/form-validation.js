const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

function isValidId(id) {
  return typeof id === "number" && Number.isSafeInteger(id) && id > 0;
}

// Чистая проверка данных формы. DOM и показ сообщений выполняются в main.js.
// draft: { id, title, priority }; editingId: null либо id редактируемой задачи.
export function validateTaskDraft(draft, tasks, editingId = null) {
  const errors = {};
  const isEditing = editingId !== null && editingId !== undefined;
  const source = draft && typeof draft === "object" ? draft : {};

  let id = null;

  if (isEditing) {
    // Поле id заблокировано в режиме редактирования и не попадает в FormData,
    // поэтому источником идентификатора является editingId.
    if (!isValidId(editingId) || !tasks.some((task) => task.id === editingId)) {
      errors.id = "Редактируемая задача не найдена в текущем списке.";
    } else {
      id = editingId;
    }
  } else {
    // Пустая строка не должна превращаться в 0 после Number.
    const rawId = source.id;
    const isBlank = typeof rawId === "string" && rawId.trim().length === 0;
    const numericId = isBlank ? Number.NaN : Number(rawId);

    if (rawId === null || rawId === undefined || isBlank) {
      errors.id = "Укажите идентификатор задачи.";
    } else if (!isValidId(numericId)) {
      errors.id = "Идентификатор должен быть положительным целым числом.";
    } else if (tasks.some((task) => task.id === numericId)) {
      errors.id = `Задача с идентификатором ${numericId} уже существует.`;
    } else {
      id = numericId;
    }
  }

  let title = "";

  if (typeof source.title !== "string") {
    errors.title = "Название задачи должно быть строкой.";
  } else {
    title = source.title.trim();

    if (title.length === 0) {
      errors.title = "Название не должно быть пустым или состоять из пробелов.";
    } else if (title.length > 100) {
      errors.title = "Название не должно превышать 100 символов.";
    }
  }

  let priority = "";

  if (!ALLOWED_PRIORITIES.has(source.priority)) {
    errors.priority = "Выберите приоритет: low, medium или high.";
  } else {
    priority = source.priority;
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: { id, title, priority } };
}
