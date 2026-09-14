import unittest
from clean_text import clean_paragraph, clean_paragraphs


class CleaningTests(unittest.TestCase):
    def test_inline_ad_keeps_both_sides(self):
        original = '空窍玄妙异常。阅读....免费电子书下载你可以说它无限大，又可以说它无限小。'
        self.assertEqual(clean_paragraph(original)[0], '空窍玄妙异常。你可以说它无限大，又可以说它无限小。')

    def test_dialogue_and_author_note_survive_footer(self):
        original = '“我拒绝。”（ps：感谢大家！）(未完待续。如果您喜欢这部作品，欢迎您来（.）投推荐票、月票，您的支持，就是我最大的动力。手机用户请到.阅读。)'
        self.assertEqual(clean_paragraph(original)[0], '“我拒绝。”（ps：感谢大家！）')

    def test_normal_words_and_ellipses_are_not_ads(self):
        for text in ['他的食物来源很不稳定。', '他仔细阅读原文，搜索其中的线索。', '……', '...', '轰！', '（ps：求月票，谢谢各位书友！）', '不要乱发广告、诅咒图等等，会被踢的。']:
            self.assertEqual(clean_paragraph(text)[0], text)

    def test_source_and_stray_semicolon(self):
        for text in ['原文：http://www.biqu520.net/0_262/179136.html', '\u3000\u3000;', '来源：http://www.biqu520.net/0_262/']:
            self.assertEqual(clean_paragraph(text)[0], '')

    def test_watermark_does_not_remove_story(self):
        self.assertEqual(clean_paragraph('这股黑色气运。水印广告测试水印广告测试整体呈棺椁形状。')[0], '这股黑色气运。整体呈棺椁形状。')

    def test_specific_recommendation_boundary(self):
        paragraphs = ['下面推荐一本书，给朋友们。', '恐怖网文》纯洁滴小龙著', '此章节正在https://努力更新ing，请稍后刷新访问', '不属于本书的网站推荐']
        clean, _ = clean_paragraphs(paragraphs, '今后每天双更，感谢大家！')
        self.assertEqual(clean, paragraphs[:2])


if __name__ == '__main__':
    unittest.main()
