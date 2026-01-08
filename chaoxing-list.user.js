// ==UserScript==
// @name         学习通作业/考试/任务列表（优化版）
// @namespace    https://github.com/Cooanyh
// @version      2.4.8
// @author       甜檸Cirtron (lcandy2); Modified by Coren
// @description  【优化版】支持作业、考试、课程任务列表快速查看。基于原版脚本修改：1. 新增支持在 https://i.chaoxing.com/ 空间页面显示；2. 优化考试与作业列表 UI；3. 新增"任务"/"课程任务"标签，汇总所有课程的待办任务；4. 新增待办即将过期任务提醒；5. 整合学习仪表盘，UI 极简优化，支持板块全屏查看；6. v2.2.0 UI 重构升级：全新设计风格、欢迎区域、状态胶囊。
// @license      AGPL-3.0-or-later
// @copyright    lcandy2 All Rights Reserved
// @copyright    2025, Coren (Modified based on original work)
// @source       https://github.com/lcandy2/user.js/tree/main/websites/chaoxing.com/chaoxing-assignment
// @match        *://mooc1-api.chaoxing.com/work/stu-work*
// @match        *://i.chaoxing.com/*
// @match        *://i.chaoxing.com/base*
// @match        *://i.mooc.chaoxing.com/space/index*
// @match        *://i.mooc.chaoxing.com/settings*
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
// @match        *://mooc2-ans.chaoxing.com/*
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
        responseType: options.responseType || 'text',
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

  // 获取单个课程的活动/任务列表 (使用 JSON API)
  const fetchCourseActivities = async (course) => {
    try {
      // 使用正确的 JSON API 接口
      const timestamp = Date.now();
      const url = `https://mobilelearn.chaoxing.com/v2/apis/active/student/activelist?fid=0&courseId=${course.courseId}&classId=${course.clazzId}&showNotStartedActive=0&_=${timestamp}`;
      console.log(`[课程任务] 获取课程任务 ${course.courseName}:`, url);
      const response = await gmFetch(url);
      console.log(`[课程任务] ${course.courseName} 原始响应:`, response.responseText.substring(0, 300));

      const data = JSON.parse(response.responseText);
      console.log(`[课程任务] ${course.courseName} 解析后:`, data);

      // 尝试多种可能的数据结构
      let activeList = null;
      if (data.data && data.data.activeList) {
        activeList = data.data.activeList;
      } else if (data.activeList) {
        activeList = data.activeList;
      } else if (Array.isArray(data.data)) {
        activeList = data.data;
      } else if (Array.isArray(data)) {
        activeList = data;
      }

      if (!activeList || activeList.length === 0) {
        console.log(`[课程任务] ${course.courseName} 没有找到任务列表`);
        return [];
      }

      console.log(`[课程任务] ${course.courseName} 找到 ${activeList.length} 个任务`);

      const activities = activeList.map((item) => {
        // 活动类型映射
        const typeMap = {
          0: '签到', 2: '签到', 4: '抢答', 5: '主题讨论', 6: '投票',
          14: '问卷', 17: '直播', 23: '随堂练习', 35: '分组任务', 42: '随堂练习',
          43: '评分', 45: '拍照', 47: '作业', 64: '笔记'
        };

        // 状态判断：status=1 进行中，status=2 已结束
        const isOngoing = item.status === 1;
        const isEnded = item.status === 2;

        return {
          activeId: item.id || item.activeId || '',
          title: item.nameOne || item.name || item.title || '未知任务',
          type: typeMap[item.activeType] || typeMap[item.type] || `类型${item.activeType || item.type}`,
          status: isOngoing ? '进行中' : (isEnded ? '已结束' : '未开始'),
          time: item.startTime ? new Date(item.startTime).toLocaleString() : '',
          endTime: item.endTime ? new Date(item.endTime).toLocaleString() : '',
          courseName: course.courseName,
          courseId: course.courseId,
          clazzId: course.clazzId,
          cpi: course.cpi,
          finished: isEnded,
          ongoing: isOngoing,
          activeType: item.activeType || item.type
        };
      });

      return activities;
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
                  info: activity.endTime || '进行中',
                  status: '进行中',
                  courseId: activity.courseId,
                  clazzId: activity.clazzId,
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

  // --- 便当盒仪表盘组件 ---
  const _sfc_dashboard = /* @__PURE__ */ vue.defineComponent({
    __name: "dashboard",
    setup(__props) {
      // 辅助函数：获取用户姓名
      const getUserName = () => {
        // i.chaoxing.com/base 页面
        const userNameEl = document.querySelector('.user-name');
        if (userNameEl) return userNameEl.textContent.trim();
        // i.mooc.chaoxing.com/space/index 页面
        const personalNameEl = document.querySelector('.personalName');
        if (personalNameEl) return personalNameEl.textContent.trim();
        return '同学';
      };

      // 辅助函数：获取时间问候语
      const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 6) return '夜深了';
        if (hour < 12) return '早上好';
        if (hour < 14) return '中午好';
        if (hour < 18) return '下午好';
        return '晚上好';
      };

      // 辅助函数：获取格式化日期
      const getFormattedDate = () => {
        const now = new Date();
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 · 星期${weekdays[now.getDay()]}`;
      };

      // 数据状态
      const userName = vue.ref(getUserName());
      const greeting = vue.ref(getGreeting());
      const dateInfo = vue.ref(getFormattedDate());

      const loading = vue.ref({
        todo: true,
        homework: false,
        exam: false,
        activities: true
      });

      const todoItems = vue.ref([]);
      const homeworkItems = vue.ref([]);
      const examItems = vue.ref([]);
      const activitiesItems = vue.ref([]);
      const urgentTasks = vue.ref([]);

      // 课程进度数据
      const courseProgressItems = vue.ref([]);
      const loadingProgress = vue.ref(false);
      const progressLastUpdate = vue.ref(null);

      // 获取所有课程列表（从主页或课程列表页）
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
                    data.channelList.forEach(channel => {
                      // 只处理课程类型 (cataid === '100000002')
                      if (channel.cataid === '100000002' && channel.content && channel.content.course) {
                        const courseData = channel.content.course.data;
                        if (courseData && Array.isArray(courseData)) {
                          courseData.forEach(course => {
                            courses.push({
                              courseId: course.id,
                              clazzId: channel.key,
                              cpi: channel.cpi,
                              courseName: course.name,
                              teacherName: course.teacherfactor || ''
                            });
                          });
                        }
                      }
                    });
                  }

                  console.log('[课程进度] 解析到课程:', courses.length, '个');
                  resolve(courses);
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

      // 获取课程进度 - 使用 mooc1 入口 URL（浏览器打开时自动重定向获取 enc）
      const getCourseProgress = async (course) => {
        // mooc1 的课程入口，使用 interaction 接口，这是标准的重定向入口
        const courseEntryUrl = `https://mooc1.chaoxing.com/visit/interaction?clazzId=${course.clazzId}&courseId=${course.courseId}&cpi=${course.cpi}`;

        // 尝试从章节页面获取完成率
        return new Promise((resolve) => {
          // 尝试访问不带 enc 的章节页面（可能返回重定向或错误，但我们先尝试）
          const chapterUrl = `https://mooc2-ans.chaoxing.com/mooc2-ans/mycourse/studentcourse?clazzid=${course.clazzId}&courseid=${course.courseId}&cpi=${course.cpi}`;

          if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
              method: 'GET',
              url: chapterUrl,
              timeout: 10000,
              onload: (response) => {
                try {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(response.responseText, 'text/html');

                  // 查找 "已完成任务点: <span>99</span>/100" 格式
                  const headEl = doc.querySelector('.chapter_head h2.xs_head_name');
                  let completedTasks = 0;
                  let totalTasks = 100;
                  let completionRate = '点击查看';
                  let shouldFilter = false;

                  // 检查是否已结课 - 同时检查多种选择器
                  const warnTxt = doc.querySelector('.top-tips .warn-txt') || doc.querySelector('.warn-txt');
                  if (warnTxt && warnTxt.textContent.includes('本课程已结课')) {
                    shouldFilter = true;
                    console.log('[课程进度] 过滤已结课课程:', course.courseName);
                  }

                  if (headEl) {
                    const text = headEl.textContent || '';
                    // 匹配 "99/100" 格式或 "<span>99</span>/100" 中的数字
                    // 使用更宽松的匹配：查找"已完成任务点"后面的数字格式
                    const match = text.match(/(\d+)\s*\/\s*(\d+)/);
                    if (match) {
                      completedTasks = parseInt(match[1]) || 0;
                      totalTasks = parseInt(match[2]) || 0;

                      // 过滤无任务点的课程 (0/0 或任何 totalTasks=0 的情况)
                      if (totalTasks === 0) {
                        shouldFilter = true;
                        console.log('[课程进度] 过滤无任务点课程:', course.courseName, `(${completedTasks}/${totalTasks})`);
                      }

                      completionRate = totalTasks > 0 ? Math.round(completedTasks / totalTasks * 100) + '%' : '0%';
                      console.log('[课程进度]', course.courseName, '完成率:', completionRate, `(${completedTasks}/${totalTasks})`);
                    }
                  }

                  // 计算未完成任务数量（class="catalog_jindu catalog_tishi120"）
                  const unfinishedElements = doc.querySelectorAll('.catalog_jindu.catalog_tishi120');
                  const unfinishedCount = unfinishedElements.length;

                  resolve({
                    ...course,
                    totalTasks,
                    completedTasks,
                    completionRate,
                    unfinishedTasks: [],
                    unfinishedCount,
                    studyDataUrl: courseEntryUrl,
                    isComplete: completedTasks >= totalTasks,
                    shouldFilter // 返回过滤标记
                  });
                } catch (e) {
                  console.log('[课程进度]', course.courseName, '解析失败，使用默认值');
                  resolve({
                    ...course,
                    totalTasks: 100,
                    completedTasks: 0,
                    completionRate: '点击查看',
                    unfinishedTasks: [],
                    unfinishedCount: 0,
                    studyDataUrl: courseEntryUrl,
                    isComplete: false
                  });
                }
              },
              onerror: () => {
                // 请求失败，使用默认值
                resolve({
                  ...course,
                  totalTasks: 100,
                  completedTasks: 0,
                  completionRate: '点击查看',
                  unfinishedTasks: [],
                  unfinishedCount: 0,
                  studyDataUrl: courseEntryUrl,
                  isComplete: false
                });
              },
              ontimeout: () => {
                resolve({
                  ...course,
                  totalTasks: 100,
                  completedTasks: 0,
                  completionRate: '点击查看',
                  unfinishedTasks: [],
                  unfinishedCount: 0,
                  studyDataUrl: courseEntryUrl,
                  isComplete: false
                });
              }
            });
          } else {
            resolve({
              ...course,
              totalTasks: 100,
              completedTasks: 0,
              completionRate: '点击查看',
              unfinishedTasks: [],
              unfinishedCount: 0,
              studyDataUrl: courseEntryUrl,
              isComplete: false
            });
          }
        });
      };

      // 加载所有课程进度
      const loadAllCourseProgress = async () => {
        console.log('[课程进度] 开始加载课程进度...');
        loadingProgress.value = true;
        try {
          const courses = await getAllCourses();
          console.log('[课程进度] 获取到课程:', courses.length, '个，准备请求前20门...');
          if (courses.length > 0) {
            const progressPromises = courses.map(c => getCourseProgress(c)); // 获取所有课程进度
            console.log('[课程进度] 等待所有进度请求完成...');
            const results = await Promise.all(progressPromises);

            // 过滤并排序结果
            courseProgressItems.value = results
              .filter(item => !item.shouldFilter) // 过滤掉标记为需要过滤的课程
              .sort((a, b) => {
                if (a.isComplete && !b.isComplete) return 1;
                if (!a.isComplete && b.isComplete) return -1;
                return parseInt(a.completionRate) - parseInt(b.completionRate);
              });
            progressLastUpdate.value = new Date().toLocaleTimeString();
          }
        } catch (e) {
          console.error('加载课程进度失败:', e);
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
        if (str.includes('过期') || str.includes('截止')) return -1;
        let minutes = 0;
        const dayMatch = str.match(/(\d+)\s*天/);
        const hourMatch = str.match(/(\d+)\s*小时/);
        const minMatch = str.match(/(\d+)\s*分/);
        if (dayMatch) minutes += parseInt(dayMatch[1]) * 24 * 60;
        if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
        if (minMatch) minutes += parseInt(minMatch[1]);
        return minutes || Infinity;
      };

      // 智能排序函数：未完成+剩余时间短的在最上面
      const sortItems = (items, type, sortType = 'urgent') => {
        const arr = [...items];

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

        // 获取进行中的课程活动
        let ongoingActivities = [];
        try {
          const courses = await fetchCourseList();
          const batchSize = 5;
          for (let i = 0; i < courses.length; i += batchSize) {
            const batch = courses.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(course => fetchCourseActivities(course)));
            batchResults.flat().filter(activity => activity.ongoing).forEach(activity => {
              ongoingActivities.push({
                type: activity.type, title: activity.title, course: activity.courseName,
                info: activity.endTime || '进行中', status: '进行中',
                courseId: activity.courseId, clazzId: activity.clazzId, isActivity: true
              });
            });
          }
        } catch (e) { console.error('[仪表盘] 获取课程任务失败:', e); }

        todoItems.value = [...pendingTasks, ...pendingExams, ...ongoingActivities];

        // 计算紧急任务
        urgentTasks.value = todoItems.value.filter(item => {
          const timeStr = item.leftTime || item.timeLeft || item.info || '';
          if (timeStr.includes('小时')) return parseInt(timeStr) <= 24;
          if (timeStr.includes('天')) return parseInt(timeStr) < 1;
          if (timeStr.includes('分钟') || timeStr.includes('分')) return true;
          if (item.isActivity && item.status === '进行中') return true;
          return false;
        });

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
        loading.value.activities = true;
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
        } catch (error) { console.error('[仪表盘] 加载课程任务失败:', error); }
        loading.value.activities = false;
      };

      // 链接生成函数
      const getTodoLink = (item) => {
        if (item.isActivity) {
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
        const url = new URL(API_VISIT_COURSE);
        url.searchParams.append("courseid", item.courseId);
        url.searchParams.append("clazzid", item.clazzId);
        url.searchParams.append("pageHeader", "8");
        return url.href;
      };

      const getExamLink = (item) => {
        const url = new URL(API_OPEN_EXAM);
        url.searchParams.append("courseId", item.courseId);
        url.searchParams.append("classId", item.classId);
        url.searchParams.append("examId", item.examId);
        return url.href;
      };

      const getActivityLink = (item) => {
        const url = new URL(API_VISIT_COURSE);
        url.searchParams.append("courseid", item.courseId);
        url.searchParams.append("clazzid", item.clazzId);
        return url.href;
      };

      // 切换视图函数（不跳转外部页面，在内部切换视图）
      const openFullScreen = (type) => {
        currentView.value = type;
      };

      // 返回仪表盘
      const backToDashboard = () => {
        currentView.value = 'dashboard';
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
        loadTodoData();
        loadHomeworkData();
        loadExamData();
        loadActivitiesData();
        // 加载课程进度数据
        loadAllCourseProgress();
        startProgressAutoRefresh();
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

        // 仪表盘 CSS 样式 (v2.2.0 新设计)
        const dashboardStyle = `
          /* 全局重置 */
          .dashboard-wrapper {
            font-family: "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont, sans-serif;
            background-color: #f5f7fa;
            min-height: 100vh;
            padding: 20px;
          }
          .dashboard-wrapper * { box-sizing: border-box; }
          .dashboard-wrapper a { text-decoration: none; color: inherit; }

          /* 主体内容 */
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
            align-items: start;
          }

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

          /* 课程进度卡片样式 */
          .progress-card {
            min-height: 200px;
          }
          .progress-item {
            display: flex;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid #f5f5f5;
            cursor: pointer;
            transition: background 0.2s;
          }
          .progress-item:hover {
            background: #fafafa;
            margin: 0 -12px;
            padding: 12px;
            border-radius: 6px;
          }
          .progress-item:last-child { border-bottom: none; }
          .progress-item-main {
            flex: 1;
            min-width: 0;
            margin-right: 12px;
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
            default: return '';
          }
        };

        // 获取视图数据
        const getViewItems = (type) => {
          switch (type) {
            case 'todo': return todoItems.value;
            case 'homework': return homeworkItems.value;
            case 'exam': return examItems.value;
            case 'activities': return activitiesItems.value;
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
            default: return '#';
          }
        };

        // 获取列表项状态显示
        const getItemStatus = (type, item) => {
          switch (type) {
            case 'todo':
              return item.info || item.leftTime || item.type || '待办';
            case 'homework':
              return item.uncommitted ? '待提交' : '已提交';
            case 'exam':
              return item.finished ? '已完成' : (item.expired ? '已过期' : (item.timeLeft || '进行中'));
            case 'activities':
              return item.status || (item.finished ? '已完成' : '进行中');
            default: return '';
          }
        };

        // 获取状态 badge 类名
        const getItemBadgeClass = (type, item) => {
          switch (type) {
            case 'todo':
              return item.isActivity ? 'status-warning' : (item.type === '作业' ? 'status-normal' : 'status-urgent');
            case 'homework':
              return item.uncommitted ? 'status-warning' : 'status-done';
            case 'exam':
              return item.finished ? 'status-done' : (item.expired ? 'status-gray' : 'status-urgent');
            case 'activities':
              return item.finished ? 'status-done' : (item.ongoing ? 'status-warning' : 'status-normal');
            default: return 'status-normal';
          }
        };

        // 渲染详情页视图
        const renderDetailView = (type) => {
          const rawItems = getViewItems(type);
          const sortedItems = sortItems(rawItems, type, currentSort.value);
          const isLoading = getViewLoading(type);
          const title = getViewTitle(type);
          const dotColors = { todo: '#1890ff', homework: '#faad14', exam: '#f5222d', activities: '#52c41a' };

          return vue.createVNode("div", { class: "detail-view" }, [
            // 详情页头部
            vue.createVNode("div", { class: "detail-header" }, [
              vue.createVNode("div", { class: "detail-header-left" }, [
                vue.createVNode("button", {
                  class: "back-btn",
                  onClick: backToDashboard
                }, [
                  "← 返回仪表盘"
                ]),
                vue.createVNode("div", { class: "detail-title" }, [
                  vue.createVNode("span", { class: "indicator-dot", style: `background: ${dotColors[type]};` }),
                  title,
                  vue.createVNode("span", { class: "detail-count" }, `共 ${rawItems.length} 项`)
                ])
              ]),
              vue.createVNode("button", {
                class: "external-link-btn",
                onClick: () => navigateToOriginal(type)
              }, "在原始页面打开")
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
                `未完成: ${rawItems.filter(i => !i.finished && (i.uncommitted !== false)).length} 项`
              )
            ]),
            // 详情页内容
            vue.createVNode("div", { class: "detail-body" }, [
              isLoading
                ? vue.createVNode("div", { class: "loading-state" }, [
                  vue.createVNode("div", { class: "loading-spinner" }),
                  vue.createVNode("div", { class: "loading-text" }, "加载中...")
                ])
                : sortedItems.length === 0
                  ? vue.createVNode("div", { class: "empty-state" }, "暂无数据")
                  : sortedItems.map(item =>
                    vue.createVNode("div", {
                      class: "detail-list-item"
                    }, [
                      vue.createVNode("div", { class: "detail-item-main" }, [
                        vue.createVNode("div", { class: "detail-item-title" }, item.title),
                        vue.createVNode("div", { class: "detail-item-meta" }, [
                          vue.createVNode("span", {}, item.course || item.courseName || ''),
                          type === 'activities' ? vue.createVNode("span", {}, `· ${item.type || '活动'}`) : null
                        ])
                      ]),
                      vue.createVNode("div", { class: "item-time-status" }, [
                        // 状态信息区（时间+状态）
                        vue.createVNode("div", { class: "status-info" }, [
                          // 剩余时间显示
                          (item.leftTime || item.timeLeft || item.info) ? vue.createVNode("span", {
                            class: `time-display ${item.isUrgent || parseTimeToMinutes(item.leftTime || item.timeLeft || item.info) < 24 * 60 ? 'urgent' : ''}`
                          }, item.leftTime || item.timeLeft || item.info) : null,
                          // 状态显示
                          vue.createVNode("span", {
                            class: `badge ${getItemBadgeClass(type, item)}`
                          }, getItemStatus(type, item))
                        ]),
                        // 查看按钮（独立在右侧）
                        vue.createVNode("button", {
                          class: "view-btn",
                          onClick: (e) => { e.stopPropagation(); window.open(getItemLink(type, item), '_blank'); }
                        }, "查看")
                      ])
                    ])
                  )
            ])
          ]);
        };

        // 根据当前视图渲染
        if (currentView.value !== 'dashboard') {
          return vue.createVNode("div", { class: "dashboard-wrapper" }, [
            vue.createVNode("div", { class: "main-content" }, [
              renderDetailView(currentView.value)
            ])
          ]);
        }

        // 渲染仪表盘视图
        return vue.createVNode("div", { class: "dashboard-wrapper" }, [
          vue.createVNode("div", { class: "main-content" }, [
            // 头部欢迎区域
            vue.createVNode("div", { class: "dashboard-header" }, [
              vue.createVNode("div", { class: "welcome-row" }, [
                vue.createVNode("div", { class: "welcome-text" }, `👋 ${greeting.value}，${userName.value}`),
                vue.createVNode("div", { class: "date-info" }, dateInfo.value)
              ]),
              // 紧急提醒条
              urgentTasks.value.length > 0 ? vue.createVNode("div", {
                class: "urgent-strip",
                onClick: () => openFullScreen('todo')
              }, [
                vue.createVNode("div", { class: "urgent-left" }, [
                  vue.createVNode("span", { class: "urgent-icon" }, "🔔"),
                  vue.createVNode("span", {}, [
                    "你还有 ",
                    vue.createVNode("span", { class: "urgent-count" }, urgentTasks.value.length),
                    ` 个高优先级任务待处理：${urgentTasks.value.slice(0, 2).map(t => t.title).join('、')}${urgentTasks.value.length > 2 ? '等...' : ''}`
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
                    ? vue.createVNode("div", { class: "loading-state" }, [
                      vue.createVNode("div", { class: "loading-spinner" }),
                      vue.createVNode("div", { class: "loading-text" }, "加载中...")
                    ])
                    : todoItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "🎉 暂无待办任务")
                      : sortItems(todoItems.value, 'todo', 'urgent').map(item =>
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
                            // 剩余时间
                            (item.leftTime || item.info) ? vue.createVNode("span", {
                              class: `time-display ${item.isUrgent || parseTimeToMinutes(item.leftTime || item.info) < 24 * 60 ? 'urgent' : ''}`
                            }, item.leftTime || item.info) : null,
                            // 状态
                            vue.createVNode("span", {
                              class: `badge ${item.isActivity ? 'status-warning' : (item.type === '作业' ? 'status-normal' : 'status-urgent')}`
                            }, item.type || '待办')
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
                    ? vue.createVNode("div", { class: "loading-state" }, [
                      vue.createVNode("div", { class: "loading-spinner" }),
                      vue.createVNode("div", { class: "loading-text" }, "加载中...")
                    ])
                    : homeworkItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "暂无作业")
                      : sortItems(homeworkItems.value, 'homework', 'urgent').map(item =>
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
                              class: `badge ${item.uncommitted ? 'status-warning' : 'status-done'}`
                            }, item.uncommitted ? "待提交" : "已提交")
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
                    ? vue.createVNode("div", { class: "loading-state" }, [
                      vue.createVNode("div", { class: "loading-spinner" }),
                      vue.createVNode("div", { class: "loading-text" }, "加载中...")
                    ])
                    : examItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "🎉 暂无考试")
                      : sortItems(examItems.value, 'exam', 'urgent').map(item =>
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
                            }, item.finished ? "已完成" : (item.expired ? "已过期" : "进行中"))
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
                    "课程任务"
                  ]),
                  vue.createVNode("a", {
                    class: "card-more",
                    onClick: () => openFullScreen('activities')
                  }, "查看全部")
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loading.value.activities
                    ? vue.createVNode("div", { class: "loading-state" }, [
                      vue.createVNode("div", { class: "loading-spinner" }),
                      vue.createVNode("div", { class: "loading-text" }, "加载中...")
                    ])
                    : activitiesItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "暂无课程任务")
                      : sortItems(activitiesItems.value, 'activities', 'urgent').map(item =>
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
                            }, item.status || (item.finished ? "已完成" : "进行中"))
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
                    "课程进度"
                  ]),
                  vue.createVNode("div", { style: "display: flex; align-items: center; gap: 8px;" }, [
                    progressLastUpdate.value ? vue.createVNode("span", { class: "progress-last-update" }, `更新于 ${progressLastUpdate.value}`) : null,
                    vue.createVNode("button", {
                      class: "refresh-btn",
                      onClick: () => loadAllCourseProgress()
                    }, loadingProgress.value ? "刷新中..." : "🔄 刷新")
                  ])
                ]),
                vue.createVNode("div", { class: "card-body" }, [
                  loadingProgress.value
                    ? vue.createVNode("div", { class: "loading-state" }, [
                      vue.createVNode("div", { class: "loading-spinner" }),
                      vue.createVNode("div", { class: "loading-text" }, "正在获取课程进度...")
                    ])
                    : courseProgressItems.value.length === 0
                      ? vue.createVNode("div", { class: "empty-state" }, "暂无课程进度数据")
                      : courseProgressItems.value.map(course => {
                        const rate = parseInt(course.completionRate) || 0;
                        const rateClass = rate >= 100 ? 'complete' : (rate >= 60 ? 'warning' : (rate >= 30 ? 'normal' : 'danger'));
                        return vue.createVNode("div", {
                          class: "progress-item",
                          onClick: () => {
                            // 使用获取到的详情页链接（包含 pEnc 签名）
                            if (course.studyDataUrl) {
                              window.open(course.studyDataUrl, '_blank');
                            }
                          }
                        }, [
                          vue.createVNode("div", { class: "progress-item-main" }, [
                            vue.createVNode("div", { class: "progress-item-title" }, course.courseName),
                            vue.createVNode("div", { class: "progress-bar-wrapper" }, [
                              vue.createVNode("div", { class: "progress-bar" }, [
                                vue.createVNode("div", {
                                  class: `progress-bar-fill ${rateClass}`,
                                  style: `width: ${Math.min(rate, 100)}%;`
                                })
                              ]),
                              vue.createVNode("span", { class: `progress-rate ${rateClass}` }, course.completionRate)
                            ]),
                            vue.createVNode("div", { class: "progress-tasks-count" },
                              `${course.completedTasks}/${course.totalTasks} 任务点`
                            ),
                            course.unfinishedTasks.length > 0 ? vue.createVNode("div", { class: "progress-unfinished" },
                              `未完成: ${course.unfinishedTasks.slice(0, 2).map(t => t.title.substring(0, 15)).join('、')}${course.unfinishedTasks.length > 2 ? '...' : ''}`
                            ) : null
                          ])
                        ]);
                      })
                ])
              ])
            ])
          ])
        ]);
      };
    }
  });


  const appendApp = () => {
    // 这里的 aliases 和 md 现在能正确引用到了
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

  // 课程章节页面自动导航逻辑
  if (urlDetect === "course_chapter") {
    console.log('[脚本] 检测到课程章节页面，准备自动导航...');

    const autoNavigate = () => {
      // 1. 确保在"章节"标签页
      const chapterTab = document.querySelector('li[dataname="zj"]');
      if (chapterTab && !chapterTab.classList.contains('curNav')) {
        console.log('[自动导航] 切换到章节标签页');
        chapterTab.click();
        // 点击后等待内容加载，然后继续查找未完成任务
        setTimeout(autoNavigate, 1000);
        return;
      }

      // 2. 查找第一个未完成的任务点
      // 查找包含 catalog_tishi120 类的元素 (未完成标志)
      const uncompletedIcon = document.querySelector('.catalog_jindu.catalog_tishi120');

      if (uncompletedIcon) {
        console.log('[自动导航] 发现未完成任务点');
        // 尝试找到可点击的容器 (通常是父级 h3 或 h3 下的 a 标签，或者整个 li)
        // 结构通常是: <li> <div class="file-name"> <h3> <a href="..."> ... <span class="catalog_jindu ..."></span> </a> </h3> </div> </li>
        // 或者点击 h3 元素

        const clickableItem = uncompletedIcon.closest('h3') || uncompletedIcon.closest('a') || uncompletedIcon.closest('li');

        if (clickableItem) {
          // 找到包含任务名称的元素用于日志
          const taskName = clickableItem.querySelector('.resourcename') || clickableItem;
          console.log('[自动导航] 点击跳转到任务:', taskName.innerText ? taskName.innerText.trim() : '未知任务');

          clickableItem.click();

          // 如果是链接，可能需要直接 click clickItem.querySelector('a')
          const link = clickableItem.querySelector('a');
          if (link) {
            link.click();
          }
        } else {
          console.warn('[自动导航] 未找到可点击的任务容器');
        }
      } else {
        console.log('[自动导航] 未发现未完成任务，恭喜！');
      }
    };

    // 等待页面加载完成后执行
    // 使用 requestAnimationFrame 或 setTimeout 确保 DOM 渲染
    setTimeout(autoNavigate, 1500);
  }

})(Vuetify, Vue);
