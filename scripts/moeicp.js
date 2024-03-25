hexo.extend.filter.register('after_render:html', (str, data) => {
    return str.replace(/<ul class="kratos-copyright">([\s\S]*)<div>([\s\S]*?)<\/div>\s*<\/ul>/g, (match, p1, p2) => {
        let icps = p2 + '<li><a href="https://icp.gov.moe/?keyword=20240550" target="_blank">萌ICP备20240550号</a></li>';
        return `<ul class="kratos-copyright">${p1}<div>${icps}</div></ul>`;
    });
}, 9);
