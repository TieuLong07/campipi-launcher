export const IPC = {
  GET_STATE: 'launcher:get-state',
  SELECT_INSTANCE: 'launcher:select-instance',
  UPDATE_INSTANCE: 'launcher:update-instance',
  OPEN_FOLDER: 'launcher:open-folder',
  OPEN_LOG_MODAL: 'launcher:open-log-modal',
  CLEAR_LOG: 'launcher:clear-log',
  SAVE_LOG: 'launcher:save-log',
  SET_RAM: 'launcher:set-ram',
  CLEAN_CACHE: 'launcher:clean-cache',
  CLEANUP: 'launcher:cleanup',
  CHECK_UPDATE: 'launcher:check-update',
  LAUNCH: 'launcher:launch',
  KILL: 'launcher:kill',
  ON_LOG: 'launcher:on-log',
  ON_STATE: 'launcher:on-state',
} as const;

export type IpcChannel = typeof IPC[keyof typeof IPC];
