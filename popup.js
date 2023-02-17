var searchBox = document.getElementById("searchBox");
var submitButton = document.getElementById("submitBtn");
const ERROR_SEARCH_TEXT_EMPTY = "Search text is empty";
const ERROR_NOT_LOGIN = "Please login ChatGPT first";
const ERROR_NO_RESULT_FOUND = "No result found";
const ID_RESULTS_LIST = "resultsListElement";
const ID_ERROR_ELEMENT = "error-element";
const CLASS_SEARCH_LIST = "search-result";
const CLASS_ERROR_PROMPT = "errorPrompt";
const CHATGPT_CONVERSATION_PREFIX = "https://chat.openai.com/chat/";

async function getCurrentTab() {
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

var current_tab = await getCurrentTab();

searchBox.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
      event.preventDefault();
      submitButton.click();
  }
});

submitButton.addEventListener("click", function() {
  let searchTerm = searchBox.value;
  clearResultsAndErrors();
  let resultsListElement = document.createElement("ul");
  resultsListElement.id = ID_RESULTS_LIST;
  document.body.appendChild(resultsListElement);

  if (!searchTerm) {
    addError(ERROR_SEARCH_TEXT_EMPTY);
    return;
  }

  
  function getToken() {
    return document.querySelector('#__NEXT_DATA__').textContent;
  }

  chrome.scripting.executeScript({
    target: {tabId: current_tab.id},
    func: getToken,
    args: [] 
  }, function(results) {
    if (!results || !results[0].result) {
      addError(ERROR_NOT_LOGIN);
      return;
    }

    let nextData = JSON.parse(results[0].result);
    let accessToken = "Bearer " + nextData.props.pageProps.accessToken;

    let offset = 0;
    var totalSearchResults = 0;
    retriveConvesations(accessToken, offset, searchTerm, resultsListElement, totalSearchResults);
  });
});

function retriveConvesations(accessToken, offset, searchTerm, resultsListElement, totalSearchResults) {
  let xhr = new XMLHttpRequest();
  let limit = 20;
  var totalCount;

  xhr.open("GET", "https://chat.openai.com/backend-api/conversations?offset=" + offset + "&limit=" + limit, true);
  xhr.setRequestHeader("Authorization", accessToken);
  xhr.onreadystatechange = function() {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      let response = JSON.parse(xhr.responseText);
      totalCount = response.total;
      if (totalCount === 0) noConversation = true;
      offset += limit;
      let searchResults = response.items
        .map(item => ({title: item.title, id: item.id}))
        .filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()));

      totalSearchResults += searchResults.length;

      searchResults.forEach(function(searchResult) {
        let resultItem = document.createElement("li");
        resultsListElement.appendChild(resultItem);
        let resultItemLink = document.createElement("a");
        resultItemLink.innerText = searchResult.title;
        resultItemLink.classList.add(CLASS_SEARCH_LIST);
        resultItemLink.addEventListener("click", function() {
          
          // Set the current window's location to the desired URL
          function navigateToConversation(chatgptPrefix, searchResultID) {
            window.location = chatgptPrefix + searchResultID;
          }

          chrome.scripting.executeScript({
            target: {tabId: current_tab.id},
            func: navigateToConversation,
            args: [CHATGPT_CONVERSATION_PREFIX, searchResult.id]
          });
        });

        resultItem.appendChild(resultItemLink);
      });
      if (offset < totalCount) {
        retriveConvesations(accessToken, offset, searchTerm, resultsListElement, totalSearchResults);
      } else {
        if (totalSearchResults === 0) {
          addError(ERROR_NO_RESULT_FOUND);
          return;
        }
      }
    }
  };
  xhr.send();
}

function clearResultsAndErrors() {
  let resultsListElement = document.getElementById(ID_RESULTS_LIST);
  if (resultsListElement) {
    resultsListElement.remove();
  }

  let errorElement = document.getElementById(ID_ERROR_ELEMENT);
  if (errorElement) {
    errorElement.remove();
  }
}

function addError(errorInfo) {
  let errorElement = document.createElement("div");
  errorElement.id = ID_ERROR_ELEMENT;
  errorElement.innerText = errorInfo;
  errorElement.classList.add(CLASS_ERROR_PROMPT);
  document.body.appendChild(errorElement);
}