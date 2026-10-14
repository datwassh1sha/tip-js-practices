// Новый модуль ПР3. Вход: корректный массив задач и фильтр all/pending/completed.
// Результат: новый массив, исходный порядок и объекты сохраняются.

export function getVisibleTasks(tasks, filter) {
  if (filter === "pending") {
    return tasks.filter((task) => !task.completed);
  }

  if (filter === "completed") {
    return tasks.filter((task) => task.completed);
  }

  return [...tasks];
}


export function getTaskStats(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.completed).length;
  const active = total - completed;
  const highPriority = tasks.filter((task) => task.priority === "high").length;
  const mediumPriority = tasks.filter((task) => task.priority === "medium").length;

  return {
    total,
    completed,
    active,
    highPriority,
    mediumPriority,
  };
}
