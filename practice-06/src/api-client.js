export class ApiError extends Error {
  constructor(message, {
    kind,
    status = null,
    code = null,
    details = null,
    url = null,
    cause,
  } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.code = code;
    this.details = details;
    this.url = url;
  }
}

const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);

function fail(message, kind, extra = {}) {
  return new ApiError(message, { kind, ...extra });
}

function readErrorPayload(payload) {
  if (!payload || typeof payload !== "object") return {};
  const error = payload.error;
  if (!error || typeof error !== "object") return {};

  return {
    code: typeof error.code === "string" && error.code.length > 0 ? error.code : null,
    message: typeof error.message === "string" && error.message.length > 0
      ? error.message
      : null,
    details: error.details === undefined ? null : error.details,
  };
}

// Соединяет абсолютный baseUrl, путь и непустые query-параметры.
export function buildUrl(baseUrl, path, query = {}) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }

  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    throw new TypeError("baseUrl должен быть абсолютным http- или https-адресом.");
  }

  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new TypeError("baseUrl должен использовать схему http или https.");
  }

  if (base.search.length > 0 || base.hash.length > 0) {
    throw new TypeError("baseUrl не должен содержать query-строку или hash.");
  }

  if (typeof path !== "string" || path.trim().length === 0) {
    throw new TypeError("path должен быть непустой строкой.");
  }

  if (query === null || typeof query !== "object" || Array.isArray(query)) {
    throw new TypeError("query должен быть обычным объектом.");
  }

  const basePath = base.pathname.replace(/\/+$/, "");
  const suffix = path.replace(/^\/+/, "");

  // Путь baseUrl не перекодируется вручную: адрес собирается и разбирается заново.
  const url = new URL(`${base.origin}${basePath}/${suffix}`);

  for (const [name, value] of Object.entries(query)) {
    // Пропускаются только undefined, null и пустая строка:
    // false и 0 являются содержательными значениями фильтров.
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  return url.href;
}

// requestJson(path, { method, query, body, signal, timeoutMs } = {})
// поддерживает GET, POST, PATCH и DELETE; ответ 204 преобразуется в null.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 3000,
} = {}) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }

  // Конфигурация проверяется на этапе фабрики, а не при первом запросе.
  buildUrl(baseUrl, "/health");

  if (typeof fetchFn !== "function") {
    throw new TypeError("fetchFn должен быть функцией.");
  }

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new TypeError("timeoutMs должен быть положительным целым числом.");
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  function signalFor(timeout, externalSignal) {
    const timeoutSignal = AbortSignal.timeout(timeout);

    if (externalSignal === undefined || externalSignal === null) {
      return { signal: timeoutSignal, externalSignal: null };
    }

    if (!(externalSignal instanceof AbortSignal)) {
      throw new TypeError("signal должен быть экземпляром AbortSignal.");
    }

    return {
      signal: AbortSignal.any([externalSignal, timeoutSignal]),
      externalSignal,
    };
  }

  async function requestJson(path, {
    method = "GET",
    query,
    body,
    signal,
    timeoutMs: perCallTimeout,
  } = {}) {
    if (typeof method !== "string") {
      throw new TypeError("method должен быть строкой.");
    }

    const verb = method.toUpperCase();
    if (!ALLOWED_METHODS.has(verb)) {
      throw new TypeError(`Метод ${method} не поддерживается: допустимы GET, POST, PATCH и DELETE.`);
    }

    const hasBody = body !== undefined && body !== null;

    // Тело у GET отклоняется до сетевого запроса: контракт чтения его не предусматривает.
    if (verb === "GET" && hasBody) {
      throw new TypeError("GET-запрос не может содержать тело.");
    }

    const timeout = perCallTimeout === undefined ? timeoutMs : perCallTimeout;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
      throw new TypeError("timeoutMs должен быть положительным целым числом.");
    }

    const url = buildUrl(normalizedBaseUrl, path, query ?? {});
    const { signal: requestSignal, externalSignal } = signalFor(timeout, signal);

    const headers = { Accept: "application/json" };
    const options = { method: verb, headers, signal: requestSignal };

    if (hasBody) {
      // Content-Type добавляется только к запросам с телом:
      // лишний заголовок вызвал бы ненужный CORS preflight.
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    let response;

    // Первый try охватывает только транспорт: HTTP-ошибка, созданная после
    // получения Response, не должна попасть сюда и превратиться в network.
    try {
      response = await fetchFn(url, options);
    } catch (error) {
      throw toFetchError(error, url, externalSignal);
    }

    if (!(response instanceof Response)) {
      throw fail(
        "Сервер вернул значение, которое не является объектом Response.",
        "invalid-response",
        { url },
      );
    }

    // Статус проверяется до Content-Type: важнее сообщить 502, чем неверный формат.
    if (!response.ok) {
      throw await toHttpError(response, url);
    }

    // 204 не имеет тела: response.json() на пустой строке завершился бы ошибкой.
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw fail(
        `Ожидался ответ JSON, получен Content-Type: ${contentType || "без заголовка"}.`,
        "invalid-response",
        { url, status: response.status },
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw fail("Тело ответа не является корректным JSON.", "invalid-response", {
        url,
        status: response.status,
        cause: error,
      });
    }
  }

  function toFetchError(error, url, externalSignal) {
    if (externalSignal?.aborted) {
      return fail("Запрос отменён вызывающим кодом.", "aborted", { url, cause: error });
    }

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return fail("Истекло время ожидания ответа API.", "timeout", { url, cause: error });
    }

    return fail("Не удалось получить ответ от API по сети.", "network", { url, cause: error });
  }

  async function toHttpError(response, url) {
    let payload = null;

    // Тело ошибки может быть не JSON: вид http и статус сохраняются в любом случае.
    try {
      const text = await response.text();
      payload = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }

    const { code, message, details } = readErrorPayload(payload);

    return fail(message ?? `Запрос завершился ошибкой HTTP ${response.status}.`, "http", {
      status: response.status,
      code,
      details,
      url,
    });
  }

  return { requestJson };
}