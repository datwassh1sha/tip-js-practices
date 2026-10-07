import { demoTasks, variantNumber, variantTasks } from "./data.js";

import {
    createTask,
    findTaskById,
    getPendingTasks,
    getTaskTitles,
    getTaskStats,
    addTask,
    setTaskCompleted,
    renameTask,
    removeTask,
} from "./task-service.js";

function showStats(tasks) {
    const { total, completed, pending, progress } = getTaskStats(tasks);

    console.log(`Всего: ${total}; выполнено: ${completed}; осталось: ${pending}`);

    if (total === 0) {
        console.log("Задач пока нет");
    } else {
        console.log(`Прогресс: ${progress.toFixed(1)}%`);
    }
}

console.log("ПР2. Демонстрационный сценарий");

console.log("Исходные задачи:");
console.table(demoTasks);

console.log("Названия:");
console.log(getTaskTitles(demoTasks));

console.log("Невыполненные задачи:");
console.table(getPendingTasks(demoTasks));

console.log("Исходная сводка:");
showStats(demoTasks);

let currentTasks = demoTasks;

console.log("\n1. Добавление задачи");

let result = addTask(
    currentTasks,
    20,
    "Добавить проверку",
    "high"
);

if (result.ok) {
    currentTasks = result.tasks;
    console.table(currentTasks);
    showStats(currentTasks);
} else {
    console.error(`Ошибка: ${result.error}`);
}

console.log("\n2. Выполнение задачи id = 4");

result = setTaskCompleted(currentTasks, 4, true);

if (result.ok) {
    currentTasks = result.tasks;
    console.table(currentTasks);
    showStats(currentTasks);
} else {
    console.error(`Ошибка: ${result.error}`);
}

console.log("\n3. Переименование задачи id = 10");

result = renameTask(
    currentTasks,
    10,
    "Подготовить инструкцию запуска"
);

if (result.ok) {
    currentTasks = result.tasks;
    console.table(currentTasks);
    showStats(currentTasks);
} else {
    console.error(`Ошибка: ${result.error}`);
}

console.log("\n4. Удаление задачи id = 7");

result = removeTask(currentTasks, 7);

if (result.ok) {
    currentTasks = result.tasks;
    console.table(currentTasks);
    showStats(currentTasks);
} else {
    console.error(`Ошибка: ${result.error}`);
}

console.log("\n5. Проверка обработанной ошибки");

result = addTask(
    currentTasks,
    4,
    "Дубликат",
    "low"
);

if (result.ok) {
    currentTasks = result.tasks;
} else {
    console.error(`Ошибка: ${result.error}`);
}

console.log("\nСостояние после ошибочной операции:");
console.table(currentTasks);
showStats(currentTasks);

console.log("\n6. Проверка сохранности demoTasks");

console.table(demoTasks);
showStats(demoTasks);

console.log("\nИтоговые идентификаторы:");
console.log(currentTasks.map(task => task.id));

console.log("\nВариант:", variantNumber);
console.log("Количество задач варианта:", variantTasks.length);