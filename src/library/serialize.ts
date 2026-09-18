/** Runs tasks one at a time, so a multi-file checkout does not start parallel gradle runs. */
export function serialize(): (task: () => Promise<unknown>) => Promise<unknown> {
  let tail: Promise<unknown> = Promise.resolve();

  return (task) => {
    tail = tail.then(task, task);

    return tail;
  };
}
