// Заготовка модуля. throw ниже отмечает отсутствие реализации,
// а не способ обработки некорректных данных в готовом решении.
// Для предусмотренных ошибок необходимо возвращать { ok: false, error: "..." }.
// console.log(), prompt(), document и чтение внешнего состояния здесь не нужны.

function isValidId(id) {
    return typeof id === "number"
        && Number.isSafeInteger(id)
        && id > 0;
}

export function createTask(id, title, priority = "medium") {
    if (!isValidId(id)) {
        return { ok: false, error: "Некорректный id" };
    }

    if (typeof title !== "string") {
        return { ok: false, error: "Название задачи должно быть строкой" };
    }

    const cleanTitle = title.trim();

    if (cleanTitle.length < 1 || cleanTitle.length > 100) {
        return { ok: false, error: "Название должно содержать от 1 до 100 символов" };
    }

    if (priority !== "low" && priority !== "medium" && priority !== "high") {
        return { ok: false, error: "Некорректный приоритет" };
    }

    return {
        ok: true,
        task: {
            id: id,
            title: cleanTitle,
            completed: false,
            priority: priority
        }
    };
}

export function findTaskById(tasks, id) {
    return tasks.find(task => task.id === id);
}

export function getPendingTasks(tasks) {
    return tasks.filter(task => task.completed === false);
}

export function getTaskTitles(tasks) {
    return tasks.map(task => task.title);
}

export function getTaskStats(tasks) {
    const total = tasks.length;
    let completed = 0;

    for (const task of tasks) {
        if (task.completed === true) {
            completed += 1;
        }
    }

    const pending = total - completed;

    let progress = 0;

    if (total > 0) {
        progress = completed / total * 100;
    }

    return {
        total: total,
        completed: completed,
        pending: pending,
        progress: progress
    };
}

export function addTask(tasks, id, title, priority = "medium") {
    if (!isValidId(id)) {
        return { ok: false, error: "Некорректный id" };
    }

    if (tasks.some(task => task.id === id)) {
        return { ok: false, error: "Задача с таким id уже существует" };
    }

    const result = createTask(id, title, priority);

    if (!result.ok) {
        return result;
    }

    return {
        ok: true,
        tasks: [...tasks, result.task]
    };
}

export function setTaskCompleted(tasks, id, completed) {
    if (!isValidId(id)) {
        return { ok: false, error: "Некорректный id" };
    }

    if (typeof completed !== "boolean") {
        return {
            ok: false,
            error: "completed должен быть логическим значением"
        };
    }

    if (!tasks.some(task => task.id === id)) {
        return { ok: false, error: "Задача не найдена" };
    }

    return {
        ok: true,
        tasks: tasks.map(task => {
            if (task.id === id) {
                return {
                    ...task,
                    completed
                };
            }

            return task;
        })
    };
}

export function renameTask(tasks, id, title) {
    if (!isValidId(id)) {
        return { ok: false, error: "Некорректный id" };
    }

    if (typeof title !== "string") {
        return {
            ok: false,
            error: "Название задачи должно быть строкой"
        };
    }

    const cleanTitle = title.trim();

    if (cleanTitle.length < 1 || cleanTitle.length > 100) {
        return {
            ok: false,
            error: "Название должно содержать от 1 до 100 символов"
        };
    }

    if (!tasks.some(task => task.id === id)) {
        return { ok: false, error: "Задача не найдена" };
    }

    return {
        ok: true,
        tasks: tasks.map(task => {
            if (task.id === id) {
                return {
                    ...task,
                    title: cleanTitle
                };
            }

            return task;
        })
    };
}

export function removeTask(tasks, id) {
    if (!isValidId(id)) {
        return { ok: false, error: "Некорректный id" };
    }

    if (!tasks.some(task => task.id === id)) {
        return { ok: false, error: "Задача не найдена" };
    }

    return {
        ok: true,
        tasks: tasks.filter(task => task.id !== id)
    };
}