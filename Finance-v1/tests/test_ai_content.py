import unittest
from ai_client import content_text


class AIContentTests(unittest.TestCase):
    def test_plain_text_is_preserved(self):
        self.assertEqual(content_text('An answer'), 'An answer')

    def test_public_blocks_render_as_text_without_internal_reasoning(self):
        value = [{'type': 'reasoning', 'text': 'private'}, {'type': 'text', 'text': 'Public answer'}]
        self.assertEqual(content_text(value), 'Public answer')


if __name__ == '__main__':
    unittest.main()
