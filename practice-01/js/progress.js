"use strict";

const totalTasks = 10;
const completedTasks = 7;

// Проверка типов и числовых значений
if (
    typeof totalTasks !== "number" ||
    typeof completedTasks !== "number" ||
    !Number.isFinite(totalTasks) ||
    !Number.isFinite(completedTasks)
) {
    console.log("Ошибка: недопустимое числовое значение.");
}
// Проверка целых чисел
else if (!Number.isInteger(totalTasks) || !Number.isInteger(completedTasks)) {
    console.log("Ошибка: дробное количество.");
}
// Проверка отрицательных значений
else if (totalTasks < 0 || completedTasks < 0) {
    console.log("Ошибка: отрицательное количество.");
}
// Проверка верхней границы
else if (totalTasks > 1000) {
    console.log("Ошибка: превышена верхняя граница.");
}
// Проверка, что выполнено не больше общего количества
else if (completedTasks > totalTasks) {
    console.log("Ошибка: выполнено больше, чем существует.");
}
// Задач нет
else if (totalTasks === 0 && completedTasks === 0) {
    console.log("Задач пока нет");
}
else {
    const remainingTasks = totalTasks - completedTasks;
    const progress = completedTasks / totalTasks * 100;

    let status;

    if (completedTasks === 0) {
        status = "Не начато";
    } else if (completedTasks === totalTasks) {
        status = "Завершено";
    } else {
        status = "В работе";
    }

    console.log(`Всего задач: ${totalTasks}`);
    console.log(`Выполнено: ${completedTasks}`);
    console.log(`Осталось: ${remainingTasks}`);
    console.log(`Прогресс: ${progress.toFixed(1)}%`);
    console.log(`Статус: ${status}`);
}