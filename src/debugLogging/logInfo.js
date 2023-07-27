/* eslint-disable */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.log) {
    const logElement = document.getElementById('log');
    const message = document.createElement('p');
    message.textContent = request.log;
    logElement.appendChild(message);
  }
});
