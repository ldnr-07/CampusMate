// ===== QUIZ GENERATOR =====
let _lastQuizParams = null;

async function generateQuiz() {
  const topic = document.getElementById('quiz-topic').value.trim();
  if (!topic) { showToast('Please enter a topic first'); return; }


  const count = document.getElementById('quiz-count').value;
  const type = document.getElementById('quiz-type').value;
  const diff = document.getElementById('quiz-diff').value;
  const output = document.getElementById('quiz-output');
  const sendBtn = document.getElementById('quiz-send-btn');

  _lastQuizParams = { topic, count, type, diff };

  output.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:40px 0;">
      <div class="quiz-spinner"></div>
      <p class="loading-dots" style="color:var(--text-muted);font-weight:600;">Generating your quiz</p>
    </div>`;
  if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.6'; }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || SUPABASE_ANON_KEY;

    const response = await fetch(`${SUPABASE_URL}/functions/v1/quiz-generator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ topic, count, type, diff })
    });

    const data = await response.json();
    if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);

    renderQuizOutput(data.text, type);
    saveQuizHistory(topic, type, diff, parseInt(count), data.text);
  } catch (err) {
    console.warn('Quiz API error:', err.message);
    showToast('AI unavailable — showing sample quiz');
    const mockText = generateMockQuizText(topic, count, type, diff);
    renderQuizOutput(mockText, type);
    saveQuizHistory(topic, type, diff, parseInt(count), mockText);
  } finally {
    if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
  }
}

function generateMockQuizText(topic, count, type, diff) {
  const mcAnswers = ['A','B','C','D'];
  let quiz = `📚 ${type.toUpperCase()} QUIZ — ${topic.toUpperCase()}\n`;
  quiz += `Difficulty: ${diff} | Items: ${count}\n`;
  quiz += '─'.repeat(50) + '\n\n';

  for (let i = 1; i <= parseInt(count); i++) {
    if (type === 'Multiple Choice') {
      quiz += `${i}. What is an important concept related to ${topic}?\n`;
      quiz += `   A. First concept\n   B. Second concept\n   C. Third concept\n   D. Fourth concept\n\n`;
    } else if (type === 'True or False') {
      quiz += `${i}. ${topic} has practical applications in modern computing. (True/False)\n\n`;
    } else if (type === 'Essay') {
      quiz += `${i}. Discuss the significance of ${topic}. Provide examples and real-world applications.\n\n`;
    } else {
      quiz += `${i}. What is the key term that defines the core principle of ${topic}?\n`;
      quiz += `   Answer: _______________\n\n`;
    }
  }

  quiz += '─'.repeat(50) + '\n--- ANSWER KEY ---\n';
  for (let i = 1; i <= parseInt(count); i++) {
    if (type === 'Multiple Choice') quiz += `${i}. ${mcAnswers[(i - 1) % 4]}\n`;
    else if (type === 'True or False') quiz += `${i}. ${i % 2 === 0 ? 'False' : 'True'}\n`;
    else if (type !== 'Essay') quiz += `${i}. [Sample answer about ${topic}]\n`;
  }

  return quiz;
}

function mdToHtml(text) {
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^#{3} (.+)$/gm, '<h4 style="margin:14px 0 4px;font-size:0.95rem;font-weight:800;">$1</h4>')
    .replace(/^#{2} (.+)$/gm, '<h3 style="margin:16px 0 6px;font-size:1.05rem;font-weight:800;">$1</h3>')
    .replace(/^#{1} (.+)$/gm, '<h2 style="margin:18px 0 8px;font-size:1.15rem;font-weight:900;">$1</h2>')
    .replace(/^[-*] (.+)$/gm, '<li style="margin-left:18px;margin-bottom:4px;">$1</li>')
    .replace(/(<li.*<\/li>)/gs, '<ul style="padding-left:8px;margin:6px 0;">$1</ul>')
    .replace(/\n{2,}/g, '</p><p style="margin:0 0 10px;">')
    .replace(/\n/g, '<br>');
}

function renderQuizOutput(text, type) {
  const output = document.getElementById('quiz-output');
  if (!output) return;

  const parts = text.split('--- ANSWER KEY ---');
  const questions = mdToHtml(parts[0].trim());
  const answers = parts[1] ? mdToHtml(parts[1].trim()) : null;

  let html = `<div class="quiz-questions" style="font-size:0.9rem;line-height:1.8;">${questions}</div>`;

  if (answers) {
    html += `
      <details class="quiz-answer-key">
        <summary style="display:flex;align-items:center;gap:6px;">${icon('tasks',14)} Show Answer Key</summary>
        <div style="margin-top:12px;font-size:0.88rem;line-height:1.8;">${answers}</div>
      </details>`;
  }

  html += `
    <div class="quiz-actions-row">
      <button class="btn-primary" style="background:var(--blue);" onclick="regenerateQuiz()">${icon('refresh',15)} Regenerate</button>
    </div>`;

  output.innerHTML = html;
}

function copyQuiz() {
  const output = document.getElementById('quiz-output');
  if (!output) return;
  const clone = output.cloneNode(true);
  clone.querySelectorAll('.quiz-actions-row, details summary, button').forEach(el => el.remove());
  const text = clone.innerText.trim();
  if (!text || text.includes('will appear here')) { showToast('No quiz to copy'); return; }
  navigator.clipboard.writeText(text).then(() => showToast('Quiz copied!')).catch(() => showToast('Copy failed'));
}

function regenerateQuiz() {
  if (!_lastQuizParams) { showToast('Generate a quiz first'); return; }
  const { topic, count, type, diff } = _lastQuizParams;
  const topicEl = document.getElementById('quiz-topic');
  const countEl = document.getElementById('quiz-count');
  const typeEl = document.getElementById('quiz-type');
  const diffEl = document.getElementById('quiz-diff');
  if (topicEl) topicEl.value = topic;
  if (countEl) countEl.value = count;
  if (typeEl) typeEl.value = type;
  if (diffEl) diffEl.value = diff;
  generateQuiz();
}

async function saveQuizHistory(topic, type, diff, count, content) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('quiz_history').insert({ user_id: user.id, topic, quiz_type: type, difficulty: diff, item_count: count, content });
    renderQuizHistoryList();
  } catch (e) { console.warn('Quiz history save failed', e); }
}

async function loadQuizHistory() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const { data } = await supabase.from('quiz_history').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20);
    return data || [];
  } catch { return []; }
}

async function renderQuizHistoryList() {
  const container = document.getElementById('quiz-history-list');
  if (!container) return;
  const history = await loadQuizHistory();
  if (!history.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;padding:12px 0;">No quiz history yet.</p>';
    return;
  }
  container.innerHTML = history.map(h => {
    const d = new Date(h.created_at);
    const label = `${d.toLocaleDateString()} ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;
    return `<div class="quiz-history-item" style="padding:10px 12px;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;transition:0.15s;display:flex;align-items:center;gap:8px;" onmouseover="this.style.background='var(--blue-tint)'" onmouseout="this.style.background=''">
      <div style="flex:1;min-width:0;cursor:pointer;" onclick="loadQuizFromHistory(${h.id})">
        <div style="font-weight:600;font-size:0.88rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(h.topic)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);margin-top:2px;">${h.quiz_type} · ${h.difficulty} · ${h.item_count} items · ${label}</div>
      </div>
      <button onclick="deleteQuizHistory(${h.id})" title="Delete" style="flex-shrink:0;background:none;border:none;cursor:pointer;color:var(--danger);padding:4px;border-radius:6px;display:flex;align-items:center;" onmouseover="this.style.background='#fff0f0'" onmouseout="this.style.background='none'">${icon('trash', 14)}</button>
    </div>`;
  }).join('');
}

async function deleteQuizHistory(id) {
  const { error } = await supabase.from('quiz_history').delete().eq('id', id);
  if (error) { showToast('Failed to delete history'); return; }
  renderQuizHistoryList();
  showToast('History entry deleted');
}

async function clearAllQuizHistory() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase.from('quiz_history').delete().eq('user_id', user.id);
  if (error) { showToast('Failed to clear history'); return; }
  renderQuizHistoryList();
  showToast('Quiz history cleared');
}

async function loadQuizFromHistory(id) {
  const history = await loadQuizHistory();
  const entry = history.find(h => h.id === id);
  if (!entry) return;
  const topicEl = document.getElementById('quiz-topic');
  const countEl = document.getElementById('quiz-count');
  const typeEl  = document.getElementById('quiz-type');
  const diffEl  = document.getElementById('quiz-diff');
  if (topicEl) topicEl.value = entry.topic;
  if (countEl) countEl.value = entry.item_count;
  if (typeEl)  typeEl.value  = entry.quiz_type;
  if (diffEl)  diffEl.value  = entry.difficulty;
  _lastQuizParams = { topic: entry.topic, count: entry.item_count, type: entry.quiz_type, diff: entry.difficulty };
  renderQuizOutput(entry.content, entry.quiz_type);
  showToast('Quiz loaded from history');
}

function initQuizPage() {
  const topicEl = document.getElementById('quiz-topic');
  if (!topicEl) return;
  topicEl.oninput = function () {
    this.style.height = '0';
    this.style.height = this.scrollHeight + 'px';
  };
  renderQuizHistoryList();
}

function exportQuiz() {
  const output = document.getElementById('quiz-output');
  const text = output.innerText;
  if (!text || text.includes('will appear here')) { showToast('No quiz to export'); return; }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const margin = 40;
    const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
    const lines = doc.splitTextToSize(text, pageWidth);
    let y = margin;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    lines.forEach(line => {
      if (y > doc.internal.pageSize.getHeight() - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 16;
    });
    const topic = _lastQuizParams?.topic || 'quiz';
    doc.save(`${topic.replace(/\s+/g, '_')}_quiz.pdf`);
    showToast('Quiz exported as PDF!');
  } catch {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'quiz.txt';
    a.click();
    showToast('Quiz exported!');
  }
}
