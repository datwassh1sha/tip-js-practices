import { ApiError } from "./api-client.js";
import { validateTaskDraft } from "./form-validation.js";

export function messageForError(error) {
  if (!(error instanceof ApiError)) return "Не удалось выполнить операцию.";
  if (error.kind === "timeout") return "Сервер не ответил вовремя. Попробуйте ещё раз.";
  if (error.kind === "network") return "Нет соединения с учебным API. Проверьте, запущен ли npm start.";
  if (error.kind === "invalid-response") return "Сервер вернул ответ неожиданного формата.";
  if (error.kind === "http" && error.status === 404) return "Запись уже отсутствует на сервере. Обновите список.";
  if (error.kind === "http") return error.message || `Сервер вернул ошибку ${error.status}.`;
  return "Не удалось выполнить операцию.";
}

// view — адаптер из dom-app.js. Контроллер не должен обращаться к document.
// Обязательные методы результата:
// start, applyFilters, refresh, submit, beginEdit, cancelEdit,
// toggleTask, deleteTask, resetData и destroy.
export function createAppController({ api, view, validateDraft = validateTaskDraft } = {}) {
  if (!api || typeof api !== "object") {
    throw new TypeError("createAppController ожидает объект api.");
  }

  const requiredMethods = ["getTasks", "createTask", "updateTask", "setTaskCompleted", "deleteTask", "resetDemoData"];
  for (const name of requiredMethods) {
    if (typeof api[name] !== "function") {
      throw new TypeError(`api должен содержать метод ${name}.`);
    }
  }

  if (typeof api.loadInitialData !== "function") {
    throw new TypeError("api должен содержать метод loadInitialData.");
  }

  if (!view || typeof view !== "object") {
    throw new TypeError("createAppController ожидает объект view.");
  }

  let tasks = [];
  let categories = [];
  let filters = {};
  let editingId = null;
  let activeController = null;
  // Номер последней загрузки: устаревший ответ не должен менять интерфейс.
  let loadSequence = 0;
  let categoriesLoaded = false;
  let mutationPending = false;

  function signalFor() {
    return activeController ? activeController.signal : undefined;
  }

  function isAborted(error) {
    return error instanceof ApiError && error.kind === "aborted";
  }

  function renderList() {
    view.setTasks(tasks, categories);
    view.setTotal(tasks.length);

    if (tasks.length === 0) {
      view.setListState("empty");
    } else {
      view.setListState("ready");
    }
  }

  function cancelActiveLoad() {
    if (activeController) {
      activeController.abort();
      activeController = null;
    }
  }

  async function loadInitial(currentFilters) {
    const sequence = ++loadSequence;
    cancelActiveLoad();
    const controller = new AbortController();
    activeController = controller;

    view.setListState("loading");

    try {
      const result = await api.loadInitialData(currentFilters, { signal: controller.signal });

      // Ответ устаревшей загрузки игнорируется, даже если сигнал не сработал.
      if (sequence !== loadSequence) return;

      tasks = result.tasks;
      categories = result.categories;
      categoriesLoaded = true;
      view.setCategories(categories);
      renderList();
    } catch (error) {
      if (sequence !== loadSequence) return;
      // Отмена — ожидаемое управление потоком, а не пользовательская ошибка.
      if (isAborted(error)) return;
      view.setListState("error", messageForError(error));
    } finally {
      if (sequence === loadSequence) activeController = null;
    }
  }

  async function loadCurrentTasks(currentFilters) {
    const sequence = ++loadSequence;
    cancelActiveLoad();
    const controller = new AbortController();
    activeController = controller;

    view.setListState("loading");

    try {
      const result = await api.getTasks(currentFilters, { signal: controller.signal });

      if (sequence !== loadSequence) return;

      tasks = result.tasks;
      renderList();
    } catch (error) {
      if (sequence !== loadSequence) return;
      if (isAborted(error)) return;
      view.setListState("error", messageForError(error));
    } finally {
      if (sequence === loadSequence) activeController = null;
    }
  }

  async function loadWith(currentFilters) {
    // Пока категории не получены, повторная загрузка снова начальная.
    if (!categoriesLoaded) {
      await loadInitial(currentFilters);
      return;
    }
    await loadCurrentTasks(currentFilters);
  }

  // Общая схема изменяющей операции: блокировка, запрос, уведомление, перезагрузка.
  async function runMutation(action, successMessage) {
    if (mutationPending) return;

    mutationPending = true;
    view.setMutationPending(true);

    try {
      await action();
      view.notify(successMessage, "success");
      await loadWith(filters);
    } catch (error) {
      if (!isAborted(error)) {
        view.notify(messageForError(error), "error");
      }
    } finally {
      mutationPending = false;
      view.setMutationPending(false);
    }
  }

  return {
    async start(initialFilters = {}) {
      // Поля фильтров выставляет dom-app.js; контроллер хранит только значение.
      filters = { ...initialFilters };
      await loadInitial(filters);
    },

    async applyFilters(nextFilters = {}) {
      filters = { ...nextFilters };
      await loadWith(filters);
    },

    async refresh() {
      await loadWith(filters);
    },

    async submit(draft) {
      const result = validateDraft(draft, categories);

      if (!result.valid) {
        view.showFormErrors(result.errors);
        return;
      }

      view.showFormErrors({});

      if (editingId !== null) {
        const id = editingId;
        await runMutation(
          () => api.updateTask(id, result.value),
          "Задача изменена.",
        );
        editingId = null;
        view.setFormTask(null);
        return;
      }

      await runMutation(
        () => api.createTask(result.value),
        "Задача добавлена.",
      );
      // Форма очищается только после успешного создания.
      view.setFormTask(null);
    },

    beginEdit(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        view.notify("Задача не найдена в текущем списке.", "error");
        return;
      }

      editingId = task.id;
      view.setFormTask(task);
      view.showFormErrors({});
    },

    cancelEdit() {
      editingId = null;
      view.setFormTask(null);
      view.showFormErrors({});
    },

    async toggleTask(id) {
      const task = tasks.find((item) => item.id === id);
      if (!task) {
        view.notify("Задача не найдена в текущем списке.", "error");
        return;
      }

      await runMutation(
        () => api.setTaskCompleted(id, !task.completed),
        task.completed ? "Задача возвращена в работу." : "Задача отмечена выполненной.",
      );

      if (editingId === id && !tasks.some((item) => item.id === id)) {
        editingId = null;
        view.setFormTask(null);
      }
    },

    async deleteTask(id) {
      await runMutation(
        () => api.deleteTask(id),
        "Задача удалена.",
      );

      // Если удалялась редактируемая задача, форма возвращается в режим создания.
      if (editingId === id) {
        editingId = null;
        view.setFormTask(null);
      }
    },

    async resetData() {
      await runMutation(
        () => api.resetDemoData(),
        "Учебные данные восстановлены.",
      );
      this.cancelEdit();
    },

    destroy() {
      loadSequence += 1;
      cancelActiveLoad();
    },
  };
}