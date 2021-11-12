import * as dagre from 'dagre';
import * as graphlib from 'graphlib';
import {ProtocolMapping} from 'devtools-protocol/types/protocol-mapping';
import {
  EMPTY,
  isObservable,
  merge,
  Observable,
  of,
  OperatorFunction,
  pipe,
  Subscription,
} from 'rxjs';
import {map, filter, catchError, mergeMap} from 'rxjs/operators';

import {invariant} from '../utils/error';

import {
  WebAudioDebuggerEvent,
  WebAudioDebuggerEventParams,
} from '../chrome/DebuggerWebAudioDomain';

import {Audion} from './Types';
import {
  INITIAL_CONTEXT_REALTIME_DATA,
  WebAudioRealtimeData,
} from './WebAudioRealtimeData';

type MutableContexts = {
  [key: string]: {
    graphContext: Audion.GraphContext;
    realtimeDataGraphContext$: Observable<Audion.GraphContext>;
  };
};

interface EventHelpers {
  realtimeData: WebAudioRealtimeData;
}

type EventHandlers = {
  readonly [K in WebAudioDebuggerEvent]: (
    helpers: EventHelpers,
    contexts: MutableContexts,
    event: ProtocolMapping.Events[K][0],
  ) => Observable<Audion.GraphContext> | Audion.GraphContext | void;
};

const EVENT_HANDLERS: Partial<EventHandlers> = {
  [WebAudioDebuggerEvent.audioNodeCreated]: (
    helpers,
    contexts,
    audioNodeCreated,
  ) => {
    const context = contexts[audioNodeCreated.node.contextId].graphContext;
    context.nodes[audioNodeCreated.node.nodeId] = {
      node: audioNodeCreated.node,
      params: [],
      edges: [],
    };
    const {nodeId} = audioNodeCreated.node;
    context.graph.setNode(nodeId, {
      id: nodeId,
      label: audioNodeCreated.node.nodeType,
      type: audioNodeCreated.node.nodeType,
      color: null,
      width: 150,
      height: 50,
    });
    return context;
  },

  [WebAudioDebuggerEvent.audioNodeWillBeDestroyed]: (
    helpers,
    contexts,
    audioNodeDestroyed,
  ) => {
    const context = contexts[audioNodeDestroyed.contextId].graphContext;
    context.graph.removeNode(audioNodeDestroyed.nodeId);
    delete context.nodes[audioNodeDestroyed.nodeId];
    return context;
  },

  [WebAudioDebuggerEvent.audioParamCreated]: (
    helpers,
    contexts,
    audioParamCreated,
  ) => {
    const context = contexts[audioParamCreated.param.contextId].graphContext;
    const node = context.nodes[audioParamCreated.param.nodeId];
    if (!node) {
      return;
    }
    node.params.push(audioParamCreated.param);
    context.params[audioParamCreated.param.paramId] = audioParamCreated.param;
  },

  [WebAudioDebuggerEvent.audioParamWillBeDestroyed]: (
    helpers,
    contexts,
    audioParamWillBeDestroyed,
  ) => {
    const context = contexts[audioParamWillBeDestroyed.contextId].graphContext;
    const node = context.nodes[audioParamWillBeDestroyed.nodeId];
    if (node) {
      const index = node.params.findIndex(
        ({paramId}) => paramId === audioParamWillBeDestroyed.paramId,
      );
      if (index >= 0) {
        node.params.splice(index, 1);
      }
    }
  },

  [WebAudioDebuggerEvent.contextChanged]: (
    helpers,
    contexts,
    contextChanged,
  ) => {
    contexts[contextChanged.context.contextId].graphContext.context =
      contextChanged.context;
    return contexts[contextChanged.context.contextId].graphContext;
  },

  [WebAudioDebuggerEvent.contextCreated]: (
    helpers,
    contexts,
    contextCreated,
  ) => {
    const graph = new dagre.graphlib.Graph({multigraph: true});
    graph.setGraph({});
    graph.setDefaultEdgeLabel(() => {
      return {};
    });

    const contextId = contextCreated.context.contextId;
    const realtimeData$ = helpers.realtimeData.pollContext(contextId);

    contexts[contextCreated.context.contextId] = {
      graphContext: {
        id: contextId,
        context: contextCreated.context,
        realtimeData: INITIAL_CONTEXT_REALTIME_DATA,
        nodes: {},
        params: {},
        // TODO: dagre's graphlib typings are inaccurate, which is why we use
        // graphlib's types. Revert to dagre's types once the issue is fixed:
        // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/47439
        graph: graph as unknown as graphlib.Graph,
      },
      realtimeDataGraphContext$: realtimeData$.pipe(
        map((realtimeData) => {
          if (contexts[contextId]) {
            contexts[contextId].graphContext = {
              ...contexts[contextId].graphContext,
              realtimeData,
            };
            return contexts[contextId].graphContext;
          }
        }),
        filter((context): context is Audion.GraphContext => Boolean(context)),
        catchError((reason) => {
          console.error(
            `Error requesting realtime data context for ${contextId}.${
              reason ? `\n${reason.message}` : reason
            }`,
          );
          return EMPTY;
        }),
      ),
    };

    return merge(
      of(contexts[contextCreated.context.contextId].graphContext),
      contexts[contextCreated.context.contextId].realtimeDataGraphContext$,
    );
  },

  [WebAudioDebuggerEvent.contextWillBeDestroyed]: (
    helpers,
    contexts,
    contextDestroyed,
  ) => {
    delete contexts[contextDestroyed.contextId];

    return {
      id: contextDestroyed.contextId,
      context: null,
      realtimeData: null,
      nodes: null,
      params: null,
      graph: null,
    };
  },

  [WebAudioDebuggerEvent.nodeParamConnected]: (
    helpers,
    contexts,
    nodeParamConnected,
  ) => {
    const context = contexts[nodeParamConnected.contextId].graphContext;
    context.nodes[nodeParamConnected.sourceId].edges.push(nodeParamConnected);
    const {
      sourceId,
      sourceOutputIndex = 0,
      destinationId: destinationParamId,
    } = nodeParamConnected;
    const destinationId = context.params[destinationParamId].nodeId;
    context.graph.setEdge(
      `${sourceId}`,
      `${destinationId}`,
      {
        type: 'param',
        sourceOutputIndex,
        destinationInputIndex: -1,
        destinationParamId,
      },
      sourceOutputIndex.toString(),
    );
    return context;
  },

  [WebAudioDebuggerEvent.nodeParamDisconnected]: (
    helpers,
    contexts,
    nodesDisconnected,
  ) => {
    const context = contexts[nodesDisconnected.contextId].graphContext;
    const {edges} = context.nodes[nodesDisconnected.sourceId];
    const {sourceId, sourceOutputIndex = 0, destinationId} = nodesDisconnected;
    edges.splice(
      edges.findIndex(
        (edge) =>
          edge.destinationId === destinationId &&
          edge.sourceOutputIndex === sourceOutputIndex,
      ),
    );
    context.graph.removeEdge(
      sourceId,
      destinationId,
      sourceOutputIndex.toString(),
    );
    return context;
  },

  [WebAudioDebuggerEvent.nodesConnected]: (
    helpers,
    contexts,
    nodesConnected,
  ) => {
    const context = contexts[nodesConnected.contextId].graphContext;
    context.nodes[nodesConnected.sourceId].edges.push(nodesConnected);
    const {
      sourceId,
      sourceOutputIndex = 0,
      destinationId,
      destinationInputIndex = 0,
    } = nodesConnected;
    context.graph.setEdge(
      `${sourceId}`,
      `${destinationId}`,
      {
        type: 'node',
        sourceOutputIndex,
        destinationInputIndex,
        destinationParamId: '',
      },
      `${sourceOutputIndex},${destinationInputIndex}`,
    );
    return context;
  },

  [WebAudioDebuggerEvent.nodesDisconnected]: (
    helpers,
    contexts,
    nodesDisconnected,
  ) => {
    const context = contexts[nodesDisconnected.contextId].graphContext;
    const {edges} = context.nodes[nodesDisconnected.sourceId];
    const {
      sourceId,
      sourceOutputIndex = 0,
      destinationId,
      destinationInputIndex = 0,
    } = nodesDisconnected;
    edges.splice(
      edges.findIndex(
        (edge) =>
          edge.destinationId === destinationId &&
          edge.sourceOutputIndex === sourceOutputIndex &&
          edge.destinationInputIndex === destinationInputIndex,
      ),
    );
    context.graph.removeEdge(
      sourceId,
      destinationId,
      `${sourceOutputIndex},${destinationInputIndex}`,
    );
    return context;
  },
};

/**
 * Collect WebAudio debugger events into per context graphs.
 */
export function integrateWebAudioGraph(
  webAudioRealtimeData: WebAudioRealtimeData,
): OperatorFunction<Audion.WebAudioEvent, Audion.GraphContext> {
  const helpers = {realtimeData: webAudioRealtimeData};
  const contexts: MutableContexts = {};
  return pipe(
    mergeMap(({method, params}) => {
      if (EVENT_HANDLERS[method]) {
        const result = EVENT_HANDLERS[method]?.(
          helpers,
          contexts,
          params as WebAudioDebuggerEventParams<any>,
        );
        if (typeof result !== 'object' || result === null) return EMPTY;
        if (isObservable(result)) {
          return result;
        }
        return of(result);
      }
      return EMPTY;
    }),
  );
}
