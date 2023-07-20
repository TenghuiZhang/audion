import {runDevTool} from './devTool';
import {chrome} from '../chrome';
import {globalData} from '../utils/global';

/** Chrome tab to attach the debugger to. */
var {tabId} = chrome.devtools.inspectedWindow;
runDevTool({tabId});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  // When something we're already connected to connects to something else,
  // copy it and connect from the extension too
  if (method === 'Target.attachedToTarget') {
    const iframeId = params.targetInfo.targetId;
    if (!globalData.iframeTabIdMap.has(iframeId) && source.tabId) {
      globalData.iframeTabIdMap.set(iframeId, source.tabId);
      console.log('attach to ' + iframeId);
    }
  } else if (method === 'WebAudio.contextCreated') {
    if (source.targetId) {
      globalData.audioIframeIdMap.set(
        params.context.contextId,
        source.targetId,
      );
      console.log('audio -> iframe data is recorded');
    }
  } else {
    console.debug('Other event');
    console.debug(method);
  }
});
