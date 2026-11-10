import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isTask(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.title === "string"
    && value.title.trim().length >= 1
    && value.title.trim().length <= 100
    && typeof value.completed === "boolean"
    && ALLOWED_PRIORITIES.has(value.priority)
    && isPositiveSafeInteger(value.categoryId),
  );
}

function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function assertUniqueIds(items, label) {
  const seen = new Set();
  for (const item of items) {
    if (seen.has(item.id)) {
      throw invalidResponse(`Коллекция ${label} содержит повторяющийся id ${item.id}.`);
    }
    seen.add(item.id);
  }
}

function readCollection(payload, label, isValidItem) {
  if (!payload || typeof payload !== "object") {
    throw invalidResponse(`Ответ ${label} должен быть объектом.`);
  }

  if (!Array.isArray(payload.data)) {
    throw invalidResponse(`Поле data ответа ${label} должно быть массивом.`);
  }

  payload.data.forEach((item, index) => {
    if (!isValidItem(item)) {
      throw invalidResponse(`Ответ ${label} содержит некорректную запись с индексом ${index}.`);
    }
  });

  assertUniqueIds(payload.data, label);

  if (!payload.meta || typeof payload.meta !== "object") {
    throw invalidResponse(`Ответ ${label} не содержит объект meta.`);
  }

  if (payload.meta.total !== payload.data.length) {
    throw invalidResponse(
      `meta.total (${payload.meta.total}) не совпадает с длиной коллекции ${label} (${payload.data.length}).`,
    );
  }

  return payload;
}

function normalizeFilters(filters) {
  // Отсутствие аргумента означает запрос без фильтров, а явный null —
  // неверный тип, который отклоняется до сетевого запроса.
  if (filters === undefined) return {};
  if (filters === null || typeof filters !== "object" || Array.isArray(filters)) {
    throw new TypeError("Фильтры должны быть обычным объектом.");
  }

  const normalized = {};

  for (const [name, value] of Object.entries(filters)) {
    if (!ALLOWED_FILTERS.has(name)) {
      throw new TypeError(`Неизвестный фильтр: ${name}.`);
    }

    if (name === "completed") {
      if (typeof value !== "boolean") {
        throw new TypeError("completed должен быть логическим значением.");
      }
      normalized.completed = value;
      continue;
    }

    if (name === "priority") {
      if (!ALLOWED_PRIORITIES.has(value)) {
        throw new TypeError("priority должен быть low, medium или high.");
      }
      normalized.priority = value;
      continue;
    }

    if (name === "categoryId") {
      if (!isPositiveSafeInteger(value)) {
        throw new TypeError("categoryId должен быть положительным целым числом.");
      }
      normalized.categoryId = value;
      continue;
    }

    if (typeof value !== "string") {
      throw new TypeError("q должен быть строкой.");
    }

    const query = value.trim();
    if (query.length > 100) {
      throw new TypeError("q не должен быть длиннее 100 символов.");
    }

    // Пустая строка не передаётся в URL: buildUrl пропускает её как отсутствие фильтра.
    normalized.q = query;
  }

  return normalized;
}

function assertPositiveId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id должен быть положительным целым числом.");
  }
}

// client — объект, созданный createApiClient.
// Контракт результата:
// getTasks(filters) -> Promise<{ tasks, meta }>
// getTaskById(id) -> Promise<task>
// getCategories() -> Promise<category[]>
// loadInitialData(filters) -> Promise<{ tasks, categories, meta }>
export function createTaskApi(client) {
  if (!client || typeof client !== "object" || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  async function getTasks(filters) {
    // Фильтры проверяются до запроса: логическое false остаётся boolean,
    // строковое представление создаёт URLSearchParams внутри buildUrl.
    const query = normalizeFilters(filters);
    const payload = readCollection(
      await withQuery(client, "/tasks", query),
      "задач",
      isTask,
    );

    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id) {
    assertPositiveId(id);

    const payload = await client.requestJson(`/tasks/${id}`);

    if (!payload || typeof payload !== "object" || !isTask(payload.data)) {
      throw invalidResponse(`Ответ задачи ${id} не соответствует схеме.`);
    }

    return payload.data;
  }

  async function getCategories() {
    const payload = readCollection(
      await client.requestJson("/categories"),
      "категорий",
      isCategory,
    );

    return payload.data;
  }

  async function loadInitialData(filters) {
    const query = normalizeFilters(filters);

    // Оба запроса создаются до общего await, поэтому выполняются совместно.
    const tasksPromise = withQuery(client, "/tasks", query);
    const categoriesPromise = client.requestJson("/categories");

    const [tasksPayload, categoriesPayload] = await Promise.all([
      tasksPromise,
      categoriesPromise,
    ]);

    const checkedTasks = readCollection(tasksPayload, "задач", isTask);
    const checkedCategories = readCollection(categoriesPayload, "категорий", isCategory);

    return {
      tasks: checkedTasks.data,
      categories: checkedCategories.data,
      meta: checkedTasks.meta,
    };
  }

  return { getTasks, getTaskById, getCategories, loadInitialData };
}

function withQuery(client, path, query) {
  return query && Object.keys(query).length > 0
    ? client.requestJson(path, { query })
    : client.requestJson(path);
}
