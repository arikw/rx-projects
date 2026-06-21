# Rate-limited queue

Queue tasks and throttle their execute them

# Installation

```sh
npm install rate-limited-queue
```

# Usage

```js
const createQueue = require("rate-limited-queue");

const queue = createQueue(
  1000 /* time based sliding window */,
  10 /* max concurrent tasks in the sliding window */,
  15 /* global max concurrent tasks (Optional. Default is Infinity) */);

queue(() => { /* do something... */ });

const results = await queue([
  () => { /* do another thing */ },
  () => { /* and another thing */ }
]); // results = [value1, value2]
```

# Description

This library makes sure that there are limited tasks started in a certain "sliding time window" while the rest of the tasks wait.

## The algorithm
* RUNNING_TASKS = How many tasks have been started and didn't complete yet
* MAX_CONCURRENT_TASKS = How many tasks are allowed to run simultaneously
* STARTED_TASKS = How many tasks that has been started between now and X seconds ago
* AVAILABLE_SLOTS = (How many tasks are allowed to run in the sliding time window) - STARTED_TASKS
* When a task is finished, run a new task (if such exist) if the following holds true
  * RUNNING_TASKS < MAX_CONCURRENT_TASKS
  * AVAILABLE_SLOTS > 0
* If there're are more tasks that didn't start yet, but AVAILABLE_SLOTS is 0, do the previous step once again as soon as a slot is expected to be available
