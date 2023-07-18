import {chrome} from '../chrome';

/**
 * An error caused by a falsifiable assumption shown to be false.
 * @memberof Utils
 * @alias InvariantError
 */
export class InvariantError extends Error {
  /**
   * Create an InvariantError.
   * @param {string} message
   * @param {Array} args
   */
  constructor(message, args) {
    super();
    this._message = message;
    this._args = args;
  }

  /**
   * @type {string}
   */
  get message() {
    return this._message.replace(/%(%|\d+)/g, (match) => {
      if (match[1] === '%') {
        return '%';
      }
      return this._args[Number(match[1])];
    });
  }
}

/**
 * @param {boolean} test
 * @param {string} message
 * @param {Array} args
 * @memberof Utils
 * @alias invariant
 */
export function invariant(test, message, ...args) {
  if (!test) {
    throw new InvariantError(message, args);
  }
}

/**
 * Send console logging info to logInfo page
 * @param {string | object} message Error info
 */
export function debugLog(message) {
  console.log(message);
  chrome.runtime.sendMessage(
    {log: JSON.stringify(message)},
    function (response) {
      if (chrome.runtime.lastError) {
        // Please ignore this error if you haven't open the debugger log
        // inspect window in "Detail -> Extension options"
      } else {
        console.log(response);
      }
    },
  );
}
