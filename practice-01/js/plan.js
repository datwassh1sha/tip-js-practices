"use strict";

const totalTasks = 10;
const completedTasks = 7;
const dailyLimit = 3;

// Проверка totalTasks и completedTasks
if (
    typeof totalTasks !== "number" ||
    typeof completedTasks !== "number" ||
    !Number.isFinite(totalTasks) ||
    !Number.isFinite(completedTasks)
) {
    console.log("Ошибка: вместо числа передано недопустимое значение.");
}
else if (
    !Number.isInteger(totalTasks) ||
    !Number.isInteger(completedTasks)
) {
    console.log("Ошибка: количество задач должно быть целым.");
}
else if (totalTasks < 0 || completedTasks < 0) {
    console.log("Ошибка: отрицательное количество.");
}
else if (totalTasks > 1000) {
    console.log("Ошибка: превышена верхняя граница.");
}
else if (completedTasks > totalTasks) {
    console.log("Ошибка: выполнено больше, чем существует.");
}
// Проверка dailyLimit
else if (typeof dailyLimit !== "number" || !Number.isFinite(dailyLimit)) {
    console.log("Ошибка: дневная норма должна быть числом.");
}
else if (!Number.isInteger(dailyLimit)) {
    console.log("Ошибка: дробной дневной нормы быть не должно.");
}
else if (dailyLimit < 1) {
    console.log("Ошибка: дневная норма должна быть не меньше 1.");
}
else if (dailyLimit > 1000) {
    console.log("Ошибка: превышена верхняя граница нормы.");
}
else {
    let remainingTasks = totalTasks - completedTasks;
    let day = 0;

    console.log(`Осталось задач: ${remainingTasks}`);

    while (remainingTasks > 0) {
        day++;

        const tasksToday = Math.min(dailyLimit, remainingTasks);

        remainingTasks -= tasksToday;

        console.log(
            `День ${day}: выполнено ${tasksToday}, осталось ${remainingTasks}`
        );
    }

    if (day === 0) {
        console.log("Все задачи уже выполнены.");
    }

    console.log(`Потребуется дней: ${day}`);
}