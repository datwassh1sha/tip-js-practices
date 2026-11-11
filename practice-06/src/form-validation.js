const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);

// Возвращает { valid, value, errors }.
// value содержит нормализованные title, priority и числовой categoryId.
export function validateTaskDraft(draft, categories) {
  const source = draft && typeof draft === "object" ? draft : {};
  const list = Array.isArray(categories) ? categories : [];
  const errors = {};

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
    errors.priority = "Выберите приоритет: низкий, средний или высокий.";
  } else {
    priority = source.priority;
  }

  // categoryId приходит из select строкой, поэтому приведение выполняется явно.
  const rawCategory = source.categoryId;
  const isBlank = rawCategory === undefined
    || rawCategory === null
    || (typeof rawCategory === "string" && rawCategory.trim().length === 0);
  const categoryId = isBlank ? Number.NaN : Number(rawCategory);

  if (isBlank) {
    errors.categoryId = "Выберите категорию задачи.";
  } else if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
    errors.categoryId = "Категория должна быть выбрана из списка.";
  } else if (!list.some((category) => category && category.id === categoryId)) {
    errors.categoryId = "Выбранной категории нет в загруженном справочнике.";
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, value: null, errors };
  }

  return { valid: true, value: { title, priority, categoryId }, errors: {} };
}