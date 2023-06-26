import Protocol from 'devtools-protocol';
import {bindCallback, concatMap, interval, Observable} from 'rxjs';
import {map, timeout} from 'rxjs/operators';

import {invariant} from '../utils/error';

import {chrome} from '../chrome';
import {WebAudioDebuggerMethod} from '../chrome/DebuggerWebAudioDomain';

import {Audion} from './Types';
import {bindChromeCallback} from '../utils/rxChrome';

import {globalData} from '../utils/global';

/**
 * Error messages returned by WebAudio.getRealtimeData devtool protocol method.
 */
export enum RealtimeDataErrorMessage {
  /** Error returned when a AudioContext cannot be find. */
  CANNOT_FIND = 'Cannot find BaseAudioContext with such id.',
  /** Error returned when realtime data is requested from an OfflineAudioContext. */
  REALTIME_ONLY = 'ContextRealtimeData is only avaliable for an AudioContext.',
}

interface RealtimeDataReason<Message extends RealtimeDataErrorMessage> {
  message: Message;
}

const id = chrome.devtools.inspectedWindow.tabId;

const sendCommand = bindChromeCallback<
  [{}, WebAudioDebuggerMethod.getRealtimeData, any?],
  [{realtimeData: Protocol.WebAudio.ContextRealtimeData}]
>(chrome.debugger.sendCommand, chrome.debugger);

export const INITIAL_CONTEXT_REALTIME_DATA = {
  callbackIntervalMean: 0,
  callbackIntervalVariance: 0,
  currentTime: 0,
  renderCapacity: 0,
} as Audion.ContextRealtimeData;

export class WebAudioRealtimeData {
  private readonly intervalMS = 1000;
  private readonly timeoutMS = 500;

  private readonly interval$ = interval(this.intervalMS);

  pollContext(contextId: string) {
    console.log('this is global data');
    console.log(globalData);
    console.log('this is contextId');
    console.log(contextId);
    var currentDebugeeId = {};
    currentDebugeeId = {tabId: id};
    if (globalData.audioIframeIdMap.has(contextId)) {
      var iframeId = globalData.audioIframeIdMap.get(contextId);
      if (globalData.iframeTabIdMap.has(iframeId)) {
        let targetTabId = {tabId: globalData.iframeTabIdMap.get(iframeId)};
        console.log('they are tab from global');
        console.log(targetTabId);
        console.log('Tab from inspect');
        console.log(currentDebugeeId);
        if (JSON.stringify(targetTabId) === JSON.stringify(currentDebugeeId)) {
          console.log('they are equal');
          // currentDebugeeId = { targetId: iframeId };
          currentDebugeeId = targetTabId;
        }
      }
    }
    console.log('This is current debugee id');
    console.log(currentDebugeeId);

    return this.interval$.pipe(
      concatMap(() =>
        sendCommand(currentDebugeeId, WebAudioDebuggerMethod.getRealtimeData, {
          contextId,
        }).pipe(
          timeout({first: this.timeoutMS}),
          map((result) => {
            invariant(
              result && result !== null,
              'ContextRealtimeData not returned for WebAudio context %0.',
              contextId,
            );
            return result.realtimeData;
          }),
        ),
      ),
    );
  }
}

export const WebAudioRealtimeDataReason = {
  parseReason(reason: any) {
    if (reason && reason.message && !reason.code) {
      try {
        reason = JSON.parse(reason.message);
      } catch (e) {}
    }
    return reason;
  },

  toString(reason: any) {
    return reason && reason.message ? reason.message : reason;
  },

  isRealtimeOnlyReason(
    reason: any,
  ): reason is RealtimeDataReason<RealtimeDataErrorMessage.REALTIME_ONLY> {
    return reason && reason.message === RealtimeDataErrorMessage.REALTIME_ONLY;
  },

  isCannotFindReason(
    reason: any,
  ): reason is RealtimeDataReason<RealtimeDataErrorMessage.CANNOT_FIND> {
    return reason && reason.message === RealtimeDataErrorMessage.CANNOT_FIND;
  },
};
