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

const ERROR_KINDS = new Set(["http", "network", "invalid-response", "timeout", "aborted"]);

function fail(message, kind, extra = {}) {
  return new ApiError(message, { kind, ...extra });
}

// Создаёт URL относительно baseUrl и добавляет непустые параметры query.
// Значения кодируются средствами URL и URLSearchParams, а не вручную.
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

  // baseUrl и path соединяются вручную, после чего адрес разбирается заново:
  // это сохраняет кириллицу и пробелы в уже существующем пути baseUrl.
  const url = new URL(`${base.origin}${basePath}/${suffix}`);

  for (const [name, value] of Object.entries(query)) {
    // Пропускаются только undefined, null и пустая строка:
    // false и 0 являются содержательными значениями фильтров.
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(name, String(value));
  }

  return url.href;
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

// fetchFn передаётся явно, чтобы модуль можно было проверить без реальной сети.
// Возвращаемый объект: { requestJson(path, { query, signal, timeoutMs } = {}) }.
export function createApiClient({
  baseUrl,
  fetchFn = globalThis.fetch,
  timeoutMs = 2000,
} = {}) {
  if (typeof baseUrl !== "string" || baseUrl.trim().length === 0) {
    throw new TypeError("baseUrl должен быть непустой строкой.");
  }

  // Нормализация baseUrl сразу на этапе фабрики: неверная конфигурация
  // должна выявляться при создании клиента, а не при первом запросе.
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

  async function requestJson(path, { query, signal, timeoutMs: perCallTimeout } = {}) {
    const timeout = perCallTimeout === undefined ? timeoutMs : perCallTimeout;
    if (!Number.isSafeInteger(timeout) || timeout <= 0) {
      throw new TypeError("timeoutMs должен быть положительным целым числом.");
    }

    const url = buildUrl(normalizedBaseUrl, path, query ?? {});
    const { signal: requestSignal, externalSignal } = signalFor(timeout, signal);

    let response;

    // Первый try охватывает только транспорт: HTTP-ошибка, созданная после
    // получения Response, не должна попасть сюда и превратиться в network.
    try {
      response = await fetchFn(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: requestSignal,
      });
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

    if (response.status === 204) {
      return null;
    }

    if (!response.ok) {
      throw await toHttpError(response, url);
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
      return fail("Запрос отменён вызывающим кодом.", "aborted", {
        url,
        cause: error,
      });
    }

    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      return fail("Истекло время ожидания ответа API.", "timeout", {
        url,
        cause: error,
      });
    }

    return fail("Не удалось получить ответ от API по сети.", "network", {
      url,
      cause: error,
    });
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

export { ERROR_KINDS };
