// KCIC Academic Blog - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  
  // ===== NOTIFICATION COUNT =====
  const notifCount = document.getElementById('notifCount');
  if (notifCount) {
    fetch('/api/notifications/count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) {
          notifCount.textContent = data.count;
          notifCount.style.display = 'inline';
        }
      }).catch(() => {});
  }

  // Pending articles badge in admin sidebar
  const pendingBadge = document.getElementById('pendingCount');
  if (pendingBadge) {
    fetch('/api/articles/pending-count')
      .then(r => r.json())
      .then(data => {
        if (data.count > 0) {
          pendingBadge.textContent = data.count;
        }
      }).catch(() => {});
  }

  // ===== SEARCH SUGGESTIONS =====
  const navSearch = document.getElementById('navSearch');
  const suggestions = document.getElementById('searchSuggestions');
  if (navSearch && suggestions) {
    let debounceTimer;
    navSearch.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      const q = this.value.trim();
      if (q.length < 2) { suggestions.style.display = 'none'; return; }
      debounceTimer = setTimeout(() => {
        fetch(`/api/search/suggestions?q=${encodeURIComponent(q)}`)
          .then(r => r.json())
          .then(items => {
            if (items.length > 0) {
              suggestions.innerHTML = items.map(item => 
                `<div class="search-suggestion-item" onclick="location.href='/article/${item.slug}'">
                  <i class="fas fa-file-alt me-2 text-muted"></i>${item.title}
                </div>`
              ).join('');
              suggestions.style.display = 'block';
            } else {
              suggestions.style.display = 'none';
            }
          }).catch(() => suggestions.style.display = 'none');
      }, 300);
    });
    document.addEventListener('click', e => {
      if (!e.target.closest('.nav-search')) suggestions.style.display = 'none';
    });
  }

  // ===== ARTICLE SAVE BUTTON =====
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      const articleId = this.dataset.articleId;
      fetch(`/api/articles/${articleId}/save`, { method: 'POST' })
        .then(r => {
          if (r.status === 401) { location.href = '/auth/login'; return; }
          return r.json();
        })
        .then(data => {
          if (!data) return;
          if (data.saved) {
            this.classList.add('saved');
            this.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
          } else {
            this.classList.remove('saved');
            this.innerHTML = '<i class="far fa-bookmark"></i> Save';
          }
        }).catch(() => {});
    });
  }

  // ===== ARTICLE LIKE BUTTON =====
  const likeBtn = document.getElementById('likeBtn');
  if (likeBtn) {
    likeBtn.addEventListener('click', function() {
      const articleId = this.dataset.articleId;
      fetch(`/api/articles/${articleId}/like`, { method: 'POST' })
        .then(r => {
          if (r.status === 401) { location.href = '/auth/login'; return; }
          return r.json();
        })
        .then(data => {
          if (!data) return;
          const countEl = document.getElementById('likeCount');
          if (data.liked) {
            this.classList.add('liked');
            this.innerHTML = `<i class="fas fa-heart"></i> <span id="likeCount">${data.count}</span>`;
          } else {
            this.classList.remove('liked');
            this.innerHTML = `<i class="far fa-heart"></i> <span id="likeCount">${data.count}</span>`;
          }
        }).catch(() => {});
    });
  }

  // ===== SHARE BUTTON =====
  const shareBtn = document.getElementById('shareBtn');
  if (shareBtn) {
    shareBtn.addEventListener('click', function() {
      if (navigator.share) {
        navigator.share({ title: document.title, url: location.href }).catch(() => {});
      } else {
        navigator.clipboard.writeText(location.href).then(() => {
          this.innerHTML = '<i class="fas fa-check"></i> Copied!';
          setTimeout(() => this.innerHTML = '<i class="fas fa-share-alt"></i> Share', 2000);
        }).catch(() => {});
      }
    });
  }

  // ===== ADMIN SIDEBAR TOGGLE =====
  const sidebarToggle = document.getElementById('sidebarToggleBtn');
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  const sidebarClose = document.getElementById('sidebarClose');

  function openSidebar() {
    sidebar && sidebar.classList.add('open');
    overlay && overlay.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
  function closeSidebar() {
    sidebar && sidebar.classList.remove('open');
    overlay && overlay.classList.remove('show');
    document.body.style.overflow = '';
  }

  if (sidebarToggle) sidebarToggle.addEventListener('click', openSidebar);
  if (sidebarClose) sidebarClose.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // ===== CONFIRM DIALOGS =====
  document.querySelectorAll('[data-confirm]').forEach(el => {
    el.addEventListener('click', function(e) {
      if (!confirm(this.dataset.confirm)) e.preventDefault();
    });
  });

  // ===== SCROLL TO TOP =====
  const scrollBtn = document.createElement('button');
  scrollBtn.className = 'scroll-top-btn';
  scrollBtn.innerHTML = '<i class="fas fa-chevron-up"></i>';
  scrollBtn.title = 'Back to top';
  document.body.appendChild(scrollBtn);

  window.addEventListener('scroll', () => {
    scrollBtn.classList.toggle('show', window.scrollY > 400);
  });
  scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  // ===== AUTO-DISMISS ALERTS =====
  document.querySelectorAll('.alert-auto-dismiss').forEach(alert => {
    setTimeout(() => {
      alert.style.transition = 'opacity 0.5s';
      alert.style.opacity = '0';
      setTimeout(() => alert.remove(), 500);
    }, 4000);
  });

  // ===== READING PROGRESS BAR =====
  const progressBar = document.getElementById('readingProgress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = (window.scrollY / docHeight) * 100;
      progressBar.style.width = `${Math.min(100, progress)}%`;
    });
  }

  // ===== ARTICLE EDITOR TOOLBAR =====
  const editorBtns = document.querySelectorAll('.editor-btn');
  const contentArea = document.getElementById('articleContent');
  if (contentArea && editorBtns.length > 0) {
    editorBtns.forEach(btn => {
      btn.addEventListener('click', function(e) {
        e.preventDefault();
        const action = this.dataset.action;
        const sel = { start: contentArea.selectionStart, end: contentArea.selectionEnd };
        const selected = contentArea.value.substring(sel.start, sel.end);
        let replacement = '';

        switch(action) {
          case 'bold': replacement = `**${selected || 'bold text'}**`; break;
          case 'italic': replacement = `*${selected || 'italic text'}*`; break;
          case 'h2': replacement = `\n## ${selected || 'Heading 2'}\n`; break;
          case 'h3': replacement = `\n### ${selected || 'Heading 3'}\n`; break;
          case 'link': 
            const url = prompt('Enter URL:');
            if (url) replacement = `[${selected || 'link text'}](${url})`;
            break;
          case 'quote': replacement = `\n> ${selected || 'quote text'}\n`; break;
          case 'code': replacement = selected ? `\`${selected}\`` : `\`\`\`\ncode here\n\`\`\``; break;
          case 'list': replacement = `\n- ${selected || 'list item'}\n`; break;
          case 'hr': replacement = '\n---\n'; break;
        }

        if (replacement) {
          contentArea.value = contentArea.value.substring(0, sel.start) + replacement + contentArea.value.substring(sel.end);
          contentArea.focus();
          const newPos = sel.start + replacement.length;
          contentArea.setSelectionRange(newPos, newPos);
        }
      });
    });
  }

  // ===== CHAR COUNT FOR EXCERPT =====
  const excerptField = document.getElementById('articleExcerpt');
  const excerptCount = document.getElementById('excerptCount');
  if (excerptField && excerptCount) {
    excerptField.addEventListener('input', function() {
      excerptCount.textContent = this.value.length;
    });
  }

  // ===== TABLE SEARCH FILTER =====
  const tableSearch = document.getElementById('tableSearch');
  if (tableSearch) {
    tableSearch.addEventListener('input', function() {
      const term = this.value.toLowerCase();
      document.querySelectorAll('.searchable-row').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(term) ? '' : 'none';
      });
    });
  }

  // ===== ANNOUNCEMENT DISMISS =====
  document.querySelectorAll('.announcement-dismiss').forEach(btn => {
    btn.addEventListener('click', function() {
      this.closest('.announcement-banner').style.opacity = '0';
      this.closest('.announcement-banner').style.transition = 'opacity 0.3s';
      setTimeout(() => this.closest('.announcement-banner').remove(), 300);
    });
  });

  // ===== ANALYTICS CHARTS (if Chart.js is loaded) =====
  const viewsChartEl = document.getElementById('viewsChart');
  if (viewsChartEl && typeof Chart !== 'undefined') {
    const data = JSON.parse(viewsChartEl.dataset.values || '[]');
    const labels = JSON.parse(viewsChartEl.dataset.labels || '[]');
    new Chart(viewsChartEl, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Daily Views',
          data,
          borderColor: '#1a3c5e',
          backgroundColor: 'rgba(26,60,94,0.1)',
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#1a3c5e',
          pointRadius: 4
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } }
      }
    });
  }

  const categoryChartEl = document.getElementById('categoryChart');
  if (categoryChartEl && typeof Chart !== 'undefined') {
    const data = JSON.parse(categoryChartEl.dataset.values || '[]');
    const labels = JSON.parse(categoryChartEl.dataset.labels || '[]');
    const colors = JSON.parse(categoryChartEl.dataset.colors || '[]');
    new Chart(categoryChartEl, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 3, borderColor: 'white' }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, padding: 15 } } }
      }
    });
  }
});
