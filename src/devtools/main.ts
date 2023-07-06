import {runDevTool} from './devTool';
import {chrome} from '../chrome';
import {globalData} from '../utils/global';

/** Chrome tab to attach the debugger to. */
let {tabId} = chrome.devtools.inspectedWindow;
attachTo({tabId});

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  // When something we're already connected to connects to something
  // else, copy it and connect from the extension too
  if (method === 'Target.attachedToTarget') {
    const iframeId = params.targetInfo.targetId;
    if (!globalData.iframeTabIdMap.has(iframeId) && source.tabId) {
      globalData.iframeTabIdMap.set(iframeId, source.tabId);
      runDevTool({targetId: iframeId});
      // attachTo({targetId: iframeId});
    }
  } else if (method === 'WebAudio.contextCreated') {
    if (
      !globalData.audioIframeIdMap.has(params.context.contextId) &&
      source.targetId
    ) {
      console.log('This is web targetid');
      console.log(source.targetId);
      globalData.audioIframeIdMap.set(
        params.context.contextId,
        source.targetId,
      );
      // detachFrom({targetId: source.targetId});
      // runDevTool({targetId: source.targetId});
    } else {
      if (source.tabId && !globalData.checkedTabIdMap.has(source.tabId)) {
        detachFrom({tabId: source.tabId});
        globalData.checkedTabIdMap.add(source.tabId);
        console.log('Tab id is attached');
        console.log(globalData.checkedTabIdMap);
        runDevTool({tabId: source.tabId});
      }
    }
  } else {
    console.log('Other event');
    console.log(method);
  }
});

function attachTo(target: Chrome.DebuggerDebuggee) {
  // Attach to the target we already know about
  chrome.debugger.attach(target, '1.3', async () => {
    // Tell CDP to connect to anything else it finds nested (e.g
    // iframes)
    await chrome.debugger.sendCommand(target, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
    });

    // Enable WebAudio events
    await chrome.debugger.sendCommand(target, 'WebAudio.enable', {});
  });
}

async function detachFrom(target: Chrome.DebuggerDebuggee) {
  await chrome.debugger.sendCommand(target, 'WebAudio.disable', {});
  await chrome.debugger.detach(target);
}
