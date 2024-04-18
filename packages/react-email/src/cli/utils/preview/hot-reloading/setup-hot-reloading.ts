import type http from 'node:http';
import path from 'node:path';
import { Server as SocketServer, type Socket } from 'socket.io';
import { watch } from 'chokidar';
import debounce from 'debounce';
import type { HotReloadChange } from '../../../../utils/types/hot-reload-change';
import { createDependencyGraph } from './create-dependency-graph';

export const setupHotreloading = async (
  devServer: http.Server,
  emailDirRelativePath: string,
) => {
  let clients: Socket[] = [];
  const io = new SocketServer(devServer);

  io.on('connection', (client) => {
    clients.push(client);

    client.on('disconnect', () => {
      clients = clients.filter((item) => item !== client);
    });
  });

  const absolutePathToEmailsDirectory = path.resolve(
    process.cwd(),
    emailDirRelativePath,
  );
  const watcher = watch('', {
    ignoreInitial: true,
    cwd: absolutePathToEmailsDirectory
  });

  const exit = () => {
    void watcher.close();
  };
  process.on('SIGINT', exit);
  process.on('uncaughtException', exit);

  // used to keep track of all changes
  // and send them at once to the preview app through the web socket
  let changes = [] as HotReloadChange[];

  const reload = debounce(() => {
    // we detect these using the useHotreload hook on the Next app
    clients.forEach((client) => {
      client.emit('reload', changes);
    });

    changes = [];
  }, 150);

  const [dependencyGraph, updateDependencyGraph] = await createDependencyGraph(
    absolutePathToEmailsDirectory,
  );

  watcher.on('all', async (event, relativePathToChangeTarget) => {
    const file = relativePathToChangeTarget.split(path.sep);
    if (file.length === 0) {
      return;
    }
    await updateDependencyGraph(event, relativePathToChangeTarget);

    changes.push({
      event,
      filename: relativePathToChangeTarget,
    });

    const pathToChangeTarget = path.resolve(
      absolutePathToEmailsDirectory,
      relativePathToChangeTarget,
    );
    changes.push(
      ...(dependencyGraph[pathToChangeTarget]?.dependentPaths ?? []).map(
        (dependentPath) => ({
          event: 'change' as const,
          filename: path.relative(absolutePathToEmailsDirectory, dependentPath),
        }),
      ),
    );
    reload();
  });

  return watcher;
};
