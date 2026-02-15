/**
 * 빛청모 월간지 WAVE - 기사 데이터 연동
 * 홈, 카테고리 탭, 기사 상세, 투고가 하나의 데이터를 공유합니다.
 */
(function () {
  var STORAGE_KEY = 'monthlywave_articles';

  var categoryPages = {
    society: 'society.html',
    culture: 'culture.html',
    interview: 'interview.html',
    essay: 'essay.html'
  };

  var categoryLabels = {
    society: '사회',
    culture: '문화',
    interview: '인터뷰',
    essay: '에세이'
  };

  /** localStorage에서 기사 목록 가져오기. 기본 데이터(Notion)가 있으면 위협적으로 덮어쓰기(간단한 동기화) */
  window.getArticles = function () {
    // Notion 데이터가 로드되어 있다면, localStorage보다 우선하거나 병합할 수 있습니다.
    // 여기서는 간단히: Notion 데이터(window.MONTHLYWAVE_DEFAULT_ARTICLES)가 존재하면
    // 그것을 반환하고 localStorage도 갱신합니다.
    if (window.MONTHLYWAVE_DEFAULT_ARTICLES && Array.isArray(window.MONTHLYWAVE_DEFAULT_ARTICLES) && window.MONTHLYWAVE_DEFAULT_ARTICLES.length > 0) {
      saveArticles(window.MONTHLYWAVE_DEFAULT_ARTICLES);
      return window.MONTHLYWAVE_DEFAULT_ARTICLES;
    }

    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var list = JSON.parse(raw);
        return Array.isArray(list) ? list : seedArticles();
      }
    } catch (e) { }
    return seedArticles();
  };

  function seedArticles() {
    var defaultList = window.MONTHLYWAVE_DEFAULT_ARTICLES;
    if (Array.isArray(defaultList) && defaultList.length) {
      saveArticles(defaultList);
      return defaultList;
    }
    return [];
  }

  /** 기사 목록 저장 */
  window.saveArticles = function (list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) { }
  };

  /** 새 기사용 id 생성 (기존 최대 id + 1) -> Notion ID가 문자열이므로 숫자 ID 생성 로직은 로컬 전용으로 유지하거나 수정 필요 */
  window.getNextArticleId = function () {
    var list = getArticles();
    var max = 0;
    for (var i = 0; i < list.length; i++) {
      // 숫자 ID인 경우만 계산
      if (typeof list[i].id === 'number' && list[i].id > max) max = list[i].id;
    }
    return max + 1;
  };

  /** id로 기사 찾기 (문자열 ID 지원) */
  window.findArticleById = function (id) {
    var list = getArticles();
    // id가 숫자형 문자열이면 숫자로 변환 비교, 아니면 문자열 비교
    // Notion ID는 문자열(UUID)
    for (var i = 0; i < list.length; i++) {
      // Loose equality checks both string/number
      if (list[i].id == id) return list[i];
    }
    return null;
  };

  /** id로 기사 삭제 후 저장, 삭제된 기사 객체 반환 */
  window.deleteArticleById = function (id) {
    var list = getArticles();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id == id) {
        var removed = list.splice(i, 1)[0];
        saveArticles(list);
        return removed;
      }
    }
    return null;
  };

  /** 날짜 내림차순 정렬 (최신 먼저) */
  window.sortArticlesByDate = function (list) {
    return list.slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '');
    });
  };

  /** 카테고리 페이지 URL */
  window.getCategoryPage = function (cat) {
    return categoryPages[cat] || 'index.html';
  };

  /** 카테고리 한글명 */
  window.getCategoryLabel = function (cat) {
    return categoryLabels[cat] || cat;
  };
})();
