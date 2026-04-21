/**
 * 学习通页面结构调试代码
 * 使用方法：
 * 1. 打开学习通课程列表页面或学习记录页面
 * 2. 按 F12 打开开发者工具
 * 3. 切换到 Console（控制台）标签
 * 4. 复制以下所有代码，粘贴到控制台，按回车执行
 */

(function() {
    'use strict';

    console.log('%c=== 学习通页面结构调试开始 ===', 'color: blue; font-size: 16px; font-weight: bold;');
    console.log('当前页面URL:', window.location.href);

    // 检查是否在学习记录页面
    const isStudyDataPage = window.location.href.includes('/visit/speech') ||
                           window.location.href.includes('/visit/speaker') ||
                           window.location.href.includes('course/course');

    if (!isStudyDataPage) {
        console.log('%c提示: 请访问课程的学习记录页面（点击课程名称旁边的"查看"按钮）', 'color: orange;');
    }

    console.log('\n%c--- 检查关键元素 ---', 'color: green; font-weight: bold;');

    const rankEl = document.querySelector('#jobRank');
    const pointEl = document.querySelector('#point');
    const testNumEl = document.querySelector('#testNum');
    const publishTestNumEl = document.querySelector('#publishTestNum');

    console.log('#jobRank 元素:', rankEl ? `存在，内容：${rankEl.textContent.trim()}` : '❌ 不存在');
    console.log('#point 元素:', pointEl ? `存在，内容：${pointEl.textContent.trim()}` : '❌ 不存在');
    console.log('#testNum 元素:', testNumEl ? `存在，内容：${testNumEl.textContent.trim()}` : '❌ 不存在');
    console.log('#publishTestNum 元素:', publishTestNumEl ? `存在，内容：${publishTestNumEl.textContent.trim()}` : '❌ 不存在');

    console.log('\n%c--- 检查包含"排名"的元素 ---', 'color: green; font-weight: bold;');
    const rankLabels = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent.includes('排名')
    );
    console.log('包含"排名"的元素数量:', rankLabels.length);

    if (rankLabels.length === 0) {
        console.log('❌ 页面中没有"排名"文本');
    } else {
        rankLabels.slice(0, 10).forEach((el, i) => {
            const parent = el.parentElement?.tagName || 'unknown';
            const grandParent = el.parentElement?.parentElement?.tagName || 'unknown';
            console.log(`排名元素 ${i+1}:`, {
                tag: el.tagName,
                class: el.className.substring(0, 50),
                text: el.textContent.trim().substring(0, 50),
                parent: parent,
                grandParent: grandParent
            });
        });
    }

    console.log('\n%c--- 检查包含"积分"的元素 ---', 'color: green; font-weight: bold;');
    const pointLabels = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent.includes('积分')
    );
    console.log('包含"积分"的元素数量:', pointLabels.length);

    if (pointLabels.length === 0) {
        console.log('❌ 页面中没有"积分"文本');
    } else {
        pointLabels.slice(0, 10).forEach((el, i) => {
            const parent = el.parentElement?.tagName || 'unknown';
            const grandParent = el.parentElement?.parentElement?.tagName || 'unknown';
            console.log(`积分元素 ${i+1}:`, {
                tag: el.tagName,
                class: el.className.substring(0, 50),
                text: el.textContent.trim().substring(0, 50),
                parent: parent,
                grandParent: grandParent
            });
        });
    }

    console.log('\n%c--- 检查包含"测验"的元素 ---', 'color: green; font-weight: bold;');
    const quizLabels = Array.from(document.querySelectorAll('*')).filter(el =>
        el.textContent.includes('测验')
    );
    console.log('包含"测验"的元素数量:', quizLabels.length);

    if (quizLabels.length === 0) {
        console.log('❌ 页面中没有"测验"文本');
    } else {
        quizLabels.slice(0, 10).forEach((el, i) => {
            console.log(`测验元素 ${i+1}:`, {
                tag: el.tagName,
                class: el.className.substring(0, 50),
                text: el.textContent.trim().substring(0, 100)
            });
        });
    }

    console.log('\n%c--- 检查 iframe ---', 'color: green; font-weight: bold;');
    const iframes = document.querySelectorAll('iframe');
    console.log('页面中的iframe数量:', iframes.length);

    iframes.forEach((iframe, i) => {
        console.log(`iframe ${i+1}:`, {
            id: iframe.id,
            class: iframe.className,
            src: iframe.src || '无src',
            srcdoc: iframe.getAttribute('srcdoc') ? '有srcdoc内容' : '无srcdoc'
        });
    });

    // 检查 frame_content-cj
    const frameContent = document.querySelector('#frame_content-cj');
    if (frameContent) {
        console.log('\n%c✅ 找到 #frame_content-cj iframe', 'color: green;');
        const srcdoc = frameContent.getAttribute('srcdoc');
        if (srcdoc) {
            console.log('srcdoc内容长度:', srcdoc.length);

            // 解析srcdoc
            const iframeDoc = new DOMParser().parseFromString(srcdoc, 'text/html');

            console.log('\n%c--- iframe 中的元素 ---', 'color: blue; font-weight: bold;');

            const iframeRankEl = iframeDoc.querySelector('#jobRank');
            const iframePointEl = iframeDoc.querySelector('#point');

            console.log('iframe #jobRank:', iframeRankEl ? iframeRankEl.textContent.trim() : '不存在');
            console.log('iframe #point:', iframePointEl ? iframePointEl.textContent.trim() : '不存在');

            const iframeRankLabels = Array.from(iframeDoc.querySelectorAll('*')).filter(el =>
                el.textContent.includes('排名')
            );
            console.log('iframe中包含"排名"的元素数量:', iframeRankLabels.length);
            iframeRankLabels.slice(0, 5).forEach((el, i) => {
                console.log(`iframe排名元素 ${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 50));
            });

            const iframePointLabels = Array.from(iframeDoc.querySelectorAll('*')).filter(el =>
                el.textContent.includes('积分')
            );
            console.log('iframe中包含"积分"的元素数量:', iframePointLabels.length);
            iframePointLabels.slice(0, 5).forEach((el, i) => {
                console.log(`iframe积分元素 ${i+1}:`, el.tagName, el.className, el.textContent.trim().substring(0, 50));
            });
        }
    } else {
        console.log('❌ 未找到 #frame_content-cj iframe');
    }

    console.log('\n%c=== 调试完成 ===', 'color: blue; font-size: 16px; font-weight: bold;');
    console.log('%c请将以上所有输出复制给我，以便分析问题。', 'color: orange;');
})();
