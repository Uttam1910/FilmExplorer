document.addEventListener('DOMContentLoaded', () => {
  /*
    FilmExplorer — Refactored frontend
    - Keeps OMDb integration intact (API key is configurable below)
    - Implements debounced live search with AbortController
    - Modular rendering, bookmarks, modal, toasts, suggestions
  */

  const CONFIG = {
    apiKey: '2c4b917e', // replace with your key if desired
    pageSize: 10,
    maxRecent: 10
  };

  // DOM refs
  const $ = sel => document.getElementById(sel);
  const movieGrid = $('movie-grid');
  const statusLine = $('status-line');
  const loadMoreBtn = $('load-more');
  const totalResultsSpan = $('total-results');
  const resultsTitle = $('results-title');
  const resultCount = $('result-count');
  const suggestionsPanel = $('suggestions-panel');
  const recentList = $('recent-list');
  const popularList = $('popular-list');
  const clearRecentBtn = $('clear-recent');
  const bookmarksGrid = $('bookmarks-grid');
  const bookmarksSection = $('bookmarks');
  const bookmarksEmpty = $('bookmarks-empty');
  const bookmarkCountEl = $('bookmark-count');
  const modal = $('modal');
  const modalBackdrop = $('modal-backdrop');
  const modalClose = $('modal-close');
  const modalContent = $('modal-content');
  const toastContainer = $('toast-container');
  const searchForm = $('search-form');
  const movieInput = $('movie-input');
  const searchTypeSelect = $('search-type');
  const clearInputBtn = $('clear-input');
  const discoverGrid = $('discover-grid');
  const trendingGrid = $('trending-grid');

  // State
  let state = {
    query: '',
    type: 'all',
    page: 1,
    totalResults: 0,
    fetchedPage: 0,
    collected: [], // unique by imdbID
    lastController: null
  };

  // Small curated lists for discovery/trending
  const CURATED = ['Inception','Interstellar','The Dark Knight','Parasite','The Matrix','The Shawshank Redemption'];
  const POPULAR = ['Avengers','Titanic','Joker','Forrest Gump','Gladiator'];
  // lightweight category seeds (small curated sets to avoid extra API usage)
  const CAT_ACTION = ['Mad Max: Fury Road','John Wick','Gladiator','The Dark Knight'];
  const CAT_SCIFI = ['Blade Runner 2049','The Matrix','Interstellar','Arrival'];
  const CAT_COMEDY = ['The Grand Budapest Hotel','Superbad','Groundhog Day','Ghostbusters'];
  const CAT_CLASSICS = ['Casablanca','Citizen Kane','The Godfather','Rear Window'];

  // --- Utilities ---
  function debounce(fn, wait=350){ let t; return (...a)=>{ clearTimeout(t); t = setTimeout(()=>fn(...a), wait); }; }

  function createNode(tag='div', attrs={}, children=[]){ const el = document.createElement(tag); for(const k in attrs){ if(k==='class') el.className = attrs[k]; else if(k.startsWith('on') && typeof attrs[k]==='function') el.addEventListener(k.slice(2), attrs[k]); else el.setAttribute(k, attrs[k]); } children.forEach(c=> el.append(typeof c === 'string' ? document.createTextNode(c) : c)); return el; }

  function escapeHtml(s){ return String(s||'').replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }

  function posterFallback(title, w=300, h=450){ const t = (title||'No Image').replace(/&/g,'and').slice(0,24); const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='#0b1220'/><text x='50%' y='50%' fill='#9aa4b2' font-family='Inter,sans-serif' font-size='18' text-anchor='middle'>${escapeHtml(t)}</text></svg>`; return 'data:image/svg+xml;base64,' + btoa(svg); }

  function uniqById(arr){ const seen=new Set(); return arr.filter(i=>{ const id=i.imdbID||i.Title; if(seen.has(id)) return false; seen.add(id); return true; }); }

  // Toasts
  function toast(text, opts={timeout:3500}){ try{ const t = createNode('div',{class:'toast'},[text]); toastContainer.appendChild(t); setTimeout(()=>{ t.style.opacity='0'; t.addEventListener('transitionend',()=>t.remove(),{once:true}); }, opts.timeout); }catch(e){} }

  // clipboard helper
  async function copyToClipboard(text){ try{ await navigator.clipboard.writeText(text); return true; }catch(e){ return false; } }

  // open a YouTube search for <title> official trailer in a new tab
  function openTrailerFor(title){ if(!title) return; const q = encodeURIComponent(title + ' official trailer'); const url = `https://www.youtube.com/results?search_query=${q}`; window.open(url, '_blank', 'noopener'); }

  // Generate a deterministic short 'Why You Might Like It' insight from details
  function generateInsight(d){ try{ if(!d) return null; const parts = []; const genres = (d.Genre && d.Genre!=='N/A') ? d.Genre.split(',').map(s=>s.trim()) : []; const runtime = (d.Runtime && d.Runtime!=='N/A') ? d.Runtime : ''; const year = d.Year || ''; const director = (d.Director && d.Director!=='N/A') ? d.Director.split(',')[0] : ''; const actors = (d.Actors && d.Actors!=='N/A') ? d.Actors.split(',').slice(0,2).join(', ') : ''; const rating = (d.imdbRating && d.imdbRating!=='N/A') ? `IMDb ${d.imdbRating}` : ''; // build phrases
      if(genres.length) parts.push(`${genres[0]}${genres.length>1? ' • '+genres.slice(1,3).join(', '):''}`);
      if(d.Plot && d.Plot!=='N/A'){
        // pick short characteristic words from the plot
        const p = d.Plot.split('.').filter(s=>s.trim()).slice(0,1)[0]; if(p) parts.push(p.trim());
      }
      const tail = [];
      if(director) tail.push(`directed by ${director}`);
      if(actors) tail.push(`starring ${actors}`);
      if(runtime) tail.push(runtime);
      if(year) tail.push(year);
      if(rating) tail.push(rating);
      const insight = parts.concat(tail).slice(0,3).join(' — ');
      // if too short, return null
      if(!insight || insight.length<20) return null; return insight;
  }catch(e){ return null; } }

  // Share helper: use Web Share API with fallback to clipboard + toast
  async function shareMovie(d){ try{ const url = new URL(window.location.href); if(d && d.imdbID) url.searchParams.set('movie', d.imdbID); const shareUrl = url.toString(); const text = `${d.Title || 'FilmExplorer movie'} — ${d.Year || ''}`.trim(); if(navigator.share){ await navigator.share({ title: d.Title, text: `${text}\n\n${d.Plot? d.Plot.slice(0,140): ''}`, url: shareUrl }); toast('Shared'); return; } const ok = await copyToClipboard(shareUrl); if(ok) toast('Movie link copied'); else toast('Could not copy link'); }catch(e){ const ok = await copyToClipboard(window.location.href); if(ok) toast('Movie link copied'); else toast('Could not copy link'); } }

  // --- Bookmarks storage helpers ---
  const BOOKMARK_KEY = 'filmexplorer:bookmarks';
  function loadBookmarks(){ try{ return JSON.parse(localStorage.getItem(BOOKMARK_KEY)||'{}'); }catch(e){ return {}; } }
  function saveBookmarks(obj){ try{ localStorage.setItem(BOOKMARK_KEY, JSON.stringify(obj)); updateBookmarkUI(); }catch(e){} }
  // --- Details view (mobile-first full-screen) ---
  const detailView = $('detail-view');
  const detailContent = $('detail-content');
  const detailBack = $('detail-back');
  const detailBackdrop = $('detail-backdrop');
  const detailActions = $('detail-actions');

  function openDetailView(){
    if(!detailView) return;
    // deterministic: set hidden/aria-hidden as the single source of truth
    try{
      if(detailBackdrop){ detailBackdrop.hidden = false; detailBackdrop.setAttribute('aria-hidden','false'); }
      detailView.hidden = false; detailView.setAttribute('aria-hidden','false');
      // lock scroll on documentElement for consistent behavior
      document.documentElement.style.overflow = 'hidden';
      // focus the back control for accessibility
      detailBack && detailBack.focus();
    }catch(e){ console.error('openDetailView failed', e); }
  }
  function closeDetailView(){
    if(!detailView) return;
    try{
      // set closed state deterministically
      if(detailBackdrop){ detailBackdrop.hidden = true; detailBackdrop.setAttribute('aria-hidden','true'); }
      detailView.hidden = true; detailView.setAttribute('aria-hidden','true');
      // clear content and restore scrolling
      detailContent.innerHTML = '';
      document.documentElement.style.overflow = '';
      // restore focus to the search input so keyboard users can continue
      if(movieInput){ movieInput.focus(); }
      // don't rely on history.back unless explicitly set by a caller
    }catch(e){ console.error('closeDetailView failed', e); }
  }

  // Hook back button
  if(detailBack) detailBack.addEventListener('click', ()=> closeDetailView());
  // Click on backdrop should also close detail view
  if(detailBackdrop) detailBackdrop.addEventListener('click', ()=> closeDetailView());

  // Also keep modal as fallback for desktop
  function openModal(){ modal.setAttribute('aria-hidden','false'); modal.style.display='flex'; document.documentElement.style.overflow='hidden'; modalClose.focus(); }
  function closeModal(){ modal.setAttribute('aria-hidden','true'); modal.style.display='none'; modalContent.innerHTML=''; document.documentElement.style.overflow=''; }
  modalClose.addEventListener('click', closeModal); modalBackdrop.addEventListener('click', closeModal); document.addEventListener('keydown', (e)=>{ if(e.key==='Escape'){ if(detailView && detailView.getAttribute('aria-hidden')==='false') closeDetailView(); if(modal && modal.getAttribute('aria-hidden')==='false') closeModal(); } });

  // Unified openDetails: will open mobile full-screen view on small screens, otherwise desktop modal
  async function openDetails(id, movie){
    // prefer cached details
    try{
      let data = null;
      const cacheKey = `filmexplorer:detail:${id}`;
      const cached = loadCache(cacheKey);
      if(cached) data = cached;
      else data = await apiDetails(id);
      // cache small
      saveCache(cacheKey, data, 1000 * 60 * 60 * 24); // 24h
      // always render into full-screen detail view for consistent layout
      if(detailContent){ detailContent.innerHTML = ''; detailContent.appendChild(renderDetailPage(data)); }
      openDetailView();
      // push state and update url for back/share behavior
      updateURLForDetail(state.query, state.type, state.fetchedPage, data.imdbID);
      addRecentlyViewed(data);
      // keep main content visible behind the detail panel (dimmed backdrop)
    }catch(err){ console.error(err); if(detailContent) detailContent.innerHTML = `<div class="empty-state muted"><h4>Error</h4><p>${escapeHtml(err.message||'Failed to load')}</p></div>`; }
  }

  // render detail page as DOM Node
  function renderDetailPage(d){
    // create an inner panel that will be scrolled if content is long
    const inner = createNode('div',{class:'detail-inner'},[]);
    const posterWrap = createNode('div',{class:'detail-poster'},[]);
    const img = document.createElement('img'); img.alt = d.Title||'Poster'; img.src = (d.Poster && d.Poster!=='N/A')? d.Poster : posterFallback(d.Title,400,600); img.addEventListener('error', ()=>{ img.src = posterFallback(d.Title,400,600); }); posterWrap.appendChild(img);
    const grid = createNode('div',{class:'detail-grid'},[]);
    const h = createNode('h1',{},[d.Title||'Untitled', createNode('small',{class:'muted'},[` ${d.Year||''}`])]);
    const meta = createNode('div',{class:'detail-meta muted'},[ `${d.Runtime && d.Runtime!=='N/A' ? d.Runtime : ''} ${d.Genre && d.Genre!=='N/A' ? '• '+d.Genre : ''}` ]);
    const rating = (d.imdbRating && d.imdbRating!=='N/A') ? createNode('div',{class:'muted'},[ `⭐ ${d.imdbRating} • ${d.imdbVotes || ''}` ]) : null;
    const plot = d.Plot && d.Plot!=='N/A' ? createNode('p',{},[d.Plot]) : null;
    const people = createNode('div',{},[]);
    ['Director','Writer','Actors'].forEach(k=>{ if(d[k] && d[k]!=='N/A') people.appendChild(createNode('div',{},[ createNode('strong',{},[k+': ']), ' '+d[k] ])); });
    const production = createNode('div',{},[]);
    ['Language','Country','Awards','BoxOffice','Production','Released','DVD','Website'].forEach(k=>{ if(d[k] && d[k]!=='N/A') production.appendChild(createNode('div',{},[ createNode('strong',{},[k+': ']), ' '+d[k] ])); });
    const actions = createNode('div',{class:'detail-actions'},[]);
    // primary actions: Trailer, Watchlist, Share, IMDb
    const trailerBtn = createNode('button',{class:'action-btn', onclick:()=> openTrailerFor(d.Title)},['▶ Trailer']);
    const bmBtn = createNode('button',{class:'action-btn', onclick:()=>{ toggleBookmark(d); updateDetailBookmark(bmBtn,d); }},[ isBookmarked(d.imdbID||d.Title)?'Bookmarked':'+ Watchlist' ]);
    const shareBtn = createNode('button',{class:'action-btn', onclick:()=> shareMovie(d)},['↗ Share']);
    const imdbBtn = createNode('a',{href:d.imdbID?`https://www.imdb.com/title/${d.imdbID}/`:'#', target:'_blank', rel:'noopener', class:'action-btn'},['IMDb']);
    actions.appendChild(trailerBtn); actions.appendChild(bmBtn); actions.appendChild(shareBtn); actions.appendChild(imdbBtn);

    grid.appendChild(h); grid.appendChild(meta); if(rating) grid.appendChild(rating); if(plot) grid.appendChild(plot); grid.appendChild(people); grid.appendChild(production); grid.appendChild(actions);

    // FilmExplorer Insight
    const insightText = generateInsight(d);
    if(insightText){ const insight = createNode('div',{class:'detail-insight'},[ createNode('h4',{},['Why You Might Like It']), createNode('p',{},[ insightText ]) ]); grid.appendChild(insight); }

    // More Like This (placeholder carousel)
    const moreLikeWrap = createNode('div',{class:'more-like'},[]);
    const moreTitle = createNode('h4',{},['More Like This']);
    const moreCarousel = createNode('div',{class:'more-like-carousel', id:'more-like-carousel'},[]);
    moreLikeWrap.appendChild(moreTitle); moreLikeWrap.appendChild(moreCarousel); grid.appendChild(moreLikeWrap);

    inner.appendChild(posterWrap); inner.appendChild(grid);
    // populate More Like This asynchronously
    setTimeout(()=>{ loadMoreLikeThis(d); }, 60);
    return inner;
  }

  function updateDetailBookmark(btn, d){ if(!btn) return; btn.textContent = isBookmarked(d.imdbID||d.Title)?'Bookmarked':'Bookmark'; }

  // Recently viewed
  const RECENT_VIEW_KEY = 'filmexplorer:recentViewed';
  function addRecentlyViewed(d){ if(!d) return; try{ const cur = JSON.parse(localStorage.getItem(RECENT_VIEW_KEY) || '[]'); const id = d.imdbID || d.Title; const idx = cur.findIndex(x=> (x.imdbID||x.Title) === id); if(idx!==-1) cur.splice(idx,1); cur.unshift({ imdbID: d.imdbID, Title: d.Title, Year: d.Year, Poster: d.Poster }); if(cur.length>12) cur.pop(); localStorage.setItem(RECENT_VIEW_KEY, JSON.stringify(cur)); renderRecentlyViewed(); }catch(e){} }
  function renderRecentlyViewed(){ try{ const list = JSON.parse(localStorage.getItem(RECENT_VIEW_KEY) || '[]'); const container = $('recently-viewed-grid'); if(!container) return; container.innerHTML=''; if(!list || list.length===0) return; list.slice(0,8).forEach(i=> renderMovieCard(i, container)); } catch(e){} }

  // --- URL / history helpers ---
  function getQueryParams(){ const p = new URLSearchParams(window.location.search); return { q: p.get('q') || '', type: p.get('type') || 'all', page: parseInt(p.get('page')||'1',10) || 1, movie: p.get('movie') || '' }; }
  function updateURLForSearch(q, type, page, replace=true){ try{ const params = new URLSearchParams(); if(q) params.set('q', q); if(type && type!=='all') params.set('type', type); if(page && page>1) params.set('page', String(page)); const url = window.location.pathname + (params.toString()?('?'+params.toString()):''); if(replace) history.replaceState({ q, type, page }, '', url); else history.pushState({ q, type, page }, '', url); }catch(e){} }
  function updateURLForDetail(q, type, page, movieId){ try{ const params = new URLSearchParams(); if(q) params.set('q', q); if(type && type!=='all') params.set('type', type); if(page && page>1) params.set('page', String(page)); if(movieId) params.set('movie', movieId); const url = window.location.pathname + (params.toString()?('?'+params.toString()):''); history.pushState({ q, type, page, movie: movieId }, '', url); }catch(e){} }

  // Simple cache helpers
  function saveCache(key, data, ttl){ try{ const obj = { ts: Date.now(), ttl: ttl||0, data }; localStorage.setItem(key, JSON.stringify(obj)); }catch(e){} }
  function loadCache(key){ try{ const raw = localStorage.getItem(key); if(!raw) return null; const obj = JSON.parse(raw); if(obj.ttl && (Date.now() - obj.ts) > obj.ttl) { localStorage.removeItem(key); return null; } return obj.data; }catch(e){ return null; } }
  function isBookmarked(id){ const b = loadBookmarks(); return !!b[id]; }
  function toggleBookmark(movie){ try{ const id = movie.imdbID || movie.Title; const b = loadBookmarks(); if(b[id]){ delete b[id]; saveBookmarks(b); toast('Removed from watchlist'); } else { b[id]=movie; saveBookmarks(b); toast('Added to watchlist'); } renderBookmarks(); updateAllCardBookmarkStates(); }catch(e){ console.error('Bookmark failed',e); toast('Could not update bookmark'); } }

  function updateAllCardBookmarkStates(){ const cards = document.querySelectorAll('.movie-card'); cards.forEach(card=>{ const id = card.getAttribute('data-id'); const btn = card.querySelector('.bookmark-btn'); if(btn){ btn.textContent = isBookmarked(id)?'Bookmarked':'Bookmark'; btn.setAttribute('aria-pressed', isBookmarked(id)); } }); }
  function updateBookmarkUI(){ const count = Object.keys(loadBookmarks()).length; bookmarkCountEl.textContent = count; }
  function renderBookmarks(){ const bm = loadBookmarks(); const items = Object.values(bm); bookmarksGrid.innerHTML=''; if(items.length===0){ bookmarksEmpty.hidden=false; bookmarksGrid.hidden=true; } else { bookmarksEmpty.hidden=true; bookmarksGrid.hidden=false; items.forEach(m=> renderMovieCard(m, bookmarksGrid, {bookmark:true})); } updateBookmarkUI(); }

  // --- API ---
  async function apiSearch(query, page=1, type='all', signal=null){
    if(!query) return { items: [], total: 0 };
    // If no API key, return empty
    if(!CONFIG.apiKey){ return { items: [], total: 0 }; }
    const params = new URLSearchParams({ s: query, apikey: CONFIG.apiKey, page: String(page) });
    if(type && type!=='all') params.set('type', type);
    const url = `https://www.omdbapi.com/?${params.toString()}`;
    const controller = new AbortController();
    if(signal) signal.addEventListener('abort', ()=>controller.abort(), {once:true});
    try{
      const res = await fetch(url, { signal: controller.signal });
      if(!res.ok) throw new Error(`Network error (${res.status})`);
      const data = await res.json();
      if(data.Response === 'False'){
        if(data.Error && data.Error.toLowerCase().includes('invalid')) throw new Error('Invalid or missing API key.');
        if(data.Error && data.Error.toLowerCase().includes('movie not found')) return { items: [], total: 0 };
        throw new Error(data.Error || 'OMDb error');
      }
      return { items: data.Search || [], total: parseInt(data.totalResults,10) || 0 };
    }catch(err){ throw err; }
  }

  async function apiDetails(imdbID){
    if(!imdbID) throw new Error('Missing ID');
    if(!CONFIG.apiKey) throw new Error('Missing API key');
    const url = `https://www.omdbapi.com/?i=${encodeURIComponent(imdbID)}&plot=full&apikey=${CONFIG.apiKey}`;
    const res = await fetch(url); if(!res.ok) throw new Error('Network error'); const data = await res.json(); if(data.Response==='False') throw new Error(data.Error||'No details'); return data;
  }

  // --- Rendering ---
  function clearResults(){ movieGrid.innerHTML=''; statusLine.textContent=''; resultCount.textContent=''; totalResultsSpan.textContent=''; }

  function showSkeletons(count=8){ movieGrid.innerHTML=''; for(let i=0;i<count;i++){ const s = createNode('article',{class:'movie-card'},[ createNode('div',{class:'poster'},[ createNode('div',{class:'skeleton'}) ]), createNode('div',{class:'card-body'},[ createNode('div',{class:'movie-title'},[' ']), createNode('div',{class:'movie-meta muted'},[' ']) ]) ]); movieGrid.appendChild(s); } }

  function renderMovieCard(m, container, opts={}){
    const id = m.imdbID || m.Title || Math.random().toString(36).slice(2,9);
    const card = createNode('article',{class:'movie-card', role:'article', 'data-id':id});
    const posterWrap = createNode('div',{class:'poster'});
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.alt = m.Title || 'Poster';
    img.src = (m.Poster && m.Poster!=='N/A') ? m.Poster : posterFallback(m.Title);
    img.addEventListener('error', ()=>{ img.src = posterFallback(m.Title); });
    posterWrap.appendChild(img);
    // rating badge if available (avoid extra API calls)
    if(m.imdbRating && m.imdbRating!=='N/A'){
      const rb = createNode('div',{class:'rating-badge'},[ createNode('span',{class:'star'},['⭐']), document.createTextNode(' '+m.imdbRating) ]);
      posterWrap.appendChild(rb);
    }
    const overlay = createNode('div',{class:'overlay'});
    posterWrap.appendChild(overlay);

    const body = createNode('div',{class:'card-body'});
    const title = createNode('h4',{class:'movie-title'},[m.Title||'Untitled']);
    // snapshot metadata: rating, year/runtime, genre
    const snapshot = createNode('div',{class:'movie-snapshot'},[]);
    if(m.imdbRating && m.imdbRating!=='N/A') snapshot.appendChild(createNode('div',{class:'meta-line'},[ `⭐ ${m.imdbRating}` ]));
    const line2 = [];
    if(m.Year) line2.push(m.Year);
    if(m.Runtime && m.Runtime!=='N/A') line2.push(m.Runtime);
    if(line2.length) snapshot.appendChild(createNode('div',{class:'meta-line'},[ line2.join(' · ') ]));
    if(m.Genre && m.Genre!=='N/A') snapshot.appendChild(createNode('div',{class:'meta-line'},[ m.Genre.split(',').slice(0,2).join(' · ') ]));

    const actions = createNode('div',{class:'card-actions'});
    const detailsBtn = createNode('button',{class:'btn-ghost', type:'button', onclick:()=> openDetails(id, m)},['View Details']);
    const bmBtn = createNode('button',{class:'btn-ghost bookmark-btn', type:'button', onclick:()=> { toggleBookmark(m); updateAllCardBookmarkStates(); }},[ isBookmarked(id)?'Bookmarked':'+ Watchlist' ]);
    // subtle IMDb secondary action
    const imdbLink = m.imdbID ? createNode('a',{href:`https://www.imdb.com/title/${m.imdbID}/`, target:'_blank', rel:'noopener', class:'btn-ghost small-link', title:'Open on IMDb'},['IMDb ↗']) : null;
    // Trailer quick action (non-blocking)
    const trailerBtn = createNode('button',{class:'btn-ghost', type:'button', onclick:()=> openTrailerFor(m.Title)},['▶ Trailer']);
    actions.appendChild(detailsBtn);
    actions.appendChild(bmBtn);
    if(imdbLink) actions.appendChild(imdbLink);
    // keep trailer accessible but subtle
    actions.appendChild(trailerBtn);

    body.appendChild(title); body.appendChild(snapshot); body.appendChild(actions);
    card.appendChild(posterWrap); card.appendChild(body);
    container.appendChild(card);

    // Hover & a11y/touch: open details on click of poster
    posterWrap.addEventListener('click', ()=> openDetails(id,m));
  }

  function renderCollected(){ movieGrid.innerHTML=''; const items = state.collected; if(!items || items.length===0){ movieGrid.innerHTML = '<div class="empty-state muted"><h4>No movies found</h4><p>Try another search or browse Discover.</p></div>'; statusLine.textContent=''; return; } items.forEach(m=> renderMovieCard(m, movieGrid)); resultCount.textContent = `${state.collected.length} of ${state.totalResults || state.collected.length}`; totalResultsSpan.textContent = state.totalResults ? `${state.totalResults} total` : ''; }

  // Render pagination controls (Prev / Next and nearby page numbers)
  function renderPagination(total, currentPage){
    const container = document.getElementById('pagination-controls');
    if(!container) return;
    // hide load-more button if present
    const loadMore = document.getElementById('load-more'); if(loadMore) loadMore.style.display='none';
    container.innerHTML='';
    const totalPages = Math.max(1, Math.ceil((total||0)/CONFIG.pageSize));
    if(totalPages <= 1) return;
    const wrap = createNode('div',{class:'pagination-wrap'} ,[]);
    const prev = createNode('button',{class:'pagination-button', onclick:()=>{ if(currentPage>1) performSearch(state.query, currentPage-1, state.type); }},['◀ Prev']);
    const next = createNode('button',{class:'pagination-button', onclick:()=>{ if(currentPage<totalPages) performSearch(state.query, currentPage+1, state.type); }},['Next ▶']);
    wrap.appendChild(prev);
    // render few page numbers around current
    const start = Math.max(1, currentPage-2);
    const end = Math.min(totalPages, currentPage+2);
    if(start>1) wrap.appendChild(createNode('button',{class:'pagination-button', onclick:()=>performSearch(state.query,1,state.type)},['1']));
    if(start>2) wrap.appendChild(createNode('span',{class:'muted'},['…']));
    for(let p=start;p<=end;p++){
      const cls = p===currentPage ? 'pagination-button current' : 'pagination-button';
      wrap.appendChild(createNode('button',{class:cls, onclick:()=>performSearch(state.query,p,state.type)},[String(p)]));
    }
    if(end<totalPages-1) wrap.appendChild(createNode('span',{class:'muted'},['…']));
    if(end<totalPages) wrap.appendChild(createNode('button',{class:'pagination-button', onclick:()=>performSearch(state.query,totalPages,state.type)},[String(totalPages)]));
    wrap.appendChild(next);
    container.appendChild(wrap);
  }

  // --- Search flow ---
  async function abortOngoing(){ if(state.lastController) try{ state.lastController.abort(); }catch(e){} state.lastController = new AbortController(); return state.lastController.signal; }

  async function performSearch(query, page=1, type='all'){
    query = (query||'').trim();
    if(!query){ clearResults(); return; }
    const signal = await abortOngoing();
    showSkeletons(8); statusLine.textContent = 'Searching…';
    try{
      const { items, total } = await apiSearch(query, page, type, signal);
      // set page-specific results (pagination model)
      state.collected = uniqById(items.slice());
      state.fetchedPage = page;
      state.totalResults = total;
      state.query = query;
      renderCollected(); statusLine.textContent = '';
      // prioritize search results view
      showSearchResultsView();
      // sync URL to current search
      updateURLForSearch(state.query, state.type, state.fetchedPage, true);
      // render pagination
      renderPagination(state.totalResults, state.fetchedPage);
      // save recent
      addRecent(query);
    }catch(err){
      if(err.name === 'AbortError') return; console.error(err); movieGrid.innerHTML = `<div class="empty-state muted"><h4>Error</h4><p>${escapeHtml(err.message||'An error occurred')}</p><button id="retry-search" class="btn-primary">Retry</button></div>`; statusLine.textContent=''; const retry = $('retry-search'); if(retry) retry.addEventListener('click', ()=> performSearch(query, page, type)); toast(err.message || 'Search failed'); }
  }

  // hide default load-more (we use pagination)
  if(loadMoreBtn) loadMoreBtn.style.display = 'none';


  // handle back/forward navigation and initial URL state
  window.addEventListener('popstate', (e)=>{
    const params = getQueryParams();
    if(params.movie){ // open detail
      openDetails(params.movie, { imdbID: params.movie });
      return;
    }
    // otherwise close detail view if open
    if(detailView && detailView.getAttribute('aria-hidden')==='false') closeDetailView();
    if(params.q){ movieInput.value = params.q; searchTypeSelect.value = params.type || 'all'; performSearch(params.q, params.page || 1, params.type || 'all'); }
  });

  // apply initial URL params on load
  function applyInitialUrl(){ const params = getQueryParams(); if(params.q){ movieInput.value = params.q; searchTypeSelect.value = params.type || 'all'; performSearch(params.q, params.page || 1, params.type || 'all'); }
    if(params.movie){ // after search, open detail; if search not required, still open
      // open details after a brief delay to allow UI to settle
      setTimeout(()=> openDetails(params.movie, { imdbID: params.movie }), 400);
    }
  }

  // --- Suggestions / recent ---
  const RECENT_KEY = 'filmexplorer:recent';
  function loadRecent(){ try{ return JSON.parse(localStorage.getItem(RECENT_KEY)||'[]'); }catch(e){return[]} }
  function saveRecent(list){ localStorage.setItem(RECENT_KEY, JSON.stringify(list)); }
  function addRecent(q){ if(!q) return; const list = loadRecent(); const idx = list.indexOf(q); if(idx!==-1) list.splice(idx,1); list.unshift(q); if(list.length>CONFIG.maxRecent) list.pop(); saveRecent(list); renderRecent(); }
  function clearRecent(){ saveRecent([]); renderRecent(); }
  function renderRecent(){ const list = loadRecent(); recentList.innerHTML=''; if(list.length===0){ recentList.innerHTML = '<li class="muted">No recent searches</li>'; return } list.forEach(item=>{ const li = createNode('li',{},[ createNode('button',{class:'btn-link', onclick:()=>{ movieInput.value = item; performSearch(item,1, searchTypeSelect.value); suggestionsPanel.hidden=true; }},[item]), createNode('button',{class:'btn-link', onclick:()=>{ removeRecent(item) }},['✕']) ]); recentList.appendChild(li); }); }
  function removeRecent(item){ const list = loadRecent(); const idx = list.indexOf(item); if(idx!==-1) list.splice(idx,1); saveRecent(list); renderRecent(); }

  // populate popular
  function renderPopular(){ popularList.innerHTML=''; POPULAR.forEach(p=>{ const li = createNode('li',{},[ createNode('button',{class:'btn-link', onclick:()=>{ movieInput.value=p; performSearch(p,1, searchTypeSelect.value); suggestionsPanel.hidden=true }},[p]) ]); popularList.appendChild(li); }); }

  clearRecentBtn.addEventListener('click', ()=>{ clearRecent(); toast('Cleared recent searches'); });

  

  // --- Discover / Trending bootstrap ---
  async function seedGrid(titles, container){ container.innerHTML=''; try{ // shuffle input list so the grid appears dynamic
    const list = titles.slice().sort(()=>Math.random()-0.5);
    for(const t of list){ try{ const res = await apiSearch(t,1,'all'); const item = (res.items && res.items[0]) || null; if(item) renderMovieCard(item, container); }catch(e){ /* ignore individual */ } }
  }catch(e){}
  }

  // Load related movies by genre keywords (cached)
  async function loadMoreLikeThis(d){ try{
    const container = document.getElementById('more-like-carousel'); if(!container) return;
    container.innerHTML = '';
    const key = `filmexplorer:related:${d.imdbID||d.Title}`;
    const cached = loadCache(key); if(cached){ cached.slice(0,8).forEach(i=> renderMovieCard(i, container)); return; }
    if(!d.Genre || d.Genre==='N/A') return;
    const firstGenre = d.Genre.split(',')[0].trim(); if(!firstGenre) return;
    const res = await apiSearch(firstGenre,1,'movie'); const items = (res.items||[]).filter(i=> (i.imdbID||i.Title) !== (d.imdbID||d.Title)).slice(0,8);
    if(!items || items.length===0) return;
    saveCache(key, items, 1000*60*60*6); // 6h cache
    items.forEach(i=> renderMovieCard(i, container));
  }catch(e){ /* silently fail */ } }

  // Movie of the Day (deterministic pick from curated + popular)
  function renderMovieOfDay(){ try{ const candidates = CURATED.concat(POPULAR); const now = new Date(); const start = new Date(now.getFullYear(),0,0); const diff = now - start; const oneDay = 1000*60*60*24; const dayOfYear = Math.floor(diff/oneDay); const idx = dayOfYear % candidates.length; const title = candidates[idx]; const container = $('movie-of-day-card'); if(!container) return; container.innerHTML=''; // fetch the top search result for that title
      apiSearch(title,1,'all').then(res=>{ const item = (res.items && res.items[0]); if(item) renderMovieCard(item, container); }).catch(()=>{});
  }catch(e){}
  }

  // Seed category rows with small curated lists
  function seedCategories(){ try{ seedGrid(CAT_ACTION, document.getElementById('cat-action')); seedGrid(CAT_SCIFI, document.getElementById('cat-scifi')); seedGrid(CAT_COMEDY, document.getElementById('cat-comedy')); seedGrid(CAT_CLASSICS, document.getElementById('cat-classics')); // top rated can reuse curated
      seedGrid(CURATED, document.getElementById('cat-top-rated'));
  }catch(e){}
  }

  // Surprise Me: pick a random available title from visible discovery sets
  async function surpriseMe(){ try{ const el = $('surprise-me'); if(el) el.disabled = true; toast('Finding something for you...'); // collect candidates from currently rendered discover/trending grids
      const ids = new Set(); const candidates = [];
      document.querySelectorAll('#discover-grid .movie-card, #trending-grid .movie-card, #recently-viewed-grid .movie-card').forEach(c=>{ const id = c.getAttribute('data-id'); if(id && !ids.has(id)){ ids.add(id); const title = c.querySelector('.movie-title') ? c.querySelector('.movie-title').textContent.trim() : null; if(title) candidates.push({id,title}); } });
      // fall back to curated/popular
      if(candidates.length===0){ (CURATED.concat(POPULAR)).forEach(t=> candidates.push({id:t,title:t})); }
      if(candidates.length===0){ if(el) el.disabled=false; return; }
      // pick random
      const pick = candidates[Math.floor(Math.random()*candidates.length)];
      // fetch details if needed
      // if pick.id looks like an imdbID (tt) open directly, else search
      if(pick.id && String(pick.id).startsWith('tt')){ openDetails(pick.id, { imdbID: pick.id }); } else { // search by title
        const res = await apiSearch(pick.title,1,'all'); const item = (res.items && res.items[0]); if(item) openDetails(item.imdbID||item.Title, item); }
      if(el) el.disabled=false;
  }catch(e){ if($('surprise-me')) $('surprise-me').disabled=false; } }

  // Show the search results view and hide other discovery sections
  function showSearchResultsView(){ const hideIds = ['recently-viewed','discover','trending','bookmarks']; hideIds.forEach(id=>{ const el = document.getElementById(id); if(el) el.hidden = true; }); const resultsSection = document.getElementById('results'); if(resultsSection) resultsSection.scrollIntoView({behavior:'smooth'}); }

  function restoreMainView(){ document.querySelectorAll('main > section').forEach(s=> s.hidden = false); }

  // --- Events: search form and input ---
  searchForm.addEventListener('submit', e=>{ e.preventDefault(); const q = movieInput.value.trim(); state.type = searchTypeSelect.value; state.page = 1; performSearch(q,1,state.type); suggestionsPanel.hidden=true; });
  function updateClearVisibility(){ try{ if(clearInputBtn) clearInputBtn.style.display = movieInput.value && movieInput.value.trim() ? 'inline-flex' : 'none'; }catch(e){} }
  
  movieInput.addEventListener('input', debounce((e)=>{ const v = e.target.value.trim(); updateClearVisibility(); if(!v){ suggestionsPanel.hidden=false; renderRecent(); renderPopular(); clearResults(); return } suggestionsPanel.hidden=false; renderRecent(); renderPopular(); }), 250);
  movieInput.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); searchForm.dispatchEvent(new Event('submit')); } });
  clearInputBtn.addEventListener('click', ()=>{ movieInput.value=''; updateClearVisibility(); movieInput.focus(); suggestionsPanel.hidden=false; renderRecent(); renderPopular(); clearResults(); restoreMainView(); });
  

  // mobile drawer: open/close logic, body scroll lock, backdrop click, escape, and link close
  const mobileToggle = $('mobile-menu-toggle');
  const mobileDrawer = $('mobile-drawer');
  const mobileClose = $('mobile-drawer-close');

  function openDrawer(){ if(!mobileDrawer) return; mobileDrawer.setAttribute('aria-hidden','false'); document.documentElement.classList.add('drawer-open'); document.body.style.overflow = 'hidden'; mobileClose && mobileClose.focus(); }
  function closeDrawer(){ if(!mobileDrawer) return; mobileDrawer.setAttribute('aria-hidden','true'); document.documentElement.classList.remove('drawer-open'); document.body.style.overflow = ''; }

  if(mobileToggle){ mobileToggle.addEventListener('click', ()=>{ const isOpen = mobileDrawer && mobileDrawer.getAttribute('aria-hidden') === 'false'; if(isOpen) closeDrawer(); else openDrawer(); }); }
  if(mobileClose){ mobileClose.addEventListener('click', ()=> closeDrawer()); }
  if(mobileDrawer){
    // Close when clicking the backdrop (anywhere outside .drawer-inner)
    mobileDrawer.addEventListener('click', (e)=>{
      if(!e.target.closest('.drawer-inner')) closeDrawer();
    });

    // Close and navigate when a drawer nav link is clicked. Use closeDrawer() to keep behavior consistent.
    const links = mobileDrawer.querySelectorAll('.drawer-nav a');
    links.forEach(a => a.addEventListener('click', (e)=>{
      e.preventDefault(); const href = a.getAttribute('href');
      closeDrawer();
      // wait for CSS transition to finish before changing location
      setTimeout(()=>{
        if(href && href.startsWith('#')) location.hash = href;
        else window.location.href = href;
      }, 320);
    }));
  }

  // helper for deterministic navigation from inline handlers
  window.drawerNavigate = function(href){ try{ if(mobileDrawer){ mobileDrawer.setAttribute('aria-hidden','true'); document.documentElement.classList.remove('drawer-open'); document.body.style.overflow=''; } }catch(e){}
    setTimeout(()=>{ if(href && href.startsWith('#')) location.hash = href; else window.location.href = href; }, 320);
  };

  // Fallback: capture clicks early to ensure drawer links are intercepted in all environments
  document.addEventListener('click', (e)=>{
    const a = e.target && e.target.closest ? e.target.closest('#mobile-drawer .drawer-nav a') : null;
    if(a){ e.preventDefault(); const href = a.getAttribute('href'); if(mobileDrawer){ mobileDrawer.setAttribute('aria-hidden','true'); document.documentElement.classList.remove('drawer-open'); document.body.style.overflow=''; } setTimeout(()=>{ if(href && href.startsWith('#')) location.hash = href; else window.location.href = href; }, 260); }
  }, true);
  // close on Escape when drawer open
  document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && mobileDrawer && mobileDrawer.getAttribute('aria-hidden') === 'false'){ closeDrawer(); } });

  // Ensure drawer closes when navigation occurs (hash change or history)
  window.addEventListener('hashchange', ()=>{ try{ const d = document.getElementById('mobile-drawer'); if(d) d.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }catch(e){} });

  // nav bookmarks link
  const navBookmarks = $('nav-bookmarks'); if(navBookmarks){ navBookmarks.addEventListener('click', (e)=>{ e.preventDefault(); showBookmarksView(); }); }

  function showBookmarksView(){ document.querySelectorAll('main > section').forEach(s=> s.hidden = true); bookmarksSection.hidden=false; renderBookmarks(); window.scrollTo({top:0,behavior:'smooth'}); }

  // initial render
  function init(){ renderPopular(); renderRecent(); renderBookmarks(); seedGrid(CURATED, discoverGrid); seedGrid(POPULAR, trendingGrid); document.getElementById('year').textContent = new Date().getFullYear(); }

  function boot(){ renderPopular(); renderRecent(); renderBookmarks(); renderRecentlyViewed(); seedGrid(CURATED, discoverGrid); seedGrid(POPULAR, trendingGrid); // additional discovery seeding
    seedCategories(); renderMovieOfDay();
    // hook Surprise Me control
    const surprise = $('surprise-me'); if(surprise) surprise.addEventListener('click', (e)=>{ e.preventDefault(); surpriseMe(); });
    document.getElementById('year').textContent = new Date().getFullYear(); applyInitialUrl(); }
  // ensure clear-button starts in correct state
  if(clearInputBtn) updateClearVisibility();

  boot();

});
