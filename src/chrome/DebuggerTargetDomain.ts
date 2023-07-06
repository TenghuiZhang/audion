/**
 * @file
 * Strings passed to `chrome.debugger.sendCommand` and received from
 * `chrome.debugger.onEvent` callbacks.
 */

import {ProtocolMapping} from 'devtools-protocol/types/protocol-mapping';

/** @see https://chromedevtools.github.io/devtools-protocol/tot/Target/#methods */
export enum TargetDebuggerMethod {
  attachToTarget = 'Target.attachToTarget',
  closeTarget = 'Target.closeTarget',
  createTarget = 'Target.createTarget',
  detachFromTarget = 'Target.detachFromTarget',
  getTargets = 'Target.getTargets',
  sendMessageToTarget = 'Target.sendMessageToTarget',
  setDiscoverTargets = 'Target.setDiscoverTargets',
  setAutoAttach = 'Target.setAutoAttach',
}

/** @see https://chromedevtools.github.io/devtools-protocol/tot/Target/#events */
export enum TargetDebuggerEvent {
  attachedToTarget = 'Target.attachedToTarget',
  detachedFromTarget = 'Target.detachedFromTarget',
  receivedMessageFromTarget = 'Target.receivedMessageFromTarget',
  targetCreated = 'Target.targetCreated',
  targetDestroyed = 'Target.targetDestroyed',
  targetCrashed = 'Target.targetCrashed',
  targetInfoChanged = 'Target.targetInfoChanged',
}

/** @see https://chromedevtools.github.io/devtools-protocol/tot/Target/#types */
export type TargetDebuggerEventParams<Name extends TargetDebuggerEvent> =
  ProtocolMapping.Events[Name];
