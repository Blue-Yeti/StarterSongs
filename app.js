// Helper to escape HTML tags
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Helper to escape single quotes for inline JS attributes
function escapeQuotes(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

// Helper to find a song object in the phases list
function findSong(artist, title) {
  for (let p of phases) {
    for (let s of p.songs) {
      if (s.artist === artist && s.title === title) {
        return s;
      }
    }
  }
  return null;
}

// Global toggle for iframe player
window.toggleSong = function(el, ytId) {
  el.classList.toggle('open');
  const container = el.querySelector('.song-video');
  
  if (el.classList.contains('open')) {
    if (container && container.innerHTML.trim() === '' && ytId && ytId !== 'undefined') {
      container.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${ytId}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }
  } else {
    if (container) {
      container.innerHTML = '';
    }
  }
};

// Global switcher for lyrics language tab
window.switchLyricTab = function(buttonEl, lang, artist, title) {
  // Find container and remove active classes
  const tabsContainer = buttonEl.parentElement;
  tabsContainer.querySelectorAll('.lyric-tab-btn').forEach(btn => btn.classList.remove('active'));
  buttonEl.classList.add('active');
  
  const songEl = buttonEl.closest('.song');
  const contentContainer = songEl.querySelector('.song-lyrics-content');
  
  // Start transition fade-out
  contentContainer.classList.add('switching');
  
  const song = findSong(artist, title);
  if (!song) return;
  
  const cacheKey = `${artist} - ${title}`;
  
  setTimeout(() => {
    // Check if this tab is still the active one before rendering
    if (!buttonEl.classList.contains('active')) return;
    
    // Reset scroll position on language switch
    contentContainer.scrollTop = 0;
    
    if (lang === 'en') {
      contentContainer.innerHTML = `<div class="song-lyrics-english-only">${escapeHTML(song.lyrics)}</div>`;
      contentContainer.classList.remove('switching');
      return;
    }
    
    const cached = window.lyricsTranslations && window.lyricsTranslations[cacheKey];
    
    if (cached && cached[lang]) {
      renderSideBySide(contentContainer, song.lyrics, cached[lang]);
      contentContainer.classList.remove('switching');
    } else {
      // Show spinner (no delay for switching out of spinner, but keep it smooth)
      contentContainer.innerHTML = `
        <div class="lyrics-loading">
          <div class="lyrics-spinner"></div>
          <span>Translating lyrics on-the-fly...</span>
        </div>
      `;
      contentContainer.classList.remove('switching');
      
      // Fetch translation dynamically
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${lang}&dt=t&q=${encodeURIComponent(song.lyrics)}`;
      fetch(url)
        .then(res => {
          if (!res.ok) throw new Error('HTTP error');
          return res.json();
        })
        .then(data => {
          if (data && data[0]) {
            const translatedText = data[0].map(x => x[0]).join('');
            
            if (!window.lyricsTranslations) window.lyricsTranslations = {};
            if (!window.lyricsTranslations[cacheKey]) window.lyricsTranslations[cacheKey] = {};
            window.lyricsTranslations[cacheKey][lang] = translatedText;
            
            // Render only if this tab is still active
            if (buttonEl.classList.contains('active')) {
              contentContainer.classList.add('switching');
              setTimeout(() => {
                if (buttonEl.classList.contains('active')) {
                  renderSideBySide(contentContainer, song.lyrics, translatedText);
                  contentContainer.classList.remove('switching');
                }
              }, 150);
            }
          } else {
            throw new Error('Invalid response');
          }
        })
        .catch(err => {
          console.error(err);
          if (buttonEl.classList.contains('active')) {
            contentContainer.innerHTML = `
              <div class="lyrics-error">
                Failed to load translation. Please check your internet connection and try again.
              </div>
            `;
          }
        });
    }
  }, 150); // Match CSS transition duration
};

function renderSideBySide(container, english, translated) {
  const enLines = english.split('\n');
  const trLines = translated.split('\n');
  
  let html = '<div class="song-lyrics-side">';
  const len = Math.max(enLines.length, trLines.length);
  
  for (let i = 0; i < len; i++) {
    const enLine = (enLines[i] || '').trim();
    const trLine = (trLines[i] || '').trim();
    
    if (!enLine && !trLine) {
      html += '<div class="lyrics-row empty-row"></div>';
    } else {
      html += `
        <div class="lyrics-row">
          <div class="line-en">${escapeHTML(enLine)}</div>
          <div class="line-tr">${escapeHTML(trLine)}</div>
        </div>
      `;
    }
  }
  
  html += '</div>';
  container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  
  // Update total song count dynamically
  let totalSongs = 0;
  phases.forEach(phase => {
    totalSongs += phase.songs.length;
  });
  const songCountEl = document.getElementById('song-count');
  if (songCountEl) {
    songCountEl.textContent = totalSongs;
  }

  phases.forEach(phase => {
    const section = document.createElement('section');
    section.className = 'phase';

    const songsHTML = phase.songs.map(s => {
      const escapedArtist = escapeQuotes(s.artist);
      const escapedTitle = escapeQuotes(s.title);
      
      const lyricsHTML = s.lyrics ? `
        <div class="song-lyrics-toggle" onclick="this.nextElementSibling.classList.toggle('show'); event.stopPropagation();">Show/Hide Lyrics</div>
        <div class="song-lyrics" onclick="event.stopPropagation()">
          <div class="song-lyrics-header">
            <span style="font-size:11px; font-weight:700; color:var(--text-dim); text-transform:uppercase; letter-spacing:0.5px;">Lyrics</span>
            <div class="lyrics-tabs">
              <button class="lyric-tab-btn active" onclick="switchLyricTab(this, 'en', '${escapedArtist}', '${escapedTitle}')">English</button>
              <button class="lyric-tab-btn" onclick="switchLyricTab(this, 'uk', '${escapedArtist}', '${escapedTitle}')">EN | UA</button>
              <button class="lyric-tab-btn" onclick="switchLyricTab(this, 'ru', '${escapedArtist}', '${escapedTitle}')">EN | RU</button>
            </div>
          </div>
          <div class="song-lyrics-content">
            <div class="song-lyrics-english-only">${escapeHTML(s.lyrics)}</div>
          </div>
        </div>
      ` : '';

      return `
        <div class="song" style="--phase-color: ${phase.color}; --phase-color-alpha: ${phase.color}22; --phase-color-glow: ${phase.color}0a;" onclick="toggleSong(this, '${s.yt}')">
          <div class="song-num" style="background:${phase.color}22;color:${phase.color}">${s.n}</div>
          <div class="song-info">
            <div class="song-title">${s.title}</div>
            <div class="song-artist">${s.artist}</div>
          </div>
          <span class="song-chevron">›</span>
          <div class="song-note" onclick="event.stopPropagation()">
            <p>${s.note}</p>
            ${s.yt ? `<div class="song-video"></div>` : ''}
            ${lyricsHTML}
          </div>
        </div>
      `;
    }).join('');

    section.innerHTML = `
      <div class="phase-header">
        <div class="phase-dot" style="color:${phase.color};background:${phase.color}"></div>
        <span class="phase-title">${phase.title}</span>
        <span class="phase-level" style="color:${phase.color}">${phase.level}</span>
      </div>
      <p class="phase-desc">${phase.description}</p>
      <div class="song-list">${songsHTML}</div>
    `;

    app.appendChild(section);
  });
});
