/**
 * Smart Ring Decision Tool - Application Logic & UI
 * Oura Ring 4 vs RingConn Gen 2
 * Persistence via localStorage for GitHub Pages and mobile.
 */

(function (global) {
  'use strict';

  var STORAGE_KEY = 'smart_ring_decision_data';
  var NUM_SLOTS = 3;

  function getSlotKey(slotIndex) {
    return 'smart_ring_decision_slot_' + slotIndex;
  }

  var questions = [];
  var categories = [];
  var currentCategoryIndex = 0;
  var ratings = {};
  var preferences = {}; // For questions that need a tie-breaker
  var activeSlotIndex = 0; // 0 = none, 1..NUM_SLOTS = that slot is current

  function loadFromStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var data = JSON.parse(raw);
        if (data.ratings) ratings = data.ratings;
        if (data.preferences) preferences = data.preferences;
        if (typeof data.currentCategoryIndex === 'number') currentCategoryIndex = Math.min(Math.max(0, data.currentCategoryIndex), categories.length - 1);
        if (typeof data.activeSlotIndex === 'number' && data.activeSlotIndex >= 0 && data.activeSlotIndex <= NUM_SLOTS) activeSlotIndex = data.activeSlotIndex;
      }
    } catch (e) {
      ratings = {};
      preferences = {};
      currentCategoryIndex = 0;
      activeSlotIndex = 0;
    }
  }

  function saveToStorage() {
    try {
      var data = {
        ratings: ratings,
        preferences: preferences,
        currentCategoryIndex: currentCategoryIndex,
        savedAt: new Date().toISOString(),
        activeSlotIndex: activeSlotIndex
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { }
  }

  function getSlotSummary(slotIndex) {
    try {
      var raw = localStorage.getItem(getSlotKey(slotIndex));
      if (!raw) return null;
      var data = JSON.parse(raw);
      var count = 0;
      if (data.ratings && typeof data.ratings === 'object') {
        for (var k in data.ratings) { if (data.ratings[k] !== undefined) count++; }
      }
      return { count: count, savedAt: data.savedAt || null };
    } catch (e) {
      return null;
    }
  }

  function saveToSlot(slotIndex) {
    if (slotIndex < 1 || slotIndex > NUM_SLOTS) return;
    try {
      var data = {
        ratings: JSON.parse(JSON.stringify(ratings)),
        preferences: JSON.parse(JSON.stringify(preferences)),
        currentCategoryIndex: currentCategoryIndex,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(getSlotKey(slotIndex), JSON.stringify(data));
      activeSlotIndex = slotIndex;
      saveToStorage();
    } catch (e) { }
  }

  function loadSlot(slotIndex) {
    if (slotIndex < 1 || slotIndex > NUM_SLOTS) return;
    try {
      activeSlotIndex = slotIndex;
      var raw = localStorage.getItem(getSlotKey(slotIndex));
      if (!raw) {
        ratings = {};
        preferences = {};
        currentCategoryIndex = 0;
        saveToStorage();
        return;
      }
      var data = JSON.parse(raw);
      if (data.ratings) ratings = data.ratings;
      if (data.preferences) preferences = data.preferences;
      if (typeof data.currentCategoryIndex === 'number') currentCategoryIndex = Math.min(Math.max(0, data.currentCategoryIndex), categories.length - 1);
      saveToStorage();
    } catch (e) { }
  }

  function exportAsCsv() {
    var rows = ['questionId', 'questionText', 'categoryId', 'rating', 'preference'];
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var r = ratings[q.id] !== undefined ? ratings[q.id] : '';
      var p = (q.favors === 'NEUTRAL' && preferences[q.id]) ? preferences[q.id] : '';
      var text = (q.question || '').replace(/"/g, '""');
      rows.push([q.id, '"' + text + '"', q.categoryId || '', r, p].join(','));
    }
    var csv = rows.join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ring-chooser-answers-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function parseCsvRow(line) {
    var out = [];
    var inQuotes = false;
    var cur = '';
    for (var i = 0; i < line.length; i++) {
      var c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if ((c === ',' && !inQuotes) || c === '\r' || c === '\n') {
        out.push(cur);
        cur = '';
        if (c === '\r' || c === '\n') break;
      } else {
        cur += c;
      }
    }
    out.push(cur);
    return out;
  }

  function importFromCsv(file) {
    var reader = new FileReader();
    reader.onload = function (ev) {
      var text = (ev.target && ev.target.result) ? String(ev.target.result) : '';
      var lines = text.split(/\r?\n/).filter(function (l) { return l.trim().length > 0; });
      if (lines.length < 2) return;
      var header = parseCsvRow(lines[0]);
      var colQid = -1;
      var colRating = -1;
      var colPref = -1;
      for (var h = 0; h < header.length; h++) {
        var hd = (header[h] || '').toLowerCase().replace(/^\s*|\s*$/g, '');
        if (hd === 'questionid' || hd === 'question_id') colQid = h;
        if (hd === 'rating') colRating = h;
        if (hd === 'preference') colPref = h;
      }
      if (colQid < 0 || colRating < 0) return;
      var idSet = {};
      for (var j = 0; j < questions.length; j++) idSet[questions[j].id] = questions[j];
      var imported = 0;
      for (var i = 1; i < lines.length; i++) {
        var cells = parseCsvRow(lines[i]);
        var qid = (cells[colQid] || '').trim();
        if (!idSet[qid]) continue;
        var r = parseInt(cells[colRating], 10);
        if (r >= 0 && r <= 10) {
          ratings[qid] = r;
          imported++;
        }
        if (colPref >= 0 && idSet[qid].favors === 'NEUTRAL') {
          var p = (cells[colPref] || '').trim().toUpperCase();
          if (p === 'OURA' || p === 'RINGCONN' || p === 'NONE' || p === '') preferences[qid] = (p === 'NONE' || p === '') ? null : p;
        }
      }
      saveToStorage();
      renderWelcome();
      renderProgress();
      var container = document.getElementById('question-container');
      if (container && container.innerHTML) renderCategory();
      alert('Imported ' + imported + ' answers.');
    };
    reader.readAsText(file, 'UTF-8');
  }

  function randomizeAllAnswers() {
    var msg = 'This will overwrite all your current answers. If you want to keep them, export to CSV or save to a slot first. Continue?';
    if (!confirm(msg)) return;
    var blockerIds = (global.SmartRingAlgorithm && global.SmartRingAlgorithm.getBlockerQuestionIds)
      ? global.SmartRingAlgorithm.getBlockerQuestionIds() : [];
    var blockerSet = {};
    for (var b = 0; b < blockerIds.length; b++) blockerSet[blockerIds[b]] = true;
    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      var maxVal = blockerSet[q.id] ? 9 : 10;
      ratings[q.id] = Math.floor(Math.random() * (maxVal + 1));
      if (q.favors === 'NEUTRAL') {
        var choices = ['OURA', 'RINGCONN', null];
        preferences[q.id] = choices[Math.floor(Math.random() * 3)];
      }
    }
    currentCategoryIndex = 0;
    saveToStorage();
    renderWelcome();
    renderProgress();
    var active = document.querySelector('.screen.active');
    if (active && active.id === 'welcome-screen') renderWelcome();
    else if (active && (active.id === 'questionnaire-screen' || active.id === 'category-list-screen')) {
      showScreen('questionnaire-screen');
      renderCategory();
    } else if (active && active.id === 'results-screen') {
      renderResults();
    }
  }

  function getAnsweredCount() {
    var n = 0;
    for (var id in ratings) {
      if (ratings[id] !== undefined) {
        n++;
      }
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
    window.scrollTo(0, 0);
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
    if (typeof renderSlotsUI === 'function') renderSlotsUI();
  }

  function renderProgress() {
    // Update global progress bar based on categories
    var totalCategories = categories.length;
    var pct = (currentCategoryIndex / totalCategories) * 100;

    // If we are on the results screen or have answered everything, show 100%
    var resultsScreen = document.getElementById('results-screen');
    var isResults = resultsScreen && resultsScreen.classList.contains('active');
    var answered = getAnsweredCount();
    var totalQs = questions.length;

    if (isResults || (answered === totalQs && totalQs > 0)) {
      pct = 100;
    }

    var fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = pct + '%';

    var countSpan = document.getElementById('progress-count');
    var pctSpan = document.getElementById('progress-percent');

    if (countSpan) {
      if (pct === 100) {
        countSpan.textContent = 'Analysis Complete';
      } else {
        countSpan.textContent = 'Category ' + (currentCategoryIndex + 1) + ' of ' + totalCategories;
      }
    }
    if (pctSpan) pctSpan.textContent = Math.round(pct) + '%';
  }

  function renderCategoryNav() {
    var navContainer = document.getElementById('category-nav');
    if (!navContainer) return;

    var html = '';
    categories.forEach(function (cat, index) {
      var catQs = questions.filter(function (q) { return q.categoryId === cat.id; });
      var answered = catQs.filter(function (q) { return ratings[q.id] !== undefined; }).length;
      var pct = (answered / catQs.length) * 100;

      var isCurrent = index === currentCategoryIndex ? 'active' : '';
      var isCompleted = answered === catQs.length ? 'completed' : '';

      // SVG Circle Progress
      // Periphery = 2 * 3.14 * 18 = 113.04
      var circumference = 113.04;
      var offset = circumference - (pct / 100) * circumference;

      html += '<div class="cat-nav-item ' + isCurrent + ' ' + isCompleted + '" onclick="app.jumpToCategory(' + index + ')" title="' + cat.name + '">';
      html += '  <svg viewBox="0 0 40 40">';
      html += '    <circle class="cat-track" cx="20" cy="20" r="18" />';
      html += '    <circle class="cat-progress" cx="20" cy="20" r="18" style="stroke-dasharray: ' + circumference + '; stroke-dashoffset: ' + offset + ';" />';
      html += '  </svg>';
      html += '  <span class="cat-label">' + (index + 1) + '</span>';
      html += '</div>';
    });

    navContainer.innerHTML = html;

    // Update active category name label
    var nameLabel = document.getElementById('active-category-name');
    if (nameLabel && categories[currentCategoryIndex]) {
      nameLabel.textContent = (currentCategoryIndex + 1) + '. ' + categories[currentCategoryIndex].name;
    }

    // Auto-scroll to current category
    var activeItem = navContainer.querySelector('.cat-nav-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function cleanQuestionText(text) {
    if (!text) return "";
    var t = text.trim();
    var prefixes = [
      "How important is it to you that",
      "How important is it to you to",
      "How important is it that",
      "How important is it to",
      "How important is",
      "How much do you value",
      "How critical is",
      "How valuable is",
      "How concerned are you about",
      "How willing are you to",
      "If you were to",
      "Do you prefer",
      "Do you have",
      "Do you need",
      "Are you",
      "Is the",
      "Is"
    ];

    for (var i = 0; i < prefixes.length; i++) {
      var p = prefixes[i];
      var regex = new RegExp("^" + p + "\\s*", "i");
      if (regex.test(t)) {
        var result = t.replace(regex, "");
        if (result.length > 0) {
          t = result.charAt(0).toUpperCase() + result.slice(1);
          // If the last character is a question mark, keep it, otherwise add one if it was a question
          if (!t.endsWith('?') && text.includes('?')) t += '?';
          return t;
        }
      }
    }
    return t;
  }

  function renderCategory() {
    var cat = categories[currentCategoryIndex];
    if (!cat) return;

    var container = document.getElementById('question-container');
    if (!container) return; // Should not happen

    var catQuestions = questions.filter(function (q) {
      return q.categoryId === cat.id;
    });

    var html = '';

    if (cat.description) {
      html += '<div class="category-description" style="margin-bottom: 24px; text-align: center; color: var(--text-muted); font-size: 0.95rem;">' + cat.description + '</div>';
    }

    html += '<div class="category-intro">';
    html += '  <p style="font-weight: 600;">How important are these factors to you?</p>';
    html += '</div>';

    html += '<div class="category-group-container">';

    catQuestions.forEach(function (q) {
      if (ratings[q.id] === undefined) {
        ratings[q.id] = 5;
      }
      var currentRating = ratings[q.id];
      var cleanText = cleanQuestionText(q.question);

      html += '<div class="question-row" id="q-row-' + q.id + '">';
      html += '  <div class="question-text-compact">' + cleanText + '</div>';

      if (q.context) {
        html += '  <div class="question-context-compact">' + q.context + '</div>';
      }

      // Rating Controls (0-10)
      html += '  <div class="rating-scale">';
      for (var i = 0; i <= 10; i++) {
        var isSelected = currentRating === i ? 'selected' : '';
        html += '<button class="rating-btn ' + isSelected + '" data-value="' + i + '" onclick="app.setRating(\'' + q.id + '\', ' + i + ')">' + i + '</button>';
      }
      html += '  </div>';

      // Preference Toggle (if Neutral flavor)
      if (q.favors === 'NEUTRAL') {
        var currentPref = preferences[q.id];
        var selOura = currentPref === 'OURA' ? 'selected' : '';
        var selRC = currentPref === 'RINGCONN' ? 'selected' : '';
        var selNone = !currentPref ? 'selected' : '';

        html += '  <div class="neutral-preference" style="margin-top: 16px; padding: 16px; border: 1px dashed var(--border); background: var(--box-bg-alt); display: block;">';
        html += '    <label style="margin-bottom: 8px; display: block; font-size: 0.8rem; font-weight: 700;">Which ring do you prefer for this?</label>';
        html += '    <div style="display: flex; gap: 8px;">';
        html += '      <button class="btn btn-preference ' + selOura + '" style="flex:1; padding: 8px; font-size: 0.85rem;" onclick="app.setPreference(\'' + q.id + '\', \'OURA\')">Oura</button>';
        html += '      <button class="btn btn-preference ' + selRC + '" style="flex:1; padding: 8px; font-size: 0.85rem;" onclick="app.setPreference(\'' + q.id + '\', \'RINGCONN\')">RingConn</button>';
        html += '      <button class="btn btn-preference ' + selNone + '" style="flex:1; padding: 8px; font-size: 0.85rem;" onclick="app.setPreference(\'' + q.id + '\', \'NONE\')">No Pref</button>';
        html += '    </div>';
        html += '  </div>';
      }

      html += '</div>'; // end question-row
    });

    html += '</div>'; // end category-group-container

    // Simplified Navigation Footer
    html += '<div class="navigation-buttons" style="margin-top: 48px; display: flex; gap: 12px; justify-content: center;">';
    html += '  <button class="btn btn-secondary" style="flex: 1;" onclick="app.previousCategory()">' + (currentCategoryIndex === 0 ? 'Home' : 'Previous') + '</button>';
    html += '  <button class="btn btn-text" style="flex: 0.5;" onclick="app.skipCategory()">Skip</button>';
    var nextText = currentCategoryIndex === categories.length - 1 ? 'Finish' : 'Next';
    html += '  <button class="btn btn-primary" style="flex: 1;" onclick="app.nextCategory()">' + nextText + '</button>';
    html += '</div>';

    // Bottom Secondary Links
    html += '<div class="category-navigation" style="margin-top: 32px; border: none; padding-top: 0; display: flex; gap: 16px; justify-content: center;">';
    html += '  <button class="btn btn-text" onclick="app.showCategoryList()" style="font-size: 0.8rem; text-decoration: underline;">All Categories</button>';
    html += '  <button class="btn btn-text" onclick="app.viewResults()" style="font-size: 0.8rem; color: var(--text-main); text-decoration: underline;">View Results Now</button>';
    html += '</div>';

    container.innerHTML = html;
    window.scrollTo(0, 0);
    renderProgress();
    renderCategoryNav();
    saveToStorage();
  }

  function updateRatingDisplay(qid, val) {
    // Find the specific question row
    var qRow = document.getElementById('q-row-' + qid);
    if (qRow) {
      var buttons = qRow.querySelectorAll('.rating-btn');
      for (var i = 0; i < buttons.length; i++) {
        buttons[i].classList.remove('selected');
        if (parseInt(buttons[i].getAttribute('data-value'), 10) === val) {
          buttons[i].classList.add('selected');
        }
      }
    }
  }

  function updatePreferenceDisplay(qid, val) {
    var qRow = document.getElementById('q-row-' + qid);
    if (qRow) {
      var prefDiv = qRow.querySelector('.neutral-preference');
      if (prefDiv) {
        var prefBtns = prefDiv.querySelectorAll('.btn-preference');
        for (var i = 0; i < prefBtns.length; i++) {
          prefBtns[i].classList.remove('selected');
          var onclickStr = prefBtns[i].getAttribute('onclick');
          if (val === 'OURA' && onclickStr.indexOf("'OURA'") !== -1) prefBtns[i].classList.add('selected');
          if (val === 'RINGCONN' && onclickStr.indexOf("'RINGCONN'") !== -1) prefBtns[i].classList.add('selected');
          if (val === 'NONE' && onclickStr.indexOf("'NONE'") !== -1) prefBtns[i].classList.add('selected');
        }
      }
    }
  }

  function buildCategoryList() {
    var container = document.getElementById('category-list');
    if (!container) return;
    container.innerHTML = '';
    for (var i = 0; i < categories.length; i++) {
      var cat = categories[i];
      var qs = questions.filter(function (q) { return q.categoryId === cat.id; });
      var answered = qs.filter(function (q) {
        return ratings[q.id] !== undefined;
      }).length;
      var div = document.createElement('div');
      div.className = 'category-list-item';
      div.innerHTML = '<strong>' + cat.name + '</strong><span>' + answered + ' / ' + qs.length + ' answered</span>';
      (function (idx) {
        div.onclick = function () {
          app.jumpToCategory(idx);
        };
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
    var winnerScore = rec.winner === 'OURA' ? scores.ouraPctWeighted : scores.ringconnPctWeighted;
    var loserScore = rec.winner === 'OURA' ? scores.ringconnPctWeighted : scores.ouraPctWeighted;

    html += '<div class="results-section">';
    html += '<div class="recommendation-card">';
    html += '<p style="text-transform: uppercase; letter-spacing: 0.1em; font-size: 0.8rem; margin-bottom: 8px; font-weight: 700; opacity: 0.9;">Your Top Choice</p>';
    html += '<h2 class="recommendation-winner">' + winnerName + '</h2>';
    html += '<p style="font-size: 1.1rem; opacity: 0.95; max-width: 400px; margin: 16px auto 0;">' + formatRecommendationMessage(rec, scores) + '</p>';
    html += '</div>';
    html += '</div>';

    html += '<div class="results-section">';
    html += '<h2 style="font-size: 1.25rem; font-family: var(--font-heading); margin-bottom: 24px;">Match Analysis</h2>';

    // Winner Score
    html += '<div class="score-analysis" style="margin-bottom: 24px;">';
    html += '  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">';
    html += '    <span style="font-weight: 700; font-family: var(--font-heading);">' + winnerName + ' Match</span>';
    html += '    <span style="font-size: 1.25rem; font-weight: 800; color: var(--text-main);">' + (winnerScore != null ? winnerScore.toFixed(1) : '') + '%</span>';
    html += '  </div>';
    html += '  <div class="score-bar-bg" style="height: 12px; background: var(--border); border-radius: 6px; overflow: hidden;">';
    html += '    <div class="score-bar-fill" style="width: ' + winnerScore + '%; height: 100%; background: var(--text-main); border-radius: 6px;"></div>';
    html += '  </div>';
    html += '</div>';

    // Loser Score
    html += '<div class="score-analysis" style="margin-bottom: 24px;">';
    html += '  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 8px;">';
    html += '    <span style="font-weight: 600; color: var(--text-muted);">' + loserName + ' Match</span>';
    html += '    <span style="font-size: 1.1rem; font-weight: 700; color: var(--text-muted);">' + (loserScore != null ? loserScore.toFixed(1) : '') + '%</span>';
    html += '  </div>';
    html += '  <div class="score-bar-bg" style="height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; opacity: 0.7;">';
    html += '    <div class="score-bar-fill" style="width: ' + loserScore + '%; height: 100%; background: var(--secondary); border-radius: 4px;"></div>';
    html += '  </div>';
    html += '</div>';

    html += '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">';
    html += '  <div style="background: var(--box-bg-alt); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">';
    html += '    <p style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">Strength</p>';
    html += '    <p style="font-weight: 700; color: var(--text-main);">' + (rec.strength || '') + '</p>';
    html += '  </div>';
    html += '  <div style="background: var(--box-bg-alt); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border);">';
    html += '    <p style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 4px;">Confidence</p>';
    html += '    <p style="font-weight: 700; color: var(--text-main);">' + (conf ? conf.label : 'N/A') + '</p>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';

    if (contradictions.length > 0) {
      html += '<div class="results-section results-warning" style="background: var(--warning-bg); border: 1px solid var(--warning-border); padding: 20px; border-radius: var(--radius-md);">';
      html += '<h3 style="font-family: var(--font-heading); color: var(--warning-text); margin-top: 0;">Potential conflicting priorities</h3>';
      html += '<p style="color: var(--warning-text); opacity: 0.9; font-size: 0.95rem;">You rated some opposing factors highly. Your preference for ' + winnerName + ' is based on weighted averages, but you may want to re-examine these categories specifically.</p></div>';
    }

    // --- VISUALIZATIONS ---

    html += '<div class="results-section">';
    html += '<h3 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 24px;">Preference Spectrum</h3>';

    // Calculate simple differential for spectrum (-100 Oura to +100 RingConn)
    var netDiff = (scores.ringconnPctWeighted - scores.ouraPctWeighted);
    var spectrumPos = 50 + (netDiff / 2);
    spectrumPos = Math.max(10, Math.min(90, spectrumPos));

    html += '<div class="spectrum-container" style="position: relative; height: 40px; background: linear-gradient(90deg, #18181b 0%, #a1a1aa 50%, #d4d4d8 100%); border-radius: 20px; margin-bottom: 40px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);">';
    html += '  <div style="position: absolute; top: 45px; left: 0; font-size: 0.75rem; font-weight: 700; color: var(--text-main);">OURA</div>';
    html += '  <div style="position: absolute; top: 45px; right: 0; font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">RINGCONN</div>';
    html += '  <div style="position: absolute; top: 45px; left: 50%; transform: translateX(-50%); font-size: 0.75rem; color: var(--text-muted);">NEUTRAL</div>';
    html += '  <div class="spectrum-indicator" style="position: absolute; left: ' + spectrumPos + '%; top: -6px; transform: translateX(-50%); width: 52px; height: 52px; background: var(--card-bg); border: 2px solid var(--text-main); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.15); transition: left 1s cubic-bezier(0.16, 1, 0.3, 1);">';
    html += '    <span style="font-weight: 800; font-size: 0.8rem; color: var(--text-main);">' + Math.round(rec.winner === 'OURA' ? scores.ouraPctWeighted : scores.ringconnPctWeighted) + '%</span>';
    html += '  </div>';
    html += '</div>';
    html += '</div>';

    html += '<div class="results-section">';
    html += '<h3 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 24px;">Your Key Drivers</h3>';
    html += '<div style="display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));">';

    var drivers = [];
    for (var k in ratings) {
      if (ratings[k] >= 8) {
        var q = questions.find(function (z) { return z.id === k; });
        if (q) {
          drivers.push({
            id: q.id,
            fullText: q.question,
            displayShort: q.question.length > 50 ? q.question.substring(0, 47) + '...' : q.question,
            context: q.context || '',
            score: ratings[k]
          });
        }
      }
    }
    // Sort drivers by score descending
    drivers.sort(function (a, b) { return b.score - a.score; });
    var displayDrivers = drivers.slice(0, 4);

    if (displayDrivers.length > 0) {
      for (var i = 0; i < displayDrivers.length; i++) {
        var driver = displayDrivers[i];
        var driverJson = JSON.stringify(driver).replace(/'/g, "\\'");
        html += '<div class="driver-card" onclick=\'app.showDriverDetail(' + driverJson + ')\'>';
        html += '  <div style="font-size: 0.7rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">Important Factor</div>';
        html += '  <div style="font-size: 0.85rem; font-weight: 600; line-height: 1.3;">' + driver.displayShort + '</div>';
        html += '  <div style="margin-top: 8px; background: var(--border); height: 4px; border-radius: 2px; overflow: hidden;">';
        html += '    <div style="width: 100%; height: 100%; background: var(--text-main); opacity: 0.8;"></div>';
        html += '  </div>';
        html += '  <div style="margin-top: 4px; font-size: 0.65rem; color: var(--text-muted); text-align: right;">Tap to read more</div>';
        html += '</div>';
      }
    } else {
      html += '<p style="color: var(--text-muted); font-size: 0.9rem;">No specific high-priority drivers identified.</p>';
    }

    html += '</div></div>';

    // --- CATEGORY BREAKDOWN ---
    html += '<div class="results-section">';
    html += '<h3 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 24px;">Category Breakdown</h3>';
    html += '<div class="category-breakdown">';

    // Loop through categories and show spectrums
    categories.forEach(function (cat) {
      var catOura = result.scores.categoryScoresOura[cat.id] || 0;
      var catRc = result.scores.categoryScoresRingconn[cat.id] || 0;
      var totalCat = catOura + catRc;

      if (totalCat > 0) {
        var spectrumPos = 50;
        spectrumPos = 50 + ((catRc - catOura) / totalCat) * 50;
        // Clamp it a bit for UI
        spectrumPos = Math.max(5, Math.min(95, spectrumPos));

        var catWinner = "NEUTRAL";
        var winnerClass = "winner-neutral";
        if (catOura > catRc + 1) { catWinner = "OURA"; winnerClass = "winner-oura"; }
        else if (catRc > catOura + 1) { catWinner = "RINGCONN"; winnerClass = "winner-ringconn"; }

        html += '<div class="cat-breakdown-row">';
        html += '  <div class="cat-breakdown-info">';
        html += '    <span class="cat-breakdown-name">' + cat.name + '</span>';
        html += '    <span class="cat-breakdown-winner ' + winnerClass + '">' + catWinner + '</span>';
        html += '  </div>';
        html += '  <div class="mini-spectrum-bg">';
        html += '    <div class="mini-spectrum-indicator" style="left: ' + spectrumPos + '%;"></div>';
        html += '  </div>';
        html += '</div>';
      }
    });

    html += '</div></div>';

    html += '<div style="margin-bottom: 32px; border-bottom: 1px solid var(--border);"></div>';

    html += '<div class="results-section">';
    html += '<h3 style="font-family: var(--font-heading); font-size: 1.1rem; margin-bottom: 16px;">Total Cost Comparison (5 Years)</h3>';
    html += '<div style="display: flex; flex-direction: column; gap: 12px;">';
    html += '  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;">';
    html += '    <span style="font-weight: 600;">Oura Ring 4</span>';
    html += '    <span style="font-weight: 700; color: #ef4444;">~$699 - $849</span>';
    html += '  </div>';
    html += '  <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px;">';
    html += '    <span style="font-weight: 600;">RingConn Gen 2</span>';
    html += '    <span style="font-weight: 700; color: #10b981;">$199 - $299</span>';
    html += '  </div>';
    html += '  <p style="font-size: 0.85rem; color: var(--success-text); background: var(--success-bg); padding: 12px; border-radius: 8px; border-left: 4px solid #10b981;">RingConn saves you roughly <strong>$400-$650</strong> over 5 years by avoiding subscription fees.</p>';
    html += '</div>';
    html += '</div>';

    html += '<div style="font-size: 0.85rem; color: var(--text-muted); text-align: center; margin-top: 24px;">';
    html += '  Answered ' + result.answeredCount + ' of ' + questions.length + ' questions (' + Math.round((result.answeredCount / questions.length) * 100) + '%)';
    html += '</div>';

    container.innerHTML = html;
  }

  var app = {
    init: function () {
      if (global.SmartRingQuestions) {
        questions = global.SmartRingQuestions.QUESTIONS || [];
        categories = global.SmartRingQuestions.CATEGORIES || [];
      }
      loadFromStorage();
      renderWelcome();
      renderProgress();
      showScreen('welcome-screen');
    },

    startQuestionnaire: function () {
      showScreen('questionnaire-screen');
      currentCategoryIndex = 0;
      renderCategory();
    },

    continueQuestionnaire: function () {
      showScreen('questionnaire-screen');
      renderCategory();
    },

    resetProgress: function () {
      if (confirm('Are you sure you want to start over? This will clear all answers in your current session' + (activeSlotIndex > 0 ? ' and erase slot ' + activeSlotIndex + '.' : '.'))) {
        ratings = {};
        preferences = {};
        currentCategoryIndex = 0;
        if (activeSlotIndex > 0) {
          try { localStorage.removeItem(getSlotKey(activeSlotIndex)); } catch (e) { }
          activeSlotIndex = 0;
        }

        // Re-init defaults
        questions.forEach(function (q) {
          ratings[q.id] = 5;
        });

        saveToStorage();
        renderProgress();
        renderSlotsUI();
        showScreen('welcome-screen');
        var existing = document.getElementById('existing-progress');
        if (existing) existing.style.display = 'none';
        renderWelcome();
      }
    },

    // --- Navigation ---

    nextCategory: function () {
      if (currentCategoryIndex < categories.length - 1) {
        currentCategoryIndex++;
        window.scrollTo(0, 0);
        renderCategory();
        saveToStorage();
      } else {
        app.viewResults();
      }
    },

    previousCategory: function () {
      if (currentCategoryIndex > 0) {
        currentCategoryIndex--;
        window.scrollTo(0, 0);
        renderCategory();
        saveToStorage();
      } else {
        showScreen('welcome-screen');
      }
    },

    // --- Data Entry ---

    setRating: function (questionId, value) {
      ratings[questionId] = parseInt(value, 10);
      saveToStorage();
      // Update the display for this specific question
      updateRatingDisplay(questionId, value);
      // Update global and category progress
      renderCategoryNav();
    },

    setPreference: function (questionId, value) {
      preferences[questionId] = value === 'NONE' ? null : value;
      saveToStorage();
      updatePreferenceDisplay(questionId, value);
      // Update global and category progress
      renderCategoryNav();
    },

    viewResults: function () {
      // Ensure we save current state before viewing
      saveToStorage();
      showScreen('results-screen');
      renderResults();
      renderProgress();
      renderSlotsUI();
    },

    showCategoryList: function () {
      showScreen('category-list-screen');
      buildCategoryList();
    },

    returnToQuestionnaire: function () {
      showScreen('questionnaire-screen');
      renderCategory();
    },

    returnToHome: function () {
      showScreen('welcome-screen');
      renderWelcome();
    },

    jumpToCategory: function (index) {
      currentCategoryIndex = index;
      showScreen('questionnaire-screen');
      renderCategory();
    },

    skipCategory: function () {
      // Just move to next category. Since default is 5, this effectively skips.
      app.nextCategory();
    },

    showDriverDetail: function (driver) {
      var modal = document.getElementById('driver-modal');
      var textEl = document.getElementById('modal-driver-text');
      var contextEl = document.getElementById('modal-driver-context');
      var typeEl = document.getElementById('modal-driver-type');

      if (modal && textEl && contextEl && typeEl) {
        typeEl.textContent = "High Priority Factor";
        textEl.textContent = driver.fullText;
        contextEl.textContent = driver.context;
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Prevent scroll
      }
    },

    closeModal: function (event) {
      // Close if clicking X, the modal background, or if no event provided
      if (!event || event.target.id === 'driver-modal' || event.target.className === 'close-modal') {
        var modal = document.getElementById('driver-modal');
        if (modal) {
          modal.style.display = 'none';
          document.body.style.overflow = ''; // Restore scroll
        }
      }
    },

    exportAsCsv: function () { exportAsCsv(); },
    importFromCsv: function (file) { if (file) importFromCsv(file); },
    triggerImportCsv: function () {
      var el = document.getElementById('import-csv-input');
      if (el) el.click();
    },
    randomizeAllAnswers: function () { randomizeAllAnswers(); },
    saveToSlot: function (slotIndex) {
      if (slotIndex < 1 || slotIndex > NUM_SLOTS) return;
      var sum = getSlotSummary(slotIndex);
      if (sum && sum.count > 0 && !confirm('Slot ' + slotIndex + ' already has ' + sum.count + ' answers. Overwrite?')) return;
      saveToSlot(slotIndex);
      renderWelcome();
      renderProgress();
      renderSlotsUI();
      var active = document.querySelector('.screen.active');
      if (active && active.id === 'questionnaire-screen') renderCategory();
      else if (active && active.id === 'results-screen') renderResults();
      else if (active && active.id === 'category-list-screen') buildCategoryList();
    },
    loadSlot: function (slotIndex) {
      if (slotIndex < 1 || slotIndex > NUM_SLOTS) return;
      var currentCount = getAnsweredCount();
      if (currentCount > 0 && !confirm('Load slot ' + slotIndex + '? This will replace your current answers. Export or save to a slot first if you want to keep them.')) return;
      loadSlot(slotIndex);
      renderWelcome();
      renderProgress();
      renderSlotsUI();
      var active = document.querySelector('.screen.active');
      if (active && active.id === 'questionnaire-screen') renderCategory();
      else if (active && active.id === 'results-screen') renderResults();
      else if (active && active.id === 'category-list-screen') buildCategoryList();
    },
    deleteSlot: function (slotIndex) {
      if (slotIndex < 1 || slotIndex > NUM_SLOTS) return;
      var sum = getSlotSummary(slotIndex);
      if (!sum || sum.count === 0) { renderSlotsUI(); return; }
      if (!confirm('Delete slot ' + slotIndex + '? This cannot be undone.')) return;
      try { localStorage.removeItem(getSlotKey(slotIndex)); } catch (e) { }
      if (activeSlotIndex === slotIndex) {
        ratings = {};
        preferences = {};
        currentCategoryIndex = 0;
        questions.forEach(function (q) { ratings[q.id] = 5; });
        activeSlotIndex = 0;
        saveToStorage();
        renderWelcome();
        renderProgress();
        renderSlotsUI();
        showScreen('welcome-screen');
        var existing = document.getElementById('existing-progress');
        if (existing) existing.style.display = 'none';
      } else {
        renderSlotsUI();
      }
    },
    getSlotSummary: getSlotSummary,
    NUM_SLOTS: NUM_SLOTS
  };

  function renderSlotsUI() {
    var containers = document.querySelectorAll('.save-slots-container');
    var html = '';
    for (var i = 1; i <= NUM_SLOTS; i++) {
      var sum = getSlotSummary(i);
      var label = sum ? sum.count + ' answers' + (sum.savedAt ? ', ' + (sum.savedAt.slice(0, 10)) : '') : 'Empty';
      if (i === activeSlotIndex) label += ' (current)';
      html += '<div class="slot-row"><span class="slot-label">Slot ' + i + ': ' + label + '</span>';
      html += '<div class="slot-actions">';
      html += '<button type="button" class="btn btn-slot" onclick="app.saveToSlot(' + i + ')">Save</button>';
      html += '<button type="button" class="btn btn-slot" onclick="app.loadSlot(' + i + ')">Load</button>';
      html += '<button type="button" class="btn btn-slot btn-slot-delete" onclick="app.deleteSlot(' + i + ')">Delete</button>';
      html += '</div></div>';
    }
    for (var c = 0; c < containers.length; c++) containers[c].innerHTML = html;
  }

  global.app = app;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { app.init(); });
  } else {
    app.init();
  }
})(typeof window !== 'undefined' ? window : this);
