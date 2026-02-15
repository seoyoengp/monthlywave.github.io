/**
 * 빛청모 월간지 WAVE - 기사 좋아요·댓글 (회원 전용, localStorage)
 */
(function() {
  var LIKES_KEY = 'monthlywave_likes';
  var COMMENTS_KEY = 'monthlywave_comments';

  function getLikesData() {
    try {
      var raw = localStorage.getItem(LIKES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {}
    return {};
  }

  function saveLikesData(obj) {
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  function getCommentsData() {
    try {
      var raw = localStorage.getItem(COMMENTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {}
    return {};
  }

  function saveCommentsData(obj) {
    try {
      localStorage.setItem(COMMENTS_KEY, JSON.stringify(obj));
    } catch (e) {}
  }

  /** 기사별 좋아요 수 */
  window.getLikeCount = function(articleId) {
    var key = String(articleId);
    var data = getLikesData();
    var list = data[key];
    return Array.isArray(list) ? list.length : 0;
  };

  /** 해당 회원이 이 기사에 좋아요 했는지 */
  window.hasUserLiked = function(articleId, userEmail) {
    var key = String(articleId);
    var data = getLikesData();
    var list = data[key];
    if (!Array.isArray(list)) return false;
    return list.indexOf(userEmail) !== -1;
  };

  /** 좋아요 토글. 반환: { count, liked } */
  window.toggleArticleLike = function(articleId, userEmail) {
    var key = String(articleId);
    var data = getLikesData();
    if (!data[key]) data[key] = [];
    var list = data[key];
    var i = list.indexOf(userEmail);
    if (i === -1) {
      list.push(userEmail);
    } else {
      list.splice(i, 1);
    }
    saveLikesData(data);
    return { count: list.length, liked: list.indexOf(userEmail) !== -1 };
  };

  /** 기사 댓글 목록 */
  window.getArticleComments = function(articleId) {
    var key = String(articleId);
    var data = getCommentsData();
    var list = data[key];
    return Array.isArray(list) ? list.slice() : [];
  };

  /** 댓글 작성. 반환: true 또는 오류 메시지 */
  window.addArticleComment = function(articleId, author, email, body) {
    body = (body || '').trim();
    if (!body) return '댓글 내용을 입력해 주세요.';
    var key = String(articleId);
    var data = getCommentsData();
    if (!data[key]) data[key] = [];
    data[key].push({
      author: author,
      email: email,
      body: body,
      date: new Date().toISOString()
    });
    saveCommentsData(data);
    return true;
  };

  /** 댓글 삭제. index는 0부터. 반환: true 성공, false 실패 */
  window.deleteArticleComment = function(articleId, commentIndex) {
    var key = String(articleId);
    var data = getCommentsData();
    var list = data[key];
    if (!Array.isArray(list) || commentIndex < 0 || commentIndex >= list.length) return false;
    list.splice(commentIndex, 1);
    saveCommentsData(data);
    return true;
  };

  /** 댓글 수정. 반환: true 또는 오류 메시지 */
  window.updateArticleComment = function(articleId, commentIndex, newBody) {
    newBody = (newBody || '').trim();
    if (!newBody) return '댓글 내용을 입력해 주세요.';
    var key = String(articleId);
    var data = getCommentsData();
    var list = data[key];
    if (!Array.isArray(list) || commentIndex < 0 || commentIndex >= list.length) return '댓글을 찾을 수 없습니다.';
    list[commentIndex].body = newBody;
    list[commentIndex].date = new Date().toISOString();
    saveCommentsData(data);
    return true;
  };

  /** 날짜 포맷 (간단) */
  function formatDate(iso) {
    try {
      var d = new Date(iso);
      var y = d.getFullYear();
      var m = String(d.getMonth() + 1).padStart(2, '0');
      var day = String(d.getDate()).padStart(2, '0');
      var h = String(d.getHours()).padStart(2, '0');
      var min = String(d.getMinutes()).padStart(2, '0');
      return y + '-' + m + '-' + day + ' ' + h + ':' + min;
    } catch (e) {}
    return iso || '';
  }

  function escapeHtml(s) {
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** 기사 상세 페이지에서 좋아요·댓글 UI 렌더 및 이벤트 */
  window.initArticleEngagement = function(articleId) {
    var wrap = document.getElementById('article-engagement');
    if (!wrap || !articleId) return;

    var user = window.getCurrentUser ? window.getCurrentUser() : null;
    var id = String(articleId);

    function renderLikes() {
      var count = getLikeCount(id);
      var liked = user && hasUserLiked(id, user.email);
      var btn = document.getElementById('engagement-like-btn');
      var countEl = document.getElementById('engagement-like-count');
      if (countEl) countEl.textContent = count;
      if (btn) {
        btn.disabled = !user;
        btn.classList.toggle('is-liked', liked);
        btn.title = user ? (liked ? '좋아요 취소' : '좋아요') : '로그인하면 좋아요를 누를 수 있어요';
      }
    }

    function renderComments() {
      var list = getArticleComments(id);
      var container = document.getElementById('engagement-comments-list');
      var empty = document.getElementById('engagement-comments-empty');
      var formWrap = document.getElementById('engagement-comment-form-wrap');
      if (container) {
        container.innerHTML = list.map(function(c, idx) {
          var isMine = user && c.email === user.email;
          var actions = isMine
            ? '<div class="comment-actions"><button type="button" class="comment-edit">수정</button><button type="button" class="comment-delete">삭제</button></div>'
            : '';
          return '<li class="comment-item" data-comment-index="' + idx + '">' +
            '<div class="comment-meta">' + escapeHtml(c.author) + ' · ' + formatDate(c.date) + '</div>' +
            '<div class="comment-body">' + escapeHtml(c.body).replace(/\n/g, '<br>') + '</div>' +
            actions +
            '</li>';
        }).join('');
      }
      if (empty) empty.style.display = list.length ? 'none' : 'block';
      if (formWrap) formWrap.style.display = user ? 'block' : 'none';
      var loginHint = document.getElementById('engagement-comments-login-hint');
      if (loginHint) loginHint.style.display = user ? 'none' : 'block';
      var countTitle = document.getElementById('engagement-comments-count');
      if (countTitle) countTitle.textContent = list.length;
    }

    function startEditComment(li, index) {
      var list = getArticleComments(id);
      var comment = list[index];
      if (!comment) return;
      var bodyDiv = li.querySelector('.comment-body');
      if (!bodyDiv) return;
      var currentBody = comment.body || '';
      var editWrap = document.createElement('div');
      editWrap.className = 'comment-edit-wrap';
      editWrap.innerHTML =
        '<textarea class="comment-edit-textarea" rows="3">' + escapeHtml(currentBody) + '</textarea>' +
        '<div class="comment-edit-actions">' +
        '<button type="button" class="comment-edit-save">저장</button>' +
        '<button type="button" class="comment-edit-cancel">취소</button>' +
        '</div>';
      bodyDiv.parentNode.replaceChild(editWrap, bodyDiv);
      var textarea = editWrap.querySelector('.comment-edit-textarea');
      var saveBtn = editWrap.querySelector('.comment-edit-save');
      var cancelBtn = editWrap.querySelector('.comment-edit-cancel');
      cancelBtn.addEventListener('click', function() {
        renderComments();
      });
      saveBtn.addEventListener('click', function() {
        var newBody = textarea.value.trim();
        if (!newBody) return;
        var result = updateArticleComment(id, index, newBody);
        if (result === true) {
          renderComments();
        } else {
          alert(result);
        }
      });
    }

    function render() {
      renderLikes();
      renderComments();
    }

    wrap.style.display = 'block';
    render();

    var likeBtn = document.getElementById('engagement-like-btn');
    if (likeBtn) {
      if (user) {
        likeBtn.addEventListener('click', function() {
          toggleArticleLike(id, user.email);
          renderLikes();
        });
      }
      var likeHint = document.getElementById('engagement-like-hint');
      if (likeHint) likeHint.style.display = user ? 'none' : 'block';
    }

    var form = document.getElementById('engagement-comment-form');
    if (form && user) {
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        var bodyEl = document.getElementById('engagement-comment-body');
        var errEl = document.getElementById('engagement-comment-error');
        var body = bodyEl ? bodyEl.value : '';
        var result = addArticleComment(id, user.username, user.email, body);
        if (result === true) {
          if (bodyEl) bodyEl.value = '';
          if (errEl) errEl.textContent = '';
          renderComments();
        } else {
          if (errEl) errEl.textContent = result;
        }
      });
    }

    var commentsList = document.getElementById('engagement-comments-list');
    if (commentsList) {
      commentsList.addEventListener('click', function(e) {
        var target = e.target;
        if (!target.classList.contains('comment-delete') && !target.classList.contains('comment-edit')) return;
        var li = target.closest('.comment-item');
        if (!li) return;
        var index = parseInt(li.getAttribute('data-comment-index'), 10);
        if (isNaN(index) || index < 0) return;
        if (target.classList.contains('comment-delete')) {
          if (confirm('이 댓글을 삭제할까요?')) {
            deleteArticleComment(id, index);
            renderComments();
          }
          return;
        }
        if (target.classList.contains('comment-edit')) {
          startEditComment(li, index);
        }
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      var wrap = document.getElementById('article-engagement');
      var id = wrap && wrap.getAttribute('data-article-id');
      if (id) initArticleEngagement(id);
    });
  } else {
    var wrap = document.getElementById('article-engagement');
    var id = wrap && wrap.getAttribute('data-article-id');
    if (id) initArticleEngagement(id);
  }
})();
