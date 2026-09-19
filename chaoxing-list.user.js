// ==UserScript==
// @name         学习通作业/考试/任务列表（优化版）
// @namespace    https://github.com/Cooanyh
// @version      2.4.8
// @author       甜檸Cirtron (lcandy2); Modified by Coren
// @description  【优化版】支持作业、考试与课程任务快速查看；提供统一设置、任务分类筛选、按课程忽略及任务引擎模块汇总。
// @license      AGPL-3.0-or-later
// @copyright    lcandy2 All Rights Reserved
// @copyright    2025, Coren (Modified based on original work)
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chaoxing.com
// @source       https://github.com/Cooanyh/chaoxing-list
// @match        *://i.chaoxing.com/*
// @match        *://i.mooc.chaoxing.com/space/index*
// @match        *://i.mooc.chaoxing.com/settings*
// @match        *://mooc2-ans.chaoxing.com/*
// @match        *://mooc1-api.chaoxing.com/work/stu-work*
// @match        *://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode*
// @match        *://mooc1.chaoxing.com/exam-ans/exam/test/examcode/examlist*
// @require      https://registry.npmmirror.com/vue/3.4.27/files/dist/vue.global.prod.js
// @require      data:application/javascript,%3Bwindow.Vue%3DVue%3B
// @require      https://registry.npmmirror.com/vuetify/3.6.6/files/dist/vuetify.min.js
// @require      data:application/javascript,%3B
// @resource     VuetifyStyle                                                   https://registry.npmmirror.com/vuetify/3.6.6/files/dist/vuetify.min.css
// @resource     material-design-icons-iconfont/dist/material-design-icons.css  https://fonts.googlefonts.cn/css?family=Material+Icons
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_xmlhttpRequest
// @connect      mooc1-api.chaoxing.com
// @connect      mobilelearn.chaoxing.com
// @connect      stat2-ans.chaoxing.com
// @connect      mooc2-ans.chaoxing.com
// @connect      mooc1.chaoxing.com
// @connect      i.chaoxing.com
// @connect      task.chaoxing.com
// @run-at       document-end
// ==/UserScript==

(function (vuetify, vue) {
  'use strict';

  // --- 核心工具函数 ---
  const wrapElements = () => {
    const wrapper = document.createElement("body");
    wrapper.id = "chaoxing-assignment-wrapper";
    while (document.body.firstChild) {
      wrapper.appendChild(document.body.firstChild);
    }
    document.body.appendChild(wrapper);
    wrapper.style.display = "none";
  };
  const removeStyles = () => {
    removeHtmlStyle();
    const styles = document.querySelectorAll("link[rel=stylesheet]");
    styles.forEach((style) => {
      var _a;
      if ((_a = style.getAttribute("href")) == null ? void 0 : _a.includes("chaoxing")) {
        style.remove();
      }
    });
  };
  const removeHtmlStyle = () => {
    const html = document.querySelector("html");
    html == null ? void 0 : html.removeAttribute("style");
  };
  const keepRemoveHtmlStyle = () => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && mutation.attributeName === "style") {
          removeHtmlStyle();
        }
      });
    });
    const html = document.querySelector("html");
    html && observer.observe(html, { attributes: true });
  };
  const removeScripts = () => {
    const scripts = document.querySelectorAll("script");
    scripts.forEach((script) => {
      var _a;
      if ((_a = script.getAttribute("src")) == null ? void 0 : _a.includes("chaoxing")) {
        script.remove();
      }
    });
  };

  // --- 课程进度查询开关管理 ---
  const PROGRESS_ENABLED_KEY = 'chaoxing_progress_enabled';
  const PROGRESS_DELAY_KEY = 'chaoxing_progress_delay';
  const DEFAULT_PROGRESS_DELAY = 500;
  const MIN_PROGRESS_DELAY = 300;
  const MAX_PROGRESS_DELAY = 10000;

  const isProgressEnabled = () => {
    try {
      const stored = localStorage.getItem(PROGRESS_ENABLED_KEY);
      return stored === null ? true : stored === 'true';
    } catch { return true; }
  };

  const setProgressEnabled = (enabled) => {
    try {
      localStorage.setItem(PROGRESS_ENABLED_KEY, String(enabled));
      console.log('[课程进度] 查询功能已', enabled ? '开启' : '关闭');
    } catch (e) {
      console.error('[课程进度] 保存开关状态失败:', e);
    }
  };

  const normalizeProgressDelay = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return DEFAULT_PROGRESS_DELAY;
    return Math.min(MAX_PROGRESS_DELAY, Math.max(MIN_PROGRESS_DELAY, parsed));
  };

  const getProgressDelay = () => {
    try {
      const stored = localStorage.getItem(PROGRESS_DELAY_KEY);
      return stored === null ? DEFAULT_PROGRESS_DELAY : normalizeProgressDelay(stored);
    } catch { return DEFAULT_PROGRESS_DELAY; }
  };

  const setProgressDelay = (delay) => {
    const normalizedDelay = normalizeProgressDelay(delay);
    try {
      localStorage.setItem(PROGRESS_DELAY_KEY, String(normalizedDelay));
      console.log('[课程进度] 请求延迟已设置为', normalizedDelay, 'ms');
    } catch (e) {
      console.error('[课程进度] 保存延迟设置失败:', e);
    }
    return normalizedDelay;
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const getCourseCompletionRate = (item) => {
    const rate = Number.parseFloat(String(item?.completionRate ?? '').replace('%', ''));
    return Number.isFinite(rate) ? rate : null;
  };
  const compareCourseProgress = (a, b, direction = 1) => {
    const rateA = getCourseCompletionRate(a);
    const rateB = getCourseCompletionRate(b);
    if (rateA === null && rateB !== null) return 1;
    if (rateA !== null && rateB === null) return -1;
    if (rateA !== null && rateB !== null && rateA !== rateB) return (rateA - rateB) * direction;
    return (a.courseName || '').localeCompare(b.courseName || '', 'zh-CN');
  };

  // --- 忽略管理 - 使用 localStorage 持久化 ---
  const IGNORE_STORAGE_KEY = 'chaoxing_ignored_items';
  const SETTINGS_STORAGE_KEY = 'chaoxing_list_settings_v1';
  const DASHBOARD_CACHE_STORAGE_KEY = 'chaoxing_list_dashboard_cache_v1';
  const DASHBOARD_CACHE_TTL = 5 * 60 * 1000;
  const COURSE_IGNORE_PREFIX = 'course__';
  const DEFAULT_SETTINGS = Object.freeze({
    ignoreEnabled: false,
    showOtherTasks: false,
    otherTaskTypes: [],
    shortTermCacheEnabled: false,
    dynamicIgnoreRules: { homework: false, exam: false, activities: false, progress: false },
    settingsHintSeen: false,
    courseIgnoreHintSeen: false
  });
  const CORE_TASK_TYPES = new Set(['作业', '视频/任务点', 'AI实践', '任务引擎', '分组讨论', '分组任务', '测验', '随堂练习', '考试']);
  const OTHER_TASK_TYPES = ['签到', '问卷', '抢答', '通知', '投票', '直播', '评分', '拍照', '笔记', '其他任务'];

  const getSettings = () => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}') };
    } catch { return { ...DEFAULT_SETTINGS }; }
  };
  const saveSettings = (settings) => localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ ...DEFAULT_SETTINGS, ...settings }));
  const getDashboardCache = () => {
    try { return JSON.parse(localStorage.getItem(DASHBOARD_CACHE_STORAGE_KEY) || '{}'); }
    catch { return {}; }
  };
  const cleanupDashboardCache = () => {
    const cache = getDashboardCache();
    const now = Date.now();
    Object.keys(cache).forEach(key => {
      if (!cache[key] || !cache[key].savedAt || now - cache[key].savedAt > DASHBOARD_CACHE_TTL) delete cache[key];
    });
    try { localStorage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(cache)); } catch { /* localStorage 不可用时直接跳过 */ }
    return cache;
  };
  const saveDashboardCache = (key, data) => {
    const cache = cleanupDashboardCache();
    cache[key] = { savedAt: Date.now(), data };
    try { localStorage.setItem(DASHBOARD_CACHE_STORAGE_KEY, JSON.stringify(cache)); } catch (error) { console.warn('[短时缓存] 写入失败', error); }
  };
  const isOtherTask = (item) => item && item.isActivity && !CORE_TASK_TYPES.has(item.type);
  const isOtherTaskVisible = (item, settings) => !isOtherTask(item) || settings.showOtherTasks || (settings.otherTaskTypes || []).includes(item.type);
  // 动态忽略只接受明确的完成/过期标记，避免状态缺失或未知内容被误选。
  const isExplicitlyCompletedAiPractice = (item) => item?.type === 'AI实践'
    && (item.finished === true || item.status === '已完成');
  const isExplicitlyCompletedHomework = (item) => {
    if (!item) return false;
    if (item.type === 'AI实践') return isExplicitlyCompletedAiPractice(item);
    return item.uncommitted === false || item.finished === true || item.status === '已完成';
  };
  const isExplicitlyClosedExam = (item) => item?.finished === true || item?.expired === true;
  const isExplicitlyEndedActivity = (item) => item?.finished === true || item?.status === '已结束';
  const isExplicitlyCompletedProgress = (item) => item?.isComplete === true || Number.parseInt(item?.completionRate, 10) >= 100;
  const getTaskEnginePlanSection = (item) => {
    if (!item?.taskEnginePlan) return 'activities';
    if (item.type === '作业') return 'homework';
    if (item.type === '考试') return 'exam';
    return 'activities';
  };
  const isDynamicallyIgnored = (item, sectionType, settings) => {
        const rules = settings.dynamicIgnoreRules || {};
        // 待办中的任务引擎子任务按实际类目应用规则，其余课程任务沿用课程任务规则。
        if (sectionType === 'todo' && item.isActivity) sectionType = getTaskEnginePlanSection(item);
        switch (sectionType) {
      case 'homework': return !!rules.homework && isExplicitlyCompletedHomework(item);
      case 'exam': return !!rules.exam && isExplicitlyClosedExam(item);
      case 'activities': return !!rules.activities && isExplicitlyEndedActivity(item);
      case 'progress': return !!rules.progress && isExplicitlyCompletedProgress(item);
      default: return false;
    }
  };
  const getCourseIgnoreKey = (item) => `${COURSE_IGNORE_PREFIX}${item.courseId || ''}__${item.clazzId || item.classId || ''}`;
  const isCourseIgnored = (item) => {
    const courseId = item && item.courseId;
    if (!courseId) return false;
    return !!getIgnoredItems()[getCourseIgnoreKey(item)];
  };
  const ignoreCourse = (course) => {
    const ignored = getIgnoredItems();
    ignored[getCourseIgnoreKey(course)] = {
      title: course.courseName || course.course || '未知课程',
      course: course.courseName || course.course || '',
      sectionType: 'course',
      ignoredAt: Date.now(),
      courseId: course.courseId,
      clazzId: course.clazzId || course.classId
    };
    saveIgnoredItems(ignored);
  };
  const unignoreCourse = (course) => {
    const ignored = getIgnoredItems();
    delete ignored[getCourseIgnoreKey(course)];
    saveIgnoredItems(ignored);
  };

  const getIgnoredItems = () => {
    try {
      return JSON.parse(localStorage.getItem(IGNORE_STORAGE_KEY) || '{}');
    } catch { return {}; }
  };

  const saveIgnoredItems = (items) => {
    localStorage.setItem(IGNORE_STORAGE_KEY, JSON.stringify(items));
  };

  // 生成唯一标识（包含板块前缀，防止不同板块同名项冲突）
  const getItemKey = (item, sectionType) => {
    const sec = sectionType || item._sectionType || 'unknown';
    const id = item.courseId || item.examId || item.workId || item.activeId || '';
    const title = item.title || item.courseName || '';
    return `${sec}__${id}__${title}`;
  };

  const isItemIgnored = (item, sectionType) => {
    const ignored = getIgnoredItems();
    return isCourseIgnored(item) || !!ignored[getItemKey(item, sectionType)];
  };

  const ignoreItem = (item, sectionType) => {
    const ignored = getIgnoredItems();
    const sec = sectionType || item._sectionType || 'unknown';
    ignored[getItemKey(item, sectionType)] = {
      title: item.title || item.courseName || '',
      type: item.type || '',
      course: item.course || item.courseName || '',
      sectionType: sec,
      ignoredAt: Date.now()
    };
    saveIgnoredItems(ignored);
  };

  const unignoreItem = (item, sectionType) => {
    const ignored = getIgnoredItems();
    delete ignored[getItemKey(item, sectionType)];
    saveIgnoredItems(ignored);
  };

  const ignoreItems = (items, sectionType) => {
    const ignored = getIgnoredItems();
    items.forEach(item => {
      const sec = sectionType || item._sectionType || 'unknown';
      ignored[getItemKey(item, sectionType)] = {
        title: item.title || item.courseName || '',
        type: item.type || '',
        course: item.course || item.courseName || '',
        sectionType: sec,
        ignoredAt: Date.now()
      };
    });
    saveIgnoredItems(ignored);
  };

  const unignoreItems = (items, sectionType) => {
    const ignored = getIgnoredItems();
    items.forEach(item => {
      delete ignored[getItemKey(item, sectionType)];
    });
    saveIgnoredItems(ignored);
  };

  // 获取某板块的所有已忽略项（按 sectionType 过滤）
  const getIgnoredItemsBySection = (sectionType) => {
    const ignored = getIgnoredItems();
    const result = [];
    for (const [key, val] of Object.entries(ignored)) {
      if ((val.sectionType || 'unknown') === sectionType) {
        result.push({ ...val, _key: key });
      }
    }
    return result;
  };

  const unignoreByKey = (key) => {
    const ignored = getIgnoredItems();
    delete ignored[key];
    saveIgnoredItems(ignored);
  };

  const unignoreByKeys = (keys) => {
    const ignored = getIgnoredItems();
    keys.forEach(k => delete ignored[k]);
    saveIgnoredItems(ignored);
  };

  const urlDetection = () => {
    const url = window.location.href;
    const hash = window.location.hash;

    // 新版仪表盘检测
    if (hash.includes("chaoxing-dashboard")) {
      return "dashboard";
    }
    if (hash.includes("chaoxing-assignment-activities")) {
      return "activities";
    }
    if (hash.includes("chaoxing-assignment-todo")) {
      return "todo";
    }

    if (hash.includes("chaoxing-assignment")) {
      if (url.includes("mooc1-api.chaoxing.com/work/stu-work")) {
        return "homework";
      }
      if (url.includes("mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode")) {
        return "exam";
      }
    }
    if (url.includes("mooc1.chaoxing.com/exam-ans/exam/test/examcode/examlist")) {
      return "exam";
    }
    if (url.includes("i.chaoxing.com")) {
      return "home";
    }
    if (url.includes("i.mooc.chaoxing.com/space/index") || url.includes("i.mooc.chaoxing.com/settings")) {
      return "legacyHome";
    }
    // 课程章节页面检测
    if (url.includes("mooc2-ans.chaoxing.com/mooc2-ans/mycourse/studentcourse") ||
      url.includes("mooc2-ans.chaoxing.com/mooc2-ans/mycourse/stu")) {
      return "course_chapter";
    }
  };

  const fixCssConflict = () => {
    const style = document.createElement('style');
    style.textContent = `
      .menu-list .label-item h3 {
        font-size: 14px !important;
        margin: 0 !important;
        line-height: 24px !important;
        font-weight: normal !important;
      }
      div.menubar a h5 {
        font-size: 14px !important;
        margin: 0 !important;
        line-height: normal !important;
        font-weight: bold !important;
        white-space: nowrap !important;
      }
      .leftnav h3, .left_nav h3, .funclistul h3, .user-info h3,
      div[class*="menu"] h3, div[class*="nav"] h3, #space_left h3, .space-left h3 {
        font-size: 14px !important;
      }
      .space_opt .manageBtn {
        font-size: 12px !important;
        line-height: 24px !important;
        height: auto !important;
        width: auto !important;
        padding: 0 10px !important;
        margin: 0 5px !important;
        display: inline-block !important;
        box-sizing: content-box !important;
        text-align: center !important;
        white-space: nowrap !important;
        border-radius: 4px !important;
      }
      .space_opt a.manageBtn {
        text-decoration: none !important;
        color: #333 !important;
      }
    `;
    document.head.appendChild(style);
  };

  const createMenuItem = (id, text, iconClass, targetUrl, insertFunc) => {
    const url = targetUrl;
    const menubarElement = document.querySelector('div.menubar[role="menubar"]');
    if (menubarElement) {
      const a = document.createElement("a");
      a.setAttribute("role", "menuitem");
      a.setAttribute("tabindex", "-1");
      a.id = `first${id}`;
      a.setAttribute("onclick", `setUrl('${id}','${url}',this,'0','${text}')`);
      a.setAttribute("dataurl", url);

      const icon = document.createElement("span");
      icon.className = `icon-space ${iconClass}`;
      a.appendChild(icon);

      const h5 = document.createElement("h5");
      h5.title = text;
      h5.innerHTML = `<b>${text}</b>`;
      a.appendChild(h5);

      const arrow = document.createElement("span");
      arrow.className = "arrow icon-uniE900";
      a.appendChild(arrow);

      if (insertFunc) insertFunc(menubarElement, a);
      else menubarElement.prepend(a);
    }
  };

  const createMenuItemNew = (id, text, iconClass, targetUrl, insertFunc) => {
    const menuListElement = document.querySelector("ul.menu-list-ul");
    if (menuListElement) {
      const li = document.createElement("li");
      li.setAttribute("level", "1");
      li.setAttribute("table-type", "1");
      li.setAttribute("data-id", `chaoxing-assignment-${id}`);

      const div = document.createElement("div");
      div.className = "label-item";
      div.setAttribute("role", "menuitem");
      div.setAttribute("level", "1");
      div.setAttribute("tabindex", "-1");
      div.setAttribute("name", text);
      div.setAttribute("id", `first_chaoxing_assignment_${id}`);
      div.setAttribute("onclick", `setUrl('chaoxing-assignment-${id}','${targetUrl}',this,'0','${text}')`);
      div.setAttribute("dataurl", targetUrl);

      const icon = document.createElement("span");
      icon.className = `icon-space ${iconClass}`;
      div.appendChild(icon);

      const h3 = document.createElement("h3");
      h3.title = text;
      h3.textContent = text;
      div.appendChild(h3);

      const arrow = document.createElement("span");
      arrow.className = "slide-arrow icon-h-arrow-l hide";
      div.appendChild(arrow);

      li.appendChild(div);
      li.appendChild(Object.assign(document.createElement("div"), { className: "school-level" })).appendChild(document.createElement("ul"));

      if (insertFunc) insertFunc(menuListElement, li);
      else menuListElement.prepend(li);
    }
  };

  const createMenuItemLegacy = (id, text, iconClass, targetUrl) => {
    const list = document.querySelector("ul.funclistul");
    if (list && !document.querySelector(`#li_chaoxing-assignment-${id}`)) {
      const li = document.createElement("li");
      li.id = `li_chaoxing-assignment-${id}`;
      li.className = '';
      li.innerHTML = `<span></span><a id="chaoxing-assignment-${id}" href="javascript:switchM('chaoxing-assignment-${id}','${targetUrl}')" target="_top" title="${text}" class=""><b class="liticons znewyun ${iconClass}"></b><em>${text}</em></a>`;
      list.prepend(li);
    }
  };

  // URL 常量
  const URL_HOMEWORK = 'https://mooc1-api.chaoxing.com/work/stu-work#chaoxing-assignment';
  const URL_EXAM = 'https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode#chaoxing-assignment';
  const URL_TODO = 'https://mooc1-api.chaoxing.com/work/stu-work#chaoxing-assignment-todo';
  const URL_ACTIVITIES = 'https://mooc1-api.chaoxing.com/work/stu-work#chaoxing-assignment-activities';
  const URL_DASHBOARD = 'https://mooc1-api.chaoxing.com/work/stu-work#chaoxing-dashboard';
  const API_COURSE_LIST = 'https://mooc1-api.chaoxing.com/mycourse/backclazzdata?view=json&mcode=';

  const initMenus = () => {
    // 只创建单个"学习仪表盘"入口
    if (document.querySelector('div.menubar[role="menubar"]')) {
      if (!document.querySelector('#first1000000')) {
        createMenuItem('1000000', '📊 学习仪表盘', 'icon-bj', URL_DASHBOARD);
      }
    }
    else if (document.querySelector("ul.menu-list-ul")) {
      if (!document.querySelector('#first_chaoxing_assignment_dashboard')) {
        createMenuItemNew('dashboard', '📊 学习仪表盘', 'icon-bj', URL_DASHBOARD);
      }
    }
    else if (document.querySelector("ul.funclistul")) {
      createMenuItemLegacy('dashboard', '📊 学习仪表盘', 'zne_bj_icon', URL_DASHBOARD);
    }
  };

  // 新标签页打开的菜单项创建函数
  const createMenuItemNewTab = (id, text, iconClass, targetUrl) => {
    const menubarElement = document.querySelector('div.menubar[role="menubar"]');
    if (menubarElement) {
      const a = document.createElement("a");
      a.setAttribute("role", "menuitem");
      a.setAttribute("tabindex", "-1");
      a.id = `first${id}`;
      a.href = targetUrl;
      a.target = "_blank";
      a.style.cursor = "pointer";

      const icon = document.createElement("span");
      icon.className = `icon-space ${iconClass}`;
      a.appendChild(icon);

      const h5 = document.createElement("h5");
      h5.title = text;
      h5.innerHTML = `<b>${text}</b>`;
      a.appendChild(h5);

      const arrow = document.createElement("span");
      arrow.className = "arrow icon-uniE900";
      a.appendChild(arrow);

      menubarElement.prepend(a);
    }
  };

  const createMenuItemNewTabNew = (id, text, iconClass, targetUrl) => {
    const menuListElement = document.querySelector("ul.menu-list-ul");
    if (menuListElement) {
      const li = document.createElement("li");
      li.setAttribute("level", "1");
      li.setAttribute("table-type", "1");
      li.setAttribute("data-id", `chaoxing-assignment-${id}`);

      const div = document.createElement("div");
      div.className = "label-item";
      div.setAttribute("role", "menuitem");
      div.setAttribute("level", "1");
      div.setAttribute("tabindex", "-1");
      div.setAttribute("name", text);
      div.setAttribute("id", `first_chaoxing_assignment_${id}`);
      div.style.cursor = "pointer";
      div.onclick = () => window.open(targetUrl, '_blank');

      const icon = document.createElement("span");
      icon.className = `icon-space ${iconClass}`;
      div.appendChild(icon);

      const h3 = document.createElement("h3");
      h3.title = text;
      h3.textContent = text;
      div.appendChild(h3);

      const arrow = document.createElement("span");
      arrow.className = "slide-arrow icon-h-arrow-l hide";
      div.appendChild(arrow);

      li.appendChild(div);
      li.appendChild(Object.assign(document.createElement("div"), { className: "school-level" })).appendChild(document.createElement("ul"));

      menuListElement.prepend(li);
    }
  };

  const createMenuItemLegacyNewTab = (id, name, iconClass, url) => {
    const list = document.querySelector("ul.funclistul");
    if (list && !document.querySelector(`#first_chaoxing_assignment_${id}`)) {
      const existingItem = list.querySelector('li a');
      if (existingItem) {
        const li = document.createElement("li");
        li.id = `first_chaoxing_assignment_${id}`;

        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.title = name;

        const span = document.createElement("span");
        span.className = iconClass;
        a.appendChild(span);
        a.appendChild(document.createTextNode(name));

        li.appendChild(a);
        list.prepend(li);
      }
    }
  };

  // --- 课程任务汇总功能 ---
  // GM_xmlhttpRequest 封装为 Promise
  const gmFetch = (url, options = {}) => {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: url,
        headers: options.headers || {},
        data: options.data,
        responseType: options.responseType || 'text',
        timeout: options.timeout || 15000,
        onload: (response) => {
          if (response.status >= 200 && response.status < 400) {
            resolve(response);
          } else {
            reject(new Error(`Request failed: ${response.status}`));
          }
        },
        onerror: (error) => reject(error),
        ontimeout: () => reject(new Error('Request timeout'))
      });
    });
  };

  // 获取所有课程列表
  const fetchCourseList = async () => {
    try {
      console.log('[课程任务] 正在获取课程列表:', API_COURSE_LIST);
      const response = await gmFetch(API_COURSE_LIST);
      console.log('[课程任务] 课程列表原始响应:', response.responseText.substring(0, 1000));
      const data = JSON.parse(response.responseText);
      console.log('[课程任务] 解析后数据:', data);

      if (!data.channelList) {
        console.log('[课程任务] 没有 channelList');
        return [];
      }

      const courses = [];
      for (const channel of data.channelList) {
        const content = channel.content;
        if (!content) continue;

        // 检查是否是课程（有 course 对象）
        if (content.course && content.course.data && content.course.data.length > 0) {
          const courseInfo = content.course.data[0];

          // 尝试多种方式获取 clazzId
          let clazzId = '';
          if (content.clazz && content.clazz.data && content.clazz.data.length > 0) {
            clazzId = String(content.clazz.data[0].id);
          } else if (content.id) {
            clazzId = String(content.id);
          } else if (channel.key) {
            clazzId = String(channel.key);
          }

          // 只添加有 clazzId 的课程（API 需要此参数）
          if (courseInfo && clazzId) {
            courses.push({
              courseId: String(courseInfo.id),
              courseName: courseInfo.name || '未知课程',
              clazzId: clazzId,
              cpi: String(content.cpi || ''),
              teacherName: courseInfo.teacherfactor || ''
            });
            console.log(`[课程任务] 解析课程: ${courseInfo.name}, clazzId=${clazzId}`);
          } else if (courseInfo) {
            console.log(`[课程任务] 跳过无 clazzId 的课程: ${courseInfo.name}`);
          }
        }
      }
      console.log('[课程任务] 最终解析到课程:', courses.length, '个');
      return courses;
    } catch (error) {
      console.error('[课程任务] 获取课程列表失败:', error);
      return [];
    }
  };

  const normalizeTaskType = (item) => {
    const typeMap = {
      0: '签到', 2: '签到', 4: '抢答', 5: '分组讨论', 6: '投票',
      14: '问卷', 17: '直播', 23: '随堂练习', 35: '分组任务', 42: '随堂练习',
      43: '评分', 45: '拍照', 47: '作业', 64: '笔记'
    };
    const title = `${item.nameOne || item.name || item.title || ''}`;
    if (/AI\s*实践|AI\s*评价/i.test(title)) return 'AI实践';
    if (/分组/.test(title) && /讨论/.test(title)) return '分组讨论';
    if (/考试/.test(title)) return '考试';
    if (/测验|练习/.test(title)) return '测验';
    return typeMap[item.activeType] || typeMap[item.type] || '其他任务';
  };

  const getTaskEngineLink = (taskId, course) => taskId
    ? `https://task.chaoxing.com/api/v1/middlePageApi/jumpStudyPlanList?taskId=${encodeURIComponent(taskId)}&moocClassId=${encodeURIComponent(course.clazzId)}`
    : '';

  const normalizeTaskEnginePlanType = (plan) => {
    const typeName = `${plan.planTypeName || ''}`.trim();
    const searchable = `${typeName} ${plan.name || ''}`;
    if (/AI\s*实践|AI\s*评价|AI\s*对话/i.test(searchable)) return 'AI实践';
    if (/分组/.test(searchable) && /(任务|作业)/.test(searchable)) return '分组任务';
    if (/讨论/.test(searchable)) return '分组讨论';
    if (/考试/.test(searchable)) return '考试';
    if (/作业/.test(searchable)) return '作业';
    if (/随堂练习/.test(searchable)) return '随堂练习';
    if (/测验|自测|练习/.test(searchable)) return '测验';
    if (/签到/.test(searchable)) return '签到';
    if (/问卷/.test(searchable)) return '问卷';
    if (/抢答/.test(searchable)) return '抢答';
    if (/投票/.test(searchable)) return '投票';
    if (/直播/.test(searchable)) return '直播';
    if (/评分/.test(searchable)) return '评分';
    if (/拍照/.test(searchable)) return '拍照';
    if (/笔记/.test(searchable)) return '笔记';
    if (/课程|章节|知识点|视频|文档|音频|阅读/.test(searchable)) return '视频/任务点';

    const typeMap = {
      0: '视频/任务点', 1: '视频/任务点', 4: '作业', 5: '考试',
      8: '视频/任务点', 9: '签到', 10: '视频/任务点', 11: '视频/任务点',
      13: '测验', 14: '分组讨论', 15: 'AI实践', 17: '测验', 22: '视频/任务点'
    };
    return typeMap[plan.planType] || '其他任务';
  };

  const normalizeTaskEngineSummaryItem = (item, course) => {
    const planCount = Number(item.planCount) || 0;
    const planFinishCount = Number(item.planFinishCount) || 0;
    const studyProgress = Number(item.taskStudyProgress) || 0;
    const qualifyStatus = `${item.userTaskQualifyStatus || ''}`;
    const isFinished = qualifyStatus === '已达标'
      || qualifyStatus === '已完成'
      || studyProgress >= 1
      || (planCount > 0 && planFinishCount >= planCount);
    const taskId = item.id ? String(item.id) : '';

    return {
      activeId: taskId ? `task-engine-${taskId}` : `task-engine-${course.courseId}-${item.name || ''}`,
      taskId,
      title: item.name || '未命名任务引擎任务',
      type: '任务引擎',
      status: isFinished ? '已结束' : '进行中',
      time: item.lastStudyDateStr || item.createDate || '',
      endTime: '',
      courseName: course.courseName,
      course: course.courseName,
      courseId: course.courseId,
      clazzId: course.clazzId,
      cpi: course.cpi,
      finished: isFinished,
      ongoing: !isFinished,
      activeType: 'task-engine',
      taskEngine: true,
      taskEnginePlan: false,
      taskLink: getTaskEngineLink(taskId, course),
      progressText: planCount > 0 ? `${planFinishCount}/${planCount}` : '',
      isActivity: true
    };
  };

  const extractTaskEngineUserId = (response) => {
    const html = `${response?.responseText || ''}`;
    const htmlMatch = html.match(/(?:const|let|var)\s+eTaskUserId\s*=\s*["']([^"']+)["']/);
    if (htmlMatch) return htmlMatch[1];
    try {
      return new URL(response?.finalUrl || '').searchParams.get('encryTaskUserId') || '';
    } catch {
      return '';
    }
  };

  const parseTaskEngineDate = (value) => {
    if (value === null || value === undefined || value === '') return NaN;
    if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;

    const text = normalizeTaskEngineDateText(value);
    // 平台详情页常返回“09-20 20:00”这种省略年份的日期。
    // Date.parse 会把它误解析为 2001 年，进而把当前年度的任务判为已过期。
    const shortDateMatch = text.match(/^(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (shortDateMatch) {
      const [, monthText, dayText, hourText = '0', minuteText = '0', secondText = '0'] = shortDateMatch;
      const now = new Date();
      const year = now.getFullYear();
      const parsed = new Date(
        year,
        Number(monthText) - 1,
        Number(dayText),
        Number(hourText),
        Number(minuteText),
        Number(secondText)
      );
      if (
        parsed.getFullYear() === year
        && parsed.getMonth() === Number(monthText) - 1
        && parsed.getDate() === Number(dayText)
      ) return parsed.getTime();
    }

    return Date.parse(text.replace(/-/g, '/'));
  };

  const isTaskEnginePlanFinished = (plan) => plan.isFinish === true
    || Number(plan.isFinish) === 1
    || Number(plan.planUser?.finish) === 1
    || Number(plan.score?.completed) === 1;

  const taskEngineDetailCache = new Map();
  const TASK_ENGINE_DEADLINE_TYPES = new Set([
    '作业', '考试', '测验', '随堂练习', '分组任务', '分组讨论',
    '签到', '问卷', '抢答', '投票', '直播', 'AI实践'
  ]);
  const TASK_ENGINE_DETAIL_HOSTS = new Set([
    'mooc1.chaoxing.com', 'mooc2-ans.chaoxing.com', 'mobilelearn.chaoxing.com',
    'i.chaoxing.com', 'task.chaoxing.com'
  ]);

  const htmlToTaskEngineText = (html) => {
    const source = `${html || ''}`;
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(source, 'text/html');
      return `${doc.body?.textContent || ''}`.replace(/\s+/g, ' ').trim();
    }
    return source
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeTaskEngineDateText = (value) => `${value || ''}`
    .trim()
    .replace(/年|\//g, '-')
    .replace(/月/g, '-')
    .replace(/日/g, '')
    .replace(/\./g, '-')
    .replace(/\s+/g, ' ');

  const extractTaskEngineDetailTimes = (html) => {
    const text = htmlToTaskEngineText(html);
    if (!text) return { startTime: '', endTime: '' };
    const datePattern = '(?:\\d{4}[-/.年]\\d{1,2}[-/.月]\\d{1,2}日?|\\d{1,2}[-/.月]\\d{1,2}日?)(?:\\s+\\d{1,2}:\\d{2}(?::\\d{2})?)?';
    const endMatch = text.match(new RegExp(`(?:截止时间|结束时间|截止日期|有效期至)\\s*[:：]?\\s*(${datePattern})`, 'i'));
    const startMatch = text.match(new RegExp(`(?:开始时间|开放时间)\\s*[:：]?\\s*(${datePattern})`, 'i'));
    const periodMatch = text.match(new RegExp(`(?:作答时间|考试时间|活动时间|任务时间|学习时间|开放时间)\\s*[:：]?\\s*(${datePattern})\\s*(?:至|到|~|～)\\s*(${datePattern})`, 'i'));
    return {
      startTime: normalizeTaskEngineDateText(startMatch?.[1] || periodMatch?.[1] || ''),
      endTime: normalizeTaskEngineDateText(endMatch?.[1] || periodMatch?.[2] || '')
    };
  };

  const normalizeTaskEngineStudyUrl = (url, domainName = '') => {
    if (!url) return '';
    try {
      const base = /^https?:\/\//i.test(domainName) ? domainName : 'https://task.chaoxing.com/';
      const resolved = new URL(url, base);
      return /^https?:$/.test(resolved.protocol) ? resolved.href : '';
    } catch {
      return '';
    }
  };

  const resolveTaskEnginePlanDetails = async (plan, taskUserId, apiHeaders, fallbackLink) => {
    const planFallbackLink = normalizeTaskEngineStudyUrl(plan.hyperLink || plan.url) || fallbackLink;
    if (!plan.encryptPlanId) return { taskLink: planFallbackLink, startTime: '', endTime: '' };
    const cacheKey = `${taskUserId}:${plan.encryptPlanId}`;
    if (taskEngineDetailCache.has(cacheKey)) return taskEngineDetailCache.get(cacheKey);

    const pending = (async () => {
      const result = { taskLink: planFallbackLink, startTime: '', endTime: '' };
      try {
        const studyUrl = `https://task.chaoxing.com/userStudyPlan/getToStudyUrl?encryptPlanId=${encodeURIComponent(plan.encryptPlanId)}&encryTaskUserId=${encodeURIComponent(taskUserId)}&studyJumpType=0&isInterface=false`;
        const studyResponse = await gmFetch(studyUrl, { method: 'POST', headers: apiHeaders });
        const studyPayload = JSON.parse(studyResponse.responseText);
        if (!studyPayload?.result) throw new Error(studyPayload?.message || '直达链接接口返回失败');
        const directUrl = normalizeTaskEngineStudyUrl(studyPayload.data?.url, studyPayload.data?.domainName);
        if (!directUrl) return result;
        result.taskLink = directUrl;

        const type = normalizeTaskEnginePlanType(plan);
        if (plan.endDateStr || isTaskEnginePlanFinished(plan) || !TASK_ENGINE_DEADLINE_TYPES.has(type)) return result;
        const host = new URL(directUrl).hostname;
        if (!TASK_ENGINE_DETAIL_HOSTS.has(host)) return result;

        try {
          const detailResponse = await gmFetch(directUrl, {
            headers: { Referer: 'https://task.chaoxing.com/' },
            timeout: 12000
          });
          result.taskLink = normalizeTaskEngineStudyUrl(detailResponse.finalUrl) || directUrl;
          Object.assign(result, extractTaskEngineDetailTimes(detailResponse.responseText));
        } catch (error) {
          console.warn(`[任务引擎] “${plan.name || plan.planId || ''}”期限读取失败，保留平台直达链接:`, error);
        }
      } catch (error) {
        console.warn(`[任务引擎] “${plan.name || plan.planId || ''}”直达链接读取失败，保留任务包链接:`, error);
      }
      return result;
    })();
    taskEngineDetailCache.set(cacheKey, pending);
    return pending;
  };

  const normalizeTaskEnginePlan = (plan, task, course, details = {}) => {
    const taskId = task.id ? String(task.id) : '';
    const planId = plan.planId ? String(plan.planId) : '';
    const type = normalizeTaskEnginePlanType(plan);
    const isFinished = isTaskEnginePlanFinished(plan);
    const startTime = plan.startDateStr || details.startTime || '';
    const endTime = plan.endDateStr || details.endTime || '';
    const isExpired = !isFinished
      && Number.isFinite(parseTaskEngineDate(endTime))
      && parseTaskEngineDate(endTime) < Date.now();
    const isLocked = !isFinished && !isExpired && plan.planAllowStudy === false;
    const status = isFinished ? '已完成' : (isExpired ? '已过期' : (isLocked ? '未开始' : '进行中'));
    const taskLink = details.taskLink || getTaskEngineLink(taskId, course);

    return {
      activeId: `task-engine-${taskId}-plan-${planId || plan.name || ''}`,
      taskId,
      planId,
      title: plan.name || task.name || '未命名任务',
      type,
      planType: plan.planType,
      planTypeName: plan.planTypeName || '',
      parentTaskTitle: task.name || '',
      status,
      time: endTime || startTime,
      startTime,
      endTime,
      leftTime: endTime,
      timeLeft: endTime,
      courseName: course.courseName,
      course: course.courseName,
      courseId: course.courseId,
      clazzId: course.clazzId,
      classId: course.clazzId,
      cpi: course.cpi,
      finished: isFinished,
      expired: isExpired,
      ongoing: !isFinished && !isExpired && !isLocked,
      uncommitted: type === '作业' ? !isFinished && !isExpired : undefined,
      activeType: 'task-engine-plan',
      taskEngine: true,
      taskEnginePlan: true,
      taskLink,
      isActivity: true
    };
  };

  const fetchTaskEnginePlans = async (task, course) => {
    const fallback = normalizeTaskEngineSummaryItem(task, course);
    if (!fallback.taskLink) return [fallback];

    try {
      let landingResponse;
      try {
        landingResponse = await gmFetch(fallback.taskLink, {
          headers: { Referer: 'https://mobilelearn.chaoxing.com/' }
        });
      } catch {
        landingResponse = null;
      }
      let taskUserId = extractTaskEngineUserId(landingResponse);
      if (!taskUserId) {
        const subPageUrl = `https://task.chaoxing.com/userStudyPlan/studyPlanSubPage?taskId=${encodeURIComponent(fallback.taskId)}&encryJumpGroupId=null`;
        landingResponse = await gmFetch(subPageUrl, { headers: { Referer: fallback.taskLink } });
        taskUserId = extractTaskEngineUserId(landingResponse);
      }
      if (!taskUserId) throw new Error('未找到任务用户标识');

      const apiHeaders = {
        'X-Requested-With': 'XMLHttpRequest',
        Referer: landingResponse.finalUrl || fallback.taskLink
      };
      const groupUrl = `https://task.chaoxing.com/userStudyPlan/getGroupData?encryTaskUserId=${encodeURIComponent(taskUserId)}`;
      const groupResponse = await gmFetch(groupUrl, { method: 'POST', headers: apiHeaders });
      const groups = JSON.parse(groupResponse.responseText).data;
      if (!Array.isArray(groups) || groups.length === 0) return [fallback];

      const readableGroups = groups.filter(group => group?.encryptGroupId);
      if (readableGroups.length !== groups.length) throw new Error('任务分组标识不完整');
      const planResults = await Promise.allSettled(readableGroups
        .map(group => {
          const planUrl = `https://task.chaoxing.com/userStudyPlan/getPlanDataByGroupId?encryTaskUserId=${encodeURIComponent(taskUserId)}&encryGroupId=${encodeURIComponent(group.encryptGroupId)}`;
          return gmFetch(planUrl, { method: 'POST', headers: apiHeaders });
        }));
      if (planResults.some(result => result.status !== 'fulfilled')) throw new Error('部分任务分组读取失败');
      const plans = planResults.flatMap((result) => {
        const data = JSON.parse(result.value.responseText).data;
        if (!Array.isArray(data)) throw new Error('任务分组明细格式异常');
        return data;
      });

      if (!plans.length) return [fallback];
      const normalizedPlans = [];
      for (const plan of plans) {
        const details = await resolveTaskEnginePlanDetails(plan, taskUserId, apiHeaders, fallback.taskLink);
        normalizedPlans.push(normalizeTaskEnginePlan(plan, task, course, details));
      }
      return normalizedPlans;
    } catch (error) {
      console.warn(`[任务引擎] ${course.courseName} 的任务“${task.name || task.id || ''}”明细读取失败，保留任务包:`, error);
      return [fallback];
    }
  };

  const expandTaskEngineItems = async (items, course) => {
    if (!Array.isArray(items)) return [];
    const expanded = [];
    for (const item of items) {
      expanded.push(...await fetchTaskEnginePlans(item, course));
    }
    return expanded;
  };

  // 获取单个课程的课堂活动与任务引擎任务。视频/任务点仅在课程进度中展示，避免重复出现。
  const fetchCourseActivities = async (course) => {
    try {
      const timestamp = Date.now();
      const activityUrl = `https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist?fid=0&courseId=${course.courseId}&classId=${course.clazzId}&showNotStartedActive=0&_=${timestamp}`;
      const taskEngineUrl = `https://mobilelearn.chaoxing.com/v2/apis/active/getData?DB_STRATEGY=DEFAULT&courseId=${course.courseId}&classId=${course.clazzId}`;
      console.log(`[课程任务] 获取课程活动与任务引擎 ${course.courseName}`);

      const [activityResult, taskEngineResult] = await Promise.allSettled([
        gmFetch(activityUrl),
        gmFetch(taskEngineUrl)
      ]);

      let activeList = null;
      if (activityResult.status === 'fulfilled') {
        try {
          const data = JSON.parse(activityResult.value.responseText);
          if (data.data && data.data.activeList) {
            activeList = data.data.activeList;
          } else if (data.activeList) {
            activeList = data.activeList;
          } else if (Array.isArray(data.data)) {
            activeList = data.data;
          } else if (Array.isArray(data)) {
            activeList = data;
          }
        } catch (error) {
          console.warn(`[课程任务] ${course.courseName} 课堂活动解析失败:`, error);
        }
      } else {
        console.warn(`[课程任务] ${course.courseName} 课堂活动读取失败:`, activityResult.reason);
      }

      const activities = (activeList || []).map((item) => {
        // 状态判断：status=1 进行中，status=2 已结束
        const isOngoing = item.status === 1;
        const isEnded = item.status === 2;

        return {
          activeId: item.id || item.activeId || '',
          title: item.nameOne || item.name || item.title || '未知任务',
          type: normalizeTaskType(item),
          status: isOngoing ? '进行中' : (isEnded ? '已结束' : '未开始'),
          time: item.startTime ? new Date(item.startTime).toLocaleString() : '',
          endTime: item.endTime ? new Date(item.endTime).toLocaleString() : '',
          courseName: course.courseName,
          courseId: course.courseId,
          clazzId: course.clazzId,
          cpi: course.cpi,
          finished: isEnded,
          ongoing: isOngoing,
          activeType: item.activeType || item.type,
          isActivity: true
        };
      });

      let taskEngineItems = [];
      if (taskEngineResult.status === 'fulfilled') {
        try {
          const taskEngineData = JSON.parse(taskEngineResult.value.responseText);
          taskEngineItems = await expandTaskEngineItems(taskEngineData.data, course);
        } catch (error) {
          console.warn(`[课程任务] ${course.courseName} 任务引擎解析失败:`, error);
        }
      } else {
        console.warn(`[课程任务] ${course.courseName} 任务引擎读取失败:`, taskEngineResult.reason);
      }

      console.log(`[课程任务] ${course.courseName} 找到 ${activities.length} 个课堂活动、${taskEngineItems.length} 个任务引擎任务`);
      return [...activities, ...taskEngineItems];
    } catch (error) {
      console.error(`[课程任务] 获取课程 ${course.courseName} 的任务失败:`, error);
      return [];
    }
  };

  // 获取所有课程的任务汇总
  const fetchAllActivities = async () => {
    const courses = await fetchCourseList();
    console.log(`[课程任务] 找到 ${courses.length} 个课程`);

    if (courses.length === 0) {
      return [];
    }

    // 并发获取所有课程的任务（限制并发数防止请求过多）
    const batchSize = 5;
    const allActivities = [];

    for (let i = 0; i < courses.length; i += batchSize) {
      const batch = courses.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(course => fetchCourseActivities(course))
      );
      allActivities.push(...batchResults.flat());
    }

    console.log(`[课程任务] 共获取 ${allActivities.length} 个任务`);
    return allActivities;
  };


  function extractTasks(doc = document) {
    let taskElements = doc.querySelectorAll("#chaoxing-assignment-wrapper ul.nav > li");
    if (taskElements.length === 0) taskElements = doc.querySelectorAll("ul.nav > li");

    const tasks = Array.from(taskElements).map((task) => {
      var _a, _b, _c;
      const optionElement = task.querySelector('div[role="option"]');
      let title = "";
      let status = "";
      let uncommitted = false;
      let course = "";
      let leftTime = "";
      if (optionElement) {
        title = ((_a = optionElement.querySelector("p")) == null ? void 0 : _a.textContent) || "";
        const statusElement = optionElement.querySelector("span:nth-of-type(1)");
        status = (statusElement == null ? void 0 : statusElement.textContent) || "";
        uncommitted = (statusElement == null ? void 0 : statusElement.className.includes("status")) || false;
        course = ((_b = optionElement.querySelector("span:nth-of-type(2)")) == null ? void 0 : _b.textContent) || "";
        leftTime = ((_c = optionElement.querySelector(".fr")) == null ? void 0 : _c.textContent) || "";
      }
      const raw = task.getAttribute("data") || "";
      let workId = "";
      let courseId = "";
      let clazzId = "";
      if (raw) {
        const rawUrl = new URL(raw);
        const searchParams = rawUrl.searchParams;
        workId = searchParams.get("taskrefId") || "";
        courseId = searchParams.get("courseId") || "";
        clazzId = searchParams.get("clazzId") || "";
      }
      return { type: "作业", title, status, uncommitted, course, leftTime, workId, courseId, clazzId, raw };
    });
    return tasks;
  }

  function extractExams(doc = document) {
    let examElements = doc.querySelectorAll("#chaoxing-assignment-wrapper ul.ks_list > li");
    if (examElements.length === 0) examElements = doc.querySelectorAll("ul.ks_list > li");

    const exams = Array.from(examElements).map((exam) => {
      var _a, _b, _c, _d;
      const dlElement = exam.querySelector("dl");
      const imgElement = exam.querySelector("div.ks_pic > img");
      let title = "";
      let timeLeft = "";
      let status = "";
      let expired = false;
      let examId = "";
      let courseId = "";
      let classId = "";
      if (dlElement) {
        title = ((_a = dlElement.querySelector("dt")) == null ? void 0 : _a.textContent) || "";
        timeLeft = ((_b = dlElement.querySelector("dd")) == null ? void 0 : _b.textContent) || "";
      }
      if (imgElement) {
        expired = ((_c = imgElement.getAttribute("src")) == null ? void 0 : _c.includes("ks_02")) || false;
      }
      status = ((_d = exam.querySelector("span.ks_state")) == null ? void 0 : _d.textContent) || "";
      const raw = exam.getAttribute("data") || "";
      if (raw) {
        let fullRaw = raw;
        if (raw.startsWith('/')) fullRaw = window.location.protocol + "//" + window.location.host + raw;
        try {
          const rawUrl = new URL(fullRaw);
          const searchParams = rawUrl.searchParams;
          examId = searchParams.get("taskrefId") || "";
          courseId = searchParams.get("courseId") || "";
          classId = searchParams.get("classId") || "";
        } catch (e) { }
      }
      const finished = status.includes("已完成") || status.includes("待批阅");
      return { type: "考试", title, status, timeLeft, expired, finished, examId, courseId, classId, raw };
    });
    return exams;
  }

  function extractExamsFromTable(doc = document) {
    let examRows = doc.querySelectorAll("table.dataTable tr.dataTr");
    if (examRows.length === 0) return [];

    const exams = Array.from(examRows).map((row) => {
      const cells = row.querySelectorAll("td");
      if (cells.length < 9) return null;

      const index = cells[0]?.textContent?.trim() || "";
      const title = cells[1]?.textContent?.trim() || "";
      const timeRange = cells[2]?.textContent?.trim() || "";
      const duration = cells[3]?.textContent?.trim() || "";
      const examStatus = cells[4]?.textContent?.trim() || "";
      const answerStatus = cells[5]?.textContent?.trim() || "";
      const score = cells[6]?.textContent?.trim() || "---";
      const examMethod = cells[7]?.textContent?.trim() || "";

      // 从操作链接中提取参数
      const actionLink = cells[8]?.querySelector("a");
      const actionText = actionLink?.textContent?.trim() || "";
      const onclickAttr = actionLink?.getAttribute("onclick") || "";

      let courseId = "";
      let classId = "";
      let examId = "";
      let raw = "";

      const goMatch = onclickAttr.match(/go\(['"]([^'"]+)['"]\)/);
      if (goMatch) {
        raw = goMatch[1];
        try {
          const fullUrl = new URL(raw, window.location.origin);
          const refer = fullUrl.searchParams.get("refer") || "";
          const referDecoded = decodeURIComponent(refer);
          const referUrl = new URL(referDecoded, window.location.origin);
          courseId = referUrl.searchParams.get("courseId") || fullUrl.searchParams.get("moocId") || "";
          classId = referUrl.searchParams.get("classId") || fullUrl.searchParams.get("clazzid") || "";
          examId = referUrl.searchParams.get("examId") || "";
        } catch (e) {
          const moocMatch = onclickAttr.match(/moocId=(\d+)/);
          const clazzMatch = onclickAttr.match(/clazzid=(\d+)/);
          const examIdMatch = onclickAttr.match(/examId=(\d+)/);
          if (moocMatch) courseId = moocMatch[1];
          if (clazzMatch) classId = clazzMatch[1];
          if (examIdMatch) examId = examIdMatch[1];
        }
      }

      const expired = examStatus.includes("已结束");
      const finished = answerStatus.includes("已完成") || answerStatus.includes("待批阅");
      const status = answerStatus || examStatus;
      const timeLeft = expired ? "已结束" : timeRange;

      return {
        type: "考试",
        title,
        status,
        timeLeft,
        timeRange,
        duration,
        examStatus,
        answerStatus,
        score,
        examMethod,
        expired,
        finished,
        examId,
        courseId,
        classId,
        raw
      };
    }).filter(e => e !== null);

    return exams;
  }

  const API_VISIT_COURSE = "https://mooc1.chaoxing.com/visit/stucoursemiddle?ismooc2=1";
  const API_EXAM_LIST = "https://mooc1.chaoxing.com/exam-ans/exam/test/examcode/examlist?edition=1&nohead=0&fid=";
  const API_OPEN_EXAM = "https://mooc1-api.chaoxing.com/exam-ans/exam/test/examcode/examnotes";
  const cssLoader = (e) => {
    const t = GM_getResourceText(e);
    return GM_addStyle(t), t;
  };
  cssLoader("VuetifyStyle");

  // --- Vue Components ---
  const _sfc_main$2 = /* @__PURE__ */ vue.defineComponent({
    __name: "tasks-list",
    setup(__props) {
      const extractedData = extractTasks();
      const headers = [
        { key: "title", title: "作业名称" },
        { key: "course", title: "课程" },
        { key: "leftTime", title: "剩余时间" },
        { key: "status", title: "状态" },
        { key: "action", title: "", sortable: false }
      ];
      const search = vue.ref("");
      const getCourseLinkHref = (item) => {
        const courseId = item.courseId;
        const clazzId = item.clazzId;
        const requestUrl = new URL(API_VISIT_COURSE);
        requestUrl.searchParams.append("courseid", courseId);
        requestUrl.searchParams.append("clazzid", clazzId);
        requestUrl.searchParams.append("pageHeader", "8");
        return requestUrl.href;
      };
      return (_ctx, _cache) => {
        const _component_v_text_field = vue.resolveComponent("v-text-field");
        const _component_v_btn = vue.resolveComponent("v-btn");
        const _component_v_data_table = vue.resolveComponent("v-data-table");
        const _component_v_card = vue.resolveComponent("v-card");
        return vue.openBlock(), vue.createBlock(_component_v_card, { title: "作业列表", variant: "flat" }, {
          text: vue.withCtx(() => [
            vue.createVNode(_component_v_text_field, {
              modelValue: search.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => search.value = $event),
              label: "搜索", "prepend-inner-icon": "search", variant: "outlined", "hide-details": "", "single-line": ""
            })
          ]),
          default: vue.withCtx(() => [
            vue.createVNode(_component_v_data_table, {
              items: vue.unref(extractedData), search: search.value, hover: "", headers, sticky: "", "items-per-page": "-1", "hide-default-footer": ""
            }, {
              "item.action": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_btn, {
                  variant: item.uncommitted ? "tonal" : "plain", color: "primary", href: getCourseLinkHref(item), target: "_blank"
                }, {
                  default: vue.withCtx(() => [vue.createTextVNode(vue.toDisplayString(item.uncommitted ? "立即完成" : "查看详情"), 1)])
                }, 1032, ["variant", "href"])
              ])
            }, 8, ["items", "search"])
          ])
        });
      };
    }
  });

  const _sfc_main$1 = /* @__PURE__ */ vue.defineComponent({
    __name: "App",
    setup(__props) {
      return (_ctx, _cache) => {
        return vue.openBlock(), vue.createBlock(_sfc_main$2);
      };
    }
  });

  cssLoader("material-design-icons-iconfont/dist/material-design-icons.css");

  // --- Vuetify Helper Functions (恢复原版代码) ---
  // 这些是原脚本为了适配图标组件而手写的一堆辅助函数，之前被误删
  function isObject(obj) {
    return obj !== null && typeof obj === "object" && !Array.isArray(obj);
  }
  function pick(obj, paths) {
    const found = {};
    const keys = new Set(Object.keys(obj));
    for (const path of paths) {
      if (keys.has(path)) {
        found[path] = obj[path];
      }
    }
    return found;
  }
  function mergeDeep() {
    let source = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    let target = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
    let arrayFn = arguments.length > 2 ? arguments[2] : void 0;
    const out = {};
    for (const key in source) {
      out[key] = source[key];
    }
    for (const key in target) {
      const sourceProperty = source[key];
      const targetProperty = target[key];
      if (isObject(sourceProperty) && isObject(targetProperty)) {
        out[key] = mergeDeep(sourceProperty, targetProperty, arrayFn);
        continue;
      }
      if (Array.isArray(sourceProperty) && Array.isArray(targetProperty) && arrayFn) {
        out[key] = arrayFn(sourceProperty, targetProperty);
        continue;
      }
      out[key] = targetProperty;
    }
    return out;
  }
  function toKebabCase() {
    let str = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : "";
    if (toKebabCase.cache.has(str))
      return toKebabCase.cache.get(str);
    const kebab = str.replace(/[^a-z]/gi, "-").replace(/\B([A-Z])/g, "-$1").toLowerCase();
    toKebabCase.cache.set(str, kebab);
    return kebab;
  }
  toKebabCase.cache = /* @__PURE__ */ new Map();
  function consoleWarn(message) {
    vue.warn(`Vuetify: ${message}`);
  }
  function propsFactory(props, source) {
    return (defaults) => {
      return Object.keys(props).reduce((obj, prop) => {
        const isObjectDefinition = typeof props[prop] === "object" && props[prop] != null && !Array.isArray(props[prop]);
        const definition = isObjectDefinition ? props[prop] : {
          type: props[prop]
        };
        if (defaults && prop in defaults) {
          obj[prop] = {
            ...definition,
            default: defaults[prop]
          };
        } else {
          obj[prop] = definition;
        }
        if (source && !obj[prop].source) {
          obj[prop].source = source;
        }
        return obj;
      }, {});
    };
  }
  const DefaultsSymbol = Symbol.for("vuetify:defaults");
  function injectDefaults() {
    const defaults = vue.inject(DefaultsSymbol);
    if (!defaults)
      throw new Error("[Vuetify] Could not find defaults instance");
    return defaults;
  }
  function propIsDefined(vnode, prop) {
    var _a, _b;
    return typeof ((_a = vnode.props) == null ? void 0 : _a[prop]) !== "undefined" || typeof ((_b = vnode.props) == null ? void 0 : _b[toKebabCase(prop)]) !== "undefined";
  }
  function internalUseDefaults() {
    let props = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
    let name = arguments.length > 1 ? arguments[1] : void 0;
    let defaults = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : injectDefaults();
    const vm = getCurrentInstance("useDefaults");
    name = name ?? vm.type.name ?? vm.type.__name;
    if (!name) {
      throw new Error("[Vuetify] Could not determine component name");
    }
    const componentDefaults = vue.computed(() => {
      var _a;
      return (_a = defaults.value) == null ? void 0 : _a[props._as ?? name];
    });
    const _props = new Proxy(props, {
      get(target, prop) {
        var _a, _b, _c, _d;
        const propValue = Reflect.get(target, prop);
        if (prop === "class" || prop === "style") {
          return [(_a = componentDefaults.value) == null ? void 0 : _a[prop], propValue].filter((v) => v != null);
        } else if (typeof prop === "string" && !propIsDefined(vm.vnode, prop)) {
          return ((_b = componentDefaults.value) == null ? void 0 : _b[prop]) ?? ((_d = (_c = defaults.value) == null ? void 0 : _c.global) == null ? void 0 : _d[prop]) ?? propValue;
        }
        return propValue;
      }
    });
    const _subcomponentDefaults = vue.shallowRef();
    vue.watchEffect(() => {
      if (componentDefaults.value) {
        const subComponents = Object.entries(componentDefaults.value).filter((_ref) => {
          let [key] = _ref;
          return key.startsWith(key[0].toUpperCase());
        });
        _subcomponentDefaults.value = subComponents.length ? Object.fromEntries(subComponents) : void 0;
      } else {
        _subcomponentDefaults.value = void 0;
      }
    });
    function provideSubDefaults() {
      const injected = injectSelf(DefaultsSymbol, vm);
      vue.provide(DefaultsSymbol, vue.computed(() => {
        return _subcomponentDefaults.value ? mergeDeep((injected == null ? void 0 : injected.value) ?? {}, _subcomponentDefaults.value) : injected == null ? void 0 : injected.value;
      }));
    }
    return {
      props: _props,
      provideSubDefaults
    };
  }
  function defineComponent(options) {
    options._setup = options._setup ?? options.setup;
    if (!options.name) {
      consoleWarn("The component is missing an explicit name, unable to generate default prop value");
      return options;
    }
    if (options._setup) {
      options.props = propsFactory(options.props ?? {}, options.name)();
      const propKeys = Object.keys(options.props).filter((key) => key !== "class" && key !== "style");
      options.filterProps = function filterProps(props) {
        return pick(props, propKeys);
      };
      options.props._as = String;
      options.setup = function setup(props, ctx) {
        const defaults = injectDefaults();
        if (!defaults.value)
          return options._setup(props, ctx);
        const {
          props: _props,
          provideSubDefaults
        } = internalUseDefaults(props, props._as ?? options.name, defaults);
        const setupBindings = options._setup(_props, ctx);
        provideSubDefaults();
        return setupBindings;
      };
    }
    return options;
  }
  function genericComponent() {
    let exposeDefaults = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : true;
    return (options) => (exposeDefaults ? defineComponent : vue.defineComponent)(options);
  }
  function getCurrentInstance(name, message) {
    const vm = vue.getCurrentInstance();
    if (!vm) {
      throw new Error(`[Vuetify] ${name} ${"must be called from inside a setup function"}`);
    }
    return vm;
  }
  function injectSelf(key) {
    let vm = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : getCurrentInstance("injectSelf");
    const {
      provides
    } = vm;
    if (provides && key in provides) {
      return provides[key];
    }
    return void 0;
  }
  const IconValue = [String, Function, Object, Array];
  const makeIconProps = propsFactory({
    icon: {
      type: IconValue
    },
    tag: {
      type: String,
      required: true
    }
  }, "icon");
  genericComponent()({
    name: "VComponentIcon",
    props: makeIconProps(),
    setup(props, _ref) {
      let {
        slots
      } = _ref;
      return () => {
        const Icon = props.icon;
        return vue.createVNode(props.tag, null, {
          default: () => {
            var _a;
            return [props.icon ? vue.createVNode(Icon, null, null) : (_a = slots.default) == null ? void 0 : _a.call(slots)];
          }
        });
      };
    }
  });
  defineComponent({
    name: "VSvgIcon",
    inheritAttrs: false,
    props: makeIconProps(),
    setup(props, _ref2) {
      let {
        attrs
      } = _ref2;
      return () => {
        return vue.createVNode(props.tag, vue.mergeProps(attrs, {
          "style": null
        }), {
          default: () => [vue.createVNode("svg", {
            "class": "v-icon__svg",
            "xmlns": "http://www.w3.org/2000/svg",
            "viewBox": "0 0 24 24",
            "role": "img",
            "aria-hidden": "true"
          }, [Array.isArray(props.icon) ? props.icon.map((path) => Array.isArray(path) ? vue.createVNode("path", {
            "d": path[0],
            "fill-opacity": path[1]
          }, null) : vue.createVNode("path", {
            "d": path
          }, null)) : vue.createVNode("path", {
            "d": props.icon
          }, null)])]
        });
      };
    }
  });
  const VLigatureIcon = defineComponent({
    name: "VLigatureIcon",
    props: makeIconProps(),
    setup(props) {
      return () => {
        return vue.createVNode(props.tag, null, {
          default: () => [props.icon]
        });
      };
    }
  });
  defineComponent({
    name: "VClassIcon",
    props: makeIconProps(),
    setup(props) {
      return () => {
        return vue.createVNode(props.tag, {
          "class": props.icon
        }, null);
      };
    }
  });
  const aliases = {
    collapse: "keyboard_arrow_up",
    complete: "check",
    cancel: "cancel",
    close: "close",
    delete: "cancel",
    clear: "cancel",
    success: "check_circle",
    info: "info",
    warning: "priority_high",
    error: "warning",
    prev: "chevron_left",
    next: "chevron_right",
    checkboxOn: "check_box",
    checkboxOff: "check_box_outline_blank",
    checkboxIndeterminate: "indeterminate_check_box",
    delimiter: "fiber_manual_record",
    sortAsc: "arrow_upward",
    sortDesc: "arrow_downward",
    expand: "keyboard_arrow_down",
    menu: "menu",
    subgroup: "arrow_drop_down",
    dropdown: "arrow_drop_down",
    radioOn: "radio_button_checked",
    radioOff: "radio_button_unchecked",
    edit: "edit",
    ratingEmpty: "star_border",
    ratingFull: "star",
    ratingHalf: "star_half",
    loading: "cached",
    first: "first_page",
    last: "last_page",
    unfold: "unfold_more",
    file: "attach_file",
    plus: "add",
    minus: "remove",
    calendar: "event",
    treeviewCollapse: "arrow_drop_down",
    treeviewExpand: "arrow_right",
    eyeDropper: "colorize"
  };
  const md = {
    component: (props) => vue.h(VLigatureIcon, {
      ...props,
      class: "material-icons"
    })
  };

  const _sfc_main = /* @__PURE__ */ vue.defineComponent({
    __name: "exams-list",
    setup(__props) {
      const extractedData = extractExams();
      const headers = [
        { key: "title", title: "考试名称" },
        { key: "timeLeft", title: "剩余时间" },
        { key: "status", title: "状态" },
        { key: "action", title: "", sortable: false }
      ];
      const search = vue.ref("");
      const getCourseLinkHref = (item) => {
        const requestUrl = new URL(API_OPEN_EXAM);
        requestUrl.searchParams.append("courseId", item.courseId);
        requestUrl.searchParams.append("classId", item.classId);
        requestUrl.searchParams.append("examId", item.examId);
        return requestUrl.href;
      };
      return (_ctx, _cache) => {
        const _component_v_text_field = vue.resolveComponent("v-text-field");
        const _component_v_btn = vue.resolveComponent("v-btn");
        const _component_v_data_table = vue.resolveComponent("v-data-table");
        const _component_v_card = vue.resolveComponent("v-card");
        return vue.openBlock(), vue.createBlock(_component_v_card, { title: "考试列表", variant: "flat" }, {
          text: vue.withCtx(() => [
            vue.createVNode(_component_v_text_field, {
              modelValue: search.value, "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => search.value = $event),
              label: "搜索", "prepend-inner-icon": "search", variant: "outlined", "hide-details": "", "single-line": ""
            })
          ]),
          default: vue.withCtx(() => [
            vue.createVNode(_component_v_data_table, {
              items: vue.unref(extractedData), search: search.value, hover: "", headers, sticky: "", "items-per-page": "-1", "hide-default-footer": ""
            }, {
              "item.action": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_btn, {
                  variant: item.finished || item.expired ? "plain" : "tonal", color: "primary", href: getCourseLinkHref(item), target: "_blank"
                }, {
                  default: vue.withCtx(() => [vue.createTextVNode(vue.toDisplayString(item.finished || item.expired ? "查看详情" : "前往考试"), 1)])
                }, 1032, ["variant", "href"])
              ])
            }, 8, ["items", "search"])
          ])
        });
      };
    }
  });

  const _sfc_todo = /* @__PURE__ */ vue.defineComponent({
    __name: "todo-list",
    setup(__props) {
      const allTodoItems = vue.ref([]);  // 所有待办项
      const loading = vue.ref(true);
      const search = vue.ref("");
      const showActivities = vue.ref(true);  // 是否显示课程任务（默认开启）
      const showUrgentOnly = vue.ref(false);  // 是否只显示紧急任务

      // 计算属性：根据开关过滤显示的列表
      const todoList = vue.computed(() => {
        let list = allTodoItems.value;

        // 如果启用紧急模式，只显示紧急任务
        if (showUrgentOnly.value) {
          return urgentTasks.value;
        }

        // 如果关闭课程任务显示，过滤掉 isActivity 项
        if (!showActivities.value) {
          list = list.filter(item => !item.isActivity);
        }

        return list;
      });

      const headers = [
        { key: "type", title: "类型" },
        { key: "title", title: "任务名称" },
        { key: "course", title: "课程" },
        { key: "info", title: "截止/剩余时间" },
        { key: "status", title: "状态" },
        { key: "action", title: "", sortable: false }
      ];

      // 检测24小时内截止的紧急任务
      const urgentTasks = vue.computed(() => {
        return allTodoItems.value.filter(item => {
          // 获取剩余时间字符串（作业用 leftTime，考试用 timeLeft）
          const timeStr = item.leftTime || item.timeLeft || item.info || '';

          // 尝试解析截止时间
          if (timeStr.includes('小时')) {
            const hours = parseInt(timeStr);
            return !isNaN(hours) && hours <= 24;
          }
          if (timeStr.includes('天')) {
            const days = parseInt(timeStr);
            return !isNaN(days) && days < 1;
          }
          if (timeStr.includes('分钟') || timeStr.includes('分')) {
            return true; // 还剩分钟肯定是紧急的
          }
          // 进行中的课程任务也算紧急
          if (item.isActivity && item.status === '进行中') {
            return true;
          }
          return false;
        });
      });

      const getLink = (item) => {
        if (item.isActivity) {
          if (item.taskLink) return item.taskLink;
          // 课程活动跳转到课程页面
          const requestUrl = new URL(API_VISIT_COURSE);
          requestUrl.searchParams.append("courseid", item.courseId);
          requestUrl.searchParams.append("clazzid", item.clazzId);
          requestUrl.searchParams.append("pageHeader", "0"); // 任务页面
          return requestUrl.href;
        } else if (item.type === "作业") {
          const requestUrl = new URL(API_VISIT_COURSE);
          requestUrl.searchParams.append("courseid", item.courseId);
          requestUrl.searchParams.append("clazzid", item.clazzId);
          requestUrl.searchParams.append("pageHeader", "8");
          return requestUrl.href;
        } else {
          const requestUrl = new URL(API_OPEN_EXAM);
          requestUrl.searchParams.append("courseId", item.courseId);
          requestUrl.searchParams.append("classId", item.classId);
          requestUrl.searchParams.append("examId", item.examId);
          return requestUrl.href;
        }
      };

      vue.onMounted(async () => {
        const currentTasks = extractTasks();
        const pendingTasks = currentTasks.filter(t => t.uncommitted).map(t => ({
          ...t,
          info: t.leftTime
        }));

        let pendingExams = [];
        const seenExamIds = new Set();

        try {
          const res1 = await fetch('https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode');
          const text1 = await res1.text();
          const parser1 = new DOMParser();
          const doc1 = parser1.parseFromString(text1, 'text/html');
          const exams1 = extractExams(doc1);
          exams1.filter(e => !e.finished && !e.expired).forEach(e => {
            const key = e.examId || e.title;
            if (!seenExamIds.has(key)) {
              seenExamIds.add(key);
              pendingExams.push({
                ...e,
                course: "考试课程",
                info: e.timeLeft
              });
            }
          });
        } catch (e) {
          console.error("Fetch exams from old API failed", e);
        }

        try {
          const res2 = await fetch(API_EXAM_LIST);
          const text2 = await res2.text();
          const parser2 = new DOMParser();
          const doc2 = parser2.parseFromString(text2, 'text/html');
          const exams2 = extractExamsFromTable(doc2);
          exams2.filter(e => !e.finished && !e.expired).forEach(e => {
            const key = e.examId || e.title;
            if (!seenExamIds.has(key)) {
              seenExamIds.add(key);
              pendingExams.push({
                ...e,
                course: "考试课程",
                info: e.timeLeft
              });
            }
          });
        } catch (e) {
          console.error("Fetch exams from new API failed", e);
        }

        // 获取进行中的课程任务（签到、讨论等）
        let ongoingActivities = [];
        try {
          const courses = await fetchCourseList();
          console.log('[待办任务] 获取到课程:', courses.length, '个');

          // 限制并发数
          const batchSize = 5;
          for (let i = 0; i < courses.length; i += batchSize) {
            const batch = courses.slice(i, i + batchSize);
            const batchResults = await Promise.all(
              batch.map(course => fetchCourseActivities(course))
            );
            batchResults.flat()
              .filter(activity => activity.ongoing)
              .forEach(activity => {
                ongoingActivities.push({
                  type: activity.type,
                  title: activity.title,
                  course: activity.courseName,
                  info: activity.progressText ? `进度 ${activity.progressText}` : (activity.endTime || '进行中'),
                  status: '进行中',
                  courseId: activity.courseId,
                  clazzId: activity.clazzId,
                  activeId: activity.activeId,
                  taskId: activity.taskId,
                  planId: activity.planId,
                  taskEngine: activity.taskEngine,
                  taskEnginePlan: activity.taskEnginePlan,
                  taskLink: activity.taskLink,
                  isActivity: true
                });
              });
          }
          console.log('[待办任务] 进行中任务:', ongoingActivities.length, '个');
        } catch (e) {
          console.error('[待办任务] 获取课程任务失败:', e);
        }

        // 排序：作业和考试在前，课程任务在后
        allTodoItems.value = [...pendingTasks, ...pendingExams, ...ongoingActivities];
        loading.value = false;
      });

      return (_ctx, _cache) => {
        const _component_v_text_field = vue.resolveComponent("v-text-field");
        const _component_v_switch = vue.resolveComponent("v-switch");
        const _component_v_btn = vue.resolveComponent("v-btn");
        const _component_v_data_table = vue.resolveComponent("v-data-table");
        const _component_v_card = vue.resolveComponent("v-card");
        const _component_v_chip = vue.resolveComponent("v-chip");
        const _component_v_row = vue.resolveComponent("v-row");
        const _component_v_col = vue.resolveComponent("v-col");
        const _component_v_alert = vue.resolveComponent("v-alert");

        return vue.openBlock(), vue.createBlock(_component_v_card, {
          title: showUrgentOnly.value ? "🚨 紧急任务" : "待办任务",
          variant: "flat"
        }, {
          text: vue.withCtx(() => [
            // 紧急模式下显示"返回全部"按钮
            showUrgentOnly.value ? vue.createVNode(_component_v_alert, {
              type: "info",
              variant: "tonal",
              class: "mb-4"
            }, {
              default: () => [
                vue.createVNode("div", { class: "d-flex align-center justify-space-between" }, [
                  vue.createVNode("span", {}, `正在查看 ${urgentTasks.value.length} 个紧急任务`),
                  vue.createVNode(_component_v_btn, {
                    variant: "outlined",
                    size: "small",
                    onClick: () => { showUrgentOnly.value = false; }
                  }, { default: () => [vue.createTextVNode("← 返回全部待办")] })
                ])
              ]
            }) : (
              // 非紧急模式下显示紧急任务提醒
              urgentTasks.value.length > 0 ? vue.createVNode(_component_v_alert, {
                type: "warning",
                variant: "tonal",
                class: "mb-4",
                prominent: true,
                icon: "warning"
              }, {
                default: () => [
                  vue.createVNode("div", { class: "d-flex align-center justify-space-between" }, [
                    vue.createVNode("div", {}, [
                      vue.createVNode("div", { class: "font-weight-bold" }, `⚠️ 有 ${urgentTasks.value.length} 个任务即将到期！`),
                      vue.createVNode("div", { class: "text-caption" },
                        urgentTasks.value.slice(0, 2).map(t => t.title).join('、') +
                        (urgentTasks.value.length > 2 ? ` 等${urgentTasks.value.length}个任务` : '')
                      )
                    ]),
                    vue.createVNode(_component_v_btn, {
                      variant: "elevated",
                      color: "warning",
                      size: "small",
                      onClick: () => { showUrgentOnly.value = true; }
                    }, { default: () => [vue.createTextVNode("去查看 →")] })
                  ])
                ]
              }) : null
            ),
            vue.createVNode(_component_v_row, { align: "center", class: "mb-2" }, {
              default: () => [
                vue.createVNode(_component_v_col, { cols: "8" }, {
                  default: () => [
                    vue.createVNode(_component_v_text_field, {
                      modelValue: search.value, "onUpdate:modelValue": ($event) => search.value = $event,
                      label: "搜索待办", "prepend-inner-icon": "search", variant: "outlined", "hide-details": "", "single-line": "", density: "compact"
                    })
                  ]
                }),
                vue.createVNode(_component_v_col, { cols: "4" }, {
                  default: () => [
                    vue.createVNode(_component_v_switch, {
                      modelValue: showActivities.value, "onUpdate:modelValue": ($event) => showActivities.value = $event,
                      label: "显示课程任务", color: "primary", "hide-details": "", density: "compact"
                    })
                  ]
                })
              ]
            })
          ]),
          default: vue.withCtx(() => [
            vue.createVNode(_component_v_data_table, {
              items: todoList.value, loading: loading.value, search: search.value, hover: "", headers, sticky: "", "items-per-page": "-1", "hide-default-footer": ""
            }, {
              "item.type": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_chip, {
                  color: item.isActivity ? 'orange' : (item.type === '作业' ? 'blue' : 'purple'),
                  size: 'small',
                  label: ''
                }, { default: () => [vue.createTextVNode(item.type)] })
              ]),
              "item.action": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_btn, {
                  variant: "tonal", color: "error", href: getLink(item), target: "_blank"
                }, {
                  default: vue.withCtx(() => [vue.createTextVNode("立即去办")])
                }, 8, ["href"])
              ])
            }, 8, ["items", "loading", "search"])
          ])
        });
      };
    }
  });

  // 课程任务列表组件
  const _sfc_activities = /* @__PURE__ */ vue.defineComponent({
    __name: "activities-list",
    setup(__props) {
      const activitiesList = vue.ref([]);
      const loading = vue.ref(true);
      const search = vue.ref("");
      const progress = vue.ref("");

      const headers = [
        { key: "courseName", title: "课程" },
        { key: "title", title: "任务名称" },
        { key: "type", title: "类型" },
        { key: "endTime", title: "结束时间" },
        { key: "status", title: "状态" },
        { key: "action", title: "", sortable: false }
      ];

      const getCourseLink = (item) => {
        const requestUrl = new URL(API_VISIT_COURSE);
        requestUrl.searchParams.append("courseid", item.courseId);
        requestUrl.searchParams.append("clazzid", item.clazzId);
        return requestUrl.href;
      };

      vue.onMounted(async () => {
        try {
          progress.value = "正在获取课程列表...";
          const courses = await fetchCourseList();
          progress.value = `找到 ${courses.length} 个课程，正在获取任务...`;

          const allActivities = [];
          const batchSize = 3;

          for (let i = 0; i < courses.length; i += batchSize) {
            const batch = courses.slice(i, i + batchSize);
            progress.value = `正在获取课程任务 (${Math.min(i + batchSize, courses.length)}/${courses.length})...`;

            const batchResults = await Promise.all(
              batch.map(course => fetchCourseActivities(course))
            );
            allActivities.push(...batchResults.flat());
          }

          activitiesList.value = allActivities;
          progress.value = "";
        } catch (error) {
          console.error('[课程任务] 加载失败:', error);
          progress.value = "加载失败，请刷新重试";
        } finally {
          loading.value = false;
        }
      });

      return (_ctx, _cache) => {
        const _component_v_text_field = vue.resolveComponent("v-text-field");
        const _component_v_chip = vue.resolveComponent("v-chip");
        const _component_v_btn = vue.resolveComponent("v-btn");
        const _component_v_data_table = vue.resolveComponent("v-data-table");
        const _component_v_card = vue.resolveComponent("v-card");
        const _component_v_progress_linear = vue.resolveComponent("v-progress-linear");

        return vue.openBlock(), vue.createBlock(_component_v_card, { title: "课程任务列表", variant: "flat", subtitle: progress.value }, {
          text: vue.withCtx(() => [
            vue.createVNode(_component_v_text_field, {
              modelValue: search.value,
              "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => search.value = $event),
              label: "搜索", "prepend-inner-icon": "search", variant: "outlined", "hide-details": "", "single-line": ""
            }),
            loading.value ? vue.createVNode(_component_v_progress_linear, { indeterminate: "", color: "primary", class: "mt-4" }) : null
          ]),
          default: vue.withCtx(() => [
            vue.createVNode(_component_v_data_table, {
              items: activitiesList.value, loading: loading.value, search: search.value, hover: "", headers, sticky: "", "items-per-page": "-1", "hide-default-footer": ""
            }, {
              "item.type": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_chip, {
                  color: 'teal',
                  size: 'small',
                  label: ''
                }, { default: () => [vue.createTextVNode(item.type || '活动')] })
              ]),
              "item.status": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_chip, {
                  color: item.ongoing ? 'orange' : 'grey',
                  size: 'small',
                  label: ''
                }, { default: () => [vue.createTextVNode(item.status)] })
              ]),
              "item.action": vue.withCtx(({ item }) => [
                vue.createVNode(_component_v_btn, {
                  variant: item.finished ? "plain" : "tonal", color: "primary", href: getCourseLink(item), target: "_blank"
                }, {
                  default: vue.withCtx(() => [vue.createTextVNode(item.finished ? "查看详情" : "前往完成")])
                }, 8, ["variant", "href"])
              ])
            }, 8, ["items", "loading", "search"])
          ])
        }, 8, ["subtitle"]);
      };
    }
  });

  // --- 数据提取辅助函数 ---
  const extractTextById = (html, id) => {
    const idPattern = new RegExp(`id=["']?${id}["']?[^>]*>([^<]*)`, 'i');
    const match = html.match(idPattern);
    return match ? match[1].trim() : '';
  };
  const extractNumberById = (html, id) => {
    const idText = extractTextById(html, id);
    if (idText) {
      const numeric = idText.match(/\d+(\.\d+)?/);
      return numeric ? numeric[0] : '';
    }
    const loosePattern = new RegExp(`${id}[^\\d]*(\\d+(?:\\.\\d+)?)`, 'i');
    const looseMatch = html.match(loosePattern);
    return looseMatch ? looseMatch[1] : '';
  };
  const extractPairNearLabel = (html, label) => {
    const pairPattern = new RegExp(`${label}[^\\d]{0,50}(\\d+)\\s*\\/\\s*(\\d+)`, 'i');
    const match = html.match(pairPattern);
    return match ? { first: match[1], second: match[2] } : null;
  };
  const extractNumberNearLabel = (html, label) => {
    const numberPattern = new RegExp(`${label}[^\\d]{0,50}(\\d+(?:\\.\\d+)?)`, 'i');
    const match = html.match(numberPattern);
    return match ? match[1] : '';
  };
  const getSiblingText = (element, selector) => {
    const parent = element?.closest('li') || element?.parentElement;
    if (!parent) return '';
    const target = parent.querySelector(selector);
    return target?.textContent.trim() || '';
  };
  const extractTaskPairFromDom = (doc) => {
    const label = Array.from(doc.querySelectorAll('p')).find((el) => el.textContent.includes('完成进度'));
    if (!label) return null;
    const text = getSiblingText(label, 'h2');
    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
    return match ? { first: match[1], second: match[2] } : null;
  };
  const extractDataFromDomByLabel = (doc, label) => {
    if (!doc) return null;
    const candidates = Array.from(doc.querySelectorAll('*')).filter(el =>
      el.children.length === 0 && el.textContent.includes(label)
    );

    for (const el of candidates) {
      let container = el.parentElement;
      let attempts = 3;
      while (container && attempts > 0) {
        const text = container.textContent.trim();
        const textAfterLabel = text.substring(text.indexOf(label) + label.length);
        const match = textAfterLabel.match(/[:：\s]*(\d+(?:\.\d+)?)/);
        if (match) return match[1];

        container = container.parentElement;
        attempts--;
      }
    }
    return null;
  };
  const extractRankFromDom = (doc) => {
    const candidates = Array.from(doc.querySelectorAll('*')).filter(el => {
      const text = el.textContent || '';
      return (text.includes('当前排名') || text.includes('班级排名') || text.includes('排名')) && el.children.length === 0;
    });

    for (const candidate of candidates) {
      let container = candidate.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const allText = container.textContent || '';
        const match = allText.match(/(?:第\s*)?(\d+)\s*名/);
        if (match && match[1]) {
          return match[1];
        }
        container = container.parentElement;
      }
    }

    const whiteBgContainers = doc.querySelectorAll('.whiteBg');
    for (const container of whiteBgContainers) {
      const text = container.textContent || '';
      if (text.includes('排名') || text.includes('名次')) {
        const match = text.match(/(?:第\s*)?(\d+)\s*名/);
        if (match && match[1]) {
          return match[1];
        }
        const numMatch = text.match(/(\d+)\s*名/);
        if (numMatch && numMatch[1]) {
          return numMatch[1];
        }
      }
    }

    const h2Elements = doc.querySelectorAll('h2, .stat-value, .count, .fr');
    for (const el of h2Elements) {
      const text = el.textContent.trim();
      if (text.match(/^\d+$/) && parseInt(text) < 10000) {
        return text;
      }
      const rankMatch = text.match(/(?:第\s*)?(\d+)\s*名/);
      if (rankMatch) {
        return rankMatch[1];
      }
    }

    const frElements = doc.querySelectorAll('.fr');
    for (const el of frElements) {
      const text = el.textContent.trim();
      if (text.match(/^\d+$/) && parseInt(text) < 10000) {
        return text;
      }
    }

    return '';
  };
  const extractPointFromDom = (doc) => {
    const candidates = Array.from(doc.querySelectorAll('*')).filter(el => {
      const text = el.textContent || '';
      return (text.includes('课程积分') || text.includes('积分')) && el.children.length === 0;
    });

    for (const candidate of candidates) {
      let container = candidate.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const allText = container.textContent || '';
        const match = allText.match(/[:：]\s*(\d+(?:\.\d+)?)/);
        if (match && match[1]) {
          return match[1];
        }
        const directMatch = allText.match(/(\d+(?:\.\d+)?)\s*(?:分|积分)/);
        if (directMatch && directMatch[1]) {
          return directMatch[1];
        }
        container = container.parentElement;
      }
    }

    const whiteBgContainers = doc.querySelectorAll('.whiteBg');
    for (const container of whiteBgContainers) {
      const text = container.textContent || '';
      if (text.includes('积分')) {
        const match = text.match(/(?:课程)?积分[:：\s]*(\d+(?:\.\d+)?)/);
        if (match && match[1]) {
          return match[1];
        }
        const numMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:分|积分)/);
        if (numMatch && numMatch[1]) {
          return numMatch[1];
        }
        const pureNumMatch = text.match(/积分[^\\d]*(\d+)/);
        if (pureNumMatch && pureNumMatch[1]) {
          return pureNumMatch[1];
        }
      }
    }

    const pointElements = doc.querySelectorAll('#point, .point, [class*="point"], [id*="point"]');
    for (const el of pointElements) {
      const text = el.textContent.trim();
      if (text.match(/^\d+(?:\.\d+)?$/)) {
        return text;
      }
    }

    const h2Elements = doc.querySelectorAll('h2, .stat-value, .fr');
    for (const el of h2Elements) {
      const text = el.textContent.trim();
      if (text.match(/^\d+(?:\.\d+)?$/) && parseFloat(text) <= 1000) {
        return text;
      }
    }

    return '';
  };
  const extractQuizPairFromDom = (doc) => {
    const candidates = Array.from(doc.querySelectorAll('*')).filter(el => {
      const text = el.textContent || '';
      return text.includes('章节测验') || text.includes('测验');
    });

    for (const candidate of candidates) {
      let container = candidate.parentElement;
      for (let i = 0; i < 5 && container; i++) {
        const allText = container.textContent || '';
        const match = allText.match(/(\d+)\s*\/\s*(\d+)/);
        if (match && match[1] && match[2]) {
          return { first: match[1], second: match[2] };
        }
        container = container.parentElement;
      }
    }

    const whiteBgContainers = doc.querySelectorAll('.whiteBg');
    for (const container of whiteBgContainers) {
      const text = container.textContent || '';
      if (text.includes('测验')) {
        const match = text.match(/章节测验[:：\s]*(\d+)\s*\/\s*(\d+)/);
        if (match && match[1] && match[2]) {
          return { first: match[1], second: match[2] };
        }
        const shortMatch = text.match(/测验[:：\s]*(\d+)\s*\/\s*(\d+)/);
        if (shortMatch && shortMatch[1] && shortMatch[2]) {
          return { first: shortMatch[1], second: shortMatch[2] };
        }
      }
    }

    const statsBars = doc.querySelectorAll('.statistics-bar-list li, .stat-item, [class*="statistic"], .whiteBg');
    for (const item of statsBars) {
      const text = item.textContent || '';
      const match = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (match && match[1] && match[2]) {
        return { first: match[1], second: match[2] };
      }
    }

    const allText = doc.body?.textContent || '';
    const quizMatch = allText.match(/章节测验[^\\n]{0,50}(\d+)\s*\/\s*(\d+)/i);
    if (quizMatch) {
      return { first: quizMatch[1], second: quizMatch[2] };
    }

    return null;
  };

  const _sfc_dashboard = /* @__PURE__ */ vue.defineComponent({
    __name: "dashboard",
    setup(__props) {
      const fetchUserName = async () => {
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl && userNameEl.textContent.trim()) {
          return userNameEl.textContent.trim();
        }
        const personalNameEl = document.querySelector('.personalName');
        if (personalNameEl && personalNameEl.textContent.trim()) {
          return personalNameEl.textContent.trim();
        }

        return new Promise((resolve) => {
          if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
              method: 'GET',
              url: 'https://i.chaoxing.com/base',
              timeout: 5000,
              onload: (response) => {
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(response.responseText, 'text/html');
                  const nameEl = doc.querySelector('.user-name') || doc.querySelector('.personalName');
                  if (nameEl && nameEl.textContent.trim()) {
                    resolve(nameEl.textContent.trim());
                  } else {
                    resolve('同学');
                  }
                } catch (e) {
                  resolve('同学');
                }
              },
              onerror: () => resolve('同学'),
              ontimeout: () => resolve('同学')
            });
          } else {
            resolve('同学');
          }
        });
      };

      const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 6) return '夜深了';
        if (hour < 12) return '早上好';
        if (hour < 14) return '中午好';
        if (hour < 18) return '下午好';
        return '晚上好';
      };

      const getFormattedDate = () => {
        const now = new Date();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 星期${weekdays[now.getDay()]}`;
      };

      const userName = vue.ref('同学'); // 先显示默认值
      const greeting = vue.ref(getGreeting());
      const dateInfo = vue.ref(getFormattedDate());

      // 异步获取用户名
      fetchUserName().then(name => {
        userName.value = name;
      });

      const loading = vue.ref({
        todo: true,
        homework: false,
        exam: false,
        activities: false
      });

      const todoItems = vue.ref([]);
      const homeworkItems = vue.ref([]);
      const examItems = vue.ref([]);
      const activitiesItems = vue.ref([]);
      const urgentTasks = vue.ref([]);

      // 课程进度数据
      const courseProgressItems = vue.ref([]);
      const loadingProgress = vue.ref(false);
      const activitiesLoaded = vue.ref(false);
      const activitiesFetched = vue.ref(false);
      const activitiesLoadFailed = vue.ref(false);
      const activitiesFromCache = vue.ref(false);
      const progressLoaded = vue.ref(false);
      const progressLoadFailed = vue.ref(false);
      const progressFromCache = vue.ref(false);
      const progressLastUpdate = vue.ref(null);

      // 从页面 DOM 中提取 enc 参数
      const extractEncFromDOM = (courses) => {
        console.log('[课程进度] 开始从DOM提取enc参数...');
        console.log('[课程进度] 页面URL:', window.location.href);
        console.log('[课程进度] 页面标题:', document.title);

        // 先尝试从 courseSquareUrl 中提取 classId (注意是 classId 不是 clazzId)
        let foundFromSquareUrl = 0;
        courses.forEach(course => {
          if (course.courseSquareUrl) {
            const classIdMatch = course.courseSquareUrl.match(/[?&]classId=(\d+)/);
            if (classIdMatch) {
              const classId = classIdMatch[1];
              console.log('[课程进度] 课程', course.courseName, 'courseSquareUrl中的classId:', classId);

              // 注意：courseSquareUrl 中的 classId 对应的是 channel.key (clazzId)
              // 如果匹配，我们可以尝试使用这个 classId
              if (String(course.clazzId) === classId) {
                console.log('[课程进度] 课程', course.courseName, 'clazzId匹配');
              }
            }
          }
        });

        // 查找课程卡片上的链接
        const selectors = [
          'a[href*="mycourse/studentcourse"]',
          'a[href*="course/course"]',
          'a[href*="mooc2-ans"]',
          '.course-item a',
          '.courseCard a',
          '[class*="course"] a',
          '#courseList a',
          '.course-list a'
        ];

        let foundEncCount = 0;

        // 先打印页面中所有的链接，查找包含关键参数的
        console.log('[课程进度] 开始扫描页面所有链接...');
        const allLinks = document.querySelectorAll('a[href]');
        console.log('[课程进度] 页面共有', allLinks.length, '个链接');

        let scannedCount = 0;
        allLinks.forEach(link => {
          const href = link.href;
          if (!href || scannedCount > 100) return; // 只扫描前100个链接

          if (href.includes('clazzid') || href.includes('enc') || href.includes('mycourse')) {
            scannedCount++;
            console.log('[课程进度] 链接示例:', href.substring(0, 150));

            // 从 URL 中提取 enc 参数
            const encMatch = href.match(/[?&]enc=([^&]+)/);
            const clazzIdMatch = href.match(/[?&]clazzid=(\d+)/);

            if (encMatch && clazzIdMatch) {
              const enc = encMatch[1];
              const clazzId = clazzIdMatch[1];

              // 查找对应的课程并更新 enc
              const course = courses.find(c => String(c.clazzId) === clazzId);
              if (course && !course.enc) {
                course.enc = enc;
                foundEncCount++;
                console.log('[课程进度] 找到enc:', course.courseName, 'clazzId:', clazzId, 'enc:', enc);
              }
            }
          }
        });

        if (foundEncCount === 0) {
          console.log('[课程进度] 未从链接中找到enc，尝试从courseSquareUrl提取...');

          // courseSquareUrl 格式: https://tsjy.chaoxing.com/plaza/app?courseId=xxx&personId=xxx&classId=xxx&userId=xxx
          // 这里只有 classId，没有 enc
          // enc 可能在其他地方
        }

        console.log('[课程进度] 共找到', foundEncCount, '个课程的enc参数');

        // 保存到 localStorage 供后续使用
        if (foundEncCount > 0) {
          const encMap = {};
          courses.forEach(c => {
            if (c.enc) {
              encMap[c.clazzId] = c.enc;
            }
          });
          localStorage.setItem('chaoxing_course_enc', JSON.stringify(encMap));
          console.log('[课程进度] enc参数已保存到localStorage');

          // 异步获取 pEnc
          setTimeout(() => {
            fetchPEncForCourses(courses);
          }, 200);
        } else {
          // 如果没找到enc，直接尝试获取pEnc（可能会失败，但至少尝试了）
          console.log('[课程进度] 未找到enc，但仍然尝试获取pEnc...');
          setTimeout(() => {
            fetchPEncForCourses(courses);
          }, 500);
        }
      };

      // 获取课程的 pEnc 参数
      const fetchPEncForCourses = (courses) => {
        if (typeof GM_xmlhttpRequest === 'undefined') {
          console.log('[课程进度] GM_xmlhttpRequest 不可用，跳过获取pEnc');
          return;
        }

        console.log('[课程进度] 开始获取课程的pEnc参数...');

        // 从 stat2-ans.chaoxing.com/study-data/index 页面获取 pEnc
        // URL格式: https://stat2-ans.chaoxing.com/study-data/index?courseid=xxx&clazzid=xxx&cpi=xxx&ut=s&t=xxx&stuenc=xxx
        const promises = courses.slice(0, 25).map(course => {
          return new Promise((resolve) => {
            // 使用课程数据构建 stat2-ans 页面 URL
            // stuenc 参数使用 enc（如果有的话），否则使用空字符串
            const stuenc = course.enc || '';
            const studyIndexUrl = `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s&t=${Date.now()}&stuenc=${stuenc}`;

            console.log('[课程进度] 获取pEnc, 课程:', course.courseName, 'URL:', studyIndexUrl);

            GM_xmlhttpRequest({
              method: 'GET',
              url: studyIndexUrl,
              timeout: 10000,
              headers: {
                'X-Requested-With': 'XMLHttpRequest',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              },
              onload: (response) => {
                console.log('[课程进度] 获取pEnc响应, 课程:', course.courseName, '状态:', response.status, '长度:', response.responseText.length);

                // 从响应中提取 pEnc
                // 尝试多种正则表达式格式
                const patterns = [
                  /pEnc["\s]*[:=]["\s]*([^"'&\s,}]+)/,  // pEnc: 'xxx' 或 pEnc: "xxx"
                  /var\s+pEnc\s*=\s*["']([^"']+)["']/,   // var pEnc = 'xxx'
                  /pEnc\s*=\s*["']([^"']+)["']/,        // pEnc='xxx'
                ];

                let pEnc = null;
                for (const pattern of patterns) {
                  const match = response.responseText.match(pattern);
                  if (match) {
                    pEnc = match[1].replace(/^["']|["']$/g, '');
                    console.log('[课程进度] 使用正则找到pEnc:', course.courseName, 'pEnc:', pEnc, 'pattern:', pattern.toString());
                    break;
                  }
                }

                if (pEnc) {
                  course.pEnc = pEnc;

                  // 保存到 localStorage
                  try {
                    const pEncMap = JSON.parse(localStorage.getItem('chaoxing_course_pEnc') || '{}');
                    pEncMap[course.clazzId] = pEnc;
                    localStorage.setItem('chaoxing_course_pEnc', JSON.stringify(pEncMap));
                    console.log('[课程进度] pEnc已保存到localStorage:', course.courseName, course.clazzId, pEnc);
                  } catch (e) {
                    console.error('[课程进度] 保存pEnc失败:', e);
                  }
                } else {
                  console.log('[课程进度] 未找到pEnc:', course.courseName, '响应长度:', response.responseText.length);
                  if (response.responseText.length > 100) {
                    console.log('[课程进度] 响应前200字符:', response.responseText.substring(0, 200));
                  }
                }

                // 同时尝试从响应中提取 enc（如果还没有的话）
                if (!course.enc && encMatch) {
                  course.enc = encMatch[1];
                  console.log('[课程进度] 从页面找到enc:', course.courseName, 'enc:', course.enc);

                  try {
                    const encMap = JSON.parse(localStorage.getItem('chaoxing_course_enc') || '{}');
                    encMap[course.clazzId] = course.enc;
                    localStorage.setItem('chaoxing_course_enc', JSON.stringify(encMap));
                  } catch (e) {
                    console.error('[课程进度] 保存enc失败:', e);
                  }
                }

                resolve();
              },
              onerror: () => {
                console.error('[课程进度] 获取pEnc失败:', course.courseName);
                resolve();
              }
            });
          });
        });

        Promise.all(promises).then(() => {
          console.log('[课程进度] pEnc获取完成');
        });
      };

      const getAllCourses = async () => {
        return new Promise((resolve) => {
          // 使用与课程任务相同的 API
          const courseListUrl = 'https://mooc1-api.chaoxing.com/mycourse/backclazzdata?view=json&mcode=';

          if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
              method: 'GET',
              url: courseListUrl,
              onload: (response) => {
                try {
                  console.log('[课程进度] 课程列表响应前200字符:', response.responseText.substring(0, 200));
                  const data = JSON.parse(response.responseText);
                  const courses = [];

                  if (data && data.channelList) {
                    console.log('[课程进度] channelList 长度:', data.channelList.length);
                    data.channelList.forEach(channel => {
                      // 调试：查看 channel 对象的 keys
                      console.log('[课程进度] Channel keys:', Object.keys(channel));
                      console.log('[课程进度] Channel cataid:', channel.cataid);
                      console.log('[课程进度] Channel content keys:', channel.content ? Object.keys(channel.content) : 'no content');
                      console.log('[课程进度] Channel content.enc:', channel.content ? channel.content.enc : 'no enc');

                      if (channel.cataid === '100000002' && channel.content && channel.content.course) {
                        const courseData = channel.content.course.data;
                        if (courseData && Array.isArray(courseData)) {
                          courseData.forEach(course => {
                            // 调试：查看课程对象的 keys
                            console.log('[课程进度] 课程 keys:', Object.keys(course));
                            console.log('[课程进度] 课程 enc:', course.enc || '无');
                            console.log('[课程进度] 课程 courseSquareUrl:', course.courseSquareUrl || '无');

                            courses.push({
                              courseId: course.id,
                              clazzId: channel.key,
                              cpi: channel.cpi,
                              courseName: course.name,
                              teacherName: course.teacherfactor || '',
                              // 尝试从 channel.content 中获取 enc 字段
                              enc: channel.content.enc || course.enc || '',
                              pEnc: channel.content.pEnc || course.pEnc || ''
                            });
                          });
                        }
                      }
                    });
                  }

                  // 同一课程可能在课程列表接口中重复返回，按课程与班级组合键去重，
                  // 避免重复卡片和重复的课程进度请求。
                  const uniqueCourseMap = new Map();
                  courses.forEach(course => {
                    const key = `${course.courseId}_${course.clazzId}`;
                    const existing = uniqueCourseMap.get(key);
                    uniqueCourseMap.set(key, existing ? {
                      ...existing,
                      ...course,
                      enc: existing.enc || course.enc || '',
                      pEnc: existing.pEnc || course.pEnc || ''
                    } : course);
                  });
                  const uniqueCourses = Array.from(uniqueCourseMap.values());
                  console.log('[课程进度] 解析到课程:', courses.length, '个，去重后:', uniqueCourses.length, '个');

                  // 从页面 DOM 中提取 enc 参数
                  setTimeout(() => {
                    extractEncFromDOM(uniqueCourses);
                  }, 100);

                  resolve(uniqueCourses);
                } catch (e) {
                  console.error('[课程进度] 解析课程列表失败:', e);
                  resolve([]);
                }
              },
              onerror: (err) => {
                console.error('[课程进度] 请求课程列表失败:', err);
                resolve([]);
              }
            });
          } else {
            resolve([]);
          }
        });
      };

      // 从学习任务页面HTML中提取AI实践和分组任务数据
      const extractTaskDataFromHTML = (html, courseName) => {
        const result = {
          aiPractice: '--',
          groupTask: '--',
          chapterQuiz: '--',
          onlineExam: '--',
          courseWork: '--',
          interactiveQuiz: '--'
        };

        try {
          // 提取章节测验
          const testNumMatch = html.match(/id="testNum"[^>]*>(\d+)</);
          const publishTestNumMatch = html.match(/id="publishTestNum"[^>]*>(\d+)</);
          if (testNumMatch && publishTestNumMatch) {
            result.chapterQuiz = `${testNumMatch[1]}/${publishTestNumMatch[1]}`;
          }

          // 提取课程作业
          const workNumMatch = html.match(/id="workNum"[^>]*>(\d+)</);
          const publishWorkNumMatch = html.match(/id="publishWorkNum"[^>]*>(\d+)</);
          if (workNumMatch && publishWorkNumMatch) {
            result.courseWork = `${workNumMatch[1]}/${publishWorkNumMatch[1]}`;
          }

          // 提取AI实践
          const aiEvaluateReachCountMatch = html.match(/id="aiEvaluateReachCount"[^>]*>(\d+)</);
          const publishLibraryNumMatch = html.match(/id="publishLibraryNum"[^>]*>(\d+)</);
          if (aiEvaluateReachCountMatch && publishLibraryNumMatch) {
            result.aiPractice = `${aiEvaluateReachCountMatch[1]}/${publishLibraryNumMatch[1]}`;
          }

          // 提取互动测验
          const videoTestFinishMatch = html.match(/id="videoTestFinish"[^>]*>(\d+)</);
          const videoTestCountMatch = html.match(/id="videoTestCount"[^>]*>(\d+)</);
          if (videoTestFinishMatch && videoTestCountMatch) {
            result.interactiveQuiz = `${videoTestFinishMatch[1]}/${videoTestCountMatch[1]}`;
          }

          // 提取分组任务
          const taskNumMatch = html.match(/id="taskNum"[^>]*>(\d+)</);
          const publishTaskNumMatch = html.match(/id="publishTaskNum"[^>]*>(\d+)</);
          if (taskNumMatch && publishTaskNumMatch) {
            result.groupTask = `${taskNumMatch[1]}/${publishTaskNumMatch[1]}`;
          }

          // 提取在线考试 (没有特定ID，尝试从span中提取)
          const examMatch = html.match(/在线考试[\s\S]*?<span class="right-rate">(\d+)\/(\d+)<\/span>/);
          if (examMatch) {
            result.onlineExam = `${examMatch[1]}/${examMatch[2]}`;
          }

          console.log('[API学习记录]', courseName, '从学习任务页面提取的数据:', result);
        } catch (e) {
          console.error('[API学习记录]', courseName, '提取学习任务数据失败:', e);
        }

        return result;
      };

      // 获取课程进度 - 从学习记录页面抓取任务点和排名等信息
      const getCourseProgress = async (course) => {
        const courseEntryUrl = `https://mooc1.chaoxing.com/visit/stucoursemiddle?ismooc2=1&courseid=${course.courseId}&clazzid=${course.clazzId}&pageHeader=6`;

        // 尝试从 localStorage 获取 enc 参数
        let enc = course.enc;
        if (!enc) {
          try {
            const encMap = JSON.parse(localStorage.getItem('chaoxing_course_enc') || '{}');
            enc = encMap[course.clazzId] || '';
            console.log('[API学习记录]', course.courseName, '从localStorage获取enc:', enc || '无');
          } catch (e) {
            console.error('[API学习记录] 读取localStorage失败:', e);
          }
        }

        // 尝试从 localStorage 获取 pEnc 参数
        let pEnc = course.pEnc;
        if (!pEnc) {
          try {
            const pEncMap = JSON.parse(localStorage.getItem('chaoxing_course_pEnc') || '{}');
            pEnc = (pEncMap[course.clazzId] || '').replace(/^["']|["']$/g, ''); // 去除可能的引号
            console.log('[API学习记录]', course.courseName, '从localStorage获取pEnc:', pEnc || '无');
          } catch (e) {
            console.error('[API学习记录] 读取pEnc失败:', e);
          }
        }

        console.log('[API学习记录]', course.courseName, '开始获取学习数据');
        console.log('[API学习记录]', course.courseName, '课程信息:', {
          courseId: course.courseId,
          clazzId: course.clazzId,
          cpi: course.cpi,
          enc: enc,
          pEnc: pEnc
        });

        return new Promise((resolve) => {
          if (typeof GM_xmlhttpRequest === 'undefined') {
            resolve({
              ...course,
              totalTasks: 0,
              completedTasks: 0,
              completionRate: '点击查看',
              unfinishedTasks: [],
              unfinishedCount: 0,
              studyDataUrl: courseEntryUrl,
              isComplete: false,
              shouldFilter: false,
              courseScore: '--',
              chapterQuiz: '--',
              ranking: '--',
              aiPractice: '--',
              groupTask: '--'
            });
            return;
          }

          // 使用已获取的 pEnc
          if (!pEnc) {
            pEnc = course.enc || 'stuenc_' + course.clazzId;
          }
          console.log('[API学习记录]', course.courseName, '使用的 pEnc:', pEnc);

          const baseParams = `clazzid=${course.clazzId}&courseid=${course.courseId}&cpi=${course.cpi}&ut=s&pEnc=${pEnc}`;
          const jobUrl = `https://stat2-ans.chaoxing.com/stat2/study-data/job?${baseParams}`;
          const pointUrl = 'https://stat2-ans.chaoxing.com/stat2/study-data/point';
          const studyDataIndexUrl = `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s`;

          console.log('[API学习记录]', course.courseName, 'job API URL:', jobUrl);
          console.log('[API学习记录]', course.courseName, 'baseParams:', baseParams);
          console.log('[API学习记录]', course.courseName, 'studyDataIndexUrl:', studyDataIndexUrl);

          let completedTasks = 0;
          let totalTasks = 0;
          let completionRate = '点击查看';
          let shouldFilter = false;
          let courseScore = '--';
          let chapterQuiz = '--';
          let ranking = '--';
          let aiPractice = '--';
          let groupTask = '--';

          const finishResolve = () => {
            const unfinishedCount = Math.max(totalTasks - completedTasks, 0);
            resolve({
              ...course,
              totalTasks,
              completedTasks,
              completionRate,
              unfinishedTasks: [],
              unfinishedCount,
              studyDataUrl: courseEntryUrl,
              isComplete: totalTasks > 0 && completedTasks >= totalTasks,
              shouldFilter,
              courseScore,
              chapterQuiz,
              ranking,
              aiPractice,
              groupTask
            });
          };

          let successCount = 0;
          const checkAllDone = () => {
            successCount++;
            if (successCount >= 5) {
              console.log('[API学习记录]', course.courseName,
                '任务点:', `${completedTasks}/${totalTasks}`,
                '排名:', ranking,
                '积分:', courseScore,
                '章节测验:', chapterQuiz,
                'AI实践:', aiPractice,
                '分组任务:', groupTask);
              finishResolve();
            }
          };

          const handleError = (errorMsg) => {
            console.error('[API学习记录]', course.courseName, errorMsg);
            resolve({
              ...course,
              totalTasks: 0,
              completedTasks: 0,
              completionRate: '点击查看',
              unfinishedTasks: [],
              unfinishedCount: 0,
              studyDataUrl: courseEntryUrl,
              isComplete: false,
              shouldFilter: false,
              courseScore: '--',
              chapterQuiz: '--',
              ranking: '--',
              aiPractice: '--',
              groupTask: '--'
            });
          };

          GM_xmlhttpRequest({
            method: 'GET',
            url: jobUrl,
            timeout: 10000,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s`
            },
            onload: (response) => {
              console.log('[API学习记录]', course.courseName, 'job API响应状态:', response.status);
              console.log('[API学习记录]', course.courseName, 'job API响应内容前200字符:', response.responseText.substring(0, 200));

              try {
                const data = JSON.parse(response.responseText);
                if (data.status && data.data) {
                  const jobData = data.data;
                  ranking = jobData.jobRank ? `第${jobData.jobRank}名` : '--';
                  chapterQuiz = jobData.job ? `${jobData.job}/${jobData.publishJobNum || jobData.job}` : '--';
                  totalTasks = jobData.publishJobNum || jobData.job || 0;
                  completedTasks = jobData.job || 0;
                  completionRate = jobData.jobPer ? `${jobData.jobPer}%` : '0%';

                  // AI实践
                  const aiEvaluateReachCount = jobData.aiEvaluateReachCount !== undefined ? jobData.aiEvaluateReachCount : '--';
                  const publishLibraryNum = jobData.publishLibraryNum !== undefined ? jobData.publishLibraryNum : '--';
                  aiPractice = (aiEvaluateReachCount !== '--' && publishLibraryNum !== '--')
                    ? `${aiEvaluateReachCount}/${publishLibraryNum}`
                    : '--';

                  // 分组任务
                  const taskNum = jobData.taskNum !== undefined ? jobData.taskNum : '--';
                  const publishTaskNum = jobData.publishTaskNum !== undefined ? jobData.publishTaskNum : '--';
                  groupTask = (taskNum !== '--' && publishTaskNum !== '--')
                    ? `${taskNum}/${publishTaskNum}`
                    : '--';

                  console.log('[API学习记录]', course.courseName,
                    '排名:', ranking,
                    '章节测验:', chapterQuiz,
                    'AI实践:', aiPractice,
                    '分组任务:', groupTask,
                    'jobData:', JSON.stringify(jobData).substring(0, 500));
                } else {
                  console.log('[API学习记录]', course.courseName, 'job API返回数据无效:', data);
                }
              } catch (e) {
                console.error('[API学习记录]', course.courseName, 'job API解析失败:', e);
              }

              checkAllDone();
            },
            onerror: () => {
              console.error('[API学习记录]', course.courseName, 'job API请求失败');
              checkAllDone();
            },
            ontimeout: () => {
              console.error('[API学习记录]', course.courseName, 'job API请求超时');
              checkAllDone();
            }
          });

          GM_xmlhttpRequest({
            method: 'POST',
            url: pointUrl,
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s`
            },
            data: baseParams,
            timeout: 10000,
            onload: (response) => {
              console.log('[API学习记录]', course.courseName, 'point API响应状态:', response.status);
              console.log('[API学习记录]', course.courseName, 'point API响应内容:', response.responseText);

              try {
                const data = JSON.parse(response.responseText);
                console.log('[API学习记录]', course.courseName, 'point API响应数据:', data);
                if (data.ponits !== undefined) {
                  courseScore = `${data.ponits}分`;
                  console.log('[API学习记录]', course.courseName, '积分:', courseScore);
                } else {
                  console.log('[API学习记录]', course.courseName, 'point API无有效数据');
                }
              } catch (e) {
                console.error('[API学习记录]', course.courseName, 'point API解析失败:', e);
              }

              checkAllDone();
            },
            onerror: () => {
              console.error('[API学习记录]', course.courseName, 'point API请求失败');
              checkAllDone();
            },
            ontimeout: () => {
              console.error('[API学习记录]', course.courseName, 'point API请求超时');
              checkAllDone();
            }
          });

          // AI实践API
          const aiEvaluateUrl = `https://stat2-ans.chaoxing.com/stat2/study-data/ai-evaluate-stat?${baseParams}`;
          console.log('[API学习记录]', course.courseName, '请求AI实践API:', aiEvaluateUrl);

          GM_xmlhttpRequest({
            method: 'GET',
            url: aiEvaluateUrl,
            timeout: 10000,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s`
            },
            onload: (response) => {
              console.log('[API学习记录]', course.courseName, 'AI实践API响应状态:', response.status);

              try {
                const data = JSON.parse(response.responseText);
                if (data.status && data.data) {
                  const aiData = data.data;
                  const aiEvaluateReachCount = aiData.aiEvaluateReachCount !== undefined ? aiData.aiEvaluateReachCount : '--';
                  const publishLibraryNum = aiData.publishLibraryNum !== undefined ? aiData.publishLibraryNum : '--';
                  aiPractice = (aiEvaluateReachCount !== '--' && publishLibraryNum !== '--')
                    ? `${aiEvaluateReachCount}/${publishLibraryNum}`
                    : '--';
                  console.log('[API学习记录]', course.courseName, 'AI实践数据:', aiPractice);
                } else {
                  console.log('[API学习记录]', course.courseName, 'AI实践API返回数据无效:', data);
                }
              } catch (e) {
                console.error('[API学习记录]', course.courseName, 'AI实践API解析失败:', e);
              }

              checkAllDone();
            },
            onerror: (err) => {
              console.error('[API学习记录]', course.courseName, 'AI实践API请求失败:', err);
              checkAllDone();
            },
            ontimeout: () => {
              console.error('[API学习记录]', course.courseName, 'AI实践API请求超时');
              checkAllDone();
            }
          });

          // 分组任务API
          const groupTaskUrl = `https://stat2-ans.chaoxing.com/stat2/study-data/groupTask?${baseParams}`;
          console.log('[API学习记录]', course.courseName, '请求分组任务API:', groupTaskUrl);

          GM_xmlhttpRequest({
            method: 'GET',
            url: groupTaskUrl,
            timeout: 10000,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': `https://stat2-ans.chaoxing.com/study-data/index?courseid=${course.courseId}&clazzid=${course.clazzId}&cpi=${course.cpi}&ut=s`
            },
            onload: (response) => {
              console.log('[API学习记录]', course.courseName, '分组任务API响应状态:', response.status);

              try {
                const data = JSON.parse(response.responseText);
                if (data.status && data.data) {
                  const taskData = data.data;
                  const taskNum = taskData.taskNum !== undefined ? taskData.taskNum : '--';
                  const publishTaskNum = taskData.publishTaskNum !== undefined ? taskData.publishTaskNum : '--';
                  groupTask = (taskNum !== '--' && publishTaskNum !== '--')
                    ? `${taskNum}/${publishTaskNum}`
                    : '--';
                  console.log('[API学习记录]', course.courseName, '分组任务数据:', groupTask);
                } else {
                  console.log('[API学习记录]', course.courseName, '分组任务API返回数据无效:', data);
                }
              } catch (e) {
                console.error('[API学习记录]', course.courseName, '分组任务API解析失败:', e);
              }

              checkAllDone();
            },
            onerror: (err) => {
              console.error('[API学习记录]', course.courseName, '分组任务API请求失败:', err);
              checkAllDone();
            },
            ontimeout: () => {
              console.error('[API学习记录]', course.courseName, '分组任务API请求超时');
              checkAllDone();
            }
          });

          // 请求学习任务页面，获取AI实践和分组任务数据
          const taskPageUrl = `https://mooc1.chaoxing.com/visit/stucoursemiddle?ismooc2=1&courseid=${course.courseId}&clazzid=${course.clazzId}&pageHeader=6`;
          console.log('[API学习记录]', course.courseName, '请求学习任务页面:', taskPageUrl);

          GM_xmlhttpRequest({
            method: 'GET',
            url: taskPageUrl,
            timeout: 15000,
            headers: {
              'X-Requested-With': 'XMLHttpRequest',
              'Referer': 'https://mooc1.chaoxing.com/'
            },
            onload: (response) => {
              console.log('[API学习记录]', course.courseName, '学习任务页面响应状态:', response.status);

              try {
                const html = response.responseText;
                const taskData = extractTaskDataFromHTML(html, course.courseName);

                // 如果从job API没有获取到数据，使用从HTML提取的数据
                if (aiPractice === '--' && taskData.aiPractice !== '--') {
                  aiPractice = taskData.aiPractice;
                  console.log('[API学习记录]', course.courseName, '使用HTML数据更新AI实践:', aiPractice);
                }

                if (groupTask === '--' && taskData.groupTask !== '--') {
                  groupTask = taskData.groupTask;
                  console.log('[API学习记录]', course.courseName, '使用HTML数据更新分组任务:', groupTask);
                }

                // 同时更新章节测验数据（如果API没有返回）
                if (chapterQuiz === '--' && taskData.chapterQuiz !== '--') {
                  chapterQuiz = taskData.chapterQuiz;
                }

                console.log('[API学习记录]', course.courseName, '学习任务页面数据提取完成:', taskData);
              } catch (e) {
                console.error('[API学习记录]', course.courseName, '解析学习任务页面失败:', e);
              }

              checkAllDone();
            },
            onerror: (err) => {
              console.error('[API学习记录]', course.courseName, '请求学习任务页面失败:', err);
              checkAllDone();
            },
            ontimeout: () => {
              console.error('[API学习记录]', course.courseName, '请求学习任务页面超时');
              checkAllDone();
            }
          });
        });
      };

      const syncActivitiesToTodo = (allActivities) => {
        const ongoingActivities = allActivities
          .filter(activity => activity.ongoing)
          .map(activity => ({
            type: activity.type, title: activity.title, course: activity.courseName,
            info: activity.endTime || (activity.progressText ? `进度 ${activity.progressText}` : '进行中'),
            leftTime: activity.endTime || activity.leftTime || '',
            timeLeft: activity.endTime || activity.timeLeft || '',
            endTime: activity.endTime || '',
            status: '进行中',
            courseId: activity.courseId, clazzId: activity.clazzId,
            activeId: activity.activeId, taskId: activity.taskId, planId: activity.planId,
            taskEngine: activity.taskEngine, taskEnginePlan: activity.taskEnginePlan,
            taskLink: activity.taskLink, isActivity: true,
            finished: activity.finished, expired: activity.expired,
            ongoing: activity.ongoing, uncommitted: activity.uncommitted
          }))
          .map(item => ({ ...item, isUrgent: isTodoItemUrgent(item) }));
        todoItems.value = [...todoItems.value.filter(item => !item.isActivity), ...ongoingActivities];
        urgentTasks.value = todoItems.value.filter(isTodoItemUrgent);
      };

      const hydrateShortTermCache = () => {
        if (!settings.value.shortTermCacheEnabled) return;
        const cache = cleanupDashboardCache();
        if (Array.isArray(cache.activities?.data)) {
          activitiesItems.value = cache.activities.data;
          activitiesLoaded.value = true;
          activitiesFromCache.value = true;
          syncActivitiesToTodo(cache.activities.data);
        }
        if (Array.isArray(cache.progress?.data)) {
          courseProgressItems.value = cache.progress.data;
          progressLoaded.value = true;
          progressFromCache.value = true;
          progressLastUpdate.value = new Date(cache.progress.savedAt).toLocaleTimeString();
        }
      };

      // 加载所有课程进度（带延迟机制）
      const loadAllCourseProgress = async () => {
        if (loadingProgress.value) return;
        if (!isProgressEnabled()) {
          console.log('[课程进度] 查询功能已关闭，跳过加载');
          courseProgressItems.value = [];
          progressLoaded.value = true;
          progressLoadFailed.value = false;
          return;
        }

        console.log('[课程进度] 开始加载课程进度...');
        loadingProgress.value = true;
        progressLoadFailed.value = false;
        try {
          const courses = await getAllCourses();
          const activeCourses = courses.filter(course => !isCourseIgnored(course));
          console.log(`[课程进度] 获取到课程: ${courses.length} 个，已忽略: ${courses.length - activeCourses.length} 个，待查询: ${activeCourses.length} 个`);
          if (activeCourses.length > 0) {
            const requestDelay = getProgressDelay();
            console.log('[课程进度] 使用请求延迟:', requestDelay, 'ms');

            // 使用延迟机制逐个请求，避免触发验证码
            const results = [];
            for (let i = 0; i < activeCourses.length; i++) {
              const course = activeCourses[i];
              // 运行中若刚被忽略，则跳过尚未发出的进度 API 请求。
              if (isCourseIgnored(course)) {
                console.log(`[课程进度] 跳过已忽略课程: ${course.courseName}`);
                continue;
              }
              console.log(`[课程进度] 正在获取第 ${i + 1}/${activeCourses.length} 个课程...`);
              const result = await getCourseProgress(course);
              results.push(result);

              // 如果不是最后一个课程，等待延迟时间
              if (i < activeCourses.length - 1) {
                await delay(requestDelay);
              }
            }

            // 过滤后按完成率从低到高排列；没有有效完成率的课程放在末尾。
            courseProgressItems.value = results
              .filter(item => !item.shouldFilter) // 过滤掉标记为需要过滤的课程
              .sort(compareCourseProgress);
            progressLastUpdate.value = new Date().toLocaleTimeString();
          } else {
            courseProgressItems.value = [];
            progressLastUpdate.value = new Date().toLocaleTimeString();
          }
          progressLoaded.value = true;
          progressFromCache.value = false;
          if (settings.value.shortTermCacheEnabled) saveDashboardCache('progress', courseProgressItems.value);
          startProgressAutoRefresh();
        } catch (e) {
          console.error('加载课程进度失败:', e);
          progressLoadFailed.value = true;
          progressLoaded.value = true;
        }
        loadingProgress.value = false;
      };

      // 自动刷新课程进度（每1小时）
      let progressRefreshTimer = null;
      const startProgressAutoRefresh = () => {
        if (progressRefreshTimer) clearInterval(progressRefreshTimer);
        progressRefreshTimer = setInterval(() => {
          loadAllCourseProgress();
        }, 60 * 60 * 1000); // 1小时
      };

      // 当前视图状态：'dashboard' | 'todo' | 'homework' | 'exam' | 'activities' | 'progress'
      const currentView = vue.ref('dashboard');
      let dashboardSkeletonTimer = null;
      const dashboardSkeletonOverlay = vue.ref(false);
      const dashboardSkeletonFading = vue.ref(false);
      const settings = vue.ref(getSettings());
      const settingsVersion = vue.ref(0);
      const progressDelay = vue.ref(getProgressDelay());
      const settingsCourses = vue.ref([]);
      const settingsCoursesLoading = vue.ref(false);
      const showCourseIgnoreDialog = vue.ref(false);
      const showOtherTasksDialog = vue.ref(false);
      const showBulkIgnoreDialog = vue.ref(false);
      const bulkIgnoreSelection = vue.ref(new Set());
      const bulkIgnoreOptions = [
        { key: 'homework', label: '已完成作业（含 AI 实践）' },
        { key: 'exam', label: '已完成或已过期考试' },
        { key: 'activities', label: '已结束课程任务' },
        { key: 'progress', label: '已完成课程进度' }
      ];
      const settingsToast = vue.ref('');
      let settingsToastTimer = null;

      const notifySettingsSaved = (message = '设置已保存，已实时应用') => {
        settingsToast.value = message;
        if (settingsToastTimer) clearTimeout(settingsToastTimer);
        settingsToastTimer = setTimeout(() => { settingsToast.value = ''; }, 2600);
      };

      const updateSetting = (key, value) => {
        settings.value = { ...settings.value, [key]: value };
        saveSettings(settings.value);
        settingsVersion.value++;
      };
      const updateProgressDelay = (value) => {
        progressDelay.value = setProgressDelay(value);
        notifySettingsSaved(`课程进度请求间隔已设为 ${progressDelay.value}ms，下次查询生效`);
      };
      const shouldDisplayItem = (item) => {
        settingsVersion.value;
        const section = item._sectionType || 'unknown';
        return !isItemIgnored(item, section)
          && !isDynamicallyIgnored(item, section, settings.value)
          && isOtherTaskVisible(item, settings.value);
      };
      const loadSettingsCourses = async () => {
        if (settingsCoursesLoading.value || settingsCourses.value.length) return;
        settingsCoursesLoading.value = true;
        try { settingsCourses.value = await fetchCourseList(); }
        catch (error) { console.error('[设置] 获取课程列表失败', error); }
        finally { settingsCoursesLoading.value = false; }
      };
      const openSettings = async () => {
        currentView.value = 'settings';
      };
      const openCourseIgnoreDialog = async () => {
        showCourseIgnoreDialog.value = true;
        await loadSettingsCourses();
      };
      const openCourseIgnoreFromHint = () => {
        updateSetting('courseIgnoreHintSeen', true);
        currentView.value = 'settings';
        openCourseIgnoreDialog();
      };
      const toggleOtherTaskType = (type, checked) => {
        const selected = new Set(settings.value.otherTaskTypes || []);
        if (checked) selected.add(type); else selected.delete(type);
        updateSetting('otherTaskTypes', Array.from(selected));
      };
      const getOtherTasksSummary = () => {
        if (settings.value.showOtherTasks) return '显示全部其他任务';
        const selected = settings.value.otherTaskTypes || [];
        return selected.length ? `已选 ${selected.length} 类` : '默认不显示';
      };
      const toggleCourseIgnored = (course, checked) => {
        if (checked) ignoreCourse(course); else unignoreCourse(course);
        ignoredVersion.value++;
      };
      const toggleBulkIgnoreType = (key, checked) => {
        const selected = new Set(bulkIgnoreSelection.value);
        if (checked) selected.add(key); else selected.delete(key);
        bulkIgnoreSelection.value = selected;
      };
      const openBulkIgnoreDialog = () => {
        const rules = settings.value.dynamicIgnoreRules || {};
        bulkIgnoreSelection.value = new Set(bulkIgnoreOptions
          .filter(option => rules[option.key])
          .map(option => option.key));
        showBulkIgnoreDialog.value = true;
      };
      const getCompletedItemsForBulkIgnore = (section) => {
        switch (section) {
          case 'homework':
            return [...homeworkItems.value, ...activitiesItems.value.filter(isRoutedToHomework)]
              .filter(isExplicitlyCompletedHomework);
          case 'exam': return [...examItems.value, ...activitiesItems.value.filter(isRoutedToExam)]
            .filter(isExplicitlyClosedExam);
          case 'activities': return activitiesItems.value
            .filter(item => !isRoutedToHomework(item) && !isRoutedToExam(item) && isExplicitlyEndedActivity(item));
          case 'progress': return courseProgressItems.value.filter(isExplicitlyCompletedProgress);
          default: return [];
        }
      };
      const getBulkIgnorePreviewItems = () => {
        const sectionLabels = { homework: '作业', exam: '考试', activities: '课程任务', progress: '课程进度' };
        const seen = new Set();
        const preview = [];
        bulkIgnoreSelection.value.forEach(section => {
          getCompletedItemsForBulkIgnore(section).forEach(item => {
            const key = `${section}__${item.courseId || ''}__${item.clazzId || item.classId || ''}__${item.workId || item.examId || item.id || item.title || item.courseName || ''}`;
            if (seen.has(key)) return;
            seen.add(key);
            preview.push({ item, section, label: sectionLabels[section] });
          });
        });
        return preview;
      };
      const runBulkIgnore = () => {
        const selected = bulkIgnoreSelection.value;
        const dynamicIgnoreRules = Object.fromEntries(bulkIgnoreOptions
          .map(option => [option.key, selected.has(option.key)]));
        updateSetting('dynamicIgnoreRules', dynamicIgnoreRules);
        showBulkIgnoreDialog.value = false;
        bulkIgnoreSelection.value = new Set();
        notifySettingsSaved('动态忽略规则已保存，列表已实时更新');
      };

      // --- 忽略功能状态 ---
      const ignoredVersion = vue.ref(0); // 递增触发响应式更新
      const showIgnoreConfirm = vue.ref(false); // 显示确认弹窗
      const ignoreConfirmItems = vue.ref([]); // 待确认忽略的项
      const ignoreConfirmSection = vue.ref('unknown'); // 待确认忽略的板块类型

      const selectMode = vue.ref(false); // 多选模式
      const selectedForIgnore = vue.ref(new Set()); // 多选忽略的 key 集合
      const selectedItemsMap = vue.ref(new Map()); // key -> item 映射

      const showIgnoredPanel = vue.ref(false); // 显示已忽略面板
      const selectedForRestore = vue.ref(new Set()); // 多选恢复的 key 集合

      // 执行忽略（弹出确认）- 需要传入 sectionType
      const requestIgnore = (items, sectionType) => {
        ignoreConfirmItems.value = Array.isArray(items) ? items : [items];
        ignoreConfirmSection.value = sectionType || 'unknown';
        showIgnoreConfirm.value = true;
      };

      // 确认忽略
      const confirmIgnore = () => {
        ignoreItems(ignoreConfirmItems.value, ignoreConfirmSection.value);
        ignoredVersion.value++;
        showIgnoreConfirm.value = false;
        ignoreConfirmItems.value = [];
        ignoreConfirmSection.value = 'unknown';
        // 退出多选模式
        selectMode.value = false;
        selectedForIgnore.value = new Set();
        selectedItemsMap.value = new Map();
      };

      // 取消忽略
      const cancelIgnore = () => {
        showIgnoreConfirm.value = false;
        ignoreConfirmItems.value = [];
        ignoreConfirmSection.value = 'unknown';
      };

      // 切换多选
      const toggleSelectMode = () => {
        selectMode.value = !selectMode.value;
        if (!selectMode.value) {
          selectedForIgnore.value = new Set();
          selectedItemsMap.value = new Map();
        }
      };

      // 多选操作（传入 sectionType 使 key 包含板块前缀）
      const toggleSelectItem = (item, sectionType) => {
        const key = getItemKey(item, sectionType);
        const newSet = new Set(selectedForIgnore.value);
        const newMap = new Map(selectedItemsMap.value);
        if (newSet.has(key)) {
          newSet.delete(key);
          newMap.delete(key);
        } else {
          newSet.add(key);
          newMap.set(key, item);
        }
        selectedForIgnore.value = newSet;
        selectedItemsMap.value = newMap;
      };

      // 批量忽略所选
      const batchIgnoreSelected = () => {
        const items = Array.from(selectedItemsMap.value.values());
        if (items.length > 0) {
          requestIgnore(items, ignoreConfirmSection.value || currentView.value);
        }
      };

      // 恢复忽略（多选）
      const toggleRestoreItem = (key) => {
        const newSet = new Set(selectedForRestore.value);
        if (newSet.has(key)) {
          newSet.delete(key);
        } else {
          newSet.add(key);
        }
        selectedForRestore.value = newSet;
      };

      const batchRestore = () => {
        unignoreByKeys(Array.from(selectedForRestore.value));
        selectedForRestore.value = new Set();
        ignoredVersion.value++;
      };

      const restoreSingle = (key) => {
        unignoreByKey(key);
        ignoredVersion.value++;
      };

      // 过滤已忽略项的计算属性（传入对应板块的 sectionType）
      const filteredTodoItems = vue.computed(() => {
        ignoredVersion.value; // 触发依赖
        return todoItems.value.filter(item => shouldDisplayItem({ ...item, _sectionType: 'todo' }));
      });
      const isRoutedToHomework = (item) => item.type === 'AI实践'
        || (item.taskEnginePlan && item.type === '作业');
      const isRoutedToExam = (item) => item.taskEnginePlan && item.type === '考试';
      const filteredHomeworkItems = vue.computed(() => {
        ignoredVersion.value;
        const routedItems = activitiesItems.value.filter(isRoutedToHomework);
        return [...homeworkItems.value, ...routedItems]
          .filter(item => shouldDisplayItem({ ...item, _sectionType: 'homework' }));
      });
      const filteredExamItems = vue.computed(() => {
        ignoredVersion.value;
        const routedItems = activitiesItems.value.filter(isRoutedToExam);
        return [...examItems.value, ...routedItems]
          .filter(item => shouldDisplayItem({ ...item, _sectionType: 'exam' }));
      });
      const filteredActivitiesItems = vue.computed(() => {
        ignoredVersion.value;
        return activitiesItems.value
          .filter(item => !isRoutedToHomework(item) && !isRoutedToExam(item))
          .filter(item => shouldDisplayItem({ ...item, _sectionType: 'activities' }));
      });
      const filteredCourseProgressItems = vue.computed(() => {
        ignoredVersion.value;
        return courseProgressItems.value.filter(item => shouldDisplayItem({ ...item, _sectionType: 'progress' }));
      });
      const filteredUrgentTasks = vue.computed(() => {
        ignoredVersion.value;
        return urgentTasks.value.filter(item => shouldDisplayItem({ ...item, _sectionType: 'todo' }));
      });

      // 各板块已忽略数量
      const getSectionIgnoredCount = (sectionType) => {
        ignoredVersion.value;
        return getIgnoredItemsBySection(sectionType).length;
      };

      // 课程进度板块的已忽略面板状态
      const showProgressIgnoredPanel = vue.ref(false);
      const progressIgnoredForRestore = vue.ref(new Set());

      // 悬浮窗活动数据缓存
      const courseActivitiesCache = vue.ref({}); // { courseId_clazzId: { activities: [], loading: boolean, fetched: boolean } }
      const hoveredCourseKey = vue.ref(null); // 当前悬停的课程标识

      const getCourseActivitiesKey = (course) => `${course.courseId}_${course.clazzId}`;

      const fetchCourseActivitiesOnHover = async (course) => {
        const cacheKey = getCourseActivitiesKey(course);

        // 如果已经获取过，直接返回缓存数据
        if (courseActivitiesCache.value[cacheKey]?.fetched) {
          return courseActivitiesCache.value[cacheKey].activities;
        }

        // 如果正在加载，返回空
        if (courseActivitiesCache.value[cacheKey]?.loading) {
          return [];
        }

        // 设置加载状态
        courseActivitiesCache.value = {
          ...courseActivitiesCache.value,
          [cacheKey]: { activities: [], loading: true, fetched: false }
        };

        try {
          const activities = await fetchCourseActivities(course);

          // 过滤出有用的活动类型（作业、测验、考试等）
          const filteredActivities = activities.filter(act => {
            const type = act.type;
            return type && !['签到', '投票', '直播', '笔记', '拍照'].includes(type);
          });

          // 更新缓存
          courseActivitiesCache.value = {
            ...courseActivitiesCache.value,
            [cacheKey]: { activities: filteredActivities, loading: false, fetched: true }
          };

          return filteredActivities;
        } catch (error) {
          console.error('[悬浮窗] 获取课程活动失败:', error);
          courseActivitiesCache.value = {
            ...courseActivitiesCache.value,
            [cacheKey]: { activities: [], loading: false, fetched: true }
          };
          return [];
        }
      };

      let progressTooltipPortal = null;
      const clearProgressTooltipPortal = () => {
        if (!progressTooltipPortal) return;
        progressTooltipPortal.item.classList.remove('tooltip-portal-active');
        progressTooltipPortal.element.remove();
        progressTooltipPortal = null;
      };
      const showProgressTooltipPortal = (itemElement) => {
        clearProgressTooltipPortal();
        const source = itemElement.querySelector('.progress-tooltip');
        if (!source) return;
        const portal = source.cloneNode(true);
        portal.classList.add('progress-tooltip-portal');
        document.body.appendChild(portal);
        const rect = itemElement.getBoundingClientRect();
        const isLeftSide = rect.left > window.innerWidth / 2;
        const width = portal.offsetWidth;
        const height = portal.offsetHeight;
        const left = isLeftSide
          ? Math.max(16, rect.left - width - 12)
          : Math.min(window.innerWidth - width - 16, rect.right + 12);
        const top = Math.max(16, Math.min(rect.bottom - height, window.innerHeight - height - 16));
        portal.style.left = `${left}px`;
        portal.style.top = `${top}px`;
        itemElement.classList.add('tooltip-portal-active');
        progressTooltipPortal = { item: itemElement, element: portal };
      };

      const handleProgressItemHover = async (event, course) => {
        const cacheKey = getCourseActivitiesKey(course);
        hoveredCourseKey.value = cacheKey;
        const itemElement = event.currentTarget;
        // 首页底部课程才需要按视口改为向上；详情页固定采用侧边展开，避免反复触发上下重排。
        const rect = itemElement.getBoundingClientRect();
        const tooltipHeight = 380;
        const isDetailItem = itemElement.classList.contains('detail-progress-item');
        const shouldOpenUpward = !isDetailItem
          && rect.bottom + tooltipHeight > window.innerHeight - 16
          && rect.top > tooltipHeight;
        itemElement.classList.toggle('tooltip-upward', shouldOpenUpward);
        clearProgressTooltipPortal();

        // 预加载活动数据
        await fetchCourseActivitiesOnHover(course);
        if ((isDetailItem || shouldOpenUpward) && hoveredCourseKey.value === cacheKey && itemElement.matches(':hover')) {
          showProgressTooltipPortal(itemElement);
        }
      };

      const handleProgressItemLeave = (event) => {
        hoveredCourseKey.value = null;
        if (event && event.currentTarget) {
          event.currentTarget.classList.remove('tooltip-upward');
          clearProgressTooltipPortal();
        }
      };

      const toggleProgressRestoreItem = (key) => {
        const newSet = new Set(progressIgnoredForRestore.value);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        progressIgnoredForRestore.value = newSet;
      };

      const batchProgressRestore = () => {
        unignoreByKeys(Array.from(progressIgnoredForRestore.value));
        progressIgnoredForRestore.value = new Set();
        ignoredVersion.value++;
      };


      // 排序选项
      const sortOptions = [
        { value: 'urgent', label: '紧急优先（默认）' },
        { value: 'time-asc', label: '剩余时间升序' },
        { value: 'time-desc', label: '剩余时间降序' },
        { value: 'status', label: '按状态分组' },
        { value: 'name', label: '按名称排序' }
      ];
      const currentSort = vue.ref('urgent');

      // 解析剩余时间为分钟数用于排序
      const parseTimeToMinutes = (timeStr) => {
        if (!timeStr) return Infinity; // 无时间的排到最后
        const str = String(timeStr);
        // 匹配各种格式：剩余X天X小时、X小时X分钟、已过期等
        if (str.includes('过期') || str.includes('已结束')) return -1;
        const absoluteMatch = str.match(/\d{4}[-/.年]\d{1,2}[-/.月]\d{1,2}日?(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?/);
        if (absoluteMatch) {
          const timestamp = parseTaskEngineDate(normalizeTaskEngineDateText(absoluteMatch[0]));
          if (Number.isFinite(timestamp)) return (timestamp - Date.now()) / 60000;
        }
        let minutes = 0;
        const dayMatch = str.match(/(\d+)\s*天/);
        const hourMatch = str.match(/(\d+)\s*小时/);
        const minMatch = str.match(/(\d+)\s*分/);
        if (dayMatch) minutes += parseInt(dayMatch[1]) * 24 * 60;
        if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
        if (minMatch) minutes += parseInt(minMatch[1]);
        return minutes || Infinity;
      };

      const isTodoItemUrgent = (item) => {
        const timeStr = item.leftTime || item.timeLeft || item.info || '';
        const remainingMinutes = parseTimeToMinutes(timeStr);
        if (Number.isFinite(remainingMinutes)) return remainingMinutes >= 0 && remainingMinutes <= 24 * 60;
        return item.isActivity && item.status === '进行中';
      };

      // 智能排序函数：未完成+剩余时间短的在最上面
      const sortItems = (items, type, sortType = 'urgent') => {
        const arr = [...items];

        // 课程进度特殊排序
        if (type === 'progress') {
          switch (sortType) {
            case 'urgent':
            case 'status':
              return arr.sort(compareCourseProgress);
            case 'time-asc':
              return arr.sort(compareCourseProgress);
            case 'time-desc':
              return arr.sort((a, b) => compareCourseProgress(a, b, -1));
            case 'name':
              return arr.sort((a, b) => (a.courseName || '').localeCompare(b.courseName || '', 'zh-CN'));
            default:
              return arr;
          }
        }

        switch (sortType) {
          case 'urgent':
            // 默认排序：未完成优先，然后按剩余时间升序
            return arr.sort((a, b) => {
              // 已完成的放最后
              if (a.finished && !b.finished) return 1;
              if (!a.finished && b.finished) return -1;
              // 未提交/进行中的优先
              if (a.uncommitted && !b.uncommitted) return -1;
              if (!a.uncommitted && b.uncommitted) return 1;
              // 按剩余时间排序
              const timeA = parseTimeToMinutes(a.leftTime || a.timeLeft || a.info);
              const timeB = parseTimeToMinutes(b.leftTime || b.timeLeft || b.info);
              return timeA - timeB;
            });
          case 'time-asc':
            return arr.sort((a, b) => {
              const timeA = parseTimeToMinutes(a.leftTime || a.timeLeft || a.info);
              const timeB = parseTimeToMinutes(b.leftTime || b.timeLeft || b.info);
              return timeA - timeB;
            });
          case 'time-desc':
            return arr.sort((a, b) => {
              const timeA = parseTimeToMinutes(a.leftTime || a.timeLeft || a.info);
              const timeB = parseTimeToMinutes(b.leftTime || b.timeLeft || b.info);
              return timeB - timeA;
            });
          case 'status':
            return arr.sort((a, b) => {
              if (a.uncommitted && !b.uncommitted) return -1;
              if (!a.uncommitted && b.uncommitted) return 1;
              if (a.finished && !b.finished) return 1;
              if (!a.finished && b.finished) return -1;
              return 0;
            });
          case 'name':
            return arr.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
          default:
            return arr;
        }
      };

      // 获取待办任务数据
      const loadTodoData = async () => {
        loading.value.todo = true;
        const currentTasks = extractTasks();
        const pendingTasks = currentTasks.filter(t => t.uncommitted).map(t => ({
          ...t,
          info: t.leftTime
        }));

        let pendingExams = [];
        const seenExamIds = new Set();

        try {
          const res1 = await fetch('https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode');
          const text1 = await res1.text();
          const parser1 = new DOMParser();
          const doc1 = parser1.parseFromString(text1, 'text/html');
          const exams1 = extractExams(doc1);
          exams1.filter(e => !e.finished && !e.expired).forEach(e => {
            const key = e.examId || e.title;
            if (!seenExamIds.has(key)) {
              seenExamIds.add(key);
              pendingExams.push({ ...e, course: "考试课程", info: e.timeLeft });
            }
          });
        } catch (e) { console.error("Fetch exams failed", e); }

        try {
          const res2 = await fetch(API_EXAM_LIST);
          const text2 = await res2.text();
          const parser2 = new DOMParser();
          const doc2 = parser2.parseFromString(text2, 'text/html');
          const exams2 = extractExamsFromTable(doc2);
          exams2.filter(e => !e.finished && !e.expired).forEach(e => {
            const key = e.examId || e.title;
            if (!seenExamIds.has(key)) {
              seenExamIds.add(key);
              pendingExams.push({ ...e, course: "考试课程", info: e.timeLeft });
            }
          });
        } catch (e) { console.error("Fetch exams from table failed", e); }

        // 课程任务由 loadActivitiesData 统一读取；保留已先完成加载的活动，避免并发请求覆盖首页待办。
        todoItems.value = [...pendingTasks, ...pendingExams, ...todoItems.value.filter(item => item.isActivity)];

        // 计算紧急任务
        todoItems.value = todoItems.value.map(item => ({ ...item, isUrgent: isTodoItemUrgent(item) }));
        urgentTasks.value = todoItems.value.filter(isTodoItemUrgent);

        loading.value.todo = false;
      };

      // 获取作业数据
      const loadHomeworkData = async () => {
        loading.value.homework = true;
        try {
          const res = await fetch('https://mooc1-api.chaoxing.com/work/stu-work');
          const text = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          homeworkItems.value = extractTasks(doc);
        } catch (e) { console.error('[仪表盘] 获取作业失败:', e); }
        loading.value.homework = false;
      };

      // 获取考试数据
      const loadExamData = async () => {
        loading.value.exam = true;
        try {
          const res = await fetch('https://mooc1-api.chaoxing.com/exam-ans/exam/phone/examcode');
          const text = await res.text();
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, 'text/html');
          examItems.value = extractExams(doc);
        } catch (e) { console.error('[仪表盘] 获取考试失败:', e); }
        loading.value.exam = false;
      };

      // 获取课程任务数据
      const loadActivitiesData = async () => {
        if (loading.value.activities || activitiesFetched.value) return;
        loading.value.activities = true;
        activitiesLoadFailed.value = false;
        try {
          const courses = await fetchCourseList();
          const allActivities = [];
          const batchSize = 3;
          for (let i = 0; i < courses.length; i += batchSize) {
            const batch = courses.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(course => fetchCourseActivities(course)));
            allActivities.push(...batchResults.flat());
          }
          activitiesItems.value = allActivities;
          // 首页与任务详情共用本次读取结果，避免再为待办重复遍历所有课程。
          syncActivitiesToTodo(allActivities);
          activitiesLoaded.value = true;
          activitiesFetched.value = true;
          activitiesFromCache.value = false;
          if (settings.value.shortTermCacheEnabled) saveDashboardCache('activities', allActivities);
        } catch (error) {
          console.error('[仪表盘] 加载课程任务失败:', error);
          activitiesLoadFailed.value = true;
        }
        loading.value.activities = false;
      };

      // 链接生成函数
      const getTodoLink = (item) => {
        if (item.isActivity) {
          if (item.taskLink) return item.taskLink;
          const url = new URL(API_VISIT_COURSE);
          url.searchParams.append("courseid", item.courseId);
          url.searchParams.append("clazzid", item.clazzId);
          url.searchParams.append("pageHeader", "0");
          return url.href;
        } else if (item.type === "作业") {
          const url = new URL(API_VISIT_COURSE);
          url.searchParams.append("courseid", item.courseId);
          url.searchParams.append("clazzid", item.clazzId);
          url.searchParams.append("pageHeader", "8");
          return url.href;
        } else {
          const url = new URL(API_OPEN_EXAM);
          url.searchParams.append("courseId", item.courseId);
          url.searchParams.append("classId", item.classId);
          url.searchParams.append("examId", item.examId);
          return url.href;
        }
      };

      const getHomeworkLink = (item) => {
        if (item.isActivity) return getActivityLink(item);
        const url = new URL(API_VISIT_COURSE);
        url.searchParams.append("courseid", item.courseId);
        url.searchParams.append("clazzid", item.clazzId);
        url.searchParams.append("pageHeader", "8");
        return url.href;
      };

      const getExamLink = (item) => {
        if (item.isActivity) return getActivityLink(item);
        const url = new URL(API_OPEN_EXAM);
        url.searchParams.append("courseId", item.courseId);
        url.searchParams.append("classId", item.classId);
        url.searchParams.append("examId", item.examId);
        return url.href;
      };

      const getActivityLink = (item) => {
        if (item.taskLink) return item.taskLink;
        const url = new URL(API_VISIT_COURSE);
        url.searchParams.append("courseid", item.courseId);
        url.searchParams.append("clazzid", item.clazzId);
        return url.href;
      };

      const getHomeworkStatus = (item) => item.isActivity
        ? (item.status || (item.finished ? '已完成' : '进行中'))
        : (item.uncommitted ? '待提交' : '已提交');
      const getHomeworkBadgeClass = (item) => item.isActivity
        ? (item.finished ? 'status-done' : (item.expired ? 'status-gray' : 'status-warning'))
        : (item.uncommitted ? 'status-warning' : 'status-done');

      // 切换视图函数（不跳转外部页面，在内部切换视图）
      const openFullScreen = (type) => {
        currentView.value = type;
        if (type === 'activities') loadActivitiesData();
        // 首页已经加载过课程进度时，详情页直接复用当前数据，避免再次查询。
        if (type === 'progress' && !progressLoaded.value && !loadingProgress.value) {
          loadAllCourseProgress();
        }
      };

      // 返回仪表盘
      const backToDashboard = () => {
        // 先独立绘制骨架页，再进入列表页，避免两页同时重排造成可感知卡顿。
        currentView.value = 'dashboard-loading';
        dashboardSkeletonOverlay.value = false;
        dashboardSkeletonFading.value = false;
        if (dashboardSkeletonTimer) clearTimeout(dashboardSkeletonTimer);
        requestAnimationFrame(() => {
          dashboardSkeletonTimer = setTimeout(() => {
            currentView.value = 'dashboard';
            dashboardSkeletonOverlay.value = true;
            requestAnimationFrame(() => {
              dashboardSkeletonFading.value = true;
              dashboardSkeletonTimer = setTimeout(() => {
                dashboardSkeletonOverlay.value = false;
                dashboardSkeletonFading.value = false;
                dashboardSkeletonTimer = null;
              }, 340);
            });
          }, 160);
        });
      };

      const renderDashboardSkeletonContent = () => vue.createVNode('div', { class: 'main-content' }, [
        vue.createVNode('div', { class: 'dashboard-skeleton-refresh' }, [
          vue.createVNode('span', { class: 'dashboard-skeleton-spinner' }),
          vue.createVNode('span', null, '正在整理学习清单')
        ]),
        vue.createVNode('div', { class: 'dashboard-header dashboard-skeleton-header' }, [
          vue.createVNode('div', { class: 'dashboard-skeleton-block dashboard-skeleton-title' }),
          vue.createVNode('div', { class: 'dashboard-skeleton-block dashboard-skeleton-text' })
        ]),
        vue.createVNode('div', { class: 'dashboard-skeleton-alert' }, [
          vue.createVNode('i', { class: 'dashboard-skeleton-dot' }),
          vue.createVNode('div', { class: 'dashboard-skeleton-block dashboard-skeleton-alert-line' })
        ]),
        vue.createVNode('div', { class: 'dashboard-grid' }, [
          vue.createVNode('div', { class: 'card dashboard-skeleton-card' }),
          vue.createVNode('div', { class: 'card dashboard-skeleton-card' }),
          vue.createVNode('div', { class: 'card dashboard-skeleton-card' })
        ])
      ]);

      const renderDashboardSkeleton = () => vue.createVNode('div', { class: 'dashboard-wrapper dashboard-skeleton-page' }, [
        renderDashboardSkeletonContent()
      ]);

      const renderDashboardSkeletonOverlay = () => vue.createVNode('div', {
        class: dashboardSkeletonFading.value ? 'dashboard-skeleton-overlay is-leaving' : 'dashboard-skeleton-overlay'
      }, [
        renderDashboardSkeletonContent()
      ]);

      const renderLoadingSkeleton = (message) => vue.createVNode('div', { class: 'content-skeleton', role: 'status' }, [
        vue.createVNode('div', { class: 'content-skeleton-lines' }, [
          vue.createVNode('i', { class: 'content-skeleton-line wide' }),
          vue.createVNode('i', { class: 'content-skeleton-line medium' }),
          vue.createVNode('i', { class: 'content-skeleton-line short' })
        ]),
        vue.createVNode('div', { class: 'content-skeleton-message' }, [
          vue.createVNode('span', { class: 'content-skeleton-spinner' }),
          vue.createVNode('span', null, message)
        ])
      ]);

      const renderSettingsView = () => {
        ignoredVersion.value;
        return vue.createVNode('div', { class: 'detail-view' }, [
        vue.createVNode('div', { class: 'detail-header' }, [
          vue.createVNode('div', { class: 'detail-header-left' }, [
            vue.createVNode('button', { class: 'back-btn', onClick: backToDashboard }, '← 返回仪表盘'),
            vue.createVNode('div', { class: 'detail-title' }, '统一设置')
          ])
        ]),
        vue.createVNode('div', { class: 'detail-body settings-detail-body', style: 'max-width:880px;' }, [
          vue.createVNode('section', { class: 'settings-section' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '展示分类'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '默认只保留需要处理的学习任务；其他教学互动可按需展示。'),
            vue.createVNode('button', { class: 'external-link-btn', onClick: () => { showOtherTasksDialog.value = true; } }, '配置其他任务'),
            vue.createVNode('span', { style: 'margin-left:10px;color:#64748b;font-size:13px;' }, getOtherTasksSummary())
          ]),
          vue.createVNode('section', { class: 'settings-section', style: 'margin-top:24px;' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '忽略功能'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '开启后，列表中才显示“忽略”按钮；关闭不会清除既有忽略记录。'),
            vue.createVNode('label', { class: 'settings-toggle-row' }, [
              vue.createVNode('input', { class: 'settings-toggle-input', type: 'checkbox', checked: settings.value.ignoreEnabled, 'aria-label': '开启忽略按钮', onChange: e => updateSetting('ignoreEnabled', e.target.checked) }),
              vue.createVNode('span', { class: 'settings-toggle-track', 'aria-hidden': 'true' }, [
                vue.createVNode('span', { class: 'settings-toggle-knob' })
              ]),
              vue.createVNode('span', { class: 'settings-toggle-copy' }, [
                vue.createVNode('strong', null, '显示忽略操作'),
                vue.createVNode('small', null, settings.value.ignoreEnabled ? '已开启，可在列表中忽略内容' : '默认关闭，不影响已有忽略记录')
              ])
            ])
          ]),
          vue.createVNode('section', { class: 'settings-section', style: 'margin-top:24px;' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '按课程忽略'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '勾选课程后，该课程的作业、视频/任务点、AI 实践、分组讨论、测验、考试及其他任务都会自动隐藏。'),
            vue.createVNode('button', { class: 'external-link-btn', onClick: openCourseIgnoreDialog }, '选择要忽略的课程'),
            vue.createVNode('span', { style: 'margin-left:10px;color:#64748b;font-size:13px;' }, `已忽略 ${getIgnoredItemsBySection('course').length} 门课程`)
          ]),
          vue.createVNode('section', { class: 'settings-section', style: 'margin-top:24px;' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '课程进度查询'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '逐门查询课程进度时，两次请求之间会按此间隔等待。适当增大间隔可减少连续请求。'),
            vue.createVNode('label', { class: 'progress-delay-setting' }, [
              vue.createVNode('span', { class: 'progress-delay-label' }, '请求间隔'),
              vue.createVNode('input', {
                class: 'progress-delay-input',
                type: 'number',
                min: MIN_PROGRESS_DELAY,
                max: MAX_PROGRESS_DELAY,
                step: 100,
                value: progressDelay.value,
                'aria-label': '课程进度请求间隔（毫秒）',
                onChange: e => updateProgressDelay(e.target.value)
              }),
              vue.createVNode('span', { class: 'progress-delay-unit' }, '毫秒')
            ]),
            vue.createVNode('div', { class: 'progress-delay-help' }, `可设置 ${MIN_PROGRESS_DELAY}–${MAX_PROGRESS_DELAY}ms，默认 ${DEFAULT_PROGRESS_DELAY}ms；修改后从下一轮查询开始生效。`)
          ]),
          vue.createVNode('section', { class: 'settings-section', style: 'margin-top:24px;' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '短时缓存'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '用于短时间内快速刷新时先显示上次的课程任务和课程进度，随后自动更新。缓存有效期为 5 分钟，默认关闭。'),
            vue.createVNode('label', { class: 'settings-toggle-row' }, [
              vue.createVNode('input', { class: 'settings-toggle-input', type: 'checkbox', checked: settings.value.shortTermCacheEnabled, 'aria-label': '开启短时缓存', onChange: e => updateSetting('shortTermCacheEnabled', e.target.checked) }),
              vue.createVNode('span', { class: 'settings-toggle-track', 'aria-hidden': 'true' }, [
                vue.createVNode('span', { class: 'settings-toggle-knob' })
              ]),
              vue.createVNode('span', { class: 'settings-toggle-copy' }, [
                vue.createVNode('strong', null, '短时缓存'),
                vue.createVNode('small', null, settings.value.shortTermCacheEnabled ? '已开启，缓存内容会标记并后台更新' : '已关闭，每次直接读取最新数据')
              ])
            ])
          ]),
          vue.createVNode('section', { class: 'settings-section', style: 'margin-top:24px;' }, [
            vue.createVNode('h3', { style: 'margin:0 0 8px;' }, '动态忽略已完成或已过期内容'),
            vue.createVNode('p', { style: 'margin:0 0 12px;color:#64748b;' }, '规则会自动作用于之后加载或未来出现的匹配内容；取消勾选只会停用规则，不会恢复你手动忽略的内容。'),
            vue.createVNode('button', { class: 'external-link-btn', onClick: openBulkIgnoreDialog }, '配置动态忽略规则')
          ])
        ]),
        showCourseIgnoreDialog.value ? vue.createVNode('div', { class: 'confirm-overlay', onClick: () => { showCourseIgnoreDialog.value = false; } }, [
          vue.createVNode('div', { class: 'confirm-dialog course-ignore-dialog', onClick: e => e.stopPropagation() }, [
            vue.createVNode('div', { class: 'confirm-title' }, '选择要忽略的课程'),
            vue.createVNode('div', { class: 'confirm-hint', style: 'margin-bottom:12px;' }, '课程被忽略后，所有栏目及高优先级待办都会同步隐藏。'),
            settingsCoursesLoading.value ? vue.createVNode('div', { class: 'loading-text' }, '正在读取课程…') :
              settingsCourses.value.length === 0 ? vue.createVNode('div', { class: 'empty-state' }, '暂无可管理课程') :
                vue.createVNode('div', { class: 'course-ignore-list' }, settingsCourses.value.map(course =>
                  vue.createVNode('label', { class: 'course-ignore-option' }, [
                    vue.createVNode('input', { type: 'checkbox', checked: isCourseIgnored(course), onChange: e => toggleCourseIgnored(course, e.target.checked) }),
                    vue.createVNode('span', null, course.courseName)
                  ])
                )),
            vue.createVNode('div', { class: 'confirm-actions' }, [
              vue.createVNode('button', { class: 'confirm-ok-btn', onClick: () => { showCourseIgnoreDialog.value = false; notifySettingsSaved('课程忽略已保存，列表已实时更新'); } }, '完成')
            ])
          ])
        ]) : null,
        showOtherTasksDialog.value ? vue.createVNode('div', { class: 'confirm-overlay', onClick: () => { showOtherTasksDialog.value = false; } }, [
          vue.createVNode('div', { class: 'confirm-dialog other-tasks-dialog', onClick: e => e.stopPropagation() }, [
            vue.createVNode('div', { class: 'confirm-title' }, '配置其他任务'),
            vue.createVNode('div', { class: 'confirm-hint', style: 'margin-bottom:12px;' }, '可选择显示全部其他任务，或仅显示你勾选的类型。'),
            vue.createVNode('label', { class: 'other-task-all-option' }, [
              vue.createVNode('input', { type: 'checkbox', checked: settings.value.showOtherTasks, onChange: e => updateSetting('showOtherTasks', e.target.checked) }),
              vue.createVNode('span', null, '显示全部其他任务')
            ]),
            vue.createVNode('div', { class: 'course-ignore-list', style: settings.value.showOtherTasks ? 'opacity:.55;pointer-events:none;' : '' }, OTHER_TASK_TYPES.map(type =>
              vue.createVNode('label', { class: 'course-ignore-option' }, [
                vue.createVNode('input', { type: 'checkbox', checked: (settings.value.otherTaskTypes || []).includes(type), onChange: e => toggleOtherTaskType(type, e.target.checked) }),
                vue.createVNode('span', null, type)
              ])
            )),
            vue.createVNode('div', { class: 'confirm-actions' }, [
              vue.createVNode('button', { class: 'confirm-ok-btn', onClick: () => { showOtherTasksDialog.value = false; notifySettingsSaved('其他任务展示设置已保存，列表已实时更新'); } }, '完成')
            ])
          ])
        ]) : null,
        showBulkIgnoreDialog.value ? vue.createVNode('div', { class: 'confirm-overlay', onClick: () => { showBulkIgnoreDialog.value = false; } }, [
          vue.createVNode('div', { class: 'confirm-dialog bulk-ignore-dialog', onClick: e => e.stopPropagation() }, [
            vue.createVNode('div', { class: 'confirm-title' }, '动态忽略已完成或已过期内容'),
            vue.createVNode('div', { class: 'confirm-hint', style: 'margin-bottom:12px;' }, '规则会持续作用于以后出现的匹配内容；取消勾选不会释放你手动忽略的内容。'),
            (() => {
              const previewItems = getBulkIgnorePreviewItems();
              const previewLimit = 100;
              return vue.createVNode('div', { class: 'bulk-ignore-layout' }, [
                vue.createVNode('div', { class: 'bulk-ignore-rules' }, [
                  vue.createVNode('div', { class: 'bulk-ignore-panel-title' }, '选择规则'),
                  vue.createVNode('div', { class: 'course-ignore-list' }, bulkIgnoreOptions.map(option =>
                    vue.createVNode('label', { class: 'course-ignore-option' }, [
                      vue.createVNode('input', { type: 'checkbox', checked: bulkIgnoreSelection.value.has(option.key), onChange: e => toggleBulkIgnoreType(option.key, e.target.checked) }),
                      vue.createVNode('span', null, option.label),
                      vue.createVNode('span', { style: 'margin-left:auto;color:#94a3b8;font-size:12px;' }, String(getCompletedItemsForBulkIgnore(option.key).length))
                    ])
                  ))
                ]),
                vue.createVNode('aside', { class: 'bulk-ignore-preview' }, [
                  vue.createVNode('div', { class: 'bulk-ignore-preview-header' }, [
                    vue.createVNode('span', { class: 'bulk-ignore-panel-title' }, '将被忽略的内容'),
                    vue.createVNode('span', { class: 'bulk-ignore-preview-count' }, `共 ${previewItems.length} 项`)
                  ]),
                  previewItems.length === 0
                    ? vue.createVNode('div', { class: 'bulk-ignore-preview-empty' }, '勾选左侧规则后，在这里预览会被忽略的内容')
                    : vue.createVNode('div', { class: 'bulk-ignore-preview-list' }, [
                      previewItems.slice(0, previewLimit).map(entry => vue.createVNode('div', { class: 'bulk-ignore-preview-item' }, [
                        vue.createVNode('span', { class: 'bulk-ignore-type' }, entry.label),
                        vue.createVNode('div', { class: 'bulk-ignore-preview-copy' }, [
                          vue.createVNode('div', { class: 'bulk-ignore-preview-name' }, entry.item.title || entry.item.courseName || '未命名内容'),
                          vue.createVNode('div', { class: 'bulk-ignore-preview-course' }, entry.item.course || entry.item.courseName || '课程信息暂缺')
                        ])
                      ])),
                      previewItems.length > previewLimit ? vue.createVNode('div', { class: 'bulk-ignore-preview-more' }, `其余 ${previewItems.length - previewLimit} 项将在保存后按规则自动忽略`) : null
                    ])
                ])
              ]);
            })(),
            vue.createVNode('div', { class: 'confirm-actions' }, [
              vue.createVNode('button', { class: 'confirm-cancel-btn', onClick: () => { showBulkIgnoreDialog.value = false; bulkIgnoreSelection.value = new Set(); } }, '取消'),
              vue.createVNode('button', { class: 'confirm-ok-btn', onClick: runBulkIgnore }, '保存规则')
            ])
          ])
        ]) : null,
        settingsToast.value ? vue.createVNode('div', { class: 'settings-toast', role: 'status' }, [
          vue.createVNode('span', null, '✓'),
          vue.createVNode('span', null, settingsToast.value)
        ]) : null
        ]);
      };

      // 跳转到原始页面（真正的外部跳转）
      const navigateToOriginal = (type) => {
        let url = '';
        switch (type) {
          case 'todo': url = URL_TODO; break;
          case 'homework': url = URL_HOMEWORK; break;
          case 'exam': url = URL_EXAM; break;
          case 'activities': url = URL_ACTIVITIES; break;
        }
        if (url) window.location.href = url;
      };

      vue.onMounted(() => {
        cleanupDashboardCache();
        hydrateShortTermCache();
        setInterval(cleanupDashboardCache, DASHBOARD_CACHE_TTL);
        loadTodoData();
        loadHomeworkData();
        loadExamData();
        // 首页卡片与高优先级信息属于核心内容，首次打开必须完整加载。
        // 仅设置课程列表、课程进度悬浮详情等非首屏资源保持按需请求。
        loadActivitiesData();
        loadAllCourseProgress();
      });

      return (_ctx, _cache) => {
        const _component_v_card = vue.resolveComponent("v-card");
        const _component_v_card_title = vue.resolveComponent("v-card-title");
        const _component_v_card_text = vue.resolveComponent("v-card-text");
        const _component_v_list = vue.resolveComponent("v-list");
        const _component_v_list_item = vue.resolveComponent("v-list-item");
        const _component_v_chip = vue.resolveComponent("v-chip");
        const _component_v_btn = vue.resolveComponent("v-btn");
        const _component_v_progress_linear = vue.resolveComponent("v-progress-linear");
        const _component_v_alert = vue.resolveComponent("v-alert");
        const _component_v_spacer = vue.resolveComponent("v-spacer");
        const _component_v_icon = vue.resolveComponent("v-icon");
        const _component_v_container = vue.resolveComponent("v-container");

        const dashboardStyle = `
          .dashboard-wrapper {
            font-family: "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #f5f7fa;
            min-height: 100vh;
            padding: 20px;
          }
          .dashboard-wrapper * { box-sizing: border-box; }
          .dashboard-wrapper a { text-decoration: none; color: inherit; }

          .main-content {
            width: 100%;
            max-width: 1200px;
            margin: 0 auto;
          }

          /* 滚动条美化 */
          ::-webkit-scrollbar {
            width: 6px;
            height: 6px;
          }
          ::-webkit-scrollbar-track {
            background: transparent;
          }
          ::-webkit-scrollbar-thumb {
            background: #e0e0e0;
            border-radius: 3px;
          }
          ::-webkit-scrollbar-thumb:hover {
            background: #d0d0d0;
          }

          /* 欢迎语区域 */
          .dashboard-header {
            margin-bottom: 24px;
            background: #fff;
            padding: 20px 24px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            display: flex;
            flex-direction: column;
            gap: 16px;
          }
          .welcome-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .welcome-text {
            font-size: 22px;
            font-weight: 600;
            color: #262626;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .date-info {
            font-size: 14px;
            color: #8c8c8c;
          }
          .settings-onboarding {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            padding: 12px 14px;
            border: 1px solid #cfe8ff;
            border-radius: 10px;
            background: linear-gradient(135deg, #f0f9ff, #f8fbff);
            color: #315a7d;
            font-size: 13px;
            line-height: 1.55;
          }
          .settings-onboarding-copy { display: flex; align-items: center; gap: 9px; }
          .settings-onboarding-icon {
            display: inline-flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; border-radius: 8px; background: #dff1ff; font-size: 15px;
          }
          .settings-onboarding-actions { display: flex; gap: 8px; flex-shrink: 0; }
          .course-ignore-onboarding {
            position: fixed;
            right: 24px;
            bottom: 24px;
            z-index: 8000;
            width: min(390px, calc(100vw - 32px));
            padding: 18px;
            border: 1px solid #d8e8ff;
            border-radius: 14px;
            background: #fff;
            box-shadow: 0 16px 44px rgba(15, 23, 42, .18);
            animation: course-ignore-hint-in .24s ease-out;
          }
          .course-ignore-onboarding-head { display: flex; align-items: flex-start; gap: 11px; }
          .course-ignore-onboarding-icon {
            display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto;
            width: 34px; height: 34px; border-radius: 10px; background: #eef5ff; font-size: 18px;
          }
          .course-ignore-onboarding-title { color: #1e293b; font-size: 15px; font-weight: 600; }
          .course-ignore-onboarding-copy { margin-top: 4px; color: #64748b; font-size: 13px; line-height: 1.6; }
          .course-ignore-onboarding-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
          @keyframes course-ignore-hint-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

          /* 紧急提醒条 */
          .urgent-strip {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: #fff1f0;
            border: 1px solid #ffccc7;
            padding: 10px 16px;
            border-radius: 6px;
            color: #5c0011;
            font-size: 14px;
            width: 100%;
            transition: all 0.2s;
            cursor: pointer;
          }
          .urgent-strip:hover { background-color: #ffccc7; }
          .urgent-left { display: flex; align-items: center; gap: 10px; }
          .urgent-icon { font-size: 16px; }
          .urgent-count { font-weight: bold; color: #cf1322; }
          .urgent-action { font-size: 13px; color: #8c8c8c; }

          /* 仪表盘网格 */
          .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 20px;
            align-items: stretch;
          }
          .dashboard-skeleton-page { background: #f5f7fa; }
          .dashboard-skeleton-overlay { position: fixed; inset: 0; z-index: 100001; overflow: auto; padding: 20px; background: #f5f7fa; opacity: 1; transition: opacity 340ms cubic-bezier(.22,.61,.36,1); pointer-events: none; }
          .dashboard-skeleton-overlay.is-leaving { opacity: 0; }
          .dashboard-skeleton-refresh { display: flex; justify-content: flex-end; align-items: center; gap: 8px; height: 28px; margin-bottom: 8px; color: #7c8aa5; font-size: 12px; letter-spacing: .2px; }
          .dashboard-skeleton-spinner { width: 14px; height: 14px; border: 2px solid #d5e7fa; border-top-color: #5b9fe9; border-radius: 50%; animation: dashboard-skeleton-spin .75s linear infinite; }
          .dashboard-skeleton-header { min-height: 92px; display: flex; flex-direction: column; justify-content: center; gap: 12px; }
          .dashboard-skeleton-block, .dashboard-skeleton-card::before, .dashboard-skeleton-card::after {
            display: block;
            border-radius: 999px;
            background: linear-gradient(90deg, #edf1f5 25%, #f8fafc 45%, #edf1f5 65%);
            background-size: 220% 100%;
            animation: dashboard-skeleton-shine 1s linear infinite;
          }
          .dashboard-skeleton-title { width: 180px; height: 22px; }
          .dashboard-skeleton-text { width: 300px; max-width: 65%; height: 13px; }
          .dashboard-skeleton-alert { height: 48px; padding: 0 20px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px; border-radius: 10px; border: 1px solid #ffe5dc; background: #fffaf8; }
          .dashboard-skeleton-dot { width: 9px; height: 9px; border-radius: 50%; background: #ffcbb8; }
          .dashboard-skeleton-alert-line { width: min(460px, 72%); height: 14px; }
          .dashboard-skeleton-card { min-height: 245px; padding: 24px; overflow: hidden; }
          .dashboard-skeleton-card::before { content: ''; width: 104px; height: 18px; }
          .dashboard-skeleton-card::after { content: ''; width: 78%; height: 14px; margin-top: 42px; box-shadow: 0 42px 0 #eef2f6, 0 84px 0 #eef2f6; }
          @keyframes dashboard-skeleton-shine { to { background-position: -220% 0; } }
          @keyframes dashboard-skeleton-spin { to { transform: rotate(360deg); } }

          /* 卡片通用样式 */
          .card {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
          .card:hover {
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
            transform: translateY(-2px);
          }

          /* 卡片标题栏 */
          .card-header {
            padding: 18px 24px;
            border-bottom: 1px solid #f5f5f5;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .card-title {
            font-size: 16px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 10px;
            color: #333;
          }
          .indicator-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            display: inline-block;
          }
          .card-more {
            font-size: 13px;
            color: #999;
            cursor: pointer;
          }
          .card-more:hover { color: #1890ff; }

          /* 卡片内容区 */
          .card-body {
            padding: 0 12px;
            max-height: 350px;
            overflow-y: auto;
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .card-body > .empty-state {
            flex: 1;
            min-height: 180px;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          /* 列表项 */
          .list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 12px;
            border-bottom: 1px dashed #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
          }
          .list-item:last-child { border-bottom: none; }
          .list-item:hover {
            background-color: #fafafa;
            border-radius: 6px;
          }

          /* 左侧内容 */
          .item-main {
            flex: 1;
            margin-right: 12px;
            min-width: 0;
          }
          .task-title {
            font-size: 14px;
            color: #333;
            margin-bottom: 6px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-weight: 500;
          }
          .task-meta {
            display: flex;
            align-items: center;
            font-size: 12px;
            color: #999;
            gap: 8px;
          }
          .course-tag {
            background: #f7f7f7;
            padding: 2px 6px;
            border-radius: 4px;
            color: #666;
            font-size: 12px;
          }

          /* 右侧状态 */
          .item-status {
            text-align: right;
            flex-shrink: 0;
          }

          /* 状态胶囊 */
          .badge {
            font-size: 12px;
            padding: 2px 8px;
            border-radius: 10px;
            font-weight: normal;
            display: inline-block;
          }
          .status-urgent { background: #fff1f0; color: #cf1322; border: 1px solid #ffa39e; }
          .status-warning { background: #fffbe6; color: #d48806; border: 1px solid #ffe58f; }
          .status-normal { background: #e6f7ff; color: #096dd9; border: 1px solid #91d5ff; }
          .status-done { background: #f6ffed; color: #389e0d; border: 1px solid #b7eb8f; }
          .status-gray { background: #f5f5f5; color: #8c8c8c; border: 1px solid #d9d9d9; }

          /* 空状态 */
          .empty-state {
            text-align: center;
            padding: 30px 0;
            color: #bfbfbf;
            font-size: 14px;
          }
          .lazy-load-state {
            width: 100%;
            border: 0;
            background: transparent;
            cursor: pointer;
            color: #7c8aa5;
            transition: color .2s, background .2s;
          }
          .lazy-load-state:hover {
            color: #1677ff;
            background: #f0f7ff;
          }

          /* 美化进度条 */
          .loading-state {
            text-align: center;
            padding: 40px 0;
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid #f3f3f3;
            border-top: 3px solid #1890ff;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto;
          }
          .content-skeleton { min-height: 180px; padding: 24px 14px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
          .content-skeleton-lines { display: grid; gap: 14px; }
          .content-skeleton-line { display: block; height: 14px; border-radius: 99px; background: linear-gradient(90deg, #edf2f7 25%, #f8fafc 45%, #edf2f7 65%); background-size: 220% 100%; animation: dashboard-skeleton-shine 1s linear infinite; }
          .content-skeleton-line.wide { width: 88%; }
          .content-skeleton-line.medium { width: 67%; }
          .content-skeleton-line.short { width: 45%; }
          .content-skeleton-message { display: flex; align-items: center; justify-content: center; gap: 8px; color: #7c8aa5; font-size: 13px; }
          .content-skeleton-spinner { width: 15px; height: 15px; border: 2px solid #d5e7fa; border-top-color: #5b9fe9; border-radius: 50%; animation: dashboard-skeleton-spin .75s linear infinite; }
          .cache-source-note { display: inline-flex; align-items: center; gap: 4px; margin-left: 8px; padding: 3px 8px; border-radius: 999px; background: #fff7e6; color: #d48806; font-size: 12px; font-weight: 500; }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .loading-text {
            margin-top: 12px;
            color: #999;
            font-size: 13px;
          }

          /* 详情页视图 */
          .detail-view {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
            min-height: 500px;
          }

          /* 课程进度全屏查看 - 网格布局 */
          .detail-progress-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 16px;
            padding: 20px;
            max-height: calc(100vh - 200px);
            overflow-y: auto;
          }
          /* 课程进度详情使用页面滚动，悬浮卡片可以完整越出网格边界。 */
          .progress-detail-body {
            max-height: none;
            overflow: visible;
          }
          .progress-detail-body .detail-progress-grid {
            max-height: none;
            overflow: visible;
          }
          .detail-progress-item {
            background: #fff;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #e8e8e8;
            transition: all 0.2s;
            cursor: pointer;
            position: relative;
          }
          .detail-progress-item:hover {
            border-color: #722ed1;
            box-shadow: 0 4px 12px rgba(114, 46, 209, 0.15);
            transform: translateY(-2px);
            z-index: 99999;
          }
          /* 详情页沿用首页的侧边悬浮，避免上下方向切换造成页面抖动。 */
          .detail-progress-item .progress-tooltip {
            left: calc(100% + 12px) !important;
            right: auto !important;
            top: 0;
            bottom: auto;
            transform: none;
            width: 280px;
            max-height: 500px;
            z-index: 100000 !important;
          }
          .detail-progress-item .progress-tooltip::before {
            left: -8px !important;
            right: auto !important;
            top: 20px;
            bottom: auto;
            border: 8px solid transparent;
            border-right-color: #fff;
            border-bottom-color: transparent;
            border-left-color: transparent;
          }
          .detail-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 20px 24px;
            border-bottom: 1px solid #f5f5f5;
          }
          .detail-header-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .back-btn {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            background: #f5f5f5;
            border: none;
            border-radius: 6px;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .back-btn:hover {
            background: #e8e8e8;
            color: #333;
          }
          .detail-title {
            font-size: 18px;
            font-weight: 600;
            color: #333;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .detail-count {
            font-size: 13px;
            color: #999;
            font-weight: normal;
          }
          .external-link-btn {
            padding: 8px 16px;
            background: #1890ff;
            border: none;
            border-radius: 6px;
            color: #fff;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .external-link-btn:hover {
            background: #40a9ff;
          }
          .detail-body {
            padding: 0 24px 24px;
            max-height: 600px;
            overflow-y: auto;
          }
          /* 设置页内容由页面统一滚动，避免详情容器再生成一条内层滚动条。 */
          .settings-detail-body {
            max-height: none;
            overflow: visible;
          }
          .detail-list-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 0;
            border-bottom: 1px dashed #f0f0f0;
            cursor: pointer;
            transition: background 0.2s;
          }
          .detail-list-item:hover {
            background: #fafafa;
            margin: 0 -12px;
            padding: 16px 12px;
            border-radius: 6px;
          }
          .detail-list-item:last-child { border-bottom: none; }
          .detail-item-main { flex: 1; min-width: 0; margin-right: 16px; }
          .detail-item-title {
            font-size: 15px;
            color: #333;
            margin-bottom: 6px;
            font-weight: 500;
          }
          .detail-item-meta {
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 13px;
            color: #999;
          }
          .detail-item-status {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 4px;
          }
          .status-time {
            font-size: 13px;
            color: #666;
            font-weight: 500;
          }
          .status-time.urgent { color: #cf1322; }

          /* 详情页工具栏 */
          .detail-toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 24px;
            background: #fafafa;
            border-bottom: 1px solid #f0f0f0;
          }
          .sort-container {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .sort-label {
            font-size: 13px;
            color: #666;
          }
          .sort-select {
            padding: 6px 12px;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 13px;
            color: #333;
            background: #fff;
            cursor: pointer;
            outline: none;
          }
          .sort-select:hover { border-color: #40a9ff; }
          .sort-select:focus { border-color: #1890ff; box-shadow: 0 0 0 2px rgba(24,144,255,0.2); }

          /* 查看按钮 */
          .view-btn {
            padding: 6px 12px;
            background: #fff;
            border: 1px solid #1890ff;
            border-radius: 4px;
            color: #1890ff;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
          }
          .view-btn:hover {
            background: #1890ff;
            color: #fff;
          }

          /* 列表项时间和状态组合显示 - 新布局 */
          .item-time-status {
            display: flex;
            flex-direction: row;
            align-items: center;
            gap: 8px;
            flex-shrink: 0;
          }
          .status-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 2px;
          }
          .time-display {
            font-size: 12px;
            color: #999;
          }
          .time-display.urgent {
            color: #cf1322;
            font-weight: 500;
          }
          .detail-list-item .item-time-status {
            flex-direction: row;
          }
          .detail-list-item .status-info {
            min-width: 80px;
          }
          /* 课程进度卡片样式 - 占用2列 */
          .progress-card {
            min-height: 200px;
            grid-column: span 2;
            overflow: hidden;
          }
          .progress-card .card-body {
            height: 350px;
            min-height: 0;
            max-height: 350px;
            flex: 0 0 350px;
            overflow-y: auto;
            overflow-x: hidden;
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
          }
          .progress-items-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px 16px;
            align-items: stretch;
            grid-auto-rows: 1fr;
            overflow: visible;
          }
          /* 课程进度主体与其他卡片一致，保持固定区域并通过自身滚动查看。 */
          .tooltip-overflow-visible { overflow: visible !important; }
          .progress-item {
            display: flex;
            align-items: flex-start;
            padding: 14px;
            border: 1px solid #f0f0f0;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
            position: relative;
            min-height: 80px;
            min-width: 0;
            overflow: visible;
          }
          .progress-item:hover {
            background: #f5f7fa;
            border-color: #1890ff;
            box-shadow: 0 2px 8px rgba(24, 144, 255, 0.15);
            z-index: 10;
          }
          .progress-item:last-child { border-bottom: none; }
          /* 悬浮提示样式 - 左侧显示（右边卡片使用左侧悬浮） */
          .progress-tooltip {
            display: none;
            position: absolute;
            left: calc(100% + 12px);
            top: 0;
            width: 280px;
            max-width: calc(100vw - 32px);
            max-height: 500px;
            overflow-y: auto;
            padding: 14px;
            background: #fff;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.18);
            z-index: 10000 !important;
            font-size: 13px;
          }
          .progress-tooltip::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 20px;
            border: 8px solid transparent;
            border-right-color: #fff;
          }
          /* 右侧卡片（偶数项）悬浮提示显示在左侧 */
          .progress-item:nth-child(even) .progress-tooltip,
          .detail-progress-item:nth-child(even) .progress-tooltip {
            left: auto;
            right: calc(100% + 12px);
          }
          .progress-item:nth-child(even) .progress-tooltip::before,
          .detail-progress-item:nth-child(even) .progress-tooltip::before {
            left: auto;
            right: -8px;
            border-right-color: transparent;
            border-left-color: #fff;
          }
          .detail-progress-item:nth-child(even) .progress-tooltip {
            left: auto !important;
            right: calc(100% + 12px) !important;
          }
          .detail-progress-item:nth-child(even) .progress-tooltip::before {
            left: auto !important;
            right: -8px !important;
          }
          .progress-item.tooltip-upward .progress-tooltip {
            top: auto;
            bottom: 0;
          }
          .progress-item.tooltip-upward .progress-tooltip::before {
            top: auto;
            bottom: 20px;
          }
          .progress-item.tooltip-portal-active > .progress-tooltip,
          .detail-progress-item.tooltip-portal-active > .progress-tooltip {
            display: none !important;
          }
          .progress-tooltip-portal {
            display: block !important;
            position: fixed !important;
            right: auto !important;
            bottom: auto !important;
            transform: none !important;
            z-index: 100002 !important;
            pointer-events: none;
          }
          .progress-item:hover .progress-tooltip,
          .detail-progress-item:hover .progress-tooltip {
            display: block;
          }

          /* 增强版悬浮窗样式 - 活动列表区域 */
          .tooltip-activities-section {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 2px solid #f0f0f0;
          }
          .tooltip-activities-title {
            font-size: 13px;
            font-weight: 600;
            color: #333;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .tooltip-loading {
            text-align: center;
            padding: 15px;
            color: #999;
            font-size: 12px;
          }
          .tooltip-no-activities {
            text-align: center;
            padding: 10px;
            color: #bbb;
            font-size: 12px;
          }
          .tooltip-activity-group {
            margin-bottom: 10px;
          }
          .tooltip-activity-group:last-child {
            margin-bottom: 0;
          }
          .activity-group-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 600;
            color: #555;
            margin-bottom: 6px;
          }
          .activity-icon {
            font-size: 14px;
          }
          .activity-count {
            color: #999;
            font-weight: normal;
          }
          .activity-list {
            display: flex;
            flex-direction: column;
            gap: 4px;
            padding-left: 20px;
          }
          .activity-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 11px;
            padding: 4px 6px;
            background: #fafafa;
            border-radius: 4px;
            border-left: 2px solid #e8e8e8;
          }
          .activity-item.ongoing {
            background: #e6f7ff;
            border-left-color: #1890ff;
          }
          .activity-item.finished {
            background: #f6ffed;
            border-left-color: #52c41a;
          }
          .activity-name {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #333;
          }
          .activity-status {
            margin-left: 8px;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 10px;
            white-space: nowrap;
            flex-shrink: 0;
          }
          .activity-status.status-ongoing {
            background: #1890ff;
            color: #fff;
          }
          .activity-status.status-finished {
            background: #52c41a;
            color: #fff;
          }
          .activity-status.status-pending {
            background: #d9d9d9;
            color: #666;
          }

          @media (max-width: 960px) {
            .progress-items-grid {
              grid-template-columns: 1fr;
            }
          }
          @media (max-width: 720px) {
            .progress-detail-header {
              align-items: flex-start;
              flex-direction: column;
              gap: 12px;
            }
            .progress-detail-header > .progress-detail-actions {
              justify-content: flex-start;
              width: 100%;
            }
            .bulk-ignore-dialog { width: min(560px, calc(100vw - 24px)); }
            .bulk-ignore-layout { grid-template-columns: 1fr; }
            .bulk-ignore-preview-list { max-height: 180px; }
            .progress-card .card-body {
              overflow-x: hidden;
            }
            .progress-tooltip {
              left: 50% !important;
              right: auto !important;
              top: calc(100% + 8px);
              transform: translateX(-50%);
              width: min(320px, calc(100vw - 32px));
              max-height: 400px;
            }
            .progress-tooltip::before {
              left: 50% !important;
              top: -8px;
              right: auto !important;
              transform: translateX(-50%);
              border-right-color: transparent !important;
              border-left-color: transparent !important;
              border-bottom-color: #fff;
            }
            .progress-item:nth-child(even) .progress-tooltip {
              left: 50% !important;
              right: auto !important;
            }
            .progress-item:nth-child(even) .progress-tooltip::before {
              left: 50% !important;
              right: auto !important;
              border-left-color: transparent !important;
            }
          }
          .tooltip-title {
            font-size: 14px;
            font-weight: 600;
            color: #333;
            margin-bottom: 10px;
            padding-bottom: 8px;
            border-bottom: 1px solid #f0f0f0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .tooltip-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 6px;
            color: #666;
          }
          .tooltip-row .label { color: #999; font-size: 12px; }
          .tooltip-row .value { font-weight: 500; color: #333; }
          .tooltip-row .value.highlight { color: #1890ff; }
          .tooltip-row .value.success { color: #52c41a; }
          .tooltip-row .value.warning { color: #faad14; }
          .tooltip-loading {
            text-align: center;
            padding: 20px;
            color: #999;
          }
          .progress-item-main {
            flex: 1;
            min-width: 0;
            margin-right: 12px;
            overflow: hidden;
          }
          .progress-item-title {
            font-size: 14px;
            color: #333;
            font-weight: 500;
            margin-bottom: 6px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .progress-bar-wrapper {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .progress-bar {
            flex: 1;
            height: 8px;
            background: #f0f0f0;
            border-radius: 4px;
            overflow: hidden;
          }
          .progress-bar-fill {
            height: 100%;
            border-radius: 4px;
            transition: width 0.3s;
          }
          .progress-bar-fill.complete { background: linear-gradient(90deg, #52c41a, #73d13d); }
          .progress-bar-fill.warning { background: linear-gradient(90deg, #faad14, #ffc53d); }
          .progress-bar-fill.danger { background: linear-gradient(90deg, #f5222d, #ff4d4f); }
          .progress-bar-fill.normal { background: linear-gradient(90deg, #1890ff, #40a9ff); }
          .progress-rate {
            font-size: 14px;
            font-weight: 600;
            min-width: 50px;
            text-align: right;
          }
          .progress-rate.complete { color: #52c41a; }
          .progress-rate.warning { color: #faad14; }
          .progress-rate.danger { color: #cf1322; }
          .progress-rate.normal { color: #1890ff; }
          .progress-tasks-count {
            font-size: 12px;
            color: #999;
            margin-top: 4px;
          }
          .progress-unfinished {
            margin-top: 4px;
            font-size: 12px;
            color: #f5222d;
          }
          .progress-last-update {
            font-size: 12px;
            color: #bbb;
            margin-left: auto;
          }
          /* 进度卡片右侧信息栏 */
          .progress-item-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            justify-content: flex-start;
            gap: 2px;
            min-width: 80px;
            flex-shrink: 0;
          }
          .progress-item-info .progress-rate {
            margin-bottom: 0;
            line-height: 1.2;
          }
          .progress-item-info .progress-tasks-count {
            margin-top: 0;
            line-height: 1.2;
          }
          .progress-item-info .ignore-btn {
            margin-top: 4px;
            margin-right: -4px;
          }
          .refresh-btn {
            padding: 4px 8px;
            background: transparent;
            border: 1px solid #d9d9d9;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
            cursor: pointer;
            transition: all 0.2s;
          }
          .refresh-btn:hover {
            border-color: #1890ff;
            color: #1890ff;
          }
          .refresh-btn.disabled {
            background: #f5f5f5;
            border-color: #d9d9d9;
            color: #999;
            cursor: not-allowed;
          }
          .refresh-btn.disabled:hover {
            border-color: #d9d9d9;
            color: #999;
          }

          /* 移动端适配 */
          @media (max-width: 768px) {
            .dashboard-wrapper { padding: 10px; }
            .welcome-row {
              flex-direction: column;
              align-items: flex-start;
              gap: 5px;
            }
            .dashboard-header { padding: 15px; }
            .card-header { padding: 15px; }
            .dashboard-grid { grid-template-columns: 1fr; }
            .progress-card { grid-column: span 1; }
            .course-ignore-onboarding { right: 16px; bottom: 16px; }
          }

          /* ===== 忽略功能样式 ===== */
          /* 忽略按钮 - 默认隐藏，hover 显示 */
          .ignore-btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            opacity: 0.6; /* 默认可见但半透明，减少视觉干扰 */
            margin-right: -4px; /* 进一步靠边 */
            transition: opacity 0.2s;
            padding: 3px 7px;
            border: 1px solid #ffadd2;
            background: #fff0f6;
            color: #eb2f96;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            margin-left: 6px;
          }
          .list-item:hover .ignore-btn,
          .detail-list-item:hover .ignore-btn { opacity: 1; }
          .progress-item .ignore-btn { opacity: 0.6; }
          .progress-item:hover .ignore-btn { opacity: 1; }
          .ignore-btn:hover {
            background: #ffadd2;
            color: #9e1068;
          }

          /* 多选模式 */
          .select-checkbox {
            width: 16px;
            height: 16px;
            border: 1.5px solid #d9d9d9;
            border-radius: 3px;
            margin-right: 10px;
            flex-shrink: 0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            background: #fff;
          }
          .select-checkbox.checked {
            background: #1890ff;
            border-color: #1890ff;
            color: #fff;
          }
          .select-mode-btn {
            padding: 3px 8px;
            border: 1px solid #d9d9d9;
            background: #fff;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
            cursor: pointer;
            transition: all 0.2s;
          }
          .select-mode-btn:hover, .select-mode-btn.active {
            border-color: #eb2f96;
            color: #eb2f96;
          }

          /* 批量操作栏 */
          .batch-bar {
            position: sticky;
            bottom: 0;
            background: #fff9f0;
            border-top: 1px solid #ffd591;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            font-size: 13px;
            color: #d46b08;
            z-index: 100;
          }
          .batch-ignore-btn {
            padding: 5px 14px;
            background: #eb2f96;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
            transition: background 0.2s;
          }
          .batch-ignore-btn:hover { background: #c41d7f; }
          .batch-ignore-btn:disabled {
            background: #faade9;
            cursor: not-allowed;
          }
          .batch-restore-btn {
            padding: 5px 14px;
            background: #1890ff;
            color: #fff;
            border: none;
            border-radius: 4px;
            font-size: 13px;
            cursor: pointer;
          }
          .batch-restore-btn:disabled { background: #91d5ff; cursor: not-allowed; }

          /* 确认弹窗 */
          .confirm-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 9000;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .confirm-dialog {
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            padding: 24px;
            width: 380px;
            max-width: calc(100vw - 32px);
          }
          .course-ignore-dialog { width: 560px; }
          .other-tasks-dialog { width: 480px; }
          .bulk-ignore-dialog { width: 900px; }
          .bulk-ignore-layout { display: grid; grid-template-columns: minmax(260px, .9fr) minmax(340px, 1.1fr); gap: 18px; min-height: 310px; }
          .bulk-ignore-rules, .bulk-ignore-preview { min-width: 0; padding: 12px; border: 1px solid #e8edf4; border-radius: 10px; background: #fbfdff; }
          .bulk-ignore-panel-title { font-size: 13px; font-weight: 600; color: #334155; }
          .bulk-ignore-rules .course-ignore-list { margin-top: 10px; max-height: 280px; }
          .bulk-ignore-preview { display: flex; flex-direction: column; }
          .bulk-ignore-preview-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 10px; border-bottom: 1px solid #e8edf4; }
          .bulk-ignore-preview-count { padding: 2px 8px; border-radius: 999px; background: #fff1f0; color: #cf1322; font-size: 12px; }
          .bulk-ignore-preview-list { flex: 1; min-height: 0; max-height: 280px; overflow-y: auto; margin-top: 8px; display: grid; gap: 7px; }
          .bulk-ignore-preview-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px; border-radius: 7px; background: #fff; border: 1px solid #eef2f6; }
          .bulk-ignore-type { flex: 0 0 auto; padding: 2px 6px; border-radius: 4px; background: #fff7e6; color: #d48806; font-size: 11px; }
          .bulk-ignore-preview-copy { min-width: 0; }
          .bulk-ignore-preview-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #334155; font-size: 13px; }
          .bulk-ignore-preview-course { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 3px; color: #94a3b8; font-size: 12px; }
          .bulk-ignore-preview-empty { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 210px; text-align: center; color: #94a3b8; font-size: 13px; }
          .bulk-ignore-preview-more { padding: 8px 2px 2px; color: #64748b; font-size: 12px; text-align: center; }
          .other-task-all-option {
            display: flex; align-items: center; gap: 10px; margin: 0 0 10px;
            padding: 11px 12px; border-radius: 8px; background: #eff6ff; color: #1d4ed8; cursor: pointer;
          }
          .settings-toast {
            position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%);
            z-index: 12000; display: flex; align-items: center; gap: 8px;
            padding: 11px 16px; border-radius: 10px; background: #1f2937; color: #fff;
            box-shadow: 0 10px 28px rgba(15, 23, 42, .22); font-size: 13px;
            animation: settings-toast-in .18s ease-out;
          }
          @keyframes settings-toast-in { from { opacity: 0; transform: translate(-50%, 8px); } to { opacity: 1; transform: translate(-50%, 0); } }
          .course-ignore-list { max-height: 360px; overflow-y: auto; display: grid; gap: 8px; padding: 2px; }
          .course-ignore-option {
            display: flex; align-items: center; gap: 10px; padding: 10px 12px;
            border: 1px solid #e5e7eb; border-radius: 8px; color: #334155; cursor: pointer;
          }
          .course-ignore-option:hover { background: #f8fafc; border-color: #93c5fd; }
          .settings-toggle-row {
            display: flex;
            align-items: center;
            gap: 12px;
            width: fit-content;
            padding: 10px 14px;
            border: 1px solid #dbe7f5;
            border-radius: 12px;
            background: linear-gradient(135deg, #f8fbff, #f2f8ff);
            cursor: pointer;
            transition: border-color .2s, box-shadow .2s, transform .2s;
          }
          .settings-toggle-row:hover { border-color: #91caff; box-shadow: 0 5px 14px rgba(24, 144, 255, .10); transform: translateY(-1px); }
          .settings-toggle-input { position: absolute; width: 1px; height: 1px; opacity: 0; }
          .settings-toggle-track { width: 42px; height: 24px; padding: 3px; border-radius: 999px; background: #cbd5e1; transition: background .22s ease; }
          .settings-toggle-knob { display: block; width: 18px; height: 18px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(15,23,42,.25); transition: transform .22s cubic-bezier(.22,.61,.36,1); }
          .settings-toggle-input:checked + .settings-toggle-track { background: #1677ff; }
          .settings-toggle-input:checked + .settings-toggle-track .settings-toggle-knob { transform: translateX(18px); }
          .settings-toggle-input:focus-visible + .settings-toggle-track { outline: 3px solid rgba(22,119,255,.24); outline-offset: 2px; }
          .settings-toggle-copy { display: flex; flex-direction: column; gap: 2px; color: #1e293b; }
          .settings-toggle-copy strong { font-size: 14px; font-weight: 600; }
          .settings-toggle-copy small { color: #64748b; font-size: 12px; }
          .progress-delay-setting { display: flex; align-items: center; gap: 10px; width: fit-content; }
          .progress-delay-label { color: #334155; font-size: 14px; font-weight: 600; }
          .progress-delay-input {
            width: 120px; padding: 8px 10px; border: 1px solid #cbd5e1; border-radius: 7px;
            background: #fff; color: #1e293b; font-size: 14px; outline: none;
          }
          .progress-delay-input:focus { border-color: #1677ff; box-shadow: 0 0 0 3px rgba(22,119,255,.12); }
          .progress-delay-unit { color: #64748b; font-size: 13px; }
          .progress-delay-help { margin-top: 8px; color: #94a3b8; font-size: 12px; }
          .progress-delay-link {
            padding: 4px 8px; border: 1px solid #e2e8f0; border-radius: 5px;
            background: #fff; color: #64748b; font-size: 11px; cursor: pointer;
          }
          .progress-delay-link:hover { border-color: #91caff; color: #1677ff; }
          .progress-detail-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            flex-wrap: wrap;
            gap: 8px;
            max-width: 100%;
          }
          .confirm-title {
            font-size: 16px;
            font-weight: 600;
            color: #262626;
            margin-bottom: 12px;
          }
          .confirm-list {
            max-height: 160px;
            overflow-y: auto;
            margin-bottom: 12px;
            background: #fafafa;
            border-radius: 6px;
            padding: 8px 12px;
          }
          .confirm-list-item {
            font-size: 13px;
            color: #595959;
            padding: 4px 0;
            border-bottom: 1px dashed #f0f0f0;
          }
          .confirm-list-item:last-child { border-bottom: none; }
          .confirm-hint {
            font-size: 12px;
            color: #8c8c8c;
            margin-bottom: 16px;
            line-height: 1.6;
          }
          .confirm-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .confirm-cancel-btn {
            padding: 7px 16px;
            border: 1px solid #d9d9d9;
            background: #fff;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
            color: #595959;
          }
          .confirm-ok-btn {
            padding: 7px 16px;
            background: #eb2f96;
            color: #fff;
            border: none;
            border-radius: 5px;
            font-size: 14px;
            cursor: pointer;
          }
          .confirm-ok-btn:hover { background: #c41d7f; }

          /* 已忽略面板 */
          .ignored-panel-btn {
            padding: 4px 10px;
            border: 1px solid #d9d9d9;
            background: #fff;
            border-radius: 4px;
            font-size: 12px;
            color: #666;
            cursor: pointer;
            transition: all 0.2s;
          }
          .ignored-panel-btn:hover {
            border-color: #1890ff;
            color: #1890ff;
          }
          .restore-single-btn {
            padding: 3px 8px;
            border: 1px solid #91d5ff;
            background: #e6f7ff;
            color: #1890ff;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            white-space: nowrap;
            flex-shrink: 0;
            margin-left: 6px;
          }
          .restore-single-btn:hover {
            background: #1890ff;
            color: #fff;
          }
          .ignored-date {
            font-size: 11px;
            color: #bbb;
          }
        `;


        // 注入样式
        if (!document.querySelector('#dashboard-style-v2')) {
          const styleEl = document.createElement('style');
          styleEl.id = 'dashboard-style-v2';
          styleEl.textContent = dashboardStyle;
          document.head.appendChild(styleEl);
        }

        // 获取状态类名
        const getStatusClass = (item) => {
          if (item.isUrgent) return 'status-urgent';
          if (item.uncommitted || item.ongoing) return 'status-warning';
          if (item.finished) return 'status-done';
          return 'status-normal';
        };

        // 获取视图标题
        const getViewTitle = (type) => {
          switch (type) {
            case 'todo': return '待办任务';
            case 'homework': return '全部作业';
            case 'exam': return '全部考试';
            case 'activities': return '课程任务';
            case 'progress': return '课程进度';
            default: return '';
          }
        };

        // 获取视图数据（已过滤忽略项）
        const getViewItems = (type) => {
          switch (type) {
            case 'todo': return filteredTodoItems.value;
            case 'homework': return filteredHomeworkItems.value;
            case 'exam': return filteredExamItems.value;
            case 'activities': return filteredActivitiesItems.value;
            case 'progress': return filteredCourseProgressItems.value;
            default: return [];
          }
        };

        // 获取视图原始数据（未过滤，用于统计）
        const getRawViewItems = (type) => {
          switch (type) {
            case 'todo': return todoItems.value;
            case 'homework': return [...homeworkItems.value, ...activitiesItems.value.filter(isRoutedToHomework)];
            case 'exam': return [...examItems.value, ...activitiesItems.value.filter(isRoutedToExam)];
            case 'activities': return activitiesItems.value
              .filter(item => !isRoutedToHomework(item) && !isRoutedToExam(item));
            case 'progress': return courseProgressItems.value;
            default: return [];
          }
        };

        // 获取视图加载状态
        const getViewLoading = (type) => {
          switch (type) {
            case 'todo': return loading.value.todo;
            case 'homework': return loading.value.homework;
            case 'exam': return loading.value.exam;
            case 'activities': return loading.value.activities;
            case 'progress': return loadingProgress.value;
            default: return false;
          }
        };

        // 获取项目链接
        const getItemLink = (type, item) => {
          switch (type) {
            case 'todo': return getTodoLink(item);
            case 'homework': return getHomeworkLink(item);
            case 'exam': return getExamLink(item);
            case 'activities': return getActivityLink(item);
            case 'progress': return item.studyDataUrl || '#';
            default: return '#';
          }
        };

        // 获取列表项状态显示
        const getItemStatus = (type, item) => {
          switch (type) {
            case 'todo':
              return item.info || item.leftTime || item.type || '待办';
            case 'homework':
              return getHomeworkStatus(item);
            case 'exam':
              return item.finished ? '已完成' : (item.expired ? '已过期' : (item.timeLeft || '进行中'));
            case 'activities':
              return item.status || (item.finished ? '已完成' : '进行中');
            case 'progress':
              return item.isComplete ? '已完成' : (parseInt(item.completionRate) >= 100 ? '已完成' : '进行中');
            default: return '';
          }
        };

        // 获取状态 badge 类名
        const getItemBadgeClass = (type, item) => {
          switch (type) {
            case 'todo':
              return item.isActivity ? 'status-warning' : (item.type === '作业' ? 'status-normal' : 'status-urgent');
            case 'homework':
              return getHomeworkBadgeClass(item);
            case 'exam':
              return item.finished ? 'status-done' : (item.expired ? 'status-gray' : 'status-urgent');
            case 'activities':
              return item.finished ? 'status-done' : (item.ongoing ? 'status-warning' : 'status-normal');
            case 'progress':
              return item.isComplete || parseInt(item.completionRate) >= 100 ? 'status-done' : 'status-normal';
            default: return 'status-normal';
          }
        };

        // 渲染详情页视图
        const renderDetailView = (type) => {
          const viewItems = getViewItems(type);
          const sortedItems = sortItems(viewItems, type, currentSort.value);
          const isLoading = getViewLoading(type)
            && !(type === 'activities' && activitiesFromCache.value)
            && !(type === 'progress' && progressFromCache.value);
          const title = getViewTitle(type);
          const dotColors = { todo: '#1890ff', homework: '#faad14', exam: '#f5222d', activities: '#52c41a', progress: '#722ed1' };
          // 使用 getIgnoredItemsBySection 精确按板块过滤
          const allIgnored = getIgnoredItemsBySection(type);
          const ignoredCountNow = allIgnored.length;
          const renderProgressDetailActions = () => vue.createVNode("div", { class: "progress-detail-actions" }, [
            progressLastUpdate.value
              ? vue.createVNode("span", { class: "progress-last-update" }, `更新于 ${progressLastUpdate.value}`)
              : null,
            vue.createVNode("button", {
              class: "ignored-panel-btn",
              onClick: () => { showIgnoredPanel.value = true; selectedForRestore.value = new Set(); }
            }, `🚫 已忽略(${ignoredCountNow})`),
            settings.value.ignoreEnabled ? vue.createVNode("button", {
              class: `select-mode-btn ${selectMode.value ? 'active' : ''}`,
              onClick: toggleSelectMode
            }, selectMode.value ? "✕ 退出多选" : "多选") : null,
            vue.createVNode("button", {
              class: isProgressEnabled() ? "refresh-btn" : "refresh-btn disabled",
              onClick: () => {
                const newState = !isProgressEnabled();
                setProgressEnabled(newState);
                if (newState) {
                  progressLoaded.value = courseProgressItems.value.length > 0;
                  loadAllCourseProgress();
                }
              }
            }, !isProgressEnabled()
              ? "❌ 查询已关闭"
              : loadingProgress.value
                ? "🔄 查询中"
                : progressLoaded.value
                  ? "✓ 已查询"
                  : "🔍 待查询"),
            vue.createVNode("button", {
              class: "progress-delay-link",
              title: "在统一设置中修改课程进度请求间隔",
              onClick: openSettings
            }, `⏱ ${progressDelay.value}ms`),
            vue.createVNode("button", {
              class: "refresh-btn",
              onClick: () => loadAllCourseProgress()
            }, loadingProgress.value ? "刷新中..." : "🔄 刷新")
          ]);

          // 渲染已忽略面板内容
          if (showIgnoredPanel.value) {
            return vue.createVNode("div", { class: "detail-view" }, [
              vue.createVNode("div", { class: "detail-header" }, [
                vue.createVNode("div", { class: "detail-header-left" }, [
                  vue.createVNode("button", {
                    class: "back-btn",
                    onClick: () => { showIgnoredPanel.value = false; selectedForRestore.value = new Set(); }
                  }, ["← 返回列表"]),
                  vue.createVNode("div", { class: "detail-title" }, [
                    "🚫 已忽略内容",
                    vue.createVNode("span", { class: "detail-count" }, `共 ${allIgnored.length} 项`)
                  ])
                ]),
                selectedForRestore.value.size > 0
                  ? vue.createVNode("button", {
                    class: "batch-restore-btn",
                    onClick: batchRestore
                  }, `恢复所选(${selectedForRestore.value.size})`)
                  : null
              ]),
              vue.createVNode("div", { class: "detail-body" }, [
                allIgnored.length === 0
                  ? vue.createVNode("div", { class: "empty-state" }, "暂无已忽略内容")
                  : allIgnored.map(ig => {
                    const isChecked = selectedForRestore.value.has(ig._key);
                    return vue.createVNode("div", {
                      class: "detail-list-item",
                      style: isChecked ? "background:#e6f7ff;" : ""
                    }, [
                      vue.createVNode("div", {
                        class: `select-checkbox ${isChecked ? 'checked' : ''}`,
                        onClick: (e) => { e.stopPropagation(); toggleRestoreItem(ig._key); }
                      }, isChecked ? "✓" : ""),
                      vue.createVNode("div", { class: "detail-item-main" }, [
                        vue.createVNode("div", { class: "detail-item-title" }, ig.title),
                        vue.createVNode("div", { class: "detail-item-meta" }, [
                          ig.course ? vue.createVNode("span", {}, ig.course) : null,
                          ig.type ? vue.createVNode("span", { class: "course-tag", style: "margin-left:6px;" }, ig.type) : null,
                          vue.createVNode("span", { class: "ignored-date", style: "margin-left:8px;" },
                            `忽略于：${new Date(ig.ignoredAt).toLocaleDateString()}`)
                        ])
                      ]),
                      vue.createVNode("button", {
                        class: "restore-single-btn",
                        onClick: (e) => { e.stopPropagation(); restoreSingle(ig._key); }
                      }, "撤销忽略")
                    ]);
                  })
              ])
            ]);
          }

          // 渲染正常详情页
          return vue.createVNode("div", { class: "detail-view" }, [
            // 详情页头部
            vue.createVNode("div", { class: `detail-header ${type === 'progress' ? 'progress-detail-header' : ''}` }, [
              vue.createVNode("div", { class: "detail-header-left" }, [
                vue.createVNode("button", {
                  class: "back-btn",
                  onClick: backToDashboard
                }, ["← 返回仪表盘"]),
                vue.createVNode("div", { class: "detail-title" }, [
                  vue.createVNode("span", { class: "indicator-dot", style: `background: ${dotColors[type]};` }),
                  title,
                  ((type === 'activities' && activitiesFromCache.value) || (type === 'progress' && progressFromCache.value))
                    ? vue.createVNode("span", { class: "cache-source-note" }, "缓存内容 · 正在更新") : null,
                  vue.createVNode("span", { class: "detail-count" }, `共 ${viewItems.length} 项`)
                ])
              ]),
              type === 'progress'
                ? renderProgressDetailActions()
                : vue.createVNode("div", { style: "display:flex;gap:8px;align-items:center;" }, [
                  // 已忽略按钮
                  settings.value.ignoreEnabled ? vue.createVNode("button", {
                    class: "ignored-panel-btn",
                    onClick: () => { showIgnoredPanel.value = true; selectedForRestore.value = new Set(); }
                  }, `🚫 已忽略(${ignoredCountNow})`) : null,
                  // 多选按钮
                  settings.value.ignoreEnabled ? vue.createVNode("button", {
                    class: `select-mode-btn ${selectMode.value ? 'active' : ''}`,
                    onClick: toggleSelectMode
                  }, selectMode.value ? "✕ 退出多选" : "多选") : null,
                  // 仅作业、考试存在对应原始聚合页；待办、课程任务和课程进度不显示无效入口。
                  (type === 'homework' || type === 'exam') ? vue.createVNode("button", {
                    class: "external-link-btn",
                    onClick: () => navigateToOriginal(type)
                  }, "在原始页面打开") : null
                ])
            ]),
            // 工具栏：排序选择器
            vue.createVNode("div", { class: "detail-toolbar" }, [
              vue.createVNode("div", { class: "sort-container" }, [
                vue.createVNode("span", { class: "sort-label" }, "排序方式："),
                vue.createVNode("select", {
                  class: "sort-select",
                  value: currentSort.value,
                  onChange: (e) => { currentSort.value = e.target.value; }
                }, sortOptions.map(opt =>
                  vue.createVNode("option", { value: opt.value }, opt.label)
                ))
              ]),
              vue.createVNode("div", { style: "font-size: 13px; color: #999;" },
                type === 'progress'
                  ? `已完成: ${viewItems.filter(i => parseInt(i.completionRate) >= 100).length} / ${viewItems.length} 门课程`
                  : `未完成: ${viewItems.filter(i => !i.finished && (i.uncommitted !== false)).length} 项`
              )
            ]),
            // 详情页内容
            vue.createVNode("div", { class: `detail-body ${type === 'progress' ? 'progress-detail-body' : ''}` }, [
              isLoading
                ? renderLoadingSkeleton(`正在加载${title}…`)
                : sortedItems.length === 0
                  ? vue.createVNode("div", { class: "empty-state" }, "暂无数据")
                  : type === 'progress'
                    // 课程进度特殊渲染 - 全屏卡片布局，保持原有样式
                    ? vue.createVNode("div", { class: "detail-progress-grid" }, [
                        sortedItems.map(item => {
                          const rate = parseInt(item.completionRate) || 0;
                          const rateClass = rate >= 100 ? 'complete' : (rate >= 60 ? 'warning' : (rate >= 30 ? 'normal' : 'danger'));
                          const cacheKey = `${item.courseId}_${item.clazzId}`;
                          const cachedData = courseActivitiesCache.value[cacheKey];
                          const activitiesLoading = cachedData?.loading || false;
                          const activities = cachedData?.activities || [];

                          // 分类活动
                          const quizActivities = activities.filter(a => a.type?.includes('测验') || a.type?.includes('练习'));
                          const workActivities = activities.filter(a => a.type?.includes('作业'));
                          const examActivities = activities.filter(a => a.type?.includes('考试'));
                          const interactiveActivities = activities.filter(a => a.type?.includes('讨论') || a.type?.includes('抢答') || a.type?.includes('评分'));

                          return vue.createVNode("div", {
                            class: "detail-progress-item",
                            onMouseenter: (e) => handleProgressItemHover(e, item),
                            onMouseleave: e => handleProgressItemLeave(e),
                            onClick: () => {
                              if (item.studyDataUrl) {
                                window.open(item.studyDataUrl, '_blank');
                              }
                            }
                          }, [
                            vue.createVNode("div", { class: "progress-item-main" }, [
                              vue.createVNode("div", { class: "progress-item-title" }, item.courseName),
                              vue.createVNode("div", { class: "progress-bar" }, [
                                vue.createVNode("div", {
                                  class: `progress-bar-fill ${rateClass}`,
                                  style: `width: ${Math.min(rate, 100)}%;`
                                })
                              ])
                            ]),
                            vue.createVNode("div", { class: "progress-item-info" }, [
                              vue.createVNode("span", { class: `progress-rate ${rateClass}` }, item.completionRate),
                              vue.createVNode("div", { class: "progress-tasks-count" },
                                `${item.completedTasks}/${item.totalTasks} 任务点`
                              ),
                              settings.value.ignoreEnabled && !selectMode.value ? vue.createVNode("button", {
                                class: "ignore-btn",
                                onClick: (e) => { e.stopPropagation(); requestIgnore(item, 'progress'); }
                              }, "🚫") : null
                            ]),
                            // 悬浮窗
                            vue.createVNode("div", { class: "progress-tooltip" }, [
                              vue.createVNode("div", { class: "tooltip-title" }, item.courseName),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "完成进度"),
                                vue.createVNode("span", { class: `value ${rate >= 100 ? 'success' : (rate >= 60 ? 'warning' : 'highlight')}` }, item.completionRate)
                              ]),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "课程积分"),
                                vue.createVNode("span", { class: "value" }, item.courseScore || "点击查看")
                              ]),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "章节测验"),
                                vue.createVNode("span", { class: "value" }, item.chapterQuiz || "点击查看")
                              ]),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "当前排名"),
                                vue.createVNode("span", { class: "value highlight" }, item.ranking || "点击查看")
                              ]),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "AI实践"),
                                vue.createVNode("span", { class: "value" }, item.aiPractice || "点击查看")
                              ]),
                              vue.createVNode("div", { class: "tooltip-row" }, [
                                vue.createVNode("span", { class: "label" }, "分组任务"),
                                vue.createVNode("span", { class: "value" }, item.groupTask || "点击查看")
                              ]),
                              // 活动列表
                              vue.createVNode("div", { class: "tooltip-activities-section" }, [
                                vue.createVNode("div", { class: "tooltip-activities-title" }, "📚 学习活动"),
                                activitiesLoading
                                  ? vue.createVNode("div", { class: "tooltip-loading" }, "加载中...")
                                  : activities.length === 0
                                    ? vue.createVNode("div", { class: "tooltip-no-activities" }, "暂无学习活动")
                                    : [
                                        workActivities.length > 0
                                          ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                              vue.createVNode("div", { class: "activity-group-title" }, [
                                                vue.createVNode("span", { class: "activity-icon" }, "📝"),
                                                vue.createVNode("span", null, "课程作业"),
                                                vue.createVNode("span", { class: "activity-count" }, `(${workActivities.length})`)
                                              ]),
                                              vue.createVNode("div", { class: "activity-list" },
                                                workActivities.slice(0, 5).map(act =>
                                                  vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                    vue.createVNode("span", { class: "activity-name" }, act.title),
                                                    vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                      act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                    )
                                                  ])
                                                )
                                              )
                                            ])
                                          : null,
                                        examActivities.length > 0
                                          ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                              vue.createVNode("div", { class: "activity-group-title" }, [
                                                vue.createVNode("span", { class: "activity-icon" }, "📋"),
                                                vue.createVNode("span", null, "在线考试"),
                                                vue.createVNode("span", { class: "activity-count" }, `(${examActivities.length})`)
                                              ]),
                                              vue.createVNode("div", { class: "activity-list" },
                                                examActivities.slice(0, 5).map(act =>
                                                  vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                    vue.createVNode("span", { class: "activity-name" }, act.title),
                                                    vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                      act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                    )
                                                  ])
                                                )
                                              )
                                            ])
                                          : null,
                                        quizActivities.length > 0
                                          ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                              vue.createVNode("div", { class: "activity-group-title" }, [
                                                vue.createVNode("span", { class: "activity-icon" }, "📖"),
                                                vue.createVNode("span", null, "章节测验"),
                                                vue.createVNode("span", { class: "activity-count" }, `(${quizActivities.length})`)
                                              ]),
                                              vue.createVNode("div", { class: "activity-list" },
                                                quizActivities.slice(0, 5).map(act =>
                                                  vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                    vue.createVNode("span", { class: "activity-name" }, act.title),
                                                    vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                      act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                    )
                                                  ])
                                                )
                                              )
                                            ])
                                          : null,
                                        interactiveActivities.length > 0
                                          ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                              vue.createVNode("div", { class: "activity-group-title" }, [
                                                vue.createVNode("span", { class: "activity-icon" }, "💬"),
                                                vue.createVNode("span", null, "互动测验"),
                                                vue.createVNode("span", { class: "activity-count" }, `(${interactiveActivities.length})`)
                                              ]),
                                              vue.createVNode("div", { class: "activity-list" },
                                                interactiveActivities.slice(0, 5).map(act =>
                                                  vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                    vue.createVNode("span", { class: "activity-name" }, act.title),
                                                    vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                      act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                    )
                                                  ])
                                                )
                                              )
                                            ])
                                          : null
                                      ]
                              ])
                            ])
                          ]);
                        })
                      ])
                    : sortedItems.map(item => {
                    const itemKey = getItemKey(item, type);
                    const isChecked = selectMode.value && selectedForIgnore.value.has(itemKey);
                    return vue.createVNode("div", {
                      class: "detail-list-item",
                      style: isChecked ? "background:#fff1f0;" : ""
                    }, [
                      // 多选复选框
                      selectMode.value ? vue.createVNode("div", {
                        class: `select-checkbox ${isChecked ? 'checked' : ''}`,
                        onClick: (e) => { e.stopPropagation(); toggleSelectItem(item, type); }
                      }, isChecked ? "✓" : "") : null,
                      vue.createVNode("div", { class: "detail-item-main" }, [
                        vue.createVNode("div", { class: "detail-item-title" }, item.title),
                        vue.createVNode("div", { class: "detail-item-meta" }, [
                          vue.createVNode("span", {}, item.course || item.courseName || ''),
                          type === 'activities' ? vue.createVNode("span", {}, `· ${item.type || '活动'}`) : null
                        ])
                      ]),
                      vue.createVNode("div", { class: "item-time-status" }, [
                        // 详情页仅保留设计后的状态标签，避免重复显示浅灰状态/时间文本。
                        vue.createVNode("div", { class: "status-info" }, [
                          vue.createVNode("span", {
                            class: `badge ${getItemBadgeClass(type, item)}`
                          }, getItemStatus(type, item))
                        ]),
                        // 查看按钮
                        vue.createVNode("button", {
                          class: "view-btn",
                          onClick: (e) => { e.stopPropagation(); window.open(getItemLink(type, item), '_blank'); }
                        }, "查看"),
                        // 忽略按钮（非多选模式下才显示）
                        settings.value.ignoreEnabled && !selectMode.value ? vue.createVNode("button", {
                          class: "ignore-btn",
                          onClick: (e) => { e.stopPropagation(); requestIgnore(item, type); }
                        }, "🚫 忽略") : null
                      ])
                    ]);
                  }),
              // 多选批量操作栏
              selectMode.value && selectedForIgnore.value.size > 0
                ? vue.createVNode("div", { class: "batch-bar" }, [
                  vue.createVNode("span", {}, `已选 ${selectedForIgnore.value.size} 项`),
                  vue.createVNode("button", {
                    class: "batch-ignore-btn",
                    onClick: () => { ignoreConfirmSection.value = type; batchIgnoreSelected(); }
                  }, `忽略所选(${selectedForIgnore.value.size})`)
                ]) : null
            ])
          ]);
        };


        // 根据当前视图渲染
        // 确认弹窗渲染函数
        const renderConfirmDialog = () => {
          if (!showIgnoreConfirm.value) return null;
          return vue.createVNode("div", { class: "confirm-overlay", onClick: cancelIgnore }, [
            vue.createVNode("div", { class: "confirm-dialog", onClick: (e) => e.stopPropagation() }, [
              vue.createVNode("div", { class: "confirm-title" }, "⚠️ 确认忽略"),
              vue.createVNode("div", { class: "confirm-list" },
                ignoreConfirmItems.value.map(it =>
                  vue.createVNode("div", { class: "confirm-list-item" }, it.title || it.courseName || "未知项目")
                )
              ),
              vue.createVNode("div", { class: "confirm-hint" },
                "忽略后这些项目将不再显示在列表中，但可在\u300C查看全部 \u2192 已忽略\u300D中找回并撤销。"
              ),
              vue.createVNode("div", { class: "confirm-actions" }, [
                vue.createVNode("button", { class: "confirm-cancel-btn", onClick: cancelIgnore }, "取消"),
                vue.createVNode("button", { class: "confirm-ok-btn", onClick: confirmIgnore }, "确认忽略")
              ])
            ])
          ]);
        };

        if (currentView.value === 'settings') {
          return vue.createVNode("div", { class: "dashboard-wrapper" }, [
            vue.createVNode("div", { class: "main-content" }, [renderSettingsView()])
          ]);
        }
        if (currentView.value === 'dashboard-loading') {
          return renderDashboardSkeleton();
        }
        if (currentView.value !== 'dashboard') {
          return vue.createVNode("div", { class: "dashboard-wrapper" }, [
            vue.createVNode("div", { class: "main-content" }, [
              renderDetailView(currentView.value)
            ]),
            renderConfirmDialog()
          ]);
        }
        // 渲染仪表盘视图
        return vue.createVNode("div", { class: "dashboard-wrapper" }, [
          vue.createVNode("div", { class: "main-content" }, [
            // 头部欢迎区域
            vue.createVNode("div", { class: "dashboard-header" }, [
              vue.createVNode("div", { class: "welcome-row" }, [
                vue.createVNode("div", { class: "welcome-text" }, `👋 ${greeting.value}，${userName.value}`),
                vue.createVNode("div", { style: "display:flex;align-items:center;gap:12px;" }, [
                  vue.createVNode("div", { class: "date-info" }, dateInfo.value),
                  vue.createVNode("button", { class: "external-link-btn", onClick: openSettings }, "⚙ 设置")
                ])
              ]),
              !settings.value.settingsHintSeen ? vue.createVNode("div", { class: "settings-onboarding" }, [
                vue.createVNode("div", { class: "settings-onboarding-copy" }, [
                  vue.createVNode("span", { class: "settings-onboarding-icon" }, "✨"),
                  vue.createVNode("span", null, "默认只展示核心学习任务；签到、问卷、抢答、通知等可在设置中按需开启。")
                ]),
                vue.createVNode("span", { class: "settings-onboarding-actions" }, [
                  vue.createVNode("button", { class: "external-link-btn", onClick: () => { updateSetting('settingsHintSeen', true); openSettings(); } }, "去设置"),
                  vue.createVNode("button", { class: "back-btn", onClick: () => updateSetting('settingsHintSeen', true) }, "知道了")
                ])
              ]) : null,
              // 紧急提醒条
              filteredUrgentTasks.value.length > 0 ? vue.createVNode("div", {
                class: "urgent-strip",
                onClick: () => openFullScreen('todo')
              }, [
                vue.createVNode("div", { class: "urgent-left" }, [
                  vue.createVNode("span", { class: "urgent-icon" }, "🔔"),
                  vue.createVNode("span", {}, [
                    "你还有 ",
                    vue.createVNode("span", { class: "urgent-count" }, filteredUrgentTasks.value.length),
                    ` 个高优先级任务待处理：${filteredUrgentTasks.value.slice(0, 2).map(t => t.title).join('、')}${filteredUrgentTasks.value.length > 2 ? '等...' : ''}`
                  ])
                ]),
                vue.createVNode("div", { class: "urgent-action" }, "去处理 >")
              ]) : null
            ]),

            // 仪表盘网格
            vue.createVNode("div", { class: "dashboard-grid" }, [
              // 待办任务卡片
              vue.createVNode("div", { class: "card" }, [
                vue.createVNode("div", { class: "card-header" }, [
                  vue.createVNode("div", { class: "card-title" }, [
                    vue.createVNode("span", { class: "indicator-dot", style: "background: #1890ff;" }),
                    "待办任务"
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('todo')
                  }, "查看全部")
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loading.value.todo
                    ? renderLoadingSkeleton('正在加载待办任务…')
                    : filteredTodoItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "🎉 这里暂时还没有待办任务")
                      : sortItems(filteredTodoItems.value, 'todo', 'urgent').map(item =>
                        vue.createVNode("div", {
                          class: "list-item",
                          onClick: () => window.open(getTodoLink(item), '_blank')
                        }, [
                          vue.createVNode("div", { class: "item-main" }, [
                            vue.createVNode("div", { class: "task-title" }, item.title),
                            vue.createVNode("div", { class: "task-meta" }, [
                              vue.createVNode("span", { class: "course-tag" }, item.course || item.type || '任务')
                            ])
                          ]),
                          vue.createVNode("div", { class: "item-time-status" }, [
                            (item.leftTime || item.info) ? vue.createVNode("span", {
                              class: `time-display ${item.isUrgent || parseTimeToMinutes(item.leftTime || item.info) < 24 * 60 ? 'urgent' : ''}`
                            }, item.leftTime || item.info) : null,
                            vue.createVNode("span", {
                              class: `badge ${item.isActivity ? 'status-warning' : (item.type === '作业' ? 'status-normal' : 'status-urgent')}`
                            }, item.type || '待办'),
                            settings.value.ignoreEnabled ? vue.createVNode("button", {
                              class: "ignore-btn",
                              onClick: (e) => { e.stopPropagation(); requestIgnore(item, 'todo'); }
                            }, "🚫") : null
                          ])
                        ])
                      )
                ])
              ]),

              // 全部作业卡片
              vue.createVNode("div", { class: "card" }, [
                vue.createVNode("div", { class: "card-header" }, [
                  vue.createVNode("div", { class: "card-title" }, [
                    vue.createVNode("span", { class: "indicator-dot", style: "background: #faad14;" }),
                    "全部作业"
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('homework')
                  }, "查看全部")
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loading.value.homework
                    ? renderLoadingSkeleton('正在加载作业…')
                    : filteredHomeworkItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "📚 这里暂时还没有作业")
                      : sortItems(filteredHomeworkItems.value, 'homework', 'urgent').map(item =>
                        vue.createVNode("div", {
                          class: "list-item",
                          onClick: () => window.open(getHomeworkLink(item), '_blank')
                        }, [
                          vue.createVNode("div", { class: "item-main" }, [
                            vue.createVNode("div", { class: "task-title" }, item.title),
                            vue.createVNode("div", { class: "task-meta" }, item.course || '')
                          ]),
                          vue.createVNode("div", { class: "item-time-status" }, [
                            (item.leftTime) ? vue.createVNode("span", {
                              class: `time-display ${parseTimeToMinutes(item.leftTime) < 24 * 60 ? 'urgent' : ''}`
                            }, item.leftTime) : null,
                            vue.createVNode("span", {
                              class: `badge ${getHomeworkBadgeClass(item)}`
                            }, getHomeworkStatus(item)),
                            settings.value.ignoreEnabled ? vue.createVNode("button", {
                              class: "ignore-btn",
                              onClick: (e) => { e.stopPropagation(); requestIgnore(item, 'homework'); }
                            }, "🚫") : null
                          ])
                        ])
                      )
                ])
              ]),

              // 全部考试卡片
              vue.createVNode("div", { class: "card" }, [
                vue.createVNode("div", { class: "card-header" }, [
                  vue.createVNode("div", { class: "card-title" }, [
                    vue.createVNode("span", { class: "indicator-dot", style: "background: #f5222d;" }),
                    "全部考试"
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('exam')
                  }, "查看全部")
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loading.value.exam
                    ? renderLoadingSkeleton('正在加载考试…')
                    : filteredExamItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "📝 这里暂时还没有考试")
                      : sortItems(filteredExamItems.value, 'exam', 'urgent').map(item =>
                        vue.createVNode("div", {
                          class: "list-item",
                          onClick: () => window.open(getExamLink(item), '_blank')
                        }, [
                          vue.createVNode("div", { class: "item-main" }, [
                            vue.createVNode("div", { class: "task-title" }, item.title),
                            vue.createVNode("div", { class: "task-meta" }, item.course || '')
                          ]),
                          vue.createVNode("div", { class: "item-time-status" }, [
                            (item.timeLeft) ? vue.createVNode("span", {
                              class: `time-display ${!item.finished && parseTimeToMinutes(item.timeLeft) < 24 * 60 ? 'urgent' : ''}`
                            }, item.timeLeft) : null,
                            vue.createVNode("span", {
                              class: `badge ${item.finished ? 'status-done' : (item.expired ? 'status-gray' : 'status-urgent')}`
                            }, item.finished ? "已完成" : (item.expired ? "已过期" : "进行中")),
                            settings.value.ignoreEnabled ? vue.createVNode("button", {
                              class: "ignore-btn",
                              onClick: (e) => { e.stopPropagation(); requestIgnore(item, 'exam'); }
                            }, "🚫") : null
                          ])
                        ])
                      )
                ])
              ]),

              // 课程任务卡片
              vue.createVNode("div", { class: "card" }, [
                vue.createVNode("div", { class: "card-header" }, [
                  vue.createVNode("div", { class: "card-title" }, [
                    vue.createVNode("span", { class: "indicator-dot", style: "background: #52c41a;" }),
                    "课程任务",
                    activitiesFromCache.value ? vue.createVNode("span", { class: "cache-source-note" }, "缓存内容 · 正在更新") : null
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('activities')
                  }, "查看全部")
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loading.value.activities && !activitiesLoaded.value
                    ? renderLoadingSkeleton('正在加载课程任务…')
                    : activitiesLoadFailed.value
                      ? vue.createVNode("button", { class: "empty-state", onClick: () => loadActivitiesData() }, "课程任务加载失败，点击重试")
                    : !activitiesLoaded.value
                      ? renderLoadingSkeleton('正在加载课程任务…')
                    : filteredActivitiesItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "✨ 这里暂时还没有课程任务")
                      : sortItems(filteredActivitiesItems.value, 'activities', 'urgent').map(item =>
                        vue.createVNode("div", {
                          class: "list-item",
                          onClick: () => window.open(getActivityLink(item), '_blank')
                        }, [
                          vue.createVNode("div", { class: "item-main" }, [
                            vue.createVNode("div", { class: "task-title" }, item.title),
                            vue.createVNode("div", { class: "task-meta" }, [
                              vue.createVNode("span", { class: "course-tag" }, item.courseName || ''),
                              ` · ${item.type || '活动'}`
                            ])
                          ]),
                          vue.createVNode("div", { class: "item-time-status" }, [
                            (item.leftTime) ? vue.createVNode("span", {
                              class: `time-display ${parseTimeToMinutes(item.leftTime) < 24 * 60 ? 'urgent' : ''}`
                            }, item.leftTime) : null,
                            vue.createVNode("span", {
                              class: `badge ${item.finished ? 'status-done' : (item.ongoing ? 'status-warning' : 'status-normal')}`
                            }, item.status || (item.finished ? "已完成" : "进行中")),
                            settings.value.ignoreEnabled ? vue.createVNode("button", {
                              class: "ignore-btn",
                              onClick: (e) => { e.stopPropagation(); requestIgnore(item, 'activities'); }
                            }, "🚫") : null
                          ])
                        ])
                      )
                ])
              ]),

              // 课程进度卡片
              vue.createVNode("div", { class: "card progress-card" }, [
                vue.createVNode("div", { class: "card-header" }, [
                  vue.createVNode("div", { class: "card-title" }, [
                    vue.createVNode("span", { class: "indicator-dot", style: "background: #722ed1;" }),
                    "课程进度",
                    progressFromCache.value ? vue.createVNode("span", { class: "cache-source-note" }, "缓存内容 · 正在更新") : null
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('progress')
                  }, "查看全部"),
                  vue.createVNode("div", { style: "display: flex; align-items: center; gap: 8px;" }, [
                    progressLastUpdate.value ? vue.createVNode("span", { class: "progress-last-update" }, `更新于 ${progressLastUpdate.value}`) : null,
                    // 已忽略按钮
                    vue.createVNode("button", {
                      class: "ignored-panel-btn",
                      onClick: () => { showProgressIgnoredPanel.value = !showProgressIgnoredPanel.value; progressIgnoredForRestore.value = new Set(); }
                    }, (() => {
                      ignoredVersion.value;
                      const cnt = getIgnoredItemsBySection('progress').length;
                      return `🚫 已忽略(${cnt})`;
                    })()),
                    // 课程进度查询开关按钮
                    vue.createVNode("button", {
                      class: isProgressEnabled() ? "refresh-btn" : "refresh-btn disabled",
                      onClick: () => {
                        const newState = !isProgressEnabled();
                        setProgressEnabled(newState);
                        if (newState) {
                          progressLoaded.value = courseProgressItems.value.length > 0;
                          loadAllCourseProgress();
                        }
                      }
                    }, !isProgressEnabled()
                      ? "❌ 查询已关闭"
                      : loadingProgress.value
                        ? "🔄 查询中"
                        : progressLoaded.value
                          ? "✓ 已查询"
                          : "🔍 待查询"),
                    // 当前延迟，点击可进入统一设置修改。
                    vue.createVNode("button", {
                      class: "progress-delay-link",
                      title: "在统一设置中修改课程进度请求间隔",
                      onClick: openSettings
                    }, `⏱ ${progressDelay.value}ms`),
                    vue.createVNode("button", {
                      class: "refresh-btn",
                      onClick: () => loadAllCourseProgress()
                    }, loadingProgress.value ? "刷新中..." : "🔄 刷新")
                  ])
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  // 已忽略面板
                  showProgressIgnoredPanel.value
                    ? vue.createVNode("div", {}, [
                      vue.createVNode("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;" }, [
                        vue.createVNode("span", { style: "font-size:13px;color:#722ed1;font-weight:500;" }, "🚫 课程进度 · 已忽略内容"),
                        vue.createVNode("div", { style: "display:flex;gap:8px;" }, [
                          progressIgnoredForRestore.value.size > 0
                            ? vue.createVNode("button", { class: "batch-restore-btn", onClick: batchProgressRestore },
                              `恢复所选(${progressIgnoredForRestore.value.size})`)
                            : null,
                          vue.createVNode("button", {
                            class: "ignored-panel-btn",
                            onClick: () => { showProgressIgnoredPanel.value = false; progressIgnoredForRestore.value = new Set(); }
                          }, "← 返回")
                        ])
                      ]),
                      (() => {
                        ignoredVersion.value;
                        const progressIgnored = getIgnoredItemsBySection('progress');
                        if (progressIgnored.length === 0) {
                          return vue.createVNode("div", { class: "empty-state" }, "暂无已忽略的课程进度");
                        }
                        return vue.createVNode("div", { style: "display:flex;flex-direction:column;gap:8px;" },
                          progressIgnored.map(ig => {
                            const isChecked = progressIgnoredForRestore.value.has(ig._key);
                            return vue.createVNode("div", {
                              class: "detail-list-item",
                              style: isChecked ? "background:#e6f7ff;" : ""
                            }, [
                              vue.createVNode("div", {
                                class: `select-checkbox ${isChecked ? 'checked' : ''}`,
                                onClick: (e) => { e.stopPropagation(); toggleProgressRestoreItem(ig._key); }
                              }, isChecked ? "✓" : ""),
                              vue.createVNode("div", { class: "detail-item-main" }, [
                                vue.createVNode("div", { class: "detail-item-title" }, ig.title),
                                vue.createVNode("span", { class: "ignored-date" }, `忽略于：${new Date(ig.ignoredAt).toLocaleDateString()}`)
                              ]),
                              vue.createVNode("button", {
                                class: "restore-single-btn",
                                onClick: (e) => { e.stopPropagation(); restoreSingle(ig._key); }
                              }, "撤销忽略")
                            ]);
                          })
                        );
                      })()
                    ])
                    // 正常进度列表
                    : loadingProgress.value && !progressLoaded.value
                      ? renderLoadingSkeleton('正在加载课程进度…')
                      : !progressLoaded.value
                        ? renderLoadingSkeleton('正在加载课程进度…')
                      : !isProgressEnabled()
                        ? vue.createVNode("div", { class: "empty-state" }, "课程进度查询已关闭，开启后会自动加载")
                      : progressLoadFailed.value
                        ? vue.createVNode("button", { class: "empty-state", onClick: () => loadAllCourseProgress() }, "课程进度加载失败，点击重试")
                      : filteredCourseProgressItems.value.length === 0
                        ? vue.createVNode("div", { class: "empty-state" }, "暂无课程进度数据")
                        : vue.createVNode("div", { class: "progress-items-grid" },
                          filteredCourseProgressItems.value.map(course => {
                            const rate = parseInt(course.completionRate) || 0;
                            const rateClass = rate >= 100 ? 'complete' : (rate >= 60 ? 'warning' : (rate >= 30 ? 'normal' : 'danger'));
                            const cacheKey = getCourseActivitiesKey(course);
                            const cachedData = courseActivitiesCache.value[cacheKey];
                            const activitiesLoading = cachedData?.loading || false;
                            const activities = cachedData?.activities || [];

                            // 分类活动
                            const quizActivities = activities.filter(a => a.type?.includes('测验') || a.type?.includes('练习'));
                            const workActivities = activities.filter(a => a.type?.includes('作业'));
                            const examActivities = activities.filter(a => a.type?.includes('考试'));
                            const interactiveActivities = activities.filter(a => a.type?.includes('讨论') || a.type?.includes('抢答') || a.type?.includes('评分'));

                            return vue.createVNode("div", {
                              class: "progress-item",
                              onMouseenter: (e) => handleProgressItemHover(e, course),
                              onMouseleave: e => handleProgressItemLeave(e),
                              onClick: () => {
                                if (course.studyDataUrl) {
                                  window.open(course.studyDataUrl, '_blank');
                                }
                              }
                            }, [
                              vue.createVNode("div", { class: "progress-item-main" }, [
                                vue.createVNode("div", { class: "progress-item-title" }, course.courseName),
                                vue.createVNode("div", { class: "progress-bar" }, [
                                  vue.createVNode("div", {
                                    class: `progress-bar-fill ${rateClass}`,
                                    style: `width: ${Math.min(rate, 100)}%;`
                                  })
                                ])
                              ]),
                              vue.createVNode("div", { class: "progress-item-info" }, [
                                vue.createVNode("span", { class: `progress-rate ${rateClass}` }, course.completionRate),
                                vue.createVNode("div", { class: "progress-tasks-count" },
                                  `${course.completedTasks}/${course.totalTasks} 任务点`
                                ),
                                settings.value.ignoreEnabled ? vue.createVNode("button", {
                                  class: "ignore-btn",
                                  onClick: (e) => { e.stopPropagation(); requestIgnore(course, 'progress'); }
                                }, "🚫") : null
                              ]),
                              // 增强版悬浮提示
                              vue.createVNode("div", { class: "progress-tooltip" }, [
                                vue.createVNode("div", { class: "tooltip-title" }, course.courseName),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "完成进度"),
                                  vue.createVNode("span", { class: `value ${rate >= 100 ? 'success' : (rate >= 60 ? 'warning' : 'highlight')}` }, course.completionRate)
                                ]),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "课程积分"),
                                  vue.createVNode("span", { class: "value" }, course.courseScore || "点击查看")
                                ]),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "章节测验"),
                                  vue.createVNode("span", { class: "value" }, course.chapterQuiz || "点击查看")
                                ]),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "当前排名"),
                                  vue.createVNode("span", { class: "value highlight" }, course.ranking || "点击查看")
                                ]),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "AI实践"),
                                  vue.createVNode("span", { class: "value" }, course.aiPractice || "点击查看")
                                ]),
                                vue.createVNode("div", { class: "tooltip-row" }, [
                                  vue.createVNode("span", { class: "label" }, "分组任务"),
                                  vue.createVNode("span", { class: "value" }, course.groupTask || "点击查看")
                                ]),

                                // 活动列表区域
                                vue.createVNode("div", { class: "tooltip-activities-section" }, [
                                  vue.createVNode("div", { class: "tooltip-activities-title" }, "📚 学习活动"),

                                  // 加载状态
                                  activitiesLoading
                                    ? vue.createVNode("div", { class: "tooltip-loading" }, "正在加载活动...")
                                    : activities.length === 0
                                      ? vue.createVNode("div", { class: "tooltip-no-activities" }, "暂无学习活动")
                                      : [
                                          // 作业
                                          workActivities.length > 0
                                            ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                                vue.createVNode("div", { class: "activity-group-title" }, [
                                                  vue.createVNode("span", { class: "activity-icon" }, "📝"),
                                                  vue.createVNode("span", null, "课程作业"),
                                                  vue.createVNode("span", { class: "activity-count" }, `(${workActivities.length})`)
                                                ]),
                                                vue.createVNode("div", { class: "activity-list" },
                                                  workActivities.slice(0, 3).map(act =>
                                                    vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                      vue.createVNode("span", { class: "activity-name" }, act.title),
                                                      vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                        act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                      )
                                                    ])
                                                  )
                                                )
                                              ])
                                            : null,

                                          // 考试
                                          examActivities.length > 0
                                            ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                                vue.createVNode("div", { class: "activity-group-title" }, [
                                                  vue.createVNode("span", { class: "activity-icon" }, "📋"),
                                                  vue.createVNode("span", null, "在线考试"),
                                                  vue.createVNode("span", { class: "activity-count" }, `(${examActivities.length})`)
                                                ]),
                                                vue.createVNode("div", { class: "activity-list" },
                                                  examActivities.slice(0, 3).map(act =>
                                                    vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                      vue.createVNode("span", { class: "activity-name" }, act.title),
                                                      vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                        act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                      )
                                                    ])
                                                  )
                                                )
                                              ])
                                            : null,

                                          // 测验
                                          quizActivities.length > 0
                                            ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                                vue.createVNode("div", { class: "activity-group-title" }, [
                                                  vue.createVNode("span", { class: "activity-icon" }, "📖"),
                                                  vue.createVNode("span", null, "章节测验"),
                                                  vue.createVNode("span", { class: "activity-count" }, `(${quizActivities.length})`)
                                                ]),
                                                vue.createVNode("div", { class: "activity-list" },
                                                  quizActivities.slice(0, 3).map(act =>
                                                    vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                      vue.createVNode("span", { class: "activity-name" }, act.title),
                                                      vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                        act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                      )
                                                    ])
                                                  )
                                                )
                                              ])
                                            : null,

                                          // 互动测验
                                          interactiveActivities.length > 0
                                            ? vue.createVNode("div", { class: "tooltip-activity-group" }, [
                                                vue.createVNode("div", { class: "activity-group-title" }, [
                                                  vue.createVNode("span", { class: "activity-icon" }, "💬"),
                                                  vue.createVNode("span", null, "互动测验"),
                                                  vue.createVNode("span", { class: "activity-count" }, `(${interactiveActivities.length})`)
                                                ]),
                                                vue.createVNode("div", { class: "activity-list" },
                                                  interactiveActivities.slice(0, 3).map(act =>
                                                    vue.createVNode("div", { class: `activity-item ${act.ongoing ? 'ongoing' : (act.finished ? 'finished' : '')}` }, [
                                                      vue.createVNode("span", { class: "activity-name" }, act.title),
                                                      vue.createVNode("span", { class: `activity-status ${act.ongoing ? 'status-ongoing' : (act.finished ? 'status-finished' : 'status-pending')}` },
                                                        act.ongoing ? '进行中' : (act.finished ? '已完成' : '未开始')
                                                      )
                                                    ])
                                                  )
                                                )
                                              ])
                                            : null
                                        ]
                                ]),

                                vue.createVNode("div", {
                                  style: "margin-top: 10px; padding-top: 8px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #1890ff; text-align: center; cursor: pointer;"
                                }, "📊 点击查看完整学习记录")
                              ])
                            ]);
                          })
                        )
                ])
              ])
            ])
          ]),
          // 全局确认弹窗
          renderConfirmDialog(),
          !settings.value.courseIgnoreHintSeen ? vue.createVNode("div", {
            class: "course-ignore-onboarding",
            role: "dialog",
            'aria-labelledby': 'course-ignore-onboarding-title'
          }, [
            vue.createVNode("div", { class: "course-ignore-onboarding-head" }, [
              vue.createVNode("span", { class: "course-ignore-onboarding-icon", 'aria-hidden': 'true' }, "🛡️"),
              vue.createVNode("div", null, [
                vue.createVNode("div", { id: "course-ignore-onboarding-title", class: "course-ignore-onboarding-title" }, "忽略不需要查询的课程"),
                vue.createVNode("div", { class: "course-ignore-onboarding-copy" }, "可将已结课或无需关注的课程加入忽略列表，减少无效查询和触发风控的概率。")
              ])
            ]),
            vue.createVNode("div", { class: "course-ignore-onboarding-actions" }, [
              vue.createVNode("button", { class: "back-btn", onClick: () => updateSetting('courseIgnoreHintSeen', true) }, "知道了"),
              vue.createVNode("button", { class: "external-link-btn", onClick: openCourseIgnoreFromHint }, "去忽略课程")
            ])
          ]) : null,
          dashboardSkeletonOverlay.value ? renderDashboardSkeletonOverlay() : null
        ]);
      };
    }
  });


  const appendApp = () => {

    const vuetify$1 = vuetify.createVuetify({
      icons: {
        defaultSet: "md",
        aliases,
        sets: {
          md
        }
      }
    });
    let app = _sfc_main$1;
    const urlDetect2 = urlDetection();
    if (urlDetect2 === "homework") app = _sfc_main$2;
    if (urlDetect2 === "exam") app = _sfc_main;
    if (urlDetect2 === "todo") app = _sfc_todo;
    if (urlDetect2 === "activities") app = _sfc_activities;
    if (urlDetect2 === "dashboard") app = _sfc_dashboard;

    vue.createApp(app).use(vuetify$1).mount(
      (() => {
        const app2 = document.createElement("div");
        document.body.append(app2);
        return app2;
      })()
    );
  };
  const urlDetect = urlDetection();
  if (urlDetect === "homework" || urlDetect === "todo" || urlDetect === "activities" || urlDetect === "dashboard") {
    wrapElements();
    removeStyles();
    removeScripts();
    appendApp();
  }
  if (urlDetect === "exam") {
    wrapElements();
    removeStyles();
    removeScripts();
    keepRemoveHtmlStyle();
    appendApp();
  }
  if (urlDetect === "home") {
    fixCssConflict();
    initMenus();
    // 延迟后自动点击仪表盘菜单
    setTimeout(() => {
      const dashboardMenuItem = document.querySelector('#first1000000') ||
        document.querySelector('#first_chaoxing_assignment_dashboard');
      if (dashboardMenuItem) {
        dashboardMenuItem.click();
        console.log('[脚本] 自动切换到学习仪表盘');
      }
    }, 500);
  }
  if (urlDetect === "legacyHome") {
    fixCssConflict();
    initMenus();
    // 延迟后自动点击仪表盘菜单
    setTimeout(() => {
      const dashboardMenuItem = document.querySelector('#first_chaoxing_assignment_dashboard') ||
        document.querySelector('a[href*="chaoxing-dashboard"]');
      if (dashboardMenuItem) {
        dashboardMenuItem.click();
        console.log('[脚本] 自动切换到学习仪表盘');
      }
    }, 500);
  }

})(Vuetify, Vue);
