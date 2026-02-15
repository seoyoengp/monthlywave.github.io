/**
 * 빛청모 월간지 WAVE - 회원가입/로그인 (localStorage 기반)
 * 데모용 클라이언트 인증입니다. 실제 서비스에서는 서버 인증이 필요합니다.
 */
(function() {
  var USERS_KEY = 'monthlywave_users';
  var CURRENT_KEY = 'monthlywave_current';

  function getUsers() {
    try {
      var raw = localStorage.getItem(USERS_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        return Array.isArray(list) ? list : [];
      }
    } catch (e) {}
    return [];
  }

  function saveUsers(list) {
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  /** 현재 로그인 사용자 */
  window.getCurrentUser = function() {
    try {
      var raw = localStorage.getItem(CURRENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {}
    return null;
  };

  /** 로그인 여부 */
  window.isLoggedIn = function() {
    return !!getCurrentUser();
  };

  /** 회원가입: 이메일, 닉네임, 비밀번호. 성공 시 true, 실패 시 오류 메시지 */
  window.authSignup = function(email, username, password, confirmPassword) {
    email = (email || '').trim().toLowerCase();
    username = (username || '').trim();
    if (!email) return '이메일을 입력해 주세요.';
    if (!username) return '닉네임을 입력해 주세요.';
    if (!password) return '비밀번호를 입력해 주세요.';
    if (password.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
    if (password !== confirmPassword) return '비밀번호가 일치하지 않습니다.';

    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].email === email) return '이미 사용 중인 이메일입니다.';
      if (users[i].username === username) return '이미 사용 중인 닉네임입니다.';
    }

    users.push({
      email: email,
      username: username,
      password: password,
      createdAt: new Date().toISOString()
    });
    saveUsers(users);
    return true;
  };

  /** 로그인: 이메일 또는 닉네임, 비밀번호. 성공 시 true, 실패 시 오류 메시지 */
  window.authLogin = function(emailOrUsername, password) {
    var input = (emailOrUsername || '').trim();
    if (!input) return '이메일 또는 닉네임을 입력해 주세요.';
    if (!password) return '비밀번호를 입력해 주세요.';

    var users = getUsers();
    var lower = input.toLowerCase();
    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var match = u.email === lower || u.email === input || u.username === input;
      if (match && u.password === password) {
        try {
          localStorage.setItem(CURRENT_KEY, JSON.stringify({
            email: u.email,
            username: u.username
          }));
        } catch (e) {}
        return true;
      }
    }
    return '이메일(닉네임) 또는 비밀번호가 올바르지 않습니다.';
  };

  /** 로그아웃 */
  window.authLogout = function() {
    try {
      localStorage.removeItem(CURRENT_KEY);
    } catch (e) {}
  };

  /** 헤더용 로그인/회원가입/로그아웃 UI 주입 */
  window.initAuthNav = function(selector) {
    var el = typeof selector === 'string' ? document.querySelector(selector) : selector;
    if (!el) return;

    function render() {
      var user = getCurrentUser();
      if (user) {
        el.innerHTML =
          '<span class="auth-user">' + escapeHtml(user.username) + '님</span>' +
          '<a href="#" class="auth-logout">로그아웃</a>';
        var logoutBtn = el.querySelector('.auth-logout');
        if (logoutBtn) {
          logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            authLogout();
            render();
            if (window.onAuthStateChange) window.onAuthStateChange();
          });
        }
      } else {
        el.innerHTML =
          '<a href="login.html' + getReturnUrl() + '">로그인</a>' +
          '<a href="signup.html">회원가입</a>';
      }
    }

    function getReturnUrl() {
      var path = location.pathname || '';
      var page = path.split('/').pop() || 'index.html';
      if (page && page !== 'login.html' && page !== 'signup.html')
        return '?return=' + encodeURIComponent(page + (location.search || ''));
      return '';
    }

    function escapeHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
    }

    render();
  };

  function init() {
    var sel = document.querySelector('.auth-nav');
    if (sel) initAuthNav(sel);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
