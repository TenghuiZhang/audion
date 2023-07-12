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
    if (!globalData.iframeTabIdMap.has(iframeId)) {
      globalData.iframeTabIdMap.set(iframeId, source.tabId);
      console.debug('attach to ' + iframeId);
      attachTo({targetId: iframeId});
    }
  } else if (method === 'WebAudio.contextCreated') {
    if (source.targetId) {
      globalData.audioIframeIdMap.set(
        params.context.contextId,
        source.targetId,
      );
    }
    console.debug('audio -> iframe data is recorded');
  } else if (method === 'Page.frameDetached') {
    console.log('page.frameDetached');
    console.log(source);
    console.log(params);
  } else if (method === 'Page.frameAttached') {
    console.log('Page.frameAttached');
    console.log(source);
    console.log(params);
  } else {
    console.debug('Other event');
    console.debug(method);
  }
});

function attachTo(params) {
  // Attach to the target we already know about
  chrome.debugger.attach(params, '1.3', async () => {
    // Enable WebAudio events
    await chrome.debugger.sendCommand(params, 'WebAudio.enable', {});
    await chrome.debugger.sendCommand(params, 'Page.enable', {});
  });
}
