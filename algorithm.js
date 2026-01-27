/**
 * Smart Ring Decision Algorithm
 * Oura Ring 4 vs RingConn Gen 2
 * Implements: smart_ring_decision_algorithm.md
 */

(function(global) {
  'use strict';

  var MIN_QUESTIONS = 30;
  var MIN_CATEGORIES = 8;

  var OURA_BLOCKERS = {
    'Q6.2': 'Sleep apnea detection requirement',
    'Q15.2': 'Subscription-free requirement',
    'Q2.3': 'Portable charging case requirement',
    'Q21.2': 'Sleep apnea monitoring for diagnosed condition'
  };

  var RINGCONN_BLOCKERS = {
    'Q18.12': 'Ring size 4-5 requirement',
    'Q18.13': 'Ring size 15 requirement',
    'Q17.3': 'Strava integration requirement',
    'Q16.2': 'Accidental damage protection requirement',
    'Q11.4': 'Ceramic material requirement'
  };

  var CONTRADICTORY_PAIRS = [
    ['Q1.1', 'Q15.1'],
    ['Q5.1', 'Q15.2'],
    ['Q7.1', 'Q14.1'],
    ['Q8.1', 'Q10.1']
  ];

  var CRITICAL_CATEGORIES = ['CAT-05', 'CAT-06', 'CAT-08', 'CAT-15'];

  function getStrengthMult(strength) {
    var m = (global.SmartRingQuestions && global.SmartRingQuestions.STRENGTH_MULT) || { 1: 1.0, 2: 1.5, 3: 2.0 };
    return strength != null ? (m[strength] || 1.0) : 1.0;
  }

  function getConfidenceMult(confidence) {
    var m = (global.SmartRingQuestions && global.SmartRingQuestions.CONFIDENCE_MULT) || { 'V': 1.0, 'R': 0.85, 'I': 0.7 };
    return confidence ? (m[confidence] || 0.7) : 1.0;
  }

  function processDealBreakers(ratings) {
    var ouraBlocked = false;
    var ouraReason = null;
    var ringconnBlocked = false;
    var ringconnReason = null;
    var q;
    for (q in OURA_BLOCKERS) {
      if (ratings[q] === 10) {
        ouraBlocked = true;
        ouraReason = OURA_BLOCKERS[q];
        break;
      }
    }
    for (q in RINGCONN_BLOCKERS) {
      if (ratings[q] === 10) {
        ringconnBlocked = true;
        ringconnReason = RINGCONN_BLOCKERS[q];
        break;
      }
    }
    var conflict = ouraBlocked && ringconnBlocked;
    var conflictReason = conflict
      ? 'Conflicting requirements: "' + ouraReason + '" requires RingConn, but "' + ringconnReason + '" requires Oura. Neither ring can satisfy both.'
      : null;
    return {
      oura_blocked: ouraBlocked,
      ringconn_blocked: ringconnBlocked,
      oura_reason: ouraReason,
      ringconn_reason: ringconnReason,
      conflict: conflict,
      conflict_reason: conflictReason
    };
  }

  function checkDataSufficiency(answeredCount, categoriesWithAnswers) {
    if (answeredCount < MIN_QUESTIONS) {
      return { sufficient: false, reason: 'INSUFFICIENT_QUESTIONS', minQuestions: MIN_QUESTIONS };
    }
    if (categoriesWithAnswers < MIN_CATEGORIES) {
      return { sufficient: false, reason: 'INSUFFICIENT_CATEGORY_COVERAGE', minCategories: MIN_CATEGORIES };
    }
    return { sufficient: true };
  }

  function questionScore(q, rating, preference) {
    var favors = q.favors;
    var strength = q.strength;
    var conf = q.confidence;
    var sm = getStrengthMult(strength);
    var cm = getConfidenceMult(conf);
    if (favors === 'OURA') {
      return { oura: rating * sm * cm, ringconn: 0 };
    }
    if (favors === 'RINGCONN') {
      return { oura: 0, ringconn: rating * sm * cm };
    }
    if (favors === 'NEUTRAL' && preference && preference !== 'NONE') {
      if (preference === 'OURA') return { oura: rating * 1.0, ringconn: 0 };
      if (preference === 'RINGCONN') return { oura: 0, ringconn: rating * 1.0 };
    }
    return { oura: 0, ringconn: 0 };
  }

  function maxPossibleForQuestion(q) {
    var favors = q.favors;
    var strength = q.strength;
    var conf = q.confidence;
    var sm = getStrengthMult(strength);
    var cm = getConfidenceMult(conf);
    if (favors === 'OURA') {
      return { oura: 10 * sm * cm, ringconn: 0 };
    }
    if (favors === 'RINGCONN') {
      return { oura: 0, ringconn: 10 * sm * cm };
    }
    if (favors === 'NEUTRAL') {
      return { oura: 10, ringconn: 10 };
    }
    return { oura: 0, ringconn: 0 };
  }

  function computeScores(questions, categories, ratings, preferences) {
    var ouraRaw = 0;
    var ringconnRaw = 0;
    var ouraMax = 0;
    var ringconnMax = 0;
    var catScoresOur = {};
    var catScoresRc = {};
    var catRatings = {};
    var catCount = {};
    var q, r, pref, sc, mp, catId;
    for (catId in categories) {
      catScoresOur[catId] = 0;
      catScoresRc[catId] = 0;
      catRatings[catId] = [];
      catCount[catId] = 0;
    }
    for (var i = 0; i < questions.length; i++) {
      q = questions[i];
      r = ratings[q.id];
      if (r === undefined || r === 'SKIP') continue;
      pref = (preferences && preferences[q.id]) || null;
      sc = questionScore(q, r, pref);
      mp = maxPossibleForQuestion(q);
      ouraRaw += sc.oura;
      ringconnRaw += sc.ringconn;
      ouraMax += mp.oura;
      ringconnMax += mp.ringconn;
      catId = q.categoryId;
      if (catScoresOur[catId] !== undefined) {
        catScoresOur[catId] += sc.oura;
        catScoresRc[catId] += sc.ringconn;
        catRatings[catId].push(r);
        catCount[catId]++;
      }
    }
    var totalRaw = ouraRaw + ringconnRaw;
    var ouraPct = totalRaw > 0 ? (ouraRaw / totalRaw) * 100 : 50;
    var ringconnPct = totalRaw > 0 ? (ringconnRaw / totalRaw) * 100 : 50;
    var differential = Math.abs(ouraPct - ringconnPct);
    var ouraSatisfaction = ouraMax > 0 ? (ouraRaw / ouraMax) * 100 : 0;
    var ringconnSatisfaction = ringconnMax > 0 ? (ringconnRaw / ringconnMax) * 100 : 0;

    var ouraWeighted = 0;
    var ringconnWeighted = 0;
    for (catId in catScoresOur) {
      var cat = categories[catId];
      if (!cat || catCount[catId] === 0) continue;
      var arr = catRatings[catId];
      var avg = arr.reduce(function(a, b) { return a + b; }, 0) / arr.length;
      var baseW = (cat && cat.baseWeight) ? cat.baseWeight : 1.0;
      var adjW = baseW * (1 + (avg - 5) / 10);
      ouraWeighted += catScoresOur[catId] * adjW;
      ringconnWeighted += catScoresRc[catId] * adjW;
    }
    var totalWeighted = ouraWeighted + ringconnWeighted;
    var ouraPctWeighted = totalWeighted > 0 ? (ouraWeighted / totalWeighted) * 100 : 50;
    var ringconnPctWeighted = totalWeighted > 0 ? (ringconnWeighted / totalWeighted) * 100 : 50;
    var differentialWeighted = Math.abs(ouraPctWeighted - ringconnPctWeighted);

    return {
      ouraRaw: ouraRaw,
      ringconnRaw: ringconnRaw,
      ouraMax: ouraMax,
      ringconnMax: ringconnMax,
      ouraPct: ouraPct,
      ringconnPct: ringconnPct,
      differential: differential,
      ouraPctWeighted: ouraPctWeighted,
      ringconnPctWeighted: ringconnPctWeighted,
      differentialWeighted: differentialWeighted,
      ouraSatisfaction: ouraSatisfaction,
      ringconnSatisfaction: ringconnSatisfaction,
      categoryScoresOura: catScoresOur,
      categoryScoresRingconn: catScoresRc,
      categoryRatings: catRatings,
      categoryCount: catCount
    };
  }

  function generateRecommendation(dealBreakers, scores, questions, ratings) {
    var winner, strength, reason, forced;
    if (dealBreakers.conflict) {
      return {
        winner: null,
        strength: null,
        reason: 'CONFLICT',
        message: dealBreakers.conflict_reason,
        forced: false
      };
    }
    if (dealBreakers.oura_blocked) {
      return {
        winner: 'RINGCONN',
        strength: 'FORCED',
        reason: 'OURA_BLOCKED',
        message: dealBreakers.oura_reason,
        forced: true
      };
    }
    if (dealBreakers.ringconn_blocked) {
      return {
        winner: 'OURA',
        strength: 'FORCED',
        reason: 'RINGCONN_BLOCKED',
        message: dealBreakers.ringconn_reason,
        forced: true
      };
    }
    var diff = scores.differentialWeighted;
    var ouraP = scores.ouraPctWeighted;
    var ringconnP = scores.ringconnPctWeighted;
    if (ouraP > ringconnP) {
      winner = 'OURA';
    } else if (ringconnP > ouraP) {
      winner = 'RINGCONN';
    } else {
      return breakTie(questions, ratings, scores);
    }
    if (diff >= 20) strength = 'STRONG';
    else if (diff >= 10) strength = 'MODERATE';
    else if (diff >= 5) strength = 'SLIGHT';
    else strength = 'MARGINAL';
    return {
      winner: winner,
      strength: strength,
      reason: null,
      message: null,
      forced: false
    };
  }

  function breakTie(questions, ratings, scores) {
    var highIds = [];
    var i, q, r;
    for (i = 0; i < questions.length; i++) {
      q = questions[i];
      r = ratings[q.id];
      if (r != null && r !== 'SKIP' && r >= 8) highIds.push(q);
    }
    var ouraHigh = 0, ringconnHigh = 0;
    for (i = 0; i < highIds.length; i++) {
      q = highIds[i];
      if (q.favors === 'OURA') ouraHigh++;
      else if (q.favors === 'RINGCONN') ringconnHigh++;
    }
    if (ouraHigh > ringconnHigh) {
      return { winner: 'OURA', strength: 'TIE_BREAK_HIGH_PRIORITY', reason: 'TIE_BREAK_HIGH_PRIORITY', message: null, forced: false };
    }
    if (ringconnHigh > ouraHigh) {
      return { winner: 'RINGCONN', strength: 'TIE_BREAK_HIGH_PRIORITY', reason: 'TIE_BREAK_HIGH_PRIORITY', message: null, forced: false };
    }
    var csO = scores.categoryScoresOura || {};
    var csR = scores.categoryScoresRingconn || {};
    var ouraCrit = 0, ringconnCrit = 0;
    for (i = 0; i < CRITICAL_CATEGORIES.length; i++) {
      var cid = CRITICAL_CATEGORIES[i];
      ouraCrit += csO[cid] || 0;
      ringconnCrit += csR[cid] || 0;
    }
    if (ouraCrit > ringconnCrit) {
      return { winner: 'OURA', strength: 'TIE_BREAK_CRITICAL_CATEGORY', reason: 'TIE_BREAK_CRITICAL_CATEGORY', message: null, forced: false };
    }
    if (ringconnCrit > ouraCrit) {
      return { winner: 'RINGCONN', strength: 'TIE_BREAK_CRITICAL_CATEGORY', reason: 'TIE_BREAK_CRITICAL_CATEGORY', message: null, forced: false };
    }
    return { winner: 'RINGCONN', strength: 'TIE_BREAK_COST', reason: 'TIE_BREAK_COST', message: 'Default to lower total cost of ownership', forced: false };
  }

  function calculateConfidence(scores, rec, answeredCount, totalQuestions, questions, ratings) {
    var diff = scores.differentialWeighted || 0;
    var diffScore = Math.min(40, diff * 2);
    var completionRate = totalQuestions > 0 ? answeredCount / totalQuestions : 0;
    var completionScore = completionRate * 25;
    var consistency = 0.8;
    var consistencyScore = consistency * 20;
    var highPriority = [];
    var j, q, r;
    for (j = 0; j < questions.length; j++) {
      q = questions[j];
      r = ratings[q.id];
      if (r != null && r !== 'SKIP' && r >= 8) highPriority.push(q);
    }
    var aligned = 0;
    if (rec && rec.winner && highPriority.length > 0) {
      for (j = 0; j < highPriority.length; j++) {
        if (highPriority[j].favors === rec.winner) aligned++;
      }
    }
    var alignmentRate = highPriority.length > 0 ? aligned / highPriority.length : 0.5;
    var alignmentScore = alignmentRate * 15;
    var total = diffScore + completionScore + consistencyScore + alignmentScore;
    var confidencePct = Math.min(100, total);
    var label;
    if (confidencePct >= 90) label = 'Very High';
    else if (confidencePct >= 75) label = 'High';
    else if (confidencePct >= 60) label = 'Moderate';
    else if (confidencePct >= 45) label = 'Low';
    else label = 'Very Low';
    return { score: confidencePct, label: label };
  }

  function detectContradictions(ratings) {
    var out = [];
    var pair, r1, r2;
    for (var i = 0; i < CONTRADICTORY_PAIRS.length; i++) {
      pair = CONTRADICTORY_PAIRS[i];
      r1 = ratings[pair[0]];
      r2 = ratings[pair[1]];
      if (r1 != null && r1 !== 'SKIP' && r2 != null && r2 !== 'SKIP' && r1 >= 7 && r2 >= 7) {
        out.push({ q1: pair[0], q2: pair[1], r1: r1, r2: r2 });
      }
    }
    return out;
  }

  function runAlgorithm(questions, categories, ratings, preferences) {
    var categoriesById = {};
    var j, c;
    for (j = 0; j < categories.length; j++) {
      c = categories[j];
      categoriesById[c.id] = c;
    }
    var dealBreakers = processDealBreakers(ratings);
    var answeredCount = 0;
    var categoriesWithAnswers = 0;
    var catTouched = {};
    for (j = 0; j < questions.length; j++) {
      if (ratings[questions[j].id] != null && ratings[questions[j].id] !== 'SKIP') {
        answeredCount++;
        var cid = questions[j].categoryId;
        if (!catTouched[cid]) {
          catTouched[cid] = true;
          categoriesWithAnswers++;
        }
      }
    }
    var sufficiency = checkDataSufficiency(answeredCount, categoriesWithAnswers);
    var scores = computeScores(questions, categoriesById, ratings, preferences);
    var rec = null;
    var confidence = null;
    var contradictions = detectContradictions(ratings);
    if (sufficiency.sufficient) {
      rec = generateRecommendation(dealBreakers, scores, questions, ratings);
      confidence = calculateConfidence(scores, rec, answeredCount, questions.length, questions, ratings);
    }
    return {
      dealBreakers: dealBreakers,
      sufficiency: sufficiency,
      scores: scores,
      recommendation: rec,
      confidence: confidence,
      answeredCount: answeredCount,
      categoriesWithAnswers: categoriesWithAnswers,
      contradictions: contradictions
    };
  }

  function getBlockerQuestionIds() {
    var ids = [];
    var q;
    for (q in OURA_BLOCKERS) ids.push(q);
    for (q in RINGCONN_BLOCKERS) ids.push(q);
    return ids;
  }

  global.SmartRingAlgorithm = {
    MIN_QUESTIONS: MIN_QUESTIONS,
    MIN_CATEGORIES: MIN_CATEGORIES,
    getBlockerQuestionIds: getBlockerQuestionIds,
    processDealBreakers: processDealBreakers,
    checkDataSufficiency: checkDataSufficiency,
    computeScores: computeScores,
    generateRecommendation: generateRecommendation,
    calculateConfidence: calculateConfidence,
    detectContradictions: detectContradictions,
    runAlgorithm: runAlgorithm
  };
})(typeof window !== 'undefined' ? window : this);
