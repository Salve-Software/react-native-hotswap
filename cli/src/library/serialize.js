/** Runs tasks one at a time, so a multi-file checkout does not start parallel gradle runs. */
export function serialize() {
  let tail = Promise.resolve();

  return (task) => {
    tail = tail.then(task, task);

    return tail;
  };
}
