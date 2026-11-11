import { ApiError } from "./api-client.js";

const ALLOWED_PRIORITIES = new Set(["low", "medium", "high"]);
const ALLOWED_FILTERS = new Set(["completed", "priority", "categoryId", "q"]);

function invalidResponse(message) {
  return new ApiError(message, { kind: "invalid-response" });
}

function isPositiveSafeInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

export function isTask(value) {
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

export function isCategory(value) {
  return Boolean(
    value
    && typeof value === "object"
    && isPositiveSafeInteger(value.id)
    && typeof value.name === "string"
    && value.name.trim().length >= 1
    && value.name.trim().length <= 100,
  );
}

function assertPositiveId(id) {
  if (!isPositiveSafeInteger(id)) {
    throw new TypeError("id должен быть положительным целым числом.");
  }
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

function readSingleTask(payload, label = "задачи") {
  if (!payload || typeof payload !== "object" || !isTask(payload.data)) {
    throw invalidResponse(`Ответ ${label} не соответствует схеме задачи.`);
  }
  return payload.data;
}

function normalizeFilters(filters) {
  // Отсутствие аргумента означает запрос без фильтров; явный null — неверный тип.
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

    normalized.q = query;
  }

  return normalized;
}

function normalizeDraft(draft) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    throw new TypeError("Черновик задачи должен быть объектом.");
  }

  const allowed = new Set(["title", "priority", "categoryId"]);
  const body = {};

  for (const [name, value] of Object.entries(draft)) {
    if (!allowed.has(name)) {
      throw new TypeError(`Тело создания не должно содержать поле ${name}.`);
    }
    body[name] = value;
  }

  return body;
}

function signalOption(options) {
  if (options === undefined || options === null) return undefined;
  if (typeof options !== "object") throw new TypeError("options должен быть объектом.");
  return options.signal;
}

function requestOptions(query, options) {
  const signal = signalOption(options);
  const result = {};
  const hasQuery = query && Object.keys(query).length > 0;

  if (hasQuery) result.query = query;
  if (signal !== undefined) result.signal = signal;

  return Object.keys(result).length > 0 ? result : undefined;
}

// Методы результата:
// getTasks, getTaskById, getCategories, loadInitialData, createTask, updateTask,
// setTaskCompleted, deleteTask и resetDemoData.
// Последний аргумент каждого метода данных — { signal }.
export function createTaskApi(client) {
  if (!client || typeof client !== "object" || typeof client.requestJson !== "function") {
    throw new TypeError("createTaskApi ожидает клиент с методом requestJson.");
  }

  async function getTasks(filters, options) {
    const query = normalizeFilters(filters);
    const payload = readCollection(
      await client.requestJson("/tasks", requestOptions(query, options) ?? {}),
      "задач",
      isTask,
    );

    return { tasks: payload.data, meta: payload.meta };
  }

  async function getTaskById(id, options) {
    assertPositiveId(id);
    const payload = await client.requestJson(
      `/tasks/${id}`,
      requestOptions({}, options) ?? {},
    );
    return readSingleTask(payload, `задачи ${id}`);
  }

  async function getCategories(options) {
    const payload = readCollection(
      await client.requestJson("/categories", requestOptions({}, options) ?? {}),
      "категорий",
      isCategory,
    );

    return payload.data;
  }

  async function loadInitialData(filters, options) {
    const query = normalizeFilters(filters);

    // Оба запроса создаются до общего await, поэтому выполняются параллельно.
    const [tasksPayload, categoriesPayload] = await Promise.all([
      client.requestJson("/tasks", requestOptions(query, options) ?? {}),
      client.requestJson("/categories", requestOptions({}, options) ?? {}),
    ]);

    const checkedTasks = readCollection(tasksPayload, "задач", isTask);
    const checkedCategories = readCollection(categoriesPayload, "категорий", isCategory);

    return {
      tasks: checkedTasks.data,
      categories: checkedCategories.data,
      meta: checkedTasks.meta,
    };
  }

  async function createTask(draft, options) {
    const body = normalizeDraft(draft);
    const signal = signalOption(options);
    const payload = await client.requestJson("/tasks", {
      method: "POST",
      body,
      ...(signal === undefined ? {} : { signal }),
    });

    return readSingleTask(payload, "созданной задачи");
  }

  async function updateTask(id, changes, options) {
    assertPositiveId(id);

    if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
      throw new TypeError("Изменения должны быть объектом.");
    }

    const allowed = new Set(["title", "priority", "categoryId"]);
    const body = {};

    for (const [name, value] of Object.entries(changes)) {
      if (!allowed.has(name)) {
        throw new TypeError(`Поле ${name} не изменяется этим методом.`);
      }
      body[name] = value;
    }

    if (Object.keys(body).length === 0) {
      throw new TypeError("Нужно передать хотя бы одно изменяемое поле.");
    }

    const signal = signalOption(options);
    const payload = await client.requestJson(`/tasks/${id}`, {
      method: "PATCH",
      body,
      ...(signal === undefined ? {} : { signal }),
    });

    return readSingleTask(payload, `изменённой задачи ${id}`);
  }

  async function setTaskCompleted(id, completed, options) {
    assertPositiveId(id);

    if (typeof completed !== "boolean") {
      throw new TypeError("completed должен быть логическим значением.");
    }

    const signal = signalOption(options);
    const payload = await client.requestJson(`/tasks/${id}`, {
      method: "PATCH",
      body: { completed },
      ...(signal === undefined ? {} : { signal }),
    });

    return readSingleTask(payload, `задачи ${id}`);
  }

  async function deleteTask(id, options) {
    assertPositiveId(id);

    const result = await client.requestJson(
      `/tasks/${id}`,
      { method: "DELETE", ...requestOptions({}, options) },
    );

    // Контракт DELETE — 204 без тела; любое тело означает нарушение контракта.
    if (result !== null) {
      throw invalidResponse("Ответ на удаление задачи должен быть пустым (204).");
    }

    return null;
  }

  async function resetDemoData(options) {
    const signal = signalOption(options);
    const payload = await client.requestJson("/debug/reset", {
      method: "POST",
      ...(signal === undefined ? {} : { signal }),
    });

    if (
      !payload
      || typeof payload !== "object"
      || !payload.data
      || typeof payload.data !== "object"
      || payload.data.reset !== true
      || !isPositiveSafeInteger(payload.data.total)
    ) {
      throw invalidResponse("Ответ восстановления набора не соответствует схеме.");
    }

    return { reset: true, total: payload.data.total };
  }

  return {
    getTasks,
    getTaskById,
    getCategories,
    loadInitialData,
    createTask,
    updateTask,
    setTaskCompleted,
    deleteTask,
    resetDemoData,
  };
}