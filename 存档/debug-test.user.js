// ==UserScript==
// @name         学习通调试脚本
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  调试学习记录页面结构
// @match        *://mooc1.chaoxing.com/mycourse/*
// @match        *://mooc2.chaoxing.com/mycourse/*
// @match        *://mobilelearn.chaoxing.com/*
// @grant        GM_xmlhttpRequest
// @connect      chaoxing.com
// ==/UserScript==

(function() {
    'use strict';

    console.log('[调试脚本] 开始诊断...');

    const url = window.location.href;
    console.log('[调试脚本] 当前页面URL:', url);

    if (url.includes('mycourse/studentcourse')) {
        const courseLinks = document.querySelectorAll('a[href*="course/course"]');
        console.log('[调试脚本] 找到课程链接数量:', courseLinks.length);

        if (courseLinks.length > 0) {
            const firstLink = courseLinks[0];
            const courseName = firstLink.closest('.course-info')?.querySelector('.course-name')?.textContent?.trim()
                || firstLink.textContent?.trim()
                || '未知课程';

            console.log('[调试脚本] 第一个课程:', courseName);
            console.log('[调试脚本] 链接:', firstLink.href);

            setTimeout(() => {
                testStudyDataPage(firstLink.href, courseName);
            }, 1000);
        }
    } else if (url.includes('/visit/speaker')) {
        console.log('[调试脚本] 已在学习记录页面，开始分析DOM结构...');
        analyzeDOM();
    } else {
        console.log('[调试脚本] 请手动访问学习记录页面（课程名称旁边的"查看"按钮）');
    }

    function testStudyDataPage(url, courseName) {
        console.log('[调试脚本] 请求学习记录页面:', courseName);

        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                timeout: 10000,
                onload: (response) => {
                    console.log('[调试脚本] 学习记录页面请求成功');

                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const body = doc.body;

                    console.log('[调试脚本] === 开始分析页面结构 ===');

                    const rankEl = body.querySelector('#jobRank');
                    const pointEl = body.querySelector('#point');
                    const testNumEl = body.querySelector('#testNum');
                    const publishTestNumEl = body.querySelector('#publishTestNum');

                    console.log('[调试脚本] #jobRank 元素:', rankEl ? rankEl.textContent.trim() : '不存在');
                    console.log('[调试脚本] #point 元素:', pointEl ? pointEl.textContent.trim() : '不存在');
                    console.log('[调试脚本] #testNum 元素:', testNumEl ? testNumEl.textContent.trim() : '不存在');
                    console.log('[调试脚本] #publishTestNum 元素:', publishTestNumEl ? publishTestNumEl.textContent.trim() : '不存在');

                    const rankLabels = Array.from(body.querySelectorAll('*')).filter(el =>
                        el.textContent.includes('排名') || el.textContent.includes('当前排名')
                    );
                    console.log('[调试脚本] 包含"排名"的元素数量:', rankLabels.length);
                    rankLabels.slice(0, 5).forEach((el, i) => {
                        console.log(`[调试脚本] 排名元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
                    });

                    const pointLabels = Array.from(body.querySelectorAll('*')).filter(el =>
                        el.textContent.includes('积分') || el.textContent.includes('课程积分')
                    );
                    console.log('[调试脚本] 包含"积分"的元素数量:', pointLabels.length);
                    pointLabels.slice(0, 5).forEach((el, i) => {
                        console.log(`[调试脚本] 积分元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
                    });

                    const quizLabels = Array.from(body.querySelectorAll('*')).filter(el =>
                        el.textContent.includes('测验') || el.textContent.includes('章节测验')
                    );
                    console.log('[调试脚本] 包含"测验"的元素数量:', quizLabels.length);
                    quizLabels.slice(0, 5).forEach((el, i) => {
                        console.log(`[调试脚本] 测验元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
                    });

                    console.log('[调试脚本] === 检查iframe ===');
                    const iframes = body.querySelectorAll('iframe');
                    console.log('[调试脚本] 页面中的iframe数量:', iframes.length);
                    iframes.forEach((iframe, i) => {
                        console.log(`[调试脚本] iframe${i+1}:`, iframe.id, iframe.className, iframe.src ? 'src=' + iframe.src : 'srcdoc存在=' + (iframe.getAttribute('srcdoc') ? '是' : '否'));
                    });

                    const frameContent = body.querySelector('#frame_content-cj');
                    if (frameContent) {
                        const srcdoc = frameContent.getAttribute('srcdoc');
                        if (srcdoc) {
                            console.log('[调试脚本] 发现iframe#frame_content-cj有srcdoc内容，长度:', srcdoc.length);
                            const iframeDoc = new DOMParser().parseFromString(srcdoc, 'text/html');
                            const iframeRank = iframeDoc.querySelector('#jobRank');
                            const iframePoint = iframeDoc.querySelector('#point');
                            console.log('[调试脚本] iframe中#jobRank:', iframeRank ? iframeRank.textContent.trim() : '不存在');
                            console.log('[调试脚本] iframe中#point:', iframePoint ? iframePoint.textContent.trim() : '不存在');

                            const iframeRankLabels = Array.from(iframeDoc.querySelectorAll('*')).filter(el =>
                                el.textContent.includes('排名')
                            );
                            console.log('[调试脚本] iframe中包含"排名"的元素数量:', iframeRankLabels.length);
                            iframeRankLabels.slice(0, 5).forEach((el, i) => {
                                console.log(`[调试脚本] iframe排名元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
                            });
                        }
                    }

                    console.log('[调试脚本] === 页面HTML片段 ===');
                    const html = response.responseText;
                    const rankMatch = html.match(/[排名][:：\s]*(\d+)/i);
                    const pointMatch = html.match(/[积分][:：\s]*(\d+)/i);
                    const quizMatch = html.match(/章节测验[^\\n]{0,100}(\d+)\s*\/\s*(\d+)/i);

                    console.log('[调试脚本] HTML中匹配排名:', rankMatch ? rankMatch[0] : '未找到');
                    console.log('[调试脚本] HTML中匹配积分:', pointMatch ? pointMatch[0] : '未找到');
                    console.log('[调试脚本] HTML中匹配章节测验:', quizMatch ? quizMatch[0] : '未找到');

                    console.log('[调试脚本] === 分析完成 ===');
                },
                onerror: () => {
                    console.error('[调试脚本] 学习记录页面请求失败');
                },
                ontimeout: () => {
                    console.error('[调试脚本] 学习记录页面请求超时');
                }
            });
        } else {
            console.error('[调试脚本] GM_xmlhttpRequest不可用');
        }
    }

    function analyzeDOM() {
        console.log('[调试脚本] === 当前页面DOM分析 ===');

        const rankEl = document.querySelector('#jobRank');
        const pointEl = document.querySelector('#point');
        console.log('[调试脚本] #jobRank:', rankEl ? rankEl.textContent.trim() : '不存在');
        console.log('[调试脚本] #point:', pointEl ? pointEl.textContent.trim() : '不存在');

        const rankLabels = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent.includes('排名')
        );
        console.log('[调试脚本] 包含"排名"的元素数量:', rankLabels.length);
        rankLabels.slice(0, 5).forEach((el, i) => {
            console.log(`[调试脚本] 排名元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
        });

        const pointLabels = Array.from(document.querySelectorAll('*')).filter(el =>
            el.textContent.includes('积分')
        );
        console.log('[调试脚本] 包含"积分"的元素数量:', pointLabels.length);
        pointLabels.slice(0, 5).forEach((el, i) => {
            console.log(`[调试脚本] 积分元素${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 100));
        });

        console.log('[调试脚本] === 分析完成 ===');
    }
})();
