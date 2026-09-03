const backActions = [];

export const pushBackAction = (action) => {
  if (typeof action === 'function') backActions.push(action);
};

export const popBackAction = (action) => {
  const index = backActions.lastIndexOf(action);
  if (index !== -1) backActions.splice(index, 1);
};

export const runBackAction = async () => {
  const action = backActions[backActions.length - 1];
  if (!action) return false;
  await action();
  return true;
};
