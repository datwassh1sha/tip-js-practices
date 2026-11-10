export const demoTasks = [
  { id: 1, title: "Изучить функции", completed: true, priority: "medium" },
  { id: 4, title: "Подготовить модель задач", completed: false, priority: "high" },
  { id: 7, title: "Проверить методы массивов", completed: false, priority: "low" },
  { id: 10, title: "Оформить README", completed: true, priority: "medium" },
];


function isValidTaskId(id) {
  return Number.isSafeInteger(id) && id > 0;
}

function setTaskCompleted(tasks, id, completed) {
  if (!isValidTaskId(id)) {
    return { ok: false, error: "Некорректный идентификатор задачи." };
  }

  if (typeof completed !== "boolean") {
    return { ok: false, error: "Статус должен быть true или false." };
  }

  const taskExists = tasks.some(task => task.id === id);

  if (!taskExists) {
    return { ok: false, error: "Задача не найдена." };
  }

  const updatedTasks = tasks.map(task =>
    task.id === id
      ? { ...task, completed }
      : task
  );

  return { ok: true, tasks: updatedTasks };
}


const result = setTaskCompleted(demoTasks, 4, true);

console.log("Исходный статус:", demoTasks.find(task => task.id === 4).completed);
console.log("Новый статус:", result.tasks.find(task => task.id === 4).completed);

const failedResult = setTaskCompleted(demoTasks, 777, true);

console.log("Результат отказа:", failedResult);
console.log("Исходный массив после отказа:", demoTasks);


export const variantTasks = [
    { id: 11, title: "Сформировать состав релиза", completed: true, priority: "high" },
    { id: 23, title: "Подготовить финальную сборку", completed: true, priority: "medium" },
    { id: 37, title: "Проверить работоспособность проекта", completed: true, priority: "high" },
    { id: 44, title: "Обновить номер версии", completed: true, priority: "medium" },
    { id: 56, title: "Подготовить описание изменений", completed: true, priority: "low" },
    { id: 68, title: "Опубликовать учебный релиз", completed: true, priority: "high" },
];

export const variantNumber = 7;