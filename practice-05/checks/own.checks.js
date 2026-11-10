// Собственные проверки ПР5 (три случая сверх готовых наборов).
// Реальная сеть не используется: fetchFn подменяется.
import assert from "node:assert/strict";
import { ApiError, createApiClient } from "../src/api-client.js";
import { createTaskApi } from "../src/task-api.js";

let passed = 0;
let failed = 0;

async function check(name, action) {
  try {
    await action();
    passed += 1;
    console.log(`OK: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error.stack ?? error.message);
  }
}

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

function task(overrides = {}) {
  return {
    id: 4,
    title: "Подготовить модель задач",
    completed: false,
    priority: "high",
    categoryId: 2,
    ...overrides,
  };
}

function category(overrides = {}) {
  return { id: 2, name: "Проект", ...overrides };
}

async function expectApiError(action, kind) {
  let caught;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught instanceof ApiError, "Ожидался экземпляр ApiError");
  assert.equal(caught.kind, kind);
  return caught;
}

// Случай 1: собственная комбинация query-параметров.
// Проверяется совместная передача q с пробелами и кириллицей, categoryId и completed=false,
// а также отсутствие пустого q и сохранение порядка параметров в URL.
await check("С1. Комбинация q + categoryId + completed=false в одном запросе", async () => {
  let requestedUrl = null;
  const fetchFn = async (url) => {
    requestedUrl = String(url);
    return jsonResponse({
      data: [task()],
      meta: {
        total: 1,
        filters: { completed: false, priority: null, categoryId: 2, q: "провер & API" },
      },
    });
  };
  const client = createApiClient({ baseUrl: "http://example.test/api", fetchFn });
  const api = createTaskApi(client);

  const result = await api.getTasks({
    q: "  провер & API  ",
    categoryId: 2,
    completed: false,
  });

  const parsed = new URL(requestedUrl);
  assert.equal(parsed.pathname, "/api/tasks");
  assert.equal(parsed.searchParams.get("q"), "провер & API");
  assert.equal(parsed.searchParams.get("categoryId"), "2");
  assert.equal(parsed.searchParams.get("completed"), "false");
  assert.equal(parsed.searchParams.has("priority"), false);
  assert.deepEqual(result.tasks.map((item) => item.id), [4]);
  assert.equal(result.meta.total, 1);
});

// Случай 2: дополнительный ошибочный HTTP-сценарий, отсутствующий в готовых наборах.
// Ответ 429 с заголовком Retry-After и телом-массивом вместо объекта error.
await check("С2. HTTP 429 с нестандартным телом сохраняет статус и вид http", async () => {
  const fetchFn = async () => new Response(JSON.stringify(["слишком много запросов"]), {
    status: 429,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Retry-After": "30",
    },
  });
  const client = createApiClient({ baseUrl: "http://example.test/api", fetchFn });

  const error = await expectApiError(() => client.requestJson("/tasks"), "http");
  assert.equal(error.status, 429);
  assert.equal(error.code, null);
  assert.equal(error.details, null);
  assert.match(error.message, /429/);
  assert.equal(error.url, "http://example.test/api/tasks");
});

// Случай 3: граница проверки схемы — корректная задача, но meta.total не совпадает
// с длиной коллекции после фильтрации на стороне сервера.
await check("С3. Граница схемы: meta.total больше длины data отклоняется", async () => {
  let calls = 0;
  const api = createTaskApi({
    async requestJson() {
      calls += 1;
      return { data: [task()], meta: { total: 3, filters: {} } };
    },
  });

  const error = await expectApiError(() => api.getTasks(), "invalid-response");
  assert.match(error.message, /meta\.total/);
  assert.equal(calls, 1);

  // Контроль: при совпадении total и длины коллекции запрос принимается.
  const okApi = createTaskApi({
    async requestJson() {
      return { data: [task()], meta: { total: 1, filters: {} } };
    },
  });
  assert.deepEqual((await okApi.getTasks()).tasks.map((item) => item.id), [4]);
});

// Дополнительно к С3: категория с повторяющимся id внутри коллекции.
await check("С4. Коллекция категорий с повторяющимся id отклоняется", async () => {
  const api = createTaskApi({
    async requestJson() {
      return { data: [category(), category()], meta: { total: 2 } };
    },
  });
  const error = await expectApiError(() => api.getCategories(), "invalid-response");
  assert.match(error.message, /повторяющийся id/);
});

console.log(`\nИтог собственных проверок: успешно ${passed}, ошибок ${failed}.`);
if (failed > 0) process.exitCode = 1;
