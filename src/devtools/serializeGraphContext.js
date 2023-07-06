import dagre from 'dagre';
import {globalData} from '../utils/global';

/**
 * @param {Audion.GraphContext} graphContext
 * @return {Audion.GraphContext}
 */
export function serializeGraphContext(graphContext) {
  if (graphContext.graph) {
    return {
      ...graphContext,
      graph: dagre.graphlib.json.write(graphContext.graph),
      isIframe: globalData.audioIframeIdMap.has(graphContext.id),
    };
  }
  return graphContext;
}
