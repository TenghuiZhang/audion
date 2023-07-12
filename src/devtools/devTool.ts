import {merge} from 'rxjs';
import {
  map,
  scan,
  take,
  shareReplay,
  share,
  mergeMap,
  auditTime,
} from 'rxjs/operators';

import {Audion} from './Types';

import {DebuggerAttachEventController} from './DebuggerAttachEventController';
import {DevtoolsGraphPanel} from './DevtoolsGraphPanel';
import {serializeGraphContext} from './serializeGraphContext';
import {integrateWebAudioGraph} from './WebAudioGraphIntegrator';
import {WebAudioRealtimeData} from './WebAudioRealtimeData';
import {partitionMap} from './partitionMap';
import {DebuggerEventsObservable} from './DebuggerEvents';

export function runDevTool(targetId: Chrome.DebuggerDebuggee) {
  console.log('Running this targetId');
  console.log(targetId);

  let attachController = new DebuggerAttachEventController(targetId);

  const targetEvents$ = new DebuggerEventsObservable(attachController, {
    domain: 'target',
  });

  const pageEvent$ = new DebuggerEventsObservable(attachController, {
    domain: 'page',
  });

  const webAudioEvents$ = new DebuggerEventsObservable(attachController, {
    domain: 'webAudio',
  });

  const webAudioRealtimeData = new WebAudioRealtimeData();

  const serializedGraphContext$ = merge(
    pageEvent$,
    webAudioEvents$,
    targetEvents$,
    attachController.debuggerEvent$,
  ).pipe(
    integrateWebAudioGraph(webAudioRealtimeData),
    // Split graph contexts into an observable for each unique graph context id.
    partitionMap({
      getPartitionId: ({id}) => id,
      isPartitionComplete: ({context}) => context === null,
    }),
    // For each partition, start a timer on the first value in that partition but
    // emit the last value during that timer when the timer completes.
    map(auditTime(16)),
    // Merge all the partitions together.
    mergeMap((source) => source),
    map(serializeGraphContext),
    share(),
  );

  const allGraphs$ = merge(serializedGraphContext$).pipe(
    // Persistently observe web audio events and integrate events into context
    // objects. Collect those into an object of all current graphs.
    scan<Audion.GraphContext, {[key: string]: Audion.GraphContext}>(
      (allGraphs, graphContext) => {
        if (graphContext.graph) {
          console.log('graphContext');
          console.log(graphContext);
          return {...allGraphs, [graphContext.id]: graphContext};
        }
        console.log('allGraphs');
        console.log(allGraphs);
        const {[graphContext.id]: _, ...otherGraphs} = allGraphs;
        console.log('otherGraphs');
        console.log(otherGraphs);
        return otherGraphs;
      },
      {},
    ),
    shareReplay(),
  );

  // There must be at least one subscription to keep allGraphs$ up to date if
  // panel is connected or otherwise.
  allGraphs$.subscribe();

  // When the panel is opened it'll connect to the devtools page, immediately send
  // the current set of graphs.
  const panel = new DevtoolsGraphPanel(
    merge(
      allGraphs$.pipe(
        map((allGraphs) => ({allGraphs})),
        take(1),
      ),
      serializedGraphContext$.pipe(map((graphContext) => ({graphContext}))),
    ),
  );

  // When the panel is first shown, grant attachController permission to attach to
  // the debugger.
  panel.onPanelShown$.pipe(take(1)).subscribe({
    next() {
      attachController.permission$.grantTemporary();
    },
  });

  // Respond to requests from the panel accordingly.
  panel.requests$.subscribe({
    next(value) {
      if (value.type === Audion.DevtoolsRequestType.COLLECT_GARBAGE) {
        attachController.sendCommand('HeapProfiler.collectGarbage').subscribe();
      }
    },
  });
}
