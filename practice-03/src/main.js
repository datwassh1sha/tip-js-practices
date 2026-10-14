import { demoTasks, variantTasks, variantNumber } from "./data.js";
import { findTaskById, setTaskCompleted, removeTask } from "./task-service.js";
import { getVisibleTasks } from "./task-selectors.js";
import { renderTaskList, renderSummary, renderEmptyState } from "./task-view.js";

const elements = {
  list: document.querySelector("#task-list"),
  filters: document.querySelector("#task-filters"),
  summary: document.querySelector("#task-summary"),
  empty: document.querySelector("#empty-message"),
  message: document.querySelector("#operation-message"),
  datasetLabel: document.querySelector("#dataset-label"),
};

// Готовая служебная часть: ?dataset=variant включает данные своего варианта.
// Наборы не смешиваются, редактировать код для переключения не требуется.
const isVariant = new URLSearchParams(window.location.search).get("dataset") === "variant";
const initialTasks = isVariant ? variantTasks : demoTasks;
let currentTasks = initialTasks.map((task) => ({ ...task }));
let currentFilter = "all";

elements.datasetLabel.textContent = isVariant
  ? `Индивидуальный вариант: ${variantNumber ?? "не указан"}`
  : "Общий контрольный набор";

function renderApp() {
  const visibleTasks = getVisibleTasks(currentTasks, currentFilter);

  renderTaskList(elements.list, visibleTasks);
  renderSummary(elements.summary, currentTasks, visibleTasks.length);
  renderEmptyState(elements.empty, currentTasks.length, visibleTasks.length);

  const filterButtons = elements.filters.querySelectorAll("button[data-filter]");

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}


function handleTaskListClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-action]");
  if (!button || !elements.list.contains(button)) return;

  const action = button.dataset.action;
  if (action !== "toggle" && action !== "delete") return;

  const card = button.closest("li[data-task-id]");
  if (!card) return;

  const id = Number(card.dataset.taskId);

  if (!Number.isSafeInteger(id) || id <= 0) {
    elements.message.textContent = "Некорректный идентификатор задачи.";
    return;
  }

  let result;

  if (action === "toggle") {
    const task = findTaskById(currentTasks, id);

    if (!task) {
      elements.message.textContent = "Задача не найдена.";
      return;
    }

    result = setTaskCompleted(currentTasks, id, !task.completed);
  } else {
    result = removeTask(currentTasks, id);
  }

  if (!result.ok) {
    elements.message.textContent =
      result.error || "Не удалось выполнить операцию.";
    return;
  }

  currentTasks = result.tasks;
  elements.message.textContent = "";

  renderApp();
  restoreTaskFocus(id, action);
}



function handleFilterClick(event) {
  if (!(event.target instanceof Element)) return;

  const button = event.target.closest("button[data-filter]");
  if (!button || !elements.filters.contains(button)) return;

  const filter = button.dataset.filter;

  if (!["all", "pending", "completed"].includes(filter)) return;

  currentFilter = filter;
  elements.message.textContent = "";
  renderApp();
}


// Готовая вспомогательная функция. Сохраняет понятную позицию клавиатурного фокуса
// после замены карточек. Если карточки больше нет, фокус получает активный фильтр.
function restoreTaskFocus(id, action) {
  const actionButton = elements.list.querySelector(
    `[data-task-id="${id}"] button[data-action="${action}"]`,
  );
  const filterButton = elements.filters.querySelector(`[data-filter="${currentFilter}"]`);
  (actionButton ?? filterButton)?.focus();
}

// Подписки выполняются один раз. Эти контейнеры не заменяются при перерисовке.
elements.list.addEventListener("click", handleTaskListClick);
elements.filters.addEventListener("click", handleFilterClick);

// До реализации renderApp ожидается сообщение о заглушке.
// try/catch здесь — готовая диагностика старта, а не замена проверки result.ok.
try {
  renderApp();
} catch (error) {
  elements.message.textContent = `Ошибка запуска: ${error.message}`;
  console.error(error);
}
