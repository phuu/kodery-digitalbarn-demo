var koderyUrl = function (token, path) {
  return 'http://api.kodery.com' + path + '?access_token=' + token;
};

var getFromKodery = function (token, cb) {

  var makeUrl = koderyUrl.bind(null, token);
  var xhr = new XMLHttpRequest();
  xhr.onload = function () {
    var data;
    try {
      data = JSON.parse(this.responseText);
    } catch (e) {
      return cb(new Error("Could not parse JSON."));
    }
    return cb(null, data);
  };
  xhr.open("get", makeUrl('/me/categories'), true);
  xhr.send();

};

document.addEventListener('DOMContentLoaded', function () {

  // Utils
  var $ = document.querySelector.bind(document);
  var $$ = document.querySelectorAll.bind(document);
  // TOMDLEBARS!
  String.template = function (str, obj) {
    return str.replace(
                /\{{{([^{}]*)\}}}/g,
                function (a, b) {
                  var r = obj[b];
                  return typeof r === 'string' || typeof r === 'number' ? r : '';
                }
              ).replace(
                /\{{([^{}]*)\}}/g,
                function (a, b) {
                  var r = obj[b];
                  return typeof r === 'string' || typeof r === 'number' ? String.escape(r) : '';
                }
              );
  };
  String.escape = (function () {
    var entities = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;'
    };
    return function (str) {
      if (typeof str !== "string") return str;
      return Object.keys(entities).reduce(function (str, entity) {
        var regex = new RegExp(entity, 'g');
        return str.replace(regex, entities[entity]);
      }, str);
    };
  }());

  /**
   * Authentication
   */
  var hash = window.location.hash;
  // Grab the access_token
  var match;
  var token = '';
  if (match = hash.match(/access_token=([a-z0-9]+)&/)) token = match[1];

  if (token) {
    $('.js-login').parentNode.removeChild($('.js-login'));
  }

  /**
   * Data
   */
  var categories = [];
  getFromKodery(token, function (err, data) {
    if (!data) return;
    categories = data;
    render(data);
  });

  /**
   * Search stuff
   */
  var searchFor = function (str) {
    return function (data) {
      return JSON.stringify(data).indexOf(str) > -1;
    };
  };

  var searchSnippet = function (str) {
    return function (matched, data) {
      var snippetMatch = (data.name.indexOf(str) > -1 ||
                         (data.description || '').indexOf(str) > -1);
      var matchingFragments = (data.fragments || []).filter(searchFor(str));
      if (snippetMatch && !matchingFragments.length) {
        matchingFragments = data.fragments;
      }
      if (snippetMatch || matchingFragments.length) {
        matched.push({
          name: data.name,
          description: data.description,
          fragments: matchingFragments
        });
      }
      return matched;
    };
  };


  var searchCat = function (str) {
    return function (matched, data) {
      var matchingSnippets = (data.snippets || []).reduce(searchSnippet(str), []);
      var matchingChildren = (data.children || []).reduce(searchCat(str), []);
      if (matchingSnippets.length || matchingChildren.length) {
        matched.push({
          snippets: matchingSnippets,
          children: matchingChildren
        });
      }
      return matched;
    };
  };

  var $searchInput = $('.js-search-input');
  $searchInput.addEventListener('keyup', function () {
    var searchText = $searchInput.value;
    render(categories.reduce(searchCat(searchText), []))
  });

  /**
   * Rendering
   */
  var templates = {
    snippet: $('#template-snippet').innerText,
    fragment: $('#template-fragment').innerText
  };
  var $output = $('.js-snippets');

  var renderFragment = function (outputStr, fragment) {
    return outputStr + '\n' + String.template(templates.fragment, fragment);
  };

  var renderSnippet = function (outputStr, snippet) {
    snippet.renderedFragments = snippet.fragments.reduce(renderFragment, '');
    return outputStr + '\n' + String.template(templates.snippet, snippet);
  };

  var renderCategory = function (outputStr, category) {
    var renderedSnippets = category.snippets.reduce(renderSnippet, outputStr);
    return (category.children || []).reduce(renderCategory, renderedSnippets);
  };

  var render = function (data) {
    $output.innerHTML = data.reduce(renderCategory, '');
  };

});