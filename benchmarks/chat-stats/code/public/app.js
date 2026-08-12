document.addEventListener('DOMContentLoaded', () => {
  // Global Data Store
  let parseInfo = null;
  let analytics = null;
  let pipeline = null;
  let comicSignals = null;
  let memorySignals = null;
  let sessionData = null;

  // Chart instances
  const charts = {};

  // Tab switching
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const targetId = `tab-${tab.dataset.tab}`;
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadAllData();
  });

  // Fetch all initial data
  async function loadAllData() {
    try {
      const [resParse, resAnalytics, resPipeline, resComic, resMemory, resSessions] = await Promise.all([
        fetch('/api/parse-info').then(r => r.json()),
        fetch('/api/analytics').then(r => r.json()),
        fetch('/api/pipeline').then(r => r.json()),
        fetch('/api/comic-signals').then(r => r.json()),
        fetch('/api/memory-signals').then(r => r.json()),
        fetch('/api/sessions').then(r => r.json())
      ]);

      parseInfo = resParse;
      analytics = resAnalytics;
      pipeline = resPipeline;
      comicSignals = resComic;
      memorySignals = resMemory;
      sessionData = resSessions;

      renderHeader();
      renderOverviewTab();
      renderTemporalTab();
      renderMembersTab();
      renderInteractionsTab();
      renderSessionsTab();
      renderPipelineTab();
      renderSignalsTab();
    } catch (err) {
      console.error('Error loading benchmark data:', err);
    }
  }

  // Header render
  function renderHeader() {
    if (!parseInfo) return;
    document.getElementById('chat-filename').textContent = `${parseInfo.metadata.chatFile} (${parseInfo.metadata.fileSize}, ${parseInfo.metadata.totalLines.toLocaleString()} lines)`;
    document.getElementById('chat-lifespan').textContent = `${parseInfo.parseStats.durationDays} Days Timespan`;
  }

  // Tab 1: Overview
  function renderOverviewTab() {
    if (!parseInfo || !analytics) return;

    const { parseStats } = parseInfo;
    const { volumeMetrics } = analytics;

    document.getElementById('kpi-total-messages').textContent = parseStats.totalMessages.toLocaleString();
    document.getElementById('kpi-system-msgs').textContent = `${parseStats.totalSystemMessages.toLocaleString()} system msgs`;
    document.getElementById('kpi-members').textContent = parseStats.uniqueMembers;

    const activeDaysCount = Object.keys(volumeMetrics.messagesPerDay).length;
    document.getElementById('kpi-active-days').textContent = activeDaysCount;
    const avgPerDay = Math.round(parseStats.totalMessages / activeDaysCount);
    document.getElementById('kpi-avg-per-day').textContent = `~${avgPerDay} msgs/day avg`;

    document.getElementById('kpi-duration').textContent = `${parseStats.durationDays} Days`;
    const startDate = new Date(parseStats.timespan.start).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const endDate = new Date(parseStats.timespan.end).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    document.getElementById('kpi-date-range').textContent = `${startDate} - ${endDate}`;

    // Chart: Daily Volume
    const days = Object.keys(volumeMetrics.messagesPerDay).sort();
    const dayValues = days.map(d => volumeMetrics.messagesPerDay[d]);

    createOrUpdateChart('chart-messages-over-time', {
      type: 'line',
      data: {
        labels: days,
        datasets: [{
          label: 'Messages / Day',
          data: dayValues,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          fill: true,
          tension: 0.3,
          pointRadius: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Chart: Member Breakdown
    const membersSorted = Object.entries(volumeMetrics.messagesPerMember);
    const memberNames = membersSorted.map(m => m[0]);
    const memberCounts = membersSorted.map(m => m[1]);

    createOrUpdateChart('chart-member-breakdown', {
      type: 'bar',
      data: {
        labels: memberNames,
        datasets: [{
          label: 'Total Messages',
          data: memberCounts,
          backgroundColor: '#06b6d4',
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } },
          y: { grid: { display: false }, ticks: { color: '#f1f5f9' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Chart: Type Breakdown
    const typeCounts = analytics.contentMetrics.messagesByType;
    createOrUpdateChart('chart-type-breakdown', {
      type: 'doughnut',
      data: {
        labels: ['Text', 'Media Omitted', 'Deleted', 'Link', 'System'],
        datasets: [{
          data: [typeCounts.text || 0, typeCounts.media_omitted || 0, typeCounts.deleted || 0, typeCounts.link || 0, typeCounts.system || 0],
          backgroundColor: ['#6366f1', '#f59e0b', '#ef4444', '#10b981', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#f1f5f9' } } }
      }
    });
  }

  // Tab 2: Temporal Patterns
  function renderTemporalTab() {
    if (!analytics) return;
    const { temporalMetrics } = analytics;

    document.getElementById('kpi-busiest-day').textContent = temporalMetrics.busiestDay.date;
    document.getElementById('kpi-busiest-count').textContent = `${temporalMetrics.busiestDay.count.toLocaleString()} msgs`;

    document.getElementById('kpi-quietest-day').textContent = temporalMetrics.quietestDay.date;
    document.getElementById('kpi-quietest-count').textContent = `${temporalMetrics.quietestDay.count} msgs`;

    document.getElementById('kpi-longest-streak').textContent = `${temporalMetrics.longestStreak.days} Days`;
    document.getElementById('kpi-streak-range').textContent = `${temporalMetrics.longestStreak.start} to ${temporalMetrics.longestStreak.end}`;

    document.getElementById('kpi-longest-silence').textContent = `${temporalMetrics.longestSilence.hours} Hours`;
    document.getElementById('kpi-silence-range').textContent = `Gap in chat activity`;

    // Hourly
    createOrUpdateChart('chart-hourly', {
      type: 'bar',
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Messages',
          data: temporalMetrics.hourlyDistribution,
          backgroundColor: '#6366f1',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Day of week
    const daysName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    createOrUpdateChart('chart-dayofweek', {
      type: 'bar',
      data: {
        labels: daysName,
        datasets: [{
          label: 'Messages',
          data: temporalMetrics.dayOfWeekDistribution,
          backgroundColor: '#10b981',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#f1f5f9' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Heatmap Grid
    const hmContainer = document.getElementById('heatmap-grid');
    hmContainer.innerHTML = '';

    // Header row
    const emptyCell = document.createElement('div');
    emptyCell.className = 'hm-header';
    emptyCell.textContent = 'Day';
    hmContainer.appendChild(emptyCell);

    for (let h = 0; h < 24; h++) {
      const hCell = document.createElement('div');
      hCell.className = 'hm-header';
      hCell.textContent = `${h}h`;
      hmContainer.appendChild(hCell);
    }

    let maxVal = 1;
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (temporalMetrics.heatmap[d][h] > maxVal) maxVal = temporalMetrics.heatmap[d][h];
      }
    }

    for (let d = 0; d < 7; d++) {
      const dayLabel = document.createElement('div');
      dayLabel.className = 'hm-header';
      dayLabel.textContent = daysName[d];
      hmContainer.appendChild(dayLabel);

      for (let h = 0; h < 24; h++) {
        const val = temporalMetrics.heatmap[d][h];
        const ratio = val / maxVal;
        const cell = document.createElement('div');
        cell.className = 'hm-cell';
        cell.title = `${daysName[d]} ${h}:00 - ${val} msgs`;
        cell.style.backgroundColor = `rgba(99, 102, 241, ${Math.max(0.08, ratio)})`;
        if (ratio > 0.4) cell.textContent = val > 999 ? `${Math.round(val/1000)}k` : val;
        hmContainer.appendChild(cell);
      }
    }
  }

  // Tab 3: Members
  function renderMembersTab() {
    if (!analytics) return;
    const memberSelect = document.getElementById('member-select');
    const members = Object.keys(analytics.memberMetrics);

    memberSelect.innerHTML = members.map(m => `<option value="${m}">${m}</option>`).join('');

    memberSelect.onchange = () => updateMemberDetails(memberSelect.value);
    if (members.length > 0) updateMemberDetails(members[0]);

    // Member comparison table
    const tbody = document.querySelector('#table-members-comparison tbody');
    tbody.innerHTML = members.map(m => {
      const stats = analytics.memberMetrics[m];
      return `
        <tr>
          <td><strong>${m}</strong></td>
          <td>${stats.totalMessages.toLocaleString()}</td>
          <td>${stats.percentage}%</td>
          <td>${stats.avgMessageLength}</td>
          <td>${stats.avgWordCount}</td>
          <td>${stats.shortMessageRate}%</td>
          <td>${stats.emojiCount.toLocaleString()}</td>
          <td>${stats.avgTokens}</td>
          <td>${stats.activeDays}</td>
          <td>${stats.initiationCount}</td>
        </tr>
      `;
    }).join('');
  }

  function updateMemberDetails(memberName) {
    const stats = analytics.memberMetrics[memberName];
    if (!stats) return;

    document.getElementById('mem-total-msgs').textContent = stats.totalMessages.toLocaleString();
    document.getElementById('mem-share').textContent = `${stats.percentage}% of group chat`;
    document.getElementById('mem-avg-len').textContent = `${stats.avgMessageLength} ch / ${stats.avgWordCount} w`;
    document.getElementById('mem-short-rate').textContent = `${stats.shortMessageRate}% short (≤3w)`;
    document.getElementById('mem-emoji-count').textContent = stats.emojiCount.toLocaleString();
    const topE = stats.mostUsedEmojis.slice(0, 3).map(e => e.emoji).join(' ');
    document.getElementById('mem-top-emoji').textContent = topE ? `Top: ${topE}` : 'None';
    document.getElementById('mem-init-count').textContent = stats.initiationCount;
    document.getElementById('mem-avg-tokens').textContent = `${stats.avgTokens} tokens/msg`;

    // Hourly chart
    createOrUpdateChart('chart-member-hourly', {
      type: 'bar',
      data: {
        labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
        datasets: [{
          label: 'Messages',
          data: stats.hourlyPattern,
          backgroundColor: '#06b6d4',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Top words list
    const wordsContainer = document.getElementById('member-top-words-list');
    wordsContainer.innerHTML = stats.topWords.slice(0, 10).map(w => `
      <div class="word-item">
        <span>${w.word}</span>
        <strong>${w.count}</strong>
      </div>
    `).join('');
  }

  // Tab 4: Interactions
  function renderInteractionsTab() {
    if (!analytics) return;
    const { socialMetrics, milestones } = analytics;

    // Starters chart
    const starters = Object.entries(socialMetrics.conversationStarters).sort((a, b) => b[1] - a[1]);
    createOrUpdateChart('chart-conversation-starters', {
      type: 'bar',
      data: {
        labels: starters.map(s => s[0]),
        datasets: [{
          label: 'Sessions Started',
          data: starters.map(s => s[1]),
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#f1f5f9' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Ghosters table
    const ghostTbody = document.querySelector('#table-ghosters tbody');
    ghostTbody.innerHTML = socialMetrics.ghosters.map(g => `
      <tr>
        <td><strong>${g.member}</strong></td>
        <td><span class="${g.netDifference > 0 ? 'text-success' : ''}">${g.netDifference > 0 ? '+' : ''}${g.netDifference}</span></td>
        <td>${g.repliesReceived}</td>
        <td>${g.repliesSent}</td>
      </tr>
    `).join('');

    // Reply matrix
    const matrixContainer = document.getElementById('reply-matrix-grid');
    const members = Object.keys(socialMetrics.replyMatrix);
    let html = '<table class="data-table"><thead><tr><th>Sender \\ Replied To</th>';
    members.forEach(m => html += `<th>${m.split(' ')[0]}</th>`);
    html += '</tr></thead><tbody>';

    members.forEach(m1 => {
      html += `<tr><td><strong>${m1}</strong></td>`;
      members.forEach(m2 => {
        const val = socialMetrics.replyMatrix[m1]?.[m2] || 0;
        html += `<td style="background: rgba(99, 102, 241, ${m1 === m2 ? 0 : Math.min(0.8, val / 1500)})">${val}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    matrixContainer.innerHTML = html;

    // Milestones timeline
    const timelineContainer = document.getElementById('milestones-timeline');
    const items = [...milestones.milestones];
    if (milestones.firstMessage) items.unshift(milestones.firstMessage);

    timelineContainer.innerHTML = items.map(m => `
      <div class="timeline-item">
        <div class="timeline-time">${new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
        <div>
          <div class="timeline-sender">[${m.milestone}] ${m.sender}</div>
          <div class="timeline-content">"${m.content}"</div>
        </div>
      </div>
    `).join('');
  }

  // Tab 5: Session Experiments
  function renderSessionsTab() {
    if (!sessionData || !analytics) return;
    const { experiments, estimates } = sessionData;

    const rec = estimates;
    document.getElementById('sess-total-count').textContent = rec.sessionCount.toLocaleString();
    document.getElementById('sess-filterable').textContent = `${rec.filterableSessionCount.toLocaleString()} filterable (≥5 msgs)`;

    const recExp = experiments.find(e => e.strategy === 'Inactivity Gap' && e.threshold === '30min') || experiments[0];
    document.getElementById('sess-avg-msgs').textContent = recExp.avgMessagesPerSession;
    document.getElementById('sess-median-msgs').textContent = `Median: ${recExp.medianMessagesPerSession}`;

    const rtx4070 = rec.estimates.find(e => e.hardware.includes('4070'));
    document.getElementById('sess-rtx4070-time').textContent = `${rtx4070 ? rtx4070.optimizedTimeHours : '--'} Hours`;
    document.getElementById('sess-cloud-cost').textContent = `$${rec.cloudCost.toFixed(2)}`;

    // Note in banner
    const actualTokens = analytics.tokenAndShapeMetrics.avgTokensPerMessage;
    const filterablePct = Math.round((recExp.sessionsWithLessThan5Msgs / recExp.sessionCount) * 100);
    document.getElementById('architecture-validation-note').innerHTML = `
      <strong>Empirical Validation vs docs/processing-times.md:</strong><br>
      • Real average message length: <strong>${actualTokens} tokens/msg</strong> (assumed 15) → 66% fewer tokens than estimated!<br>
      • Real 30-min session count: <strong>${recExp.sessionCount} sessions</strong> (avg ${recExp.avgMessagesPerSession} msgs/session).<br>
      • Filterable noise sessions (&lt;5 msgs): <strong>${recExp.sessionsWithLessThan5Msgs} sessions (${filterablePct}%)</strong> can be skipped before LLM processing.<br>
      • Real optimized GPU execution time (RTX 4070): <strong>${rtx4070 ? rtx4070.optimizedTimeHours : '--'} hrs</strong> (Cloud cost: <strong>$${rec.cloudCost}</strong>).
    `;

    // Experiments Table
    const tbody = document.querySelector('#table-session-experiments tbody');
    tbody.innerHTML = experiments.map(e => {
      const isDefault = e.strategy === 'Inactivity Gap' && e.threshold === '30min';
      return `
        <tr class="${isDefault ? 'highlight-row' : ''}">
          <td><strong>${e.strategy}</strong></td>
          <td><code>${e.threshold}</code></td>
          <td>${e.sessionCount}</td>
          <td>${e.avgMessagesPerSession}</td>
          <td>${e.medianMessagesPerSession}</td>
          <td>${e.sessionsWithLessThan5Msgs}</td>
          <td>${e.sessionsWithMoreThan100Msgs}</td>
          <td>${e.avgSessionDurationMinutes}m</td>
          <td>${e.avgParticipantsPerSession}</td>
          <td>
            <button class="btn btn-small btn-inspect" data-strategy="${encodeURIComponent(e.strategy)}" data-threshold="${encodeURIComponent(e.threshold)}">Inspect</button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach inspect listeners
    document.querySelectorAll('.btn-inspect').forEach(btn => {
      btn.addEventListener('click', () => {
        loadSessionDrilldown(btn.dataset.strategy, btn.dataset.threshold);
      });
    });

    document.getElementById('close-drilldown-btn').addEventListener('click', () => {
      document.getElementById('session-drilldown-card').classList.add('hidden');
    });

    // Curve charts for Inactivity Gap
    const gapExps = experiments.filter(e => e.strategy === 'Inactivity Gap');
    const thresholds = gapExps.map(e => e.threshold);
    const sessionCounts = gapExps.map(e => e.sessionCount);
    const avgMsgs = gapExps.map(e => e.avgMessagesPerSession);

    createOrUpdateChart('chart-session-count-curve', {
      type: 'line',
      data: {
        labels: thresholds,
        datasets: [{
          label: 'Total Sessions',
          data: sessionCounts,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    createOrUpdateChart('chart-avg-msgs-curve', {
      type: 'line',
      data: {
        labels: thresholds,
        datasets: [{
          label: 'Avg Msgs / Session',
          data: avgMsgs,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.15)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  async function loadSessionDrilldown(strategy, threshold) {
    const card = document.getElementById('session-drilldown-card');
    card.classList.remove('hidden');
    document.getElementById('drilldown-title').textContent = `Session Drilldown — ${decodeURIComponent(strategy)} (${decodeURIComponent(threshold)})`;

    try {
      const res = await fetch(`/api/sessions/${strategy}/${threshold}`).then(r => r.json());
      const tbody = document.querySelector('#table-session-drilldown tbody');
      tbody.innerHTML = res.sessions.slice(0, 100).map(s => `
        <tr>
          <td>${s.id}</td>
          <td>${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${new Date(s.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td>${s.durationMinutes}m</td>
          <td><strong>${s.messageCount}</strong></td>
          <td>${s.participants.length} (${s.participants.slice(0, 2).join(', ')})</td>
          <td>${s.estimatedInputTokens.toLocaleString()}</td>
          <td>${Math.round(s.noiseRatio * 100)}%</td>
          <td><small>${s.firstMessagePreview}</small></td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Error fetching session details:', err);
    }
  }

  // Tab 6: LLM Pipeline Readiness
  function renderPipelineTab() {
    if (!analytics || !pipeline) return;
    const { tokenAndShapeMetrics, languageMetrics } = analytics;

    document.getElementById('measured-tokens-per-msg').textContent = `${tokenAndShapeMetrics.avgTokensPerMessage} tokens / msg`;
    document.getElementById('token-variance-badge').textContent = `66% Faster / Cheaper`;

    document.getElementById('fit-4k').textContent = `${100 - pipeline.contextWindowSimulation.pctExceeding4K}% sessions`;
    document.getElementById('fit-8k').textContent = `${100 - pipeline.contextWindowSimulation.pctExceeding8K}% sessions`;
    document.getElementById('fit-16k').textContent = `${100 - pipeline.contextWindowSimulation.pctExceeding16K}% sessions`;

    // Shape dist
    const shapeLabels = Object.keys(tokenAndShapeMetrics.shapeDistribution);
    const shapeValues = Object.values(tokenAndShapeMetrics.shapeDistribution);
    createOrUpdateChart('chart-shape-dist', {
      type: 'pie',
      data: {
        labels: shapeLabels,
        datasets: [{
          data: shapeValues,
          backgroundColor: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#f1f5f9' } } }
      }
    });

    // Language dist
    const langLabels = Object.keys(languageMetrics.languageDistribution);
    const langValues = Object.values(languageMetrics.languageDistribution);
    createOrUpdateChart('chart-lang-dist', {
      type: 'doughnut',
      data: {
        labels: langLabels,
        datasets: [{
          data: langValues,
          backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#64748b']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#f1f5f9' } } }
      }
    });

    // Context simulation histogram
    const simDist = pipeline.contextWindowSimulation.distribution;
    createOrUpdateChart('chart-context-sim', {
      type: 'bar',
      data: {
        labels: Object.keys(simDist),
        datasets: [{
          label: 'Session Count',
          data: Object.values(simDist),
          backgroundColor: '#6366f1',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#f1f5f9' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Session richness distribution
    createOrUpdateChart('chart-session-richness', {
      type: 'bar',
      data: {
        labels: ['Mean Richness', 'Median Richness', '25th Pct (Filter)'],
        datasets: [{
          label: 'Score',
          data: [
            pipeline.sessionContentRichness.mean,
            pipeline.sessionContentRichness.median,
            pipeline.sessionContentRichness.p25
          ],
          backgroundColor: ['#06b6d4', '#10b981', '#ef4444'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: '#f1f5f9' } },
          y: { grid: { color: '#26334d' }, ticks: { color: '#94a3b8' } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // Tab 7: Signals
  function renderSignalsTab() {
    if (!comicSignals || !memorySignals) return;

    document.getElementById('sig-rapid-count').textContent = comicSignals.rapidExchangeCount;
    document.getElementById('sig-event-count').textContent = comicSignals.eventMessageCount;
    document.getElementById('sig-phrases-count').textContent = memorySignals.repeatedPhraseCount;
    document.getElementById('sig-mention-density').textContent = memorySignals.mentionGraphDensity;

    // Repeated phrases table
    const phrasesTbody = document.querySelector('#table-repeated-phrases tbody');
    phrasesTbody.innerHTML = memorySignals.repeatedPhrases.slice(0, 15).map(p => `
      <tr>
        <td><strong>"${p.phrase}"</strong></td>
        <td>${p.count}</td>
        <td>${p.sessions}</td>
        <td>${p.members}</td>
      </tr>
    `).join('');

    // Monologues table
    const monoTbody = document.querySelector('#table-monologues tbody');
    monoTbody.innerHTML = comicSignals.monologues.slice(0, 15).map(m => `
      <tr>
        <td><strong>${m.sender}</strong></td>
        <td>${m.messageCount}</td>
        <td>${m.durationMinutes}m</td>
        <td><small>"${m.preview}"</small></td>
      </tr>
    `).join('');

    // Event messages table
    const eventTbody = document.querySelector('#table-event-messages tbody');
    eventTbody.innerHTML = comicSignals.eventMessages.slice(0, 15).map(e => `
      <tr>
        <td><small>${new Date(e.timestamp).toLocaleDateString()}</small></td>
        <td><strong>${e.sender}</strong></td>
        <td><span class="badge">${e.matchedKeyword}</span></td>
        <td><small>"${e.content.length > 80 ? e.content.substring(0, 80) + '...' : e.content}"</small></td>
      </tr>
    `).join('');
  }

  function createOrUpdateChart(id, config) {
    if (charts[id]) {
      charts[id].destroy();
    }
    const canvas = document.getElementById(id);
    if (canvas) {
      charts[id] = new Chart(canvas, config);
    }
  }

  // Start initialization
  loadAllData();
});
