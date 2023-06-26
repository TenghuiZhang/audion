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
      attachTo({targetId: iframeId});
    }
  } else if (method === 'WebAudio.contextCreated') {
    if (source.targetId) {
      globalData.audioIframeIdMap.set(
        params.context.contextId,
        source.targetId,
      );
    }
    console.log('audio -> iframe data is recorded');
  } else {
    console.log('Other event');
    console.log(method);
  }
});

function attachTo(params) {
  // Attach to the target we already know about
  chrome.debugger.attach(params, '1.3', async () => {
    // Tell CDP to connect to anything else it finds nested (e.g iframes)
    await chrome.debugger.sendCommand(params, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
    });

    // Enable WebAudio events
    await chrome.debugger.sendCommand(params, 'WebAudio.enable', {});
  });
}
