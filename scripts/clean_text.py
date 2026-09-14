"""Conservative rules verified against the supplied EPUB; no broad keyword deletion."""
import re

FULL_LINES = [
    r'(?:原文|来源)\s*[:：]\s*https?://\S+\s*[;；]?',
    r'[;；]+', r'\(\.\)', r'，蛊真人', r'c[！!]*',
    r'最新网址[:：].*', r'热门推荐[:：][、,，]*',
    r'热门推荐：纯文字在线阅读本站域名手机同步阅读请访问',
    r'由于各种问题地址更改为请大家收藏新地址避免迷路',
    r'请记住本书首发域名[:：].*手机版阅读网址[:：].*',
    r'天才壹秒記住愛♂去÷小說→網，為您提供精彩小說閱讀。(?:（好看的小说)?',
    r'网页版章节内容慢，请下载爱阅小说app阅读最新内容',
    r'请退出转码页面，请下载爱阅小说app阅读最新章节。',
    r'网站即将关闭，下载爱阅app免费看最新内容',
    r'(?:新笔趣阁|ABC小说)为你提供最快的蛊真人更新，.*免费阅读。https?://',
    r'(?:5201小说)?高速首发蛊真人最新章节，.*推荐哦！(?:R\d+)?',
    r'(?:最快更新)?无错小说阅读，请访问请收藏本站阅读最新小说!',
    r'最快更新，无弹窗阅读请。',
    r'一秒记住【】，精彩小说无弹窗免费阅读！',
    r'\.?看蛊真人最新章节到长风文学',
    r'地一下云\.来\.阁即可获得观看】手机用户请访问',
    r'："\.\."，。，谢谢！',
]
INLINE = [
    ('download-ad', r'(?:阅读)?[.．]*免费电子书下载[.．]*(?:(?:本章节由网友上传|阅读)[.．]*)?(?:imeng。\)|m\)|c。m/c。m|\(·~\)|\(百度搜\)|：\.\.)?'),
    ('upload-label', r'本章节由网友上传'),
    ('watermark', r'水印广告测试'),
    ('source-banner', r'【本章节首发[．-]爱[．-]有[．-]声[．-]小说网,请记住网址】'),
    ('site-watermark', r'(?:-\.79xs\.-)?←→ㄨ79小說网|\.xXbiQuGe\.c0m|新笔趣阁'),
    ('latest-chapters', r',最新章节访问:\.。|。更多最新章节访问:ЩЩ\.。|\[看本书最新章节请到\]'),
    ('broken-html', r'(?:<>)?c_t;'),
    ('mobile-footer', r'\(未完待续。(?:如果您喜欢这部作品，欢迎您来.*?您的支持，就是我最大的动力。)?手机用户请到[^()]*?阅读。\)9?$'),
    ('mobile-footer', r'手机用户请访问(?:m\.)?$'),
    ('broken-url', r'[hН]ttps?:(?://+)?[A-Za-z0-9_./?=&%#-]*'),
    ('broken-watermark', r'\.\.imeng\.c|[.]*imeng。\)'),
    ('site-fragment', r'错小说网不少字'),
    ('reader-promotion', r'~搜搜篮色，即可全文阅读后面章节'),
]
FULL_LINES = [re.compile(p, re.I) for p in FULL_LINES]
INLINE = [(name, re.compile(p, re.I)) for name, p in INLINE]

def clean_paragraph(text):
    text = text.strip()
    if any(p.fullmatch(text) for p in FULL_LINES):
        return '', ['standalone-ad-or-markup']
    rules = []
    for name, pattern in INLINE:
        text, count = pattern.subn('', text)
        if count:
            rules.append(name)
    text = text.strip()
    return text, rules

def clean_paragraphs(paragraphs, title):
    result, changes = [], []
    in_recommendations = False
    for position, before in enumerate(paragraphs):
        # This specific author note is followed by an unrelated scraped site footer.
        # Keep the author's own preceding book recommendation intact.
        if title == '今后每天双更，感谢大家！' and before.startswith('此章节正在https://努力更新ing'):
            in_recommendations = True
        after, rules = ('', ['verified-site-recommendations']) if in_recommendations else clean_paragraph(before)
        if before != after:
            changes.append({'paragraph': position, 'rules': rules, 'before': before, 'after': after})
        if after:
            result.append(after)
    return result, changes
