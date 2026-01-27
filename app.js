/**
 * Smart Ring Decision Tool - Application Logic & UI
 * Oura Ring 4 vs RingConn Gen 2
 * Persistence via localStorage for GitHub Pages and mobile.
 */

(function(global) {
  'use strict';

  var STORAGE_KEY = 'smart_ring_decision_data';

  var questions = [];
  var categories = [];
  var currentIndex = 0;
  var ratings = {};
  var preferences = {};

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.ratings) ratings = data.ratings;
        if (data.preferences) preferences = data.preferences;
        if (typeof data.currentIndex === 'number') currentIndex = Math.min(Math.max(0, data.currentIndex), questions.length - 1);
      }
    } catch (e) {
      ratings = {};
      preferences = {};
      currentIndex = 0;
    }
  }

  function saveToStorage() {
    try {
      var data = {
        ratings: ratings,
        preferences: preferences,
        currentIndex: currentIndex,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function getAnsweredCount() {
    var n = 0;
    for (var id in ratings) {
      if (ratings[id] !== undefined && ratings[id] !== 'SKIP') n++;
    }
    return n;
  }

  function showScreen(id) {
    var els = document.querySelectorAll('.screen');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.remove('active');
    }
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
  }

  function renderWelcome() {
    var count = getAnsweredCount();
    var existing = document.getElementById('existing-progress');
    var countEl = document.getElementById('existing-count');
    if (existing && countEl) {
      if (count > 0) {
        existing.style.display = 'block';
        countEl.textContent = count;
      } else {
        existing.style.display = 'none';
      }
    }
  }

  function renderProgress() {
    var count = getAnsweredCount();
    var total = questions.length;
    var pct = total > 0 ? Math.round((count / total) * 100) : 0;
    var fill = document.getElementById('progress-fill');
    var countSpan = document.getElementById('progress-count');
    var pctSpan = document.getElementById('progress-percent');
    if (fill) fill.style.width = pct + '%';
    if (countSpan) countSpan.textContent = count + ' of ' + total + ' questions answered';
    if (pctSpan) pctSpan.textContent = pct + '%';
  }

  function renderQuestion() {
    if (questions.length === 0) return;
    var q = questions[currentIndex];
    var textEl = document.getElementById('question-text');
    var idEl = document.getElementById('question-id');
    var contextEl = document.getElementById('question-context');
    var catNameEl = document.getElementById('category-name');
    var catProgressEl = document.getElementById('category-progress');

    if (textEl) textEl.textContent = q.question;
    if (idEl) idEl.textContent = q.id;
    if (contextEl) contextEl.textContent = q.context || '';
    var inCat = questions.filter(function(x) { return x.categoryId === q.categoryId; });
    var idxInCat = inCat.findIndex(function(x) { return x.id === q.id; }) + 1;
    if (catNameEl) catNameEl.textContent = (categories.find(function(c) { return c.id === q.categoryId; }) || {}).name || q.categoryId;
    if (catProgressEl) catProgressEl.textContent = 'Question ' + idxInCat + ' of ' + inCat.length;

    var neutralDiv = document.getElementById('neutral-preference');
    if (neutralDiv) {
      if (q.favors === 'NEUTRAL') {
        neutralDiv.style.display = 'block';
      } else {
        neutralDiv.style.display = 'none';
      }
    }

    var ratingVal = ratings[q.id];
    var btns = document.querySelectorAll('.rating-btn');
    for (var i = 0; i < btns.length; i++) {
      var v = parseInt(btns[i].getAttribute('data-value'), 10);
      btns[i].classList.remove('selected');
      if (ratingVal !== undefined && ratingVal !== 'SKIP' && v === ratingVal) {
        btns[i].classList.add('selected');
      }
    }

    var selectedText = document.getElementById('selected-rating-text');
    if (selectedText) {
      if (ratingVal === 'SKIP') {
        selectedText.textContent = 'Skipped';
      } else if (ratingVal !== undefined) {
        selectedText.textContent = 'Selected: ' + ratingVal + '/10';
      } else {
        selectedText.textContent = '';
      }
    }

    var prevBtn = document.getElementById('prev-btn');
    var nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.disabled = currentIndex >= questions.length - 1;

    renderProgress();
  }

  function ratingLabel(val) {
    if (val === 0) return 'Not Important';
    if (val <= 2) return 'Very Low';
    if (val <= 4) return 'Low / Below Average';
    if (val === 5) return 'Moderate';
    if (val <= 7) return 'High';
    if (val <= 9) return 'Very High / Critical';
    if (val === 10) return 'Absolute Priority (Deal-breaker)';
    return '';
  }

  function buildCategoryList() {
    var container = document.getElementById('category-list');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var qs = questions.filter(function(q) { return q.categoryId === cat.id; });
      var answered = qs.filter(function(q) { return ratings[q.id] !== undefined && ratings[q.id] !== 'SKIP'; }).length;
      var div = document.createElement('div');
      div.className = 'category-list-item';
      div.innerHTML = '<strong>' + cat.name + '</strong><span>' + answered + ' / ' + qs.length + ' answered</span>';
      (function(idx) {
        var firstQ = questions.findIndex(function(q) { return q.categoryId === cat.id; });
        if (firstQ >= 0) {
          div.onclick = function() {
            currentIndex = firstQ;
            showScreen('questionnaire-screen');
            renderQuestion();
          };
        }
      })(i);
      container.appendChild(div);
    }
  }

  function formatRecommendationMessage(rec, scores) {
    var w = rec.winner === 'OURA' ? 'Oura Ring 4' : 'RingConn Gen 2';
    var l = rec.winner === 'OURA' ? 'RingConn Gen 2' : 'Oura Ring 4';
    if (rec.forced && rec.strength === 'FORCED') {
      return w + ' is your only viable option. Due to your requirement for ' + (rec.message || '') + ', ' + l + ' cannot meet your needs. ' + w + ' is recommended by necessity.';
    }
    if (rec.strength === 'STRONG') {
      return 'Based on your priorities, ' + w + ' is the clear choice. Your preferences strongly favor ' + w + ' across multiple categories. ' + l + ' would be a poor fit given your stated requirements.';
    }
    if (rec.strength === 'MODERATE') {
      return w + ' is the better choice for your needs. While both rings have merits, your priorities align more closely with ' + w + '\'s strengths. ' + l + ' falls short primarily in areas you rated highly.';
    }
    if (rec.strength === 'SLIGHT') {
      return w + ' has a slight edge based on your priorities. This is a close decision. Consider hands-on testing if possible.';
    }
    if (rec.strength === 'MARGINAL') {
      return 'Both rings are nearly equal matches. ' + w + ' has a marginal advantage, but either would serve you well. Your decision may come down to brand preference, availability, or aesthetics.';
    }
    return 'Recommendation: ' + w + '.';
  }

  function renderResults() {
    var container = document.getElementById('results-container');
    if (!container) return;

    var result = global.SmartRingAlgorithm.runAlgorithm(questions, categories, ratings, preferences);
    var scores = result.scores;
    var rec = result.recommendation;
    var conf = result.confidence;
    var sufficient = result.sufficiency.sufficient;
    var contradictions = result.contradictions || [];

    var html = '';

    if (!sufficient) {
      html += '<div class="results-section"><h2>Unable to generate reliable recommendation</h2>';
      html += '<p>You\'ve answered ' + result.answeredCount + ' questions across ' + result.categoriesWithAnswers + ' categories. For a reliable recommendation, please answer at least ' + (global.SmartRingAlgorithm.MIN_QUESTIONS || 30) + ' questions across ' + (global.SmartRingAlgorithm.MIN_CATEGORIES || 8) + '+ categories.</p>';
      html += '<p><strong>Priority categories to answer:</strong></p><ol><li>Data Accuracy & Validation</li><li>Sleep Tracking & Analysis</li><li>Subscription & Ongoing Costs</li><li>Battery Life & Power Management</li><li>Recovery & Readiness Assessment</li></ol></div>';
      container.innerHTML = html;
      return;
    }

    if (result.dealBreakers.conflict) {
      html += '<div class="results-section results-warning"><h2>Incompatible requirements detected</h2>';
      html += '<p>' + (result.dealBreakers.conflict_reason || '') + '</p>';
      html += '<p>No recommendation can be generated until this conflict is resolved. Consider which requirement is truly non-negotiable, or rate one of them below 10.</p></div>';
      container.innerHTML = html;
      return;
    }

    var winnerName = rec.winner === 'OURA' ? 'Oura Ring 4' : 'RingConn Gen 2';
    var loserName = rec.winner === 'OURA' ? 'RingConn Gen 2' : 'Oura Ring 4';

    html += '<div class="results-section results-summary">';
    html += '<h2>Recommendation Summary</h2>';
    html += '<p class="recommendation-winner">Recommended: <strong>' + winnerName + '</strong></p>';
    html += '<p>Confidence: <strong>' + (conf ? conf.label : 'N/A') + '</strong>' + (conf ? ' (' + Math.round(conf.score) + '%)' : '') + '</p>';
    html += '<p>Strength: <strong>' + (rec.strength || '') + '</strong></p>';
    html += '<p class="recommendation-message">' + formatRecommendationMessage(rec, scores) + '</p>';
    html += '</div>';

    html += '<div class="results-section">';
    html += '<h3>Score breakdown</h3>';
    html += '<p>Oura Ring 4: <strong>' + (scores.ouraPctWeighted != null ? scores.ouraPctWeighted.toFixed(1) : '') + '%</strong></p>';
    html += '<p>RingConn Gen 2: <strong>' + (scores.ringconnPctWeighted != null ? scores.ringconnPctWeighted.toFixed(1) : '') + '%</strong></p>';
    html += '<p>Differential: ' + (scores.differentialWeighted != null ? scores.differentialWeighted.toFixed(1) : '') + ' percentage points</p>';
    html += '<p>Questions answered: ' + result.answeredCount + ' of ' + questions.length + ' (' + Math.round((result.answeredCount / questions.length) * 100) + '%)</p>';
    html += '<p>Categories covered: ' + result.categoriesWithAnswers + ' of ' + categories.length + '</p>';
    html += '</div>';

    if (contradictions.length > 0) {
      html += '<div class="results-section results-warning"><h3>Potential conflicting priorities</h3>';
      html += '<p>You rated some opposing factors highly. Consider which matters more to you.</p></div>';
    }

    html += '<div class="results-section">';
    html += '<h3>Total cost of ownership (reference)</h3>';
    html += '<p>Oura: $349-$499 + subscription ($69.99/year). Year 5 total ~$699-$849.</p>';
    html += '<p>RingConn: $199-$299 one-time. Year 5 total $199-$299.</p>';
    html += '<p>5-year savings with RingConn: about $400-$650.</p>';
    html += '</div>';

    container.innerHTML = html;
  }

  var app = {
    init: function() {
      if (global.SmartRingQuestions) {
        questions = global.SmartRingQuestions.QUESTIONS || [];
        categories = global.SmartRingQuestions.CATEGORIES || [];
      }
      loadFromStorage();
      renderWelcome();
      renderProgress();
      showScreen('welcome-screen');
    },

    startQuestionnaire: function() {
      currentIndex = 0;
      showScreen('questionnaire-screen');
      renderQuestion();
    },

    continueQuestionnaire: function() {
      showScreen('questionnaire-screen');
      renderQuestion();
    },

    selectRating: function(val) {
      if (questions.length === 0) return;
      var q = questions[currentIndex];
      ratings[q.id] = val;
      saveToStorage();
      renderQuestion();
    },

    selectPreference: function(pref) {
      if (questions.length === 0) return;
      var q = questions[currentIndex];
      preferences[q.id] = pref === 'NONE' ? null : pref;
      saveToStorage();
      renderQuestion();
    },

    skipQuestion: function() {
      if (questions.length === 0) return;
      var q = questions[currentIndex];
      ratings[q.id] = 'SKIP';
      if (q.favors === 'NEUTRAL') preferences[q.id] = null;
      saveToStorage();
      app.nextQuestion();
    },

    nextQuestion: function() {
      if (currentIndex < questions.length - 1) {
        currentIndex++;
        showScreen('questionnaire-screen');
        renderQuestion();
        saveToStorage();
      }
    },

    previousQuestion: function() {
      if (currentIndex > 0) {
        currentIndex--;
        showScreen('questionnaire-screen');
        renderQuestion();
        saveToStorage();
      }
    },

    showCategoryList: function() {
      buildCategoryList();
      showScreen('category-list-screen');
    },

    returnToQuestionnaire: function() {
      showScreen('questionnaire-screen');
      renderQuestion();
    },

    viewResults: function() {
      renderResults();
      showScreen('results-screen');
    },

    resetProgress: function() {
      if (typeof confirm !== 'undefined' && !confirm('Clear all answers and start over?')) return;
      ratings = {};
      preferences = {};
      currentIndex = 0;
      saveToStorage();
      showScreen('welcome-screen');
      renderWelcome();
      renderProgress();
    }
  };

  global.app = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { app.init(); });
  } else {
    app.init();
  }
})(typeof window !== 'undefined' ? window : this);
